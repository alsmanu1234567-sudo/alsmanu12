"use strict";

const PAGE_TITLES = {
  overview: "نظرة عامة",
  groups: "المجموعات والوحدات",
  points: "إعدادات النقاط",
  members: "الأعضاء والمحافظ",
  ranks: "الرتب والصدارة",
  pets: "الحيوانات",
  store: "المتاجر والمقتنيات",
  tasks: "المهام والإنجازات",
  social: "التحديات والفرق",
  games: "الألعاب والتوزيع التلقائي",
  season: "المواسم والفعاليات",
  messages: "الرسائل والمعاينة",
  commands: "إدارة الأوامر",
  admins: "المشرفون والصلاحيات",
  slots: "القائمة الثابتة",
  logs: "سجلات العمليات",
  reports: "التقارير والرسوم",
  settings: "النسخ الاحتياطي والإعدادات",
};

const MODULE_LABELS = {
  economy: ["اقتصاد النقاط", "المكافآت والأرصدة"],
  progression: ["التقدم وXP", "المستويات والسلاسل والإحصاءات"],
  antiSpam: ["مكافحة السبام", "كشف التكرار والإرسال المكثف"],
  pets: ["الحيوانات", "الاقتناء والقدرات"],
  shops: ["المتاجر", "العناصر والمقتنيات"],
  tasks: ["المهام", "اليومية والأسبوعية"],
  achievements: ["الإنجازات", "الشارات والتقدم"],
  challenges: ["التحديات", "رهانات الأعضاء"],
  teams: ["الفرق", "العضوية والتنافس"],
  seasons: ["المواسم", "التقدم والجوائز"],
  events: ["الفعاليات", "إعلانات المجموعة"],
  messageTemplates: ["قوالب الرسائل", "رسائل النظام"],
  customCommands: ["الأوامر المخصصة", "ردود نصية آمنة"],
  ticTacToe: ["لعبة XO", "مباريات 3×3 وإحصاءات الفوز"],
  automaticRewards: ["الهدايا التلقائية", "توزيع يومي وأسبوعي مع تقارير"],
  bossRaid: ["زعيم المجموعة", "غارات جماعية ومكافآت"],
  treasureHunt: ["البحث عن الكنز", "ألغاز وتلميحات"],
  guilds: ["نقابات اللاعبين", "الفرق والمستويات والمخزون"],
  crafting: ["صناعة العناصر", "وصفات وموارد"],
  dungeons: ["الأبراج المحصنة", "مراحل وأسئلة متدرجة"],
  tournaments: ["دوري الأبطال", "تسجيل ومراحل إقصاء"],
  wordHunt: ["صيد الكلمات", "تخمين كلمة سرية"],
  luckyWheel: ["عجلة الحظ المجانية", "جوائز افتراضية محدودة"],
};

const PERMISSIONS = [
  ["view", "عرض البيانات"],
  ["points", "إدارة النقاط"],
  ["members", "إدارة الأعضاء"],
  ["catalog", "إدارة المتاجر"],
  ["messages", "الرسائل والقوالب"],
  ["commands", "إدارة الأوامر"],
  ["logs", "عرض السجلات"],
  ["settings", "الإعدادات والمشرفون"],
];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const query = new URLSearchParams(location.search);
const token = query.get("token") || "";
const state = {
  page: "overview",
  numbers: [],
  groups: [],
  activeGroups: [],
  groupId: "",
  phoneNumber: "",
  overview: null,
  members: [],
  slots: [],
  logs: [],
  report: null,
  reportPeriod: "all",
  logsKind: "all",
  search: "",
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("ar");
}

function api(path, body) {
  const options = {
    headers: { "x-webapp-token": token },
  };
  if (body !== undefined) {
    options.method = "POST";
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  return fetch(path, options).then(async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `تعذّر الاتصال (${response.status})`);
    return data;
  });
}

function notify(message, type = "ok") {
  const notice = $("#notice");
  notice.hidden = false;
  notice.className = `notice${type === "error" ? " error" : type === "warning" ? " warning" : ""}`;
  notice.textContent = message;
  window.clearTimeout(notify.timeout);
  notify.timeout = window.setTimeout(() => { notice.hidden = true; }, 4500);
}

function setConnection(text, kind = "") {
  const badge = $("#connectionStatus");
  badge.className = `connection-badge ${kind}`;
  badge.querySelector("span").textContent = text;
}

function selectedGroupData() {
  return state.groups.find((item) => item.id === state.groupId) ||
    state.activeGroups.find((item) => item.groupId === state.groupId) || null;
}

function queryForGroup(extra = {}) {
  const params = new URLSearchParams({ groupId: state.groupId, ...extra });
  return `?${params.toString()}`;
}

function setWorkspace(html) {
  $("#workspace").innerHTML = html;
}

function emptyState(title, detail, action = "") {
  return `<div class="empty-state"><strong>${escapeHtml(title)}</strong><div>${escapeHtml(detail)}</div>${action}</div>`;
}

function renderKpi(title, value, note) {
  return `<div class="card metric"><div class="metric-label">${escapeHtml(title)}</div><div class="metric-value">${escapeHtml(value)}</div><div class="metric-note">${escapeHtml(note || "")}</div></div>`;
}

function sectionTitle(title, detail = "", tools = "") {
  return `<div class="section-title"><div><h2>${escapeHtml(title)}</h2>${detail ? `<p>${escapeHtml(detail)}</p>` : ""}</div><div class="tools">${tools}</div></div>`;
}

function selectGroupPrompt() {
  if (!state.groupId) {
    return emptyState("اختر مجموعة للمتابعة", "حدّد رقم واتساب ثم اختر مجموعة محفوظة، أو أدخل معرّف مجموعة تملك صلاحية إدارتها.");
  }
  if (!state.overview?.enabled) {
    return emptyState(
      "عالم المجموعة غير مفعّل",
      "سيُنشأ اقتصاد مستقل لهذه المجموعة مع رصيد بداية للأعضاء الحاليين. لا يحتاج تفعيل العالم إلى إشراف البوت في المجموعة.",
      `<button class="button button-primary" data-action="activate">تفعيل عالم المجموعة</button>`,
    );
  }
  return "";
}

function renderOverview() {
  const o = state.overview;
  if (!o) return selectGroupPrompt();
  const top = o.topMembers?.length
    ? `<div class="bar-list">${o.topMembers.slice(0, 5).map((member) => `
        <div class="bar-line">
          <span>${escapeHtml(member.name || member.memberId.split("@")[0])}</span>
          <span class="bar-track"><span class="bar-fill" style="display:block;width:${Math.max(3, Math.round(member.balance / Math.max(1, o.topMembers[0]?.balance) * 100))}%"></span></span>
          <strong>${formatNumber(member.balance)}</strong>
        </div>`).join("")}</div>`
    : `<div class="muted">لا توجد أرصدة مسجلة بعد.</div>`;
  const recent = o.recentTransactions?.length
    ? `<div class="record-list">${o.recentTransactions.map(renderTransaction).join("")}</div>`
    : `<div class="muted">لا توجد عمليات حتى الآن.</div>`;
  return `
    <div class="grid grid-4">
      ${renderKpi("الأعضاء النشطون", formatNumber(o.members), "محافظ مسجلة في هذه المجموعة")}
      ${renderKpi("إجمالي الأرصدة", formatNumber(o.totalBalance), "النقاط المتداولة حاليًا")}
      ${renderKpi("الرسائل المحتسبة", formatNumber(o.totalMessages), "رسائل طبيعية فقط")}
      ${renderKpi("مخالفات السبام", formatNumber(o.spamViolations), "مخالفات مؤكدة مسجلة")}
    </div>
    ${sectionTitle("ملخص الاقتصاد", "الإجماليات الدائمة للمجموعة")}
    <div class="grid grid-3">
      ${renderKpi("إجمالي المكتسب", formatNumber(o.totalEarned), "يشمل الرصيد الأولي والمكافآت")}
      ${renderKpi("إجمالي المصروف", formatNumber(o.totalSpent), "مشتريات وخصومات مسجلة")}
      ${renderKpi("وحدات مفعّلة", `${Object.values(o.modules || {}).filter(Boolean).length} / ${Object.keys(o.modules || {}).length}`, "يمكن إدارة كل وحدة على حدة")}
    </div>
    <div class="grid grid-2" style="margin-top:12px">
      <section class="card"><div class="card-header"><div><h3>أعلى الأرصدة</h3><p>ترتيب المجموعة الحالي</p></div><span class="pill green">الإمبراطور هو الأعلى</span></div>${top}</section>
      <section class="card"><div class="card-header"><div><h3>آخر العمليات</h3><p>أحدث الحركات المسجلة</p></div><button class="button button-secondary button-small" data-nav="logs">فتح السجل</button></div>${recent}</section>
    </div>
    ${o.connection?.botIsAdmin === false ? `<div class="warning-box" style="margin-top:12px">رقم واتساب المحدد ليس مشرفًا حاليًا في المجموعة. ستعمل الأوامر المتاحة، لكن طرد السبام أو بعض إجراءات المجموعة لن تعمل.</div>` : ""}
  `;
}

