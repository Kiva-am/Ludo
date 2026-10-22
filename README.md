# Ludo — private rooms

The main project is the Ludo Hero client in `original-ludo/`, connected to our own Node.js multiplayer server. It uses King's menu-card styling, player selection, Game Start banner and sound clips, with smooth 0.24-second token steps, a scale pulse and colored movement trails. Hero keeps its board, cones, player panels, Your turn prompt and branded loading screen. The earlier custom interface is retired; it is not used by `npm start`.

## Current state - 22 October 2026

- Private rooms, server-controlled dice and moves, turn deadlines, reconnects, forfeits, results, and rematches support 2 or 4 players.
- King presentation is adapted to Hero: opening menu cards, player selection, room styling, Game Start banner, local sound clips, music, and smooth token motion. Leaving the yard takes 0.4 seconds; board steps take 0.24 seconds.
- Audio recovers from interrupted contexts and stale browser focus muting. Effects and music have independent controls, and saved volume settings survive reloads.
- The portrait layout fits phones, tablets, and desktops. Computer mode supports 2- and 4-player solo practice.
- **Latest verification:** 46 unit/network tests passed; the 2- and 4-player multiplayer browser checks and the mobile presentation/solo checks passed. Browser checks measured actual audio waveform output during each owning player's turn after simulating a stale focus mute. These checks use local memory servers; they do not establish Atlas connectivity or physical-phone audio behavior.

**Current startup blocker:** the latest `npm start` attempts stopped with `MongoDB connection failed. Check Atlas credentials and IP access.` The same failure occurred outside the sandbox. The precise connection cause has not been diagnosed; those attempts did not leave a running Hero server.

## Start the game

Open PowerShell:

```powershell
cd D:\Ludo
npm.cmd install
npm.cmd start
```

After the server reports that it is listening, open **http://localhost:3002/**. Keep PowerShell open. Press Ctrl+C to stop. Use Ctrl+F5 in an existing tab after client changes. `npm.cmd run dev` runs the same server with Node's file watcher.

Node.js 22.13 or newer is required. `npm start` reads `.env`. The game uses port 3002; set `HERO_PORT` if you need another port. The old `PORT=3000` setting does not affect this server.

The self-hosted client does not load the publisher ad SDK, so the ad-blocker prompt will not cover the game. All devices use the mobile portrait layout, centered and fitted without stretching in either orientation. This includes computers and links with `?device=desktop`. The canvas respects phone safe areas, and room controls support touch and scrolling. The supplied Blue Ludo Board Pattern Wallpaper is used on the menu, game and loading screen.

To preview the mobile layout on a computer, open **http://localhost:3002/?device=mobile** in Chrome, press **Ctrl+Shift+M** to enable the device toolbar, and choose a portrait phone size. A phone on the same Wi-Fi can connect to your computer when the server is started with `HERO_HOST=0.0.0.0` in `.env`. Find the computer's IPv4 address with `ipconfig`, then open `http://YOUR_COMPUTER_IP:3002/` on the phone. Keep both devices on the same network. If Windows Firewall asks, allow Node.js on your private network.

## Test with two browsers

1. Open http://localhost:3002/ in Chrome.
2. Select **Online Multiplayer → 2 players**.
3. In the private room dialog, select **2 players**, then **Create room**.
4. Copy the six-character code shown in the room heading.
5. Open the same address in Edge or a separate browser tab. Select **Online Multiplayer → 2 players**.
6. Enter the room code and click **Join room**.
7. Back in the host browser, click **Start game**.
8. Click the dice when **Your turn** appears. Both browsers receive the same dice result and piece movements. Each browser rotates the board to show its own player at bottom left.

For four people, create a 4-player room and join from four independent tabs or browsers. The host starts once all four seats are connected. Each tab has its own player session. Refreshing the same tab automatically rejoins its last room. Temporary socket interruptions reconnect automatically with increasing retry delays. Closing the tab or clearing its session storage can lose the seat.

