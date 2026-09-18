// Google Apps Script backend for the Meal Planner.
// Security model:
// - GET is read-only and returns the current meal plan.
// - POST is write-only and requires a private write key.
// - Store the key in Script Properties as MEAL_PLANNER_WRITE_KEY.
// Deploy as Web App: Execute as "Me"; access "Anyone".

const PLAN_KEY = "MEAL_PLANNER_SHARED_STATE";
const WRITE_KEY_PROP = "MEAL_PLANNER_WRITE_KEY";

function doGet(e) {
  const callback = sanitizeCallback_(e.parameter.callback || "callback");
  const raw = PropertiesService.getScriptProperties().getProperty(PLAN_KEY);
  let plan = null;
  try { plan = raw ? JSON.parse(raw) : null; } catch (err) {}
  const result = { ok: true, plan: plan };

  return ContentService
    .createTextOutput(callback + "(" + JSON.stringify(result) + ");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
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

function sanitizeCallback_(name) {
  return /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(name) ? name : "callback";
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
