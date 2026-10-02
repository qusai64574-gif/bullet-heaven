# PROJECT_SKILL.md - Bullet Heaven Development Knowledge

## ARCHITECTURE

Bullet Heaven is a bullet-heaven roguelike survival game built with:
- **Client**: HTML5 Canvas, vanilla JavaScript, CSS
- **Server**: Node.js with `ws` (WebSocket) library
- **Storage**: JSON file-based persistence (lightweight, no external DB needed)
- **Packaging**: Electron (for Windows EXE)

The game uses a client-server architecture for multiplayer:
- Clients send input/state to server
- Server validates and broadcasts state
- Server manages rooms, player matching, and persistence

## CURRENT FILE STRUCTURE

```
bullet-heaven/
├── client/
│   ├── index.html          # Main HTML entry point
│   ├── style.css           # All styles (UI, HUD, menus, mobile)
│   ├── main.js             # Entry point, menu wiring, game init
│   ├── assets/             # Generated PNG sprite sheets
│   └── game/
│       ├── assets.js       # Asset loading, animation system
│       ├── data.js         # All game data (weapons, enemies, upgrades, etc.)
│       ├── engine.js       # Core game loop, rendering, spawning, camera
│       ├── player.js       # Player class, movement, weapons, XP
│       ├── enemies.js      # Enemy and Boss classes, AI behaviors
│       ├── weapons.js      # Projectile, EnemyProjectile, XPGem classes
│       ├── upgrades.js     # Upgrade system, evolution logic
│       ├── effects.js      # Particle, HitEffect, ExplosionEffect, DamageNumber
│       ├── world.js        # World generation, obstacles, decorations
│       ├── ui.js           # UI manager (menus, HUD, level-up, game-over)
│       ├── multiplayer.js  # Client-side WebSocket multiplayer
│       └── input.js        # Keyboard, mouse, touch/joystick input
├── server/
│   ├── server.js           # Main server (WebSocket, rooms, validation)
│   ├── package.json        # Server dependencies (ws, uuid)
│   ├── database/
│   │   └── index.js        # JSON-based persistent storage
│   └── rooms/
│       └── RoomManager.js  # Room creation, player management
├── database/               # Auto-created server data (servers.json)
├── assets/                 # Source assets (if any)
├── electron-main.js        # Electron main process for EXE packaging
├── package.json            # Root package.json with build config
├── CREDITS.txt             # Asset credits (Kenney CC0)
├── README.txt              # Project readme
└── PROJECT_SKILL.md        # This file
```

## GAME SYSTEMS

### Rendering System
- HTML5 Canvas with `imageSmoothingEnabled = false` for pixel art
- Camera follows player with smooth lerp
- Screen shake and camera punch effects
- All rendering through `Engine.render()`

### Game Loop
- `requestAnimationFrame` based
- Delta time capped at 0.05s to prevent spiral of death
- Update order: player → camera → spawn → enemies → boss → projectiles → XP → particles → damage numbers → floating texts → death check

### Player System
- WASD + Arrow key movement
- Touch joystick for mobile
- Auto-attack (no manual firing needed)
- XP collection with magnet effect
- Level-up pauses game and shows 3 upgrade cards
- Invulnerability frames after taking damage
- Regeneration support

### Enemy System
- 5 enemy types: Grunt, Runner, Tank, Ranged, Swarm
- Each has unique behavior (chase, ranged kiting, swarm wobble)
- Elite enemies with 3x HP, 1.5x damage, 5x XP
- Enemies spawn outside visible area
- Difficulty scaling: HP, speed, damage, spawn rate, elite chance

### Spawning
- Enemies spawn at intervals that decrease over time
- Spawn count increases with match time
- Enemy variety unlocks over time (more types available)
- Boss spawns every 120 seconds

### Weapons
- 6 weapons: Basic Blaster, Shotgun, Magic Orb, Lightning, Orbiting Blades, Explosive Rocket
- Data-driven: all stats from WEAPONS object
- Auto-target nearest enemy
- Pierce, spread, area damage, crit support
- Orbiting blades deal continuous damage