Each roll or move decision has a 15-second server deadline (`HERO_TURN_SECONDS` overrides it). The active panel shows the remaining seconds. If the browser does not act, the server rolls, chooses a legal piece, or advances the turn. Missing an animation acknowledgement cannot stall play. A disconnected seat is held for 30 seconds; after that it forfeits. Explicitly leaving forfeits immediately. Four-player matches skip forfeited seats, and the last remaining player wins if everyone else leaves. Fully disconnected rooms are removed after the same grace period.

Results identify the winner and each other player's home count or departure, rather than claiming every player completed a ranking. The connected host can choose **Play again** once every seat is connected. A rematch keeps the room code and identities and resets all pieces. Finished games can also be restored after a reload.

**Computer** still works for solo practice with 2 or 4 players.

The opening menu now offers **Online Multiplayer** and **Computer**, followed by 2 or 4 players. The two note buttons toggle effects and music independently. King's sound clips are served locally from `original-ludo/king/`; returning to a tab or changing turns repairs temporary browser muting while preserving your sound preference. Pawn motion and the Game Start banner are adapted in `king-presentation.js`; server rules remain Hero's.

The imported clips and source hashes are listed in `original-ludo/king/manifest.json`; atlas coordinates are in `frames.json`. Normal startup and Hero checks use these already-imported assets and do not need the separate King project. To re-import assets, restore the captured project at `ludo-king/ludo-king/`, run `node scripts/import-king-presentation.mjs`, then `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/extract-king-frames.ps1`. The import requires the capture's `public/play/assets/`; extraction uses Windows' built-in System.Drawing library.

## MongoDB Atlas

Keep your connection string private in the root `.env` file, never in `original-ludo/`:

```dotenv
MONGODB_URI=mongodb+srv://DATABASE_USER:ENCODED_PASSWORD@YOUR_CLUSTER.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=ludo
HERO_PORT=3002
HERO_TURN_SECONDS=15
# Optional: allow a phone on your Wi-Fi to connect to this computer.
# HERO_HOST=0.0.0.0
```

Atlas needs a database user with read/write access and your public IP allowed under Network Access. The server saves snapshots in the separate `heroRooms` collection with a 24-hour expiry. It does not overwrite the earlier application's `rooms` collection.

If a MongoDB URI is configured but the connection fails, startup stops with a message; it does not silently fall back to memory. For local memory testing, leave `MONGODB_URI` unset or empty in `.env` and ensure it is not exported in the shell. Startup then explicitly reports local test mode. Keep credentials in the root `.env`, outside the publicly served client folder.

Live room routing is held by one Node server process. Restarting that process resets live rooms; saved snapshots are currently for storage and inspection, not automatic game recovery. Rejoin after a browser refresh is supported while that server remains running.

## Checks

```powershell
npm.cmd test
npm.cmd run check:multiplayer
npm.cmd run check:browser
npm.cmd run check:browser:four
npm.cmd run check:presentation
```

Run the multiplayer check while the server is running. It uses independent network sessions to verify room codes, full-room rejection, host-only start, turn ownership, shared dice and synchronized moves/turn changes.

The browser checks own isolated in-memory servers and Chrome sessions; they do not load `.env` or contact Atlas. `check:browser` and `check:browser:four` exercise the King-style opening menu, private rooms, real mouse dice input, synchronized rendered pieces, actual King dice audio output, reload, interrupted sockets, results, and rematches. The results stage uses a near-home server fixture. `check:presentation` checks mobile menu fit, independent effects/music controls, saved mute settings after reload, King assets/banner, and 2-/4-player solo dice and movement. Chrome must be installed, or set `BROWSER_PATH` to a Chromium executable. Screenshots and temporary investigation output go in `test-results/`.

`npm test` requires no running application server or Atlas connection. It covers Hero rules, complete 2- and 4-player network games, room lifecycle, audio recovery, and client restoration, plus the retained legacy rules. The separate King project's own tests are outside this command.

http://localhost:3002/health reports whether MongoDB or memory mode is active.

## Scope

