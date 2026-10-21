const DEFAULT_BLOCK = ["娱乐", "综艺", "体育", "粉丝", "游戏"];
const BLOCK_TERMS = {
  "娱乐": ["明星", "艺人", "恋情", "绯闻", "塌房", "娱乐圈", "官宣", "分手", "结婚生子", "演唱会", "新歌", "粉丝见面", "爱豆", "演员回应", "工作室声明", "红毯", "路透", "饭圈"],
  "综艺": ["综艺", "选秀", "真人秀", "乘风", "披荆斩棘", "奔跑吧", "极限挑战", "歌手", "好声音", "脱口秀", "舞台直拍", "节目组"],
  "体育": ["足球", "篮球", "NBA", "CBA", "网球", "乒乓球", "羽毛球", "世界杯", "欧冠", "中超", "奥运会", "亚运会", "F1", "赛车", "比分", "夺冠", "球员", "运动员", "教练", "主帅", "联赛", "全运会"],
  "粉丝": ["打榜", "控评", "应援", "粉丝互撕", "站姐", "反黑", "超话签到", "数据女工", "粉圈"],
  "游戏": ["游戏皮肤", "游戏联赛", "电竞", "战队", "王者荣耀", "英雄联盟", "原神", "和平精英", "绝地求生"]
};
const KEEP_TERMS = ["政策", "警方", "通报", "调查", "事故", "地震", "火灾", "洪水", "公共安全", "违法", "犯罪", "法院", "判决", "立法", "国务院", "政府", "民生", "教育", "医疗", "就业", "房价", "人工智能", "半导体", "芯片", "科技", "经济", "金融", "股市", "国际", "外交", "科研", "研究发现", "公共卫生"];

const listEl = document.querySelector("#list");
const noticeEl = document.querySelector("#notice");
const updatedEl = document.querySelector("#updated-at");
const countEl = document.querySelector("#result-count");
const dialog = document.querySelector("#settings-dialog");
let allItems = [];
let activeCategory = "全部";

function readSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem("weibo-clean-settings") || "{}");
    return {
      blocks: Array.isArray(saved.blocks) ? saved.blocks : DEFAULT_BLOCK,
      blockWords: saved.blockWords || "",
      keepWords: saved.keepWords || ""
    };
  } catch {
    return { blocks: DEFAULT_BLOCK, blockWords: "", keepWords: "" };
  }
}
function saveSettings(settings) {
  localStorage.setItem("weibo-clean-settings", JSON.stringify(settings));
}
function splitWords(text) {
  return text.split(/[,，、\n]/).map(s => s.trim()).filter(Boolean);
}
function includesAny(text, words) {
  const normalized = text.toLowerCase();
  return words.some(word => word && normalized.includes(word.toLowerCase()));
}
function classify(title) {
  const t = title.toLowerCase();
  if (/芯片|半导体|人工智能|ai模型|科技|机器人|航天|科研|科学家|实验室|技术突破/.test(t)) return "科技";
  if (/股市|股票|经济|金融|央行|人民币|美元|房价|楼市|企业|消费|gdp|财经|市场监管/.test(t)) return "财经";
  if (/外交|国际|美国|日本|欧洲|联合国|俄罗斯|乌克兰|中东|全球|国际社会/.test(t)) return "国际";
  if (/政策|就业|教育|医疗|医保|交通|住房|社保|民生|学校|医院|高考|公共服务/.test(t)) return "民生";
  return "社会";
}
function isPublicInterest(title) {
  return includesAny(title, KEEP_TERMS);
}
function shouldBlock(item, settings) {
  const title = item.title || "";
  const customKeep = splitWords(settings.keepWords);
  if (includesAny(title, customKeep)) return false;
  if (isPublicInterest(title)) return false;

  const selected = settings.blocks.flatMap(group => BLOCK_TERMS[group] || []);
  if (includesAny(title, selected)) return true;
  return includesAny(title, splitWords(settings.blockWords));
}
function getVisibleItems() {
  const settings = readSettings();
  return allItems.filter(item => !shouldBlock(item, settings))
    .map(item => ({ ...item, cleanCategory: classify(item.title) }))
    .filter(item => activeCategory === "全部" || item.cleanCategory === activeCategory);
}
function render() {
  const items = getVisibleItems();
  countEl.textContent = `${items.length} 条`;
  if (!items.length) {
    listEl.innerHTML = '<div class="empty">没有符合条件的热搜。可以调整过滤设置，或稍后刷新。</div>';
    return;
  }
  listEl.innerHTML = items.map((item, i) => {
    const rank = item.rank || i + 1;
    const hot = formatHot(item.hot);
    return `<a class="hot-item" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">
      <span class="rank ${rank <= 3 ? "top" : ""}">${String(rank).padStart(2, "0")}</span>
      <span>
        <span class="item-title">${escapeHtml(item.title)}</span>
        <span class="item-meta"><span class="tag">${item.cleanCategory}</span>${hot ? `<span>${hot} 热度</span>` : ""}</span>
      </span>
    </a>`;
  }).join("");
}
function formatHot(value) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return String(n);
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
}
async function loadHotSearch() {
  noticeEl.hidden = true;
  updatedEl.textContent = "正在更新…";
  document.querySelector("#refresh-button").disabled = true;
  try {
    const response = await fetch("/api/hotsearch", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || "数据源暂时不可用");
    allItems = payload.items || [];
    const date = new Date(payload.fetchedAt || Date.now());
    updatedEl.textContent = `更新于 ${date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
    render();
  } catch (error) {
    updatedEl.textContent = "暂时无法更新";
    noticeEl.textContent = `${error.message} 当前页面不会用虚构数据替代实时榜单。你可以稍后再次刷新。`;
    noticeEl.hidden = false;
    if (!allItems.length) listEl.innerHTML = '<div class="empty">热搜数据暂不可用。部署完成后若持续出现此提示，需要检查微博接口是否变更或被限流。</div>';
  } finally {
    document.querySelector("#refresh-button").disabled = false;
  }
}
function openSettings() {
  const settings = readSettings();
  document.querySelectorAll('input[name="block"]').forEach(input => {
    input.checked = settings.blocks.includes(input.value);
  });
  document.querySelector("#block-words").value = settings.blockWords;
  document.querySelector("#keep-words").value = settings.keepWords;
  dialog.showModal();
}
document.querySelector("#settings-open").addEventListener("click", openSettings);
document.querySelector("#refresh-button").addEventListener("click", loadHotSearch);
document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t === tab));
  activeCategory = tab.dataset.category;
  render();
}));
document.querySelector("#settings-form").addEventListener("submit", event => {
  event.preventDefault();
  const blocks = [...document.querySelectorAll('input[name="block"]:checked')].map(input => input.value);
  saveSettings({
    blocks,
    blockWords: document.querySelector("#block-words").value,
    keepWords: document.querySelector("#keep-words").value
  });
  dialog.close();
  render();
});
document.querySelector("#reset-settings").addEventListener("click", () => {
  saveSettings({ blocks: DEFAULT_BLOCK, blockWords: "", keepWords: "" });
  openSettings();
});
loadHotSearch();
