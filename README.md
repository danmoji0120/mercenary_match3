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

The E2E test enables guarded development commands only for its spawned development server. The development-only panel shows battle ID, socket status, ping, clock offset, both players' stats, incoming attacks, board version, deterministic moves, forced result controls, and instant bot entry. Production builds omit this panel, and the production server rejects debug commands regardless of `ENABLE_TEST_API`.

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

## Mobile App Shell and navigation

Outside battle, the client uses a single mobile game App Shell with a fixed resource bar, one scrollable content area, and safe-area-aware bottom navigation. Only implemented destinations are exposed: Lobby, Mercenaries, and Loadout. Recruitment, inventory, forge, and shop placeholders are deliberately absent. Desktop browsers keep the same navigation inside the centered portrait frame.

The normal-screen routes are `/gacha`, `/mercenaries`, `/lobby`, `/inventory`, and `/forge`. Mercenary detail and editing add `/mercenaries/:characterId` and `/mercenaries/loadout`. `/` and unknown routes safely normalize to `/lobby`; invalid character detail routes return to `/mercenaries`. Browser back/forward and refresh restore the current normal view without rerunning the account bootstrap or recreating the Socket.IO client. The account, owned-character list, saved loadout, and authenticated socket remain owned by the top-level application for the lifetime of the page.

- Gacha is a presentation-only preparation screen. Recruitment buttons are disabled and there are no rates, currency, results, or network requests.
- Mercenaries opens the collection-first **Mercenary Archive**. Its image-led cards expose only short names, rarity, recommended role, and current combatant/support placement. Search covers names, descriptions, and tags; rarity and role filters plus name/rarity sorting are local and make no server request.
- Selecting a collection card opens a route-backed, focus-trapped character detail dialog. It presents the large available portrait, setting text, active ability, support effect, and current placement without exposing internal IDs or effect JSON. Escape, the close action, backdrop click, and browser Back close it and restore focus to the originating card when available.
- `/mercenaries/loadout` is the only full loadout editor. It separates the combatant, support 1, and support 2 slots from slot-specific candidates, prevents duplicate and disallowed choices in the UI, and keeps edits in a local draft. Cancel, Escape, or browser Back prompts before discarding a dirty draft. Save reuses the authenticated loadout API and `expectedVersion`; success updates the top-level account immediately, while failure preserves the draft and the previously saved loadout.
- Lobby is the home screen. It displays the saved combatant and two supports, normal matchmaking, immediate bot training, and a shortcut that opens the loadout editor directly. Save or cancel returns to Lobby when editing began there, and a successful save refreshes the Lobby summary without another account bootstrap.
- Inventory provides five local filters and an intentional empty state. It does not invent or request item data.
- Forge is accessible as a visibly locked future-content screen. It does not create unlock requirements, equipment, crafting, or enhancement state.

When an authoritative battle snapshot exists, `/battle` replaces the App Shell, header, and bottom navigation with the dedicated no-scroll combat screen. Browser navigation cannot hide a live or finished battle locally. The explicit server-approved return-to-lobby flow clears the battle presentation, restores the Lobby tab at `/lobby`, and keeps the Supabase account and Socket.IO connection alive. A refreshed page can still restore a server-held battle through the existing reconnection snapshot.

Actual recruitment, items, equipment, crafting, and enhancement remain unimplemented future systems.

Character growth, equipment, multiple loadout presets, automatic composition, and server-saved favorites are also not implemented.

## Render single-service deployment

Production uses one Render Node Web Service. The built Express process serves `/health`, the Socket.IO endpoint, Vite static assets, and the React SPA from the same HTTP server and public origin. This keeps the in-memory queue and battles on the same instance as every connected client; do not create a separate Static Site or a second Web Service.

### Blueprint deployment from GitHub

