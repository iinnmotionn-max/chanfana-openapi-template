// Lumi — the creator's multi-realm intellect. A self-contained Creator Cockpit:
// no CDNs, no build step. Reads /analytics/overview, renders inline SVG charts,
// and gives the creator direct controls over seven realms: Invest/Aether
// (trading + AI-credit economy), Guardian (protection), Tech (diagnostics),
// Wellness (check-ins), Shield (web3 security), Growth (PR/leads), Gaming (InMotion RP).
// Palette: validated dark-surface steps (see docs/BLUEPRINT.md build rules).

export const dashHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lumi — Creator Cockpit</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><ellipse cx=%228%22 cy=%228%22 rx=%227%22 ry=%223%22 fill=%22none%22 stroke=%22%239085e9%22 stroke-width=%221.2%22/><circle cx=%228%22 cy=%228%22 r=%223%22 fill=%22%233987e5%22/></svg>">
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
  /* Calm mode: when the tab isn't visible, every animation freezes so the
     dashboard costs the CPU nothing in the background. Toggled from JS. */
  html.calm *, html.calm *::before, html.calm *::after { animation-play-state: paused !important; }
  header { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
  header h1 { font-size: 20px; font-weight: 650; letter-spacing: 0.2px; }
  /* Brand lockup — animated vector mark (4K-crisp atom/aura) + wordmark */
  .brand { display: flex; align-items: center; gap: 13px; }
  .logo-mark { flex: none; overflow: visible; }
  /* Orbits + particles rotate around the mark's centre (24,24 in viewBox units). */
  .logo-mark .lm-o1, .logo-mark .lm-o2, .logo-mark .lm-o3,
  .logo-mark .lm-p1, .logo-mark .lm-p2, .logo-mark .lm-p3 { transform-box: view-box; transform-origin: 24px 24px; }
  .logo-mark .lm-core, .logo-mark .lm-halo { transform-box: fill-box; transform-origin: center; }
  .logo-mark .lm-o1 { animation: lm-spin 18s linear infinite; }
  .logo-mark .lm-o2 { animation: lm-spin 26s linear infinite reverse; }
  .logo-mark .lm-o3 { animation: lm-spin 34s linear infinite; }
  .logo-mark .lm-p1 { animation: lm-spin 7s linear infinite; }
  .logo-mark .lm-p2 { animation: lm-spin 11s linear infinite reverse; animation-delay: -3s; }
  .logo-mark .lm-p3 { animation: lm-spin 15s linear infinite; animation-delay: -6s; }
  .logo-mark .lm-core { animation: lm-breathe 3.4s ease-in-out infinite; }
  .logo-mark .lm-halo { animation: lm-halo 3.4s ease-in-out infinite; }
  @keyframes lm-spin { to { transform: rotate(360deg); } }
  @keyframes lm-breathe { 0%,100% { opacity: 0.9; } 50% { opacity: 1; transform: scale(1.08); } }
  @keyframes lm-halo { 0%,100% { opacity: 0.35; transform: scale(1); } 50% { opacity: 0.65; transform: scale(1.15); } }
  .brand-txt { display: flex; flex-direction: column; line-height: 1.05; }
  .brand-name {
    font-size: 27px; font-weight: 800; letter-spacing: 1.6px;
    background: linear-gradient(92deg, #bfe4ff 0%, #3987e5 42%, #9085e9 100%);
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent;
  }
  .brand-tag { font-size: 9.5px; letter-spacing: 2.4px; color: var(--muted); font-weight: 600; }
  @media (prefers-reduced-motion: reduce) { .logo-mark *, .brand-name { animation: none !important; } }
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
  /* Acts Lumi took unattended stand out — a decision made while nobody was
     watching should never look like routine chatter in the feed. */
  .report.initiative { border-left-color: var(--series-4); }
  .report.initiative .who { color: var(--series-4); }
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
  /* WALLET */
  #wallet-card { margin-bottom: 16px; position: relative; overflow: hidden; }
  .wallet-card::before { content: ""; position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(520px 180px at 85% -30%, rgba(144,133,233,0.12), transparent 70%); }
  .wallet-grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: 18px; }
  @media (max-width: 820px) { .wallet-grid { grid-template-columns: 1fr; } }
  .wallet-hero .bal { font-size: 34px; font-weight: 750; font-variant-numeric: tabular-nums; letter-spacing: -0.5px; }
  .wallet-hero .bal .sym { font-size: 15px; color: var(--series-4); font-weight: 650; margin-left: 6px; }
  .wallet-hero .who { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .wallet-addr { display: flex; align-items: center; gap: 8px; margin-top: 12px; font: 12px ui-monospace, Menlo, monospace;
    background: var(--page); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; color: var(--ink-2); }
  .wallet-addr .lab { color: var(--muted); }
  .wallet-addr .val { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wallet-sui { font-size: 11px; margin-top: 8px; }
  .wallet-sui.on { color: var(--good); } .wallet-sui.off { color: var(--muted); }
  .send-form { display: flex; flex-direction: column; gap: 8px; }
  .send-form label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }
  .send-form input, .send-form select {
    background: var(--page); color: var(--ink); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; font: inherit; font-size: 13px; }
  .send-form input:focus, .send-form select:focus { outline: none; border-color: var(--series-1); }
  .send-row { display: flex; gap: 8px; }
  .send-row > * { flex: 1; }
  .wallet-list { margin-top: 14px; display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 6px 16px; }
  .wl-item { display: flex; align-items: center; gap: 8px; font-size: 12px; padding: 4px 0; cursor: pointer; border-bottom: 1px solid var(--grid); }
  .wl-item:hover { color: var(--series-1); }
  .wl-item.sel { color: var(--series-4); }
  .wl-item .wl-o { color: var(--ink); }
  .wl-item .wl-b { margin-left: auto; font-variant-numeric: tabular-nums; color: var(--ink-2); }
  #aether-card { margin-bottom: 16px; }
  #defi-card { margin-bottom: 16px; }
  .defi-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .defi-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  @media (max-width: 820px) { .defi-cols { grid-template-columns: 1fr; } }
  .defi-cols h3 { font-size: 11px; letter-spacing: 0.6px; color: var(--muted); text-transform: uppercase; margin-bottom: 8px; }
  .swap { background: var(--page); border: 1px solid var(--border); border-radius: 12px; padding: 12px; }
  .swap-dir { display: flex; gap: 6px; margin-bottom: 10px; }
  .swap-dir button { flex: 1; font-size: 12px; padding: 6px 4px; }
  .swap-dir button.sel { border-color: var(--series-1); color: var(--series-1); }
  .swap-io { display: flex; align-items: center; gap: 8px; }
  .swap-io input { flex: 1; min-width: 0; background: var(--surface); color: var(--ink); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; font: inherit; }
  .swap-arrow { color: var(--muted); }
  .swap-out { flex: 1; font-size: 13px; color: var(--ink-2); text-align: right; }
  .swap-out b { color: var(--ink); font-variant-numeric: tabular-nums; }
  .swap-meta { font-size: 11px; color: var(--muted); margin: 8px 0 10px; }
  .swap-meta b { color: var(--ink-2); }
  #swap-go { width: 100%; border-color: var(--series-1); color: var(--series-1); font-weight: 600; }
  #growth-card { margin-bottom: 16px; }
  .growth-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 14px; }
  @media (max-width: 820px) { .growth-cols { grid-template-columns: 1fr; } }
  .growth-cols h3 { font-size: 11px; letter-spacing: 0.6px; color: var(--muted); text-transform: uppercase; margin-bottom: 8px; }
  .funnel { display: flex; flex-direction: column; gap: 6px; }
  .gf-row { display: flex; align-items: center; gap: 10px; font-size: 12px; }
  .gf-l { width: 74px; color: var(--ink-2); }
  .gf-track { flex: 1; height: 8px; background: var(--grid); border-radius: 5px; overflow: hidden; }
  .gf-bar { height: 100%; border-radius: 5px; transition: width 0.7s cubic-bezier(0.22,1,0.36,1); }
  .gf-v { width: 28px; text-align: right; font-variant-numeric: tabular-nums; color: var(--ink); }
  .gpost { display: flex; align-items: center; gap: 8px; font-size: 12px; padding: 5px 0; border-bottom: 1px solid var(--grid); }
  .gpost:last-child { border-bottom: none; }
  .gp-plat { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--series-4); width: 56px; flex: none; }
  .gp-body { color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
  .gp-body .mutedtxt { color: var(--muted); }
  .conns { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
  .conn { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--muted); border: 1px solid var(--border); border-radius: 999px; padding: 3px 10px; text-transform: capitalize; }
  .conn .cdot { width: 7px; height: 7px; border-radius: 50%; background: var(--muted); }
  .conn.live { color: var(--good); border-color: var(--good); } .conn.live .cdot { background: var(--good); }
  .conn.linked { color: var(--warning); border-color: var(--warning); } .conn.linked .cdot { background: var(--warning); }
  .deals-strip { background: var(--page); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; margin-bottom: 12px; }
  .ds-head { font-size: 13px; color: var(--ink-2); margin-bottom: 10px; } .ds-head b { color: var(--ink); font-variant-numeric: tabular-nums; }
  .dstages { display: flex; gap: 8px; }
  .dstage { flex: 1; text-align: center; background: var(--surface); border-radius: 8px; padding: 8px 4px; }
  .dstage .dnum { display: block; font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .dstage .dlbl { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.4px; }
  .aeth-top { display: flex; align-items: flex-end; gap: 20px; flex-wrap: wrap; margin-bottom: 14px; }
  .aeth-hero .n { font-size: 30px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.5px; }
  .aeth-hero .n .sym { font-size: 15px; color: var(--series-4); font-weight: 650; margin-left: 6px; }
  .aeth-hero .lbl { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .chain-badge { font-size: 11px; font-weight: 700; letter-spacing: 0.8px; padding: 3px 9px; border-radius: 6px;
    color: var(--series-1); border: 1px solid var(--series-1); text-transform: uppercase; }
  .aeth-recon { margin-left: auto; }
  .chain-link { font-size: 12px; margin-bottom: 12px; }
  .chain-link.on { color: var(--good); }
  .chain-link.off { color: var(--muted); }
  /* AETH — DESIGN PREVIEW (not launched: no contract, no wallet, no money movement) */
  #aethp-card { position: relative; overflow: hidden; margin-bottom: 16px; }
  #aethp-card::before { content: ""; position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(560px 220px at 82% -30%, rgba(144,133,233,0.13), transparent 70%),
                radial-gradient(520px 200px at 8% -20%, rgba(57,135,229,0.10), transparent 70%); }
  .aethp-h { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 6px; }
  .aethp-title { font-size: 15px; font-weight: 700; letter-spacing: 0.3px; }
  .aethp-title .aeth-glyph { font-weight: 800;
    background: linear-gradient(92deg, #bfe4ff, #9085e9); -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent; color: transparent; }
  .aethp-badge { font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;
    padding: 3px 10px; border-radius: 999px; color: var(--warning); border: 1px solid var(--warning);
    background: rgba(250,178,25,0.08); }
  .aethp-badge .bdot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--warning);
    margin-right: 6px; vertical-align: middle; animation: breathe 2.4s ease-in-out infinite; }
  .aethp-lede { color: var(--ink-2); font-size: 12.5px; max-width: 760px; margin-bottom: 16px; }
  .aethp-lede b { color: var(--ink); }
  .aethp-grid { display: grid; grid-template-columns: 220px 1fr; gap: 24px; align-items: center; margin-bottom: 18px; }
  @media (max-width: 820px) { .aethp-grid { grid-template-columns: 1fr; justify-items: center; } }
  .aethp-donut-wrap { position: relative; width: 200px; height: 200px; margin: 0 auto; }
  .aethp-ring { transform-origin: center;
    animation: aethp-draw 1.1s cubic-bezier(0.22,1,0.36,1) var(--d, 0s) both; }
  @keyframes aethp-draw { from { stroke-dashoffset: var(--seg); } to { stroke-dashoffset: 0; } }
  .aethp-donut-core { position: absolute; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; text-align: center; pointer-events: none; }
  .aethp-donut-core .big { font-size: 27px; font-weight: 750; letter-spacing: -0.5px; }
  .aethp-donut-core .sub { font-size: 10px; color: var(--muted); letter-spacing: 0.4px; margin-top: 2px; }
  .aethp-supply h3, .aethp-block h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px;
    color: var(--muted); margin-bottom: 10px; font-weight: 600; }
  .aethp-legend { display: flex; flex-direction: column; gap: 10px; }
  .aethp-leg { display: flex; align-items: center; gap: 10px; font-size: 13px; }
  .aethp-leg .sw { width: 11px; height: 11px; border-radius: 3px; flex: none; }
  .aethp-leg .nm { color: var(--ink-2); font-weight: 600; }
  .aethp-leg .dsc { color: var(--muted); font-size: 11px; }
  .aethp-leg .pc { margin-left: auto; font-weight: 700; font-variant-numeric: tabular-nums; }
  .aethp-block { margin-bottom: 18px; }
  .aethp-chains { display: flex; gap: 10px; flex-wrap: wrap; }
  .aethp-chip { flex: 1; min-width: 150px; background: var(--page); border: 1px solid var(--border);
    border-radius: 10px; padding: 12px 14px; cursor: pointer; transition: border-color .2s, transform .15s, box-shadow .3s; }
  .aethp-chip:hover { transform: translateY(-2px); }
  .aethp-chip.sel { border-color: var(--series-4); box-shadow: 0 0 0 1px var(--series-4) inset, 0 8px 22px rgba(0,0,0,0.3); }
  .aethp-chip .cn { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; }
  .aethp-chip .cn .st { margin-left: auto; font-size: 9px; text-transform: uppercase; letter-spacing: 0.6px;
    color: var(--muted); border: 1px solid var(--border); border-radius: 999px; padding: 2px 8px; }
  .aethp-chip.sel .cn .st { color: var(--series-2); border-color: var(--series-2); }
  .aethp-chip .ct { font-size: 11px; color: var(--muted); margin-top: 5px; }
  .aethp-gate { font-size: 11px; color: var(--muted); margin-top: 10px; line-height: 1.5; }
  .aethp-gate b { color: var(--ink-2); }
  .aethp-pillars { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  @media (max-width: 820px) { .aethp-pillars { grid-template-columns: 1fr; } }
  .aethp-pillar { background: var(--page); border: 1px solid var(--border); border-radius: 10px; padding: 13px 15px;
    transition: border-color .25s, transform .2s; }
  .aethp-pillar:hover { transform: translateY(-2px); border-color: var(--series-4); }
  .aethp-pillar .pi { font-size: 20px; }
  .aethp-pillar .pt { font-weight: 700; font-size: 13.5px; margin: 6px 0 4px; }
  .aethp-pillar .pd { font-size: 11.5px; color: var(--muted); line-height: 1.5; }
  .aethp-swap { background: var(--page); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
  .aethp-swap-h { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
  .aethp-swap-h .t { font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; color: var(--muted); font-weight: 600; }
  .aethp-swap-row { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
  .aethp-leg2 { flex: 1; min-width: 150px; }
  .aethp-leg2 label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--muted); margin-bottom: 5px; }
  .aethp-leg2 input { width: 100%; background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
    color: var(--ink); font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; padding: 9px 12px; }
  .aethp-leg2 input:focus { outline: none; border-color: var(--series-4); }
  .aethp-leg2 .u { font-size: 11px; color: var(--muted); margin-top: 4px; }
  .aethp-swap-eq { font-size: 22px; color: var(--series-4); flex: none; padding: 0 2px 8px; }
  .aethp-rate { font-size: 11.5px; color: var(--muted); margin-top: 12px; }
  .aethp-rate b { color: var(--ink-2); font-variant-numeric: tabular-nums; }
  .aethp-foot { font-size: 11px; color: var(--muted); margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border); }
  .aethp-foot .warn { color: var(--warning); font-weight: 600; }
  /* ORCHESTRATOR — Lumi's command deck (Jarvis) */
  #orch-card { position: relative; overflow: hidden; margin-bottom: 16px; }
  #orch-card::before { content: ""; position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(640px 240px at 50% -30%, rgba(57,135,229,0.14), transparent 70%); }
  .orch-crown { color: var(--series-4); margin-right: 4px; }
  .orch-sub { font-size: 11.5px; color: var(--muted); margin-bottom: 14px; max-width: 720px; }
  .orch-sub b { color: var(--ink-2); }
  .orch-roster { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
  @media (max-width: 900px) { .orch-roster { grid-template-columns: repeat(2, 1fr); } }
  .orch-int { position: relative; background: var(--page); border: 1px solid var(--border); border-radius: 10px;
    padding: 11px 13px; cursor: pointer; transition: border-color .25s, transform .18s, box-shadow .3s; }
  .orch-int:hover { transform: translateY(-2px); }
  .orch-int.sel { border-color: var(--series-1); box-shadow: 0 0 0 1px var(--series-1) inset, 0 0 18px rgba(57,135,229,0.25); }
  .orch-int.working { border-color: var(--series-4); }
  .orch-int.working::after { content: ""; position: absolute; inset: -1px; border-radius: 10px; pointer-events: none;
    border: 1px solid var(--series-4); animation: orch-scan 1.1s ease-in-out infinite; }
  @keyframes orch-scan { 0%,100% { opacity: 0.15; } 50% { opacity: 0.9; box-shadow: 0 0 14px rgba(144,133,233,0.5); } }
  .orch-int .n { display: flex; align-items: center; gap: 7px; font-weight: 700; font-size: 13px; }
  .orch-core { width: 8px; height: 8px; border-radius: 50%; flex: none; background: var(--good);
    box-shadow: 0 0 6px rgba(12,163,12,0.8); animation: breathe 2.6s ease-in-out infinite; }
  .orch-int.off .orch-core { background: var(--baseline); box-shadow: none; animation: none; }
  .orch-int .k { margin-left: auto; font-size: 9px; letter-spacing: 0.6px; text-transform: uppercase; color: var(--muted);
    border: 1px solid var(--border); border-radius: 999px; padding: 1px 7px; }
  .orch-int.model .k { color: var(--series-4); border-color: var(--series-4); }
  .orch-int .r { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--series-1); margin: 3px 0 2px; }
  .orch-int.off .r { color: var(--muted); }
  .orch-int .d { font-size: 10.5px; color: var(--muted); line-height: 1.45; }
  .orch-console { display: flex; align-items: center; gap: 8px; background: var(--page); border: 1px solid var(--border);
    border-radius: 10px; padding: 8px 12px; margin-bottom: 12px; }
  .orch-prompt { color: var(--series-4); font-size: 16px; font-weight: 700; }
  .orch-target-chip { font-size: 11px; font-weight: 700; color: var(--series-1); border: 1px solid var(--series-1);
    border-radius: 999px; padding: 2px 10px; flex: none; text-transform: uppercase; letter-spacing: 0.5px; }
  #orch-directive { flex: 1; background: none; border: none; color: var(--ink); font-size: 13px; padding: 6px 2px; }
  #orch-directive:focus { outline: none; }
  #orch-go { border-color: var(--series-1); color: var(--series-1); font-weight: 600; }
  #orch-council { border-color: var(--series-4); color: var(--series-4); font-weight: 600; flex: none; }
  #orch-council:disabled, #orch-go:disabled { opacity: 0.5; }
  .orch-task.council { border-left-color: var(--series-4); }
  .orch-task.council .who { color: var(--series-4); }
  #orch-go:disabled { opacity: 0.5; }
  /* MACHINE — the local-agent bridge */
  .machine { background: var(--page); border: 1px solid var(--border); border-radius: 10px;
    padding: 11px 14px; margin-bottom: 12px; }
  .machine:empty { display: none; }
  .mc-head { display: flex; align-items: center; gap: 8px; font-size: 12px; margin-bottom: 4px; }
  .mc-core { width: 8px; height: 8px; border-radius: 50%; flex: none; background: var(--baseline); }
  .machine.linked .mc-core { background: var(--series-2); box-shadow: 0 0 7px rgba(25,158,112,0.8);
    animation: breathe 2.6s ease-in-out infinite; }
  .mc-head .t { font-weight: 700; letter-spacing: 0.3px; }
  .mc-head .pend { margin-left: auto; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;
    color: var(--series-3); border: 1px solid var(--series-3); border-radius: 999px; padding: 1px 8px; }
  .mc-note { font-size: 11px; color: var(--muted); line-height: 1.5; }
  .mc-tasks { margin-top: 9px; display: flex; flex-direction: column; gap: 5px; }
  .mc-task { display: flex; gap: 9px; align-items: baseline; font-size: 11.5px; padding: 5px 9px;
    background: var(--surface); border-radius: 6px; border-left: 2px solid var(--baseline);
    animation: slidein 0.3s ease-out both; }
  .mc-task.done { border-left-color: var(--good); }
  .mc-task.refused { border-left-color: var(--warning); }
  .mc-task.failed { border-left-color: var(--critical); }
  .mc-task.claimed, .mc-task.queued { border-left-color: var(--series-3); }
  .mc-task .cmd { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--ink-2); flex: none; }
  .mc-task .out { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mc-task .st { margin-left: auto; flex: none; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); }
  .mc-task.done .st { color: var(--good); } .mc-task.refused .st { color: var(--warning); }
  .mc-task.failed .st { color: var(--critical); }
  /* JARVIS — the total-command bar */
  .jarvis { margin-bottom: 16px; }
  .jv-bar { display: flex; align-items: center; gap: 11px; background: var(--page);
    border: 1px solid rgba(144,133,233,0.35); border-radius: 12px; padding: 10px 14px;
    box-shadow: 0 0 24px rgba(144,133,233,0.10) inset; }
  .jv-bar:focus-within { border-color: var(--series-4); box-shadow: 0 0 26px rgba(144,133,233,0.28) inset; }
  .jv-sig { position: relative; width: 20px; height: 20px; flex: none; }
  .jv-ring { position: absolute; inset: 0; border-radius: 50%; border: 1.5px solid var(--series-4);
    opacity: 0.55; animation: jv-pulse 2.4s ease-out infinite; }
  .jv-dot { position: absolute; inset: 6px; border-radius: 50%; background: var(--series-4);
    box-shadow: 0 0 10px rgba(144,133,233,0.9); animation: breathe 2.4s ease-in-out infinite; }
  @keyframes jv-pulse { 0% { transform: scale(0.7); opacity: 0.8; } 100% { transform: scale(1.6); opacity: 0; } }
  .jarvis.busy .jv-ring { animation-duration: 0.8s; }
  #jv-order { flex: 1; background: none; border: none; color: var(--ink); font-size: 14.5px; padding: 5px 0; letter-spacing: 0.2px; }
  #jv-order:focus { outline: none; }
  #jv-go { border-color: var(--series-4); color: var(--series-4); font-weight: 700; letter-spacing: 0.4px; flex: none; }
  #jv-go:disabled { opacity: 0.5; }
  .jv-grants { display: flex; gap: 7px; flex-wrap: wrap; margin-top: 10px; align-items: center; }
  .jv-grant { font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; padding: 3px 10px;
    border-radius: 999px; border: 1px solid var(--baseline); color: var(--muted); cursor: pointer;
    transition: border-color .2s, color .2s, box-shadow .3s; user-select: none; }
  .jv-grant:hover { color: var(--ink-2); }
  .jv-grant.on { border-color: var(--good); color: var(--good); box-shadow: 0 0 10px rgba(12,163,12,0.25); }
  .jv-grants .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: var(--muted); margin-right: 3px; }
  .jv-out { margin-top: 11px; }
  .jv-out:empty { display: none; }
  .jv-res { display: flex; gap: 10px; align-items: baseline; font-size: 12.5px; background: var(--page);
    border-left: 2px solid var(--series-4); border-radius: 6px; padding: 9px 13px; animation: risein 0.35s ease-out both; }
  .jv-res.refused { border-left-color: var(--warning); }
  .jv-res.unrouted, .jv-res.failed { border-left-color: var(--critical); }
  .jv-res .cap { font-weight: 700; color: var(--series-4); flex: none; }
  .jv-res.refused .cap { color: var(--warning); }
  .jv-res.unrouted .cap, .jv-res.failed .cap { color: var(--critical); }
  .jv-res .txt { color: var(--ink-2); white-space: pre-wrap; }
  .jv-boundary { font-size: 10.5px; color: var(--muted); margin-top: 9px; line-height: 1.5; }
  /* Voice: mic in, speech out. Both are off until asked for. */
  .jv-icon { flex: none; border: 1px solid var(--line); background: none; color: var(--muted);
    border-radius: 8px; width: 32px; height: 30px; cursor: pointer; font-size: 13px; line-height: 1;
    transition: color .18s, border-color .18s, box-shadow .18s; }
  .jv-icon:hover:not(:disabled) { color: var(--ink-2); border-color: var(--ink-2); }
  .jv-icon:disabled { opacity: 0.35; cursor: not-allowed; }
  .jv-icon.on { color: var(--series-4); border-color: var(--series-4); box-shadow: 0 0 12px rgba(144,133,233,0.3); }
  #jv-mic.listening { color: var(--critical); border-color: var(--critical);
    box-shadow: 0 0 0 0 rgba(197,48,48,0.55); animation: jv-listen 1.3s ease-out infinite; }
  @keyframes jv-listen { 0% { box-shadow: 0 0 0 0 rgba(197,48,48,0.5); } 100% { box-shadow: 0 0 0 12px rgba(197,48,48,0); } }
  /* While she listens, the signal becomes a live waveform. */
  .jv-wave { display: none; gap: 2px; align-items: center; height: 18px; flex: none; }
  .jarvis.listening .jv-wave { display: flex; }
  .jarvis.listening .jv-sig { display: none; }
  .jv-wave i { display: block; width: 2px; background: var(--series-4); border-radius: 2px;
    animation: jv-eq .9s ease-in-out infinite; }
  .jv-wave i:nth-child(1) { height: 6px; animation-delay: 0s; }
  .jv-wave i:nth-child(2) { height: 14px; animation-delay: .12s; }
  .jv-wave i:nth-child(3) { height: 9px; animation-delay: .24s; }
  .jv-wave i:nth-child(4) { height: 16px; animation-delay: .36s; }
  .jv-wave i:nth-child(5) { height: 7px; animation-delay: .48s; }
  @keyframes jv-eq { 0%,100% { transform: scaleY(0.4); } 50% { transform: scaleY(1); } }
  .jv-heard { font-size: 11px; color: var(--series-4); margin-top: 8px; letter-spacing: 0.3px; }
  .jv-heard:empty { display: none; }
  /* The transcript: every order this session, newest first. */
  .jv-res + .jv-res { margin-top: 5px; opacity: 0.72; }
  .jv-res .ts { color: var(--muted); font-size: 10px; flex: none; margin-left: auto; }
  /* Integrity chip — structural self-check, always in view beside the grants. */
  .jv-integ { font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; padding: 3px 10px;
    border: 1px solid var(--line); border-radius: 999px; color: var(--muted); cursor: pointer; margin-left: auto; }
  .jv-integ.ok { border-color: var(--good); color: var(--good); }
  .jv-integ.broken { border-color: var(--critical); color: var(--critical); font-weight: 700;
    animation: jv-alarm 1.8s ease-in-out infinite; }
  @keyframes jv-alarm { 0%,100% { box-shadow: 0 0 0 0 rgba(197,48,48,0); } 50% { box-shadow: 0 0 12px 0 rgba(197,48,48,0.45); } }
  /* Bridge callers — who has walked through the inbound doors. */
  .callers { margin-top: 10px; display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
  .callers:empty { display: none; }
  .callers .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: var(--muted); }
  .caller { font-size: 10.5px; padding: 3px 9px; border: 1px solid var(--line); border-radius: 999px;
    color: var(--ink-2); display: inline-flex; gap: 6px; align-items: center; }
  .caller .b { color: var(--muted); font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.5px; }
  .caller.stranger { border-color: var(--warning); color: var(--warning); }
  .caller.stranger .trust { cursor: pointer; border: 1px solid var(--warning); border-radius: 5px;
    padding: 0 5px; font-size: 9.5px; letter-spacing: 0.4px; }
  .caller.stranger .trust:hover { background: var(--warning); color: var(--page); }
  /* Readiness — what is still unwired, with the command to fix it. */
  .ready { margin-top: 10px; display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
  .ready:empty { display: none; }
  .ready .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: var(--muted); }
  .rdy { font-size: 10.5px; padding: 3px 9px; border: 1px solid var(--line); border-radius: 999px; color: var(--muted); }
  .rdy.on { border-color: var(--good); color: var(--good); }
  .rdy.req { border-color: var(--critical); color: var(--critical); font-weight: 700; }
  .rdy-next { font-size: 11px; color: var(--ink-2); margin-top: 8px; }
  .rdy-next code { background: var(--page); padding: 2px 7px; border-radius: 5px; color: var(--series-4);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10.5px; }
  /* Source badges — a simulated number must never look like a real one. */
  .src { font-size: 9px; text-transform: uppercase; letter-spacing: 0.7px; padding: 2px 8px;
    border-radius: 999px; border: 1px solid var(--line); color: var(--muted); margin-left: 9px;
    vertical-align: middle; font-weight: 700; cursor: help; white-space: nowrap; }
  .src.live { border-color: var(--good); color: var(--good); }
  .src.ledger { border-color: var(--series-2); color: var(--series-2); }
  .src.measured { border-color: var(--series-4); color: var(--series-4); }
  .src.sim { border-color: var(--warning); color: var(--warning); }
  .src.offline { border-color: var(--line); color: var(--muted); }
  /* Automation health — a stopped cron must not look like a healthy one. */
  .auto { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .auto-v { font-size: 11px; font-weight: 700; letter-spacing: 0.8px; padding: 4px 12px;
    border-radius: 999px; border: 1px solid var(--line); color: var(--muted); }
  .auto-v.healthy { border-color: var(--good); color: var(--good); }
  .auto-v.late { border-color: var(--warning); color: var(--warning); }
  .auto-v.stalled { border-color: var(--critical); color: var(--critical);
    animation: alertglow 1.8s ease-in-out infinite; }
  .auto-v.never { border-color: var(--line); color: var(--muted); }
  .auto-d { font-size: 12px; color: var(--ink-2); flex: 1; min-width: 260px; line-height: 1.5; }
  .auto-stat { font-size: 11px; color: var(--muted); }
  .auto-stat b { color: var(--ink); font-weight: 650; }
  .auto-runs { margin-top: 11px; display: grid; gap: 4px; }
  .auto-run { display: flex; gap: 10px; align-items: baseline; font-size: 11.5px;
    background: var(--page); border-left: 2px solid var(--series-4); border-radius: 0 7px 7px 0; padding: 5px 10px; }
  .auto-run.bad { border-left-color: var(--critical); }
  .auto-run .k { font-weight: 700; color: var(--series-4); }
  .auto-run.bad .k { color: var(--critical); }
  .auto-run .s { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--muted);
    border: 1px solid var(--line); border-radius: 4px; padding: 0 5px; }
  .auto-run .t { color: var(--ink-2); flex: 1; }
  .auto-run .w { color: var(--muted); font-size: 10px; }
  .integ-breaks { margin-top: 10px; }
  .integ-break { font-size: 11.5px; border-left: 2px solid var(--critical); padding: 6px 10px;
    background: var(--page); border-radius: 0 7px 7px 0; margin-top: 5px; }
  .integ-break .n { color: var(--critical); font-weight: 700; margin-right: 7px; }
  .integ-break .f { display: block; color: var(--muted); font-size: 10.5px; margin-top: 3px; }
  /* Council chamber — side-by-side comparison of what each model said */
  .orch-chamber { margin-bottom: 12px; }
  .orch-chamber:empty { display: none; }
  .oc-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 9px; animation: risein 0.4s ease-out both; }
  .oc-head .t { font-size: 11px; text-transform: uppercase; letter-spacing: 0.9px; color: var(--series-4); font-weight: 700; }
  .oc-head .q { font-size: 12px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .oc-head .x { margin-left: auto; cursor: pointer; color: var(--muted); font-size: 15px; line-height: 1; flex: none; }
  .oc-head .x:hover { color: var(--ink); }
  .oc-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; margin-bottom: 9px; }
  .oc-voice { background: var(--page); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px;
    animation: risein 0.45s ease-out both; }
  .oc-voice:nth-child(2) { animation-delay: 0.09s; }
  .oc-voice:nth-child(3) { animation-delay: 0.18s; }
  .oc-voice.done { border-color: rgba(144,133,233,0.5); }
  .oc-voice .vh { display: flex; align-items: center; gap: 7px; margin-bottom: 7px; }
  .oc-voice .vn { font-weight: 700; font-size: 13px; }
  .oc-voice .vs { margin-left: auto; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px;
    border: 1px solid var(--good); color: var(--good); border-radius: 999px; padding: 1px 8px; }
  .oc-voice.offline .vs { border-color: var(--muted); color: var(--muted); }
  .oc-voice.failed .vs { border-color: var(--critical); color: var(--critical); }
  .oc-voice .vt { font-size: 12px; color: var(--ink-2); line-height: 1.55; white-space: pre-wrap;
    max-height: 260px; overflow-y: auto; }
  .oc-voice.offline .vt, .oc-voice.failed .vt { color: var(--muted); }
  .oc-verdict { font-size: 12px; color: var(--ink-2); background: var(--page); border-left: 2px solid var(--series-4);
    border-radius: 6px; padding: 8px 12px; animation: risein 0.5s ease-out 0.24s both; }
  .oc-verdict b { color: var(--series-4); }
  .orch-log { display: flex; flex-direction: column; gap: 6px; }
  .orch-task { display: flex; gap: 10px; align-items: baseline; font-size: 12px; padding: 6px 10px;
    background: var(--page); border-left: 2px solid var(--series-1); border-radius: 6px; animation: slidein 0.35s ease-out both; }
  .orch-task.offline { border-left-color: var(--baseline); }
  .orch-task.failed { border-left-color: var(--critical); }
  .orch-task .who { font-weight: 700; flex: none; }
  .orch-task .dir { color: var(--muted); flex: none; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .orch-task .res { color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .orch-task .st { margin-left: auto; flex: none; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px;
    padding: 1px 8px; border-radius: 999px; border: 1px solid var(--good); color: var(--good); }
  .orch-task.offline .st { border-color: var(--muted); color: var(--muted); }
  .orch-task.failed .st { border-color: var(--critical); color: var(--critical); }
  /* INMOTION RP — city economy */
  .rp-tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 12px; }
  @media (max-width: 820px) { .rp-tiles { grid-template-columns: repeat(2, 1fr); } }
  .rp-tile { background: var(--page); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; }
  .rp-tile .n { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .rp-tile .l { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
  .rp-flow { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); margin-bottom: 12px; }
  .rp-flow b { color: var(--ink-2); font-variant-numeric: tabular-nums; }
  .rp-tx { display: flex; gap: 8px; font-size: 12px; padding: 4px 0; border-bottom: 1px solid var(--grid); align-items: baseline; }
  .rp-tx:last-child { border-bottom: none; }
  .rp-tx .who { color: var(--ink-2); }
  .rp-tx .memo { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rp-tx .amt { margin-left: auto; font-variant-numeric: tabular-nums; font-weight: 600; flex: none; }
  .rp-tx .amt.earn { color: var(--good); }
  .rp-tx .amt.spend { color: var(--series-3); }
  .rp-off { font-size: 12px; color: var(--muted); }
  /* SHIELD — the showpiece */
  #shield-card { margin-bottom: 16px; position: relative; overflow: hidden; }
  .shield-card::before { content: ""; position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(600px 200px at 18% -20%, rgba(57,135,229,0.10), transparent 70%); }
  .shield-grid { display: grid; grid-template-columns: 200px 1fr 1.1fr; gap: 18px; align-items: center; }
  @media (max-width: 900px) { .shield-grid { grid-template-columns: 1fr; } }
  .gauge-wrap { text-align: center; }
  .gauge-score { font-size: 34px; font-weight: 750; font-variant-numeric: tabular-nums; letter-spacing: -1px; }
  .gauge-grade { font-size: 12px; color: var(--muted); letter-spacing: 1px; }
  .gauge-ruleset { font-size: 11px; color: var(--series-4); margin-top: 4px; }
  .radar-wrap { text-align: center; }
  .dims { display: flex; flex-direction: column; gap: 7px; }
  .dim { }
  .dim .r { display: flex; justify-content: space-between; font-size: 12px; }
  .dim .r b { color: var(--ink); }
  .dim .r .v { color: var(--ink-2); font-variant-numeric: tabular-nums; }
  .dim .bar-track { margin-top: 3px; }
  .shield-lower { display: grid; grid-template-columns: 1.3fr 1fr; gap: 18px; margin-top: 16px; }
  @media (max-width: 900px) { .shield-lower { grid-template-columns: 1fr; } }
  .shield-lower h3 { font-size: 11px; letter-spacing: 0.6px; color: var(--muted); text-transform: uppercase; margin-bottom: 8px; }
  .finding { display: flex; gap: 8px; align-items: baseline; font-size: 12px; padding: 4px 0; border-bottom: 1px solid var(--grid); }
  .finding:last-child { border-bottom: none; }
  .finding .sev { font-size: 9px; font-weight: 700; letter-spacing: 0.5px; padding: 1px 6px; border-radius: 4px; text-transform: uppercase; flex: none; }
  .finding .sev.critical { color: var(--critical); border: 1px solid var(--critical); }
  .finding .sev.warn { color: var(--warning); border: 1px solid var(--warning); }
  .finding .sev.info { color: var(--muted); border: 1px solid var(--border); }
  .finding .ft { color: var(--ink-2); }
  .finding .fd { color: var(--muted); }
  .kyc-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 13px; }
  .kyc-badge { font-size: 10px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--series-2); color: var(--series-2); letter-spacing: 0.4px; }
  .web3-line { font-size: 12px; color: var(--muted); margin-top: 6px; }
  .gauge-arc { transition: stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1); }
  .radar-poly { transition: all 0.9s cubic-bezier(0.22,1,0.36,1); }
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
  <div class="brand">
    <svg class="logo-mark" viewBox="0 0 48 48" width="44" height="44" role="img" aria-label="Lumi logo">
      <defs>
        <radialGradient id="lm-core" cx="42%" cy="38%" r="65%">
          <stop offset="0%" stop-color="#eaf6ff"/>
          <stop offset="40%" stop-color="#3987e5"/>
          <stop offset="100%" stop-color="#1c4f95"/>
        </radialGradient>
        <radialGradient id="lm-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#5aa0ff" stop-opacity="0.55"/>
          <stop offset="60%" stop-color="#3987e5" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="#3987e5" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="lm-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#3987e5"/>
          <stop offset="50%" stop-color="#9085e9"/>
          <stop offset="100%" stop-color="#199e70"/>
        </linearGradient>
      </defs>
      <circle class="lm-halo" cx="24" cy="24" r="15" fill="url(#lm-halo)"/>
      <g class="lm-o1"><ellipse cx="24" cy="24" rx="22" ry="8.5" fill="none" stroke="url(#lm-ring)" stroke-width="1.4" opacity="0.9"/></g>
      <g class="lm-o2"><ellipse cx="24" cy="24" rx="22" ry="8.5" fill="none" stroke="url(#lm-ring)" stroke-width="1.4" opacity="0.55" transform="rotate(60 24 24)"/></g>
      <g class="lm-o3"><ellipse cx="24" cy="24" rx="22" ry="8.5" fill="none" stroke="url(#lm-ring)" stroke-width="1.1" opacity="0.32" transform="rotate(120 24 24)"/></g>
      <g class="lm-p1"><circle cx="24" cy="7" r="1.7" fill="#bfe4ff"/></g>
      <g class="lm-p2"><circle cx="24" cy="9" r="1.4" fill="#9085e9"/></g>
      <g class="lm-p3"><circle cx="24" cy="8" r="1.2" fill="#199e70"/></g>
      <circle class="lm-core" cx="24" cy="24" r="8.5" fill="url(#lm-core)"/>
      <circle cx="24" cy="24" r="8.5" fill="none" stroke="#cfebff" stroke-width="0.6" opacity="0.7"/>
    </svg>
    <div class="brand-txt">
      <span class="brand-name">LUMI</span>
      <span class="brand-tag">CREATOR&nbsp;COCKPIT · ÆTHER</span>
    </div>
  </div>
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
    <h2>LUMI — evolution<span class="src" data-src="lumi"></span></h2>
    <div id="lumi-panel"></div>
  </div>
  <div class="card">
    <h2>QUESTS — Lumi's task line</h2>
    <div id="quests" class="quests"></div>
  </div>
