BULLET HEAVEN
=============

A bullet-heaven roguelike survival game built with HTML5 Canvas, vanilla JavaScript, and Node.js.

REQUIREMENTS
------------

- Node.js 16+ (for multiplayer server)
- Modern web browser (Chrome, Firefox, Edge, Safari)

INSTALLATION
------------

1. Clone or download the project
2. Install server dependencies:
   cd server
   npm install

3. Start the multiplayer server (optional, for online play):
   npm start

4. Open client/index.html in a browser, or serve the client folder:
   cd client
   npx serve .

CONTROLS
--------

- WASD or Arrow Keys: Move
- Automatic attacks
- Touch controls on mobile devices

GAMEPLAY
--------

- Survive waves of enemies
- Collect XP gems to level up
- Choose from 3 random upgrades on level up
- Weapons can evolve when combined with specific upgrades
- Boss spawns every 2 minutes
- Difficulty increases over time

MULTIPLAYER
-----------

1. Start the server: cd server && npm start
2. Open the game in multiple browsers
3. One player hosts a game, others join with the server code
4. Host starts the game when all players are ready

PROJECT STRUCTURE
-----------------

bullet-heaven/
├── client/           # Game client
│   ├── index.html
│   ├── style.css
│   ├── main.js
│   └── game/         # Game modules
├── server/           # Multiplayer server
│   ├── server.js
│   ├── package.json
│   ├── database/     # Persistent storage
│   └── rooms/        # Room management
├── database/         # Server data (auto-created)
├── CREDITS.txt
└── README.txt

BUILD (EXE)
-----------

To package as Windows EXE with Electron:

1. Install Electron:
   npm install electron --save-dev

2. Create electron-main.js (see electron-main.js in project root)

3. Build:
   npx electron-builder --win

Output: dist/BulletHeaven.exe

LICENSE
-------

Game code: MIT License
Assets: CC0 (see CREDITS.txt)
