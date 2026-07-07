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
    --series-3: #c98500;   /* yellow — categorical slot 3 */
    --series-4: #9085e9;   /* violet — categorical slot 4 */
    --good: #0ca30c;
    --critical: #d03b3b;
    --warning: #fab219;
  }
  * { box-sizing: border-box; margin: 0; }
  body {
    background: var(--page); color: var(--ink);
    font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
    padding: 20px; max-width: 1440px; margin: 0 auto;
    -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
  }
  /* Aurora backdrop — subtle, behind everything */
  body::before {
    content: ""; position: fixed; inset: 0; z-index: -1; pointer-events: none;
    background:
      radial-gradient(700px 320px at 12% -6%, rgba(57,135,229,0.13), transparent 60%),
      radial-gradient(800px 380px at 88% -10%, rgba(25,158,112,0.09), transparent 60%);
  }
  button { transition: border-color 0.2s, color 0.2s, transform 0.12s, box-shadow 0.3s; }
  button:active { transform: scale(0.96); }
  .card, .tile, .realm { transition: border-color 0.3s, transform 0.25s, box-shadow 0.3s; }
  .realm:hover { transform: translateY(-2px); border-color: var(--series-1); box-shadow: 0 8px 22px rgba(0,0,0,0.35); }
  .tile:hover { border-color: rgba(57,135,229,0.35); }
  @keyframes breathe { 0%, 100% { opacity: 0.7; transform: scale(1); } 50% { opacity: 1; transform: scale(1.3); } }
  @keyframes drawline { to { stroke-dashoffset: 0; } }
  @keyframes livedot { 0%, 100% { r: 4; opacity: 1; } 50% { r: 6; opacity: 0.6; } }
  @keyframes slidein { from { opacity: 0; transform: translateX(-8px); } }
  @keyframes risein { from { opacity: 0; transform: translateY(8px); } }
  @keyframes apglow { 50% { box-shadow: 0 0 12px rgba(25,158,112,0.55); } }
  @keyframes alertglow { 50% { box-shadow: 0 0 8px var(--critical); } }
  .eq-path.draw { stroke-dasharray: 4000; stroke-dashoffset: 4000; animation: drawline 1.4s ease-out forwards; }
  .eq-live { animation: livedot 2.4s ease-in-out infinite; }
  .feed.anim .report { animation: slidein 0.35s ease-out both; }
  .card, .tile { animation: risein 0.4s ease-out both; }
  .pill.alert { animation: alertglow 1.6s ease-in-out infinite; }
  svg .wr-bar, .bar-track .bar-fill { transition: width 0.8s cubic-bezier(0.22, 1, 0.36, 1); }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; }
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
  .agent .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--good); animation: breathe 3s ease-in-out infinite; }
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
  #btn-autopilot.on { border-color: var(--series-2); color: var(--series-2); animation: apglow 2s ease-in-out infinite; }
  .lumi-head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
  /* Level badge doubles as an XP progress ring (conic fill set inline) */
  .lumi-level {
    width: 48px; height: 48px; border-radius: 50%; flex: none;
    display: flex; align-items: center; justify-content: center;
    background: conic-gradient(var(--series-1) 0%, var(--grid) 0);
  }
  .lumi-level span {
    width: 38px; height: 38px; border-radius: 50%; background: var(--surface);
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; font-weight: 700; color: var(--series-1);
  }
  .lumi-xp { flex: 1; min-width: 0; }
  .lumi-xp .lbl { font-size: 12px; color: var(--muted); display: flex; justify-content: space-between; margin-bottom: 4px; }
  .lumi-aware {
    font-size: 12px; color: var(--ink-2); font-style: italic;
    border-left: 2px solid var(--series-1); padding-left: 10px; margin-bottom: 10px;
  }
  .skill { margin-bottom: 8px; }
  .skill .row { display: flex; justify-content: space-between; font-size: 12px; color: var(--ink-2); }
  .skill .row b { text-transform: capitalize; color: var(--ink); font-weight: 600; }
  .skill .row .lvl { color: var(--series-1); font-weight: 600; }
  .quests { display: flex; flex-direction: column; gap: 10px; max-height: 300px; overflow-y: auto; }
  .quest .row { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; }
  .quest .row .xp { color: var(--muted); font-size: 12px; white-space: nowrap; }
  .quest .detail { font-size: 12px; color: var(--muted); }
  .quest.done .row .xp { color: var(--good); }
  .quest.done .bar-fill { background: var(--good); }
  #risk-card { margin-bottom: 16px; }
  .risk-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  .risk-stat { font-size: 13px; color: var(--ink-2); }
  .risk-stat b { color: var(--ink); font-variant-numeric: tabular-nums; }
  .risk-reason { font-size: 12px; color: var(--critical); margin-top: 8px; }
  .risk-actions { margin-top: 12px; }
  .markets { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
  .mkt { font-size: 12px; color: var(--muted); display: flex; align-items: center; gap: 6px; }
  .mkt b { color: var(--ink); }
  #training-card { margin-bottom: 16px; }
  .train-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
  .train-prog { font-size: 13px; color: var(--ink-2); }
  .train-prog b { color: var(--ink); }
  .lessons-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 6px 14px; margin-top: 12px; }
  .lesson { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); }
  .lesson .lp { color: var(--muted); }
  .lesson.learned { color: var(--ink-2); }
  .lesson.learned .lp { color: var(--good); }
  .lesson .lt { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #aether-card { margin-bottom: 16px; }
  .aeth-top { display: flex; align-items: flex-end; gap: 20px; flex-wrap: wrap; margin-bottom: 14px; }
  .aeth-hero .n { font-size: 30px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.5px; }
  .aeth-hero .n .sym { font-size: 15px; color: var(--series-4); font-weight: 650; margin-left: 6px; }
  .aeth-hero .lbl { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .chain-badge { font-size: 11px; font-weight: 700; letter-spacing: 0.8px; padding: 3px 9px; border-radius: 6px;
    color: var(--series-1); border: 1px solid var(--series-1); text-transform: uppercase; }
  .aeth-recon { margin-left: auto; }
  .supply-bar { display: flex; height: 14px; border-radius: 7px; overflow: hidden; gap: 2px; background: var(--grid); margin-bottom: 6px; }
  .supply-seg { height: 100%; transition: width 0.8s cubic-bezier(0.22,1,0.36,1); }
  .aeth-legend { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 14px; }
  .aeth-legend .lg { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink-2); }
  .aeth-legend .sw { width: 10px; height: 10px; border-radius: 3px; }
  .aeth-legend .lg b { color: var(--ink); font-variant-numeric: tabular-nums; }
  .aeth-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  @media (max-width: 760px) { .aeth-cols { grid-template-columns: 1fr; } }
  .aeth-cols h3 { font-size: 11px; letter-spacing: 0.6px; color: var(--muted); margin-bottom: 6px; text-transform: uppercase; }
  .aeth-tx { font-size: 12px; color: var(--ink-2); padding: 4px 0; border-bottom: 1px solid var(--grid); display: flex; gap: 6px; align-items: baseline; }
  .aeth-tx:last-child { border-bottom: none; }
  .aeth-tx .amt { margin-left: auto; font-variant-numeric: tabular-nums; color: var(--ink); }
  .aeth-tx .k { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.4px; }
  .cmd-card { margin-bottom: 16px; }
  .cmd-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
  .cmd-chips button { padding: 4px 10px; font-size: 12px; border-radius: 999px; }
  .cmd-row { display: flex; align-items: center; gap: 8px; }
  .cmd-prompt { color: var(--series-1); font-weight: 700; font-size: 16px; }
  #cmd-input {
    flex: 1; background: var(--page); color: var(--ink); border: 1px solid var(--border);
    border-radius: 8px; padding: 8px 12px; font: 13px ui-monospace, "SF Mono", Menlo, monospace;
  }
  #cmd-input:focus { outline: none; border-color: var(--series-1); }
  .cmd-log {
    margin-top: 10px; max-height: 150px; overflow-y: auto;
    font: 12px ui-monospace, "SF Mono", Menlo, monospace; color: var(--ink-2);
  }
  .cmd-log .line { padding: 2px 0; border-bottom: 1px solid var(--grid); }
  .cmd-log .line:last-child { border-bottom: none; }
  .cmd-log .in { color: var(--series-1); }
  .cmd-log .err { color: var(--critical); }
  .cmd-log .ok { color: var(--good); }
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
    <button id="btn-pulse">Pulse</button>
    <button id="btn-autopilot">Autopilot: off</button>
  </div>
