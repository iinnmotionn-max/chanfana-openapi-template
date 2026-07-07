// Lumi — the creator's multi-realm intellect. A self-contained Creator Cockpit:
// no CDNs, no build step. Reads /analytics/overview, renders inline SVG charts,
// and gives the creator direct controls over four realms:
// Invest (paper-trading colony), Guardian (protection), Tech (diagnostics), Wellness (check-ins).
// Palette: validated dark-surface steps (see docs/BLUEPRINT.md build rules).

export const dashHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lumi — Creator Cockpit</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><circle cx=%228%22 cy=%228%22 r=%227%22 fill=%22%233987e5%22/></svg>">
<style>
  :root {
    --page: #0d0d0d;
    --surface: #1a1a19;
    --ink: #ffffff;
    --ink-2: #c3c2b7;
    --muted: #898781;
    --grid: #2c2c2a;
    --baseline: #383835;
    --border: rgba(255,255,255,0.10);
    --series-1: #3987e5;   /* blue  — equity, primary series */
    --series-2: #199e70;   /* aqua  — secondary accents */
    --good: #0ca30c;
    --critical: #d03b3b;
    --warning: #fab219;
  }
  * { box-sizing: border-box; margin: 0; }
  body {
    background: var(--page); color: var(--ink);
    font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
    padding: 20px; max-width: 1180px; margin: 0 auto;
  }
  header { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
  header h1 { font-size: 20px; font-weight: 650; letter-spacing: 0.2px; }
  header .sub { color: var(--muted); font-size: 13px; }
  .controls { margin-left: auto; display: flex; gap: 8px; flex-wrap: wrap; }
  button {
    background: var(--surface); color: var(--ink); border: 1px solid var(--border);
    border-radius: 8px; padding: 7px 14px; font: inherit; font-size: 13px; cursor: pointer;
  }
  button:hover { border-color: var(--series-1); }
  button:disabled { opacity: 0.5; cursor: wait; }
  .agents { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
  .agent {
    background: var(--surface); border: 1px solid var(--border); border-radius: 999px;
    padding: 4px 12px; font-size: 12px; color: var(--ink-2); display: flex; align-items: center; gap: 7px;
  }
  .agent .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--good); }
  .agent b { color: var(--ink); font-weight: 600; text-transform: capitalize; }
  .realms { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
  @media (max-width: 1000px) { .realms { grid-template-columns: 1fr 1fr; } }
  @media (max-width: 560px) { .realms { grid-template-columns: 1fr; } }
  .realm { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; min-width: 0; }
  .realm .top { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 4px; }
  .realm .name { font-weight: 600; font-size: 13px; }
  .realm .mission { color: var(--muted); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .realm .meta { font-size: 11px; color: var(--ink-2); margin-top: 8px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .realm .meta .mutedtxt { color: var(--muted); }
  .section-h { font-size: 12px; font-weight: 600; letter-spacing: 1px; color: var(--muted); margin: 4px 0 10px; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 16px; }
  .tile { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; }
  .tile .label { color: var(--muted); font-size: 12px; margin-bottom: 4px; }
  .tile .value { font-size: 24px; font-weight: 650; }
  .tile .delta { font-size: 12px; margin-top: 2px; }
  .up { color: var(--good); } .down { color: var(--critical); }
  .grid2 { display: grid; grid-template-columns: 3fr 2fr; gap: 10px; margin-bottom: 16px; }
  .grid2b { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
  .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 16px; }
  @media (max-width: 860px) { .grid2, .grid2b, .grid3 { grid-template-columns: 1fr; } }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; overflow: hidden; }
  .card h2 { font-size: 13px; font-weight: 600; color: var(--ink-2); margin-bottom: 10px; letter-spacing: 0.3px; }
  .chart-wrap { position: relative; }
  .tooltip {
    position: absolute; pointer-events: none; display: none; z-index: 2;
    background: var(--page); border: 1px solid var(--border); border-radius: 8px;
    padding: 6px 10px; font-size: 12px; color: var(--ink-2); white-space: nowrap;
  }
  .tooltip b { color: var(--ink); }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; color: var(--muted); font-weight: 500; font-size: 12px; padding: 4px 8px; border-bottom: 1px solid var(--grid); }
  td { padding: 6px 8px; border-bottom: 1px solid var(--grid); color: var(--ink-2); font-variant-numeric: tabular-nums; }
  td:first-child { color: var(--ink); }
  tr:last-child td { border-bottom: none; }
  .pill { font-size: 11px; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--border); color: var(--muted); }
  .pill.active { color: var(--good); border-color: var(--good); }
  .pill.retired, .pill.paused { color: var(--muted); }
  .pill.nominal, .pill.pass { color: var(--good); border-color: var(--good); }
  .pill.watch, .pill.warn { color: var(--warning); border-color: var(--warning); }
  .pill.alert, .pill.fail { color: var(--critical); border-color: var(--critical); }
  .feed { display: flex; flex-direction: column; gap: 10px; max-height: 320px; overflow-y: auto; }
  .report { border-left: 2px solid var(--series-1); padding-left: 10px; }
  .report.learning { border-left-color: var(--series-2); }
  .report.milestone { border-left-color: var(--warning); }
  .report .who { font-size: 11px; color: var(--muted); text-transform: capitalize; }
  .report .title { font-size: 13px; font-weight: 600; }
  .report .body { font-size: 12px; color: var(--ink-2); }
  .checks { display: flex; flex-direction: column; max-height: 320px; overflow-y: auto; }
  .check { padding: 7px 0; border-bottom: 1px solid var(--grid); }
  .check:last-child { border-bottom: none; }
  .check .row { display: flex; align-items: baseline; gap: 8px; font-size: 13px; flex-wrap: wrap; }
  .check .row b { font-weight: 600; }
  .check .crealm { font-size: 11px; color: var(--muted); text-transform: capitalize; }
  .check .ctime { font-size: 11px; color: var(--muted); margin-left: auto; }
  .check .cdetail { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .kv { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; padding: 5px 0; border-bottom: 1px solid var(--grid); }
  .kv:last-child { border-bottom: none; }
  .kv .k { color: var(--muted); }
  .kv .v { color: var(--ink); font-variant-numeric: tabular-nums; }
  .wl-last { font-size: 13px; }
  .wl-last b { font-weight: 600; }
  .wl-note-txt { font-size: 12px; color: var(--ink-2); }
  .wl-when, .wl-count { font-size: 12px; color: var(--muted); }
  .wl-avg { font-size: 12px; color: var(--ink-2); margin-top: 4px; }
  .wl-form { margin-top: 12px; border-top: 1px solid var(--grid); padding-top: 10px; }
  .wl-row { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
  .wl-label { font-size: 12px; color: var(--muted); width: 46px; }
  .seg { display: flex; gap: 6px; }
  .seg button { padding: 5px 0; width: 34px; text-align: center; }
  .seg button.sel { border-color: var(--series-1); color: var(--ink); }
  .wl-form input {
    background: var(--page); color: var(--ink); border: 1px solid var(--border);
    border-radius: 8px; padding: 7px 10px; font: inherit; font-size: 13px; width: 100%; margin-top: 10px;
  }
  .wl-form input::placeholder { color: var(--muted); }
  #btn-checkin { margin-top: 10px; }
  .goal { margin-bottom: 12px; }
  .goal .row { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; }
  .goal .detail { font-size: 12px; color: var(--muted); }
  .bar-track { height: 5px; background: var(--grid); border-radius: 4px; margin-top: 5px; }
  .bar-fill { height: 100%; background: var(--series-1); border-radius: 4px; transition: width 0.6s; }
  .goal.done .bar-fill { background: var(--good); }
  .goal-realm { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.6px; margin: 12px 0 8px; }
  .goal-realm:first-child { margin-top: 0; }
  .empty { color: var(--muted); font-size: 13px; padding: 12px 0; }
  footer { color: var(--muted); font-size: 12px; text-align: center; padding: 12px 0 4px; }
  svg text { font: 11px system-ui, sans-serif; fill: var(--muted); }
</style>
</head>
<body>
<header>
  <h1>Lumi · Creator Cockpit</h1>
  <span class="sub" id="status">connecting to Reg…</span>
  <div class="controls">
    <button id="btn-seed">Seed colony</button>
    <button id="btn-run">Run + learn</button>
    <button id="btn-learn">Learn</button>
    <button id="btn-audit">Audit ledger</button>
    <button id="btn-sweep">Protection sweep</button>
  </div>
</header>

<div class="agents" id="agents"></div>
<div class="realms" id="realms"></div>

<div class="section-h">INVEST REALM</div>
<div class="tiles" id="tiles"></div>

<div class="grid2">
  <div class="card">
    <h2>COLONY EQUITY — paper capital over market ticks</h2>
    <div class="chart-wrap">
      <svg id="equity-chart" width="100%" height="240" viewBox="0 0 640 240" preserveAspectRatio="none" role="img" aria-label="Colony equity line chart"></svg>
      <div class="tooltip" id="equity-tip"></div>
    </div>
  </div>
  <div class="card">
    <h2>WIN RATE BY STRATEGY — closed trades only</h2>
    <div class="chart-wrap">
      <svg id="winrate-chart" width="100%" height="240" viewBox="0 0 420 240" role="img" aria-label="Win rate by strategy bar chart"></svg>
      <div class="tooltip" id="winrate-tip"></div>
    </div>
  </div>
</div>

<div class="grid2b">
  <div class="card">
    <h2>BOTS — sized by soul, compounding by results</h2>
    <div style="overflow-x:auto"><table id="bots-table">
      <thead><tr><th>Bot</th><th>Strategy</th><th>Balance</th><th>PnL</th><th>W/L</th><th>Win %</th><th>Status</th></tr></thead>
      <tbody></tbody>
    </table></div>
  </div>
  <div class="card">
    <h2>OBSERVER &amp; REPORTER — live feed, all realms</h2>
    <div class="feed" id="feed"></div>
  </div>
</div>

<div class="grid2b">
  <div class="card">
    <h2>STRATEGIES — lineage &amp; evidence</h2>
    <div style="overflow-x:auto"><table id="strategies-table">
      <thead><tr><th>Strategy</th><th>Gen</th><th>Trades</th><th>Win %</th><th>Net PnL</th><th>Status</th></tr></thead>
      <tbody></tbody>
    </table></div>
  </div>
  <div class="card">
    <h2>GOALS — the roadmap, across realms</h2>
    <div id="goals"></div>
  </div>
</div>

<div class="section-h">GUARDIAN · TECH · WELLNESS</div>
<div class="grid3">
  <div class="card">
    <h2>GUARDIAN — protection checks</h2>
    <div class="checks" id="checks"></div>
  </div>
  <div class="card">
    <h2>TECH — diagnostics</h2>
    <div id="tech"></div>
  </div>
  <div class="card">
    <h2>WELLNESS — creator check-ins</h2>
    <div id="wellness-info"></div>
    <div class="wl-form">
      <div class="wl-row"><span class="wl-label">Mood</span><div class="seg" id="mood-seg"></div></div>
      <div class="wl-row"><span class="wl-label">Energy</span><div class="seg" id="energy-seg"></div></div>
      <input id="wl-note" type="text" maxlength="500" placeholder="Note (optional)">
      <button id="btn-checkin">Check in</button>
    </div>
  </div>
</div>

<footer>Lumi (front-end intellect) · Reg (engine) · Databank (memory) — four realms: Invest · Guardian · Tech · Wellness. Paper trading only, every trade recorded, every lesson kept.</footer>

<script>
const $ = (id) => document.getElementById(id);
const fmt = (n, d = 2) => Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (n) => (n * 100).toFixed(1) + "%";
let equityPoints = [];

async function load() {
  try {
    const res = await fetch("/analytics/overview");
    const { result } = await res.json();
    render(result || {});
    const tick = result && result.colony ? result.colony.tick : "—";
    $("status").textContent = "live · tick " + tick + " · updated " + new Date().toLocaleTimeString();
  } catch (e) {
    $("status").textContent = "Reg unreachable — retrying…";
  }
}

function render(d) {
  renderAgents(d.agents || []);
  renderRealms(d.realms || []);
  renderTiles(d.colony || {});
  renderEquity(d.equityCurve || []);
  renderWinRates((d.strategies || []).filter(s => s.status === "active"));
  renderBots(d.bots || []);
  renderFeed(d.reports || []);
  renderStrategies(d.strategies || []);
  renderGoals(d.goals || []);
  renderChecks(d.checks || []);
  renderTech(d);
  renderWellness(d.wellness || {});
}

function renderAgents(agents) {
  $("agents").innerHTML = agents.map(a =>
    '<span class="agent"><span class="dot"></span><b>' + esc(a.name) + '</b> ' + esc(a.role) + '</span>'
  ).join("");
}

function renderRealms(realms) {
  const el = $("realms");
  if (!realms.length) { el.innerHTML = ""; el.style.display = "none"; return; }
  el.style.display = "";
  el.innerHTML = realms.map(r => {
    const lc = r.latestCheck;
    const goals = Number(r.openGoals) || 0;
    return '<div class="realm">' +
      '<div class="top"><span class="name">' + esc(r.title || r.key) + '</span>' +
      '<span class="pill ' + esc(r.status || "") + '">' + esc(r.status || "unknown") + '</span></div>' +
      '<div class="mission" title="' + esc(r.mission) + '">' + esc(r.mission) + '</div>' +
      '<div class="meta">' +
      (lc
        ? '<span>' + esc(lc.name) + '</span><span class="pill ' + esc(lc.status || "") + '">' + esc(lc.status || "?") + '</span>'
        : '<span class="mutedtxt">no checks yet</span>') +
      '<span>' + goals + ' open goal' + (goals === 1 ? "" : "s") + '</span>' +
      '</div></div>';
  }).join("");
}

function renderTiles(c) {
  const pnl = Number(c.pnl) || 0;
  const pnlCls = pnl >= 0 ? "up" : "down";
  const pnlSign = pnl >= 0 ? "▲ +" : "▼ ";
  $("tiles").innerHTML =
    tile("Colony equity", "$" + fmt(c.equity || 0), '<span class="' + pnlCls + '">' + pnlSign + fmt(pnl) + "</span>") +
    tile("Win rate", pct(c.winRate || 0), (c.closedTrades || 0) + " closed trades") +
    tile("Open positions", c.openTrades || 0, "across all bots") +
    tile("Market tick", (c.tick || 0).toLocaleString(), "simulated tape") +
    tile("Starting capital", "$" + fmt(c.startingEquity || 0, 0), "paper only");
}
function tile(label, value, delta) {
  return '<div class="tile"><div class="label">' + label + '</div><div class="value">' + value + '</div><div class="delta">' + (delta || "") + "</div></div>";
}

function renderEquity(curve) {
  const svg = $("equity-chart");
  equityPoints = [];
  if (!curve || curve.length < 2) { svg.innerHTML = '<text x="20" y="120">No closed trades yet — run a cycle.</text>'; return; }
  const W = 640, H = 240, padL = 52, padR = 12, padT = 12, padB = 24;
  const xs = curve.map(p => p.tick), ys = curve.map(p => p.equity);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const ySpan = (yMax - yMin) || 1, xSpan = (xMax - xMin) || 1;
  const X = t => padL + ((t - xMin) / xSpan) * (W - padL - padR);
  const Y = v => padT + (1 - (v - yMin) / ySpan) * (H - padT - padB);
  let grid = "", labels = "";
  for (let i = 0; i <= 3; i++) {
    const v = yMin + (ySpan * i) / 3, y = Y(v);
    grid += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y + '" y2="' + y + '" stroke="var(--grid)" stroke-width="1"/>';
    labels += '<text x="' + (padL - 6) + '" y="' + (y + 4) + '" text-anchor="end">$' + Math.round(v).toLocaleString() + "</text>";
  }
  const path = curve.map((p, i) => (i ? "L" : "M") + X(p.tick).toFixed(1) + " " + Y(p.equity).toFixed(1)).join(" ");
  const base = Y(curve[0].equity);
  svg.innerHTML = grid + labels +
    '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + base + '" y2="' + base + '" stroke="var(--baseline)" stroke-dasharray="3 4" stroke-width="1"/>' +
    '<path d="' + path + '" fill="none" stroke="var(--series-1)" stroke-width="2" vector-effect="non-scaling-stroke"/>' +
    '<circle id="eq-dot" r="4" fill="var(--series-1)" stroke="var(--surface)" stroke-width="2" style="display:none"/>' +
    '<line id="eq-cross" y1="' + padT + '" y2="' + (H - padB) + '" stroke="var(--baseline)" stroke-width="1" style="display:none"/>';
  equityPoints = curve.map(p => ({ x: X(p.tick), y: Y(p.equity), tick: p.tick, equity: p.equity }));
}

$("equity-chart").addEventListener("mousemove", (e) => {
  if (!equityPoints.length) return;
  const svg = $("equity-chart"), rect = svg.getBoundingClientRect();
  const mx = ((e.clientX - rect.left) / rect.width) * 640;
  let best = equityPoints[0];
  for (const p of equityPoints) if (Math.abs(p.x - mx) < Math.abs(best.x - mx)) best = p;
  const dot = $("eq-dot"), cross = $("eq-cross"), tip = $("equity-tip");
  dot.style.display = cross.style.display = "block";
  dot.setAttribute("cx", best.x); dot.setAttribute("cy", best.y);
  cross.setAttribute("x1", best.x); cross.setAttribute("x2", best.x);
  tip.style.display = "block";
  tip.innerHTML = "tick <b>" + best.tick.toLocaleString() + "</b><br>equity <b>$" + fmt(best.equity) + "</b>";
  const px = (best.x / 640) * rect.width;
  tip.style.left = Math.min(px + 12, rect.width - 130) + "px";
  tip.style.top = (best.y / 240) * rect.height - 14 + "px";
});
$("equity-chart").addEventListener("mouseleave", () => {
  $("equity-tip").style.display = "none";
  const dot = $("eq-dot"), cross = $("eq-cross");
  if (dot) dot.style.display = "none";
  if (cross) cross.style.display = "none";
});

function renderWinRates(strategies) {
  const svg = $("winrate-chart");
  if (!strategies.length) { svg.innerHTML = '<text x="20" y="120">No active strategies — seed the colony.</text>'; return; }
  const W = 420, H = 240, padL = 8, padR = 60, rowH = Math.min(44, (H - 16) / strategies.length);
  const barH = Math.min(16, rowH - 22);
  let out = "";
  strategies.forEach((s, i) => {
    const y = 10 + i * rowH;
    const w = Math.max(2, s.winRate * (W - padL - padR));
    out += '<text x="' + padL + '" y="' + (y + 10) + '" fill="var(--ink-2)">' + esc(s.name) + "</text>";
    out += '<rect x="' + padL + '" y="' + (y + 16) + '" width="' + (W - padL - padR) + '" height="' + barH + '" rx="4" fill="var(--grid)"/>';
    out += '<rect class="wr-bar" data-i="' + i + '" x="' + padL + '" y="' + (y + 16) + '" width="' + w + '" height="' + barH + '" rx="4" fill="var(--series-1)"/>';
    out += '<text x="' + (padL + (W - padL - padR) + 8) + '" y="' + (y + 16 + barH - 3) + '" fill="var(--ink)">' + pct(s.winRate) + "</text>";
  });
  svg.innerHTML = out;
  svg.querySelectorAll(".wr-bar").forEach(bar => {
    bar.addEventListener("mousemove", (e) => {
      const s = strategies[Number(bar.dataset.i)];
      const tip = $("winrate-tip"), rect = svg.getBoundingClientRect();
      tip.style.display = "block";
      tip.innerHTML = "<b>" + esc(s.name) + "</b> · " + s.closed + " trades<br>win " + pct(s.winRate) + " · net $" + fmt(s.totalPnl);
      tip.style.left = Math.min(e.clientX - rect.left + 12, rect.width - 160) + "px";
      tip.style.top = (e.clientY - rect.top - 10) + "px";
    });
    bar.addEventListener("mouseleave", () => { $("winrate-tip").style.display = "none"; });
  });
}

function renderBots(bots) {
  const tbody = $("bots-table").querySelector("tbody");
  if (!bots.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">No bots yet — seed the colony.</td></tr>'; return; }
  tbody.innerHTML = bots.map(b => {
    const pnl = b.balance - b.starting_balance;
    return "<tr><td>" + esc(b.name) + "</td><td>" + esc(b.strategy) + "</td><td>$" + fmt(b.balance) +
      '</td><td class="' + (pnl >= 0 ? "up" : "down") + '">' + (pnl >= 0 ? "+" : "") + fmt(pnl) +
      "</td><td>" + b.wins + "/" + b.losses + "</td><td>" + pct(b.winRate) +
      '</td><td><span class="pill ' + b.status + '">' + b.status + "</span></td></tr>";
  }).join("");
}

function renderStrategies(strategies) {
  const tbody = $("strategies-table").querySelector("tbody");
  if (!strategies.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">No strategies yet.</td></tr>'; return; }
  tbody.innerHTML = strategies.map(s =>
    "<tr><td>" + esc(s.name) + "</td><td>g" + s.generation + "</td><td>" + s.closed + "</td><td>" + pct(s.winRate) +
    '</td><td class="' + (s.totalPnl >= 0 ? "up" : "down") + '">' + (s.totalPnl >= 0 ? "+" : "") + fmt(s.totalPnl) +
    '</td><td><span class="pill ' + s.status + '">' + s.status + "</span></td></tr>"
  ).join("");
}

function renderFeed(reports) {
  const feed = $("feed");
  if (!reports.length) { feed.innerHTML = '<div class="empty">No reports yet — the Reporter files one after every cycle.</div>'; return; }
  feed.innerHTML = reports.map(r =>
    '<div class="report ' + esc(r.kind) + '"><div class="who">' + esc(r.author) + " · " +
    (r.realm ? esc(r.realm) + " · " : "") + esc(r.kind) + " · " + esc(r.created_at) + '</div>' +
    '<div class="title">' + esc(r.title) + '</div><div class="body">' + esc(r.body) + "</div></div>"
  ).join("");
}

function renderGoals(goals) {
  const el = $("goals");
  if (!goals.length) { el.innerHTML = '<div class="empty">No goals yet.</div>'; return; }
  const order = ["invest", "guardian", "tech", "wellness"];
  const groups = {};
  goals.forEach(g => {
    const r = g.realm || "invest";
    (groups[r] = groups[r] || []).push(g);
  });
  const keys = order.filter(k => groups[k]).concat(Object.keys(groups).filter(k => order.indexOf(k) === -1));
  el.innerHTML = keys.map(k =>
    '<div class="goal-realm">' + esc(k) + '</div>' +
    groups[k].map(g =>
      '<div class="goal ' + esc(g.status) + '"><div class="row"><span>' + esc(g.title) +
      '</span><span class="pill ' + (g.status === "done" ? "active" : "") + '">' + esc(g.status).replace("_", " ") + "</span></div>" +
      '<div class="detail">' + esc(g.detail) + '</div>' +
      '<div class="bar-track"><div class="bar-fill" style="width:' + Math.round((Number(g.progress) || 0) * 100) + '%"></div></div></div>'
    ).join("")
  ).join("");
}

function renderChecks(checks) {
  const el = $("checks");
  if (!checks.length) { el.innerHTML = '<div class="empty">No checks yet — run a protection sweep.</div>'; return; }
  el.innerHTML = checks.map(c =>
    '<div class="check"><div class="row"><span class="pill ' + esc(c.status || "") + '">' + esc(c.status || "?") + '</span>' +
    '<b>' + esc(c.name) + '</b><span class="crealm">' + esc(c.realm) + '</span>' +
    '<span class="ctime">' + esc(c.created_at) + '</span></div>' +
    (c.detail ? '<div class="cdetail">' + esc(c.detail) + '</div>' : '') +
    '</div>'
  ).join("");
}

function renderTech(d) {
  const c = d.colony || {};
  const bots = d.bots || [], strategies = d.strategies || [], reports = d.reports || [];
  const rows = [
    ["Market tick", (c.tick || 0).toLocaleString()],
    ["Closed trades", String(c.closedTrades || 0)],
    ["Open positions", String(c.openTrades || 0)],
    ["Bots active", bots.filter(b => b.status === "active").length + " / " + bots.length],
    ["Strategies active", strategies.filter(s => s.status === "active").length + " / " + strategies.length],
    ["Reports", reports.length + " recent"],
  ];
  $("tech").innerHTML = rows.map(r =>
    '<div class="kv"><span class="k">' + r[0] + '</span><span class="v">' + esc(r[1]) + '</span></div>'
  ).join("");
}

function renderWellness(w) {
  const el = $("wellness-info");
  let out = "";
  if (w.last) {
    out += '<div class="wl-last"><b>Last check-in:</b> mood ' + (Number(w.last.mood) || 0) + '/5 · energy ' + (Number(w.last.energy) || 0) + '/5</div>';
    if (w.last.note) out += '<div class="wl-note-txt">' + esc(w.last.note) + '</div>';
    out += '<div class="wl-when">' + esc(w.last.created_at) + '</div>';
  } else {
    out += '<div class="empty">No check-ins yet — how are you doing?</div>';
  }
  if (w.avg7) out += '<div class="wl-avg">7-day avg: mood ' + fmt(w.avg7.mood, 1) + ' · energy ' + fmt(w.avg7.energy, 1) + '</div>';
  const count = Number(w.count) || 0;
  if (count) out += '<div class="wl-count">' + count + ' check-in' + (count === 1 ? "" : "s") + ' total</div>';
  el.innerHTML = out;
}

let moodSel = 3, energySel = 3;
function buildSeg(id, get, set) {
  const el = $(id);
  el.innerHTML = [1, 2, 3, 4, 5].map(n =>
    '<button type="button" data-n="' + n + '"' + (n === get() ? ' class="sel"' : '') + '>' + n + '</button>'
  ).join("");
  el.querySelectorAll("button").forEach(b => {
    b.onclick = () => { set(Number(b.dataset.n)); buildSeg(id, get, set); };
  });
}
buildSeg("mood-seg", () => moodSel, n => { moodSel = n; });
buildSeg("energy-seg", () => energySel, n => { energySel = n; });

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

async function act(btn, path, body) {
  btn.disabled = true;
  try {
    await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : "{}" });
    await load();
  } finally { btn.disabled = false; }
}
$("btn-seed").onclick = (e) => act(e.target, "/colony/seed");
$("btn-run").onclick = (e) => act(e.target, "/engine/run", { ticks: 200, learn: true });
$("btn-learn").onclick = (e) => act(e.target, "/engine/learn");
$("btn-audit").onclick = (e) => act(e.target, "/realms/invest/audit");
$("btn-sweep").onclick = (e) => act(e.target, "/realms/guardian/sweep");
$("btn-checkin").onclick = async (e) => {
  const note = $("wl-note").value;
  await act(e.target, "/realms/wellness/checkin", { mood: moodSel, energy: energySel, note: note });
  $("wl-note").value = "";
};

load();
setInterval(load, 5000);
</script>
</body>
</html>`;
