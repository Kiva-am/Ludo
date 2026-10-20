# Ludo — private rooms

The main project is now the Ludo Hero client in `original-ludo/`, connected to our own Node.js multiplayer server. It keeps the original board, cone animations, custom player panels, Your turn prompt and branded loading screen. The earlier custom interface is retired; it is not used by `npm start`.

## Start the game

Open PowerShell:

```powershell
cd D:\Ludo
npm install
npm start
```

Open **http://localhost:3002/**. Keep PowerShell open. Press Ctrl+C to stop.

Node.js 22.13 or newer is required. `npm start` reads `.env`. The game uses port 3002; set `HERO_PORT` if you need another port. The old `PORT=3000` setting does not affect this server.

The self-hosted client does not load the publisher ad SDK, so the ad-blocker prompt will not cover the game. On phones, the client uses its portrait layout and asks you to rotate the phone upright if it is held sideways.

To preview the mobile layout on a computer, open **http://localhost:3002/?device=mobile** in Chrome, press **Ctrl+Shift+M** to enable the device toolbar, and choose a portrait phone size. A phone on the same Wi-Fi can connect to your computer when the server is started with `HERO_HOST=0.0.0.0` in `.env`. Find the computer's IPv4 address with `ipconfig`, then open `http://YOUR_COMPUTER_IP:3002/` on the phone. Keep both devices on the same network. If Windows Firewall asks, allow Node.js on your private network.

## Test with two browsers

1. Open http://localhost:3002/ in Chrome.
2. Select **Play → Online Mode → 2 players**.
3. In the private room dialog, select **2 players**, then **Create room**.
4. Copy the six-character code shown in the room heading.
5. Open the same address in Edge or a separate browser tab. Select **Play → Online Mode → 2 players**.
6. Enter the room code and click **Join room**.
7. Back in the host browser, click **Start game**.
8. Click the dice when **Your turn** appears. Both browsers receive the same dice result and piece movements. Each browser rotates the board to show its own player at bottom left.

For four people, create a 4-player room and join from four independent tabs or browsers. The host starts once all four seats are connected. Each tab has its own player session. Refreshing the same tab preserves its session: enter the same code again to rejoin an active game. Closing the tab or clearing its session storage can lose the seat.

**Vs Bot** still works for solo practice.

## MongoDB Atlas

Keep your connection string private in the root `.env` file, never in `original-ludo/`:

```dotenv
MONGODB_URI=mongodb+srv://DATABASE_USER:ENCODED_PASSWORD@YOUR_CLUSTER.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=ludo
HERO_PORT=3002
# Optional: allow a phone on your Wi-Fi to connect to this computer.
# HERO_HOST=0.0.0.0
```

Atlas needs a database user with read/write access and your public IP allowed under Network Access. The server saves snapshots in the separate `heroRooms` collection with a 24-hour expiry. It does not overwrite the earlier application's `rooms` collection.

If a MongoDB URI is configured but the connection fails, startup stops with a message. Fix Atlas access and retry. If no URI is configured, the server explicitly runs in local memory mode for testing.

Live room routing is held by one Node server process. Restarting that process resets live rooms; saved snapshots are currently for storage and inspection, not automatic game recovery. Rejoin after a browser refresh is supported while that server remains running.

## Checks

```powershell
npm test
npm run check:multiplayer
```

Run the multiplayer check while the server is running. It uses independent network sessions to verify room codes, full-room rejection, host-only start, turn ownership, shared dice and synchronized moves/turn changes.

http://localhost:3002/health reports whether MongoDB or memory mode is active.

## Scope

This is a local multiplayer integration for testing. Rooms support 2 or 4 players. The first player to finish all four cones wins. Server dice and move checks use the downloaded client's 0–57 step model, safe squares, and single-piece captures. The original client renders moves optimistically; unusual disconnects during an animation may require refreshing and rejoining. No automatic disconnected-player replacement is implemented.

To play from another computer over the internet, deploy this Node server to a host that supports WebSockets and HTTPS, set Atlas credentials there and allow that host's outbound IP. A localhost link works only on the computer running the server. For local phone testing, set `HERO_HOST=0.0.0.0` in `.env`; otherwise the development server binds to loopback.

## Main files

- `original-server.js`: HTTP server and MongoDB connection.
- `hero-multiplayer.js`: private rooms, player sessions and network protocol.
- `hero-rules.js`: server-side dice, movement and turn checks for this client.
- `original-ludo/room-client.js` and `rooms.css`: multiplayer adapter and room dialog.
- `original-ludo/player-panels.js`: cone player panels and Your turn prompt.
- `original-ludo/loading-screen.js` and `white.png`: branded loading screen.
- `scripts/customize-original-ludo.mjs`: reapplies hooks to the preserved upstream bundle.

The original obfuscated bundle is preserved in `.reference/ludo-hero/game.js`. The download manifest records upstream asset hashes; customized files intentionally differ. The publisher's ad SDK and multiplayer service are not used in this self-hosted build.
