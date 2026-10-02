// engine.js - Core game engine, loop, and rendering

const Engine = {
  canvas: null,
  ctx: null,
  width: 0,
  height: 0,
  lastTime: 0,
  deltaTime: 0,
  gameTime: 0,
  running: false,
  paused: false,

  // Camera
  camera: { x: 0, y: 0, shake: 0, shakeX: 0, shakeY: 0, punch: 0 },

  // Game state
  state: 'menu', // menu, playing, levelup, gameover
  matchTime: 0,
  kills: 0,
  damageDealt: 0,
  bossKills: 0,

  // Entities
  player: null,
  enemies: [],
  projectiles: [],
  enemyProjectiles: [],
  xpGems: [],
  particles: [],
  damageNumbers: [],
  floatingTexts: [],
  obstacles: [],
  decorations: [],

  // Spawning
  spawnTimer: 0,
  bossTimer: 0,
  bossActive: null,
  bossSpawnInterval: 120,

  // World
  worldSeed: 0,
  worldWidth: WORLD.width,
  worldHeight: WORLD.height,

  // Multiplayer
  isMultiplayer: false,
  isHost: false,
  serverState: null,

  init() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  },

  startGame(multiplayer, isHost, seed) {
    this.isMultiplayer = multiplayer || false;
    this.isHost = isHost || false;
    this.worldSeed = seed || Math.floor(Math.random() * 1000000);
    this.matchTime = 0;
    this.kills = 0;
    this.damageDealt = 0;
    this.bossKills = 0;
    this.bossTimer = 0;
    this.bossActive = null;
    this.spawnTimer = 0;
    this.state = 'playing';
    this.paused = false;
    this.running = true;

    // Generate world
    World.generate(this.worldSeed);

    // Create player
    this.player = new Player(this.worldWidth / 2, this.worldHeight / 2);

    // Clear entities
    this.enemies = [];
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.xpGems = [];
    this.particles = [];
    this.damageNumbers = [];
    this.floatingTexts = [];

    // Generate obstacles
    this.obstacles = World.generateObstacles();
    this.decorations = World.generateDecorations();

    // Start loop
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  },

  loop(currentTime) {
    if (!this.running) return;

    this.deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.05);
    this.lastTime = currentTime;

    if (!this.paused && this.state === 'playing') {
      this.update(this.deltaTime);
    }

    this.render();
    requestAnimationFrame((t) => this.loop(t));
  },

  update(dt) {
    this.gameTime += dt;
    this.matchTime += dt;

    // Update player
    this.player.update(dt);

    // Update camera
    this.updateCamera(dt);

    // Spawn enemies
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnEnemies();
      this.spawnTimer = DIFFICULTY_SCALING.spawnRate(this.matchTime);
    }

    // Boss spawning
    if (!this.bossActive) {
      this.bossTimer += dt;
      if (this.bossTimer >= this.bossSpawnInterval) {
        this.spawnBoss();
        this.bossTimer = 0;
      }
    }

    // Update enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update(dt);
      if (enemy.hp <= 0) {
        this.onEnemyDeath(enemy);
        this.enemies.splice(i, 1);
      }
    }

    // Update boss
    if (this.bossActive) {
      this.bossActive.update(dt);
      if (this.bossActive.hp <= 0) {
        this.onBossDeath(this.bossActive);
        this.bossActive = null;
      }
    }

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.update(dt);
      if (proj.dead) {
        this.projectiles.splice(i, 1);
      }
    }

    // Update enemy projectiles
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const proj = this.enemyProjectiles[i];
      proj.update(dt);
      if (proj.dead) {
        this.enemyProjectiles.splice(i, 1);
      }
    }

    // Update XP gems
    for (let i = this.xpGems.length - 1; i >= 0; i--) {
      const gem = this.xpGems[i];
      gem.update(dt);
      if (gem.collected) {
        this.xpGems.splice(i, 1);
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.update(dt);
      if (p.dead) {
        this.particles.splice(i, 1);
      }
    }

    // Update damage numbers
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const dn = this.damageNumbers[i];
      dn.update(dt);
      if (dn.dead) {
        this.damageNumbers.splice(i, 1);
      }
    }

    // Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.update(dt);
      if (ft.dead) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // Check player death
    if (this.player.hp <= 0) {
      this.gameOver();
    }

    // Update HUD
    UI.updateHUD();
  },

  updateCamera(dt) {
    const targetX = this.player.x - this.width / 2;
    const targetY = this.player.y - this.height / 2;

    // Smooth camera follow
    this.camera.x += (targetX - this.camera.x) * 5 * dt;
    this.camera.y += (targetY - this.camera.y) * 5 * dt;

    // Clamp to world bounds
    this.camera.x = Math.max(0, Math.min(this.worldWidth - this.width, this.camera.x));
    this.camera.y = Math.max(0, Math.min(this.worldHeight - this.height, this.camera.y));

    // Screen shake
    if (this.camera.shake > 0) {
      this.camera.shake -= dt * 10;
      this.camera.shakeX = (Math.random() - 0.5) * this.camera.shake * 20;
      this.camera.shakeY = (Math.random() - 0.5) * this.camera.shake * 20;
    } else {
      this.camera.shakeX = 0;
      this.camera.shakeY = 0;
    }

    // Camera punch
    if (this.camera.punch > 0) {
      this.camera.punch -= dt * 5;
    }
  },

  spawnEnemies() {
    const count = Math.floor(2 + this.matchTime * 0.1);
    const types = Object.keys(ENEMY_TYPES);

    for (let i = 0; i < count; i++) {
      const typeIndex = Math.floor(Math.random() * Math.min(types.length, 2 + Math.floor(this.matchTime / 30)));
      const type = types[Math.min(typeIndex, types.length - 1)];
      const enemyType = ENEMY_TYPES[type];

      // Spawn outside visible area
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.max(this.width, this.height) / 2 + 100 + Math.random() * 200;
      let x = this.player.x + Math.cos(angle) * dist;
      let y = this.player.y + Math.sin(angle) * dist;

      // Clamp to world
      x = Math.max(50, Math.min(this.worldWidth - 50, x));
      y = Math.max(50, Math.min(this.worldHeight - 50, y));

      const enemy = new Enemy(x, y, enemyType, this.matchTime);
      this.enemies.push(enemy);
    }
  },

  spawnBoss() {
    const bossType = BOSS_TYPES.boss1;
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.max(this.width, this.height) / 2 + 200;
    let x = this.player.x + Math.cos(angle) * dist;
    let y = this.player.y + Math.sin(angle) * dist;

    x = Math.max(100, Math.min(this.worldWidth - 100, x));
    y = Math.max(100, Math.min(this.worldHeight - 100, y));

    this.bossActive = new Boss(x, y, bossType, this.matchTime);
    this.enemies.push(this.bossActive);

    // Boss spawn effect
    this.addScreenShake(1);
    this.addFloatingText(x, y - 50, 'BOSS SPAWNED!', '#ff0000', 2);
    UI.showBossBar(bossType.name);
  },

  onEnemyDeath(enemy) {
    this.kills++;
    this.damageDealt += enemy.maxHp;

    // Drop XP gems
    const gemCount = Math.ceil(enemy.xp / 5);
    for (let i = 0; i < gemCount; i++) {
      const gem = new XPGem(
        enemy.x + (Math.random() - 0.5) * 20,
        enemy.y + (Math.random() - 0.5) * 20,
        Math.ceil(enemy.xp / gemCount)
      );
      this.xpGems.push(gem);
    }

    // Death particles
    for (let i = 0; i < 8; i++) {
      this.particles.push(new Particle(
        enemy.x, enemy.y,
        (Math.random() - 0.5) * 200,
        (Math.random() - 0.5) * 200,
        enemy.color, 0.5, 4
      ));
    }

    // Hit effect
    this.particles.push(new HitEffect(enemy.x, enemy.y));
  },

  onBossDeath(boss) {
    this.bossKills++;
    this.addScreenShake(2);
    this.addFloatingText(boss.x, boss.y - 50, 'BOSS DEFEATED!', '#ffd700', 2.5);

    // Big explosion
    for (let i = 0; i < 30; i++) {
      this.particles.push(new Particle(
        boss.x + (Math.random() - 0.5) * 60,
        boss.y + (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 400,
        (Math.random() - 0.5) * 400,
        '#ff4400', 1, 8
      ));
    }

    // Drop lots of XP
    for (let i = 0; i < 20; i++) {
      const gem = new XPGem(
        boss.x + (Math.random() - 0.5) * 100,
        boss.y + (Math.random() - 0.5) * 100,
        10
      );
      this.xpGems.push(gem);
    }

    UI.hideBossBar();
  },

  gameOver() {
    this.state = 'gameover';
    this.running = false;
    UI.showGameOver();
  },

  render() {
    const ctx = this.ctx;
    ctx.save();

    // Clear
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, this.width, this.height);

    if (this.state === 'menu') {
      ctx.restore();
      return;
    }

    // Apply camera transform
    ctx.translate(-this.camera.x + this.camera.shakeX, -this.camera.y + this.camera.shakeY);

    // Draw world
    this.drawWorld(ctx);

    // Draw decorations
    this.drawDecorations(ctx);

    // Draw obstacles
    this.drawObstacles(ctx);

    // Draw XP gems
    for (const gem of this.xpGems) {
      gem.draw(ctx);
    }

    // Draw enemies
    for (const enemy of this.enemies) {
      enemy.draw(ctx);
    }

    // Draw player
    if (this.player) {
      this.player.draw(ctx);
    }

    // Draw projectiles
    for (const proj of this.projectiles) {
      proj.draw(ctx);
    }

    // Draw enemy projectiles
    for (const proj of this.enemyProjectiles) {
      proj.draw(ctx);
    }

    // Draw particles
    for (const p of this.particles) {
      p.draw(ctx);
    }

    // Draw damage numbers
    for (const dn of this.damageNumbers) {
      dn.draw(ctx);
    }

    // Draw floating texts
    for (const ft of this.floatingTexts) {
      ft.draw(ctx);
    }

    ctx.restore();
  },

  drawWorld(ctx) {
    // Draw floor tiles
    const startX = Math.floor(this.camera.x / WORLD.tileSize) * WORLD.tileSize;
    const startY = Math.floor(this.camera.y / WORLD.tileSize) * WORLD.tileSize;
    const endX = startX + this.width + WORLD.tileSize * 2;
    const endY = startY + this.height + WORLD.tileSize * 2;

    for (let x = startX; x < endX; x += WORLD.tileSize) {
      for (let y = startY; y < endY; y += WORLD.tileSize) {
        const tileX = Math.floor(x / WORLD.tileSize);
        const tileY = Math.floor(y / WORLD.tileSize);
        const isAlt = (tileX + tileY) % 2 === 0;
        ctx.fillStyle = isAlt ? COLORS.floor : COLORS.floorAlt;
        ctx.fillRect(x, y, WORLD.tileSize, WORLD.tileSize);
      }
    }

    // Draw world border
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, this.worldWidth, this.worldHeight);
  },

  drawDecorations(ctx) {
    for (const dec of this.decorations) {
      if (this.isOnScreen(dec.x, dec.y, 50)) {
        dec.draw(ctx);
      }
    }
  },

  drawObstacles(ctx) {
    for (const obs of this.obstacles) {
      if (this.isOnScreen(obs.x, obs.y, 100)) {
        obs.draw(ctx);
      }
    }
  },

  isOnScreen(x, y, margin) {
    margin = margin || 0;
    return x > this.camera.x - margin &&
           x < this.camera.x + this.width + margin &&
           y > this.camera.y - margin &&
           y < this.camera.y + this.height + margin;
  },

  // Effects
  addScreenShake(intensity) {
    this.camera.shake = Math.max(this.camera.shake, intensity);
  },

  addCameraPunch(intensity) {
    this.camera.punch = Math.max(this.camera.punch, intensity);
  },

  addDamageNumber(x, y, damage, isCrit) {
    this.damageNumbers.push(new DamageNumber(x, y, damage, isCrit));
  },

  addFloatingText(x, y, text, color, scale) {
    this.floatingTexts.push(new FloatingText(x, y, text, color, scale));
  },

  addExplosion(x, y, radius, color) {
    for (let i = 0; i < 15; i++) {
      const angle = (i / 15) * Math.PI * 2;
      const speed = 100 + Math.random() * 200;
      this.particles.push(new Particle(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        color || '#ff8800',
        0.5 + Math.random() * 0.5,
        4 + Math.random() * 4
      ));
    }
    this.particles.push(new ExplosionEffect(x, y, radius));
    this.addScreenShake(0.5);
  },

  addHitSpark(x, y, color) {
    for (let i = 0; i < 4; i++) {
      this.particles.push(new Particle(
        x, y,
        (Math.random() - 0.5) * 150,
        (Math.random() - 0.5) * 150,
        color || '#ffffff',
        0.2,
        2
      ));
    }
  },

  // Collision helpers
  checkCollision(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < (a.size + b.size) / 2;
  },

  checkSquaredDistance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  },

  // Get all enemies within range
  getEnemiesInRange(x, y, range) {
    const rangeSq = range * range;
    return this.enemies.filter(e => {
      const dx = e.x - x;
      const dy = e.y - y;
      return dx * dx + dy * dy < rangeSq;
    });
  },

  // Find nearest enemy
  findNearestEnemy(x, y, maxDist) {
    let nearest = null;
    let nearestDist = maxDist * maxDist;

    for (const enemy of this.enemies) {
      const dx = enemy.x - x;
      const dy = enemy.y - y;
      const distSq = dx * dx + dy * dy;
      if (distSq < nearestDist) {
        nearestDist = distSq;
        nearest = enemy;
      }
    }
    return nearest;
  },
};
