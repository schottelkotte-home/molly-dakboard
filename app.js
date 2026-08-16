/*
 * DAKboard Sports
 *
 * Display layer for the sports feed. Live data will be connected separately.
 */

const TEAMS = {
  reds: { label: "Reds", logo: "logos/Reds.PNG", kind: "pro" },
  bengals: { label: "Bengals", logo: "logos/Bengals.PNG", kind: "pro" },
  fcc: { label: "FCC", logo: "logos/FCC.PNG", kind: "pro" },
  louisville: { label: "Louisville", logo: "logos/Louisville.png", kind: "college" }
};

const SPORT_LABELS = {
  football: "Football",
  mbb: "MBB",
  wbb: "WBB",
  volleyball: "Volleyball",
  baseball: "Baseball",
  softball: "Softball",
  msoc: "Men's Soccer",
  wsoc: "Women's Soccer"
};

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function gameRow(game) {
  const team = TEAMS[game.team];
  const logo = team?.logo || "";
  const label = team?.kind === "college"
    ? `<span class="sport">${esc(SPORT_LABELS[game.sport] || game.sport)}</span>`
    : "";

  let right = esc(game.time || "");
  if (game.status === "final") {
    const cls = game.result === "W" ? "win" : game.result === "L" ? "loss" : "draw";
    right = `<span class="result ${cls}">${esc(game.result)} ${esc(game.score)}</span>`;
  }

  return `
    <article class="game">
      <div class="logo">
        ${logo ? `<img src="${esc(logo)}" alt="">` : `<span class="logo-fallback">${esc(team?.label?.[0] || "?")}</span>`}
      </div>
      <div class="details">
        <div class="team-line">
          <span class="team-name">${esc(team?.label || "")}</span>${label}
        </div>
        <div class="opponent">${esc(game.home ? "vs " : "@ ")}${esc(game.opponent)}</div>
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

  content.innerHTML = sections.length
    ? sections.join("")
    : `<div class="empty">No games scheduled.</div>`;

  document.getElementById("updated").textContent = `Updated ${new Date().toLocaleTimeString([], {hour: "numeric", minute: "2-digit"})}`;
}

async function loadGames() {
  // Live feed will be connected here next.
  // Keep this empty until real sports data is connected.
  return { yesterday: [], today: [], next: [] };
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