</div>

<div class="card" id="orch-card">
  <h2><span class="orch-crown">◈</span> ORCHESTRATOR — Lumi commands every intelligence<span class="src" data-src="orchestrator"></span></h2>
  <div class="jarvis">
    <div class="jv-bar">
      <span class="jv-sig"><span class="jv-ring"></span><span class="jv-dot"></span></span>
      <span class="jv-wave"><i></i><i></i><i></i><i></i><i></i></span>
      <input id="jv-order" type="text" maxlength="2000" placeholder="Command Lumi… (halt · run a cycle · audit · self check · sweep · scan · research X · council X)">
      <button class="jv-icon" id="jv-mic" title="Speak an order">🎙</button>
      <button class="jv-icon" id="jv-voice" title="Lumi speaks her replies aloud">🔈</button>
      <button class="jv-icon" id="jv-key" title="Creator key — needed to spend, publish, act unattended, or reach your machine">🔑</button>
      <button id="jv-go">Execute</button>
    </div>
    <div class="jv-heard" id="jv-heard"></div>
    <div class="jv-grants" id="jv-grants"></div>
    <div class="callers" id="jv-callers"></div>
    <div class="ready" id="jv-ready"></div>
    <div class="rdy-next" id="jv-ready-next"></div>
    <div class="integ-breaks" id="jv-integ-breaks"></div>
    <div class="jv-out" id="jv-out"></div>
    <div class="jv-boundary" id="jv-boundary"></div>
  </div>
  <div class="orch-sub">Agents run their real engine actions on dispatch. Models link through their APIs — Claude comes online when <b>ANTHROPIC_API_KEY</b> is set. Every order and outcome is logged.</div>
  <div class="orch-roster" id="orch-roster"></div>
  <div class="machine" id="machine-panel"></div>
  <div class="orch-console">
    <span class="orch-prompt">⌁</span>
    <span class="orch-target-chip" id="orch-target-chip">lumi</span>
    <input id="orch-directive" type="text" maxlength="2000" placeholder="Directive… (e.g. run a cycle · advise on risk limits)">
    <button id="orch-go">Dispatch</button>
    <button id="orch-council" title="Put this directive to every model at once">⚖ Council</button>
  </div>
  <div class="orch-chamber" id="orch-chamber"></div>
  <div class="orch-log" id="orch-log"></div>