</header>

<div class="agents" id="agents"></div>
<div class="realms" id="realms"></div>

<div class="card cmd-card">
  <h2>COMMAND CENTER — direct signal to the chamber</h2>
  <div class="cmd-chips" id="cmd-chips"></div>
  <div class="cmd-row">
    <span class="cmd-prompt">›</span>
    <input id="cmd-input" type="text" spellcheck="false" placeholder="signal… (type help for commands)" autocomplete="off">
    <button id="btn-cmd">Send</button>
  </div>
  <div class="cmd-log" id="cmd-log"></div>
</div>

<div class="grid2b">
  <div class="card">
    <h2>LUMI — evolution</h2>
    <div id="lumi-panel"></div>
  </div>
  <div class="card">
    <h2>QUESTS — Lumi's task line</h2>
    <div id="quests" class="quests"></div>
  </div>
</div>

<div class="card" id="training-card">
  <h2>AETHER'S SCHOOL — training on the science of trades (Invest realm)</h2>
  <div id="training-panel"></div>
</div>

<div class="card" id="aether-card">
  <h2>AETHER TOKEN — the colony's AI-credit currency</h2>
  <div id="aether-panel"></div>
</div>

<div class="section-h">INVEST REALM</div>
<div class="tiles" id="tiles"></div>