1. Commit and push the repository, including `render.yaml` and `package-lock.json`, to GitHub.
2. In the Render Dashboard, choose **New > Blueprint** and connect the GitHub repository.
3. Render discovers the root `render.yaml`. Review the single `mercenary-match3` Web Service and apply it.
4. Follow the build in the service Events/Logs view. A successful deploy runs the health check before accepting traffic.
5. Open the service's generated `https://mercenary-match3-....onrender.com` URL shown in the dashboard.
6. Open that same URL on two phones and choose normal matchmaking on both, or choose the immediate bot option on one phone.

The Blueprint settings are:

- Service Type: Web Service
- Runtime: Node
- Root Directory: repository root (leave the field empty in Render)
- Region: Singapore
- Instance Type / Plan: Free
- Build Command: `npm ci --include=dev && npm run build`
- Start Command: `npm run start`
- Health Check Path: `/health`
- Environment: `NODE_ENV=production`

`PORT` is supplied by Render and must not be fixed in the Blueprint. `CLIENT_ORIGIN` and `VITE_SERVER_URL` are not required for the same-origin deployment. The server binds Render's port on `0.0.0.0`; the browser automatically uses HTTPS/WSS through the page origin.

### Manual Web Service creation

Choose **New > Web Service**, connect the GitHub repository, select Node, Singapore, and Free, then enter the same build/start/health values listed above. Keep the root directory at the repository root and add only `NODE_ENV=production`. Check the deploy logs for `staticClient=true`, the resolved client dist path, and a successful `/health` probe. Do not copy secrets or a fixed `PORT` into the service.

### Local production verification

```bash
npm ci
npm run build
npm run start
# open http://localhost:3001 and http://localhost:3001/health
npm run test:production
```

`npm run start` executes only the compiled Node server; it does not use Vite, tsx, or ts-node. `npm run test:production` starts the compiled server on an available port, verifies health/index/assets/SPA/Socket.IO/matchmaking/bot/debug-command blocking/shutdown, and then runs mobile Chromium against the production server.

### Free-instance behavior and troubleshooting

- A free service can cold-start after being idle. The lobby disables matchmaking until Socket.IO reconnects and shows a retry control after a prolonged failure.
- If the deploy reports a missing client build, confirm the build command is exactly `npm ci --include=dev && npm run build` and that the service root is the repository root.
- If Render reports no bound port or a 502, confirm the start command is `npm run start`; never set a second frontend port.
- If static assets return 404, inspect the build log for the Vite and server build steps and verify `/health` reports `clientReady: true`.
- If Socket.IO fails only after deployment, remove `VITE_SERVER_URL` so the client uses its current `onrender.com` origin.
- A service restart or redeploy loses all in-memory guest sessions, queues, and active battles. Players return to a fresh lobby.
- Keep exactly one instance. Multiple instances would split the in-memory queue and battle authority. Before horizontal scaling, matchmaking, session routing, pending attacks, and battle state would need a shared external state/coordination layer such as Redis; that is intentionally outside this prototype.

## Playtest tuning

Bot difficulty values live in `apps/server/src/bot-config.ts`. The default bot waits 2,200-3,400 ms after battle start. After a resolved board it allows a 900 ms presentation buffer, then thinks for 1,800-2,900 ms. Selection is split into 30% best move, 30% random among the top five, and 40% random among every legal move. It misses four-matches 45% and five-or-more matches 35% of the time. Strong-attack awareness is 40%, defensive reaction is 900-1,600 ms, and full-gauge skill judgment waits 1,000-1,800 ms before a 65% base use roll. High shield lowers that roll; low enemy HP and Frenzy raise it.

Healing awareness is 60% at 20-40% HP and 70% below 20% HP. Shield and healing candidates remain subject to the normal move-selection branch, while repeated HEAL/SHIELD actions receive escalating score penalties recorded from the last two bot actions. Mana is mildly preferred only below 50 gauge and penalized at 80 or full gauge. `validateBotConfig` enforces valid probability ranges, delay ranges, and an exact 100% move-selection total.