function renderTransaction(item) {
  const positive = Number(item.amount) > 0;
  return `<div class="record"><div><strong>${escapeHtml(item.reason || item.kind || "عملية")}</strong><small>${escapeHtml(item.memberId || "")} · ${escapeHtml(item.actor || "system")}</small></div><div style="text-align:left"><span class="pill ${positive ? "green" : "red"}">${positive ? "+" : ""}${formatNumber(item.amount)}</span><time style="display:block;margin-top:3px">${escapeHtml(new Date(item.timestamp).toLocaleString("ar"))}</time></div></div>`;
}

function renderGroups() {
  const o = state.overview;
  if (!o) return selectGroupPrompt();
  const modules = Object.entries(o.modules || {}).map(([key, enabled]) => {
    const [label, description] = MODULE_LABELS[key] || [key, ""];
    return `<div class="toggle-row"><div><strong>${escapeHtml(label)}</strong><small>${escapeHtml(description)}</small></div><label class="switch"><input type="checkbox" data-module="${escapeHtml(key)}" ${enabled ? "checked" : ""}><span></span></label></div>`;
  }).join("");
  return `
    <section class="card">
      <div class="card-header"><div><h3>${escapeHtml(o.groupName || state.groupId)}</h3><p>معرّف المجموعة: <span class="code-chip">${escapeHtml(state.groupId)}</span></p></div><span class="pill ${o.enabled ? "green" : "red"}">${o.enabled ? "مفعّل" : "متوقف"}</span></div>
      <div class="form-actions">
        <button class="button ${o.enabled ? "button-danger" : "button-primary"}" data-action="toggle-group">${o.enabled ? "إيقاف النظام للمجموعة" : "إعادة تفعيل النظام"}</button>
      </div>
    </section>
    ${sectionTitle("الوحدات المستقلة", "إيقاف وحدة لا يحذف بياناتها أو أرصدتها")}
    <div class="toggle-list">${modules}</div>
  `;
}

function renderPoints() {
  const rewards = state.overview.settings?.rewards || {};
  const anti = state.overview.settings?.antiSpam || {};
  return `
    <section class="card">
      <div class="card-header"><div><h3>المكافآت وحدود الاقتصاد</h3><p>القيم تطبق على هذه المجموعة فقط.</p></div></div>
      <form data-form="points-settings">
        <div class="form-grid">
          ${numberField("startingBalance", "رصيد البداية", rewards.startingBalance, 0, 100000)}
          ${numberField("dailyGift", "الهدية اليومية", rewards.dailyGift, 0, 100000)}
          ${numberField("weeklyGift", "الهدية الأسبوعية", rewards.weeklyGift, 0, 100000)}
          ${numberField("inviteReward", "مكافأة العضو الجديد", rewards.inviteReward, 0, 100000)}
          ${numberField("messageReward", "النقاط لكل رسالة", rewards.messageReward, 0, 100)}
          ${numberField("laughReward", "رسالة الضحك إجمالًا", rewards.laughReward, 0, 100)}
          ${numberField("dailyEarnCap", "الحد اليومي للمكتسب", rewards.dailyEarnCap, 0, 1000000)}
        </div>
        <div class="form-actions"><button class="button button-primary">حفظ اقتصاد النقاط</button></div>
      </form>
    </section>
    ${sectionTitle("مكافحة السبام", "لا تُعاقب الرسائل الطبيعية المتنوعة")}
    <section class="card">
      <form data-form="spam-settings">
        <div class="toggle-row" style="margin-bottom:12px"><div><strong>تفعيل مكافحة السبام</strong><small>يعمل حتى عند إيقاف مكافآت الرسائل</small></div><label class="switch"><input type="checkbox" name="enabled" ${anti.enabled !== false ? "checked" : ""}><span></span></label></div>
        <div class="form-grid">
          ${numberField("repeatThreshold", "عدد التكرارات المؤكدة", anti.repeatThreshold, 3, 30)}
          ${numberField("windowSeconds", "مدة نافذة الرصد بالثواني", anti.windowSeconds, 10, 300)}
          ${numberField("floodThreshold", "حد الرسائل المكثفة", anti.floodThreshold, 8, 100)}
          ${numberField("penaltyPoints", "الخصم عند التأكيد", anti.penaltyPoints, 0, 10000)}
          ${numberField("penaltyCooldownSeconds", "مهلة تكرار الخصم", anti.penaltyCooldownSeconds, 10, 3600)}
          ${numberField("warningEvery", "التنبيه كل عدد مخالفات", anti.warningEvery, 1, 100)}
          ${numberField("kickAfterSpamMessages", "محاولة الطرد بعد مخالفات", anti.kickAfterSpamMessages, 0, 10000)}
        </div>
        <div class="form-actions"><button class="button button-primary">حفظ حدود السبام</button></div>
      </form>
    </section>
  `;
}

function numberField(name, label, value, min = 0, max = 1000000) {
  return `<div class="field"><label for="field-${escapeHtml(name)}">${escapeHtml(label)}</label><input id="field-${escapeHtml(name)}" name="${escapeHtml(name)}" type="number" min="${min}" max="${max}" step="1" value="${Number(value || 0)}" required></div>`;
}

