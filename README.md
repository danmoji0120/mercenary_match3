# Mercenary MATCH

Mercenary MATCH is a playable, portrait-first 1v1 real-time match-3 prototype. Each player controls an independent 7x7 board. Sword matches launch delayed attacks, shield matches immediately add protection, heal matches restore HP, and mana matches charge the shared Focused Barrage skill.

## Rules

- 120 seconds, 1,000 HP, 500 maximum shield, and 100 maximum skill gauge.
- Only orthogonally adjacent tiles may swap. Invalid swaps are rejected and restored.
- Matches clear, fall, refill, cascade, and automatically shuffle when no legal move remains.
- Sword damage is 70 / 115 / 170 for 3 / 4 / 5 tiles, plus 35 per sword above five.
- Shield is 65 / 105 / 155; healing is 35 / 55 / 80; mana is 20 / 32 / 48.
- Cascades multiply effects from 1.0 through 1.6 in 0.1 steps.
- Sword travel time is 300 / 400 / 550 ms. Focused Barrage costs 100 gauge, deals 190 damage, and travels for 700 ms.
- During the final 30 seconds, Frenzy replaces the old healing-only reduction: sword and Focused Barrage damage are multiplied by 1.35, shield gain by 0.80, healing by 0.50, and mana remains at 1.00. Chain multiplication is applied before the Frenzy multiplier and the result is rounded once.
- Attacks consume shield before HP. Zero HP ends the battle immediately. At timeout, HP decides first, shield second, otherwise the battle is a draw.

## Architecture

This is an npm-workspaces TypeScript monorepo:

- `packages/shared`: deterministic seeded board logic, battle configuration, combat functions, and wire types.
- `apps/server`: Express health endpoint, Socket.IO authoritative matchmaking and battles, reconnect sessions, and server-side board-playing bots.
- `apps/client`: React UI with a Phaser board, Web Audio effects, SVG tile/character art, mobile swipe input, and server snapshot reconciliation.
- `tests/e2e`: two isolated browser contexts exercising matchmaking, a real sword move, a real shield move, attack arrival, ending, and rematching.

The server owns the queue, board arrays, swap validation, resolution, stats, pending attacks, clock, and result. Clients send only input intent. Runtime schemas reject malformed or extra swap data. The client performs only a visual optimistic swap and always reconciles to the next authoritative snapshot.

## Install and run

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the client at `http://localhost:5173`. The server listens at `http://localhost:3001`, and its health endpoint is `http://localhost:3001/health`.

To test PvP manually, open two separate browsers or one normal and one private window. Click the normal-match button in both. They enter the same battle after the three-second countdown. To play a bot immediately, use the bot button. A lone normal queue automatically receives a bot after 60 seconds.

For a phone on the same network, allow ports 5173 and 3001 through the host firewall, set `VITE_SERVER_URL=http://HOST_LAN_IP:3001`, restart development, then visit `http://HOST_LAN_IP:5173` on the phone. The portrait arena fills the phone width; desktop and tablet layouts retain the centered 9:16 play area.

## Verification

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npx playwright install chromium
npm run test:e2e
```

The E2E test enables guarded development commands only for its spawned server. The development-only panel shows battle ID, socket status, ping, clock offset, both players' stats, incoming attacks, board version, deterministic moves, forced result controls, and instant bot entry. Production builds omit this panel, and the server ignores debug commands unless `ENABLE_TEST_API=true`.

## Environment variables

Copy `.env.example` when overrides are needed. Important values are `PORT`, `CLIENT_ORIGIN`, `VITE_SERVER_URL`, `QUEUE_BOT_DELAY_MS`, `RECONNECT_GRACE_MS`, `COUNTDOWN_MS`, and `ENABLE_TEST_API`. Never enable the test API in a public deployment.

## Reconnect and rematch

The per-tab guest session token is stored in `sessionStorage`. Refreshing reconnects the same participant to a server snapshot within ten seconds; exceeding the grace period loses by disconnect. A bot rematch starts after the human request. A human PvP rematch begins after both players request it. No account or persistent storage is used.

## Scope and extension points

Implemented scope is the real-time normal match, automatic queue, real-board bot, four tile effects, one shared active skill, reconnect, surrender, rematch, touch/desktop controls, procedural sound, reduced motion, tests, and developer diagnostics. Accounts, database, collection, gacha, economy, equipment, ranking, story, chat, guilds, payment, administration, and app-store packaging are intentionally absent.

Future combatants and two support mercenaries attach at `LoadoutDefinition` and `BattleParticipant` in the shared package. The current temporary loadout is data, while combat formulas remain in shared configuration rather than UI components.

## Known limitations

- Sessions and live battles are in memory and disappear when the server restarts.
- There is one server process and no cross-process queue or battle migration.
- Temporary geometric fighter art and synthesized effects are deliberately minimal.
- The prototype has no spectator or replay system.

## Playtest tuning

Bot difficulty values live in `apps/server/src/bot-config.ts`. The default bot waits 2,200-3,400 ms after battle start. After a resolved board it allows a 900 ms presentation buffer, then thinks for 1,800-2,900 ms. Selection is split into 30% best move, 30% random among the top five, and 40% random among every legal move. It misses four-matches 45% and five-or-more matches 35% of the time. Strong-attack awareness is 40%, defensive reaction is 900-1,600 ms, and full-gauge skill judgment waits 1,000-1,800 ms before a 65% base use roll. High shield lowers that roll; low enemy HP and Frenzy raise it.

Healing awareness is 60% at 20-40% HP and 70% below 20% HP. Shield and healing candidates remain subject to the normal move-selection branch, while repeated HEAL/SHIELD actions receive escalating score penalties recorded from the last two bot actions. Mana is mildly preferred only below 50 gauge and penalized at 80 or full gauge. `validateBotConfig` enforces valid probability ranges, delay ranges, and an exact 100% move-selection total.

Board presentation values live in `apps/client/src/board-animation-config.ts`. Defaults are 150 ms swap, 220 ms match highlight, 160 ms removal, 280 ms fall, 120 ms spawn/settle, 120 ms between chains, and 700 ms result text visibility. These values affect presentation only; the authoritative server still resolves the complete board and combat effects immediately.

Frenzy values live in the shared `BATTLE_CONFIG`: `frenzyStartRemainingMs`, `frenzyAttackMultiplier`, `frenzyShieldMultiplier`, `frenzyHealMultiplier`, and `frenzyManaMultiplier`. The server emits the transition once, includes the complete Frenzy state in every battle snapshot, and remains the only authority for all multiplied values.

Every battle also keeps server-owned per-player statistics for generated/actual damage, shield absorption, actual shield/healing/mana gains, match group and tile counts, maximum chain, skill uses, queued/fully-blocked attacks, and shield breaks. The final result freezes both players' statistics plus duration, explicit end reason, end-reason flags, and Frenzy duration. Reconnect snapshots preserve live statistics; rematches create a fresh battle and zero them.
