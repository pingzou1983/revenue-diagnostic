(function () {
  "use strict";
  const M = window.DemoModel;
  const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const money = (value) => value === null ? "未知 / 不可计算" : `¥${value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
  const percent = (value) => value === null ? "未知 / 不可计算" : `${(value * 100).toFixed(1)}%`;
  const date = (value) => new Date(value).toLocaleString("zh-CN", { hour12: false });
  const invitationLabels = { accepted: "授权生效", pending: "邀请待接受", expired: "邀请已过期", revoked: "授权已撤销" };
  const reportLabels = { draft: "待顾问审核", returned: "已退回", approved: "已审核 / 待交付", delivered: "已模拟交付" };
  const eventLabels = { approve: "审核通过", return: "退回核对", revise: "新建修订版", deliver: "模拟交付" };
  const navItems = {
    consultant: [["home", "工作台"], ["hotel", "酒店详情"], ["data", "资料核对"], ["diagnosis", "诊断详情"], ["scenario", "OTA 情景"], ["report", "报告与跟进"]],
    owner: [["home", "我的首页"], ["hotel", "首诊与建档"], ["authorization", "酒店授权"], ["data", "资料与确认"], ["diagnosis", "阶段性结果"], ["report", "报告与反馈"]]
  };
  let state = M.createState();
  let toastTimer;
  function storageError(error) {
    const warning = document.getElementById("storage-warning");
    warning.hidden = false;
    warning.textContent = `本地保存不可用：${error.message}。当前仍可演示，但刷新后可能丢失进度。`;
  }
  try {
    const saved = localStorage.getItem(M.STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.version !== 1 || !Array.isArray(parsed.hotels) || parsed.hotels.length !== 4 || !navItems[parsed.role] || !parsed.hotels.some((hotel) => hotel.id === parsed.hotelId)) {
        throw new Error("演示存档格式不匹配，请使用重置演示恢复。");
      }
      state = parsed;
    }
  } catch (error) {
    storageError(error);
  }
  function persist() {
    try { localStorage.setItem(M.STORAGE_KEY, JSON.stringify(state)); }
    catch (error) { storageError(error); }
  }
  function toast(message) {
    const el = document.getElementById("toast");
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 5000);
  }
  const hotel = () => state.hotels.find((item) => item.id === state.hotelId);
  const button = (text, action, style = "primary", extra = "") => `<button type="button" class="${style}" data-action="${action}" ${extra}>${text}</button>`;
  const go = (text, page, style = "secondary") => button(text, "navigate", style, `data-page="${page}"`);
  const badge = (text, tone = "") => `<span class="pill ${tone}">${escape(text)}</span>`;
  function heading(title, subtitle, tag = "演示预览") {
    return `<div class="page-heading"><div><p class="eyebrow">REVENUE DIAGNOSTIC / 栖衡</p><h1>${title}</h1><p class="muted">${subtitle}</p></div>${badge(tag)}</div>`;
  }
  function metrics(h) {
    const m = M.getMetrics(h);
    return `<div class="grid metrics">
      <div class="card"><span class="metric-label">出租率 · OCC</span><strong class="metric-value">${percent(m.occ)}</strong><span class="metric-meta">已确认售出房晚 ÷ 可售房晚</span></div>
      <div class="card"><span class="metric-label">平均成交房价 · ADR</span><strong class="metric-value">${money(m.adr)}</strong><span class="metric-meta">已确认客房收入 ÷ 售出房晚</span></div>
      <div class="card"><span class="metric-label">每可售房晚收入 · RevPAR</span><strong class="metric-value">${money(m.revpar)}</strong><span class="metric-meta">已确认客房收入 ÷ 可售房晚</span></div></div>`;
  }
  function steps(h) {
    const ready = M.getMetrics(h).ready;
    const report = M.currentReport(h);
    return `<div class="steps">${[
      ["01", "酒店授权", h.invitation === "accepted"],
      ["02", "数据确认", ready],
      ["03", "顾问审核", report && ["approved", "delivered"].includes(report.status)],
      ["04", "报告交付", report && report.status === "delivered"]
    ].map(([n, label, done]) => `<div class="step ${done ? "done" : ""}"><b>${n} / ${label}</b>${done ? "已完成（演示）" : "待完成"}</div>`).join("")}</div>`;
  }
  function blocked(h) {
    return `<div class="card empty">${badge(invitationLabels[h.invitation], "red")}<h2 style="margin-top:20px">经营资料暂不可访问</h2><p class="muted">酒店授权尚未生效或已撤销。顾问角色不自动获得酒店资料访问权。</p><p class="small muted">此页面仅显示虚构酒店索引，不显示经营数据或报告。静态页面不构成安全鉴权。</p>${button("切换业主端查看授权", "owner-authorization")}</div>`;
  }
  function home(h) {
    if (state.role === "owner") {
      const report = M.currentReport(h);
      return `${heading("经营有据，下一步更清晰。", `欢迎回到 ${escape(h.name)}。这里汇总您的资料进度与顾问交付。`, "业主空间")}
        <section class="hero"><p class="eyebrow">YOUR NEXT STEP</p><h2>${!M.getMetrics(h).ready ? "从确认真实的经营事实开始。" : report?.status === "delivered" ? "您的诊断报告已准备好。" : "基础资料已就绪，等待顾问审核。"}</h2><p>每一项建议都应该有来源，每一个未知都值得被保留。</p>${go(report?.status === "delivered" ? "查看已交付报告" : "查看资料与确认", report?.status === "delivered" ? "report" : "data", "primary")}</section>
        ${steps(h)}${metrics(h)}
        <div class="grid two"><div class="card"><h2>酒店授权</h2>${badge(invitationLabels[h.invitation], h.invitation === "accepted" ? "green" : "amber")}<p class="muted small" style="margin-top:12px">数据访问授权与价格调整权限是不同事项。</p>${go("管理酒店授权", "authorization")}</div>
        <div class="card"><h2>报告与经营行动</h2><p class="muted">${report ? reportLabels[report.status] : "暂无当前版本报告"}</p>${go("查看报告进度", "report")}</div></div>`;
    }
    const visible = state.hotels.filter((item) => M.canAccess(item, "consultant"));
    return `${heading("把时间留给更重要的判断。", "从资料核对到人工交付，让每家酒店的经营事实清晰可见。", "顾问空间")}
      <section class="hero"><p class="eyebrow">TODAY'S FOCUS</p><h2>先确认数据，<br>再讨论增长的可能。</h2><p>当前选择：${escape(h.name)}。未发布的提价和佣金流量规则始终保持关闭。</p>${go("进入当前酒店", "hotel", "primary")}</section>
      <div class="grid four">${[
        ["已授权酒店", visible.length, "仅统计授权生效的演示酒店"],
        ["待核对资料", visible.filter((item) => !M.getMetrics(item).ready).length, "需要业主逐字段确认"],
        ["待审核报告", visible.filter((item) => M.currentReport(item)?.status === "draft").length, "绑定当前输入版本"],
        ["已交付报告", visible.filter((item) => M.currentReport(item)?.status === "delivered").length, "模拟交付，不发送客户"]
      ].map(([label, value, note]) => `<div class="card"><span class="metric-label">${label}</span><strong class="metric-value">${value}</strong><span class="metric-meta">${note}</span></div>`).join("")}</div>
      <div class="section-heading"><h2>演示酒店</h2><span class="muted small">4 个案例 · 合成数据</span></div>
      <div class="grid two">${state.hotels.map((item) => `<article class="card hotel-card"><div class="hotel-initial">${escape(item.name[0])}</div>${badge(invitationLabels[item.invitation], item.invitation === "accepted" ? "green" : "amber")}<h3>${escape(item.name)}</h3><p class="muted small">${escape(item.city)} · ${escape(item.caseLabel)}</p>${button("查看酒店", "select-hotel", "secondary", `data-id="${item.id}"`)}</article>`).join("")}</div>`;
  }
  function hotelPage(h) {
    if (state.role === "owner") {
      return `${heading("从了解您的酒店开始。", "首诊用于判断适用范围，不是直接套用经营诊断。")}
        <div class="grid two"><div class="card"><h2>首诊与目标</h2><form id="intake-form"><label for="stage">项目阶段</label><select id="stage" name="stage"><option value="">请选择 / 未知</option><option value="operating" ${h.intake?.stage === "operating" ? "selected" : ""}>在营酒店</option><option value="preparing" ${h.intake?.stage === "preparing" ? "selected" : ""}>筹备中</option></select>
        <label for="goal" style="margin-top:14px">主要问题</label><select id="goal" name="goal"><option value="data" ${h.intake?.goal === "data" ? "selected" : ""}>先理清经营数据</option><option value="channel" ${h.intake?.goal === "channel" ? "selected" : ""}>了解渠道成本</option><option value="pricing" ${h.intake?.goal === "pricing" ? "selected" : ""}>评估定价条件</option></select>
        <label class="check-label" style="margin-top:18px"><input type="checkbox" name="consent" ${h.consent ? "checked" : ""}>同意在本地演示中保存此首诊选择；不构成真实客户数据处理同意。</label><button class="primary" type="submit">保存演示首诊</button><p id="intake-error" class="form-error" role="alert"></p></form></div>
        <div class="card"><h2>首诊状态</h2><p>${h.intake ? h.intake.stage === "operating" ? "在营 · 适用性仍待顾问人工确认" : "筹备或阶段未知 · 转人工评估，不套用在营诊断" : "尚未提交首诊"}</p><p class="muted">演示酒店的经营流程是预设样例。首诊选择不会自动派单、授权或生成新诊断。</p>${go("查看酒店授权", "authorization")}</div></div>
        ${profile(h)}`;
    }
    return `${heading(escape(h.name), `${escape(h.city)} · ${escape(h.caseLabel)}`, invitationLabels[h.invitation])}${steps(h)}${metrics(h)}${profile(h)}
      <div class="button-row">${go("核对资料", "data", "primary")}${go("查看诊断", "diagnosis")}${go("报告与跟进", "report")}</div>`;
  }
  function profile(h) {
    return `<div class="card"><h2>酒店档案 · 虚构示例</h2><dl class="fact-list"><div><dt>酒店名称</dt><dd>${escape(h.name)}</dd></div><div><dt>定位</dt><dd>${escape(h.city)}</dd></div><div><dt>固定房量</dt><dd>${h.rooms} 间</dd></div><div><dt>统计周期</dt><dd>${h.period}</dd></div><div><dt>价格操作权限</dt><dd>未知 · 需另行确认</dd></div><div><dt>数据来源</dt><dd>手工合成凭证 · 非真实酒店</dd></div></dl><p class="muted small">房量 × 天数仅用于说明合成样例；实际可售房晚需核对停用房等情况。</p></div>`;
  }
  function authorization(h) {
    return `${heading("授权清晰，合作安心。", "这里只模拟邀请状态，不提供身份验证或真实权限控制。")}
      <div class="grid two"><div class="card"><h2>收益顾问 · 演示账号</h2>${badge(invitationLabels[h.invitation], h.invitation === "accepted" ? "green" : "amber")}<dl class="fact-list"><div><dt>授权对象</dt><dd>${escape(h.name)}</dd></div><div><dt>授权范围</dt><dd>经营资料查看、诊断、报告审核</dd></div><div><dt>代确认数据</dt><dd>未授权</dd></div><div><dt>实际价格调整</dt><dd>未授权</dd></div></dl>
      <div class="button-row">${h.invitation === "pending" ? button("模拟接受邀请", "accept") + button("模拟邀请过期", "expire", "secondary") : h.invitation === "accepted" ? button("撤销顾问授权", "revoke", "danger") : "<p class='muted small'>状态已终止；重新演示请使用顶部重置。</p>"}</div></div>
      <div class="card"><h2>授权不是一张通行证</h2><p class="muted">酒店访问、代确认、资料处理、第三方 OCR、经营行动许可分别管理。</p><div class="notice warning">此 Demo 仅使用本地虚构数据。接受邀请不等于通过真实身份验证，也不授权发送任何资料。</div>${go("继续提交资料", "data")}</div></div>`;
  }
  function dataPage(h) {
    return `${heading("每一个数字，都能回到来源。", "左侧是合成凭证，右侧模拟 OCR 提取与人工确认。没有上传或识别真实文件。", `输入版本 ${h.revision}`)}
      <div class="notice warning">OCR 准确率尚未设定，不展示虚构置信度。${state.role === "consultant" ? "顾问没有代确认权限，请切换业主端完成确认。" : "确认前请核对周期、金额与房晚；未知字段可以暂时保留。"}</div>
      <div class="grid two"><section class="card"><h2>合成经营凭证</h2><div class="evidence"><p class="eyebrow">SYNTHETIC DOCUMENT / 仅供演示</p><h3>${escape(h.name)}</h3><p class="small">${h.period}</p>${Object.entries(M.fieldLabels).map(([key, label]) => `<div class="evidence-line"><span>${label}</span><b>${h.evidenceFields[key].value === null ? "未提供" : key === "revenue" ? money(h.evidenceFields[key].value) : h.evidenceFields[key].value.toLocaleString()}</b></div>`).join("")}<div class="stamp">固定合成原件 · 右侧确认与修正不会改变此凭证。</div></div><p class="small muted" style="margin-top:16px">图片 / PDF / Excel / CSV 支持与限制待批准。第一版仅提供预设凭证，不接收真实文件。</p></section>
      <section class="card"><h2>字段确认</h2><p class="small muted">来源：DEMO-${h.id}-经营汇总；每项单独确认。</p>${Object.entries(M.fieldLabels).map(([key, label]) => `<form class="field-form" data-field="${key}"><label for="field-${key}">${label} ${badge(h.fields[key].confirmed ? "已确认" : h.fields[key].value === null ? "未知" : "待确认", h.fields[key].confirmed ? "green" : "amber")}</label><div class="button-row" style="margin:6px 0 18px;flex-wrap:nowrap"><input id="field-${key}" name="value" type="number" min="${key === "available" ? 1 : 0}" step="${key === "revenue" ? "0.01" : "1"}" placeholder="未知，待补充" value="${h.fields[key].value ?? ""}" ${state.role !== "owner" ? "disabled" : ""}><button type="submit" class="secondary" ${state.role !== "owner" ? "disabled" : ""}>确认</button></div></form>`).join("")}<p id="field-error" class="form-error" role="alert"></p>${state.role === "consultant" ? button("切换业主端确认", "owner-data", "primary") : go("查看阶段性结果", "diagnosis", "primary")}</section></div>
      <div class="notice">修改或新确认字段会形成新的输入版本。已有报告保留原始快照，不能沿用旧审核直接交付。</div>`;
  }
  function diagnosis(h) {
    const m = M.getMetrics(h);
    const channelShareReady = m.ready && h.fields.revenue.value > 0 && h.channels.revenue !== null && h.channels.revenue <= h.fields.revenue.value;
    return `${heading("先看事实，再看可能。", `统计周期：${h.period}。本页面为阶段性结果，不是正式交付报告。`, m.ready ? "L1 · 基础事实" : "草稿 · 数据待确认")}
      ${metrics(h)}${!m.ready ? `<div class="notice warning">基础数据未就绪：${escape(m.missing.join("、") || "数据冲突")}。未知或未确认值不参与计算。</div>` : `<div class="notice">基础指标来自已确认的合成数据。没有日事实，不绘制逐日趋势；未批准规则，不输出具体提价建议。</div>`}
      <div class="grid two"><div class="card"><h2>诊断门槛</h2><div class="action-item"><span>01</span><div><b>本期基础数据</b><p class="muted">${m.ready ? "已逐项确认，可展示基础指标。" : "尚需补充或确认，不能冒充 L1。"}</p></div></div><div class="action-item"><span>02</span><div><b>同期口径</b><p class="muted">${h.comparisons ? "已提供两组合成对照事实；真实可比性规则未批准，不宣称达到 L2。" : "未提供同比 / 环比资料，不输出趋势结论。"}</p></div></div><div class="action-item"><span>03</span><div><b>竞品与业务规则</b><p class="muted">竞品资料未知，可比性、提价与佣金流量规则未发布，价格结论关闭。置信度：不适用。</p></div></div></div>
      <div class="card"><h2>渠道收入构成 · 合成事实</h2>${channelShareReady ? `<p class="muted small">同周期客房收入口径，不混用订单或间夜占比。</p><div class="bar-row"><span>演示 OTA</span><div class="bar"><span style="width:${h.channels.revenue / h.fields.revenue.value * 100}%"></span></div><b>${percent(h.channels.revenue / h.fields.revenue.value)}</b></div><div class="bar-row"><span>其他渠道</span><div class="bar"><span style="width:${(1 - h.channels.revenue / h.fields.revenue.value) * 100}%"></span></div><b>${percent(1 - h.channels.revenue / h.fields.revenue.value)}</b></div><p class="small muted">不据此触发渠道集中度风险；等级边界与阈值待批准。</p>` : `<p class="muted">基础数据未确认、收入分母为零、渠道资料未知或渠道收入超过总收入，不展示占比。请核对来源。</p>`}${go("补充与核对资料", "data")}</div></div>
      ${h.comparisons ? `<div class="card"><h2>对照周期事实 · 非趋势判断</h2><div class="table-wrap"><table><thead><tr><th>周期</th><th>可售房晚</th><th>售出房晚</th><th>客房收入</th><th>ADR</th></tr></thead><tbody>${h.comparisons.map((c) => `<tr><td>${c.label}</td><td>${c.available}</td><td>${c.sold}</td><td>${money(c.revenue)}</td><td>${money(c.revenue / c.sold)}</td></tr>`).join("")}</tbody></table></div><p class="small muted">这是预设同长度对照样例，不代替已批准的同比/环比可比性核验。</p></div>` : ""}`;
  }
  function scenario(h) {
    return `${heading("比较假设，不预言收益。", "按用户显式输入比较同周期 OTA 渠道情景，不假定加佣会带来流量。", "情景假设 / 非预测")}
      <div class="notice warning">仅适用于当前合成样例：当前渠道收入已扣酒店折扣，佣金基数假设为折后收入，合同基础佣金 12%。新增收入由您假设，不是平台归因或模型预测。</div>
      <div class="grid two"><div class="card"><h2>当前渠道基线</h2><dl class="fact-list"><div><dt>折后渠道收入 R</dt><dd>${money(h.channels.revenue)}</dd></div><div><dt>实际结算佣金 C</dt><dd>${money(h.channels.commission)}</dd></div><div><dt>实际投流费用 A</dt><dd>${money(h.channels.ads)}</dd></div><div><dt>渠道净收益 R − C − A</dt><dd>${M.getMetrics(h).ready && Object.values(h.channels).every((x) => x !== null) ? money(h.channels.revenue - h.channels.commission - h.channels.ads) : "不可计算 / 基础资料未确认"}</dd></div></dl><p class="muted small">不等于酒店 GOP 或净利润；不包含其他变动成本。</p></div>
      <div class="card"><h2>您的自设情景</h2><form id="scenario-form"><div class="form-grid">
      <div><label for="delta">假设新增收入（折扣前，元）</label><input id="delta" name="delta" type="number" min="0" step="0.01" placeholder="显式填写，无新增填 0" required></div>
      <div><label for="extraRate">额外佣金（百分点）</label><input id="extraRate" name="extraRate" type="number" min="0" max="88" step="0.01" placeholder="例如 2，无增加填 0" required></div>
      <div><label for="budget">新增投流预算（元）</label><input id="budget" name="budget" type="number" min="0" step="0.01" placeholder="自设预算" required></div>
      <div><label for="discount">新增酒店承担折扣（元）</label><input id="discount" name="discount" type="number" min="0" step="0.01" placeholder="不重复扣基线折扣" required></div></div><div class="button-row"><button type="submit" class="primary">比较情景</button></div><p id="scenario-error" class="form-error" role="alert"></p></form>
      <div id="scenario-result" hidden class="result" aria-live="polite"></div></div></div>`;
  }
  function reportPage(h) {
    const report = M.currentReport(h);
    const owner = state.role === "owner";
    const visible = report && (!owner || report.status === "delivered");
    const content = visible ? `<article class="card report-sheet"><div class="report-watermark">DEMO · 合成数据 · 非正式客户报告</div>
      <div class="section-heading"><h2>${escape(h.name)} · 经营事实报告</h2>${badge(reportLabels[report.status], report.status === "delivered" ? "green" : "amber")}</div>
      <p class="small muted">编号 ${report.id} · 报告 v${report.version} · 输入 v${report.revision} · ${date(report.createdAt)} · 规则：未冻结</p>
      <h3>一句话结论</h3><p>本期基础指标可计算；竞品资料与已批准规则不足，目前不能判断提价空间。</p>
      <div class="grid"><div><label>出租率</label><strong class="metric-value">${percent(report.metrics.occ)}</strong></div><div><label>平均成交房价</label><strong class="metric-value">${money(report.metrics.adr)}</strong></div><div><label>RevPAR</label><strong class="metric-value">${money(report.metrics.revpar)}</strong></div></div>
      <p class="small muted">依据：本报告输入快照中的可售 ${report.snapshot.available.value} 房晚、售出 ${report.snapshot.sold.value} 房晚、收入 ${money(report.snapshot.revenue.value)}。置信度：不适用（不输出增长或提价结论）。</p>
      <h3>下一步 · 最多三条行动</h3>${report.actions.map((action, i) => `<div class="action-item"><span>0${i + 1}</span><div>${escape(action)}</div></div>`).join("")}
      <p class="small muted" style="margin-top:20px">基于用户提供的合成数据，不构成收益保证。重大经营决策需专业判断和独立行动授权。</p>
      <div class="button-row no-print">${owner ? button("打印演示报告", "print", "secondary") : report.status === "draft" ? button("审核通过（模拟）", "approve") + button("退回核对", "return", "secondary") : report.status === "returned" ? button("新建修订版", "revise") : report.status === "approved" ? button("交付至业主端（模拟）", "deliver") : button("打印演示报告", "print", "secondary")}</div></article>` :
      `<div class="card empty"><h2>${owner ? "尚无当前版本已交付报告" : "当前输入版本尚无报告"}</h2><p class="muted">${owner ? "资料修改后需顾问重新审核交付；阶段性结果不等于正式报告。" : "先完成业主字段确认，再生成基于快照的演示报告。"}</p>${owner ? go("查看阶段性结果", "diagnosis") : button("生成报告初稿", "create-report", "primary", M.getMetrics(h).ready ? "" : "disabled")}<p id="report-error" role="alert" class="form-error"></p></div>`;
    return `${heading("从审核到交付，每一步有记录。", "审核、交付和打印均为本地模拟，不会向客户发送文件。", "报告生命周期")}
      ${content}${owner && visible ? `<div class="card no-print"><h2>经营行动反馈</h2><form id="feedback-form" data-report="${report.id}"><label for="feedback">您做了什么？还缺少什么？</label><textarea id="feedback" name="feedback" rows="4" maxlength="500" placeholder="仅填写虚构演示记录，不输入真实酒店资料。" required></textarea><div class="button-row"><button type="submit" class="primary">保存演示反馈</button></div><p id="feedback-error" class="form-error" role="alert"></p></form></div>` : ""}
      <div class="grid two no-print"><div class="card"><h2>版本与交付记录</h2>${h.reports.length ? `<div class="timeline">${h.reports.filter((r) => !owner || r.status === "delivered").map((r) => `<p><b>${r.id} · 输入 v${r.revision}</b><br>${reportLabels[r.status]}${r.revision !== h.revision ? " · 历史版本，不沿用审核" : ""}<br><span class="muted">${r.events.map((e) => `${escape(eventLabels[e.action])} ${date(e.at)}`).join("<br>") || "已生成初稿"}</span></p>`).join("") || "<p>暂无已交付版本。</p>"}</div>` : "<p class='muted'>暂无记录。</p>"}</div><div class="card"><h2>人工跟进记录</h2>${h.feedback.length ? h.feedback.map((f) => `<p class="small muted">${escape(f.reportId)} · ${date(f.at)}</p><p class="feedback-text">${escape(f.text)}</p>`).join("") : "<p class='muted'>尚无业主反馈。记录不是执行证明，也不自动进行因果归因。</p>"}</div></div>`;
  }
  function render(focus = false) {
    const h = hotel();
    const items = navItems[state.role];
    if (!items.some(([key]) => key === state.page)) state.page = "home";
    document.body.classList.toggle("owner", state.role === "owner");
    document.querySelectorAll("[data-role]").forEach((el) => el.setAttribute("aria-pressed", String(el.dataset.role === state.role)));
    document.getElementById("hotel-picker").innerHTML = state.hotels.map((item) => `<option value="${item.id}" ${item.id === h.id ? "selected" : ""}>${escape(item.name)} · ${item.id}</option>`).join("");
    document.getElementById("hotel-caption").textContent = `${h.caseLabel} · ${invitationLabels[h.invitation]}`;
    document.getElementById("navigation").innerHTML = items.map(([key, label], index) => `<button type="button" data-action="navigate" data-page="${key}" class="${key === state.page ? "active" : ""}" ${key === state.page ? 'aria-current="page"' : ""}><span class="nav-number">0${index + 1}</span>${label}</button>`).join("");
    const pages = { home, hotel: hotelPage, authorization, data: dataPage, diagnosis, scenario, report: reportPage };
    const main = document.getElementById("main");
    main.innerHTML = (!M.canAccess(h, state.role) && state.page !== "home" ? blocked(h) : pages[state.page](h)) + `<p class="footer-note">栖衡 v0.1 · 双端静态交互原型 · 进度仅保存于本浏览器 · 不连接后台或第三方服务</p>`;
    persist();
    if (focus) main.focus({ preventScroll: true });
  }
  function navigate(page) { state.page = page; render(true); }
  document.addEventListener("click", (event) => {
    const roleButton = event.target.closest("[data-role]");
    if (roleButton) { state.role = roleButton.dataset.role; state.page = "home"; render(true); return; }
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    try {
      if (action === "navigate") { navigate(target.dataset.page); return; }
      if (action === "select-hotel") { state.hotelId = target.dataset.id; navigate("hotel"); return; }
      if (action === "owner-data" || action === "owner-authorization") { state.role = "owner"; navigate(action === "owner-data" ? "data" : "authorization"); return; }
      if (["accept", "expire", "revoke"].includes(action)) {
        M.setInvitation(hotel(), state.role, action);
        render(); toast(`已模拟：${invitationLabels[hotel().invitation]}`); return;
      }
      if (action === "create-report") M.createReport(hotel(), state.role);
      else if (["approve", "return", "revise", "deliver"].includes(action)) M.transitionReport(hotel(), state.role, action);
      else if (action === "print") {
        const r = M.currentReport(hotel());
        if (!M.canAccess(hotel(), state.role) || r?.status !== "delivered") throw new Error("仅当前已交付演示报告可以打印。");
        window.print();
        toast("已打开打印预览；不代表文件已导出、下载或发送。"); return;
      } else return;
      render(); toast(action === "deliver" ? "已模拟交付，可切换业主端查看。" : "演示报告状态已更新。");
    } catch (error) { toast(error.message); }
  });
  document.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target;
    const data = Object.fromEntries(new FormData(form));
    let errorId;
    try {
      if (form.classList.contains("field-form")) {
        errorId = "field-error";
        const changed = M.confirmField(hotel(), state.role, form.dataset.field, data.value);
        render(); toast(changed ? "已逐项确认，新输入版本已保存；旧报告不变。" : "数值与确认状态未变。");
      } else if (form.id === "intake-form") {
        errorId = "intake-error";
        if (!data.consent) throw new Error("请先勾选本地演示保存告知。");
        if (state.role !== "owner") throw new Error("请由业主提交首诊。");
        hotel().consent = true;
        hotel().intake = { stage: data.stage, goal: data.goal };
        render(); toast("演示首诊已保存；适用性仍需人工评估。");
      } else if (form.id === "scenario-form") {
        errorId = "scenario-error";
        const result = M.calculateScenario(hotel(), state.role, data);
        document.getElementById(errorId).textContent = "";
        const el = document.getElementById("scenario-result");
        el.hidden = false;
        el.innerHTML = `<label>情景渠道净收益（估算）</label><strong class="metric-value">${money(result.net)}</strong><p>相较当前基线：${money(result.net - result.baseline)}</p><p class="small muted">情景折后收入 ${money(result.assumedRevenue)}。假设全部成立才有此结果，不代表酒店利润或因果新增收益。</p>`;
      } else if (form.id === "feedback-form") {
        errorId = "feedback-error";
        M.saveFeedback(hotel(), state.role, form.dataset.report, data.feedback);
        render(); toast("虚构行动反馈已保存在本地。");
      }
    } catch (error) {
      if (errorId) document.getElementById(errorId).textContent = error.message;
      else toast(error.message);
      if (form.id === "scenario-form") document.getElementById("scenario-result").hidden = true;
    }
  });
  document.getElementById("hotel-picker").addEventListener("change", (event) => {
    state.hotelId = event.target.value; render(true);
  });
  document.querySelector(".brand").addEventListener("click", (event) => { event.preventDefault(); navigate("home"); });
  const dialog = document.getElementById("reset-dialog");
  document.getElementById("reset").addEventListener("click", () => dialog.showModal());
  document.getElementById("cancel-reset").addEventListener("click", () => dialog.close());
  document.getElementById("confirm-reset").addEventListener("click", () => {
    state = M.createState(); dialog.close(); render(true); toast("仅本 Demo 的进度已重置。");
  });
  render();
})();