function renderMembers() {
  const members = state.members || [];
  const rows = members.map((member, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><strong>${escapeHtml(member.name || member.memberId.split("@")[0])}</strong><small>${escapeHtml(member.memberId)}</small></td>
      <td>${formatNumber(member.balance)}</td>
      <td>${escapeHtml(member.rank?.name || "مبتدئ")}</td>
      <td>${formatNumber(member.totalEarned)}</td>
      <td>${formatNumber(member.totalSpent)}</td>
      <td><span class="pill ${member.enabled ? "green" : "red"}">${member.enabled ? "نشط" : "معطّل"}</span></td>
      <td><div class="table-actions">
        <button class="button button-secondary button-small" data-action="adjust-member" data-member="${escapeHtml(member.memberId)}">تعديل نقاط</button>
        <button class="button button-secondary button-small" data-action="edit-member-profile" data-member="${escapeHtml(member.memberId)}">الرتبة والمستوى</button>
        <button class="button ${member.enabled ? "button-danger" : "button-primary"} button-small" data-action="toggle-member" data-member="${escapeHtml(member.memberId)}" data-enabled="${member.enabled}">${member.enabled ? "تعطيل" : "تفعيل"}</button>
        <button class="button button-secondary button-small" data-action="assign-team" data-member="${escapeHtml(member.memberId)}">فريق</button>
      </div></td>
    </tr>`).join("");
  return `
    ${sectionTitle("الأعضاء والمحافظ", "التعديل يسجل المنفذ والوقت والسبب.", `<button class="button button-secondary button-small" data-action="load-members">تحديث القائمة</button>`)}
    <div class="toolbar" style="margin-bottom:10px"><input id="memberSearch" type="text" value="${escapeHtml(state.search)}" placeholder="ابحث بالاسم أو معرّف العضو"><button class="button button-secondary" data-action="search-members">بحث</button></div>
    <div class="table-wrap"><table><thead><tr><th>#</th><th>العضو</th><th>الرصيد</th><th>الرتبة</th><th>المكتسب</th><th>المصروف</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>${rows || `<tr><td colspan="8" class="muted">لا توجد محافظ بعد.</td></tr>`}</tbody></table></div>
  `;
}

function renderRanks() {
  const ranks = state.overview.settings?.ranks || [];
  return `
    ${sectionTitle("إعداد الرتب", "الرتبة الأولى أعلى من شرط النقاط، والإمبراطور يبقى لصاحب الرصيد الأعلى.", `<button class="button button-secondary button-small" data-action="add-rank">إضافة رتبة</button>`)}
    <section class="card">
      <div class="rank-row muted"><span>#</span><span>اسم الرتبة</span><span>الحد الأدنى</span><span>الرمز</span><span>اللون</span></div>
      <div id="rankRows">${ranks.map((rank, index) => `<div class="rank-row">
        <span class="rank-number">${index + 1}</span>
        <input data-rank="name" value="${escapeHtml(rank.name)}" aria-label="اسم الرتبة">
        <input data-rank="minPoints" type="number" min="0" value="${Number(rank.minPoints || 0)}" aria-label="حد الرتبة">
        <input data-rank="icon" value="${escapeHtml(rank.icon || "⭐")}" aria-label="رمز الرتبة">
        <input data-rank="color" type="text" value="${escapeHtml(rank.color || "#64748b")}" aria-label="لون الرتبة">
        <input data-rank="id" type="hidden" value="${escapeHtml(rank.id)}">
      </div>`).join("")}</div>
      <div class="form-actions"><button class="button button-primary" data-action="save-ranks">حفظ الرتب</button></div>
    </section>
    <section class="card" style="margin-top:12px">
      <div class="card-header"><div><h3>الصدارة</h3><p>اختر فترة لعرض نقاط المكتسبة خلال الفترة أو الرصيد العام.</p></div></div>
      <div class="toolbar">
        <select id="leaderboardPeriod"><option value="daily">يومية</option><option value="weekly">أسبوعية</option><option value="monthly">شهرية</option><option value="all">عامة حسب الرصيد</option></select>
        <button class="button button-secondary" data-action="leaderboard">عرض الصدارة</button>
      </div>
      <div id="leaderboardResults" class="record-list" style="margin-top:12px"></div>
    </section>
  `;
}

function renderCatalog(collection) {
  const items = collection === "pets" ? state.overview.catalogs?.pets || [] : state.overview.catalogs?.items || [];
  const isPet = collection === "pets";
  const cards = items.map((item) => `
    <article class="catalog-card">
      <div class="catalog-top"><div class="catalog-icon">${escapeHtml(item.icon || "🎁")}</div><div><div class="catalog-name">${escapeHtml(item.name)}</div><div class="catalog-price">${formatNumber(item.price)} نقطة · ${escapeHtml(item.id)}</div></div></div>
      <div class="catalog-info">${isPet ? `القدرة: ${escapeHtml(item.ability)} · قيمة: ${escapeHtml(item.value)}` : `الفئة: ${escapeHtml(item.category)} · المدة: ${formatNumber(item.durationDays)} يوم`}</div>
      <div class="catalog-actions"><span class="pill ${item.enabled === false ? "red" : "green"}">${item.enabled === false ? "مخفي" : "متاح"}</span><button class="button button-danger button-small" data-action="disable-item" data-collection="${collection}" data-item="${escapeHtml(item.id)}">إخفاء</button></div>
    </article>`).join("");
  return `
    ${sectionTitle(isPet ? "الحيوانات وقدراتها" : "العناصر القابلة للجمع", "العناصر المخفية تبقى في البيانات ولا تحذف من سجلات الشراء.", `<span class="pill">${items.length} عنصر</span>`)}
    <div class="catalog-grid">${cards || `<div class="card muted">لا توجد عناصر.</div>`}</div>
    ${sectionTitle(isPet ? "إضافة حيوان" : "إضافة عنصر")}
    <section class="card">
      <form data-form="catalog" data-collection="${collection}">
        <div class="form-grid">
          <div class="field"><label>المعرّف</label><input name="id" type="text" placeholder="fox أو title-veteran" required></div>
          <div class="field"><label>الاسم</label><input name="name" type="text" required></div>
          <div class="field"><label>الرمز</label><input name="icon" type="text" value="${isPet ? "🐾" : "🎁"}"></div>
          <div class="field"><label>السعر بالنقاط</label><input name="price" type="number" min="1" required></div>
          ${isPet ? `<div class="field"><label>القدرة</label><select name="ability"><option value="chat">زيادة نقاط الدردشة</option><option value="gift">زيادة الهدايا</option><option value="periodic">نقاط دورية عند النشاط</option><option value="tasks">زيادة مكافآت المهام</option><option value="challenge">التحديات</option><option value="activity">مكافآت النشاط</option></select></div><div class="field"><label>قيمة القدرة</label><input name="value" type="number" min="0" max="1" step="0.01" value="0.05"><div class="hint">القدرات لا تتجاوز ضعف المكافأة الأساسية.</div></div>` : `<div class="field"><label>الفئة</label><select name="category"><option value="title">لقب</option><option value="frame">إطار</option><option value="collectible">مقتنى</option><option value="badge">شارة</option><option value="power">قدرة مؤقتة</option><option value="item">عنصر</option></select></div><div class="field"><label>المدة بالأيام</label><input name="durationDays" type="number" min="0" max="365" value="0"></div><div class="field"><label>قوة القدرة المؤقتة</label><input name="value" type="number" min="0" max="0.5" step="0.01" value="0.15"><div class="hint">تطبق فقط على العناصر من فئة القدرة المؤقتة.</div></div>`}
        </div>
        <div class="form-actions"><button class="button button-primary">إضافة للمتجر</button></div>
      </form>
    </section>
  `;
}

function renderTasks() {
  const settings = state.overview.settings || {};
  return `
    ${sectionTitle("المهام اليومية والأسبوعية", "تُحتسب تلقائيًا مع رسائل العضو الطبيعية. لا توجد شيفرة قابلة للتنفيذ.")}
    <section class="card">
      <form data-form="task-settings">
        <div class="form-grid">
          <div class="field"><label>المهام اليومية — JSON</label><textarea name="dailyTasks">${escapeHtml(JSON.stringify(settings.dailyTasks || [], null, 2))}</textarea></div>
          <div class="field"><label>المهام الأسبوعية — JSON</label><textarea name="weeklyTasks">${escapeHtml(JSON.stringify(settings.weeklyTasks || [], null, 2))}</textarea></div>
        </div>
        <div class="form-actions"><button class="button button-primary">حفظ المهام</button></div>
      </form>
    </section>
    ${sectionTitle("الإنجازات والشارات", "الإنجازات لا تضيف نقاطًا تلقائيًا؛ عتباتها قابلة للتعديل.")}
    <section class="card"><form data-form="achievement-settings">
      <div class="field"><label>قواعد الإنجاز — JSON</label><textarea name="achievementRules">${escapeHtml(JSON.stringify(settings.achievementRules || [], null, 2))}</textarea></div>
      <div class="form-actions"><button class="button button-primary">حفظ الإنجازات</button></div>
    </form></section>
  `;
}

function renderSocial() {
  const teams = state.overview.teams || [];
  const challenges = state.overview.challenges || [];
  return `
    ${sectionTitle("الفرق", "أضف الفرق ثم عيّن الأعضاء من صفحة المحافظ.")}
    <section class="card"><form data-form="teams">
      <div class="field"><label>قائمة الفرق — JSON</label><textarea name="data">${escapeHtml(JSON.stringify(teams, null, 2))}</textarea></div>
      <div class="form-actions"><button class="button button-primary">حفظ الفرق</button></div>
    </form></section>
    ${sectionTitle("تحديات الأعضاء", "بعد قبول الرهان، يستطيع مشرف مخوّل تسجيل الفائز وتسوية الرصيد.")}
    <div class="record-list">${challenges.length ? challenges.map((item) => `
      <article class="card">
        <div class="card-header"><div><h3>${escapeHtml(item.id)}</h3><p>${escapeHtml(item.challenger)} مقابل ${escapeHtml(item.opponent)}</p></div><span class="pill ${item.status === "settled" ? "green" : "warning"}">${escapeHtml(item.status)}</span></div>
        <div class="muted">الرهان: ${formatNumber(item.stake)} لكل عضو${item.winnerId ? ` · الفائز ${escapeHtml(item.winnerId)}` : ""}</div>
        ${item.status === "accepted" ? `<div class="form-actions"><button class="button button-primary button-small" data-action="settle-challenge" data-challenge="${escapeHtml(item.id)}" data-winner="${escapeHtml(item.challenger)}">فوز الطرف الأول</button><button class="button button-secondary button-small" data-action="settle-challenge" data-challenge="${escapeHtml(item.id)}" data-winner="${escapeHtml(item.opponent)}">فوز الطرف الثاني</button></div>` : ""}
      </article>`).join("") : `<div class="card muted">لا توجد تحديات محفوظة.</div>`}</div>
  `;
}

function renderSeason() {
  const season = state.overview.season || {};
  const events = state.overview.events || [];
  return `
    ${sectionTitle("الموسم الحالي", "الموسم يسجل نطاقًا زمنيًا وجائزة؛ أوقفه دون حذف سجله.")}
    <section class="card"><form data-form="season">
      <div class="form-grid">
        <div class="field"><label>اسم الموسم</label><input name="title" type="text" value="${escapeHtml(season.title || "")}" placeholder="موسم الشتاء"></div>
        <div class="field"><label>جائزة الموسم</label><input name="reward" type="number" min="0" value="${Number(season.reward || 0)}"></div>
        <div class="field"><label>يبدأ</label><input name="startsAt" type="date" value="${escapeHtml((season.startsAt || "").slice(0,10))}"></div>
        <div class="field"><label>ينتهي</label><input name="endsAt" type="date" value="${escapeHtml((season.endsAt || "").slice(0,10))}"></div>
      </div>
      <div class="form-actions"><button class="button button-primary">حفظ الموسم</button>${season.id ? `${!season.settledAt ? `<button class="button button-warning" type="button" data-action="settle-season">توزيع جوائز الموسم</button>` : `<span class="pill green">وُزعت الجوائز</span>`}<button class="button button-danger" type="button" data-action="stop-season">إيقاف الموسم</button>` : ""}</div>
    </form></section>
    ${sectionTitle("الفعاليات", "قائمة أحداث بسيطة قابلة للإدارة من لوحة المجموعة.")}
    <section class="card"><form data-form="events">
      <div class="field"><label>الفعاليات — JSON</label><textarea name="data">${escapeHtml(JSON.stringify(events, null, 2))}</textarea></div>
      <div class="form-actions"><button class="button button-primary">حفظ الفعاليات</button></div>
    </form>
      <div class="field" style="margin-top:15px"><label for="eventAnnouncement">إعلان يُرسل الآن إلى المجموعة</label><textarea id="eventAnnouncement" placeholder="اكتب إعلان الفعالية. لن يُرسل إلا بعد الضغط والتأكيد."></textarea></div>
      <div class="form-actions"><button class="button button-secondary" data-action="publish-event">إرسال الإعلان</button></div>
    </section>
  `;
}

function renderMessages() {
  const templates = state.overview.settings?.messageTemplates || {};
  const current = templates.welcome || "";
  return `
    ${sectionTitle("قوالب الرسائل", "رسائل الترحيب والتنبيه تُرسل من أحداث المجموعة.")}
    <section class="card">
      <div class="warning-box">إصدار Baileys الحالي لا يوفّر بناء أزرار تفاعلية صادرة. المعاينة أدناه شكلية للعرض فقط؛ إذا احتوى رد أمر على _boton_ فلن يُرسل، ولن يتم استبداله بنص وهمي.</div>
      <div class="field" style="margin-top:13px"><label for="templateKind">نوع الرسالة</label><select id="templateKind"><option value="welcome">ترحيب عند انضمام عضو</option><option value="spamWarning">تنبيه سبام مؤكد</option></select></div>
      <div class="field"><label for="messageTemplate">نص القالب</label><textarea id="messageTemplate" placeholder="أهلًا _neam، رصيدك _cone نقطة.">${escapeHtml(current)}</textarea></div>
      <div class="variables">
        ${["_cone","_neam","_time","_img","_allcon","_rank","_position","_earned","_spent","_pet","_next"].map((item) => `<code data-insert="${item}">${item}</code>`).join("")}
      </div>
      <div class="field"><label>صيغة الزر للمعاينة فقط</label><input id="buttonSyntax" type="text" placeholder="_boton_عرض الرصيد_رصيدك _cone"></div>
      <div class="form-actions"><button class="button button-secondary" data-action="preview-template">معاينة</button><button class="button button-primary" data-action="save-template">حفظ رسالة الترحيب</button></div>
      <div id="messagePreview" class="template-preview">ستظهر المعاينة هنا.</div>
    </section>
  `;
}

function renderCommands() {
  const commands = state.overview.commands || [];
  return `
    ${sectionTitle("أوامر نصية مخصصة", "الأوامر تبدأ بنقطة، وتقبل نصوصًا ومتغيرات فقط. JavaScript غير مسموح.")}
    <section class="card"><form data-form="command">
      <div class="form-grid">
        <div class="field"><label>الأمر</label><input name="name" type="text" placeholder=".ترحيب" required></div>
        <div class="field"><label>الرد</label><textarea name="response" placeholder="أهلًا _neam، لديك _cone نقطة." required></textarea></div>
      </div>
      <div class="form-actions"><button class="button button-primary">إضافة الأمر</button></div>
    </form></section>
    <div class="record-list" style="margin-top:12px">${commands.length ? commands.map((item) => `
      <article class="record"><div><strong><span class="code-chip">${escapeHtml(item.name)}</span> ${item.enabled ? "" : "— معطّل"}</strong><small>${escapeHtml(item.response)}</small></div><div class="table-actions"><button class="button button-secondary button-small" data-action="edit-command" data-id="${escapeHtml(item.id)}">تعديل</button><button class="button button-danger button-small" data-action="disable-command" data-id="${escapeHtml(item.id)}">تعطيل</button></div></article>`).join("") : `<div class="card muted">لا توجد أوامر مخصصة.</div>`}</div>
  `;
}

function renderAdmins() {
  const admins = state.overview.administrators || [];
  return `
    ${sectionTitle("إضافة مشرف WhatsApp", "تُحفظ الصلاحيات لكل مجموعة.")}
    <section class="card"><form data-form="admin">
      <div class="field"><label>رقم WhatsApp مع رمز الدولة</label><input name="phoneNumber" type="text" placeholder="249XXXXXXXXX" required></div>
      <div class="field" style="margin-top:12px"><label>الصلاحيات</label><div class="permission-grid">
        ${PERMISSIONS.map(([id,label]) => `<label class="permission-option"><input type="checkbox" name="permissions" value="${id}">${label}</label>`).join("")}
      </div></div>
      <div class="form-actions"><button class="button button-primary">إضافة أو تحديث المشرف</button></div>
    </form></section>
    ${sectionTitle("المشرفون", "تعطيل مشرف لا يحذف سجل الصلاحيات.")}
    <div class="record-list">${admins.length ? admins.map((item) => `<article class="record"><div><strong>${escapeHtml(item.phoneNumber)}</strong><small>${escapeHtml((item.permissions || []).map((permission) => PERMISSIONS.find(([id]) => id === permission)?.[1] || permission).join(" · "))}</small></div><div class="table-actions"><span class="pill ${item.enabled ? "green" : "red"}">${item.enabled ? "نشط" : "معطّل"}</span>${item.enabled ? `<button class="button button-danger button-small" data-action="remove-admin" data-phone="${escapeHtml(item.phoneNumber)}">تعطيل</button>` : ""}</div></article>`).join("") : `<div class="card muted">لم تتم إضافة مشرفين.</div>`}</div>
  `;
}

function renderSlots() {
  const slots = state.slots || [];
  const cards = slots.map((slot) => `<article class="slot-card">
    <div class="slot-num">الخانة ${formatNumber(slot.slot)}</div>
    <div class="slot-name ${slot.memberId ? "" : "slot-empty"}">${slot.memberId ? escapeHtml(slot.name || slot.memberId.split("@")[0]) : "— فارغة —"}</div>
    ${slot.memberId ? `<div class="form-actions"><button class="button button-secondary button-small" data-action="adjust-slot" data-slot="${slot.slot}">تزويد / خصم</button></div>` : ""}
  </article>`).join("");
  return `
    ${sectionTitle("الخانات الثابتة", "مغادرة العضو تترك خانته فارغة؛ التحديث يعيد الترقيم حسب الأعضاء الحاليين.", `<button class="button button-primary button-small" data-action="refresh-slots">تحديث القائمة من WhatsApp</button>`)}
    <div class="slot-grid">${cards || `<div class="card muted">لا توجد خانات بعد. حدّث القائمة بعد اختيار رقم واتساب.</div>`}</div>
  `;
}

function renderLogs() {
  return `
    ${sectionTitle("سجلات المجموعة", "كل عملية مالية حساسة تسجل الفاعل والوقت والسبب.")}
    <div class="toolbar" style="margin-bottom:10px">
      <select id="logKind"><option value="all" ${state.logsKind === "all" ? "selected" : ""}>حركات الرصيد</option><option value="audit" ${state.logsKind === "audit" ? "selected" : ""}>سجل الإدارة</option><option value="violations" ${state.logsKind === "violations" ? "selected" : ""}>مخالفات السبام</option></select>
      <button class="button button-secondary" data-action="load-logs">تحديث السجلات</button>
    </div>
    <div class="record-list">${state.logs.length ? state.logs.map((item) => {
      if (item.amount !== undefined) return renderTransaction(item);
      return `<article class="record"><div><strong>${escapeHtml(item.action || item.kind || "مخالفة")} · ${escapeHtml(item.target || item.memberId || "")}</strong><small>${escapeHtml(item.reason || `${item.messageCount || 0} رسائل · خصم ${item.penalty || 0}`)} · الفاعل ${escapeHtml(item.actor || "system")}</small></div><time>${escapeHtml(new Date(item.timestamp).toLocaleString("ar"))}</time></article>`;
    }).join("") : `<div class="card muted">لا توجد سجلات لهذا النوع.</div>`}</div>
  `;
}

function chartSvg(data) {
  const width = 820;
  const height = 230;
  const padding = { top: 12, right: 14, bottom: 34, left: 52 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const daily = data?.daily || [];
  const max = Math.max(1, ...daily.flatMap((item) => [Number(item.earned), Number(item.spent)]));
  const slot = innerW / Math.max(1, daily.length);
  const barWidth = Math.max(2, Math.min(13, slot * .28));
  const grid = [0, .25, .5, .75, 1].map((part) => {
    const y = padding.top + innerH * part;
    const value = Math.round(max * (1 - part));
    return `<line class="grid-line" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}"></line><text x="${padding.left - 7}" y="${y + 3}" text-anchor="end">${formatNumber(value)}</text>`;
  }).join("");
  const bars = daily.map((item, index) => {
    const center = padding.left + slot * (index + .5);
    const earned = Number(item.earned || 0);
    const spent = Number(item.spent || 0);
    const h1 = earned / max * innerH;
    const h2 = spent / max * innerH;
    const label = String(item.day || "").slice(5);
    return `<rect class="earned-bar" x="${center - barWidth - 1}" y="${padding.top + innerH - h1}" width="${barWidth}" height="${Math.max(0,h1)}" rx="2"><title>${escapeHtml(item.day)} · مكتسب ${formatNumber(earned)}</title></rect><rect class="spent-bar" x="${center + 1}" y="${padding.top + innerH - h2}" width="${barWidth}" height="${Math.max(0,h2)}" rx="2"><title>${escapeHtml(item.day)} · مصروف ${formatNumber(spent)}</title></rect>${index % Math.max(1, Math.ceil(daily.length / 10)) === 0 ? `<text x="${center}" y="${height - 10}" text-anchor="middle">${escapeHtml(label)}</text>` : ""}`;
  }).join("");
  return `<svg class="svg-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="الأرصدة المكتسبة والمصروفة حسب اليوم">${grid}${bars}</svg>`;
}

