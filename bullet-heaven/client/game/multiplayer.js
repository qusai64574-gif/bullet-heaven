// multiplayer.js - Client-side multiplayer

const Multiplayer = {
  ws: null,
  connected: false,
  serverUrl: 'ws://localhost:3000',
  playerId: null,
  currentRoom: null,
  isHost: false,
  players: [],
  pingInterval: null,
  lastPingTime: 0,
  ping: 0,

  init() {
    // Load saved server URL
    const saved = localStorage.getItem('bulletHeaven_serverUrl');
    if (saved) {
      this.serverUrl = saved;
      document.getElementById('settings-server-url').value = saved;
    }
  },

  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.onopen = () => {
          this.connected = true;
          UI.showConnectionStatus('connected', 'Connected');
          this.startPing();
          resolve();
        };

        this.ws.onclose = () => {
          this.connected = false;
          UI.showConnectionStatus('disconnected', 'Disconnected');
          this.stopPing();
          if (Engine.state === 'playing') {
            UI.showError('Connection lost!');
          }
        };

        this.ws.onerror = (e) => {
          UI.showConnectionStatus('disconnected', 'Connection Error');
          reject(new Error('Connection failed'));
        };

        this.ws.onmessage = (e) => {
          this.handleMessage(JSON.parse(e.data));
        };
      } catch (err) {
        reject(err);
      }
    });
  },

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.currentRoom = null;
    this.stopPing();
  },

  startPing() {
    this.pingInterval = setInterval(() => {
      this.lastPingTime = Date.now();
      this.send({ type: 'ping' });
    }, 2000);
  },

  stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  },

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  },

  handleMessage(msg) {
    switch (msg.type) {
      case 'pong':
        this.ping = Date.now() - this.lastPingTime;
        break;

      case 'playerId':
        this.playerId = msg.playerId;
        break;

      case 'roomJoined':
        this.currentRoom = msg.room;
        this.players = msg.players;
        this.isHost = msg.isHost;
        UI.updateLobby(this.players, this.isHost, msg.maxPlayers);
        break;

      case 'playerJoined':
        this.players.push(msg.player);
        UI.updateLobby(this.players, this.isHost, this.currentRoom.maxPlayers);
        break;

      case 'playerLeft':
        this.players = this.players.filter(p => p.id !== msg.playerId);
        UI.updateLobby(this.players, this.isHost, this.currentRoom.maxPlayers);
        break;

      case 'playerReady':
        const player = this.players.find(p => p.id === msg.playerId);
        if (player) player.ready = msg.ready;
        UI.updateLobby(this.players, this.isHost, this.currentRoom.maxPlayers);
        break;

      case 'gameStarting':
        this.startMultiplayerGame(msg.seed);
        break;

      case 'serverList':
        UI.updateServerList(msg.servers);
        break;

      case 'error':
        UI.showError(msg.message);
        break;
    }
  },

  // Host a game
  hostGame(name, maxPlayers, seed, isPublic) {
    this.send({
      type: 'host',
      name,
      maxPlayers,
      seed: seed || Math.floor(Math.random() * 1000000),
      isPublic,
      playerName: this.getPlayerName(),
    });
  },

  // Join with code
  joinGame(code) {
    this.send({
      type: 'join',
      code: code.toUpperCase(),
      playerName: this.getPlayerName(),
    });
  },

  // Get server list
  getServerList() {
    this.send({ type: 'getServers' });
  },

  // Ready up
  setReady(ready) {
    this.send({ type: 'ready', ready });
  },

  // Start game (host only)
  startGame() {
    this.send({ type: 'startGame' });
  },

  // Leave room
  leaveRoom() {
    this.send({ type: 'leaveRoom' });
    this.currentRoom = null;
    this.players = [];
  },

  // Start multiplayer game
  startMultiplayerGame(seed) {
    UI.showScreen(null);
    UI.showHUD();
    Engine.startGame(true, this.isHost, seed);
  },

  // Send player state
  sendPlayerState() {
    if (!this.connected || !Engine.player) return;

    this.send({
      type: 'playerState',
      x: Math.floor(Engine.player.x),
      y: Math.floor(Engine.player.y),
      hp: Math.floor(Engine.player.hp),
      level: Engine.player.level,
    });
  },

  // Get player name
  getPlayerName() {
    return localStorage.getItem('bulletHeaven_username') || 'Player';
  },

  // Save server URL
  saveServerUrl(url) {
    this.serverUrl = url;
    localStorage.setItem('bulletHeaven_serverUrl', url);
  },
};