</div>

<div class="card" id="automation-card">
  <h2>AUTOMATION — is Lumi actually running herself?<span class="src" data-src="automation"></span></h2>
  <div class="auto">
    <span class="auto-v" id="auto-verdict">—</span>
    <span class="auto-d" id="auto-detail"></span>
    <span class="auto-stat" id="auto-stat"></span>
  </div>
  <div class="auto-runs" id="auto-runs"></div>
</div>

<div class="card" id="training-card">
  <h2>AETHER'S SCHOOL — training on the science of trades (Invest realm)</h2>
  <div id="training-panel"></div>
</div>

<div class="card wallet-card" id="wallet-card">
  <h2>WALLET — your AETHER, self-custody &amp; on Sui<span class="src" data-src="wallet"></span></h2>
  <div id="wallet-panel"></div>
</div>

<div class="card" id="aether-card">
  <h2>AETHER TOKEN — the colony's AI-credit currency<span class="src" data-src="aether"></span></h2>
  <div id="aether-panel"></div>
</div>

<div class="card" id="aethp-card">
  <div class="aethp-h">
    <div class="aethp-title"><span class="aeth-glyph">Æther · AETH</span> — Aether realm native token</div>
    <span class="aethp-badge"><span class="bdot"></span>Design preview — not launched</span>
  </div>
  <div class="aethp-lede">The token of the Aether finance realm — a utility credit for the InMotion ecosystem. <b>Not a security.</b> No yield, no price promises — value is what it unlocks. No contract, no wallet, no money movement here.</div>

  <div class="aethp-grid">
    <div class="aethp-donut-wrap">
      <svg width="200" height="200" viewBox="0 0 140 140" role="img" aria-label="AETH supply model: 60% mining emission, 30% utility swap, 10% ecosystem reserve">
        <circle cx="70" cy="70" r="54" fill="none" stroke="var(--grid)" stroke-width="20" opacity="0.25"/>
        <circle class="aethp-ring" cx="70" cy="70" r="54" fill="none" stroke="var(--series-4)" stroke-width="20" stroke-dasharray="201.58 137.71" transform="rotate(-90 70 70)" style="--seg:201.58;--d:0s"/>
        <circle class="aethp-ring" cx="70" cy="70" r="54" fill="none" stroke="var(--series-1)" stroke-width="20" stroke-dasharray="99.79 239.50" transform="rotate(126 70 70)" style="--seg:99.79;--d:.35s"/>
        <circle class="aethp-ring" cx="70" cy="70" r="54" fill="none" stroke="var(--series-2)" stroke-width="20" stroke-dasharray="31.93 307.36" transform="rotate(234 70 70)" style="--seg:31.93;--d:.7s"/>
      </svg>
      <div class="aethp-donut-core"><span class="big">100M</span><span class="sub">18 decimals · fixed cap</span></div>
    </div>
    <div class="aethp-supply">
      <h3>Supply model (design) · max 100,000,000</h3>
      <div class="aethp-legend">
        <div class="aethp-leg"><span class="sw" style="background:var(--series-4)"></span><span class="nm">Mining emission</span><span class="dsc">disclosed compute → credits</span><span class="pc">60%</span></div>
        <div class="aethp-leg"><span class="sw" style="background:var(--series-1)"></span><span class="nm">Utility swap</span><span class="dsc">credits ⇄ AETH pool</span><span class="pc">30%</span></div>
        <div class="aethp-leg"><span class="sw" style="background:var(--series-2)"></span><span class="nm">Ecosystem reserve</span><span class="dsc">grants · integrations</span><span class="pc">10%</span></div>
      </div>
    </div>
  </div>

  <div class="aethp-block">
    <h3>Candidate chains — switch anytime pre-launch</h3>
    <div class="aethp-chains" id="aethp-chains">
      <div class="aethp-chip sel" data-chain="Sui"><div class="cn">Sui<span class="st">active</span></div><div class="ct">SuiCoin&lt;T&gt; · testnet-ready</div></div>
      <div class="aethp-chip" data-chain="Solana"><div class="cn">Solana<span class="st">candidate</span></div><div class="ct">SPL Token · devnet-ready</div></div>
      <div class="aethp-chip" data-chain="EVM"><div class="cn">EVM<span class="st">reference</span></div><div class="ct">ERC-20 · reference impl</div></div>
    </div>
    <div class="aethp-gate">Build + test on each (testnet/devnet), then the chain is chosen at launch with counsel — <b>Gate 1</b>. Switching is one config value; nothing here is live. Active candidate: <b id="aethp-active">Sui</b>.</div>
  </div>

  <div class="aethp-block">
    <h3>What AETH does</h3>
    <div class="aethp-pillars">
      <div class="aethp-pillar"><div class="pi">⛏</div><div class="pt">Earn</div><div class="pd">Contribute disclosed compute → app credits. Transparent, consented, one-click off.</div></div>
      <div class="aethp-pillar"><div class="pi">✦</div><div class="pt">Spend</div><div class="pd">Use it as utility: Studio runs, Aether education, realm access. Value = what it unlocks.</div></div>
      <div class="aethp-pillar"><div class="pi">⇄</div><div class="pt">Swap</div><div class="pd">Convert credits ⇄ AETH. Self-custody only — InMotion never holds your funds.</div></div>
    </div>
  </div>

  <div class="aethp-swap">
    <div class="aethp-swap-h"><span style="font-size:16px">⇄</span><span class="t">Swap credits → AETH · design preview</span></div>
    <div class="aethp-swap-row">
      <div class="aethp-leg2"><label>Credits</label><input id="aethp-credits" type="number" min="0" step="100" value="1500" inputmode="numeric"><div class="u">app credits</div></div>
      <div class="aethp-swap-eq">⇄</div>
      <div class="aethp-leg2"><label>AETH</label><input id="aethp-aeth" type="number" min="0" step="1" value="15" inputmode="decimal"><div class="u">AETH (preview)</div></div>
    </div>
    <div class="aethp-rate">Rate: <b>100 credits ≈ 1 AETH</b> · <b>1 AETH ≈ 100 credits</b>. Preview math only — editable, no money moves.</div>
  </div>

  <div class="aethp-foot"><span class="warn">Design only.</span> Æther (AETH) is not launched. No live swap, no wallet, no money movement — this panel is a design preview of the intended token.</div>
