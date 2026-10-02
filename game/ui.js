// ui.js - User interface system

const UI = {
  elements: {},

  init() {
    this.elements = {
      mainMenu: document.getElementById('main-menu'),
      onlineMenu: document.getElementById('online-menu'),
      hostForm: document.getElementById('host-form'),
      joinForm: document.getElementById('join-form'),
      serverBrowser: document.getElementById('server-browser'),
      lobby: document.getElementById('lobby'),
      settings: document.getElementById('settings-screen'),
      hud: document.getElementById('hud'),
      levelUp: document.getElementById('level-up'),
      gameOver: document.getElementById('game-over'),
      upgradeCards: document.getElementById('upgrade-cards'),
      gameOverStats: document.getElementById('game-over-stats'),
      hudTimer: document.getElementById('hud-timer'),
      hudLevel: document.getElementById('hud-level'),
      hudKills: document.getElementById('hud-kills'),
      hudHealthFill: document.getElementById('hud-health-fill'),
      hudHealthText: document.getElementById('hud-health-text'),
      hudXpFill: document.getElementById('hud-xp-fill'),
      hudWeapons: document.getElementById('hud-weapons'),
      bossBar: document.getElementById('boss-bar'),
      bossName: document.getElementById('boss-name'),
      bossHealthFill: document.getElementById('boss-health-fill'),
      mobileControls: document.getElementById('mobile-controls'),
      connectionStatus: document.getElementById('connection-status'),
      joinError: document.getElementById('join-error'),
      serverList: document.getElementById('server-list'),
      lobbyInfo: document.getElementById('lobby-info'),
      lobbyPlayers: document.getElementById('lobby-players'),
      comboDisplay: document.getElementById('combo-display'),
      fpsDisplay: document.getElementById('fps-display'),
    };
  },

  showScreen(screenName) {
    const screens = ['mainMenu', 'onlineMenu', 'hostForm', 'joinForm', 'serverBrowser', 'lobby', 'settings', 'levelUp', 'gameOver'];
    for (const screen of screens) {
      if (this.elements[screen]) {
        this.elements[screen].classList.add('hidden');
      }
    }
    if (screenName && this.elements[screenName]) {
      this.elements[screenName].classList.remove('hidden');
    }
  },

  showHUD() {
    this.elements.hud.classList.remove('hidden');
  },

  hideHUD() {
    this.elements.hud.classList.add('hidden');
  },

  updateHUD() {
    const player = Engine.player;
    if (!player) return;

    // Timer
    const minutes = Math.floor(Engine.matchTime / 60);
    const seconds = Math.floor(Engine.matchTime % 60);
    this.elements.hudTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    // Level
    this.elements.hudLevel.textContent = `Lv ${player.level}`;

    // Kills
    this.elements.hudKills.textContent = `${Engine.kills}`;

    // Health
    const healthPercent = Math.max(0, (player.hp / player.maxHp) * 100);
    this.elements.hudHealthFill.style.width = `${healthPercent}%`;
    if (this.elements.hudHealthText) {
      this.elements.hudHealthText.textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
    }

    // XP
    const xpPercent = (player.xp / player.xpToNext) * 100;
    this.elements.hudXpFill.style.width = `${xpPercent}%`;

    // Weapons
    this.updateWeaponDisplay();

    // Boss bar
    if (Engine.bossActive) {
      const boss = Engine.bossActive;
      const bossPercent = (boss.hp / boss.maxHp) * 100;
      this.elements.bossHealthFill.style.width = `${bossPercent}%`;
    }

    // Combo
    if (this.elements.comboDisplay) {
      if (Engine.combo > 1) {
        this.elements.comboDisplay.textContent = `${Engine.combo}x COMBO`;
        this.elements.comboDisplay.style.opacity = Math.min(1, Engine.comboTimer);
      } else {
        this.elements.comboDisplay.style.opacity = 0;
      }
    }

    // FPS
    if (this.elements.fpsDisplay) {
      this.elements.fpsDisplay.textContent = `${Engine.fps} FPS`;
    }
  },

  updateWeaponDisplay() {
    const player = Engine.player;
    if (!player) return;

    let html = '';
    for (const weapon of player.weapons) {
      html += `<div class="weapon-slot active" title="${weapon.name} Lv${weapon.level}">${weapon.icon}</div>`;
    }
    this.elements.hudWeapons.innerHTML = html;
  },

  showLevelUp() {
    const choices = UpgradeSystem.getRandomChoices(3);
    let html = '';

    for (const upgradeId of choices) {
      const upgrade = UPGRADES[upgradeId];
      const level = UpgradeSystem.getUpgradeLevel(upgradeId);
      html += `
        <div class="upgrade-card" onclick="UpgradeSystem.applyUpgrade('${upgradeId}')">
          <div class="icon">${upgrade.icon}</div>
          <div class="name">${upgrade.name}</div>
          <div class="desc">${upgrade.description}</div>
          <div class="level">Level ${level}/${upgrade.maxLevel}</div>
        </div>
      `;
    }

    this.elements.upgradeCards.innerHTML = html;
    this.showScreen('levelUp');
  },

  hideLevelUp() {
    this.showScreen(null);
  },

  showGameOver() {
    const player = Engine.player;
    const minutes = Math.floor(Engine.matchTime / 60);
    const seconds = Math.floor(Engine.matchTime % 60);

    let html = `
      <div class="stat-grid">
        <div class="stat"><span class="stat-label">Survival Time</span> <span class="stat-value">${minutes}:${seconds.toString().padStart(2, '0')}</span></div>
        <div class="stat"><span class="stat-label">Level</span> <span class="stat-value">${player.level}</span></div>
        <div class="stat"><span class="stat-label">Enemies Defeated</span> <span class="stat-value">${Engine.kills}</span></div>
        <div class="stat"><span class="stat-label">Damage Dealt</span> <span class="stat-value">${Engine.damageDealt}</span></div>
        <div class="stat"><span class="stat-label">Boss Kills</span> <span class="stat-value">${Engine.bossKills}</span></div>
        <div class="stat"><span class="stat-label">Max Combo</span> <span class="stat-value">${Engine.maxCombo}x</span></div>
        <div class="stat"><span class="stat-label">Upgrades</span> <span class="stat-value">${Object.keys(player.upgradeLevels || {}).length}</span></div>
      </div>
    `;

    this.elements.gameOverStats.innerHTML = html;
    this.showScreen('gameOver');
  },

  showBossBar(name) {
    this.elements.bossName.textContent = name;
    this.elements.bossBar.classList.remove('hidden');
  },

  hideBossBar() {
    this.elements.bossBar.classList.add('hidden');
  },

  showError(message) {
    this.elements.joinError.textContent = message;
    setTimeout(() => {
      this.elements.joinError.textContent = '';
    }, 5000);
  },

  showConnectionStatus(status, message) {
    this.elements.connectionStatus.className = status;
    this.elements.connectionStatus.textContent = message;
    this.elements.connectionStatus.classList.remove('hidden');
  },

  hideConnectionStatus() {
    this.elements.connectionStatus.classList.add('hidden');
  },

  updateServerList(servers) {
    let html = '';
    for (const server of servers) {
      const statusClass = server.online ? 'online' : 'offline';
      const statusText = server.online ? 'ONLINE' : 'OFFLINE';
      const canJoin = server.online && server.players < server.maxPlayers;

      html += `
        <div class="server-item">
          <div>
            <div class="server-name">${server.name}</div>
            <div class="server-info">${server.players}/${server.maxPlayers} players | Ping: ${server.ping}ms</div>
          </div>
          <span class="server-status ${statusClass}">${statusText}</span>
          <button ${canJoin ? '' : 'disabled'} onclick="Multiplayer.joinServer('${server.id}')">JOIN</button>
        </div>
      `;
    }
    this.elements.serverList.innerHTML = html;
  },

  updateLobby(players, isHost, maxPlayers) {
    let html = `<div id="lobby-info">Players: ${players.length}/${maxPlayers}</div>`;
    html += '<div id="lobby-players">';

    for (const player of players) {
      const statusClass = player.ready ? 'ready' : '';
      const hostClass = player.isHost ? 'host' : '';
      const statusText = player.isHost ? 'HOST' : (player.ready ? 'READY' : 'NOT READY');
      html += `
        <div class="lobby-player ${statusClass} ${hostClass}">
          <div class="player-name">${player.name}</div>
          <div class="player-status">${statusText}</div>
        </div>
      `;
    }

    html += '</div>';
    this.elements.lobbyPlayers.innerHTML = html;

    const startBtn = document.getElementById('btn-start-game');
    if (isHost) {
      startBtn.classList.remove('hidden');
    } else {
      startBtn.classList.add('hidden');
    }
  },

  showMobileControls() {
    if ('ontouchstart' in window) {
      this.elements.mobileControls.classList.remove('hidden');
    }
  },

  hideMobileControls() {
    this.elements.mobileControls.classList.add('hidden');
  },
};
