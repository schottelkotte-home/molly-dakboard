// Google Apps Script backend + DAKboard renderer for the Meal Planner.
// Deploy as Web App: Execute as "Me"; access "Anyone".
// Script Property required: MEAL_PLANNER_WRITE_KEY
//
// Routes:
//   /exec?view=dakboard   -> rendered DAKboard meal view
//   /exec                -> JSON read of shared meal plan
//   POST /exec           -> authenticated write from phone input page

const PLAN_KEY = "MEAL_PLANNER_SHARED_STATE";
const WRITE_KEY_PROP = "MEAL_PLANNER_WRITE_KEY";

function doGet(e) {
  const view = ((e.parameter && e.parameter.view) || "").toLowerCase();
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(PLAN_KEY);
  let plan = null;
  try { plan = raw ? JSON.parse(raw) : null; } catch (err) {}

  if (view === "dakboard") {
    return HtmlService.createHtmlOutput(renderDakboard_(plan))
      .setTitle("Meal Planner")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, plan: plan }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const props = PropertiesService.getScriptProperties();
  const expectedKey = props.getProperty(WRITE_KEY_PROP) || "";
  const suppliedKey = (e.parameter && e.parameter.writeKey) || "";

  if (!expectedKey || !constantTimeEqual_(expectedKey, suppliedKey)) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: "unauthorized" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const raw = (e.parameter && e.parameter.data) || "";
    const parsed = JSON.parse(raw);
    props.setProperty(PLAN_KEY, JSON.stringify(parsed));
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: "invalid_data" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function renderDakboard_(plan) {
  const days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  const abbr = {Monday:"Mon",Tuesday:"Tue",Wednesday:"Wed",Thursday:"Thur",Friday:"Fri",Saturday:"Sat",Sunday:"Sun"};
  const start = plan && days.indexOf(plan.start) >= 0 ? plan.start : "Saturday";
  const startIndex = days.indexOf(start);
  const ordered = days.slice(startIndex).concat(days.slice(0,startIndex));

  const rows = ordered.map(function(day) {
    const dinner = plan && plan.meals && plan.meals[day] ? String(plan.meals[day].dinner || "") : "";
    return '<div class="row">' +
      '<div class="day">' + esc_(abbr[day]) + '</div>' +
      '<button type="button" class="meal" data-key="' + escAttr_(day + "-dinner") + '">' + esc_(dinner) + '</button>' +
      '</div>';
  }).join("");

  return '<!doctype html><html><head>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta http-equiv="refresh" content="60">' +
    '<style>' +
    '*{box-sizing:border-box}html,body{margin:0;background:transparent;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#252525}' +
    '.board{width:100%;background:#fff;border-radius:14px;padding:14px 16px}' +
    '.table{width:100%;border:1px solid #e5e5e5;border-radius:10px;overflow:hidden;background:#fff}' +
    '.head,.row{display:grid;grid-template-columns:72px minmax(0,1fr)}' +
    '.row{border-top:1px solid #e5e5e5}' +
    '.head>div{background:#f4f4f4;color:#555;font-weight:800;font-size:28px;padding:10px 12px;text-align:center;border-right:1px solid #e5e5e5}' +
    '.head>div:last-child{border-right:0}' +
    '.day{background:#fafafa;color:#666;font-weight:800;font-size:30px;display:flex;align-items:center;justify-content:center;padding:10px 6px;border-right:1px solid #e5e5e5}' +
    '.meal{min-width:0;min-height:90px;border:0;background:#fff;color:#252525;text-align:left;padding:16px 14px;font:inherit;font-size:56px;line-height:1.08;font-weight:750;white-space:pre-wrap;overflow-wrap:anywhere;cursor:pointer}' +
    '.meal.done{background:#dedede;color:#777}' +
    '.meal:empty{cursor:default}' +
    '@media(max-width:600px){.board{padding:10px}.head,.row{grid-template-columns:58px minmax(0,1fr)}.meal{font-size:44px;min-height:78px;padding:12px 10px}.day{font-size:24px}.head>div{font-size:24px}}' +
    '</style></head><body>' +
    '<main class="board"><section class="table"><div class="head"><div></div><div>Dinner</div></div>' +
    rows +
    '</section></main>' +
    '<script>(function(){var K="mealPlannerDakDoneV1",s={};try{s=JSON.parse(localStorage.getItem(K)||"{}")}catch(e){}' +
    'document.querySelectorAll(".meal").forEach(function(b){var k=b.dataset.key;if(s[k])b.classList.add("done");b.addEventListener("click",function(){if(!b.textContent.trim())return;s[k]=!s[k];try{localStorage.setItem(K,JSON.stringify(s))}catch(e){}b.classList.toggle("done",!!s[k])})});})();<\/script>' +
    '</body></html>';
}

function esc_(value) {
  return String(value == null ? "" : value)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function escAttr_(value) {
  return esc_(value).replace(/"/g,"&quot;");
}

function constantTimeEqual_(a, b) {
  a = String(a || "");
  b = String(b || "");
  let mismatch = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return mismatch === 0;
}