Board presentation values live in `apps/client/src/board-animation-config.ts`. Defaults are 150 ms swap, 220 ms match highlight, 160 ms removal, 280 ms fall, 120 ms spawn/settle, 120 ms between chains, and 700 ms result text visibility. These values affect presentation only; the authoritative server still resolves the complete board and combat effects immediately.

Frenzy values live in the shared `BATTLE_CONFIG`: `frenzyStartRemainingMs`, `frenzyAttackMultiplier`, `frenzyShieldMultiplier`, `frenzyHealMultiplier`, and `frenzyManaMultiplier`. The server emits the transition once, includes the complete Frenzy state in every battle snapshot, and remains the only authority for all multiplied values.

Every battle also keeps server-owned per-player statistics for generated/actual damage, shield absorption, actual shield/healing/mana gains, match group and tile counts, maximum chain, skill uses, queued/fully-blocked attacks, and shield breaks. The final result freezes both players' statistics plus duration, explicit end reason, end-reason flags, and Frenzy duration. Reconnect snapshots preserve live statistics; rematches create a fresh battle and zero them.
## Supabase account and character foundation

The browser uses Supabase Auth only. It restores an existing persisted session, but it never creates an anonymous user automatically. A signed-out player chooses either `게스트로 시작` or passwordless email login. Guest start calls anonymous sign-in exactly once, while email login requests a magic link with `shouldCreateUser: false`; a new player therefore starts as a guest and protects that same account by linking email later.

`/account` shows whether the current user is a guest, waiting for email confirmation, or a protected email account. Linking calls Supabase `updateUser({ email })` on the signed-in anonymous user, not `signUp`. The callback at `/auth/callback` verifies the resulting session and requires the linked user ID to remain unchanged. Profile, owned-character, loadout, and loadout-version rows stay attached to that existing ID: they are neither copied nor reissued. Automatic guest/permanent account merging is deliberately unsupported.

Permanent accounts may sign out and return through an email magic link on another browser or device. Signing out disconnects Socket.IO, clears client account/battle presentation state, and returns to the signed-out entry screen without creating a replacement guest. An unlinked guest must pass a destructive-action warning before abandoning the local session; the server does not delete or merge that guest's database rows.

The browser never reads or writes the account tables directly. Express verifies the latest bearer token and performs profile, ownership, and loadout operations with the server-only secret key. Socket.IO independently verifies the same access token during its handshake. A refresh for the same user updates the socket credential without constructing a new socket or duplicating listeners; changing users performs a full disconnect and clears the previous battle reconnection token.

Required browser build variables are `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. `VITE_PUBLIC_APP_URL` controls the fixed callback origin and may fall back to `window.location.origin`; use `http://localhost:5173` locally and the public Render origin in production. Required server variables are `SUPABASE_URL` and `SUPABASE_SECRET_KEY`.

Before deploying, configure these items manually in the Supabase Dashboard (this repository cannot change them):

- Enable Anonymous Sign-Ins and the Email provider.
- Enable Manual Identity Linking so an anonymous user can attach email to the same Auth user.
- Set Site URL to the production public origin.
- Allow `http://localhost:5173/auth/callback` for local development and the Render public origin's `/auth/callback` for production.
- Verify the email template returns to `/auth/callback` and configure a production-capable email sender/SMTP service.

A publishable key is intended for browser use under Auth and RLS rules; the secret key bypasses RLS and must exist only in the server environment. Never create a `VITE_SUPABASE_SECRET_KEY`. On Render, add the server variables and all three `VITE_` build variables to the Web Service. Changing a `VITE_` value requires a new deployment. Redirect destinations are code-controlled and never accepted from user input.

The migration creates these RLS-enabled, server-only tables:

- `auth.users`: Supabase anonymous or email-linked identity.
- `match3_profiles`: display name and account timestamps.
- `match3_user_characters`: one ownership row per character ID.
- `match3_user_loadouts`: combatant plus two distinct supports and an optimistic version.