</div>

<div class="card" id="defi-card">
  <h2>DEFI — AETHER liquidity · pool · vaults · lending<span class="src" data-src="defi"></span></h2>
  <div id="defi-panel"></div>
</div>

<div class="section-h">GAMING REALM — InMotion RP · Roblox city</div>
<div class="card" id="rp-card">
  <h2>INMOTION RP — citizens · paychecks · shops, all on the AETHER ledger<span class="src" data-src="rp"></span></h2>
  <div id="rp-panel"></div>
</div>

<div class="card" id="growth-card">
  <h2>GROWTH — PR · content · campaigns · lead-gen<span class="src" data-src="growth"></span></h2>
  <div id="growth-panel"></div>
</div>

<div class="card shield-card" id="shield-card">
  <h2>SHIELD — web3 security · red-team · decentralization · privacy-first KYC<span class="src" data-src="shield"></span></h2>
  <div id="shield-panel"></div>
</div>

<div class="section-h">AETHER REALM — trading · token · wallet · liquidity</div>
<div class="tiles" id="tiles"></div>

<div class="card" id="risk-card">
  <h2>RISK GATES — capital protection &amp; live feed<span class="src" data-src="market"></span></h2>
  <div id="risk-panel"></div>
</div>

<div class="grid2">
  <div class="card">
    <h2>COLONY EQUITY — paper capital over market ticks<span class="src" data-src="trading"></span></h2>
    <div class="chart-wrap">
      <svg id="equity-chart" width="100%" height="240" viewBox="0 0 640 240" preserveAspectRatio="none" role="img" aria-label="Colony equity line chart"></svg>
      <div class="tooltip" id="equity-tip"></div>
    </div>
  </div>
  <div class="card">
    <h2>WIN RATE BY STRATEGY — closed trades only<span class="src" data-src="trading"></span></h2>
    <div class="chart-wrap">
      <svg id="winrate-chart" width="100%" height="240" viewBox="0 0 420 240" role="img" aria-label="Win rate by strategy bar chart"></svg>
      <div class="tooltip" id="winrate-tip"></div>
    </div>
  </div>
