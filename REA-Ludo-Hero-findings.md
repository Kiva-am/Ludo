# Ludo Hero — REA inspection

## Update: actual shipped game acquired (2026-10-19)

The inner index page and its referenced `game.js` were successfully downloaded into `.reference/ludo-hero/`. The JavaScript is 956,009 bytes. These files are inspection references, not part of the local game's implementation.

REA analyzed `game.js` as inert text, without executing it. Parent Evidence: `ev_662204bcc4b0b213a4f8262c7252e59aaab7e67a619809416af0f3a52cabbddb`; summary receipt: `ev_f57a1ead012c010251b7522062ab85ae304c857e23269e669cf64fdc51dcdd39`. Static parsing reported no source parse failures, but semantic coverage is partial and reached the 20,000-node per-file ceiling. This is not a complete reconstruction.

Focused read-only examination of the downloaded source additionally observed:

- `MyGame` declares the name `MJS-Ludo-Hero` and version `1.7`.
- The game renders to an HTML canvas and uses `ig.Entity` / `ig.Game` classes.
- `EntityDice` includes roll, bot-roll, readiness, value and stopping functions.
- `EntityHorse` includes movement, returning home, opponent checks, shared-square sizing and bot safety/kicking functions.
- `EntityPlayer` includes move eligibility, countdown, automatic play and bot decisions.
- `EntityGameController` includes turns, ranking, game completion, movement and state synchronization.
- The client contains the hostname `common.marketjs-multiplayer.com`. The current availability and behavior of that service were not tested.

These are static source observations. Individual dice probabilities, timing, safe-square/capture conditions and multiplayer server validation still require focused tracing or runtime corroboration. The earlier loader observations below describe the previous capture, not the limits of this new static acquisition.

Target: https://html5.gamedistribution.com/951d399995cc4ea5a528c9b7e873066b/

REA performed controlled browser navigation in a temporary Chrome profile, clicked Play Now, opened privacy options, rejected optional cookies, and observed loading. It terminated its owned browser afterward.

## Observed

- The supplied URL returned HTTP 200 and identified the game as Ludo Hero by MarketJS, published through GameDistribution.
- The outer page is a loader containing an iframe with id `game`.
- Its `_loadGame` function constructs the inner path `https://html5.gamedistribution.com/rvvASMiM/951d399995cc4ea5a528c9b7e873066b/index.html` and appends SDK-generated query parameters before assigning the iframe source. This path was observed in loader code; a successful inner-game response was not captured.
- After the normal Play action and rejecting optional cookies, the captured page still reported Loading. No gameplay was observed.
- The capture recorded advertising-script errors involving removed `browsingTopics` support and sandboxed-frame service-worker access. These observations do not establish the cause of the loading stall.

## Limits

Game rules, animation implementation, server logic and the inner game's source remain unverified. Loader metadata is not evidence that advertised multiplayer features worked in this run. Some network activity was unfinished when capture ended. No local Ludo source files were modified.

## Evidence

- Initial loader capture: `ev_7959d000a582e2d23c299f55e52c22482c0036ee25b9564a270b66a38521331d`
- Play action capture: `ev_df417aa057c50f0c7b573f7c9b52df48eb1f5c3d8ededf78c9405da5228c8d2c`
- Play and optional-cookie rejection capture: `ev_87272a916e6de928f3580ad2f78a0a8cebcc3b3c1b5f05b29fb0b0beca255a82`
