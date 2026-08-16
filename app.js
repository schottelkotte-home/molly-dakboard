/* DAKboard Sports — live schedule/results display */
const TEAMS = {
  reds: { label: "Reds", logo: "logos/Reds.PNG", kind: "pro" },
  bengals: { label: "Bengals", logo: "logos/Bengals.PNG", kind: "pro" },
  fcc: { label: "FCC", logo: "logos/FCC.PNG", kind: "pro" },
  louisville: { label: "Louisville", logo: "logos/Louisville.png", kind: "college" }
};

const FEEDS = [
  { team: "reds", sport: "baseball", league: "mlb", id: "17", label: "" },
  { team: "bengals", sport: "football", league: "nfl", id: "4", label: "" },
  { team: "fcc", sport: "soccer", league: "usa.1", id: "18267", label: "" },
  { team: "louisville", sport: "football", league: "college-football", id: "97", label: "Football" },
  { team: "louisville", sport: "basketball", league: "mens-college-basketball", id: "97", label: "MBB" },
  { team: "louisville", sport: "basketball", league: "womens-college-basketball", id: "97", label: "WBB" },
  { team: "louisville", sport: "volleyball", league: "womens-college-volleyball", id: "97", label: "Volleyball" },
  { team: "louisville", sport: "baseball", league: "college-baseball", id: "97", label: "Baseball" }
];

const feedErrors = [];

function esc(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function localDateKey(date) { return `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,"0")}${String(date.getDate()).padStart(2,"0")}`; }
function dayKey(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
function scoreOf(c) {
  const raw = c?.score;
  if (raw !== undefined && raw !== null && raw !== "") {
    if (typeof raw === "object") return String(raw.displayValue ?? raw.value ?? "");
    return String(raw);
  }
  return c?.displayValue !== undefined ? String(c.displayValue) : "";
}
function numericScore(v) { if (v === "") return null; const n = Number(v); return Number.isFinite(n) ? n : null; }

function normalizeEvent(event, feed) {
  const competition = event.competitions?.[0];
  if (!competition) return null;
  const competitors = competition.competitors || [];
  const target = competitors.find(c => String(c.team?.id) === String(feed.id));
  if (!target) return null;
  const opponentEntry = competitors.find(c => c !== target);
  const opponent = opponentEntry?.team || {};
  const type = (competition.status || event.status || {}).type || {};
  const completed = Boolean(type.completed);
  const canceled = type.name === "STATUS_CANCELED";
  const postponed = type.name === "STATUS_POSTPONED";
  const date = new Date(event.date || competition.date);
  if (Number.isNaN(date.getTime())) return null;
  const targetScore = scoreOf(target), opponentScore = scoreOf(opponentEntry);
  const a = numericScore(targetScore), b = numericScore(opponentScore);
  let result = "";
  if (completed && a !== null && b !== null) result = a > b ? "W" : a < b ? "L" : "T";
  else if (completed && target.winner === true) result = "W";
  else if (completed && opponentEntry?.winner === true) result = "L";
  return {
    id: `${feed.team}-${feed.sport}-${event.id}`, team: feed.team, sport: feed.label || "",
    opponent: opponent.shortDisplayName || opponent.displayName || opponent.name || "Opponent",
    home: target.homeAway === "home", date, dateKey: dayKey(date),
    status: completed ? "final" : canceled ? "canceled" : postponed ? "postponed" : "scheduled",
    result, targetScore, opponentScore,
    time: canceled ? "Canceled" : postponed ? "Postponed" : completed ? "Final" : date.toLocaleTimeString([], {hour:"numeric", minute:"2-digit"})
  };
}

async function fetchFeed(feed, start, end) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${feed.sport}/${feed.league}/teams/${feed.id}/schedule?dates=${localDateKey(start)}-${localDateKey(end)}`;
  const response = await fetch(url, {cache:"no-store"});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  return (data.events || []).map(e => normalizeEvent(e, feed)).filter(Boolean);
}

async function loadGames() {
  feedErrors.length = 0;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 23, 59, 59, 999);
  const results = await Promise.all(FEEDS.map(async feed => {
    try { return await fetchFeed(feed, start, end); }
    catch (error) { feedErrors.push(`${feed.team}/${feed.label || feed.sport}: ${error.message}`); return []; }
  }));
  const unique = [...new Map(results.flat().filter(g => g.date >= start && g.date <= end).map(g => [g.id,g])).values()];
  unique.sort((a,b) => a.date-b.date);
  const yesterdayKey = dayKey(start), todayKey = dayKey(today), tomorrow = new Date(today.getFullYear(),today.getMonth(),today.getDate()+1), tomorrowKey = dayKey(tomorrow);
  return {
    yesterday: unique.filter(g => g.dateKey === yesterdayKey && g.status === "final"),
    today: unique.filter(g => g.dateKey === todayKey),
    tomorrow: unique.filter(g => g.dateKey === tomorrowKey)
  };
}

function gameRow(game) {
  const team = TEAMS[game.team];
  const label = team?.kind === "college" ? `<span class="sport">${esc(game.sport)}</span>` : "";
  let right = esc(game.time || "");
  if (game.status === "final") {
    const cls = game.result === "W" ? "win" : game.result === "L" ? "loss" : "draw";
    const score = game.targetScore !== "" && game.opponentScore !== "" ? `${game.targetScore}–${game.opponentScore}` : "Score unavailable";
    right = `<span class="result ${cls}">${esc(game.result || "FINAL")} ${esc(score)}</span>`;
  }
  return `<article class="game"><div class="logo"><img src="${esc(team?.logo || "")}" alt=""></div><div class="details"><div class="team-line"><span class="team-name">${esc(team?.label || "")}</span>${label}<span class="opponent-inline">${game.home ? "vs" : "@"} ${esc(game.opponent)}</span></div></div><div class="time">${right}</div></article>`;
}
function renderSection(title,games) { return games.length ? `<section class="day"><h2 class="day-title">${esc(title)}</h2>${games.map(gameRow).join("")}</section>` : ""; }
function render(games) {
  const content = document.getElementById("sports");
  const sections = [renderSection("Yesterday",games.yesterday),renderSection("Today",games.today),renderSection("Tomorrow",games.tomorrow)];
  if (feedErrors.length) sections.push(`<section class="day diagnostics"><h2 class="day-title">Feed diagnostics</h2><div class="error">${feedErrors.map(esc).join("<br>")}</div></section>`);
  content.innerHTML = sections.filter(Boolean).join("") || `<div class="empty">No games scheduled.</div>`;
  document.getElementById("updated").textContent = "BUILD 5C2A91D";
}
async function refresh(){ try { render(await loadGames()); } catch(error) { console.error(error); document.getElementById("sports").innerHTML=`<div class="error">Sports data temporarily unavailable.</div>`; } }
refresh(); setInterval(refresh,15*60*1000);
