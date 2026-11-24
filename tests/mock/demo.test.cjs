const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../../docs/mock/demo-model.js");
const first = () => M.createState().hotels[0];

test("single-file demo embeds current assets in order without external dependencies", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const vm = require("node:vm");
  const read = (name) => fs.readFileSync(path.join(__dirname, "../../docs/mock", name), "utf8").replace(/\r\n/g, "\n");
  const html = read("demo.html");
  const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)];
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(styles.length, 1);
  assert.equal(styles[0][1], `\n${read("styles.css")}`);
  assert.equal(scripts.length, 2);
  ["demo-model.js", "app.js"].forEach((name, index) => {
    assert.equal(scripts[index][1], `\n${read(name).replace(/<\/script/gi, "<\\/script")}`);
    assert.doesNotThrow(() => new vm.Script(scripts[index][1]));
  });
  assert.ok(html.indexOf("<script>") > html.indexOf("</noscript>"));
  assert.doesNotMatch(html, /<script[^>]+\bsrc=|<link[^>]+\bhref=|@import|url\(/i);
});

test("unconfirmed/unknown facts do not become zero or ready metrics", () => {
  const h = first();
  assert.equal(M.getMetrics(h).occ, null);
  assert.equal(M.getMetrics(h).adr, null);
  assert.equal(M.getMetrics(h).revpar, null);
  assert.equal(M.getMetrics(h).ready, false);
  assert.throws(() => M.confirmField(h, "owner", "sold", ""), /未知/);
  M.confirmField(h, "owner", "sold", "2100");
  M.confirmField(h, "owner", "revenue", "588000");
  assert.deepEqual([M.getMetrics(h).occ, M.getMetrics(h).adr, M.getMetrics(h).revpar], [0.7, 280, 196]);
  assert.throws(() => M.confirmField(h, "owner", "sold", "3001"), /超过/);
  assert.throws(() => M.confirmField(h, "owner", "sold", "1.5"), /整数/);
  assert.throws(() => M.confirmField(h, "owner", "sold", "0"), /会计/);
});

test("zero nights and zero revenue preserve undefined ADR", () => {
  const h = first();
  h.fields.revenue.value = 0;
  M.confirmField(h, "owner", "sold", "0");
  M.confirmField(h, "owner", "revenue", "0");
  assert.equal(M.getMetrics(h).ready, true);
  assert.equal(M.getMetrics(h).occ, 0);
  assert.equal(M.getMetrics(h).adr, null);
  assert.equal(M.getMetrics(h).revpar, 0);
});

test("invitation lifecycle gates consultant actions and never grants proxy confirmation", () => {
  const h = M.createState().hotels[1];
  assert.equal(M.canAccess(h, "consultant"), false);
  assert.throws(() => M.createReport(h, "consultant"), /授权/);
  M.setInvitation(h, "owner", "accept");
  assert.equal(M.canAccess(h, "consultant"), true);
  assert.throws(() => M.confirmField(h, "consultant", "sold", "1200"), /代确认/);
  M.setInvitation(h, "owner", "revoke");
  assert.equal(M.canAccess(h, "consultant"), false);
  assert.equal(M.canAccess(h, "owner"), true);
  assert.throws(() => M.setInvitation(h, "owner", "accept"), /状态/);
  const expired = M.createState().hotels[1];
  M.setInvitation(expired, "owner", "expire");
  assert.throws(() => M.setInvitation(expired, "owner", "accept"), /状态/);
});

test("reports require confirmation, approval and delivery; input changes invalidate current report", () => {
  const h = first();
  assert.throws(() => M.createReport(h, "consultant"), /确认/);
  M.confirmField(h, "owner", "sold", "2100");
  M.confirmField(h, "owner", "revenue", "588000");
  const report = M.createReport(h, "consultant");
  assert.throws(() => M.transitionReport(h, "consultant", "deliver"), /状态/);
  assert.throws(() => M.transitionReport(h, "owner", "approve"), /顾问/);
  M.transitionReport(h, "consultant", "approve");
  M.transitionReport(h, "consultant", "deliver");
  M.saveFeedback(h, "owner", report.id, "已核对演示凭证");
  assert.equal(h.feedback.length, 1);
  assert.throws(() => M.saveFeedback(h, "owner", report.id, " "), /空反馈/);
  const snapshot = JSON.stringify(report.snapshot);
  M.confirmField(h, "owner", "sold", "2000");
  assert.equal(M.currentReport(h), null);
  assert.equal(JSON.stringify(report.snapshot), snapshot);
  assert.equal(h.evidenceFields.sold.value, 2100);
  assert.throws(() => M.saveFeedback(h, "owner", report.id, "旧版"), /当前版本/);
  const next = M.createReport(h, "consultant");
  assert.notEqual(next.id, report.id);
  assert.equal(report.status, "delivered");
});

test("returning and revising creates a new version without overwriting returned report", () => {
  const h = M.createState().hotels[2];
  const original = M.createReport(h, "consultant");
  M.transitionReport(h, "consultant", "return");
  const revised = M.transitionReport(h, "consultant", "revise");
  assert.equal(original.status, "returned");
  assert.equal(revised.status, "draft");
  assert.notEqual(original.id, revised.id);
  assert.equal(revised.version, 2);
});

test("scenario assumptions are explicit and discounts aren't counted twice", () => {
  const h = M.createState().hotels[2];
  const values = { delta: "0", extraRate: "0", budget: "0", discount: "0" };
  const baseline = M.calculateScenario(h, "consultant", values);
  assert.equal(baseline.net, 298464);
  assert.equal(baseline.net, baseline.baseline);
  const result = M.calculateScenario(h, "consultant", { delta: "30000", extraRate: "2", budget: "5000", discount: "10000" });
  assert.equal(result.net, 303608);
  assert.throws(() => M.calculateScenario(h, "consultant", { ...values, delta: "" }), /显式/);
  assert.throws(() => M.calculateScenario(h, "consultant", { ...values, extraRate: "89" }), /100%/);
  assert.throws(() => M.calculateScenario(h, "consultant", { ...values, discount: "999999" }), /超过/);
  h.channels.ads = null;
  assert.throws(() => M.calculateScenario(h, "consultant", values), /未知/);
});