</div>

<div class="grid2b">
  <div class="card">
    <h2>BOTS — sized by soul, compounding by results<span class="src" data-src="trading"></span></h2>
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
    <h2>STRATEGIES — lineage &amp; evidence<span class="src" data-src="trading"></span></h2>
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
    <h2>GUARDIAN — protection checks<span class="src" data-src="guardian"></span></h2>
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

<footer>Lumi (front-end intellect) · Reg (engine) · Databank (memory) — seven realms: Invest/Aether · Guardian · Tech · Wellness · Shield · Growth · Gaming. Paper trading only, every trade recorded, every lesson kept.</footer>

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

let lastAnalytics = null;
async function load() {
  if (loading || document.hidden) return;   // never poll a hidden tab
  const seq = ++loadSeq;
  loading = true;
  try {
    const res = await fetch("/analytics/overview?_=" + Date.now(), { cache: "no-store" });
    const { result } = await res.json();
    if (seq !== loadSeq) return;   // a newer load already won — drop this stale response
    lastAnalytics = result || {};
    render(lastAnalytics);
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
  renderShield(d.shield || null);
  renderWallet(d.wallets || []);
  renderDefi(d.defi || null);
  renderGrowth(d.growth || null);
  renderRp(d.rp || null);
  renderOrchestrator(d.orchestrator || null);
  renderChamber(lastCouncil);
  renderJarvis(d.command || null, d.integrity || null, d.bridgeCallers || [], d.readiness || null);
  renderSources(d.sources || []);
  renderAutomation(d.automation || null);
  renderMachine(d.local || null);
  firstPaint = false;
}

// ---- ORCHESTRATOR: Lumi's command deck ----
let orchTarget = "lumi", orchBusy = false;
function renderOrchestrator(o) {
  const rosterEl = $("orch-roster"), logEl = $("orch-log");
  if (!rosterEl) return;
  const roster = (o && o.roster) || [];
  if (!roster.some(i => i.name === orchTarget)) orchTarget = roster.length ? roster[0].name : "lumi";
  rosterEl.innerHTML = roster.map(i =>
    '<div class="orch-int ' + (i.status === "offline" ? "off " : "") + (i.kind === "model" ? "model " : "") +
      (i.name === orchTarget ? "sel " : "") + (orchBusy && i.name === orchTarget ? "working" : "") +
      '" data-n="' + esc(i.name) + '">' +
      '<div class="n"><span class="orch-core"></span>' + esc(i.name) + '<span class="k">' + esc(i.kind) + '</span></div>' +
      '<div class="r">' + esc(i.role) + ' · ' + esc(i.status) + '</div>' +
      '<div class="d">' + esc(i.detail) + '</div>' +
    '</div>'
  ).join("");
  rosterEl.querySelectorAll(".orch-int").forEach(el => {
    el.onclick = () => { orchTarget = el.dataset.n; const chip = $("orch-target-chip"); if (chip) chip.textContent = orchTarget; renderOrchestrator(o); };
  });
  const chip = $("orch-target-chip");
  if (chip) chip.textContent = orchTarget;
  if (logEl) {
    logEl.innerHTML = ((o && o.tasks) || []).map(t =>
      '<div class="orch-task ' + esc(t.status) + '"><span class="who">' + esc(t.target) + '</span>' +
      '<span class="dir">' + esc(t.directive) + '</span><span class="res">' + esc(t.result) + '</span>' +
      '<span class="st">' + esc(t.status) + '</span></div>'
    ).join("") || '<div class="empty">No dispatches yet — pick an intelligence and give the order.</div>';
  }
}

// MACHINE — the local-agent bridge. "linked" means a secret is configured; the
// task timestamps show whether an agent is actually picking work up.
function renderMachine(m) {
  const el = $("machine-panel");
  if (!el) return;
  if (!m) { el.innerHTML = ""; return; }
  el.className = "machine" + (m.linked ? " linked" : "");
  const tasks = (m.tasks || []).map(t =>
    '<div class="mc-task ' + esc(t.status) + '"><span class="cmd">' + esc(t.task) + '</span>' +
    '<span class="out">' + esc(t.result || (t.status === "queued" ? "waiting for your machine…" : "")) + '</span>' +
    '<span class="st">' + esc(t.status) + '</span></div>'
  ).join("");
  el.innerHTML =
    '<div class="mc-head"><span class="mc-core"></span><span class="t">MACHINE — ' +
      (m.linked ? "bridge configured" : "not linked") + '</span>' +
      (m.pending ? '<span class="pend">' + m.pending + ' pending</span>' : '') + '</div>' +
    '<div class="mc-note">' + esc(m.note) + '</div>' +
    (tasks ? '<div class="mc-tasks">' + tasks + '</div>' : '');
}

// Stamp every panel with where its numbers come from. A panel with no entry
// gets nothing rather than a guess — an unlabelled panel is better than a
// wrong label.
function renderAutomation(a) {
  const v = $("auto-verdict"), d = $("auto-detail"), st = $("auto-stat"), rs = $("auto-runs");
  if (!v || !a) return;
  v.textContent = a.label;
  v.className = "auto-v " + a.verdict;
  d.textContent = a.detail;
  st.innerHTML = '<b>' + esc(String(a.runs24h)) + '</b> run(s) in 24h · <b>' +
    esc(String(a.failures24h)) + '</b> failed · expected every <b>' + esc(String(a.expectedEveryMinutes)) + 'm</b>';
  rs.innerHTML = (a.recent || []).map(r =>
    '<div class="auto-run ' + (r.ok ? "" : "bad") + '"><span class="k">' + esc(r.kind) + '</span>' +
    '<span class="s">' + esc(r.source) + '</span><span class="t">' + esc(r.detail) + '</span>' +
    '<span class="w">' + esc(String(r.ms)) + 'ms · ' + esc(r.at) + '</span></div>'
  ).join("");
}

function renderSources(sources) {
  const by = {};
  (sources || []).forEach(s => { by[s.panel] = s; });
  document.querySelectorAll(".src[data-src]").forEach(el => {
    const s = by[el.dataset.src];
    if (!s) { el.textContent = ""; el.className = "src"; return; }
    el.textContent = s.label;
    el.className = "src " + s.kind;
    el.title = s.detail;
  });
}

// JARVIS — grants, boundary, structural integrity, and the order transcript.
let lastCommand = null;
let transcript = [];   // every order this session, newest first
let orderHistory = []; // for ↑/↓ recall in the input
function renderJarvis(cmd, integrity, callers, readiness) {
  const g = $("jv-grants"), b = $("jv-boundary"), o = $("jv-out");
  if (!g) return;
  if (cmd) {
    let chips = '<span class="lbl">Authority</span>' + (cmd.authority || []).map(a =>
      '<span class="jv-grant ' + (a.granted ? "on" : "") + '" data-s="' + esc(a.scope) + '" title="' + esc(a.detail) + '">' +
      (a.granted ? "✓ " : "") + esc(a.scope) + '</span>'
    ).join("");
    // Structural integrity sits beside the grants because it is the one number
    // that says whether anything else on this screen can be believed.
    if (integrity) {
      const broken = integrity.counts ? integrity.counts.fail : 0;
      chips += '<span class="jv-integ ' + (broken > 0 ? "broken" : "ok") + '" id="jv-integ" ' +
        'title="Structural self-check: does the code still agree with the database? Click to re-run.">' +
        (broken > 0 ? "⚠ " + broken + " integrity break" + (broken > 1 ? "s" : "") : "◈ integrity " + integrity.score + "/100") +
        '</span>';
    }
    g.innerHTML = chips;
    g.querySelectorAll(".jv-grant").forEach(el => {
      el.onclick = async () => {
        const on = el.classList.contains("on");
        const r = await fetch("/command/authority", { method: "PATCH", cache: "no-store",
          headers: ctlHeaders(),
          body: JSON.stringify({ scope: el.dataset.s, granted: !on }) });
        if (!r.ok) {
          // A refused grant must say why, not silently snap back.
          const e = await r.json().catch(() => null);
          const msg = e && e.errors && e.errors[0] ? e.errors[0].message : "That grant was refused.";
          const out = $("jv-out");
          if (out) out.innerHTML = '<div class="jv-res refused"><span class="cap">authority</span><span class="txt">' + esc(msg) + '</span></div>' + out.innerHTML;
        }
        await load();
      };
    });
    const ic = $("jv-integ");
    if (ic) ic.onclick = async () => {
      ic.textContent = "◈ checking…";
      try { await fetch("/integrity/scan", { method: "POST", cache: "no-store" }); } catch (e) {}
      await load();
    };
    if (b) b.textContent = cmd.boundary || "";
  }
  // Who has been through the inbound doors. A caller nobody has vouched for is
  // amber with a one-click answer — the question should be cheap to close.
  const cl = $("jv-callers");
  if (cl) {
    const list = callers || [];
    cl.innerHTML = list.length === 0 ? "" : '<span class="lbl">Bridge callers</span>' + list.map(c =>
      '<span class="caller ' + (c.trusted ? "" : "stranger") + '">' +
      '<span class="b">' + esc(c.bridge) + '</span>' + esc(c.caller) +
      ' <span style="opacity:.6">×' + esc(String(c.calls)) + '</span>' +
      (c.trusted ? "" : '<span class="trust" data-b="' + esc(c.bridge) + '" data-c="' + esc(c.caller) + '">MINE</span>') +
      '</span>'
    ).join("");
    cl.querySelectorAll(".trust").forEach(el => {
      el.onclick = async () => {
        await fetch("/bridges/trust", { method: "POST", cache: "no-store",
          headers: ctlHeaders(),
          body: JSON.stringify({ bridge: el.dataset.b, caller: el.dataset.c, trusted: true }) });
        await load();
      };
    });
  }

  // What is still unwired. A missing REQUIRED switch is red, because the
  // system will refuse things and the reason should never be a mystery.
  const rd = $("jv-ready"), rn = $("jv-ready-next");
  if (rd && readiness) {
    rd.innerHTML = '<span class="lbl">Wired</span>' + (readiness.items || []).map(i =>
      '<span class="rdy ' + (i.configured ? "on" : (i.need === "required" ? "req" : "")) + '" title="' +
      esc(i.unlocks) + (i.configured ? "" : " — " + esc(i.command)) + '">' +
      (i.configured ? "✓ " : (i.need === "required" ? "! " : "")) + esc(i.name) + '</span>'
    ).join("");
    if (rn) {
      // The single next step, with its command set apart so it can be copied.
      const step = readiness.nextStep || "";
      const cut = step.indexOf("npx wrangler") >= 0 ? step.indexOf("npx wrangler") : step.indexOf("bash ");
      rn.innerHTML = readiness.configured === readiness.total
        ? ""
        : cut > 0
          ? esc(step.slice(0, cut)) + '<code>' + esc(step.slice(cut)) + '</code>'
          : esc(step);
    }
  }

  // A failing check is useless without the remedy, so both are shown.
  const bl = $("jv-integ-breaks");
  if (bl) {
    const fails = integrity ? (integrity.checks || []).filter(c => c.status === "fail") : [];
    bl.innerHTML = fails.map(c =>
      '<div class="integ-break"><span class="n">' + esc(c.name) + '</span>' + esc(c.detail) +
      (c.fix ? '<span class="f">→ ' + esc(c.fix) + '</span>' : "") + '</div>'
    ).join("");
  }
  if (o) {
    o.innerHTML = transcript.map(t =>
      '<div class="jv-res ' + esc(t.status) + '"><span class="cap">' + esc(t.capability || "unrouted") +
      '</span><span class="txt">' + esc(t.result) + '</span><span class="ts">' + esc(t.at) + '</span></div>'
    ).join("");
  }
}

// The council chamber: every model's answer side by side, so counsel can be
// weighed. Rendered from the live council response, not from the task log.
function renderChamber(c) {
  const el = $("orch-chamber");
  if (!el) return;
  if (!c) { el.innerHTML = ""; return; }
  const voices = (c.responses || []).map(r =>
    '<div class="oc-voice ' + esc(r.status) + '"><div class="vh"><span class="vn">' + esc(r.target) + '</span>' +
    '<span class="vs">' + esc(r.status) + '</span></div>' +
    '<div class="vt">' + esc(r.result) + '</div></div>'
  ).join("");
  el.innerHTML =
    '<div class="oc-head"><span class="t">⚖ Council</span><span class="q">' + esc(c.directive) + '</span>' +
    '<span class="x" id="oc-close" title="Dismiss">✕</span></div>' +
    '<div class="oc-grid">' + voices + '</div>' +
    '<div class="oc-verdict"><b>Verdict:</b> ' + esc(c.verdict) + '</div>';
  const x = $("oc-close");
  if (x) x.onclick = () => { lastCouncil = null; renderChamber(null); };
}
let lastCouncil = null;

function renderRp(rp) {
  const el = $("rp-panel");
  if (!el) return;
  if (!rp || !rp.citizens) {
    el.innerHTML = '<div class="rp-off">No citizens yet. The city comes alive when the Roblox bridge makes its first grant — ' +
      'deploy the Worker, set <b>RP_SHARED_SECRET</b>, and drop the <b>roblox/</b> kit into Studio (see roblox/README.md).</div>';
    return;
  }
  const net = rp.earned - rp.spent;
  let out =
    '<div class="rp-tiles">' +
      '<div class="rp-tile"><div class="n">' + rp.citizens + '</div><div class="l">citizens</div></div>' +
      '<div class="rp-tile"><div class="n">' + fmt(rp.cityBalance, 0) + '</div><div class="l">city balance · AETHER</div></div>' +
      '<div class="rp-tile"><div class="n">' + fmt(rp.earned, 0) + '</div><div class="l">earned (paychecks · jobs)</div></div>' +
      '<div class="rp-tile"><div class="n">' + fmt(rp.spent, 0) + '</div><div class="l">spent (shops · rent)</div></div>' +
    '</div>' +
    '<div class="rp-flow">treasury ⇄ city flow: <b>' + (net >= 0 ? "+" : "") + fmt(net, 0) + ' AETHER</b> net into citizens’ pockets · supply conserved</div>';
  const txs = (rp.ledger || []).map(t => {
    const earn = String(t.to_owner).indexOf("rp-") === 0;
    return '<div class="rp-tx"><span class="who">' + esc(earn ? t.to_owner : t.from_owner) + '</span>' +
      '<span class="memo">' + esc(String(t.memo || "").replace(/^rp:/, "")) + '</span>' +
      '<span class="amt ' + (earn ? "earn" : "spend") + '">' + (earn ? "+" : "−") + fmt(t.amount, 0) + '</span></div>';
  }).join("");
  out += txs || '<div class="rp-off">No city transactions yet.</div>';
  el.innerHTML = out;
}

function renderGrowth(g) {
  const el = $("growth-panel");
  if (!g) { el.innerHTML = '<div class="empty">Growth loading…</div>'; return; }
  const posts = g.posts || { total: 0, byStatus: {}, recent: [] };
  const leads = g.leads || { total: 0, byStatus: {}, byKind: {}, pipelineValue: 0, recent: [] };
  const fn = g.funnel || { leads: 0, contacted: 0, won: 0 };
  const bs = posts.byStatus || {};

  const tiles =
    tile("Pipeline", fmt(leads.pipelineValue || 0, 0), (leads.total || 0) + " leads tracked") +
    tile("Drafts", String(bs.draft || 0), "ready to review") +
    tile("Queued", String(bs.queued || 0), "awaiting publish") +
    tile("Published", String(bs.published || 0), "local — connect accounts") +
    tile("Campaigns", String((g.campaigns || []).length), "active");

  const funnelMax = Math.max(1, fn.leads);
  const funnelHtml = [["Leads", fn.leads, "var(--series-1)"], ["Contacted", fn.contacted, "var(--series-3)"], ["Won", fn.won, "var(--good)"]].map(f =>
    '<div class="gf-row"><span class="gf-l">' + f[0] + '</span>' +
    '<div class="gf-track"><div class="gf-bar" style="width:' + Math.round((Number(f[1]) / funnelMax) * 100) + '%;background:' + f[2] + '"></div></div>' +
    '<span class="gf-v">' + f[1] + '</span></div>'
  ).join("");

  const drafts = (posts.recent || []).map(p =>
    '<div class="gpost"><span class="gp-plat">' + esc(p.platform) + '</span>' +
    '<span class="gp-body">' + esc((p.title || p.body || "").slice(0, 90)) + '</span>' +
    '<span class="pill ' + (p.status === "published" ? "active" : "") + '">' + esc(p.status) + '</span></div>'
  ).join("");

  const leadRows = (leads.recent || []).map(l =>
    '<div class="gpost"><span class="gp-plat">' + esc(l.kind) + '</span>' +
    '<span class="gp-body">' + esc(l.name) + (l.source ? ' · <span class="mutedtxt">' + esc(l.source) + '</span>' : "") + '</span>' +
    '<span class="pill">' + esc(l.status) + '</span></div>'
  ).join("");

  const growthActs = [
    { id: "g-x", label: "Draft X post", act: "/growth/post", body: { platform: "x", topic: "Lumi + AETHER launch" } },
    { id: "g-li", label: "Draft LinkedIn", act: "/growth/post", body: { platform: "linkedin", topic: "Lumi + AETHER launch" } },
    { id: "g-scout", label: "Scout leads", act: "/growth/scout", body: {} },
  ];

  // Growth v2: connectors + weighted deal pipeline.
  const deals = g.deals || { byStage: {}, weightedValue: 0, wonValue: 0, open: 0, deals: [] };
  const conns = g.connectors || [];
  const connHtml = conns.length
    ? conns.map(cn =>
        '<span class="conn ' + (cn.connected ? "live" : cn.status === "connected" ? "linked" : "off") + '">' +
        '<span class="cdot"></span>' + esc(cn.platform) + (cn.handle ? ' @' + esc(cn.handle) : "") + '</span>'
      ).join("")
    : '';
  const stageOrder = [["prospect", "var(--muted)"], ["contacted", "var(--series-1)"], ["negotiating", "var(--series-3)"], ["won", "var(--good)"], ["lost", "var(--critical)"]];
  const dealStages = stageOrder.map(st =>
    '<div class="dstage"><span class="dnum" style="color:' + st[1] + '">' + (deals.byStage[st[0]] || 0) + '</span>' +
    '<span class="dlbl">' + st[0] + '</span></div>'
  ).join("");

  el.innerHTML =
    '<div class="tiles" style="margin-bottom:12px">' + tiles + '</div>' +
    (connHtml ? '<div class="conns">' + connHtml + '</div>' : '') +
    '<div class="deals-strip"><div class="ds-head"><b>' + fmt(deals.weightedValue || 0, 0) + '</b> weighted pipeline · ' +
      fmt(deals.wonValue || 0, 0) + ' won · ' + (deals.open || 0) + ' open deals</div>' +
      '<div class="dstages">' + dealStages + '</div></div>' +
    '<div class="defi-actions">' + growthActs.map(a => '<button id="' + a.id + '">' + a.label + '</button>').join("") + '</div>' +
    '<div class="growth-cols">' +
      '<div><h3>Funnel</h3><div class="funnel">' + funnelHtml + '</div>' +
        '<h3 style="margin-top:16px">Content queue</h3>' + (drafts || '<div class="empty">No drafts yet — draft a post.</div>') + '</div>' +
      '<div><h3>Leads &amp; opportunities</h3>' + (leadRows || '<div class="empty">No leads yet — scout for opportunities.</div>') + '</div>' +
    '</div>';
  growthActs.forEach(a => { const btn = $(a.id); if (btn) btn.onclick = (e) => act(e.target, a.act, a.body); });
}

function renderDefi(d) {
  const el = $("defi-panel");
  if (!d || !d.pools) { el.innerHTML = '<div class="empty">Liquidity loading…</div>'; return; }
  const pool = d.pools[0] || {};
  const price = Number(pool.price) || 0, apr = (Number(pool.apr) || 0) * 100;
  const tiles =
    tile("Pool TVL", fmt(d.tvlAether || 0, 0) + " Æ", (pool.name || "AETHER/SUI")) +
    tile("Price", price ? fmt(price, 4) : "—", "quote / AETHER") +
    tile("Pool APR", apr.toFixed(2) + "%", "from " + fmt(pool.volume || 0, 0) + " volume") +
    tile("Reserves", fmt(pool.reserve_aether || 0, 0) + " Æ", fmt(pool.reserve_quote || 0, 0) + " quote") +
    tile("LP supply", fmt(pool.lp_supply || 0, 0), "liquidity tokens");
  const vaults = (d.vaults || []);
  const loans = (d.loans || []);
  const ra = Number(pool.reserve_aether) || 0, rq = Number(pool.reserve_quote) || 0, fee = (Number(pool.fee_bps) || 30) / 10000;
  const owner = activeWallet || "creator";
  // Constant-product quote (client-side preview; the engine is authoritative).
  function swapQuote(dir, amt) {
    if (!(amt > 0) || ra <= 0 || rq <= 0) return 0;
    const k = ra * rq, inAf = amt * (1 - fee);
    return dir === "aether_in" ? rq - k / (ra + inAf) : ra - k / (rq + inAf);
  }
  const aIn = swapDir === "aether_in";

  const swapWidget =
    '<div class="swap">' +
      '<div class="swap-dir">' +
        '<button data-d="aether_in" class="' + (aIn ? "sel" : "") + '">AETHER → SUI</button>' +
        '<button data-d="quote_in" class="' + (!aIn ? "sel" : "") + '">SUI → AETHER</button>' +
      '</div>' +
      '<div class="swap-io">' +
        '<input id="swap-amt" type="number" min="0" placeholder="amount in ' + (aIn ? "AETHER" : "SUI") + '">' +
        '<span class="swap-arrow">→</span>' +
        '<div class="swap-out">≈ <b id="swap-quote">0</b> ' + (aIn ? "SUI" : "AETHER") + '</div>' +
      '</div>' +
      '<div class="swap-meta">wallet <b>' + esc(owner) + '</b> · price ' + (price ? fmt(price, 4) : "—") + ' · fee ' + (fee * 100).toFixed(2) + '%</div>' +
      '<button id="swap-go">Swap</button>' +
    '</div>';

  const quickActs = [
    { id: "d-seed", label: "Add 10k/10k liquidity", act: "/defi/pool/add", body: { owner: owner, aether: 10000, quote: 10000 } },
    { id: "d-vault", label: "Vault +5k (8% APR)", act: "/defi/vault/deposit", body: { owner: owner, amount: 5000 } },
  ];

  el.innerHTML =
    '<div class="tiles" style="margin-bottom:12px">' + tiles + '</div>' +
    '<div class="defi-cols">' +
      '<div><h3>Swap</h3>' + (ra > 0 ? swapWidget : '<div class="empty">Pool empty — add liquidity first.</div>') + '</div>' +
      '<div><h3>Vaults</h3>' + (vaults.length ? vaults.map(v =>
        '<div class="aeth-tx">' + esc(v.owner) + ' <span class="k">' + ((Number(v.apr_bps) || 0) / 100).toFixed(1) + '% APR</span><span class="amt">' + fmt(v.principal || 0, 0) + ' Æ</span></div>'
      ).join("") : '<div class="empty">No vault deposits yet.</div>') +
        '<h3 style="margin-top:14px">Loans</h3>' + (loans.length ? loans.map(l =>
        '<div class="aeth-tx">#' + l.id + ' <span class="k">' + fmt(l.collateral_aether || 0, 0) + ' Æ collateral</span><span class="amt">' + fmt(l.principal_quote || 0, 0) + ' borrowed</span></div>'
      ).join("") : '<div class="empty">No open loans.</div>') + '</div>' +
    '</div>' +
    '<div class="defi-actions" style="margin-top:12px">' + quickActs.map(a => '<button id="' + a.id + '">' + a.label + '</button>').join("") + '</div>';

  // Swap interactions
  const amtEl = $("swap-amt"), qEl = $("swap-quote");
  function refreshQuote() { if (qEl && amtEl) qEl.textContent = fmt(swapQuote(swapDir, Number(amtEl.value)), 4); }
  if (amtEl) amtEl.addEventListener("input", refreshQuote);
  el.querySelectorAll(".swap-dir button").forEach(b => { b.onclick = () => { swapDir = b.dataset.d; renderDefi(d); }; });
  const go = $("swap-go");
  if (go) go.onclick = async (e) => {
    const amt = Number(amtEl.value);
    if (!(amt > 0)) { cmdLog && cmdLog("enter a swap amount", "err"); return; }
    await act(e.target, "/defi/swap", { owner: owner, direction: swapDir, amountIn: amt });
    if (amtEl) amtEl.value = "";
  };
  quickActs.forEach(a => { const btn = $(a.id); if (btn) btn.onclick = (e) => act(e.target, a.act, a.body); });
}
let swapDir = "aether_in";

let activeWallet = null;
function shortAddr(a) { a = String(a || ""); return a.length > 18 ? a.slice(0, 10) + "…" + a.slice(-6) : a; }
function renderWallet(wallets) {
  const el = $("wallet-panel");
  if (!wallets.length) { el.innerHTML = '<div class="empty">No wallets yet.</div>'; return; }
  if (!activeWallet || !wallets.find(w => w.owner === activeWallet)) {
    activeWallet = (wallets.find(w => w.owner === "creator") || wallets[0]).owner;
  }
  const w = wallets.find(x => x.owner === activeWallet) || wallets[0];
  const linked = w.sui_address && w.sui_address.length > 0;

  const opts = wallets.map(x => '<option value="' + esc(x.owner) + '"' + (x.owner === activeWallet ? " selected" : "") + '>' + esc(x.owner) + '</option>').join("");
  el.innerHTML =
    '<div class="wallet-grid">' +
      '<div class="wallet-hero">' +
        '<div class="bal">' + fmt(w.balance, 0) + '<span class="sym">AETHER</span></div>' +
        '<div class="who">' + esc(w.owner) + ' · ' + esc(w.kind) + '</div>' +
        '<div class="wallet-addr"><span class="lab">addr</span><span class="val" title="' + esc(w.address) + '">' + esc(w.address) + '</span></div>' +
        '<div class="wallet-sui ' + (linked ? "on" : "off") + '">' + (linked ? "● Sui self-custody: " + esc(shortAddr(w.sui_address)) : "○ link your Sui address for self-custody →") + '</div>' +
      '</div>' +
      '<div class="send-form">' +
        '<label>Send AETHER from</label>' +
        '<select id="w-from">' + opts + '</select>' +
        '<label>To (wallet or 0x address)</label>' +
        '<input id="w-to" type="text" placeholder="owner or 0x…" spellcheck="false">' +
        '<div class="send-row"><input id="w-amt" type="number" min="0" placeholder="amount"><button id="w-send">Send</button></div>' +
        '<div class="send-row"><button id="w-new">New wallet</button><button id="w-link">Link Sui addr</button></div>' +
      '</div>' +
    '</div>' +
    '<div class="wallet-list">' + wallets.map(x =>
      '<div class="wl-item ' + (x.owner === activeWallet ? "sel" : "") + '" data-o="' + esc(x.owner) + '">' +
      '<span class="wl-o">' + esc(x.owner) + '</span><span class="wl-b">' + fmt(x.balance, 0) + '</span></div>'
    ).join("") + '</div>';

  el.querySelectorAll(".wl-item").forEach(it => { it.onclick = () => { activeWallet = it.dataset.o; renderWallet(wallets); }; });
  $("w-from").onchange = (e) => { activeWallet = e.target.value; };
  $("w-send").onclick = async (e) => {
    const from = $("w-from").value, to = $("w-to").value.trim(), amount = Number($("w-amt").value);
    if (!to || !amount) { cmdLog && cmdLog("send needs a recipient and amount", "err"); return; }
    await act(e.target, "/wallet/send", { from: from, to: to, amount: amount });
    $("w-to").value = ""; $("w-amt").value = "";
  };
  $("w-new").onclick = async (e) => {
    const label = prompt("Wallet label (optional):") || undefined;
    await act(e.target, "/wallet", label ? { label: label } : {});
  };
  $("w-link").onclick = async (e) => {
    const suiAddress = prompt("Your Sui address (0x + 64 hex):");
    if (suiAddress) await act(e.target, "/wallet/link", { ref: activeWallet, suiAddress: suiAddress });
  };
}

const DIM_COLOR = { contract: "var(--series-1)", custody: "var(--series-2)", privacy: "var(--series-3)", decentralization: "var(--series-4)", redteam: "var(--critical)", authority: "var(--warning)" };
function scoreColor(s) { return s >= 90 ? "var(--good)" : s >= 70 ? "var(--series-1)" : s >= 55 ? "var(--warning)" : "var(--critical)"; }

function renderShield(s) {
  const el = $("shield-panel");
  if (!s || !s.posture) { el.innerHTML = '<div class="empty">Running security assessment…</div>'; return; }
  const p = s.posture, dims = p.dimensions || [];
  const col = scoreColor(p.score);

  // Radial gauge (270° sweep)
  const R = 62, C = 2 * Math.PI * R, sweep = 0.75, off = C * (1 - (p.score / 100) * sweep);
  const gauge =
    '<svg width="150" height="150" viewBox="0 0 150 150">' +
      '<circle cx="75" cy="75" r="' + R + '" fill="none" stroke="var(--grid)" stroke-width="10" stroke-linecap="round" ' +
        'stroke-dasharray="' + (C * sweep) + ' ' + C + '" transform="rotate(135 75 75)"/>' +
      '<circle class="gauge-arc" cx="75" cy="75" r="' + R + '" fill="none" stroke="' + col + '" stroke-width="10" stroke-linecap="round" ' +
        'stroke-dasharray="' + (C * sweep) + ' ' + C + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(135 75 75)"/>' +
    '</svg>';

  // Decentralization radar (5 axes)
  const cx = 90, cy = 84, rad = 66;
  const pts = dims.map((d, i) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / dims.length;
    const r = rad * Math.max(0.04, d.score);
    return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
  });
  let rings = "";
  for (let g = 1; g <= 3; g++) {
    const rr = (rad * g) / 3;
    const rp = dims.map((_, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / dims.length; return (cx + rr * Math.cos(a)).toFixed(1) + "," + (cy + rr * Math.sin(a)).toFixed(1); }).join(" ");
    rings += '<polygon points="' + rp + '" fill="none" stroke="var(--grid)" stroke-width="1"/>';
  }
  const axes = dims.map((d, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / dims.length;
    const lx = cx + (rad + 12) * Math.cos(a), ly = cy + (rad + 12) * Math.sin(a);
    return '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + rad * Math.cos(a)).toFixed(1) + '" y2="' + (cy + rad * Math.sin(a)).toFixed(1) + '" stroke="var(--grid)" stroke-width="1"/>' +
      '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="middle" dominant-baseline="middle" font-size="8">' + esc(d.dimension.slice(0, 5)) + '</text>';
  }).join("");
  const poly = pts.map(p2 => p2[0].toFixed(1) + "," + p2[1].toFixed(1)).join(" ");
  const radar =
    '<svg width="196" height="176" viewBox="0 0 196 176">' + rings + axes +
      '<polygon class="radar-poly" points="' + poly + '" fill="' + col + '" fill-opacity="0.22" stroke="' + col + '" stroke-width="2"/>' +
      pts.map((p2, i) => '<circle cx="' + p2[0].toFixed(1) + '" cy="' + p2[1].toFixed(1) + '" r="2.5" fill="' + (DIM_COLOR[dims[i].dimension] || col) + '"/>').join("") +
    '</svg>';

  const dimBars = dims.map(d =>
    '<div class="dim"><div class="r"><b>' + esc(d.label) + '</b><span class="v">' + Math.round(d.score * 100) + '</span></div>' +
    '<div class="bar-track"><div class="bar-fill" style="width:' + Math.round(d.score * 100) + '%;background:' + (DIM_COLOR[d.dimension] || col) + '"></div></div></div>'
  ).join("");

  const findings = (s.findings || []);
  const findingsHtml = findings.length
    ? findings.map(f => '<div class="finding"><span class="sev ' + esc(f.severity) + '">' + esc(f.severity) + '</span>' +
        '<span><span class="ft">' + esc(f.title) + '</span> — <span class="fd">' + esc(f.detail) + '</span></span></div>').join("")
    : '<div class="finding"><span class="sev info">clear</span><span class="ft">No open findings — posture holding.</span></div>';

  const kyc = s.kyc || { total: 0, byLevel: [] };
  const kycHtml = '<div class="kyc-row"><span class="kyc-badge">privacy-first</span>' +
    '<span>' + (Number(kyc.total) || 0) + ' attestation' + (kyc.total === 1 ? "" : "s") + ' · hash-only, no PII stored</span></div>' +
    (kyc.byLevel && kyc.byLevel.length ? '<div class="web3-line">' + kyc.byLevel.map(k => esc(k.level) + ": " + k.n).join(" · ") + '</div>' : '') +
    '<div class="web3-line">web3: ' + (p.web3 && p.web3.linked ? "● on-chain · " + esc(p.web3.network) : "○ off-chain — publish to Sui to decentralize settlement") + '</div>';

  el.innerHTML =
    '<div class="shield-grid">' +
      '<div class="gauge-wrap">' + gauge +
        '<div class="gauge-score" style="color:' + col + '">' + p.score + '<span style="font-size:15px;color:var(--muted)">/100</span></div>' +
        '<div class="gauge-grade">GRADE ' + esc(p.grade) + '</div>' +
        '<div class="gauge-ruleset">ruleset v' + p.rulesetVersion + ' · ' + p.ruleCount + ' rules · learning</div>' +
      '</div>' +
      '<div class="radar-wrap">' + radar + '</div>' +
      '<div class="dims">' + dimBars + '</div>' +
    '</div>' +
    '<div class="shield-lower">' +
      '<div><h3>Red-team findings</h3>' + findingsHtml + '</div>' +
      '<div><h3>Decentralized KYC &amp; web3</h3>' + kycHtml + '</div>' +
    '</div>';
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
      '<span class="chain-badge">' + esc(a.chainLink ? "sui · " + a.chainLink.network : a.chain) + '</span>' +
      '<span class="aeth-recon pill ' + (a.reconciled ? "pass" : "fail") + '">' + (a.reconciled ? "supply reconciled" : "SUPPLY DRIFT") + '</span>' +
    '</div>' +
    (a.chainLink ? '<div class="chain-link ' + (a.chainLink.linked ? "on" : "off") + '">' +
      (a.chainLink.linked
        ? '● on-chain · ' + esc(a.chainLink.coinType || "")
        : '○ off-chain ledger · not yet published to Sui (see docs/AETHER_SUI.md)') + '</div>' : '') +
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
    const r = await fetch(path, { method: "POST", cache: "no-store", headers: ctlHeaders(), body: body ? JSON.stringify(body) : "{}" });
    if (!r.ok) {
      // These used to fail silently. A refused action that looks like a
      // successful one is worse than an error message.
      const e = await r.json().catch(() => null);
      const msg = (e && e.errors && e.errors[0] && e.errors[0].message) || ("HTTP " + r.status);
      $("status").textContent = "refused · " + msg;
      return;
    }
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
  "shield — run a red-team security scan (posture + findings)",
  "kyc <subject> <basic|verified|institutional> <hash> — record a privacy-first attestation",
  "wallet [ref] — show a wallet (balance, address, Sui link)",
  "wallet new [label] — create a wallet · wallet link <ref> <0xSui> — link self-custody",
  "post <x|linkedin|instagram|blog> [topic] — draft marketing content",
  "scout — hunt leads/partners/placements · growth — funnel & pipeline",
];

