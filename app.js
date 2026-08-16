/* DAKboard Sports — live schedule/results display */

const TEAMS = {
  reds: { label: "Reds", logo: "logos/Reds.PNG", kind: "pro" },
  bengals: { label: "Bengals", logo: "logos/Bengals.PNG", kind: "pro" },
  fcc: { label: "FCC", logo: "logos/FCC.PNG", kind: "pro" },
  louisville: { label: "Louisville", logo: "logos/Louisville.png", kind: "college" }
};

const FEEDS = [
  { team: "reds", sport: "baseball", league: "mlb", key: "pro" },
  { team: "bengals", sport: "football", league: "nfl", key: "pro" },
  { team: "fcc", sport: "soccer", league: "usa.1", key: "pro" },
  { team: "louisville", sport: "football", league: "college-football", label: "Football" },
  { team: "louisville", sport: "basketball", league: "mens-college-basketball", label: "MBB" },
  { team: "louisville", sport: "basketball", league: "womens-college-basketball", label: "WBB" },
  { team: "louisville", sport: "volleyball", league: "womens-college-volleyball", label: "Volleyball" },
  { team: "louisville", sport: "baseball", league: "college-baseball", label: "Baseball" },
  { team: "louisville", sport: "baseball", league: "college-softball", label: "Softball" },
  { team: "louisville", sport: "soccer", league: "usa.ncaa.m.1", label: "Men's Soccer" },
  { team: "louisville", sport: "soccer", league: "usa.ncaa.w.1", label: "Women's Soccer" }
];

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function localDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function dayKey(date) {
  return date.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function isTargetTeam(team, feed) {
  const text = `${team.displayName || ""} ${team.shortDisplayName || ""} ${team.name || ""} ${team.abbreviation || ""}`.toLowerCase();
  if (feed.team === "reds") return text.includes("cincinnati reds") || team.abbreviation?.toLowerCase() === "cin";
  if (feed.team === "bengals") return text.includes("cincinnati bengals") || team.abbreviation?.toLowerCase() === "cin";
  if (feed.team === "fcc") return text.includes("fc cincinnati") || (text.includes("cincinnati") && text.includes("fc"));
  return text.includes("louisville") || text.includes("cardinals");
}

function opponentFor(competitors, target) {
  return competitors.find(c => c !== target)?.team || {};
}

function scoreOf(competitor) {
  // ESPN normally provides `score` as a string. The fallback handles older
  // responses where only a numeric score or displayValue is exposed.
  if (competitor?.score !== undefined && competitor?.score !== null && competitor.score !== "") {
    return String(competitor.score);
  }
  if (competitor?.displayValue !== undefined) return String(competitor.displayValue);
  if (Array.isArray(competitor?.linescores)) {
    const total = competitor.linescores.reduce((sum, period) => sum + Number(period.value || 0), 0);
    if (Number.isFinite(total)) return String(total);
  }
  return "—";
}

function normalizeEvent(event, feed) {
  const competition = event.competitions?.[0];
  if (!competition) return null;
  const competitors = competition.competitors || [];
  const target = competitors.find(c => isTargetTeam(c.team || {}, feed));
  if (!target) return null;

  const opponent = opponentFor(competitors, target);
  const status = competition.status || event.status || {};
  const type = status.type || {};
  const completed = Boolean(type.completed);
  const postponed = Boolean(type.name === "STATUS_POSTPONED" || type.name === "STATUS_CANCELED");
  const date = new Date(event.date || competition.date);
  if (Number.isNaN(date.getTime())) return null;

  const home = target.homeAway === "home";
  const opponentName = opponent.shortDisplayName || opponent.displayName || opponent.name || "Opponent";
  const targetScore = scoreOf(target);
  const opponentScore = scoreOf(opponent);

  let result = "";
  if (completed) {
    if (target.winner === true) result = "W";
    else if (opponent.winner === true) result = "L";
    else result = "T";
  }

  return {
    id: event.id,
    team: feed.team,
    sport: feed.label || "",
    opponent: opponentName,
    home,
    date,
    dateKey: dayKey(date),
    status: completed ? "final" : postponed ? "postponed" : "scheduled",
    result,
    targetScore,
    opponentScore,
    score: completed ? `${targetScore}–${opponentScore}` : "",
    time: postponed ? (type.name === "STATUS_CANCELED" ? "Canceled" : "Postponed") : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  };
}

async function fetchFeed(feed, start, end) {
  const base = `https://site.api.espn.com/apis/site/v2/sports/${feed.sport}/${feed.league}/scoreboard`;
  const url = `${base}?dates=${localDateKey(start)}-${localDateKey(end)}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${feed.league}: HTTP ${response.status}`);
  const data = await response.json();
  return (data.events || []).map(event => normalizeEvent(event, feed)).filter(Boolean);
}

async function loadGames() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 1);
  const end = new Date(today);
  end.setDate(end.getDate() + 3);

  const results = await Promise.allSettled(FEEDS.map(feed => fetchFeed(feed, start, end)));
  const games = results.flatMap(result => result.status === "fulfilled" ? result.value : []);
  const unique = [...new Map(games.map(game => [game.id, game])).values()];
  unique.sort((a, b) => a.date - b.date);

  const yesterdayKey = dayKey(start);
  const todayKey = dayKey(today);
  const next = unique.filter(game => game.date > new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59));

  return {
    yesterday: unique.filter(game => game.dateKey === yesterdayKey && game.status === "final"),
    today: unique.filter(game => game.dateKey === todayKey),
    next,
    nextLabel: "Next 3 Days"
  };
}

function gameRow(game) {
  const team = TEAMS[game.team];
  const logo = team?.logo || "";
  const label = team?.kind === "college"
    ? `<span class="sport">${esc(game.sport)}</span>`
    : "";

  let right = esc(game.time || "");
  if (game.status === "final") {
    const cls = game.result === "W" ? "win" : game.result === "L" ? "loss" : "draw";
    right = `<span class="result ${cls}">${esc(game.result)} ${esc(game.targetScore)}–${esc(game.opponentScore)}</span>`;
  }

  return `<article class="game">
    <div class="logo"><img src="${esc(logo)}" alt=""></div>
    <div class="details">
      <div class="team-line"><span class="team-name">${esc(team?.label || "")}</span>${label}</div>
      <div class="opponent">${game.home ? "vs " : "@ "}${esc(game.opponent)}</div>
    </div>
    <div class="time">${right}</div>
  </article>`;
}

function renderSection(title, games) {
  if (!games.length) return "";
  return `<section class="day"><h2 class="day-title">${esc(title)}</h2>${games.map(gameRow).join("")}</section>`;
}

function render(games) {
  const content = document.getElementById("sports");
  const sections = [
    renderSection("Yesterday", games.yesterday || []),
    renderSection("Today", games.today || []),
    renderSection(games.nextLabel || "Next", games.next || [])
  ].filter(Boolean);
  content.innerHTML = sections.length ? sections.join("") : `<div class="empty">No games scheduled.</div>`;
  document.getElementById("updated").textContent = `Updated ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

async function refresh() {
  try {
    render(await loadGames());
  } catch (error) {
    console.error(error);
    document.getElementById("sports").innerHTML = `<div class="error">Sports data temporarily unavailable.</div>`;
  }
}

refresh();
setInterval(refresh, 15 * 60 * 1000);