`match3_bootstrap_user` is an idempotent, atomic, `SECURITY DEFINER` RPC. It verifies the Auth user, repairs missing starter ownership, and creates only missing profile/loadout data. Table access and function execution are revoked from `public`, `anon`, and `authenticated`; only `service_role` can execute the bootstrap RPC.

Apply and regenerate types from the already linked Supabase project:

```bash
npx supabase db push --dry-run
npx supabase db push
npm run supabase:types
```

Review the dry run before `db push`. The migration is additive and does not remove account data. Generated types use the CLI link state; no project reference or key is stored in source.

### Character content packs

Official definitions live under `content/characters/<package-id>` as `manifest.json`, `character.json`, `active.json`, and `support.json`, with optional presentation metadata and a trusted internal server module. A package may declare one local PNG, JPEG, or WebP portrait through `character.json` `assets.portrait`; generation validates its signature and 8 MiB limit, copies it to a content-hashed public URL, and rejects stale generated assets. Packages without a raster portrait use the shared client fallback. `npm run content:generate` validates and deterministically generates the server registry and capability reference before development, typecheck, tests, and production builds. Runtime directory scanning and character-ID combat branches are not used. See [Character Package & Skill Framework](docs/character-content-system.md) for the conceptual guide and [generated skill framework reference](docs/skill-framework-reference.generated.md) for the exact current validator/runtime capability matrix. Run `npm run content:docs` after schema changes and `npm run content:check` (which includes `content:docs:check`) to reject stale generated output.

The initial starter roster is Yuria, Clarice, Marta, Evelyn, and Eda. The default human loadout is Yuria/Marta/Evelyn; the bot uses Clarice/Marta/Eda. Loadouts and resolved main-combatant stats are frozen into battle snapshots. `maxHp` supplies starting and maximum HP, while the four percentage stats scale only the corresponding base board-tile result; declared active, support, scheduled, status, and custom-command values are not implicitly scaled.

### Local and test operation

Copy the example variables to local untracked environment files and run `npm run dev` to use the linked remote Supabase project. Automated tests set `ACCOUNT_TEST_MODE` and `VITE_ACCOUNT_TEST_MODE` only in non-production and use fake Auth plus an in-memory repository. The fake covers no-session, anonymous/permanent sessions, link-pending, same-user callback, expired/used callbacks, token refresh, sign-out, duplicate email, and existing-user-only magic links without sending real email or creating remote users. Production rejects that test path.

The character registry and account ownership are intentionally separate. Account bootstrap grants or repairs only the five starter characters. In a Vite development build, open the Mercenaries tab and use `DEV 전체 캐릭터 지급` to add every currently enabled registry character to the current authenticated test/development account. The authenticated development endpoint `POST /api/dev/account/grant-characters` accepts the groups `representative-0.4`, `r-batch-0.5.1`, `r-batch-0.5.2`, and `all-enabled`, inserts only missing ownership rows with a `development:<group>` acquisition source, and returns added, existing, and failed IDs. Repeating a group is idempotent and does not modify the profile or saved loadout. The route is not installed when `NODE_ENV=production`, and the button is removed by the production client build.

Anonymous accounts persist with Supabase even when the game server restarts. However, signing out or clearing browser storage before linking email can make that identity unrecoverable. Email linking preserves the same Auth user ID and therefore preserves the existing profile, owned characters, and saved loadout without another starter grant. Existing RLS ownership checks remain user-ID based for both guest and permanent users, so this milestone requires no database migration or RLS change. Active matches remain in server memory and are still lost on a Render process restart.

This milestone does not implement password login, Google or Apple login, account merging, account deletion, email changes, or two-factor authentication. CAPTCHA is also not enabled here; Supabase Auth remains the final rate-limit authority and the client adds only a 60-second resend cooldown.