async function api(method, path, body) {
  const url = method === "GET"
    ? path + (path.includes("?") ? "&" : "?") + "_=" + Date.now()
    : path;
  const res = await fetch(url, {
    method: method,
    cache: "no-store",
    headers: ctlHeaders(),
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
    case "shield": {
      const r = await api("POST", "/shield/scan", {});
      const crit = (r.dimensions || []).reduce((n, d) => n + d.findings.filter(f => f.severity === "critical").length, 0);
      return "security posture " + r.score + "/100 (grade " + r.grade + ") · ruleset v" + r.rulesetVersion +
        " · " + crit + " critical finding(s)";
    }
    case "kyc": {
      const [subject, level, hash] = [parts[1], (parts[2] || "").toLowerCase(), parts[3]];
      if (!subject || !level || !hash) throw new Error("usage: kyc <subject> <basic|verified|institutional> <hash>");
      const r = await api("POST", "/shield/kyc", { subject: subject, level: level, attestationHash: hash });
      return "attestation #" + r.id + " recorded (" + r.level + ", " + r.method + ") — hash only, no PII";
    }
    case "wallet": {
      const sub = (parts[1] || "").toLowerCase();
      if (sub === "new") { const r = await api("POST", "/wallet", parts[2] ? { label: parts.slice(2).join(" ") } : {}); return "created " + r.owner + " · " + r.address; }
      if (sub === "link") { if (!parts[2] || !parts[3]) throw new Error("usage: wallet link <ref> <0xSui>"); const r = await api("POST", "/wallet/link", { ref: parts[2], suiAddress: parts[3] }); return r.owner + " linked to " + r.sui_address; }
      if (sub === "send") { if (!parts[2] || !parts[3] || !parts[4]) throw new Error("usage: wallet send <from> <to> <amount>"); const r = await api("POST", "/wallet/send", { from: parts[2], to: parts[3], amount: Number(parts[4]) }); return "sent " + fmt(r.amount, 0) + " AETHER"; }
      const ref = parts[1] || activeWallet || "creator";
      const w = await api("GET", "/wallet/" + encodeURIComponent(ref));
      return w.owner + " · " + fmt(w.balance, 0) + " AETHER\\n  addr " + w.address + (w.sui_address ? "\\n  sui  " + w.sui_address : " · no Sui link");
    }
    case "post": {
      const platform = (parts[1] || "x").toLowerCase();
      const topic = parts.slice(2).join(" ") || "Lumi + AETHER launch";
      const r = await api("POST", "/growth/post", { platform: platform, topic: topic });
      return "drafted " + platform + " post:\\n  " + (r.title || r.body || "").slice(0, 160) + "\\n  media: " + (r.media_prompt || "").slice(0, 120);
    }
    case "scout": {
      const r = await api("POST", "/growth/scout", {});
      return "scouted opportunities: " + (r.stored || 0) + " new lead(s) banked (" + (r.found || 0) + " found)";
    }
    case "growth": {
      const g = await api("GET", "/growth");
      return "funnel " + g.funnel.leads + " leads → " + g.funnel.contacted + " contacted → " + g.funnel.won + " won · pipeline " +
        fmt(g.leads.pipelineValue, 0) + " · " + g.posts.total + " posts (" + (g.posts.byStatus.draft || 0) + " draft)";
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
$("cmd-chips").innerHTML = ["pulse", "advance 600", "learn", "train", "shield", "post x", "scout", "aether", "help"]
  .map(c => '<button type="button" data-cmd="' + c + '">' + c + "</button>").join("");
$("cmd-chips").querySelectorAll("button").forEach(b => {
  b.onclick = () => { $("cmd-input").value = b.dataset.cmd; sendCommand(); };
});

// Autopilot: Lumi pulses herself — trade, learn, audit, sweep, quests — hands off.
let autopilot = false, pulsing = false;
async function autoPulse() {
  if (!autopilot || pulsing || document.hidden) return;
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

// Orchestrator dispatch: fire the directive, run the working animation on the
// selected card, refresh when the result lands.
$("orch-go").onclick = async () => {
  if (orchBusy) return;
  const btn = $("orch-go"), input = $("orch-directive");
  const directive = (input.value || "status").trim() || "status";
  orchBusy = true; btn.disabled = true; btn.textContent = "Dispatching…";
  const sel = document.querySelector('.orch-int.sel'); if (sel) sel.classList.add("working");
  try {
    await fetch("/orchestrator/dispatch", { method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: orchTarget, directive: directive }) });
    input.value = "";
    await load();
  } catch (e) {} finally { orchBusy = false; btn.disabled = false; btn.textContent = "Dispatch"; }
};
$("orch-directive").addEventListener("keydown", (e) => { if (e.key === "Enter") $("orch-go").click(); });

// Jarvis: speak an order, Lumi routes it, checks her grant, acts.
// The creator key lives only in this tab (sessionStorage), never on disk and
// never in the Databank. Close the tab and it's gone — which is the point.
function creatorKey() { try { return sessionStorage.getItem("lumi-key") || ""; } catch (e) { return ""; } }
function ctlHeaders() {
  const h = { "Content-Type": "application/json" };
  const k = creatorKey();
  if (k) h["X-Creator-Key"] = k;
  return h;
}
function markKeyButton() {
  const b = $("jv-key");
  if (b) { b.classList.toggle("on", !!creatorKey()); b.textContent = creatorKey() ? "🔓" : "🔑"; }
}
$("jv-key").onclick = () => {
  const has = !!creatorKey();
  if (has && !confirm("Forget the creator key for this tab?")) return;
  try {
    if (has) sessionStorage.removeItem("lumi-key");
    else {
      const k = prompt("Creator key (kept in this tab only, never stored server-side):");
      if (k) sessionStorage.setItem("lumi-key", k);
    }
  } catch (e) {}
  markKeyButton();
  load();
};
markKeyButton();

function stamp() {
  const d = new Date();
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + ":" + String(d.getSeconds()).padStart(2, "0");
}

async function runOrder(order) {
  const btn = $("jv-go"), input = $("jv-order"), jv = document.querySelector(".jarvis");
  order = (order || "").trim();
  if (!order) return;
  orderHistory.unshift(order); historyAt = -1;
  btn.disabled = true; btn.textContent = "Working…"; if (jv) jv.classList.add("busy");
  try {
    const res = await fetch("/command", { method: "POST", cache: "no-store",
      headers: ctlHeaders(), body: JSON.stringify({ order: order }) });
    const { result } = await res.json();
    lastCommand = result || null;
    if (lastCommand) {
      transcript.unshift({ status: lastCommand.status, capability: lastCommand.capability, result: lastCommand.result, at: stamp() });
      transcript = transcript.slice(0, 6);
      say(lastCommand.result);
    }
    input.value = "";
    await load();
  } catch (e) {
    // A dead network is not a completed order. Say so rather than clearing the
    // box and looking like it worked.
    transcript.unshift({ status: "failed", capability: "unreachable", result: "Could not reach the Worker — nothing ran.", at: stamp() });
    renderJarvis(lastAnalytics ? lastAnalytics.command : null, lastAnalytics ? lastAnalytics.integrity : null, lastAnalytics ? lastAnalytics.bridgeCallers : [], lastAnalytics ? lastAnalytics.readiness : null);
  } finally { btn.disabled = false; btn.textContent = "Execute"; if (jv) jv.classList.remove("busy"); }
}

$("jv-go").onclick = () => runOrder($("jv-order").value);

// ↑/↓ walks back through this session's orders. Enter sends.
let historyAt = -1;
$("jv-order").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { $("jv-go").click(); return; }
  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
  if (orderHistory.length === 0) return;
  e.preventDefault();
  historyAt = e.key === "ArrowUp" ? Math.min(historyAt + 1, orderHistory.length - 1) : historyAt - 1;
  $("jv-order").value = historyAt < 0 ? (historyAt = -1, "") : orderHistory[historyAt];
});

// ---- Voice ----
// Both directions use the browser's own speech engine: no service, no audio
// leaves this page, nothing to configure. Where the browser doesn't provide it
// (Firefox has no SpeechRecognition), the control says so instead of failing
// silently — an inert mic button that looks live is worse than no mic button.
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog = null, listening = false, voiceOn = false;

function say(text) {
  if (!voiceOn || !text || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).slice(0, 400));
    u.rate = 1.02; u.pitch = 1.05;
    window.speechSynthesis.speak(u);
  } catch (e) {}
}