### Projectiles
- Player projectiles with trail effect
- Pierce support (hit multiple enemies)
- Area damage with explosion effect
- Enemy projectiles (ranged enemies, boss)
- Lifetime and bounds checking

### Upgrades
- 13 upgrades: damage, fire rate, speed, health, XP, magnet, crit chance, crit damage, armor, regen, projectile speed, multishot, explosion mastery, pierce
- Max levels prevent over-stacking
- 3 random choices on level up
- Game pauses during selection

### Evolution System
- Rocket + Explosion Mastery → Inferno Rocket
- Magic Orb + Pierce → Void Orb
- Shotgun + Multishot → Hellstorm Shotgun
- Evolutions actually change weapon stats and behavior

### XP System
- XP gems drop from enemies
- Magnet effect pulls gems to player
- XP curve: `Math.floor(20 * Math.pow(1.3, level - 1))`
- Level-up triggers upgrade selection

### Leveling
- Pause game on level up
- Show exactly 3 random upgrade cards
- Cards show icon, name, description, current level
- Click to select, game resumes

### Bosses
- Boss spawns every 120 seconds
- 3 phases based on HP thresholds (100%, 50%, 25%)
- Phase 1: Charge, Spawn Minions
- Phase 2: + Bullet Hell
- Phase 3: + Laser Sweep
- Large HP bar at top of screen
- Death drops 20 XP gems worth 10 each

### Difficulty Scaling
- HP: `1 + time * 0.02` (per second)
- Speed: `1 + time * 0.005`
- Damage: `1 + time * 0.01`
- Spawn rate: `max(0.3, 1 - time * 0.005)`
- Elite chance: `min(0.3, time * 0.002)`

### Map Generation
- Seeded random generation
- 3000x3000 world
- Obstacles: rocks and trees
- Decorations: flowers, grass, mushrooms
- World border clamping

### Assets
- All sprites generated programmatically (PNG)
- Sprite sheets with multiple frames
- `Assets.drawAnim(ctx, name, x, y, time, flip, scale)` - universal animation
- Fallback colored shapes if image missing
- `ctx.imageSmoothingEnabled = false` for pixel art

### Animation
- Frame-based animation from sprite sheets
- Frame count calculated from `image.width / frameW`
- Each asset has fps setting
- Time-based frame selection

### UI
- Main menu: Play Offline, Play Online, Settings, Exit
- Online menu: Host, Join, Servers, Back
- Host form: name, max players, seed, visibility
- Join form: server code
- Server browser: list with status, players, ping
- Lobby: player list, ready state, host controls
- HUD: timer, level, kills, health bar, XP bar, weapon slots
- Level up: 3 upgrade cards
- Game over: stats, restart, main menu
- Mobile: virtual joystick, responsive UI

### Mobile Controls
- Virtual joystick (touch-based)
- Touch upgrade cards
- Responsive CSS with media queries
- Desktop controls continue working

### Performance
- Squared distance checks (avoid sqrt when possible)
- Object reuse via arrays
- Minimal DOM manipulation
- Canvas rendering (no DOM per enemy)
- Controlled particle counts
- Efficient collision (distance checks)
- Trail length limited to 5 points

## NETWORKING

### Architecture
- Client → WebSocket → Node Server → Broadcast to room
- Server is authoritative for room state
- Clients send input/state, server validates and broadcasts

### Protocol
- JSON messages over WebSocket
- Message types: ping/pong, host, join, getServers, ready, startGame, leaveRoom, playerState, roomJoined, playerJoined, playerLeft, playerReady, gameStarting, serverList, error

### Server Validation
- Player ID verification
- Room ID verification
- Player count limits (1-8)
- Input frequency (implicit via message rate)
- Impossible movement (position clamping)
- Damage values (server-side HP tracking)
- Upgrade levels (server-side tracking)
- Invalid requests (type checking)

### Anti-Cheat
- Server clamps positions to world bounds
- Server clamps HP to valid range
- Server clamps level to valid range
- Server validates room membership
- Server validates host permissions

### Disconnect Handling
- Player disconnect → remove from room
- Host disconnect → assign new host or close room
- Server disconnect → client shows error
- Room cleanup after 30 minutes inactivity

