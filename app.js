const IMAGE_SRC = "./assets/pool.jpg";
const SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

const defaults = {
  home: "SEA",
  away: "NE",
  topTeam: "SEA",
  leftTeam: "NE",
  date: "20260208",
  eventId: "",
  topDigits: "4,3,7,2,8,6,5,1,0,9",
  leftDigits: "7,3,8,2,0,9,4,1,6,5",
  interval: "20",
  gridX: "16",
  gridY: "19",
  gridW: "74",
  gridH: "71",
  swapDigits: "0",
};

const el = (id) => document.getElementById(id);
const statusEl = el("status");
const summaryEl = el("summary");
const poolImage = el("poolImage");
const highlights = el("highlights");
const gridOverlay = el("gridOverlay");
const configPanel = el("configPanel");

let pollTimer = null;

function parseDigits(value) {
  const digits = value
    .split(/[,\s]+/)
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => Number(d));
  if (digits.length !== 10 || digits.some((d) => Number.isNaN(d))) {
    return null;
  }
  return digits;
}

function readConfig() {
  const params = new URLSearchParams(window.location.search);
  return {
    home: params.get("home") || defaults.home,
    away: params.get("away") || defaults.away,
    topTeam: params.get("topTeam") || defaults.topTeam,
    leftTeam: params.get("leftTeam") || defaults.leftTeam,
    date: params.get("date") || defaults.date,
    eventId: params.get("eventId") || defaults.eventId,
    topDigits: params.get("topDigits") || defaults.topDigits,
    leftDigits: params.get("leftDigits") || defaults.leftDigits,
    interval: params.get("interval") || defaults.interval,
    gridX: params.get("gridX") || defaults.gridX,
    gridY: params.get("gridY") || defaults.gridY,
    gridW: params.get("gridW") || defaults.gridW,
    gridH: params.get("gridH") || defaults.gridH,
    swapDigits: params.get("swapDigits") || defaults.swapDigits,
  };
}

function populateForm(config) {
  el("home").value = config.home;
  el("away").value = config.away;
  el("topTeam").value = config.topTeam;
  el("leftTeam").value = config.leftTeam;
  el("date").value = config.date;
  el("eventId").value = config.eventId;
  el("topDigits").value = config.topDigits;
  el("leftDigits").value = config.leftDigits;
  el("interval").value = config.interval;
  el("gridX").value = config.gridX;
  el("gridY").value = config.gridY;
  el("gridW").value = config.gridW;
  el("gridH").value = config.gridH;
  el("swapDigits").checked = config.swapDigits === "1";
}

function writeConfigToUrl(config) {
  const params = new URLSearchParams(config);
  const next = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, "", next);
}

function applyGrid(config) {
  const x = Number(config.gridX);
  const y = Number(config.gridY);
  const w = Number(config.gridW);
  const h = Number(config.gridH);

  gridOverlay.style.left = `${x}%`;
  gridOverlay.style.top = `${y}%`;
  gridOverlay.style.width = `${w}%`;
  gridOverlay.style.height = `${h}%`;
}

function highlightCell(config, rowIndex, colIndex, label, isFinal) {
  const gridX = Number(config.gridX);
  const gridY = Number(config.gridY);
  const gridW = Number(config.gridW);
  const gridH = Number(config.gridH);

  const cellW = gridW / 10;
  const cellH = gridH / 10;

  const left = gridX + colIndex * cellW;
  const top = gridY + rowIndex * cellH;

  const box = document.createElement("div");
  box.className = `highlight ${isFinal ? "gold" : "red"}`;
  box.style.left = `${left}%`;
  box.style.top = `${top}%`;
  box.style.width = `${cellW}%`;
  box.style.height = `${cellH}%`;

  const badge = document.createElement("div");
  badge.className = "label";
  badge.textContent = label;
  box.appendChild(badge);

  highlights.appendChild(box);
}

function setStatus(text) {
  statusEl.textContent = text;
}

function setSummary(lines) {
  summaryEl.innerHTML = lines.join("<br />");
}