function renderReports() {
  const report = state.report;
  if (!report) return `<div class="loading-card">جارٍ تحميل التقرير…</div>`;
  const memberList = (items, key, label) => `<section class="card"><div class="card-header"><div><h3>${label}</h3><p>أعلى خمسة أعضاء مسجلين</p></div></div>${items?.length ? `<div class="record-list">${items.map((member, index) => `<div class="record"><div><strong>${index + 1}. ${escapeHtml(member.name || member.memberId)}</strong><small>${escapeHtml(member.memberId)}</small></div><span class="pill green">${formatNumber(member[key])}</span></div>`).join("")}</div>` : `<div class="muted">لا توجد بيانات كافية.</div>`}</section>`;
  return `
    ${sectionTitle("ملخص الفترة", "الأرقام مستمدة من سجل العمليات المحفوظ للمجموعة.", `<select id="reportDays"><option value="7">7 أيام</option><option value="14" selected>14 يومًا</option><option value="30">30 يومًا</option><option value="90">90 يومًا</option></select><button class="button button-secondary button-small" data-action="load-report">تحديث</button>`)}
    <div class="grid grid-3">
      ${renderKpi("المكتسب خلال الفترة", formatNumber(report.totals?.earned), "من سجل الحركات")}
      ${renderKpi("المصروف خلال الفترة", formatNumber(report.totals?.spent), "من سجل الحركات")}
      ${renderKpi("رسائل ذات نقاط", formatNumber(report.totals?.messages), "تستثني الرسائل المكررة")}
    </div>
    <section class="card chart-card" style="margin-top:12px">
      <div class="card-header"><div><h3>النقاط المكتسبة والمصروفة يوميًا</h3><p>مقارنة يومية حسب تاريخ Africa/Khartoum</p></div></div>
      <div class="chart-legend"><span><i class="legend-dot"></i>مكتسب</span><span><i class="legend-dot spent"></i>مصروف</span></div>
      ${chartSvg(report)}
      <div class="chart-caption">أيام بلا حركات تظهر بصفر. السجل يحفظ آخر 30,000 حركة كحد أقصى.</div>
    </section>
    <section class="card" style="margin-top:12px">
      <div class="card-header"><div><h3>الصدارة حسب الفترة</h3><p>الترتيب الزمني يحتسب النقاط المكتسبة؛ العامة حسب الرصيد.</p></div><select id="reportPeriod"><option value="daily">يومية</option><option value="weekly">أسبوعية</option><option value="monthly">شهرية</option><option value="all">عامة</option></select></div>
      <div id="reportLeaderboard" class="record-list"></div>
    </section>
    ${sectionTitle("نشاط الأعضاء", "إحصاءات تراكمية من سجلات المجموعة.")}
    <div class="grid grid-3">
      ${memberList(state.overview.mostActiveMembers, "messages", "الأكثر نشاطًا")}
      ${memberList(state.overview.topEarners, "totalEarned", "الأكثر كسبًا")}
      ${memberList(state.overview.topSpenders, "totalSpent", "الأكثر إنفاقًا")}
    </div>
  `;
}