Rooms support 2 or 4 players. The first player to finish all four cones wins. Server dice and move checks use the downloaded client's 0–57 step model, safe squares, and single-piece captures. Actions carry a server revision, so old or duplicate requests cannot replay a move, and replaced connections lose authority. The original client renders normal moves optimistically; server snapshots restore positions and turn ownership after interruptions. Solo bot mode retains the original client behavior. Hero keeps private rooms and its own rules; King's public matchmaking, blocked-double rule, and continuing rankings are not imported.

To play from another computer over the internet, deploy this Node server to a host that supports WebSockets and HTTPS, set Atlas credentials there and allow that host's outbound IP. A localhost link works only on the computer running the server. For local phone testing, set `HERO_HOST=0.0.0.0` in `.env`; otherwise the development server binds to loopback.

## Main files

- `original-server.js`: HTTP server and MongoDB connection.
- `hero-multiplayer.js`: private rooms, player sessions and network protocol.
- `hero-rules.js`: server-side dice, movement and turn checks for this client.
- `original-ludo/room-client.js` and `rooms.css`: multiplayer adapter and room dialog.
- `original-ludo/player-panels.js`: cone player panels and Your turn prompt.
- `original-ludo/king-presentation.js` and `king-presentation.css`: opening UI, banner, sound mapping, and token motion.
- `original-ludo/king/`: imported clips, font, graphics, atlas sources, and provenance manifests; required by the active game.
- `original-ludo/mobile-audio.js`: audio unlocking, interruption recovery, queued effects, and focus-mute reconciliation.
- `original-ludo/mobile-layout.js` and `mobile-layout.css`: portrait fitting, safe areas, and wallpaper.
- `original-ludo/loading-screen.js` and `white.png`: branded loading screen.
- `scripts/customize-original-ludo.mjs`: reapplies hooks to the preserved upstream bundle.

The original obfuscated bundle is preserved in `.reference/ludo-hero/game.js`. The download manifest records upstream asset hashes; customized files intentionally differ. The publisher's ad SDK and multiplayer service are not used in this self-hosted build.

## Folder cleanup

No cleanup has been performed. Archive source captures before removing them from this working directory, especially if they are not committed to version control.

| Folder | Recommendation | Effect of removal |
| --- | --- | --- |
| Root `ludo-king/` | Archive outside this project, then remove the working copy if you only develop Hero. | Hero startup and checks continue to use `original-ludo/king/`. Re-importing King assets and running the separate King project require restoring the archive at its original path. |
| Root `ludo-room/` | Remove if the retired alternate project is no longer wanted; archive it first if its source/design is useful. | Not used by Hero startup or Hero checks. |
| Root `public/` | Remove if the retired custom frontend is no longer wanted. | Hero serves `original-ludo/`, not this folder. Retired `server.js` expects this old frontend. |
| `test-results/` | Safe to clear when screenshots and investigation output are no longer needed. | Browser checks recreate their output. |
| `.video-tools/` | Remove if you no longer need the local video-processing tools. | Not used by Hero startup or current checks. |
| `.reference/` | Keep an external archive; optional in a runtime-only checkout. | Hero still runs, but original-client download/customization requires restoring `.reference/ludo-hero/`, including its upstream `game.js` and `index.html`. |
| `node_modules/` | Keep during development; remove only to reclaim space temporarily. | Run `npm.cmd ci` to restore dependencies before starting or testing. |
| `original-ludo/`, including `king/` and `media/` | Keep. | Contains the active UI, sounds, board, and other runtime assets. |
| `scripts/` | Keep for development and verification. | Contains the checks and rebuild tools listed above. |
| `.git/` | Keep. | Contains version history and repository metadata. |

The retired root files `server.js`, `game.js`, and `bot.js` are separate from Hero's active files. **Do not remove only `game.js` or `bot.js`:** `npm test` still discovers `game.test.js` and `bot.test.js`, which import them. Retiring that legacy code requires removing or relocating its tests together and reviewing `scripts/check-multiplayer.mjs`. Keep `.env`, `.env.example`, `package.json`, `package-lock.json`, and the active Hero server/rules/test files.

The original-client download and customization scripts are maintenance/rebuild operations, not startup steps. Removing their source captures does not stop the existing Hero build, but the captures must be restored before using those operations.
