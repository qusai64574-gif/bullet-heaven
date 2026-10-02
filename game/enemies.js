// enemies.js - Enemy and Boss classes

class Enemy {
  constructor(x, y, type, gameTime) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.size = type.size;
    this.color = type.color;
    this.sprite = type.sprite;

    // Scale stats with difficulty
    const hpMult = DIFFICULTY_SCALING.hpMultiplier(gameTime);
    const spdMult = DIFFICULTY_SCALING.speedMultiplier(gameTime);
    const dmgMult = DIFFICULTY_SCALING.damageMultiplier(gameTime);

    this.maxHp = Math.floor(type.hp * hpMult);
    this.hp = this.maxHp;
    this.speed = type.speed * spdMult;
    this.damage = Math.floor(type.damage * dmgMult);
    this.xp = type.xp;
    this.behavior = type.behavior;

    // Ranged enemy properties
    this.attackRange = type.attackRange || 0;
    this.attackCooldown = type.attackCooldown || 0;
    this.attackTimer = 0;
    this.projectileSpeed = type.projectileSpeed || 200;

    // Animation
    this.animTime = Math.random() * 10;
    this.facingRight = true;

    // Elite
    this.isElite = Math.random() < (DIFFICULTY_SCALING.eliteChance(gameTime) + (Engine.player ? Engine.player.luckBonus : 0));
    if (this.isElite) {
      this.maxHp *= 3;
      this.hp = this.maxHp;
      this.speed *= 1.2;
      this.damage = Math.floor(this.damage * 1.5);
      this.xp *= 5;
      this.size *= 1.3;
    }

    // Hit flash
    this.hitFlash = 0;

    // Swarm separation
    this.separationX = 0;
    this.separationY = 0;

    // Slow effect
    this.slowTimer = 0;
    this.slowAmount = 0;

    // Shield
    this.shieldHp = type.shieldHp || 0;
    this.maxShieldHp = this.shieldHp;

