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
    this.isElite = Math.random() < DIFFICULTY_SCALING.eliteChance(gameTime);
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
  }

  update(dt) {
    this.animTime += dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;

    const player = Engine.player;
    if (!player) return;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      this.facingRight = dx > 0;
    }

    switch (this.behavior) {
      case 'chase':
        this.moveToward(player.x, player.y, dt);
        break;
      case 'ranged':
        this.updateRanged(dt, player, dist);
        break;
      case 'swarm':
        this.updateSwarm(dt, player, dist);
        break;
    }

    // Separation from other enemies
    if (this.behavior === 'swarm') {
      this.applySeparation(dt);
    }

    // Clamp to world
    this.x = Math.max(this.size, Math.min(Engine.worldWidth - this.size, this.x));
    this.y = Math.max(this.size, Math.min(Engine.worldHeight - this.size, this.y));

    // Attack player on contact
    if (dist < (this.size + player.size) / 2) {
      player.takeDamage(this.damage);
    }
  }

  moveToward(tx, ty, dt) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
      this.x += (dx / dist) * this.speed * dt;
      this.y += (dy / dist) * this.speed * dt;
    }
  }

  updateRanged(dt, player, dist) {
    this.attackTimer -= dt;

    if (dist > this.attackRange) {
      // Move toward player
      this.moveToward(player.x, player.y, dt);
    } else if (dist < this.attackRange * 0.6) {
      // Back away
      const dx = this.x - player.x;
      const dy = this.y - player.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0) {
        this.x += (dx / d) * this.speed * 0.5 * dt;
        this.y += (dy / d) * this.speed * 0.5 * dt;
      }
    }

    // Shoot
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

  updateSwarm(dt, player, dist) {
    // Swarm enemies move toward player but with some randomness
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 0) {
      const wobble = Math.sin(this.animTime * 5) * 0.3;
      const nx = dx / d + wobble * (dy / d);
      const ny = dy / d - wobble * (dx / d);
      const nl = Math.sqrt(nx * nx + ny * ny);
      this.x += (nx / nl) * this.speed * dt;
      this.y += (ny / nl) * this.speed * dt;
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

  takeDamage(amount) {
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
      ctx.shadowBlur = 15;
    }

    Assets.drawAnim(ctx, this.sprite, this.x, this.y, this.animTime, !this.facingRight, this.size / 32);

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // Health bar for elites and tanks
    if (this.isElite || this.type.id === 'tank') {
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
      // Move toward player slowly
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
        // Set cooldown based on attack type
        switch (attack) {
          case 'charge': this.attackTimers[attack] = 5; break;
          case 'spawn_minions': this.attackTimers[attack] = 8; break;
          case 'bullet_hell': this.attackTimers[attack] = 3; break;
          case 'laser_sweep': this.attackTimers[attack] = 6; break;
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
        // Handled continuously
        break;
      case 'laser_sweep':
        // Handled continuously
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
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const x = this.x + Math.cos(angle) * 80;
      const y = this.y + Math.sin(angle) * 80;
      const minion = new Enemy(x, y, ENEMY_TYPES.grunt, Engine.matchTime);
      Engine.enemies.push(minion);
    }
    Engine.addFloatingText(this.x, this.y - 50, 'MINIONS!', '#ff4444', 1.5);
  }

  fireBulletHell() {
    const bullets = 8;
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
    ctx.shadowBlur = 20;

    Assets.drawAnim(ctx, this.sprite, this.x, this.y, this.animTime, !this.facingRight, this.size / 64);

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // Laser sweep
    if (this.phases[this.currentPhase].attacks.includes('laser_sweep')) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.laserAngle);
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(500, 0);
      ctx.stroke();
      ctx.restore();
    }
  }
}
