# Bullet Heaven

A bullet-heaven roguelike survival game with multiplayer support. Built with HTML5 Canvas, vanilla JavaScript, and Node.js WebSocket server.

## Play with Friends

### Option 1: Deploy Server (Recommended)

1. Go to [render.com](https://render.com) and sign up/login
2. Click "New" → "Web Service"
3. Connect this GitHub repo
4. Use these settings:
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && npm start`
   - **Plan**: Free
5. Once deployed, you'll get a URL like `https://bullet-heaven-server.onrender.com`
6. Share this URL with friends
7. In the game, go to Settings → Server URL and enter: `wss://bullet-heaven-server.onrender.com`
8. One person hosts a game, others join with the 6-character code

### Option 2: Run Server Locally

```bash
cd server
npm install
npm start
```

Server runs on `ws://localhost:3000`. Friends on the same network can connect using your local IP.

### Option 3: Use playit.gg (Tunnel)

1. Download [playit.gg](https://playit.gg)
2. Run the server locally: `cd server && npm start`
3. Run playit.gg and create a tunnel for port 3000
4. Share the playit.gg URL with friends

## Play Offline

```bash
cd client
npx serve .
```

Open `http://localhost:3000` in your browser and click "PLAY OFFLINE".

## Build EXE

```bash
npm install
npx electron-builder --win
```

## Game Features

- 6 weapons (Basic Blaster, Shotgun, Magic Orb, Lightning, Orbiting Blades, Explosive Rocket)
- 5 enemy types + multi-phase boss
- 13 upgrades + weapon evolutions
- Multiplayer with room codes (up to 8 players)
- Mobile touch controls
- Server browser

## Controls

- **WASD / Arrow Keys**: Move
- **Mouse**: Aim (auto-attack)
- **Touch**: Virtual joystick (mobile)
