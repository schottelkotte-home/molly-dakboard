// Google Apps Script backend for the Meal Planner.
// Phone writes securely to Apps Script.
// Apps Script mirrors the latest plan to GitHub as meal-planner/plan.json.
// DAKboard then reads plan.json from GitHub Pages, avoiding Google-session issues.
//
// Required Script Properties:
//   MEAL_PLANNER_WRITE_KEY
//   GITHUB_TOKEN
//
// GitHub token should be a fine-grained PAT limited to:
//   Repository: schottelkotte-home/molly-dakboard
//   Permission: Contents = Read and write
//
// Deploy as Web App: Execute as "Me"; access "Anyone".

const PLAN_KEY = "MEAL_PLANNER_SHARED_STATE";
const WRITE_KEY_PROP = "MEAL_PLANNER_WRITE_KEY";
const GITHUB_TOKEN_PROP = "GITHUB_TOKEN";
const GH_OWNER = "schottelkotte-home";
const GH_REPO = "molly-dakboard";
const GH_PATH = "meal-planner/plan.json";
const GH_BRANCH = "main";

function doGet(e) {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(PLAN_KEY);
  let plan = null;
  try { plan = raw ? JSON.parse(raw) : null; } catch (err) {}

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, plan: plan }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const props = PropertiesService.getScriptProperties();
  const expectedKey = props.getProperty(WRITE_KEY_PROP) || "";
  const suppliedKey = (e.parameter && e.parameter.writeKey) || "";

  if (!expectedKey || !constantTimeEqual_(expectedKey, suppliedKey)) {
    return json_({ ok: false, error: "unauthorized" });
  }

  try {
    const raw = (e.parameter && e.parameter.data) || "";
    const parsed = JSON.parse(raw);

    // Keep a Google-side copy.
    props.setProperty(PLAN_KEY, JSON.stringify(parsed));

    // Mirror the same plan to GitHub for the DAKboard to read.
    const mirror = mirrorPlanToGitHub_(parsed);
    return json_({ ok: mirror.ok, github: mirror });
  } catch (err) {
    return json_({ ok: false, error: "invalid_data", detail: String(err) });
  }
}

function mirrorPlanToGitHub_(plan) {
  const token = PropertiesService.getScriptProperties().getProperty(GITHUB_TOKEN_PROP) || "";
  if (!token) return { ok: false, error: "missing_github_token" };

  const api = "https://api.github.com/repos/" + GH_OWNER + "/" + GH_REPO + "/contents/" + GH_PATH;
  const headers = {
    "Authorization": "Bearer " + token,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };

  let sha = null;
  const existing = UrlFetchApp.fetch(api + "?ref=" + encodeURIComponent(GH_BRANCH), {
    method: "get",
    headers: headers,
    muteHttpExceptions: true
  });

  if (existing.getResponseCode() === 200) {
    try { sha = JSON.parse(existing.getContentText()).sha || null; } catch (err) {}
  } else if (existing.getResponseCode() !== 404) {
    return { ok: false, error: "github_read_failed", status: existing.getResponseCode() };
  }

  const payload = {
    message: "Update shared meal plan",
    content: Utilities.base64Encode(JSON.stringify(plan, null, 2)),
    branch: GH_BRANCH
  };
  if (sha) payload.sha = sha;

  const saved = UrlFetchApp.fetch(api, {
    method: "put",
    headers: headers,
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = saved.getResponseCode();
  if (code === 200 || code === 201) return { ok: true };
  return { ok: false, error: "github_write_failed", status: code, body: saved.getContentText().slice(0,500) };
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
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