function renderGames() {
  const auto = state.overview.settings?.automaticRewards || {};
  const games = state.overview.settings?.games || {};
  const bank = state.overview.settings?.challengeBank || [];
  const weekdays = [
    ["0", "الأحد"], ["1", "الاثنين"], ["2", "الثلاثاء"], ["3", "الأربعاء"],
    ["4", "الخميس"], ["5", "الجمعة"], ["6", "السبت"],
  ];
  return `
    ${sectionTitle("التوزيع التلقائي", "يعتمد على المنطقة الزمنية Africa/Khartoum ويحفظ كل فترة مرة واحدة.")}
    <section class="card">
      <form data-form="automatic-reward-settings">
        <div class="toggle-row"><div><strong>تشغيل التوزيع</strong><small>يومي وأسبوعي لكل مجموعة على حدة</small></div><label class="switch"><input type="checkbox" name="enabled" ${auto.enabled !== false ? "checked" : ""}><span></span></label></div>
        <div class="form-grid">
          <div class="field"><label>وقت المكافأة اليومية</label><input name="dailyTime" type="time" value="${escapeHtml(auto.dailyTime || "08:00")}" required></div>
          ${numberField("dailyAmount", "النقاط اليومية", auto.dailyAmount ?? 200, 0, 1000000)}
          <div class="field"><label>يوم المكافأة الأسبوعية</label><select name="weeklyDay">${weekdays.map(([value, label]) => `<option value="${value}" ${Number(auto.weeklyDay) === Number(value) ? "selected" : ""}>${label}</option>`).join("")}</select></div>
          <div class="field"><label>وقت المكافأة الأسبوعية</label><input name="weeklyTime" type="time" value="${escapeHtml(auto.weeklyTime || "08:00")}" required></div>
          ${numberField("weeklyAmount", "النقاط الأسبوعية", auto.weeklyAmount ?? 1000, 0, 1000000)}
        </div>
        <div class="form-actions"><button class="button button-primary">حفظ جدول المكافآت</button></div>
      </form>
    </section>
    ${sectionTitle("ضبط الألعاب والتحديات", "عدّل المكافآت والصعوبة والمؤقتات والأسئلة لهذه المجموعة.")}
    <section class="card">
      <form data-form="game-settings">
        <div class="field"><label>إعدادات الألعاب — JSON</label><textarea name="games" rows="16" spellcheck="false">${escapeHtml(JSON.stringify(games, null, 2))}</textarea></div>
        <div class="field"><label>أسئلة التحديات — JSON</label><textarea name="challengeBank" rows="18" spellcheck="false">${escapeHtml(JSON.stringify(bank, null, 2))}</textarea></div>
        <div class="form-actions"><button class="button button-primary">حفظ إعدادات الألعاب والأسئلة</button></div>
      </form>
    </section>
    ${sectionTitle("إحصاءات الألعاب")}
    <section class="card"><pre class="code-preview">${escapeHtml(JSON.stringify({
      xo: state.overview.gameData?.xoStats || {},
      challenges: state.overview.gameData?.challengeStats || {},
      latestTournament: state.overview.gameData?.tournaments?.at(-1) || null,
    }, null, 2))}</pre></section>
  `;
}

function renderSettings() {
  return `
    ${sectionTitle("النسخ الاحتياطي", "تنزيل نسخة JSON من بيانات المجموعة المحددة.")}
    <section class="card">
      <p>تحتوي النسخة على الإعدادات والأرصدة والرتب والعناصر والسجلات. احفظها في مكان خاص لأنها تتضمن معرّفات أعضاء المجموعة.</p>
      <div class="form-actions"><button class="button button-primary" data-action="download-backup">تنزيل النسخة الاحتياطية</button></div>
    </section>
    ${sectionTitle("ملاحظات الأمان")}
    <div class="grid grid-2">
      <section class="card"><h3>الأوامر المخصصة</h3><p>تقبل نصوصًا ومتغيرات ثابتة فقط؛ لا يتم تشغيل JavaScript أو كود المستخدم.</p></section>
      <section class="card"><h3>الأرصدة</h3><p>التعديلات تستخدم معاملات متسلسلة وكتابة ذرية على القرص، مع منع الرصيد السالب في الشراء والخصم.</p></section>
      <section class="card"><h3>عزل البيانات</h3><p>لكل مجموعة ملف بيانات مستقل، ويمكن إيقاف وحداتها دون حذف الأرصدة.</p></section>
      <section class="card"><h3>الأزرار التفاعلية</h3><p>تُرسل الأزرار والقوائم عبر واجهات Baileys المثبتة، وتُفحص صلاحية العضو عند تنفيذ الإجراء.</p></section>
    </div>
  `;
}

