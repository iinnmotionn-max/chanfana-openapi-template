# LUMI COLONY — System Blueprint

Lumi is a multi-realm creator AI built on Cloudflare Workers + D1. She watches
over **seven realms** from one **Creator Cockpit** (`GET /dash`); the original
self-improving paper-trading colony lives on as the **Invest** realm — now
merged with **Aether** (it handles money and settles in AETHER, so trading,
token, wallet and DeFi are one realm; internal key stays `invest`).
The core intelligences working as one unit:

| Agent        | Role                                                                          | Where it lives                     |
| ------------ | ----------------------------------------------------------------------------- | ---------------------------------- |
| **Lumi**     | Front-end intellect AND orchestrator: commands every agent & model from the cockpit's command deck. | `GET /dash` (`src/dash/`) · `src/engine/orchestrator.ts` |
| **Reg**      | Back-end operator. Runs the engine, audits, sweeps — records everything.      | API endpoints (`src/endpoints/`)    |
| **Databank** | Memory. Every bot, strategy, trade, check, report, and goal — nothing lost.   | D1 database (`migrations/`)         |
| **Observer** | Watches every cycle, measures performance.                                    | `src/engine/learning.ts` (metrics)  |
| **Reporter** | Writes a report into the Databank after every cycle, audit, sweep, check-in.  | `reports` table + dash feed         |

## The realms

Every realm has a mission, a live status (`nominal` / `watch` / `alert`), its
own checks, and its own goals — all in the same Databank, all visible from
the cockpit and `GET /realms`.

| Realm        | Mission                                                                                   | Status is driven by            |
| ------------ | ------------------------------------------------------------------------------------------ | ------------------------------ |
| **Invest / Aether** | Grow paper capital with flawless ledger integrity + active learning, and run the AI-credit economy: AETHER token ledger, in-app web3 wallet, DeFi (AMM pool / vaults / lending) It handles money (the InMotion RP city settles on this same ledger, but lives in the Gaming realm). | `POST /realms/invest/audit` |
| **Guardian** | Protection, security, and privacy — "the man around the house". Sweeps the whole system.   | `POST /realms/guardian/sweep`  |
| **Tech**     | Dev/tech support diagnostics: table counts, ticks, active bots, every realm's health.      | `GET /realms/tech/status`      |
| **Wellness** | Creator check-ins: mood, energy, streaks. The colony works for a human.                    | `POST /realms/wellness/checkin` |
| **Shield**   | Web3 security — red-team scans, contract posture, decentralization scoring, privacy-first KYC (a hash, never an identity). | `POST /shield/scan` |
| **Growth**   | PR, content drafting, campaigns, lead-gen; connectors for real publishing + a deals pipeline. | `GET /growth`, `POST /growth/scout` |
| **Gaming**   | InMotion RP — the Roblox city. Citizens earn and spend conserved AETHER; every successful bridge call stamps a passing `rp-bridge` check. | `POST /rp/grant`, `POST /rp/spend` |

- **Invest audit** runs five checks — `ledger-reconciliation` (every bot's
  starting balance + closed-trade PnL must equal its balance to the cent),
  `trade-validity`, `single-exposure`, `capital-floor`, `evidence-freshness` —
  records each in `checks`, files an `audit` report, and sets the realm status
  from the worst result.