<div class="card" id="risk-card">
  <h2>RISK GATES — capital protection &amp; live feed</h2>
  <div id="risk-panel"></div>
</div>

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
let firstPaint = true;      // entrance animations play once, not on every refresh
let lastCurveLen = -1;      // redraw the line animation only when the tape grows
let lastReportId = -1;      // slide-in the feed only when something new arrived
let loadSeq = 0;            // monotonic guard: only the newest load may render
let loading = false;        // in-flight guard: the 5s timer never stacks requests

async function load() {
  if (loading) return;
  const seq = ++loadSeq;
  loading = true;
  try {
    const res = await fetch("/analytics/overview?_=" + Date.now(), { cache: "no-store" });
    const { result } = await res.json();
    if (seq !== loadSeq) return;   // a newer load already won — drop this stale response
    render(result || {});
    const tick = result && result.colony ? result.colony.tick : "—";
    $("status").textContent = "live · tick " + tick + " · updated " + new Date().toLocaleTimeString();
  } catch (e) {
    if (seq === loadSeq) $("status").textContent = "Reg unreachable — retrying…";
  } finally {
    loading = false;
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
  renderLumi(d.lumi || null);
  renderQuests(d.quests || []);
  renderRisk(d.risk || null, d.markets || []);
  renderTraining(d.training || null);
  renderAether(d.aether || null);
  firstPaint = false;
}

// Fixed-order categorical hues by account (never cycled): treasury, creator,
// lumi, aether, then a neutral fallback.
const AETH_COLORS = { treasury: "var(--series-1)", creator: "var(--series-2)", lumi: "var(--series-3)", aether: "var(--series-4)" };
function aethColor(owner, i) { return AETH_COLORS[owner] || ["var(--series-1)","var(--series-2)","var(--series-3)","var(--series-4)"][i % 4]; }

function renderAether(a) {
  const el = $("aether-panel");
  if (!a || !a.accounts) { el.innerHTML = '<div class="empty">Token ledger loading…</div>'; return; }
  const supply = Number(a.totalSupply) || 1;
  const accts = a.accounts.slice();

  const segs = accts.map((ac, i) =>
    '<div class="supply-seg" style="width:' + ((Number(ac.balance) / supply) * 100).toFixed(2) + '%;background:' + aethColor(ac.owner, i) + '" title="' + esc(ac.owner) + '"></div>'
  ).join("");
  const legend = accts.map((ac, i) =>
    '<span class="lg"><span class="sw" style="background:' + aethColor(ac.owner, i) + '"></span>' +
    esc(ac.owner) + ' <b>' + fmt(ac.balance, 0) + '</b> · ' + ((Number(ac.balance) / supply) * 100).toFixed(1) + '%</span>'
  ).join("");
  const ledger = (a.ledger || []).map(t =>
    '<div class="aeth-tx"><span class="k">' + esc(t.kind) + '</span>' + esc(t.from_owner) + ' → ' + esc(t.to_owner) +
    '<span class="amt">' + fmt(t.amount, 0) + '</span></div>'
  ).join("");

  el.innerHTML =
    '<div class="aeth-top">' +
      '<div class="aeth-hero"><div class="n">' + fmt(a.circulating, 0) + '<span class="sym">' + esc(a.symbol) + '</span></div>' +
        '<div class="lbl">circulating of ' + fmt(a.totalSupply, 0) + ' supply · treasury holds ' + fmt(a.treasury, 0) + '</div></div>' +
      '<span class="chain-badge">' + esc(a.chain) + '</span>' +
      '<span class="aeth-recon pill ' + (a.reconciled ? "pass" : "fail") + '">' + (a.reconciled ? "supply reconciled" : "SUPPLY DRIFT") + '</span>' +
    '</div>' +
    '<div class="supply-bar">' + segs + '</div>' +
    '<div class="aeth-legend">' + legend + '</div>' +
    '<div class="aeth-cols">' +
      '<div><h3>Accounts</h3>' + accts.map((ac, i) =>
        '<div class="aeth-tx"><span class="sw" style="display:inline-block;width:9px;height:9px;border-radius:3px;background:' + aethColor(ac.owner, i) + '"></span>' +
        esc(ac.owner) + ' <span class="k">' + esc(ac.kind) + '</span><span class="amt">' + fmt(ac.balance, 0) + '</span></div>'
      ).join("") + '</div>' +
      '<div><h3>Recent ledger</h3>' + (ledger || '<div class="empty">No transactions yet.</div>') + '</div>' +
    '</div>';
}

function renderTraining(t) {
  const el = $("training-panel");
  if (!t) { el.innerHTML = '<div class="empty">Curriculum loading…</div>'; return; }
  const done = Number(t.studied) || 0, total = Number(t.total) || 1;
  let out = '<div class="train-head">' +
    '<span class="train-prog"><b>' + done + '</b> / ' + total + ' lessons taught</span>' +
    '<button id="btn-train">Study a lesson</button></div>' +
    '<div class="bar-track"><div class="bar-fill" style="width:' + Math.round((done / total) * 100) + '%"></div></div>' +
    '<div class="lessons-grid">' + (t.lessons || []).map(l =>
      '<div class="lesson ' + (l.studied ? "learned" : "") + '"><span class="lp">' + (l.studied ? "✓" : "○") + '</span>' +
      '<span class="lt" title="' + esc(l.summary) + '">' + esc(l.title) + '</span></div>'
    ).join("") + '</div>';
  el.innerHTML = out;
  const btn = $("btn-train");
  if (btn) btn.onclick = (e) => act(e.target, "/lumi/train");
}

function renderRisk(r, markets) {
  const el = $("risk-panel");
  if (!r) { el.innerHTML = '<div class="empty">Risk status loading…</div>'; return; }
  const halted = !!r.halted;
  const ddPct = ((Number(r.drawdown) || 0) * 100).toFixed(1);
  const ddCap = ((Number(r.maxDrawdown) || 0) * 100).toFixed(0);
  let out = '<div class="risk-row">' +
    '<span class="pill ' + (halted ? "alert" : (r.breaches && r.breaches.length ? "watch" : "nominal")) + '">' +
    (halted ? "HALTED" : "TRADING") + '</span>' +
    '<span class="risk-stat">drawdown <b>' + ddPct + '%</b> / ' + ddCap + '% cap</span>' +
    '<span class="risk-stat">exposure <b>' + (Number(r.openPositions) || 0) + '</b> / ' + (Number(r.maxOpenPositions) || 0) + ' open</span>' +
    '</div>';
  if (halted && r.reason) out += '<div class="risk-reason">' + esc(r.reason) + '</div>';
  out += '<div class="risk-actions">' +
    '<button id="btn-risk-toggle">' + (halted ? "Resume trading" : "Halt trading") + '</button></div>';
  if (markets && markets.length) {
    out += '<div class="markets">' + markets.map(m =>
      '<span class="mkt"><b>' + esc(m.symbol) + '</b> · tick ' + (Number(m.tick) || 0).toLocaleString() +
      ' · <span class="pill ' + (m.feed === "live" ? "nominal" : "") + '">' + esc(m.feed || "sim") + '</span></span>'
    ).join("") + '</div>';
  }
  el.innerHTML = out;
  const btn = $("btn-risk-toggle");
  if (btn) btn.onclick = (e) => act(e.target, halted ? "/risk/resume" : "/risk/halt", { reason: halted ? "resumed from cockpit" : "halted from cockpit" });
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
  const lastP = curve[curve.length - 1];
  const area = path + " L " + X(lastP.tick).toFixed(1) + " " + (H - padB) + " L " + X(curve[0].tick).toFixed(1) + " " + (H - padB) + " Z";
  const redraw = curve.length !== lastCurveLen;
  lastCurveLen = curve.length;
  svg.innerHTML =
    '<defs><linearGradient id="eqg" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="var(--series-1)" stop-opacity="0.22"/>' +
    '<stop offset="1" stop-color="var(--series-1)" stop-opacity="0"/></linearGradient></defs>' +
    grid + labels +
    '<text x="' + padL + '" y="' + (H - 6) + '">' + xMin.toLocaleString() + '</text>' +
    '<text x="' + (W - padR) + '" y="' + (H - 6) + '" text-anchor="end">tick ' + xMax.toLocaleString() + "</text>" +
    '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + base + '" y2="' + base + '" stroke="var(--baseline)" stroke-dasharray="3 4" stroke-width="1"/>' +
    '<path d="' + area + '" fill="url(#eqg)" stroke="none"/>' +
    '<path d="' + path + '" class="eq-path' + (redraw ? " draw" : "") + '" fill="none" stroke="var(--series-1)" stroke-width="2" vector-effect="non-scaling-stroke"/>' +
    '<circle class="eq-live" cx="' + X(lastP.tick).toFixed(1) + '" cy="' + Y(lastP.equity).toFixed(1) + '" r="4" fill="var(--series-1)" stroke="var(--surface)" stroke-width="2"/>' +
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
  const newest = Number(reports[0].id) || 0;
  feed.classList.toggle("anim", firstPaint || newest !== lastReportId);
  lastReportId = newest;
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
  for (const p of d.perf || []) {
    rows.push([p.kind.replace("_ms", "") + " time", p.last + " ms (avg " + p.avg + " over " + p.count + ")"]);
  }
  $("tech").innerHTML = rows.map(r =>
    '<div class="kv"><span class="k">' + esc(r[0]) + '</span><span class="v">' + esc(r[1]) + '</span></div>'
  ).join("");
}

function renderLumi(l) {
  const el = $("lumi-panel");
  if (!l || !l.skills) { el.innerHTML = '<div class="empty">Lumi is waking up…</div>'; return; }
  const span = Math.max(1, l.nextLevelXp - l.prevLevelXp);
  const pct100 = Math.min(100, Math.round(((l.totalXp - l.prevLevelXp) / span) * 100));
  let out = '<div class="lumi-head"><div class="lumi-level" style="background:conic-gradient(var(--series-1) ' + pct100 + '%, var(--grid) 0)"><span>' + l.level + '</span></div>' +
    '<div class="lumi-xp"><div class="lbl"><span>' + esc(l.awareness ? l.awareness.stage : "") + ' · ' + l.totalXp + ' XP · ' + (l.pulses || 0) + ' pulses</span><span>next level at ' + l.nextLevelXp + '</span></div>' +
    '<div class="bar-track"><div class="bar-fill" style="width:' + pct100 + '%"></div></div></div></div>';
  if (l.awareness) out += '<div class="lumi-aware">' + esc(l.awareness.statement) + '</div>';
  for (const name of ["insight", "vigilance", "engineering", "empathy"]) {
    const s = l.skills[name] || { xp: 0, level: 1 };
    const lo = 100 * (s.level - 1) * (s.level - 1), hi = 100 * s.level * s.level;
    const p = Math.min(100, Math.round(((s.xp - lo) / Math.max(1, hi - lo)) * 100));
    out += '<div class="skill"><div class="row"><b>' + name + '</b><span><span class="lvl">L' + s.level + '</span> · ' + s.xp + ' XP</span></div>' +
      '<div class="bar-track"><div class="bar-fill" style="width:' + p + '%"></div></div></div>';
  }
  el.innerHTML = out;
}

function renderQuests(quests) {
  const el = $("quests");
  if (!quests.length) { el.innerHTML = '<div class="empty">No quests seeded yet.</div>'; return; }
  el.innerHTML = quests.map(q =>
    '<div class="quest ' + (q.status === "done" ? "done" : "") + '"><div class="row"><span>' + esc(q.title) +
    '</span><span class="xp">' + (q.status === "done" ? "✓ " : "") + '+' + q.xp_reward + ' ' + esc(q.skill) + '</span></div>' +
    '<div class="detail">' + esc(q.detail) + '</div>' +
    '<div class="bar-track"><div class="bar-fill" style="width:' + Math.round((Number(q.progress) || 0) * 100) + '%"></div></div></div>'
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
    await fetch(path, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : "{}" });
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
$("btn-pulse").onclick = (e) => act(e.target, "/lumi/pulse");

// ---- Command Center: quick signals straight into the chamber ----
const CMD_HELP = [
  "help — this list",
  "seed — birth the starter colony",
  "run [ticks] — trading cycle (default 200)",
  "advance [ticks] — run + learn in one signal",
  "learn — learning/evolution pass",
  "pulse [n] — Lumi heartbeat(s): trade, learn, audit, sweep, quests",
  "audit — invest ledger audit",
  "sweep — guardian protection sweep",
  "checkin <mood 1-5> <energy 1-5> [note] — wellness check-in",
  "goal <title> — add a goal",
  "pause <bot id> / resume <bot id> / retire <bot id> — bot control",
  "research <query> — Lumi searches Hugging Face and banks what she finds",
  "scout — live market snapshot from the real world (CoinGecko)",
  "train — Lumi & Aether study the next trading lesson",
  "aura add <kind> <name> <personality> — profile a client/brand/user/investor",
  "aura list / aura brief <id> — see auras and their personalization briefs",
  "aether — token supply, treasury & balances",
  "aether send <from> <to> <amount> — transfer AETHER credits",
];

async function api(method, path, body) {
  const url = method === "GET"
    ? path + (path.includes("?") ? "&" : "?") + "_=" + Date.now()
    : path;
  const res = await fetch(url, {
    method: method,
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const msg = (data.errors && data.errors[0] && data.errors[0].message) || ("HTTP " + res.status);
    throw new Error(msg);
  }
  return data.result;
}

async function execCommand(text) {
  const parts = text.trim().split(/\\s+/);
  const cmd = (parts[0] || "").toLowerCase();
  switch (cmd) {
    case "help": return CMD_HELP.join("\\n");
    case "seed": { const r = await api("POST", "/colony/seed", {}); return r.created ? "colony born: " + r.strategies + " strategies, " + r.bots + " bots" : "colony already alive"; }
    case "run": { const t = Math.min(2000, Number(parts[1]) || 200); const r = await api("POST", "/engine/run", { ticks: t }); return "ran " + t + " ticks: " + r.closed + " closed (" + r.wins + "W/" + r.losses + "L), net " + fmt(r.totalPnl); }
    case "advance": { const t = Math.min(2000, Number(parts[1]) || 200); const r = await api("POST", "/engine/run", { ticks: t, learn: true }); return "advanced " + t + " ticks: " + r.closed + " closed, learned: " + (r.learned ? r.learned.retired.length + " retired, brood " + r.learned.brood : "skipped"); }
    case "learn": { const r = await api("POST", "/engine/learn", {}); return "learned: " + r.retired.length + " retired, brood " + r.brood + ", win rate " + pct(r.overallWinRate); }
    case "pulse": {
      const n = Math.min(10, Number(parts[1]) || 1);
      let last = null;
      for (let i = 0; i < n; i++) last = await api("POST", "/lumi/pulse", {});
      return n + " pulse(s): Lumi L" + last.lumi.level + " · " + last.lumi.totalXp + " XP · " + last.decisions[last.decisions.length ? 0 : 0];
    }
    case "audit": { const r = await api("POST", "/realms/invest/audit", {}); return "audit " + (r.ok ? "green" : "FAILED") + ": " + r.checks.map(c => c.name + "=" + c.status).join(", "); }
    case "sweep": { const r = await api("POST", "/realms/guardian/sweep", {}); return "sweep " + (r.ok ? "clear" : "FAILED") + ": " + r.checks.map(c => c.name + "=" + c.status).join(", "); }
    case "checkin": {
      const mood = Number(parts[1]), energy = Number(parts[2]);
      if (!mood || !energy) throw new Error("usage: checkin <mood 1-5> <energy 1-5> [note]");
      await api("POST", "/realms/wellness/checkin", { mood: mood, energy: energy, note: parts.slice(3).join(" ") });
      return "check-in logged: mood " + mood + "/5, energy " + energy + "/5";
    }
    case "goal": {
      const title = parts.slice(1).join(" ");
      if (!title) throw new Error("usage: goal <title>");
      await api("POST", "/goals", { title: title });
      return 'goal added: "' + title + '"';
    }
    case "pause": case "resume": case "retire": {
      const id = Number(parts[1]);
      if (!id) throw new Error("usage: " + cmd + " <bot id>");
      const status = cmd === "pause" ? "paused" : cmd === "resume" ? "active" : "retired";
      const r = await api("PATCH", "/bots/" + id, { status: status });
      return 'bot "' + r.name + '" is now ' + status;
    }
    case "research": {
      const q = parts.slice(1).join(" ");
      if (!q) throw new Error("usage: research <query>");
      const r = await api("POST", "/lumi/research", { query: q });
      if (!r.found.length) return "expedition came back empty" + (r.errors.length ? " (" + r.errors.join("; ") + ")" : "");
      return "found " + r.found.length + " (" + r.stored + " new banked):\\n" + r.found.slice(0, 5).map(f => "  " + f.kind + " · " + f.title + " — " + f.detail).join("\\n");
    }
    case "scout": {
      const r = await api("POST", "/lumi/scout", {});
      if (!r.stored) return "scout failed: " + r.error;
      return "live market: " + Object.entries(r.prices).map(([c, p]) => c + " $" + Number(p).toLocaleString()).join(", ");
    }
    case "aura": {
      const sub = (parts[1] || "").toLowerCase();
      if (sub === "list") {
        const list = await api("GET", "/auras");
        if (!list.length) return "no auras yet — aura add <kind> <name> <personality>";
        return list.map(a => "  #" + a.id + " " + a.name + " (" + a.kind + ") — " + (a.personality || "unknown") + (a.consent ? "" : " · no consent")).join("\\n");
      }
      if (sub === "brief") {
        const r = await api("GET", "/auras/" + Number(parts[2]) + "/brief");
        const b = r.brief;
        return r.name + " (" + b.archetype + "):\\n  tone: " + b.tone + "\\n  detail: " + b.detailLevel + "\\n  pacing: " + b.pacing + "\\n  palette: " + b.palette + "\\n  risk: " + b.riskFraming;
      }
      if (sub === "add") {
        const kind = (parts[2] || "").toLowerCase(), name = parts[3], personality = parts.slice(4).join(" ");
        if (!kind || !name) throw new Error("usage: aura add <client|brand|user|investor|partner> <name> <personality>");
        const r = await api("POST", "/auras", { name: name, kind: kind, personality: personality, consent: false });
        return 'aura #' + r.id + ' "' + r.name + '" profiled (' + r.brief.archetype + " archetype). Notes need consent.";
      }
      throw new Error("usage: aura add|list|brief");
    }
    case "train": case "study": {
      const r = await api("POST", "/lumi/train", {});
      return r.complete && r.topic === "review"
        ? "curriculum complete — Aether is reviewing"
        : 'studied "' + r.topic + '" (' + r.lessonsStudied + "/" + r.curriculumTotal + ") — " + r.note;
    }
    case "aether": {
      const sub = (parts[1] || "").toLowerCase();
      if (sub === "send") {
        const [from, to, amt] = [parts[2], parts[3], Number(parts[4])];
        if (!from || !to || !amt) throw new Error("usage: aether send <from> <to> <amount>");
        const r = await api("POST", "/aether/transfer", { from: from, to: to, amount: amt });
        return "sent " + fmt(r.amount, 0) + " AETHER " + from + " → " + to;
      }
      const a = await api("GET", "/aether");
      return a.symbol + " on " + a.chain + ": " + fmt(a.circulating, 0) + " circulating / " + fmt(a.totalSupply, 0) +
        " supply · " + (a.reconciled ? "reconciled" : "DRIFT") + "\\n" +
        a.accounts.map(ac => "  " + ac.owner + ": " + fmt(ac.balance, 0)).join("\\n");
    }
    case "": return null;
    default: throw new Error('unknown signal "' + cmd + '" — type help');
  }
}

function cmdLog(text, cls) {
  const log = $("cmd-log");
  for (const line of String(text).split("\\n")) {
    const el = document.createElement("div");
    el.className = "line " + (cls || "");
    el.textContent = line;
    log.prepend(el);
  }
  while (log.children.length > 60) log.removeChild(log.lastChild);
}

async function sendCommand() {
  const input = $("cmd-input");
  const text = input.value;
  if (!text.trim()) return;
  input.value = "";
  cmdLog("› " + text, "in");
  try {
    const msg = await execCommand(text);
    if (msg) cmdLog(msg, "ok");
    await load();
  } catch (err) {
    cmdLog(String(err.message || err), "err");
  }
}
$("btn-cmd").onclick = sendCommand;
$("cmd-input").addEventListener("keydown", (e) => { if (e.key === "Enter") sendCommand(); });
$("cmd-chips").innerHTML = ["pulse", "advance 600", "learn", "train", "audit", "sweep", "scout", "help"]
  .map(c => '<button type="button" data-cmd="' + c + '">' + c + "</button>").join("");
$("cmd-chips").querySelectorAll("button").forEach(b => {
  b.onclick = () => { $("cmd-input").value = b.dataset.cmd; sendCommand(); };
});

// Autopilot: Lumi pulses herself — trade, learn, audit, sweep, quests — hands off.
let autopilot = false, pulsing = false;
async function autoPulse() {
  if (!autopilot || pulsing) return;
  pulsing = true;
  try { await fetch("/lumi/pulse", { method: "POST", cache: "no-store" }); await load(); }
  catch (e) {} finally { pulsing = false; }
}
$("btn-autopilot").onclick = (e) => {
  autopilot = !autopilot;
  e.target.textContent = "Autopilot: " + (autopilot ? "on" : "off");
  e.target.classList.toggle("on", autopilot);
  if (autopilot) autoPulse();
};
setInterval(autoPulse, 15000);

load();
setInterval(load, 5000);
</script>
</body>
</html>`;