async function fetchScoreboard(config) {
  const params = new URLSearchParams();
  if (config.date) {
    params.set("dates", config.date);
  }
  const url = params.toString() ? `${SCOREBOARD_URL}?${params}` : SCOREBOARD_URL;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Scoreboard request failed (${res.status})`);
  }
  return res.json();
}

function findEvent(data, config) {
  if (!data || !Array.isArray(data.events)) return null;

  if (config.eventId) {
    return data.events.find((event) => event.id === config.eventId) || null;
  }

  const home = config.home.toUpperCase();
  const away = config.away.toUpperCase();

  return (
    data.events.find((event) => {
      const competition = event.competitions && event.competitions[0];
      if (!competition) return false;
      const competitors = competition.competitors || [];
      const abbreviations = competitors.map((c) => c.team?.abbreviation?.toUpperCase());
      return abbreviations.includes(home) && abbreviations.includes(away);
    }) || null
  );
}

function sumLinescores(linescores, quarter) {
  return linescores.slice(0, quarter).reduce((sum, item) => sum + Number(item.value || 0), 0);
}

function getQuarterTotals(event, config) {
  const competition = event.competitions[0];
  const competitors = competition.competitors;

  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");

  const topAbbrev = (config.topTeam || config.home || "").toUpperCase();
  const leftAbbrev = (config.leftTeam || config.away || "").toUpperCase();

  const topTeam = competitors.find(
    (c) => c.team?.abbreviation?.toUpperCase() === topAbbrev
  );
  const leftTeam = competitors.find(
    (c) => c.team?.abbreviation?.toUpperCase() === leftAbbrev
  );

  const topLines = topTeam?.linescores || [];
  const leftLines = leftTeam?.linescores || [];

  const period = competition.status?.period || 0;
  const isFinal = competition.status?.type?.completed;

  const quarters = [1, 2, 3, 4].map((q) => {
    const available = isFinal || period > q;
    return {
      quarter: q,
      available,
      topTotal: available ? sumLinescores(topLines, q) : null,
      leftTotal: available ? sumLinescores(leftLines, q) : null,
    };
  });

  return { quarters, home, away, topTeam, leftTeam, period, isFinal };
}

function renderHighlights(config, data) {
  highlights.innerHTML = "";

  const event = findEvent(data, config);
  if (!event) {
    setStatus("Game not found. Check team abbreviations or date.");
    return;
  }

  const { quarters, home, away, topTeam, leftTeam, period, isFinal } = getQuarterTotals(
    event,
    config
  );
  if (!topTeam || !leftTeam) {
    setStatus("Grid teams not found. Check Top/Left team abbreviations.");
    return;
  }

  const topDigits = parseDigits(config.topDigits);
  const leftDigits = parseDigits(config.leftDigits);
  if (!topDigits || !leftDigits) {
    setStatus("Digit rows must each contain 10 numbers.");
    return;
  }

  const lines = [];
  const awayScore = away?.score ?? "-";
  const homeScore = home?.score ?? "-";
  const topScore = topTeam?.score ?? "-";
  const leftScore = leftTeam?.score ?? "-";

  lines.push(`${away.team.displayName} @ ${home.team.displayName}`);
  lines.push(`Score: ${away.team.displayName} ${awayScore} — ${home.team.displayName} ${homeScore}`);
  if (topTeam && leftTeam) {
    lines.push(
      `Grid teams: ${leftTeam.team.displayName} ${leftScore} — ${topTeam.team.displayName} ${topScore}`
    );
  }
  lines.push(`Status: ${event.status?.type?.shortDetail || ""}`);

  quarters.forEach((qInfo) => {
    if (!qInfo.available) {
      lines.push(`Q${qInfo.quarter}: in progress`);
      return;
    }
    const topDigit = qInfo.topTotal % 10;
    const leftDigit = qInfo.leftTotal % 10;
    const swap = config.swapDigits === "1";
    const rowDigit = swap ? topDigit : leftDigit;
    const colDigit = swap ? leftDigit : topDigit;
    const row = leftDigits.indexOf(rowDigit);
    const col = topDigits.indexOf(colDigit);

    if (row === -1 || col === -1) {
      lines.push(`Q${qInfo.quarter}: digits not found`);
      return;
    }

    const label = `Q${qInfo.quarter} ${leftDigit}-${topDigit}`;
    highlightCell(config, row, col, label, qInfo.quarter === 4);
    lines.push(`Q${qInfo.quarter}: ${leftDigit}-${topDigit}`);
  });

  lines.push(`Last updated: ${new Date().toLocaleString()}`);
  setSummary(lines);
  setStatus(
    isFinal
      ? "Game complete. Final quarter highlighted in gold."
      : `Tracking live — period ${period}`
  );
}

async function refresh(config) {
  try {
    const data = await fetchScoreboard(config);
    renderHighlights(config, data);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
}

function getConfigFromForm() {
  return {
    home: el("home").value.trim(),
    away: el("away").value.trim(),
    topTeam: el("topTeam").value.trim(),
    leftTeam: el("leftTeam").value.trim(),
    date: el("date").value.trim(),
    eventId: el("eventId").value.trim(),
    topDigits: el("topDigits").value.trim(),
    leftDigits: el("leftDigits").value.trim(),
    interval: el("interval").value.trim(),
    gridX: el("gridX").value.trim(),
    gridY: el("gridY").value.trim(),
    gridW: el("gridW").value.trim(),
    gridH: el("gridH").value.trim(),
    swapDigits: el("swapDigits").checked ? "1" : "0",
  };
}

function startPolling(config) {
  if (pollTimer) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }

  const interval = Math.max(10, Number(config.interval) || 20) * 1000;
  refresh(config);
  pollTimer = window.setInterval(() => refresh(config), interval);
}

function updateFromForm() {
  const config = getConfigFromForm();
  writeConfigToUrl(config);
  applyGrid(config);
  startPolling(config);
}

function toggleGrid() {
  gridOverlay.classList.toggle("hidden");
}

function copyShareLink() {
  navigator.clipboard.writeText(window.location.href).then(
    () => setStatus("Share link copied."),
    () => setStatus("Could not copy link.")
  );
}

function init() {
  poolImage.src = IMAGE_SRC;
  const config = readConfig();
  populateForm(config);
  applyGrid(config);
  startPolling(config);

  const params = new URLSearchParams(window.location.search);
  const isAdmin = params.get("admin") === "1";
  if (!isAdmin) {
    configPanel.classList.add("hidden");
  }

  el("apply").addEventListener("click", updateFromForm);
  el("toggleGrid").addEventListener("click", toggleGrid);
  el("share").addEventListener("click", copyShareLink);
}

init();