## Generic Character Effect Engine

Combat abilities are server-authoritative package JSON under `content/characters`; shared status definitions remain under `content/core/statuses`. The engine exposes normalized triggers, composable conditions, generic effect executors, status modifiers, cooldowns, once-per-battle limits, charges, deterministic scheduled effects, scoped caps, structured value expressions, and earlier-effect result references. Production combat code dispatches normalized events and never branches on a character or ability ID.

Damage order is: base amount, chain/frenzy multiplier where applicable, outgoing status modifiers, incoming status modifiers, one final rounding step, shield-bypass split (capped at 50%), shield damage, HP damage, then shield-break, HP-threshold, and after-damage triggers. Healing applies frenzy and healing-received modifiers before one rounding step, separates actual healing from overhealing, and then runs overflow effects. Shield gain applies frenzy and shield-gain modifiers before its cap.

### Adding a character

When existing primitives are sufficient, add only package JSON, an optional package-local raster portrait, and tests. TypeScript changes are not needed. A trusted internal package may opt into a statically generated `server.ts` custom-handler module that returns engine commands without mutating battle state; externally uploaded code and runtime module discovery remain prohibited. New primitives require a schema extension, a generic executor or evaluator, primitive tests, and regenerated capability documentation.

Official active/support pairs remain Yuria (Counter Break / Revenge Edge), Clarice (Fortress Stance / Heavy Guard), Marta (Guard Command / Intercept Order), Evelyn (Field Surgery / Emergency Stitch), and Eda (Curse Verdict / Exposed Flaw). Their existing IDs and battle values are preserved in the generated registry.

### Result exit

Return to lobby is an explicit, idempotent server request. It cancels rematch readiness, detaches the participant from the finished battle, rotates the battle reconnection token, notifies the opponent, keeps Socket.IO and the Supabase/account session alive, preserves ownership and the saved loadout, and allows a fresh queue entry. Scheduled combat work is cleared when the battle finishes or is abandoned.

## Account currency foundation

`UserAccountState.currencies` contains the six server-authoritative balances `gold`, `recruit_token`, `rarity_shard_r`, `rarity_shard_sr`, `rarity_shard_ssr`, and `rarity_shard_ex`. New and existing accounts receive an explicit zero row for every missing currency; bootstrap never resets an existing balance. Display names, icon keys, and order come from the shared `CURRENCY_METADATA` definition.

The server-only `AccountRepository.applyCurrencyTransaction` contract applies one or more integer deltas atomically. A transaction rejects the complete change set if any balance would become negative or unsafe, and a user-scoped `requestKey` makes retries idempotent. Reusing the key with a different reason or change set is a conflict. Clients do not receive a general-purpose balance mutation API.

Migration `20260714120000_account_currency_foundation_0_6_0.sql` adds `match3_user_currencies`, the request ledger `match3_currency_transactions`, and the service-role-only `match3_apply_currency_transaction` RPC. The RPC uses a transaction advisory lock plus row locks, records the reason and normalized changes, and returns all resulting balances. Apply the migration with the normal Supabase dry-run and push workflow before deploying this version.

Development builds place account test actions in the top resource bar's DEV tools sheet. `ui-preview`, `recruitment-test`, and `reset-currencies` are server-defined presets; the browser cannot submit arbitrary amounts. The same sheet contains the existing idempotent all-enabled character grant. Neither development route is installed in production and the DEV sheet is removed from the production client bundle.

The common mobile shell uses `TopResourceBar`, safe-area-aware scrolling, and one centralized bottom-navigation definition. The resource bar shows compact contract-stone and gold balances; selecting either opens a sheet with full localized balances for all six currencies. The collection supports owned-only search, rarity and canonical role filtering, recent/name/rarity sorting, three-column mobile cards, and route-backed character detail. Character detail shows package stats and registered active/support summaries; no level, power, equipment, shop, recruitment, or shard-use placeholder is exposed.
