(function (root) {
  "use strict";
  const STORAGE_KEY = "revenue-diagnostic-demo-v1";
  const fieldLabels = {
    available: "可售房晚", sold: "售出房晚", revenue: "客房收入"
  };
  const clone = (value) => JSON.parse(JSON.stringify(value));
  function createState() {
    const base = {
      period: "2026-10-01 至 2026-10-30", rooms: 100, days: 30,
      revision: 1, intake: null, consent: false, reports: [], feedback: [],
      comparisons: null,
      channels: { revenue: 352800, commission: 42336, ads: 12000 },
      fields: {
        available: { value: 3000, confirmed: true },
        sold: { value: 2100, confirmed: false },
        revenue: { value: 588000, confirmed: false }
      }
    };
    return {
      version: 1, role: "consultant", hotelId: "A", page: "home",
      hotels: [
        { ...clone(base), id: "A", name: "云栖城市酒店", city: "杭州 · 城市商旅", caseLabel: "完整流程", invitation: "accepted" },
        { ...clone(base), id: "B", name: "溪岸小筑", city: "苏州 · 精品住宿", caseLabel: "资料不足", invitation: "pending",
          rooms: 60, fields: { available: { value: 1800, confirmed: true }, sold: { value: null, confirmed: false }, revenue: { value: null, confirmed: false } },
          channels: { revenue: null, commission: null, ads: null } },
        { ...clone(base), id: "C", name: "观澜商旅酒店", city: "宁波 · 城市商旅", caseLabel: "有同期 / 缺竞品", invitation: "accepted",
          fields: { available: { value: 3000, confirmed: true }, sold: { value: 2100, confirmed: true }, revenue: { value: 588000, confirmed: true } },
          comparisons: [
            { label: "去年同周期", available: 3000, sold: 2250, revenue: 652500 },
            { label: "上月同长度周期", available: 3000, sold: 2040, revenue: 550800 }
          ] },
        { ...clone(base), id: "D", name: "山隐度假酒店", city: "湖州 · 度假住宿", caseLabel: "授权已撤销", invitation: "revoked" }
      ].map((hotel) => ({ ...hotel, evidenceFields: clone(hotel.fields) }))
    };
  }
  function canAccess(hotel, role) {
    return role === "owner" || (role === "consultant" && hotel.invitation === "accepted");
  }
  function requireAccess(hotel, role) {
    if (!canAccess(hotel, role)) throw new Error("酒店授权未生效，不能访问或操作经营资料。");
  }
  function getMetrics(hotel) {
    const fields = hotel.fields;
    const available = fields.available.confirmed ? fields.available.value : null;
    const sold = fields.sold.confirmed ? fields.sold.value : null;
    const revenue = fields.revenue.confirmed ? fields.revenue.value : null;
    const validAvailable = Number.isInteger(available) && available > 0;
    const validSold = Number.isInteger(sold) && sold >= 0 && (!validAvailable || sold <= available);
    const validRevenue = Number.isFinite(revenue) && revenue >= 0;
    const conflict = validSold && sold === 0 && validRevenue && revenue > 0;
    return {
      occ: validAvailable && validSold && !conflict ? sold / available : null,
      adr: validSold && sold > 0 && validRevenue ? revenue / sold : null,
      revpar: validAvailable && validRevenue && !conflict ? revenue / available : null,
      ready: validAvailable && validSold && validRevenue && !conflict,
      missing: Object.keys(fieldLabels).filter((key) => !fields[key].confirmed || fields[key].value === null).map((key) => fieldLabels[key]),
      conflict
    };
  }
  function confirmField(hotel, role, key, raw) {
    requireAccess(hotel, role);
    if (role !== "owner") throw new Error("顾问未获代确认授权，请由业主逐项确认。");
    if (!Object.hasOwn(fieldLabels, key)) throw new Error("未知字段。");
    if (typeof raw !== "string" || raw.trim() === "") throw new Error("请填写数值；未知值不能填为零。");
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) throw new Error("请填写有效的非负数值。");
    if (key !== "revenue" && !Number.isInteger(value)) throw new Error("房晚必须为整数。");
    if (key === "available" && value <= 0) throw new Error("可售房晚必须大于零。");
    const proposed = clone(hotel);
    proposed.fields[key] = { value, confirmed: true };
    const a = proposed.fields.available.value;
    const s = proposed.fields.sold.value;
    const r = proposed.fields.revenue.value;
    if (a !== null && s !== null && s > a) throw new Error("售出房晚不能超过可售房晚，请先核对资料。");
    if (s === 0 && r !== null && r > 0) throw new Error("零售出房晚但收入大于零，请核对会计口径。");
    const current = hotel.fields[key];
    if (current.confirmed && current.value === value) return false;
    hotel.fields[key] = { value, confirmed: true };
    hotel.revision += 1;
    return true;
  }
  function currentReport(hotel) {
    return hotel.reports.findLast((report) => report.revision === hotel.revision) || null;
  }
  function createReport(hotel, role) {
    requireAccess(hotel, role);
    if (role !== "consultant") throw new Error("报告初稿由顾问生成。");
    if (!getMetrics(hotel).ready) throw new Error("基础数据尚未逐项确认，不能生成报告初稿。");
    if (currentReport(hotel)) throw new Error("当前输入版本已有报告；请继续审核或交付。");
    const report = {
      id: `DEMO-${hotel.id}-${String(hotel.reports.length + 1).padStart(3, "0")}`,
      version: hotel.reports.length + 1, revision: hotel.revision, status: "draft",
      createdAt: new Date().toISOString(), snapshot: clone(hotel.fields),
      metrics: getMetrics(hotel), events: [],
      actions: ["补充同口径的竞品资料，核验可比性。", "核对渠道合同与费用口径，保留结算凭证。", "记录后续经营行动及观察结果，由顾问人工复盘。"]
    };
    hotel.reports.push(report);
    return report;
  }
  function transitionReport(hotel, role, action) {
    requireAccess(hotel, role);
    if (role !== "consultant") throw new Error("只有顾问可以审核和交付报告。");
    const report = currentReport(hotel);
    if (!report) throw new Error("请先生成当前输入版本的报告。");
    const transitions = {
      approve: { from: "draft", to: "approved" },
      return: { from: "draft", to: "returned" },
      revise: { from: "returned", to: "draft" },
      deliver: { from: "approved", to: "delivered" }
    };
    const next = transitions[action];
    if (!next || report.status !== next.from) throw new Error("报告状态不允许此操作。");
    if (action === "revise") {
      const revised = clone(report);
      revised.id = `DEMO-${hotel.id}-${String(hotel.reports.length + 1).padStart(3, "0")}`;
      revised.version = hotel.reports.length + 1;
      revised.status = "draft";
      revised.createdAt = new Date().toISOString();
      revised.events = [{ action: "revise", at: revised.createdAt }];
      hotel.reports.push(revised);
      return revised;
    }
    report.status = next.to;
    report.events.push({ action, at: new Date().toISOString() });
    return report;
  }
  function setInvitation(hotel, role, action) {
    if (role !== "owner") throw new Error("请切换业主端处理酒店授权。");
    const allowed = {
      accept: { from: "pending", to: "accepted" },
      expire: { from: "pending", to: "expired" },
      revoke: { from: "accepted", to: "revoked" }
    };
    const next = allowed[action];
    if (!next || hotel.invitation !== next.from) throw new Error("邀请状态不允许此操作；重新演示请重置。");
    hotel.invitation = next.to;
  }
  function calculateScenario(hotel, role, values) {
    requireAccess(hotel, role);
    if (!getMetrics(hotel).ready) throw new Error("请先完成基础数据确认。");
    const c = hotel.channels;
    if (Object.values(c).some((value) => value === null)) throw new Error("渠道收入或费用未知，不能测算。");
    const keys = ["delta", "extraRate", "budget", "discount"];
    if (keys.some((key) => typeof values[key] !== "string" || !values[key].trim())) throw new Error("请显式填写所有情景假设，不以零替代未知。");
    const n = Object.fromEntries(keys.map((key) => [key, Number(values[key])]));
    if (Object.values(n).some((value) => !Number.isFinite(value) || value < 0)) throw new Error("情景假设必须为有效非负数。");
    if (n.extraRate > 88) throw new Error("基础演示费率为 12%，合计佣金比例不能超过 100%。");
    const revenue = c.revenue + n.delta;
    if (n.discount > revenue) throw new Error("酒店承担的折扣不能超过情景收入。");
    const afterDiscount = revenue - n.discount;
    return {
      baseline: c.revenue - c.commission - c.ads,
      net: afterDiscount * (1 - 0.12 - n.extraRate / 100) - c.ads - n.budget,
      assumedRevenue: afterDiscount
    };
  }
  function saveFeedback(hotel, role, reportId, text) {
    requireAccess(hotel, role);
    if (role !== "owner") throw new Error("此入口用于业主反馈。");
    const report = hotel.reports.find((item) => item.id === reportId && item.status === "delivered");
    if (!report || report.revision !== hotel.revision) throw new Error("仅可对当前版本已交付报告填写反馈。");
    if (typeof text !== "string" || !text.trim()) throw new Error("请填写行动记录；不会将空反馈视为已执行。");
    if (text.length > 500) throw new Error("演示反馈请控制在 500 字以内。");
    hotel.feedback.push({ reportId, text: text.trim(), at: new Date().toISOString() });
  }
  const api = { STORAGE_KEY, fieldLabels, createState, canAccess, getMetrics, confirmField, currentReport, createReport, transitionReport, setInvitation, calculateScenario, saveFeedback };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DemoModel = api;
})(typeof window === "undefined" ? globalThis : window);