const micBtn = $("jv-mic"), voiceBtn = $("jv-voice");
if (!SR) {
  micBtn.disabled = true;
  micBtn.title = "This browser has no speech recognition (try Chrome or Edge). Typing works the same.";
} else {
  micBtn.onclick = () => {
    const jv = document.querySelector(".jarvis"), heard = $("jv-heard");
    if (listening) { try { recog.stop(); } catch (e) {} return; }
    recog = new SR();
    recog.lang = "en-US"; recog.interimResults = true; recog.continuous = false;
    recog.onstart = () => { listening = true; micBtn.classList.add("listening"); if (jv) jv.classList.add("listening"); heard.textContent = "listening…"; };
    recog.onresult = (ev) => {
      let text = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) text += ev.results[i][0].transcript;
      $("jv-order").value = text;
      heard.textContent = "heard: " + text;
      // Only act on a final result — acting on a half-heard order is how a
      // voice interface gets dangerous.
      if (ev.results[ev.results.length - 1].isFinal && text.trim()) runOrder(text);
    };
    recog.onerror = (ev) => { heard.textContent = ev.error === "not-allowed" ? "microphone permission denied" : "voice error: " + ev.error; };
    recog.onend = () => { listening = false; micBtn.classList.remove("listening"); if (jv) jv.classList.remove("listening"); setTimeout(() => { if (!listening) heard.textContent = ""; }, 3500); };
    try { recog.start(); } catch (e) { heard.textContent = "could not start the microphone"; }
  };
}
if (!window.speechSynthesis) {
  voiceBtn.disabled = true;
  voiceBtn.title = "This browser cannot speak.";
} else {
  voiceBtn.onclick = () => {
    voiceOn = !voiceOn;
    voiceBtn.classList.toggle("on", voiceOn);
    voiceBtn.textContent = voiceOn ? "🔊" : "🔈";
    voiceBtn.title = voiceOn ? "Lumi speaks her replies aloud — click to mute" : "Lumi speaks her replies aloud";
    if (voiceOn) say("Standing by.");
    else if (window.speechSynthesis) window.speechSynthesis.cancel();
  };
}