    // Teleport
    this.teleportTimer = type.teleportCooldown || 0;
  }

  update(dt) {
    this.animTime += dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;

    // Slow effect
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
    }

    const player = Engine.player;
    if (!player) return;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      this.facingRight = dx > 0;
    }

    // Apply slow aura from player
    const slowMult = 1 - (player.slowAura || 0);
    const effectiveSpeed = this.speed * slowMult * (this.slowTimer > 0 ? (1 - this.slowAmount) : 1);

    switch (this.behavior) {
      case 'chase':
        this.moveToward(player.x, player.y, dt, effectiveSpeed);
        break;
      case 'ranged':
        this.updateRanged(dt, player, dist, effectiveSpeed);
        break;
      case 'swarm':
        this.updateSwarm(dt, player, dist, effectiveSpeed);
        break;
    }

    // Separation from other enemies
    if (this.behavior === 'swarm') {
      this.applySeparation(dt);
    }

    // Teleport
    if (this.type.canTeleport) {
      this.teleportTimer -= dt;
      if (this.teleportTimer <= 0 && dist < 150) {
        this.teleport(player);
        this.teleportTimer = this.type.teleportCooldown;
      }
    }

    // Heal others
    if (this.type.healsOthers) {
      this.healTimer = (this.healTimer || 0) - dt;
      if (this.healTimer <= 0) {
        this.healNearby(player);
        this.healTimer = this.type.attackCooldown;
      }
    }

    // Clamp to world
    this.x = Math.max(this.size, Math.min(Engine.worldWidth - this.size, this.x));
    this.y = Math.max(this.size, Math.min(Engine.worldHeight - this.size, this.y));

    // Attack player on contact
    if (dist < (this.size + player.size) / 2) {
      player.takeDamage(this.damage);
    }
  }

  moveToward(tx, ty, dt, speed) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
      this.x += (dx / dist) * speed * dt;
      this.y += (dy / dist) * speed * dt;
    }
  }

  updateRanged(dt, player, dist, speed) {
    this.attackTimer -= dt;

    if (dist > this.attackRange) {
      this.moveToward(player.x, player.y, dt, speed);
    } else if (dist < this.attackRange * 0.6) {
      const dx = this.x - player.x;
      const dy = this.y - player.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0) {
        this.x += (dx / d) * speed * 0.5 * dt;
        this.y += (dy / d) * speed * 0.5 * dt;
      }
    }

    if (this.attackTimer <= 0 && dist < this.attackRange * 1.5) {
      this.shootAt(player);
      this.attackTimer = this.attackCooldown;
    }
  }

  shootAt(player) {
    const angle = Math.atan2(player.y - this.y, player.x - this.x);
    const proj = new EnemyProjectile(
      this.x, this.y,
      Math.cos(angle) * this.projectileSpeed,
      Math.sin(angle) * this.projectileSpeed,
      this.damage,
      this.color
    );
    Engine.enemyProjectiles.push(proj);
  }

  updateSwarm(dt, player, dist, speed) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 0) {
      const wobble = Math.sin(this.animTime * 5) * 0.3;
      const nx = dx / d + wobble * (dy / d);
      const ny = dy / d - wobble * (dx / d);
      const nl = Math.sqrt(nx * nx + ny * ny);
      this.x += (nx / nl) * speed * dt;
      this.y += (ny / nl) * speed * dt;
    }
  }

  applySeparation(dt) {
    const separationDist = this.size * 1.5;
    const separationDistSq = separationDist * separationDist;

    for (const other of Engine.enemies) {
      if (other === this) continue;
      const dx = this.x - other.x;
      const dy = this.y - other.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < separationDistSq && distSq > 0) {
        const dist = Math.sqrt(distSq);
        const force = (separationDist - dist) / separationDist;
        this.separationX += (dx / dist) * force * 100;
        this.separationY += (dy / dist) * force * 100;
      }
    }

    this.x += this.separationX * dt;
    this.y += this.separationY * dt;
    this.separationX *= 0.9;
    this.separationY *= 0.9;
  }

  teleport(player) {
    const angle = Math.random() * Math.PI * 2;
    const dist = this.type.teleportRange;
    this.x = player.x + Math.cos(angle) * dist;
    this.y = player.y + Math.sin(angle) * dist;
    this.x = Math.max(this.size, Math.min(Engine.worldWidth - this.size, this.x));
    this.y = Math.max(this.size, Math.min(Engine.worldHeight - this.size, this.y));

    // Teleport effect
    for (let i = 0; i < 10; i++) {
      Engine.particles.push(new Particle(
        this.x, this.y,
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 100,
        '#ff44aa', 0.4, 3
      ));
    }
  }

  healNearby(player) {
    const nearby = Engine.getEnemiesInRange(this.x, this.y, this.type.healRadius);
    for (const enemy of nearby) {
      if (enemy !== this && enemy.hp > 0 && enemy.hp < enemy.maxHp) {
        enemy.hp = Math.min(enemy.hp + this.type.healAmount, enemy.maxHp);
        Engine.addFloatingText(enemy.x, enemy.y - 20, `+${this.type.healAmount}`, '#44ffaa', 0.8);
      }
    }
  }

  applySlow(amount, duration) {
    this.slowTimer = duration;
    this.slowAmount = amount;
  }

  takeDamage(amount) {
    // Shield absorbs damage first
    if (this.shieldHp > 0) {
      const shieldDmg = Math.min(this.shieldHp, amount);
      this.shieldHp -= shieldDmg;
      amount -= shieldDmg;
      Engine.addFloatingText(this.x, this.y - this.size / 2 - 15, 'SHIELD', '#4488ff', 0.7);
    }

    this.hp -= amount;
    this.hitFlash = 0.1;
  }

  draw(ctx) {
    // Hit flash
    if (this.hitFlash > 0) {
      ctx.globalAlpha = 0.7;
    }

    // Elite glow
    if (this.isElite) {
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 20;
    }

    // Slow effect
    if (this.slowTimer > 0) {
      ctx.shadowColor = '#88ddff';
      ctx.shadowBlur = 10;
    }

    Assets.drawAnim(ctx, this.sprite, this.x, this.y, this.animTime, !this.facingRight, this.size / 32);

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // Shield bar
    if (this.maxShieldHp > 0 && this.shieldHp > 0) {
      const barWidth = this.size;
      const barHeight = 3;
      const barY = this.y - this.size / 2 - 12;
      ctx.fillStyle = '#333';
      ctx.fillRect(this.x - barWidth / 2, barY, barWidth, barHeight);
      ctx.fillStyle = '#4488ff';
      ctx.fillRect(this.x - barWidth / 2, barY, barWidth * (this.shieldHp / this.maxShieldHp), barHeight);
    }

    // Health bar for elites and tanks
    if (this.isElite || this.type.id === 'tank' || this.type.id === 'shielder') {
      const barWidth = this.size;
      const barHeight = 4;
      const barY = this.y - this.size / 2 - 8;
      ctx.fillStyle = '#333';
      ctx.fillRect(this.x - barWidth / 2, barY, barWidth, barHeight);
      ctx.fillStyle = this.isElite ? '#ffd700' : '#ff4444';
      ctx.fillRect(this.x - barWidth / 2, barY, barWidth * (this.hp / this.maxHp), barHeight);
    }
  }
}