const RENDERERS = {
  overview: renderOverview,
  groups: renderGroups,
  points: renderPoints,
  members: renderMembers,
  ranks: renderRanks,
  pets: () => renderCatalog("pets"),
  store: () => renderCatalog("items"),
  tasks: renderTasks,
  social: renderSocial,
  games: renderGames,
  season: renderSeason,
  messages: renderMessages,
  commands: renderCommands,
  admins: renderAdmins,
  slots: renderSlots,
  logs: renderLogs,
  reports: renderReports,
  settings: renderSettings,
};

function render() {
  $("#pageTitle").textContent = PAGE_TITLES[state.page] || "عالم المجموعات";
  $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.page === state.page));
  const active = selectedGroupData();
  $("#selectedGroupName").textContent = active?.name || active?.groupName || state.groupId || "لم يتم اختيار مجموعة";
  if (!state.groupId) {
    setWorkspace(emptyState("اختر مجموعة للمتابعة", "حدّد رقم WhatsApp والمجموعة في الشريط العلوي، أو أدخل معرّف المجموعة مباشرة."));
    return;
  }
  if (!state.overview?.enabled) {
    setWorkspace(selectGroupPrompt());
    return;
  }
  setWorkspace((RENDERERS[state.page] || renderOverview)());
  if (state.page === "reports") void loadReportLeaderboard();
}