- **Guardian sweep** runs `databank-online`, `invest-ledger`, `privacy-scan`
  (flags PII such as email addresses left in notes), `agents-heartbeat`
  (touches every active agent's `last_seen`), and `market-continuity`; it
  files a `sweep` report and updates the realm status.
- **Kill-switch.** After every trading cycle, any active bot whose balance
  falls below 40% of its starting balance is auto-paused; the cycle result
  reports `paused` and an `alert` report is filed in the Invest realm.

## Lumi's evolution — skills, quests, awareness, initiative

Lumi is a living system, not a static dashboard:

- **Skills** (`lumi_state`): Insight, Vigilance, Engineering, Empathy — XP
  from real work only (cycles, learning, audits, sweeps, check-ins, auras).
  Levels follow a square curve and **feed back into the engine**: Insight
  widens mutation spread and breeds bigger champion broods; Engineering
  raises ticks-per-pulse.
- **Quests** (`quests`): a seeded task line evaluated against real Databank
  state (trades closed, generations reached, clean sweeps, check-ins,
  knowledge gathered). Completion pays XP and is chronicled.
- **Awareness** (`selfAssess`): every pulse she states where she is — stage
  (Hatchling → Apprentice → Operator → Strategist → Sage), focus, current
  initiative (the open quest closest to done), and blockers.
- **Unattended action** (`actOnInitiative`, needs the `command` grant): one
  act per pulse, never a cascade, ordered by urgency — realm in alert →
  sweep; trading halted → ledger audit; **app integrity failing → structural
  audit** (ranked above capital work: when the wiring is wrong every number
  is suspect, and she says plainly that this one needs a person); **a bridge
  door locked out → security scan**; unexamined evidence → learning pass.
- **Initiative** (`pursueInitiative`): she acts on the assessment — extra
  cycles, research expeditions, market scouts — and keeps a self-set goal in
  the Databank until the quest completes. She does not stop until it's done.
- **Automation**: cockpit Autopilot pulses her every 15s in the browser; a
  Cron Trigger pulses her hourly when deployed. Engine phase durations land
  in `metrics` (cycle/learn/audit/sweep/pulse ms) — the Tech realm's
  performance monitor.
- **Calm cockpit**: the dashboard is animation-heavy, so it self-throttles —
  when the browser tab is backgrounded (`visibilitychange`) every animation
  freezes (`html.calm`) and polling stops, costing the CPU nothing when
  unwatched. The live refresh is 8s. There is deliberately **no** background
  compute of any kind (no miner, no worker, no WASM) — just polling + SVG/CSS.
- **Knowledge** (`knowledge`): expeditions to free public sources (Hugging
  Face Hub, CoinGecko) are banked permanently and earn Insight.
- **Aura layer** (`auras`): personality + design profiles of clients, brands,
  users, investors → personalization briefs (tone, detail, pacing, palette,
  risk framing). Privacy is structural: notes require consent, the Guardian's
  privacy scan covers aura notes, `aura-consent` fails the sweep on
  violations, and the creator is never profiled.

## The Invest realm — the trading colony

### Why the bots were losing (and how this fixes it)

A low win percentage isn't fixed by tweaking one bot — it's fixed by a **system
that measures, learns, and reallocates**:

1. **Everything is recorded.** Every trade a bot takes lands in the Databank with
   entry, exit, PnL, outcome, and the reason (signal) it fired.
2. **The Observer scores strategies on evidence.** After trades accumulate, each
   strategy gets a score from its real trade history: win rate, expectancy,
   profit factor — not vibes.
3. **A losing strategy is retired, however often it is right.** Retirement was
   scored by blending win rate with profit-factor-over-cap, which let a
   break-even strategy bank a third of the payoff half — so a good hit rate
   could carry a **money-losing** strategy over the floor, and did:
   `mean reversion` held the colony's best win rate (58%) and worst expectancy
   (−0.25/trade) and survived every learning pass. Expectancy is now scored
   explicitly and negative expectancy is **absolutely** disqualifying, whatever
   the blend says; payoff is anchored at break-even so breaking even earns
   nothing. The champion is never retired — the colony must always have
   something to trade.
4. **A child is funded like a hypothesis.** Bred children were staked at a
   founder's full 1000, so unproven mutations instantly carried the weight of
   strategies with hundreds of trades behind them and exploration diluted the
   returns it existed to find. Children now start at 250 and grow through the
   existing compounding if the evidence arrives.
5. **Losers are retired, winners compound.** The learning cycle retires
   strategies that score below the floor, reassigns their bots to the best
   performer, and **compounds balances** — position size scales with each bot's
   growing (or shrinking) equity, so wins compound and losers self-throttle.
6. **Winners evolve.** The top strategy is cloned with mutated parameters
   (a new generation, lineage tracked via `parent_id`). The colony explores
   around what already works instead of guessing randomly.
7. **Bots carry a soul.** Each bot inherits DNA (risk appetite, patience,
   discipline) merged from Lumi, Reg, and the Databank's agent registry. DNA
   shapes position sizing and behavior, so bots are individuals, not clones.

### Every trade takes profit and cuts losses

Scoring and evolution work across *many* trades; this rule protects *each* one.
A position used to close only when the strategy signal flipped — so winners
rode all the way back to flat and losers bled until a reversal. That was the
leak. Now every open position is managed **on every tick** (`src/engine/trader.ts`):

- **Take-profit** — bank the win once the position is up by 3–7% (the band is
  set by the bot's `patience` DNA: calmer souls let winners run further).
- **Stop-loss** — cut the loss once it's down 1.5–2.3% (set by `risk` DNA).
  The stop always sits *inside* the take-profit, so every trade carries
  positive asymmetry: losses are capped small, wins are allowed to be larger.
- **Signal reversal** still exits too, and flips into the opposite side.
- After a take-profit/stop-loss exit the bot waits one tick before re-entering,
  so it doesn't instantly re-open the trade it just closed.

Each close records *why* in the trade's `reason` (`take-profit +5.2%`,
`stop-loss -1.9%`, or the signal), so the ledger is self-explaining. This is a
low-win-rate / high-expectancy profile by design: many small capped losses
offset by fewer, larger wins. On the seeded tape the colony runs net-positive
rather than bleeding. Above this sits the 40%-of-starting-balance kill-switch as
the last line of defence.

### Safety stance

- **Paper trading only.** Deterministic simulated market (seeded random walk).
  No exchange keys, no real funds. The identical engine interface is where a
  live-data adapter plugs in later — after the win rate is proven here.
- Nothing here guarantees market profits; it guarantees the machinery to
  measure honestly, cut losers fast, and compound what works.

## Architecture (vital core → outward)

```
migrations/            Databank schema, one numbered file per feature (0001→0023):
                       colony (agents/strategies/bots/trades/reports/goals/
                       market_state) → realms/checks/wellness → lumi evolution
                       (skills/quests/metrics) → knowledge → auras → live feed →
                       risk gates → aether token+ledger → shield → defi →
                       wallet → growth → growthx → invest∪aether merge →
                       gaming realm → orchestrator_tasks → authority ledger →
                       local_tasks → rate_limits → rotation_events
src/engine/            The colony's brains:
  market.ts            Deterministic seeded price series (reproducible ticks)
  feed.ts              PriceFeed adapter: sim tape OR replay of banked live ticks
  strategies.ts        SMA-cross, momentum, mean-reversion + opt-in trend filter
  trader.ts            Runs a cycle: signals → execute → record; take-profit /
                       stop-loss manages each position every tick; compounds;
                       kill-switch pauses drained bots
  learning.ts          Observer metrics + retire/evolve/reassign + colony DNA
  lumi.ts              Skills/XP, quests, awareness, initiative, and lumiPulse
                       (the autonomous heartbeat: trade→learn→audit→sweep→quests)
  integrity.ts         Invest audit checks (ledger reconciliation + 4 more)
  appintegrity.ts      APP integrity: does the CODE still agree with the DB?
                       capability triggers that reach their own capability,
                       Scope union vs the authority ledger, realm keys the
                       cockpit can render, orphan rows, AETHER conservation,
                       enabled-but-unused bridges. Every failure names its fix
  guardian.ts          System sweep: databank/ledger/privacy/heartbeat/continuity
  risk.ts              Drawdown/exposure limits + global halt
  knowledge.ts         Expeditions to public sources (HF Hub, CoinGecko)
  training.ts          Trading curriculum Lumi & Aether study (Invest realm)
  aura.ts              Consent-gated personality/design profiles + briefs
  token.ts             AETHER: fixed-supply conserved credit ledger
  wallet.ts            In-app web3 wallet over the ledger (0x addresses, Sui link)
  defi.ts              AMM pool, yield vaults, collateralized lending
  sui.ts               Sui chain-link status (reads *_PACKAGE_ID / *_CAP secrets)
  shield.ts            Web3 security posture, red-team scan, privacy-first KYC
  growth.ts / growthx.ts  Content/campaigns/leads; connectors + deals pipeline
  orchestrator.ts      Lumi's command deck: dispatch to any agent (real engine
                       actions) or model (Claude via Anthropic API, honest
                       adapter); command log in orchestrator_tasks
  command.ts         Total Command: plain-English → capability, gated by the
                       authority ledger (scopes: observe/operate/spend/publish/
                       command/machine)
  autonomy.ts        One corrective act per pulse when `command` is granted
  local.ts           The machine-bridge queue (local_tasks): queue → claim → result
  secrets.ts         Constant-time secret comparison (no timing oracle)
  ratelimit.ts       Failure lockouts + call caps per bridge; Shield reads it
  creator.ts         The control-plane lock: which scopes need CREATOR_KEY
  policy.ts          Every writing route classified open/creator/bridge + why
  automation.ts      Is the hourly cron actually firing? Records every
                       unattended run; never / healthy / late / stalled
  newsroom.ts        Hourly posts drafted from real recorded events; silent
                       when nothing happened, never repeats an event
  obsidian.ts        Lumi's records as a linked markdown vault (unique paths,
                       live wikilinks, capped and honest about the cap)
  sources.ts         Per-panel provenance: live / ledger / measured / sim /
                       offline, so a simulation never looks like the real thing
  readiness.ts       Deployment preflight: what is wired, and the command for
                       what isn't (never claims a set key actually works)
  probe.ts           Red-team: attacks our own locked routes, demands refusal
  selfref.ts         Handle on our own router so the system can attack itself
  callers.ts         Who walks through each inbound bridge; an unfamiliar
                       caller is surfaced once and answered by trusting it
  rotation.ts        Two-secret overlap window (KEY / KEY_PREVIOUS) so a bridge
                       secret can be changed with zero downtime; every call on
                       the outgoing key is recorded so the window is closeable
                       on evidence, and Shield nags until it's closed
src/endpoints/         Reg's API — thin HTTP layer over the engine (see table)
src/dash/index.ts      Lumi: the self-contained Creator Cockpit — one ~2.2k-line
                       HTML doc, inline SVG charts, /analytics/overview polling,
                       calm-mode throttling. No CDN, no build step. The Jarvis
                       bar takes voice in (SpeechRecognition) and speaks replies
                       (speechSynthesis) — browser-native, nothing leaves the
                       page, and a browser without them says so instead of
                       offering a dead button. ↑/↓ recalls this session's orders;
                       the integrity chip sits beside the authority grants.
sui/aether/            Move package for the on-chain AETHER coin (publish.sh)
agent/                 lumi-agent.mjs — the local agent the creator runs on
                       their own machine; the only piece that can touch a real
                       filesystem or shell (see agent/README.md)
roblox/                InMotion RP kit: server-side Luau (AetherBridge +
                       Paychecks) that pays Roblox city players conserved
                       AETHER through POST /rp/grant (see roblox/README.md)
scripts/               dev.sh (local) + golive.sh (Cloudflare deploy)
tests/integration/     31 suites, 232 tests: seed→trade→learn→evolve; audit→
                       sweep→check-in; aether, wallet, defi, shield, growth(x),
                       buildplan, freshness, rp, local, orchestrator, command,
                       autonomy, authority-posture, ratelimit, rotation, appintegrity, callers, creator, policy, readiness, sources, dash, automation, hotpath, obsidian, learning, newsroom
```

## The flow (how the agents hand off to each other)

```
POST /colony/seed      Reg births the starter colony from agent DNA
POST /engine/run       Reg advances the market N ticks; every active bot
                       signals, trades, and compounds; the kill-switch
                       pauses any bot under the capital floor; Reporter
                       files a cycle report. Pass {learn:true} to run a
                       learning pass in the same call.
POST /engine/learn     Observer scores every strategy from trade history;
                       retires losers, evolves the champion, reassigns bots;
                       Reporter files a learning report
POST /lumi/pulse       One autonomous heartbeat: trade → learn → audit →
                       sweep → quests → awareness → initiative, all in one
                       call. The Cron Trigger fires this hourly when deployed.
POST /realms/invest/audit    Ledger + trade integrity checks; realm status set
POST /realms/guardian/sweep  Security/privacy sweep across the whole system
GET  /realms/tech/status     Diagnostics: table counts, tick, realm health
POST /realms/wellness/checkin  Creator logs mood/energy; Lumi tracks trend
POST /shield/scan      Red-team the posture; file findings + Shield status
GET  /aether · /wallet · /defi   The AI-credit economy: token supply, wallet
                       balances/sends, pool/vaults/lending — all conserved
GET  /growth · POST /growth/scout   Draft content, hunt leads, move deals
GET  /dash             Lumi reads the Databank through Reg's analytics and
                       renders the Creator Cockpit (calm-mode throttled)
```

Run cycles and learning passes repeatedly — by hand, by `POST /lumi/pulse`,
or unattended on the Cron Trigger — and the colony trains itself on its own
history, each generation built from the evidence of the last.

## API surface

Full list is auto-documented at `GET /` (OpenAPI). Grouped by realm/subsystem:

| Group | Endpoints | Purpose |
| ----- | --------- | ------- |
| **Colony** | `POST /colony/seed` · `GET /agents` · `GET /bots` `POST /bots` `PATCH /bots/:id` · `GET /strategies` · `GET /trades` | Seed the colony; agents/DNA; bots + control; strategies + lineage; trade history |
| **Engine** | `POST /engine/run` (`{ticks, learn?}`) · `POST /engine/learn` | Run a trading cycle (TP/SL per tick); score/retire/evolve |
| **Lumi** | `GET /lumi` · `POST /lumi/pulse` · `POST /lumi/research` · `POST /lumi/scout` · `GET /knowledge` · `POST /lumi/train` · `GET /lumi/curriculum` | Profile/skills; autonomous heartbeat; expeditions; curriculum |
| **Realms** | `GET /realms` · `POST /realms/invest/audit` · `POST /realms/guardian/sweep` · `GET /realms/tech/status` · `GET /realms/wellness` `POST /realms/wellness/checkin` | Six realms: mission, status, checks, goals |
| **Risk** | `GET /risk` · `POST /risk/halt` `POST /risk/resume` · `PATCH /risk/config` | Drawdown/exposure gates + global halt |
| **Market** | `GET /market` · `POST /market/feed` | Switch a symbol between sim tape and live replay |
| **Aether** | `GET /aether` `/aether/ledger` `/aether/chain` · `POST /aether/transfer` `/reward` `/spend` `/audit` | AETHER token ledger (conserved supply) |
| **Wallet** | `GET /wallet` `/wallet/:ref` · `POST /wallet` `/wallet/send` `/wallet/link` `/wallet/aether` | In-app web3 wallet; Aether self-mints its own |
| **DeFi** | `GET /defi` · `POST /defi/pool/{add,remove}` `/defi/swap` `/defi/vault/{deposit,withdraw}` `/defi/{borrow,repay}` | AMM pool, vaults, lending |
| **Shield** | `GET /shield` · `POST /shield/scan` `/shield/kyc` | Security posture, red-team, privacy-first KYC |
| **Integrity** | `GET /integrity` · `POST /integrity/scan` | The structural self-check — 9 checks across schema / wiring / referential / value / config, scored 0–100. Catches the failure class nothing else does: code that has drifted from the database and ships green anyway (a shadowed command trigger, a scope that can never be granted, a realm key nothing renders). Every failure carries the remedy, not just the diagnosis. Rides along in `/analytics/overview`, and Lumi can run it herself — "self check". **Runs unattended on every pulse** (hourly on the cron, and on `POST /lumi/pulse`), speaking only on a state change: a break is restated every pulse until fixed, a recovery is announced once, and a healthy system stays silent — an hourly "still fine" trains you to ignore the one that isn't. The pass/fail history is recorded either way. |
| **Growth** | `GET /growth` `/growth/posts` `/growth/leads` `/growth/deals` `/growth/connectors` `/growth/analytics` · `POST /growth/{post,campaign,lead,scout,connect,deal}` … | Content, campaigns, leads, connectors, deals |
| **InMotion RP** | `POST /rp/grant` `/rp/spend` · `GET /rp/player/:userId` | Roblox city bridge: players earn (treasury→player) and spend (player→treasury) conserved AETHER; secret-gated via `RP_SHARED_SECRET`, off until set |
| **Control plane** | `CREATOR_KEY` guards `POST /command` + `PATCH /command/authority` | The authority ledger says what Lumi *may* do; this key says *who may ask her*. Observe/operate (read, trade, audit, sweep, study) stay open so a fresh checkout is usable. **Granting** spend / publish / command / machine — and issuing any order under one — requires the key. **Revoking never does:** losing a credential must never leave you unable to shut a door. With no key set, the consequential half is unavailable to everyone rather than open to everyone; Shield says so on the security panel. Key lives in the cockpit's sessionStorage only, never on disk or in the Databank. **The same key guards the side doors**, because a scope model you can step around by choosing a different URL is theatre: `/aether/{transfer,reward,spend}`, `/wallet/send`, all seven `/defi/*`, `/growth/connect`, `/growth/post/:id/publish`, and `/bridges/trust` all require it. Reading is never gated — you can always see what is happening. `/rp/*` and `/local/*` keep their own bridge secrets. |
| **Guard proof** | `POST /integrity/probe` · `src/engine/policy.ts` · `src/engine/probe.ts` | Both security holes this project shipped were found by a human reading the route table. That is now automated, twice over. **(1)** Every writing route is classified in `policy.ts` — `open` / `creator` / `bridge` — with the reason; a test reads `src/index.ts` and fails if any POST/PATCH/PUT/DELETE is unclassified, so you cannot add a writing endpoint without deciding in writing what may reach it. **(2)** The probe *attacks the running Worker*: it dispatches an anonymous, empty-bodied request through the real router at every `creator` route and demands a refusal. A policy that claims "guarded" while the handler forgot the guard is the exact bug we hit twice — this catches it. A `400` counts as a **hole**: reaching schema validation means authorization ran late or not at all. Shield runs the probe on every scan and zeroes the authority score if any route fails, because one open door makes every other line on that panel advisory. |
| **Hot-path budget** | `tests/integration/hotpath.test.ts` | `GET /analytics/overview` is polled every 8 seconds by every open cockpit tab. Over this project's life a DB-backed computation was added to that payload almost every time it was touched — integrity, callers, readiness, provenance, automation — and the total was never measured. It is **~90 queries per poll**: survivable, and exactly the kind of number that doubles quietly because each addition looks free on its own. The budget is now enforced (110), along with a check that the count **does not grow with the size of the colony** (a per-row query in a loop looks perfect on a fresh install, which is where it always gets reviewed). The independent blocks also run in one `Promise.all` instead of seven serial awaits — invisible on local D1 (a file), real on remote D1 (a network hop per query). |
| **Automation health** | `automation` in `/analytics/overview` · `src/engine/automation.ts` · migration 0025 | Lumi pulses hourly on a Cron Trigger. The failure mode is silent: a stopped cron looks exactly like a healthy one — the cockpit keeps rendering the last numbers it has, every realm still says nominal, and nothing says "this is from Tuesday". Every unattended run now records what ran, **what fired it**, whether it worked and how long it took, so the gap is measurable. Three distinctions it refuses to blur: *never run* is not *stalled* (a fresh system is new, not broken); a pulse fired **by hand** never counts toward schedule health, or clicking Pulse would paper over a dead trigger; and lateness only starts at 1.5× the hourly cadence (stalled at 3×) because Cloudflare crons are best-effort and an alarm that cries wolf gets ignored. |
| **Panel provenance** | `sources` in `/analytics/overview` · `src/engine/sources.ts` | Every panel states where its numbers come from, computed from live state: **LIVE** (real outside-world data flowing), **REAL LEDGER** (conserved AETHER, actually recorded), **MEASURED** (this system's own state), **SIM TAPE** (deterministic simulation), **OFFLINE / ARMED / LOCAL DRAFTS** (needs a key, or has one but nothing has called yet). Every panel always rendered real Databank rows — none of it was ever mock — but "real rows" and "real world" are different claims, and an unlabelled number let a reader take only the flattering one. The trading panels say **PAPER** on either feed: no broker is connected, on any tape. The market only reads LIVE once ≥2 real observations are banked, which is the same threshold the feed itself uses to refuse to invent movement. Lumi now scouts real prices **every pulse** and reports the miss when she can't. |
| **Newsroom** | `GET /growth/newsroom` · `POST /growth/newsroom` · runs on every pulse | Drafting used four fixed templates with a topic word swapped in — run hourly, that is the same four posts forever: fluent, confident, carrying no information. The system already produces real material every hour, so posts are now drafted **from recorded events**: a return milestone crossed, a new generation bred, a strategy retired for losing money, the security posture, a green structural self-check, a completed quest, citizens earning in the city. Three rules matter more than the copy: **a quiet hour drafts nothing** (a feed obliged to fill every slot starts inventing); **never the same event twice** (`posts.event_key`); and **every number comes from a row**. Platforms rotate across the feed's history so it is not one voice. The retirement story — *"we killed a strategy that was right 58% of the time"* — is weighted above every flattering milestone, because a build-in-public feed that only surfaces good news is marketing wearing an engineer's jacket. Everything stays a **draft** until a connector is configured and a human ships it. |
| **Obsidian export** | `GET /obsidian` · `GET /obsidian/export[?format=markdown]` | Everything Lumi records lives in D1, queryable only through this app — useless the moment you want to think alongside it, search it beside your own notes, or keep it after the Worker is gone. This exports it as plain markdown with Obsidian conventions (YAML frontmatter, `[[wikilinks]]`, tags): an index, a note per realm, a note per report, plus goals/quests/checks tables. Nothing is Obsidian-only — it is markdown, readable anywhere, readable in ten years. Report titles repeat constantly, so colliding filenames get the report id appended; **two notes at one path would silently overwrite each other**, which is the worst possible bug in an export whose purpose is keeping records. Caps are reported, never silent. **`OBSIDIAN_VAULT_ID` is a label, not a credential** — a vault id is local, no server can write into your vault because it knows one, and the payload itself says so. |
| **Readiness** | `GET /ready` | One page answering "what do I still have to do?". Every switch — creator key, Claude, open models, both bridges, publishing, Sui — with what it unlocks and the exact command, plus a single named next step. `CREATOR_KEY` is the only **required** one. It states its own limit: *configured* means the value is present, not that it works — a revoked key looks identical from here, and each realm's panel reports whether its service actually answered. `scripts/golive.sh` now offers to set the creator key during deploy (step 6/7) rather than leaving a live Worker answering 503 with no explanation. |
| **Total Command** | `GET /command` · `POST /command` · `PATCH /command/authority` | One bar, all control: a plain-English order routes deterministically to one of **15** registered capabilities across every realm, is checked against the **authority ledger** — 6 scopes, `observe`/`operate` granted by default, `spend`/`publish`/`command`/`machine` revoked until the creator grants them — then runs for real and is logged. Boundary stated in-product: the Worker itself has no filesystem/shell/OS, so it cannot touch the creator's computer; the only path to the machine is the `machine` capability, which queues work for the local agent the creator runs themselves (see Local Agent). |
| **Local Agent** | `GET /local` · `POST /local/next` `/local/result` | Lumi's hands on the creator's machine. She queues a task (needs the `machine` grant); `agent/lumi-agent.mjs`, run by the creator on their own computer, claims it and decides whether to run it — allowlist, no shell, per-task confirmation, sandboxed workdir. The Worker never executes anything; the machine always holds the veto. Secret-gated with `LOCAL_AGENT_SECRET`. |
| **Bridge hardening** | applies to `/rp/*` and `/local/*` · `GET /bridges` · `POST /bridges/trust` | Both inbound bridges share one gate, covering the three ways a shared secret goes wrong. **Guessed** → constant-time comparison (`secrets.ts`) plus a failure lockout that refuses even the *correct* secret while it holds, and a per-bridge call cap (`ratelimit.ts`). **Leaked** → a rotation window (`rotation.ts`): each bridge accepts `KEY` **and** `KEY_PREVIOUS`, so a compromised secret is replaced with zero downtime, and every call on the outgoing key is recorded so the window can be closed on evidence. **Copied** → caller identity (`callers.ts`): every authenticated call records who made it, the first caller on a bridge becomes the baseline, and the next unfamiliar one raises a question Shield asks once and you answer by trusting it. All three cost posture score while open. **Stated limit:** caller names are self-reported, so a thief holding the secret can claim a name you trust — it raises the cost of quiet misuse, it is not a second factor. |
| **Orchestrator** | `GET /orchestrator` · `POST /orchestrator/dispatch` `/orchestrator/council` | Lumi commands every intelligence: internal agents run their REAL engine actions (reg→cycle, observer→learn, guardian→sweep, aether→study, shield→scan, growth→scout, lumi→pulse); Claude links via the Anthropic API (`ANTHROPIC_API_KEY`) and open models via Hugging Face Inference (`HF_TOKEN`) — each honestly offline until its key is set; counsel is banked into `knowledge`. Every dispatch logged in `orchestrator_tasks`. **Council** puts one directive to every model at once (parallel) and records who answered — never synthesizing a verdict from voices that didn't speak. |
| **Aura** | `GET /auras` `/auras/:id/brief` · `POST /auras` | Consent-gated profiles + personalization briefs |
| **Records / cockpit** | `GET /reports` · `GET /goals` `POST/PATCH` · `GET /analytics/overview` · `GET /dash` · `GET /` | Feed, goals, one-call cockpit payload, dashboard, OpenAPI |

## Roadmap (seeded as live goals in the Databank)

1. **Prove the loop** — colony seeds, trades, learns, evolves; tests green. ✅ this build
2. **Stop the bleed** — per-trade take-profit/stop-loss caps every loss and
   banks every win; the colony runs net-positive on the seeded tape. ✅
3. **Raise the win rate** — run many cycles, let selection pressure and the
   trend filter work; tune score floor, mutation ranges, and the TP/SL bands
   from evidence. (Note: the current TP/SL profile trades a *lower* win rate for
   *higher* expectancy — retune the bands if a higher win % is the goal.)
4. **Live data adapter** — ✅ shipped: `src/engine/feed.ts` replays banked real
   observations behind the same `PriceFeed` interface (still paper execution);
   flip a symbol with `POST /market/feed`.
5. **Scheduled autonomy** — ✅ shipped: the Cron Trigger fires `POST /lumi/pulse`
   hourly so the colony trades/learns/audits/sweeps unattended.
6. **Risk gates for real capital** — gates shipped (`src/engine/risk.ts`:
   drawdown/exposure limits + global halt); broker/exchange integration stays
   gated behind sustained, measured edge.

## Rules of the build

- **No dead code.** No orphaned endpoints, exports, types, files, or tables.
  Sweep for stale code regularly — see below.
- Every feature lands with an integration test in the same commit.
- Schema changes only via migrations; the Databank is the single source of truth.
  Remove stale schema forward-only (a `DROP ... IF EXISTS` migration), never by
  editing or deleting an already-applied migration.
- Determinism first: seeded market so every run is reproducible and debuggable.
- Vital core outward: schema → engine → API → visuals, in that order, always shippable.

### Stale-code sweep (how Lumi keeps herself clean)

Run this periodically — after big features, before a release, or on request:

1. **Drift** — `grep` for hard-coded counts/lists that fall out of date
   (e.g. "four realms", route tables, the API surface here) and reconcile them
   to the code. Docs are part of the build.
2. **Dead exports/types** — for every `export`, check it's referenced outside
   its own file (or at all). Unused `interface`/`type`/function → delete it.
   (This is how `StrategyRow` and `HandleArgs` were removed.)
3. **Orphan schema** — every table/column should have a reader and a writer in
   `src/`. Orphans (like the template's `tasks` table) get a forward `DROP`.
4. **Template scaffolding** — no leftover demo endpoints, `dummy`, hello-world,
   or copy that describes a system we no longer are.
5. **Honest seams stay.** A commented connector call guarded by a missing secret
   (e.g. `growthx.ts`) is a deliberate seam, not dead code — leave it.

Green bar is the gate: `npx tsc --noEmit` and `npm test` (83) must pass after
any sweep.
