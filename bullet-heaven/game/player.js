// player.js - Player class

class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.size = 24;
    this.speed = 200;
    this.maxHp = 100;
    this.hp = this.maxHp;
    this.level = 1;
    this.xp = 0;
    this.xpToNext = XP_CURVE(1);

    // Multipliers
    this.damageMultiplier = 1;
    this.fireRateMultiplier = 1;
    this.speedMultiplier = 1;
    this.xpMultiplier = 1;
    this.magnetRange = 80;
    this.critChance = 0.05;
    this.critMultiplier = 2;
    this.armorMultiplier = 1;
    this.regenRate = 0;
    this.projectileSpeedMultiplier = 1;
    this.multishot = 0;
    this.explosionMultiplier = 1;
    this.pierceBonus = 0;

    // Weapons
    this.weapons = [];
    this.addWeapon('blaster');

    // Animation
    this.animTime = 0;
    this.facingRight = true;
    this.moving = false;

    // Invulnerability frames
    this.invulnerable = 0;

    // Regen timer
    this.regenTimer = 0;
  }

  addWeapon(weaponId) {
    const weaponData = WEAPONS[weaponId];
    if (!weaponData) return;

    const weapon = {
      ...weaponData,
      level: 1,
      cooldown: 0,
      orbitAngle: 0,
    };
    this.weapons.push(weapon);
  }

  update(dt) {
    this.animTime += dt;

    // Movement
    const input = Input.getMovement();
    this.moving = input.x !== 0 || input.y !== 0;

    if (this.moving) {
      const len = Math.sqrt(input.x * input.x + input.y * input.y);
      const nx = input.x / len;
      const ny = input.y / len;

      this.x += nx * this.speed * this.speedMultiplier * dt;
      this.y += ny * this.speed * this.speedMultiplier * dt;

      if (nx !== 0) this.facingRight = nx > 0;
    }

    // Clamp to world
    this.x = Math.max(this.size, Math.min(Engine.worldWidth - this.size, this.x));
    this.y = Math.max(this.size, Math.min(Engine.worldHeight - this.size, this.y));

    // Invulnerability
    if (this.invulnerable > 0) {
      this.invulnerable -= dt;
    }

    // Regeneration
    if (this.regenRate > 0) {
      this.regenTimer += dt;
      if (this.regenTimer >= 1) {
        this.regenTimer -= 1;
        this.hp = Math.min(this.hp + this.regenRate, this.maxHp);
      }
    }

    // Update weapons
    for (const weapon of this.weapons) {
      this.updateWeapon(weapon, dt);
    }
  }

  updateWeapon(weapon, dt) {
    weapon.cooldown -= dt;

    if (weapon.isOrbiting) {
      // Orbiting blades
      weapon.orbitAngle += weapon.orbitSpeed * dt;
      this.checkOrbitingDamage(weapon);
      return;
    }

    if (weapon.cooldown <= 0) {
      this.fireWeapon(weapon);
      weapon.cooldown = 1 / (weapon.fireRate * this.fireRateMultiplier);
    }
  }

  fireWeapon(weapon) {
    const target = Engine.findNearestEnemy(this.x, this.y, 600);
    if (!target) return;

    const baseAngle = Math.atan2(target.y - this.y, target.x - this.x);
    const totalSpread = weapon.spread * (weapon.projectileCount - 1);
    const startAngle = baseAngle - totalSpread / 2;

    for (let i = 0; i < weapon.projectileCount + this.multishot; i++) {
      const angle = startAngle + (weapon.spread * i);
      const proj = new Projectile(
        this.x, this.y,
        Math.cos(angle) * weapon.projectileSpeed * this.projectileSpeedMultiplier,
        Math.sin(angle) * weapon.projectileSpeed * this.projectileSpeedMultiplier,
        weapon,
        this
      );
      Engine.projectiles.push(proj);
    }

    // Muzzle flash
    Engine.addHitSpark(
      this.x + Math.cos(baseAngle) * 20,
      this.y + Math.sin(baseAngle) * 20,
      weapon.color
    );
  }

  checkOrbitingDamage(weapon) {
    const blades = weapon.projectileCount + this.multishot;
    for (let i = 0; i < blades; i++) {
      const angle = weapon.orbitAngle + (i / blades) * Math.PI * 2;
      const bx = this.x + Math.cos(angle) * weapon.orbitRadius;
      const by = this.y + Math.sin(angle) * weapon.orbitRadius;

      for (const enemy of Engine.enemies) {
        if (enemy.hp <= 0) continue;
        const dx = enemy.x - bx;
        const dy = enemy.y - by;
        if (dx * dx + dy * dy < (enemy.size / 2 + weapon.size) * (enemy.size / 2 + weapon.size)) {
          this.damageEnemy(enemy, weapon);
        }
      }
    }
  }

  damageEnemy(enemy, weapon) {
    let damage = weapon.damage * this.damageMultiplier;

    // Critical hit
    const isCrit = Math.random() < (weapon.critChance + this.critChance);
    if (isCrit) {
      damage *= (weapon.critMultiplier + this.critMultiplier);
    }

    damage = Math.floor(damage);
    enemy.takeDamage(damage);
    Engine.damageDealt += damage;

    // Damage number
    Engine.addDamageNumber(
      enemy.x + (Math.random() - 0.5) * 20,
      enemy.y - enemy.size / 2 - 10,
      damage,
      isCrit
    );

    // Hit spark
    Engine.addHitSpark(enemy.x, enemy.y, weapon.color);

    // Area damage
    if (weapon.areaDamage > 0) {
      const areaRadius = weapon.areaDamage * this.explosionMultiplier;
      const enemiesInRange = Engine.getEnemiesInRange(enemy.x, enemy.y, areaRadius);
      for (const e of enemiesInRange) {
        if (e !== enemy && e.hp > 0) {
          const areaDmg = Math.floor(damage * 0.5);
          e.takeDamage(areaDmg);
          Engine.addDamageNumber(e.x, e.y - e.size / 2 - 10, areaDmg, false);
        }
      }
      Engine.addExplosion(enemy.x, enemy.y, areaRadius, weapon.color);
    }
  }

  takeDamage(amount) {
    if (this.invulnerable > 0) return;

    const actualDamage = Math.floor(amount * this.armorMultiplier);
    this.hp -= actualDamage;
    this.invulnerable = 0.5;

    Engine.addScreenShake(0.3);
    Engine.addFloatingText(this.x, this.y - 30, `-${actualDamage}`, '#ff4444', 1);
  }

  gainXP(amount) {
    const actualAmount = Math.floor(amount * this.xpMultiplier);
    this.xp += actualAmount;

    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = XP_CURVE(this.level);
      this.onLevelUp();
    }
  }

  onLevelUp() {
    Engine.state = 'levelup';
    Engine.paused = true;
    UI.showLevelUp();

    // Level up effect
    Engine.addFloatingText(this.x, this.y - 40, 'LEVEL UP!', '#ffd700', 2);
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      Engine.particles.push(new Particle(
        this.x, this.y,
        Math.cos(angle) * 150,
        Math.sin(angle) * 150,
        '#ffd700', 0.8, 4
      ));
    }
  }

  applyUpgrade(upgradeId) {
    const upgrade = UPGRADES[upgradeId];
    if (!upgrade) return;

    upgrade.apply(this);

    // Check for evolutions
    this.checkEvolutions();
  }

  checkEvolutions() {
    for (const weapon of this.weapons) {
      if (weapon.evolution) continue;

      for (const [evoKey, evoData] of Object.entries(EVOLUTIONS)) {
        const [weaponId, upgradeId] = evoKey.split('+');
        if (weapon.id === weaponId) {
          // Check if player has the required upgrade at level > 0
          const hasUpgrade = (this.upgradeLevels && this.upgradeLevels[upgradeId] > 0);
          if (hasUpgrade) {
            // Evolve weapon
            const evoIndex = this.weapons.indexOf(weapon);
            this.weapons[evoIndex] = {
              ...evoData,
              level: 1,
              cooldown: 0,
              orbitAngle: 0,
            };
            Engine.addFloatingText(this.x, this.y - 60, `${evoData.name}!`, '#ff00ff', 2);
            Engine.addScreenShake(1);
            Engine.addCameraPunch(0.5);

            // Evolution particles
            for (let i = 0; i < 20; i++) {
              const angle = (i / 20) * Math.PI * 2;
              Engine.particles.push(new Particle(
                this.x, this.y,
                Math.cos(angle) * 150,
                Math.sin(angle) * 150,
                '#ff00ff', 0.8, 5
              ));
            }
          }
        }
      }
    }
  }

  draw(ctx) {
    // Draw player sprite
    const sprite = this.moving ? 'player_run' : 'player_idle';
    const flip = !this.facingRight;

    // Invulnerability flash
    if (this.invulnerable > 0 && Math.floor(this.invulnerable * 10) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }

    Assets.drawAnim(ctx, sprite, this.x, this.y, this.animTime, flip, 0.75);

    ctx.globalAlpha = 1;

    // Draw orbiting blades
    for (const weapon of this.weapons) {
      if (weapon.isOrbiting) {
        const blades = weapon.projectileCount + this.multishot;
        for (let i = 0; i < blades; i++) {
          const angle = weapon.orbitAngle + (i / blades) * Math.PI * 2;
          const bx = this.x + Math.cos(angle) * weapon.orbitRadius;
          const by = this.y + Math.sin(angle) * weapon.orbitRadius;

          ctx.fillStyle = weapon.color;
          ctx.beginPath();
          ctx.arc(bx, by, weapon.size / 2, 0, Math.PI * 2);
          ctx.fill();

          // Blade trail
          ctx.strokeStyle = weapon.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(this.x, this.y, weapon.orbitRadius, angle - 0.3, angle);
          ctx.stroke();
        }
      }
    }
  }

  getStats() {
    return {
      level: this.level,
      xp: this.xp,
      xpToNext: this.xpToNext,
      hp: this.hp,
      maxHp: this.maxHp,
      weapons: this.weapons.map(w => ({ id: w.id, level: w.level })),
    };
  }
}