async function loadFrameworkOverview() {
  if (!token) {
    setConnection("افتح اللوحة من البوت", "disconnected");
    setWorkspace(emptyState("الرابط يحتاج إلى جلسة موثقة", "افتح Web App من حساب البوت ثم اختر «عالم المجموعات»."));
    return;
  }
  const data = await api("/api/fw/overview");
  state.numbers = data.numbers || [];
  state.groups = data.groups || [];
  state.activeGroups = await api("/api/group-world/groups");
  const phoneSelect = $("#phoneSelect");
  const oldPhone = state.phoneNumber;
  phoneSelect.innerHTML = `<option value="">اختر رقم واتساب</option>${state.numbers.map((number) => `<option value="${escapeHtml(number)}">${escapeHtml(number)}</option>`).join("")}`;
  state.phoneNumber = state.numbers.includes(oldPhone) ? oldPhone : (state.numbers[0] || "");
  phoneSelect.value = state.phoneNumber;
  const groupSelect = $("#groupSelect");
  const known = new Map();
  for (const item of state.groups) known.set(item.id, item);
  for (const item of state.activeGroups) if (!known.has(item.groupId)) {
    known.set(item.groupId, { id: item.groupId, name: item.groupName, phoneNumber: state.phoneNumber });
  }
  groupSelect.innerHTML = `<option value="">اختر مجموعة</option>${[...known.values()].map((group) => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.name || group.id)}</option>`).join("")}`;
  if (state.groupId && known.has(state.groupId)) groupSelect.value = state.groupId;
  if (!state.groupId && state.groups.length) {
    state.groupId = state.groups[0].id;
    groupSelect.value = state.groupId;
  }
  $("#manualGroupId").value = state.groupId;
  setConnection(data.waConnected ? "WhatsApp متصل" : "WhatsApp غير متصل", data.waConnected ? "connected" : "disconnected");
  if (state.groupId) await loadGroup();
  else render();
}

async function loadGroup() {
  state.overview = null;
  $("#activateButton").hidden = true;
  if (!state.groupId) { render(); return; }
  try {
    state.overview = await api(`/api/group-world/overview${queryForGroup({ phoneNumber: state.phoneNumber })}`);
    $("#activateButton").hidden = true;
    if (state.page === "members") await loadMembers();
    if (state.page === "slots") await loadSlots();
    if (state.page === "logs") await loadLogs();
    if (state.page === "reports") await loadReport();
    render();
  } catch (error) {
    if (/لا تملك الصلاحية/.test(error.message) || /غير مصرح/.test(error.message)) {
      state.overview = { enabled: false };
      $("#activateButton").hidden = false;
    } else {
      state.overview = { enabled: false };
      $("#activateButton").hidden = false;
      notify(error.message, "warning");
    }
    render();
  }
}

async function loadMembers() {
  if (!state.groupId || !state.overview?.enabled) return;
  state.members = await api(`/api/group-world/members${queryForGroup({ q: state.search })}`);
}

async function loadSlots() {
  if (!state.groupId || !state.overview?.enabled) return;
  state.slots = await api(`/api/group-world/slots${queryForGroup()}`);
}

async function loadLogs() {
  if (!state.groupId || !state.overview?.enabled) return;
  state.logsKind = $("#logKind")?.value || state.logsKind;
  state.logs = await api(`/api/group-world/logs${queryForGroup({ kind: state.logsKind, limit: 150 })}`);
}

async function loadReport() {
  if (!state.groupId || !state.overview?.enabled) return;
  const days = $("#reportDays")?.value || "14";
  state.report = await api(`/api/group-world/reports${queryForGroup({ days })}`);
}

async function loadReportLeaderboard() {
  const target = $("#reportLeaderboard");
  if (!target) return;
  try {
    const period = $("#reportPeriod")?.value || "all";
    const leaders = await api(`/api/group-world/leaderboard${queryForGroup({ period, limit: 10 })}`);
    target.innerHTML = leaders.length
      ? leaders.map((item, index) => `<div class="record"><div><strong>${index + 1}. ${escapeHtml(item.name)}</strong><small>${escapeHtml(item.rank?.name || "")} · ${escapeHtml(item.memberId)}</small></div><span class="pill green">${formatNumber(item.score)} نقطة</span></div>`).join("")
      : `<div class="muted">لا توجد نتائج لهذه الفترة.</div>`;
  } catch (error) { notify(error.message, "error"); }
}

function setPage(page) {
  state.page = page;
  if (page === "members") void loadMembers().then(render).catch((error) => notify(error.message, "error"));
  else if (page === "slots") void loadSlots().then(render).catch((error) => notify(error.message, "error"));
  else if (page === "logs") void loadLogs().then(render).catch((error) => notify(error.message, "error"));
  else if (page === "reports") void loadReport().then(render).catch((error) => notify(error.message, "error"));
  else render();
}

async function activateGroup() {
  if (!state.groupId) throw new Error("اختر مجموعة أولًا");
  if (!state.phoneNumber) throw new Error("اختر رقم WhatsApp متصلًا");
  const result = await api("/api/group-world/activate", { groupId: state.groupId, phoneNumber: state.phoneNumber });
  notify(`تم تفعيل عالم المجموعة وتهيئة ${result.seededMembers} عضوًا.`);
  state.activeGroups = await api("/api/group-world/groups");
  await loadGroup();
}

async function refreshGroups() {
  if (!state.phoneNumber) throw new Error("اختر رقم WhatsApp متصلًا");
  await api("/api/fw/groups/refresh", { number: state.phoneNumber });
  state.groupId = "";
  await loadFrameworkOverview();
  notify("تم تحديث مجموعات رقم WhatsApp المحدد.");
}

async function refreshOverview() {
  if (!state.groupId) return loadFrameworkOverview();
  state.overview = await api(`/api/group-world/overview${queryForGroup({ phoneNumber: state.phoneNumber })}`);
  if (state.page === "members") await loadMembers();
  if (state.page === "slots") await loadSlots();
  if (state.page === "logs") await loadLogs();
  if (state.page === "reports") await loadReport();
  render();
}

function formDataObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

async function handleForm(form) {
  const kind = form.dataset.form;
  if (kind === "points-settings") {
    const values = formDataObject(form);
    const rewards = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Number(value)]));
    await api("/api/group-world/settings", { groupId: state.groupId, patch: { rewards } });
    notify("تم حفظ إعدادات النقاط.");
  } else if (kind === "spam-settings") {
    const values = formDataObject(form);
    const antiSpam = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, key === "enabled" ? value === "on" : Number(value)]));
    antiSpam.enabled = $("input[name=enabled]", form).checked;
    await api("/api/group-world/settings", { groupId: state.groupId, patch: { antiSpam } });
    notify("تم حفظ حدود مكافحة السبام.");
  } else if (kind === "catalog") {
    const values = formDataObject(form);
    const collection = form.dataset.collection;
    const item = { ...values, price: Number(values.price), enabled: true };
    if (collection === "pets") item.value = Number(values.value);
    else {
      item.durationDays = Number(values.durationDays);
      item.value = Number(values.value || 0);
    }
    await api("/api/group-world/catalog", { groupId: state.groupId, collection, item });
    notify("تمت إضافة العنصر.");
  } else if (kind === "task-settings") {
    const values = formDataObject(form);
    const dailyTasks = JSON.parse(values.dailyTasks);
    const weeklyTasks = JSON.parse(values.weeklyTasks);
    await api("/api/group-world/settings", { groupId: state.groupId, patch: { dailyTasks, weeklyTasks } });
    notify("تم حفظ المهام.");
  } else if (kind === "achievement-settings") {
    const values = formDataObject(form);
    const achievementRules = JSON.parse(values.achievementRules);
    await api("/api/group-world/settings", { groupId: state.groupId, patch: { achievementRules } });
    notify("تم حفظ الإنجازات.");
  } else if (kind === "automatic-reward-settings") {
    const values = formDataObject(form);
    await api("/api/group-world/settings", {
      groupId: state.groupId,
      patch: {
        automaticRewards: {
          enabled: $("input[name=enabled]", form).checked,
          dailyTime: values.dailyTime,
          dailyAmount: Number(values.dailyAmount),
          weeklyDay: Number(values.weeklyDay),
          weeklyTime: values.weeklyTime,
          weeklyAmount: Number(values.weeklyAmount),
        },
      },
    });
    notify("تم حفظ أوقات ومكافآت التوزيع التلقائي.");
  } else if (kind === "game-settings") {
    let games;
    let challengeBank;
    try {
      games = JSON.parse(form.querySelector("[name=games]").value);
      challengeBank = JSON.parse(form.querySelector("[name=challengeBank]").value);
    } catch {
      throw new Error("تحقق من صحة JSON لإعدادات الألعاب والأسئلة.");
    }
    await api("/api/group-world/settings", { groupId: state.groupId, patch: { games, challengeBank } });
    notify("تم حفظ مكافآت الألعاب والأسئلة.");
  } else if (kind === "teams" || kind === "events") {
    const values = formDataObject(form);
    const data = JSON.parse(values.data);
    const collection = kind;
    await api("/api/group-world/data", { groupId: state.groupId, collection, data });
    notify(kind === "teams" ? "تم حفظ الفرق." : "تم حفظ الفعاليات.");
  } else if (kind === "season") {
    const values = formDataObject(form);
    await api("/api/group-world/settings", {
      groupId: state.groupId,
      patch: { season: {
        title: values.title,
        reward: Number(values.reward || 0),
        startsAt: values.startsAt ? `${values.startsAt}T00:00:00.000Z` : null,
        endsAt: values.endsAt ? `${values.endsAt}T23:59:59.000Z` : null,
      } },
    });
    notify("تم حفظ إعدادات الموسم.");
  } else if (kind === "command") {
    const values = formDataObject(form);
    await api("/api/group-world/command", { groupId: state.groupId, command: values });
    notify("تمت إضافة الأمر.");
  } else if (kind === "admin") {
    const values = formDataObject(form);
    values.permissions = $$('input[name="permissions"]:checked', form).map((input) => input.value);
    await api("/api/group-world/admin", { groupId: state.groupId, phoneNumber: values.phoneNumber, permissions: values.permissions });
    notify("تم حفظ صلاحيات المشرف.");
  }
  await refreshOverview();
}

async function handleClick(button) {
  const action = button.dataset.action;
  if (button.dataset.nav) { setPage(button.dataset.nav); return; }
  if (action === "activate") return activateGroup();
  if (action === "toggle-group") {
    const enabled = !state.overview.enabled;
    if (!enabled && !confirm("سيتم إيقاف المكافآت والوحدات لهذه المجموعة. تبقى الأرصدة والبيانات محفوظة. متابعة؟")) return;
    await api("/api/group-world/enable", { groupId: state.groupId, enabled, reason: "تغيير من لوحة عالم المجموعات" });
    return refreshOverview();
  }
  if (action === "load-members" || action === "search-members") {
    state.search = $("#memberSearch")?.value || "";
    await loadMembers();
    return render();
  }
  if (action === "adjust-member") {
    const amount = Number(prompt("أدخل مقدار النقاط، السالب للخصم:", "100"));
    if (!Number.isInteger(amount) || amount === 0) return;
    const reason = prompt("سبب العملية (مطلوب):", "تعديل إداري");
    if (!reason || reason.trim().length < 3) throw new Error("اكتب سببًا واضحًا للعملية");
    await api("/api/group-world/points", { groupId: state.groupId, memberId: button.dataset.member, amount, reason });
    notify("تم تعديل الرصيد وتسجيل العملية.");
    return refreshOverview();
  }
  if (action === "edit-member-profile") {
    const memberId = button.dataset.member;
    const profile = await api(`/api/group-world/member${queryForGroup({ memberId })}`);
    if (!profile) throw new Error("المحفظة غير موجودة");
    const level = Number(prompt("المستوى:", String(profile.level)));
    if (!Number.isInteger(level) || level < 1) return;
    const xp = Number(prompt("XP:", String(profile.xp)));
    if (!Number.isInteger(xp) || xp < 0) return;
    const rankOverrideId = prompt(`معرّف الرتبة اليدوية، أو اتركه فارغًا للحساب التلقائي:\n${(state.overview.settings.ranks || []).map((rank) => `${rank.id}: ${rank.name}`).join("\n")}`, profile.rankOverrideId || "");
    if (rankOverrideId === null) return;
    const activePetId = prompt("معرّف حيوان تملكه لتفعيله، أو فارغ لإلغاء الحيوان النشط:", profile.activePetId || "");
    if (activePetId === null) return;
    const reason = prompt("سبب تعديل الملف (مطلوب):", "تعديل إداري");
    if (!reason || reason.trim().length < 3) throw new Error("اكتب سببًا واضحًا للتعديل");
    await api("/api/group-world/member/update", {
      groupId: state.groupId,
      memberId,
      patch: { level, xp, rankOverrideId: rankOverrideId.trim() || null, activePetId: activePetId.trim() || null },
      reason,
    });
    notify("تم تحديث ملف العضو وتسجيل التغيير.");
    return refreshOverview();
  }
  if (action === "toggle-member") {
    const enabled = button.dataset.enabled !== "true";
    await api("/api/group-world/member", { groupId: state.groupId, memberId: button.dataset.member, enabled, reason: "تغيير من لوحة الأعضاء" });
    notify(enabled ? "تم تفعيل الحساب." : "تم تعطيل الحساب.");
    return refreshOverview();
  }
  if (action === "assign-team") {
    const teams = state.overview.teams || [];
    if (!teams.length) throw new Error("أضف فريقًا من صفحة التحديات والفرق أولًا");
    const team = prompt(`أدخل معرّف الفريق:\n${teams.map((item) => `${item.id}: ${item.title}`).join("\n")}`, teams[0].id);
    if (!team) return;
    await api("/api/group-world/team/assign", { groupId: state.groupId, memberId: button.dataset.member, teamId: team });
    notify("تم تعيين العضو إلى الفريق.");
    return refreshOverview();
  }
  if (action === "add-rank") {
    state.overview.settings.ranks.push({ id: `rank-${Date.now()}`, name: "رتبة جديدة", icon: "⭐", color: "#64748b", minPoints: 0 });
    return render();
  }
  if (action === "save-ranks") {
    const ranks = $$("#rankRows .rank-row").map((row) => {
      const value = (key) => $(`[data-rank="${key}"]`, row)?.value;
      return { id: value("id"), name: value("name"), minPoints: Number(value("minPoints")), icon: value("icon"), color: value("color") };
    });
    await api("/api/group-world/settings", { groupId: state.groupId, patch: { ranks } });
    notify("تم حفظ الرتب.");
    return refreshOverview();
  }
  if (action === "leaderboard") {
    const period = $("#leaderboardPeriod").value;
    const leaders = await api(`/api/group-world/leaderboard${queryForGroup({ period, limit: 20 })}`);
    $("#leaderboardResults").innerHTML = leaders.length ? leaders.map((item, index) => `<div class="record"><div><strong>${index + 1}. ${escapeHtml(item.name)}</strong><small>${escapeHtml(item.memberId)}</small></div><span class="pill green">${formatNumber(item.score)}</span></div>`).join("") : `<div class="muted">لا توجد بيانات.</div>`;
    return;
  }
  if (action === "disable-item") {
    await api("/api/group-world/catalog/delete", { groupId: state.groupId, collection: button.dataset.collection, itemId: button.dataset.item });
    notify("تم إخفاء العنصر من المتجر.");
    return refreshOverview();
  }
  if (action === "settle-challenge") {
    if (!confirm("تسوية الرهان نهائية. تأكد من نتيجة التحدي قبل المتابعة.")) return;
    await api("/api/group-world/challenge/settle", { groupId: state.groupId, challengeId: button.dataset.challenge, winnerId: button.dataset.winner });
    notify("تمت تسوية التحدي.");
    return refreshOverview();
  }
  if (action === "stop-season") {
    await api("/api/group-world/settings", { groupId: state.groupId, patch: { season: null } });
    notify("تم إيقاف الموسم مع إبقاء سجلات المجموعة.");
    return refreshOverview();
  }
  if (action === "settle-season") {
    if (!confirm("سيتم دفع جوائز الموسم للفائزين من أرصدتهم المكتسبة خلال الفترة. العملية لا يمكن تكرارها. متابعة؟")) return;
    const result = await api("/api/group-world/season/settle", { groupId: state.groupId });
    notify(`تم توزيع جوائز الموسم على ${result.winners.length} أعضاء.`);
    return refreshOverview();
  }
  if (action === "publish-event") {
    const text = $("#eventAnnouncement").value.trim();
    if (!text) throw new Error("اكتب نص الإعلان أولًا");
    if (!confirm("سيتم إرسال هذا الإعلان إلى مجموعة WhatsApp المحددة الآن. متابعة؟")) return;
    await api("/api/group-world/event/publish", { groupId: state.groupId, phoneNumber: state.phoneNumber, text });
    notify("تم إرسال الإعلان إلى المجموعة.");
    return;
  }
  if (action === "preview-template") return previewTemplate();
  if (action === "save-template") {
    const template = $("#messageTemplate").value;
    const kind = $("#templateKind").value;
    const messageTemplates = { ...(state.overview.settings.messageTemplates || {}), [kind]: template };
    await api("/api/group-world/settings", { groupId: state.groupId, patch: { messageTemplates } });
    notify("تم حفظ القالب.");
    return refreshOverview();
  }
  if (action === "disable-command") {
    await api("/api/group-world/command/delete", { groupId: state.groupId, commandId: button.dataset.id });
    notify("تم تعطيل الأمر.");
    return refreshOverview();
  }
  if (action === "edit-command") {
    const item = (state.overview.commands || []).find((command) => command.id === button.dataset.id);
    if (!item) return;
    const name = prompt("اسم الأمر:", item.name);
    if (!name) return;
    const response = prompt("نص الرد:", item.response);
    if (response === null) return;
    await api("/api/group-world/command/update", { groupId: state.groupId, commandId: item.id, patch: { name, response } });
    notify("تم تحديث الأمر.");
    return refreshOverview();
  }
  if (action === "remove-admin") {
    if (!confirm(`تعطيل صلاحيات المشرف ${button.dataset.phone}؟`)) return;
    await api("/api/group-world/admin/delete", { groupId: state.groupId, phoneNumber: button.dataset.phone });
    notify("تم تعطيل المشرف.");
    return refreshOverview();
  }
  if (action === "refresh-slots") {
    await api("/api/group-world/slots/refresh", { groupId: state.groupId, phoneNumber: state.phoneNumber });
    notify("تم تحديث الخانات وفق الأعضاء الحاليين.");
    await loadSlots();
    return render();
  }
  if (action === "adjust-slot") {
    const amount = Number(prompt(`مقدار التعديل للخانة ${button.dataset.slot}، السالب للخصم:`, "100"));
    if (!Number.isInteger(amount) || amount === 0) return;
    const reason = prompt("سبب العملية:", "تعديل من قائمة الأعضاء");
    if (!reason || reason.trim().length < 3) throw new Error("اكتب سببًا واضحًا للعملية");
    await api("/api/group-world/slots/adjust", { groupId: state.groupId, phoneNumber: state.phoneNumber, slotNumber: Number(button.dataset.slot), amount, reason });
    notify("تم تعديل رصيد صاحب الخانة بعد التحقق من العضوية.");
    await refreshOverview();
    await loadSlots();
    return render();
  }
  if (action === "load-logs") {
    await loadLogs();
    return render();
  }
  if (action === "load-report") {
    await loadReport();
    return render();
  }
  if (action === "download-backup") {
    const backup = await api(`/api/group-world/backup${queryForGroup()}`);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `group-world-${state.groupId.replace(/[^a-z0-9-]/gi, "_")}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    notify("تم تجهيز نسخة المجموعة للتنزيل.");
  }
}