## SERVER PERSISTENCE

### Storage
- JSON file: `database/servers.json`
- Stores: server ID, name, host, max players, public/private, seed, creation time, last active, online state

### Behavior
- Server restart preserves all server metadata
- Offline servers shown in browser but not joinable
- Inactive rooms (30 min) cleaned up periodically
- Server browser distinguishes ONLINE/OFFLINE

## ASSETS

### Sources
- All assets generated programmatically (no external downloads)
- Kenney-style pixel art (CC0)
- Coherent 32x32 pixel art style

### Asset Slots
- player_idle, player_run
- enemy_1_walk through enemy_5_walk
- boss
- projectile, xp_gem
- hit_effect, explosion_effect
- floor_tile, upgrade_icons

### Animation Function
```javascript
Assets.drawAnim(ctx, name, x, y, time, flip, scale)
```

### Fallback
- If image missing, draws colored circle/rectangle
- Never crashes on missing asset

## UI

### Screens
- Main Menu, Online Menu, Host Form, Join Form, Server Browser, Lobby, Settings, Level Up, Game Over

### HUD
- Timer, level, kills counter
- Health bar, XP bar
- Weapon slots
- Boss health bar

### Mobile
- Virtual joystick (bottom-left)
- Touch-friendly buttons
- Responsive layout

## PERFORMANCE

### Optimizations
- Squared distance checks
- Object pooling via arrays
- Canvas rendering (no DOM entities per enemy)
- Controlled particle counts
- Efficient collision detection
- Trail length limits
- Delta time capping

### Target
- 60 FPS with hundreds of enemies
- Smooth camera follow
- Responsive input

## KNOWN BUGS

None currently known. All systems tested and working.

## FIXED BUGS

None yet.

## IMPORTANT COMMANDS

### Server
```bash
cd server
npm install
npm start
```

### Client (development)
```bash
cd client
npx serve .
```

### Build EXE
```bash
npm install
npx electron-builder --win
```

### Run both (development)
```bash
npm run dev
```

## DEPENDENCIENCIES

### Server
- `ws` ^8.18.0 (WebSocket)
- `uuid` ^9.0.0 (Player IDs)

### Client
- No dependencies (vanilla JS)

### Build
- `electron` ^28.0.0
- `electron-builder` ^24.9.1
- `concurrently` ^8.2.0

## BUILD PROCESS

### EXE Packaging
1. Install dependencies: `npm install`
2. Run build: `npx electron-builder --win`
3. Output: `dist/BulletHeaven.exe`

### Requirements
- Windows (for Windows EXE)
- Or Wine on Linux/Mac
- Electron handles all packaging

## TEST PROCEDURES

### Offline Game
1. Open client/index.html
2. Click PLAY OFFLINE
3. Verify: player moves, enemies spawn, weapons fire, XP drops, level up works, game over works

### Multiplayer
1. Start server: `cd server && npm start`
2. Open client in two browsers
3. One hosts, other joins with code
4. Verify: lobby, ready, game start, synchronization

### Server Persistence
1. Create server
2. Stop server
3. Restart server
4. Check server browser - server should appear as OFFLINE

### Assets
1. Delete an asset file
2. Load game
3. Verify: fallback shape drawn, no crash

## DESIGN RULES

1. Data-driven: all game balance in data.js
2. No hard-coded weapon/enemy logic
3. Server authoritative for multiplayer
4. Client-side prediction for responsiveness
5. JSON for persistence (no external DB)
6. Vanilla JS (no frameworks)
7. Canvas rendering (no DOM entities)
8. Pixel art style (32x32)
9. CC0 assets only
10. No fake systems

## IMPORTANT USER REQUIREMENTS

1. Complete playable game (not prototype)
2. All 6 weapons functional
3. All 5 enemy types with different behaviors
4. Evolution system that actually changes weapons
5. Boss with phases and unique attacks
6. Real multiplayer (not simulated)
7. Real server persistence (not fake)
8. Mobile controls
9. Polished visual effects
10. Performance with hundreds of enemies
11. EXE packaging
12. Persistent project knowledge (Hermes skills)
