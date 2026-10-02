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

  // Admin panel
  setupAdminPanel();
}

// ─── Admin Panel ───
const AdminPanel = {
  open: false,

  toggle() {
    this.open = !this.open;
    const panel = document.getElementById('admin-panel');
    if (this.open) {
      panel.classList.remove('hidden');
      this.refreshStats();
      this.refreshWeapons();
    } else {
      panel.classList.add('hidden');
    }
  },

  close() {
    this.open = false;
    document.getElementById('admin-panel').classList.add('hidden');
  },

  refreshStats() {
    const p = Engine.player;
    if (!p) return;
    document.getElementById('admin-level').textContent = p.level;
    document.getElementById('admin-hp').textContent = `${Math.ceil(p.hp)}/${p.maxHp}`;
    document.getElementById('admin-dmg-mult').textContent = p.damageMultiplier.toFixed(1) + 'x';
    document.getElementById('admin-spd-mult').textContent = p.speedMultiplier.toFixed(1) + 'x';
  },

  refreshWeapons() {
    const p = Engine.player;
    const container = document.getElementById('admin-weapons');
    if (!p) {
      container.innerHTML = '<span style="color:var(--text-secondary);font-size:0.8rem;">Start a game first</span>';
      return;
    }
    let html = '';
    for (const [id, w] of Object.entries(WEAPONS)) {
      const active = p.weapons.some(pw => pw.id === id) ? 'active' : '';
      html += `<button class="admin-weapon-btn ${active}" onclick="AdminPanel.giveWeapon('${id}')">${w.icon} ${w.name}</button>`;
    }
    container.innerHTML = html;
  },

  giveWeapon(weaponId) {
    const p = Engine.player;
    if (!p) return;
    const weaponData = WEAPONS[weaponId];
    if (!weaponData) return;
    // Remove existing non-evolution weapons, keep evolutions
    p.weapons = p.weapons.filter(w => w.evolution);
    p.weapons.push({
      ...weaponData,
      level: 1,
      cooldown: 0,
      orbitAngle: 0,
    });
    Engine.addFloatingText(p.x, p.y - 40, weaponData.name + '!', weaponData.color, 1.5);
    this.refreshWeapons();
  },

  setup() {
    // Toggle with backslash
    window.addEventListener('keydown', (e) => {
      if (e.key === '\\') {
        e.preventDefault();
        this.toggle();
      }
      if (e.key === 'Escape' && this.open) {
        this.close();
      }
    });

    // Close button
    document.getElementById('admin-close').addEventListener('click', () => this.close());

    // God mode toggles
    document.getElementById('admin-op-health').addEventListener('change', (e) => {
      const p = Engine.player;
      if (!p) return;
      if (e.target.checked) {
        p.maxHp = 999999;
        p.hp = 999999;
        p.armorMultiplier = 0;
      } else {
        p.maxHp = 100;
        p.hp = 100;
        p.armorMultiplier = 1;
      }
      this.refreshStats();
    });

    document.getElementById('admin-op-damage').addEventListener('change', (e) => {
      const p = Engine.player;
      if (!p) return;
      p.damageMultiplier = e.target.checked ? 1000 : 1;
      this.refreshStats();
    });

    document.getElementById('admin-op-everything').addEventListener('change', (e) => {
      const p = Engine.player;
      if (!p) return;
      if (e.target.checked) {
        p.maxHp = 999999;
        p.hp = 999999;
        p.armorMultiplier = 0;
        p.damageMultiplier = 1000;
        p.speedMultiplier = 3;
        p.magnetRange = 9999;
        document.getElementById('admin-op-health').checked = true;
        document.getElementById('admin-op-damage').checked = true;
      } else {
        p.maxHp = 100;
        p.hp = 100;
        p.armorMultiplier = 1;
        p.damageMultiplier = 1;
        p.speedMultiplier = 1;
        p.magnetRange = 100;
        document.getElementById('admin-op-health').checked = false;
        document.getElementById('admin-op-damage').checked = false;
      }
      this.refreshStats();
    });

    // Action buttons
    document.getElementById('admin-heal').addEventListener('click', () => {
      const p = Engine.player;
      if (!p) return;
      p.hp = p.maxHp;
      Engine.addFloatingText(p.x, p.y - 30, 'HEALED!', '#00ff88', 1.5);
      this.refreshStats();
    });

    document.getElementById('admin-max-level').addEventListener('click', () => {
      const p = Engine.player;
      if (!p) return;
      p.level = 99;
      p.xp = 0;
      p.xpToNext = XP_CURVE(99);
      Engine.addFloatingText(p.x, p.y - 30, 'LEVEL 99!', '#ffd700', 2);
      this.refreshStats();
    });

    document.getElementById('admin-kill-all').addEventListener('click', () => {
      for (const enemy of Engine.enemies) {
        enemy.hp = 0;
      }
      Engine.addFloatingText(Engine.player.x, Engine.player.y - 30, 'ALL KILLED!', '#ff0044', 2);
    });

    document.getElementById('admin-spawn-boss').addEventListener('click', () => {
      Engine.bossTimer = Engine.bossSpawnInterval;
      Engine.addFloatingText(Engine.player.x, Engine.player.y - 30, 'BOSS INCOMING!', '#ff0044', 2);
    });
  }
};

function setupAdminPanel() {
  AdminPanel.setup();
}

function startOfflineGame() {
  UI.showScreen(null);
  UI.showHUD();
  Engine.startGame(false, false);
}

// Start the game when page loads
window.addEventListener('load', initGame);