async function previewTemplate() {
  const template = $("#messageTemplate").value + ($("#buttonSyntax").value ? `\n${$("#buttonSyntax").value}` : "");
  const values = {
    points: 500,
    name: "اسم العضو",
    time: new Date().toLocaleString("ar"),
    image: null,
    allMembers: "1. عضو تجريبي: 500",
    rank: "مبتدئ",
    position: 1,
    earned: 500,
    spent: 0,
    pet: "لا يوجد",
    nextPoints: 1_500,
  };
  const preview = await api("/api/group-world/template/preview", { groupId: state.groupId, template, values });
  const target = $("#messagePreview");
  target.innerHTML = `${escapeHtml(preview.text || "")}${preview.includesImage ? `<div class="muted" style="margin-top:8px">سيُرسل النظام صورة العضو مع النص إذا كانت متاحة.</div>` : ""}${(preview.buttons || []).map((item) => `<span class="preview-button">${escapeHtml(item.label)}<small style="display:block">${escapeHtml(item.response)}</small></span>`).join("")}`;
}

function insertVariable(value) {
  const input = $("#messageTemplate");
  const start = input.selectionStart;
  const end = input.selectionEnd;
  input.setRangeText(value, start, end, "end");
  input.focus();
}

$("#mainNav").addEventListener("click", (event) => {
  const button = event.target.closest("[data-page]");
  if (button) setPage(button.dataset.page);
});

$("#workspace").addEventListener("click", (event) => {
  const nav = event.target.closest("[data-nav]");
  if (nav) { setPage(nav.dataset.nav); return; }
  const button = event.target.closest("[data-action]");
  if (button) {
    void handleClick(button).catch((error) => notify(error.message, "error"));
    return;
  }
  const variable = event.target.closest("[data-insert]");
  if (variable) insertVariable(variable.dataset.insert);
});

$("#workspace").addEventListener("submit", (event) => {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault();
  void handleForm(form).catch((error) => notify(error.message, "error"));
});

$("#groupSelect").addEventListener("change", async (event) => {
  state.groupId = event.target.value;
  $("#manualGroupId").value = state.groupId;
  await loadGroup();
});
$("#openGroupButton").addEventListener("click", async () => {
  const groupId = $("#manualGroupId").value.trim();
  if (!/^[A-Za-z0-9._:-]{3,128}@g\.us$/.test(groupId)) {
    notify("أدخل معرّف مجموعة WhatsApp صالحًا ينتهي بـ @g.us.", "error");
    return;
  }
  state.groupId = groupId;
  $("#groupSelect").value = [...$("#groupSelect").options].some((option) => option.value === groupId) ? groupId : "";
  await loadGroup();
});
$("#phoneSelect").addEventListener("change", (event) => {
  state.phoneNumber = event.target.value;
  state.groupId = "";
  void loadFrameworkOverview().catch((error) => notify(error.message, "error"));
});
$("#refreshGroupsButton").addEventListener("click", () => {
  void refreshGroups().catch((error) => notify(error.message, "error"));
});
$("#activateButton").addEventListener("click", () => {
  void activateGroup().catch((error) => notify(error.message, "error"));
});
$("#reloadButton").addEventListener("click", () => {
  void refreshOverview().catch((error) => notify(error.message, "error"));
});

$("#workspace").addEventListener("change", (event) => {
  if (event.target.matches("[data-module]")) {
    void api("/api/group-world/module", {
      groupId: state.groupId,
      name: event.target.dataset.module,
      enabled: event.target.checked,
    }).then(refreshOverview).catch((error) => {
      event.target.checked = !event.target.checked;
      notify(error.message, "error");
    });
  }
  if (event.target.id === "logKind") void loadLogs().then(render).catch((error) => notify(error.message, "error"));
  if (event.target.id === "reportPeriod") void loadReportLeaderboard();
  if (event.target.id === "reportDays") void loadReport().then(render).catch((error) => notify(error.message, "error"));
  if (event.target.id === "templateKind") {
    const kind = event.target.value;
    $("#messageTemplate").value = state.overview?.settings?.messageTemplates?.[kind] || "";
  }
});

$("#pageDate").textContent = new Intl.DateTimeFormat("ar", { dateStyle: "full", timeZone: "Africa/Khartoum" }).format(new Date());
void loadFrameworkOverview().catch((error) => {
  setConnection("تعذّر الاتصال", "disconnected");
  setWorkspace(emptyState("تعذّر تحميل اللوحة", error.message));
});