class Boss {
  constructor(x, y, type, gameTime) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.size = type.size;
    this.color = type.color;
    this.sprite = type.sprite;

    const hpMult = DIFFICULTY_SCALING.hpMultiplier(gameTime);
    this.maxHp = Math.floor(type.hp * hpMult);
    this.hp = this.maxHp;
    this.speed = type.speed;
    this.damage = type.damage;
    this.xp = 500;
    this.behavior = 'boss';

    // Phase system
    this.currentPhase = 0;
    this.phases = type.phases;

    // Attack timers
    this.attackTimers = {};
    for (const phase of this.phases) {
      for (const attack of phase.attacks) {
        this.attackTimers[attack] = 0;
      }
    }

    // Movement
    this.moveTarget = { x, y };
    this.moveTimer = 0;
    this.chargeTimer = 0;
    this.isCharging = false;
    this.chargeDir = { x: 0, y: 0 };

    // Animation
    this.animTime = 0;
    this.facingRight = true;

    // Bullet hell
    this.bulletHellAngle = 0;

    // Laser
    this.laserAngle = 0;
    this.laserActive = false;

    // Hit flash
    this.hitFlash = 0;

    // Spawn effect
    this.spawnEffect = 2;
  }

  update(dt) {
    this.animTime += dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.spawnEffect > 0) this.spawnEffect -= dt;

    const player = Engine.player;
    if (!player) return;

    // Update phase
    const hpPercent = this.hp / this.maxHp;
    for (let i = this.phases.length - 1; i >= 0; i--) {
      if (hpPercent <= this.phases[i].hpThreshold) {
        this.currentPhase = i;
        break;
      }
    }

    // Movement
    this.updateMovement(dt, player);

    // Attacks
    this.updateAttacks(dt, player);

    // Contact damage
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < (this.size + player.size) / 2) {
      player.takeDamage(this.damage);
    }
  }

  updateMovement(dt, player) {
    if (this.isCharging) {
      this.chargeTimer -= dt;
      this.x += this.chargeDir.x * this.speed * 4 * dt;
      this.y += this.chargeDir.y * this.speed * 4 * dt;

      if (this.chargeTimer <= 0) {
        this.isCharging = false;
      }
    } else {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 100) {
        this.x += (dx / dist) * this.speed * dt;
        this.y += (dy / dist) * this.speed * dt;
        this.facingRight = dx > 0;
      }
    }

    // Clamp to world
    this.x = Math.max(this.size, Math.min(Engine.worldWidth - this.size, this.x));
    this.y = Math.max(this.size, Math.min(Engine.worldHeight - this.size, this.y));
  }

  updateAttacks(dt, player) {
    const attacks = this.phases[this.currentPhase].attacks;

    for (const attack of attacks) {
      this.attackTimers[attack] -= dt;

      if (this.attackTimers[attack] <= 0) {
        this.executeAttack(attack, player);
        switch (attack) {
          case 'charge': this.attackTimers[attack] = 5; break;
          case 'spawn_minions': this.attackTimers[attack] = 8; break;
          case 'bullet_hell': this.attackTimers[attack] = 3; break;
          case 'laser_sweep': this.attackTimers[attack] = 6; break;
          case 'teleport': this.attackTimers[attack] = 10; break;
        }
      }
    }

    // Continuous bullet hell
    if (attacks.includes('bullet_hell')) {
      this.bulletHellAngle += dt * 2;
      if (Math.floor(this.bulletHellAngle * 5) !== Math.floor((this.bulletHellAngle - dt * 2) * 5)) {
        this.fireBulletHell();
      }
    }

    // Laser sweep
    if (attacks.includes('laser_sweep')) {
      this.laserAngle += dt * 0.5;
    }
  }

  executeAttack(attack, player) {
    switch (attack) {
      case 'charge':
        this.chargeAt(player);
        break;
      case 'spawn_minions':
        this.spawnMinions();
        break;
      case 'bullet_hell':
        break;
      case 'laser_sweep':
        break;
      case 'teleport':
        this.teleportNear(player);
        break;
    }
  }

  chargeAt(player) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
      this.chargeDir = { x: dx / dist, y: dy / dist };
      this.isCharging = true;
      this.chargeTimer = 1.5;
      Engine.addScreenShake(0.5);
    }
  }

  spawnMinions() {
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const x = this.x + Math.cos(angle) * 80;
      const y = this.y + Math.sin(angle) * 80;
      const minion = new Enemy(x, y, ENEMY_TYPES.grunt, Engine.matchTime);
      Engine.enemies.push(minion);
    }
    Engine.addFloatingText(this.x, this.y - 50, 'MINIONS!', '#ff4444', 1.5);
  }

  fireBulletHell() {
    const bullets = 10;
    for (let i = 0; i < bullets; i++) {
      const angle = this.bulletHellAngle + (i / bullets) * Math.PI * 2;
      const proj = new EnemyProjectile(
        this.x, this.y,
        Math.cos(angle) * 150,
        Math.sin(angle) * 150,
        this.damage * 0.5,
        '#ff0000'
      );
      Engine.enemyProjectiles.push(proj);
    }
  }

  teleportNear(player) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 150;
    this.x = player.x + Math.cos(angle) * dist;
    this.y = player.y + Math.sin(angle) * dist;
    this.x = Math.max(this.size, Math.min(Engine.worldWidth - this.size, this.x));
    this.y = Math.max(this.size, Math.min(Engine.worldHeight - this.size, this.y));

    // Teleport effect
    for (let i = 0; i < 15; i++) {
      Engine.particles.push(new Particle(
        this.x, this.y,
        (Math.random() - 0.5) * 200,
        (Math.random() - 0.5) * 200,
        '#aa00ff', 0.5, 5
      ));
    }
  }

  takeDamage(amount) {
    this.hp -= amount;
    this.hitFlash = 0.05;
  }

  draw(ctx) {
    // Spawn effect
    if (this.spawnEffect > 0) {
      ctx.globalAlpha = this.spawnEffect / 2;
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * (2 - this.spawnEffect), 0, Math.PI * 2);
      ctx.stroke();
    }

    // Hit flash
    if (this.hitFlash > 0) {
      ctx.globalAlpha = 0.7;
    }

    // Boss glow
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 25;

    Assets.drawAnim(ctx, this.sprite, this.x, this.y, this.animTime, !this.facingRight, this.size / 64);

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // Laser sweep
    if (this.phases[this.currentPhase].attacks.includes('laser_sweep')) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.laserAngle);
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
      ctx.lineWidth = 6;
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(600, 0);
      ctx.stroke();
      ctx.restore();
      ctx.shadowBlur = 0;
    }
  }
}
