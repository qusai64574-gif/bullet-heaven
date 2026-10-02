// main.js - Entry point and game initialization

let gameInitialized = false;

async function initGame() {
  if (gameInitialized) return;
  gameInitialized = true;

  // Initialize systems
  Engine.init();
  UI.init();
  Input.init();
  Multiplayer.init();
  UpgradeSystem.init();

  // Load settings
  loadSettings();

  // Setup menu buttons
  setupMenuButtons();

  // Show main menu immediately
  UI.showScreen('mainMenu');

  // Load assets in background (non-blocking)
  Assets.load().catch((e) => console.error('Failed to load assets:', e));
}

function loadSettings() {
  const username = localStorage.getItem('bulletHeaven_username');
  if (username) {
    document.getElementById('settings-username').value = username;
  }

  const serverUrl = localStorage.getItem('bulletHeaven_serverUrl');
  if (serverUrl) {
    document.getElementById('settings-server-url').value = serverUrl;
  }

  const volume = localStorage.getItem('bulletHeaven_volume');
  if (volume) {
    document.getElementById('settings-volume').value = volume;
  }
}

function saveSettings() {
  const username = document.getElementById('settings-username').value.trim();
  const serverUrl = document.getElementById('settings-server-url').value.trim();
  const volume = document.getElementById('settings-volume').value;

  if (username) {
    localStorage.setItem('bulletHeaven_username', username);
  }
  if (serverUrl) {
    localStorage.setItem('bulletHeaven_serverUrl', serverUrl);
    Multiplayer.saveServerUrl(serverUrl);
  }
  localStorage.setItem('bulletHeaven_volume', volume);

  UI.showScreen('mainMenu');
}

function setupMenuButtons() {
  // Main menu
  document.getElementById('btn-play-offline').addEventListener('click', () => {
    startOfflineGame();
  });

  document.getElementById('btn-play-online').addEventListener('click', async () => {
    try {
      UI.showConnectionStatus('connecting', 'Connecting...');
      await Multiplayer.connect();
      UI.showScreen('onlineMenu');
    } catch (e) {
      UI.showError('Failed to connect to server');
      UI.showConnectionStatus('disconnected', 'Connection Failed');
    }
  });

  document.getElementById('btn-settings').addEventListener('click', () => {
    UI.showScreen('settings');
  });

  document.getElementById('btn-exit').addEventListener('click', () => {
    if (confirm('Are you sure you want to exit?')) {
      window.close();
    }
  });

  // Online menu
  document.getElementById('btn-host').addEventListener('click', () => {
    UI.showScreen('hostForm');
  });

  document.getElementById('btn-join').addEventListener('click', () => {
    UI.showScreen('joinForm');
  });

  document.getElementById('btn-servers').addEventListener('click', () => {
    Multiplayer.getServerList();
    UI.showScreen('serverBrowser');
  });

  document.getElementById('btn-online-back').addEventListener('click', () => {
    UI.showScreen('mainMenu');
  });

  // Host form
  document.getElementById('btn-create-server').addEventListener('click', () => {
    const name = document.getElementById('host-name').value.trim() || 'My Server';
    const maxPlayers = parseInt(document.getElementById('host-max').value);
    const seed = document.getElementById('host-seed').value.trim();
    const isPublic = document.getElementById('host-visibility').value === 'public';

    Multiplayer.hostGame(name, maxPlayers, seed, isPublic);
    UI.showScreen('lobby');
  });

  document.getElementById('btn-host-back').addEventListener('click', () => {
    UI.showScreen('onlineMenu');
  });

  // Join form
  document.getElementById('btn-join-server').addEventListener('click', () => {
    const code = document.getElementById('join-code').value.trim();
    if (code.length === 0) {
      UI.showError('Please enter a server code');
      return;
    }
    Multiplayer.joinGame(code);
    UI.showScreen('lobby');
  });

  document.getElementById('btn-join-back').addEventListener('click', () => {
    UI.showScreen('onlineMenu');
  });

  // Server browser
  document.getElementById('btn-refresh-servers').addEventListener('click', () => {
    Multiplayer.getServerList();
  });

  document.getElementById('btn-servers-back').addEventListener('click', () => {
    UI.showScreen('onlineMenu');
  });

  // Lobby
  document.getElementById('btn-ready').addEventListener('click', () => {
    const btn = document.getElementById('btn-ready');
    const isReady = btn.textContent === 'READY';
    Multiplayer.setReady(!isReady);
    btn.textContent = isReady ? 'CANCEL' : 'READY';
  });

  document.getElementById('btn-start-game').addEventListener('click', () => {
    Multiplayer.startGame();
  });

  document.getElementById('btn-leave-lobby').addEventListener('click', () => {
    Multiplayer.leaveRoom();
    UI.showScreen('onlineMenu');
  });

  // Settings
  document.getElementById('btn-save-settings').addEventListener('click', () => {
    saveSettings();
  });

  document.getElementById('btn-settings-back').addEventListener('click', () => {
    UI.showScreen('mainMenu');
  });

  // Game over
  document.getElementById('btn-restart').addEventListener('click', () => {
    UI.showScreen(null);
    UI.showHUD();
    Engine.startGame(false, false);
  });

  document.getElementById('btn-return-menu').addEventListener('click', () => {
    UI.hideHUD();
    UI.showScreen('mainMenu');
  });
}

function startOfflineGame() {
  UI.showScreen(null);
  UI.showHUD();
  Engine.startGame(false, false);
}

// Start the game when page loads
window.addEventListener('load', initGame);
