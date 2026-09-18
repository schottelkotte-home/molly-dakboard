// Google Apps Script shared backend for the Meal Planner.
// Deploy as a Web App: Execute as "Me"; access "Anyone".
// Paste the deployment /exec URL into meal-planner/shared-config.js.

const PROP_KEY = "MEAL_PLANNER_SHARED_STATE";

function doGet(e) {
  const action = (e.parameter.action || "load").toLowerCase();
  const callback = sanitizeCallback_(e.parameter.callback || "callback");
  let result;

  if (action === "save") {
    try {
      const raw = e.parameter.data || "";
      const parsed = JSON.parse(raw);
      PropertiesService.getScriptProperties().setProperty(PROP_KEY, JSON.stringify(parsed));
      result = { ok: true };
    } catch (err) {
      result = { ok: false, error: String(err) };
    }
  } else {
    const raw = PropertiesService.getScriptProperties().getProperty(PROP_KEY);
    let plan = null;
    try { plan = raw ? JSON.parse(raw) : null; } catch (err) {}
    result = { ok: true, plan: plan };
  }

  return ContentService
    .createTextOutput(callback + "(" + JSON.stringify(result) + ");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function sanitizeCallback_(name) {
  return /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(name) ? name : "callback";
}