// Council: one directive to every model at once. Every model card scans while
// the votes come in.
$("orch-council").onclick = async () => {
  if (orchBusy) return;
  const btn = $("orch-council"), go = $("orch-go"), input = $("orch-directive");
  const directive = (input.value || "status").trim() || "status";
  orchBusy = true; btn.disabled = true; go.disabled = true; btn.textContent = "Convening…";
  document.querySelectorAll(".orch-int.model").forEach(el => el.classList.add("working"));
  try {
    const res = await fetch("/orchestrator/council", { method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ directive: directive }) });
    const { result } = await res.json();
    lastCouncil = result || null;
    renderChamber(lastCouncil);
    input.value = "";
    await load(); // load() re-renders the whole cockpit, Jarvis and machine deck included
  } catch (e) {} finally { orchBusy = false; btn.disabled = false; go.disabled = false; btn.textContent = "⚖ Council"; }
};

// ---- AETH design preview: swap-preview math + candidate-chain selection ----
// Pure UI. No money moves — this only mirrors the intended 100:1 credits⇄AETH rate.
(function aethPreview() {
  const RATE = 100; // credits per AETH — design rate only
  const c = $("aethp-credits"), a = $("aethp-aeth");
  if (c && a) {
    const round = (n) => Math.round(n * 1000) / 1000;
    c.addEventListener("input", () => { a.value = round(Math.max(0, Number(c.value) || 0) / RATE); });
    a.addEventListener("input", () => { c.value = Math.round(Math.max(0, Number(a.value) || 0) * RATE); });
  }
  const chains = document.querySelectorAll("#aethp-chains .aethp-chip");
  const active = $("aethp-active");
  chains.forEach((chip) => {
    chip.addEventListener("click", () => {
      chains.forEach((x) => x.classList.remove("sel"));
      chip.classList.add("sel");
      if (active) active.textContent = chip.dataset.chain;
    });
  });
})();

// Calm mode: freeze animations + polling whenever the tab is backgrounded, so
// the cockpit costs the CPU nothing when you're not looking at it. Resume (and
// refresh once) when it comes back to the foreground.
function applyVisibility() {
  const hidden = document.hidden;
  document.documentElement.classList.toggle("calm", hidden);
  if (!hidden) load();
}
document.addEventListener("visibilitychange", applyVisibility);
applyVisibility();

load();
// 8s refresh (was 5s) — lighter on the worker + local D1, still feels live.
setInterval(load, 8000);
</script>
</body>
</html>`;
