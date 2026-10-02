// weapons.js - Projectile and weapon systems

class Projectile {
  constructor(x, y, vx, vy, weapon, owner) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.weapon = weapon;
    this.owner = owner;
    this.size = weapon.size;
    this.color = weapon.color;
    this.damage = weapon.damage;
    this.piercing = weapon.piercing + owner.pierceBonus;
    this.lifetime = weapon.projectileLifetime;
    this.dead = false;
    this.trail = [];
    this.hitEnemies = new Set();
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.lifetime -= dt;

    // Trail
    this.trail.push({ x: this.x, y: this.y, alpha: 1 });
    if (this.trail.length > 5) this.trail.shift();
    for (const t of this.trail) {
      t.alpha -= dt * 3;
    }

    // Check bounds
    if (this.x < 0 || this.x > Engine.worldWidth ||
        this.y < 0 || this.y > Engine.worldHeight ||
        this.lifetime <= 0) {
      this.dead = true;
      return;
    }

    // Check collision with enemies
    for (const enemy of Engine.enemies) {
      if (enemy.hp <= 0 || this.hitEnemies.has(enemy)) continue;

      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      const distSq = dx * dx + dy * dy;
      const hitDist = (enemy.size / 2 + this.size / 2);

      if (distSq < hitDist * hitDist) {
        this.hitEnemies.add(enemy);
        this.owner.damageEnemy(enemy, this.weapon);

        if (this.piercing > 0) {
          this.piercing--;
        } else {
          this.dead = true;
        }
        break;
      }
    }
  }

  draw(ctx) {
    // Trail
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      if (t.alpha <= 0) continue;
      ctx.globalAlpha = t.alpha * 0.5;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(t.x, t.y, this.size / 2 * t.alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Projectile
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
    ctx.fill();

    // Glow
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

class EnemyProjectile {
  constructor(x, y, vx, vy, damage, color) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.color = color;
    this.size = 8;
    this.lifetime = 3;
    this.dead = false;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.lifetime -= dt;

    if (this.lifetime <= 0 ||
        this.x < 0 || this.x > Engine.worldWidth ||
        this.y < 0 || this.y > Engine.worldHeight) {
      this.dead = true;
      return;
    }

    // Check collision with player
    const player = Engine.player;
    if (player) {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const distSq = dx * dx + dy * dy;
      const hitDist = (player.size / 2 + this.size / 2);

      if (distSq < hitDist * hitDist) {
        player.takeDamage(this.damage);
        this.dead = true;
      }
    }
  }

  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

class XPGem {
  constructor(x, y, value) {
    this.x = x;
    this.y = y;
    this.value = value;
    this.size = 8;
    this.collected = false;
    this.animTime = Math.random() * 10;
    this.vx = (Math.random() - 0.5) * 50;
    this.vy = (Math.random() - 0.5) * 50;
    this.magnetSpeed = 0;
  }

  update(dt) {
    this.animTime += dt;

    const player = Engine.player;
    if (!player) return;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Magnet effect
    if (dist < player.magnetRange) {
      this.magnetSpeed = 300 * (1 - dist / player.magnetRange);
      this.x += (dx / dist) * this.magnetSpeed * dt;
      this.y += (dy / dist) * this.magnetSpeed * dt;
    } else {
      // Drift
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vx *= 0.95;
      this.vy *= 0.95;
    }

    // Collect
    if (dist < (player.size / 2 + this.size)) {
      player.gainXP(this.value);
      this.collected = true;

      // XP effect
      Engine.addFloatingText(this.x, this.y - 10, `+${this.value} XP`, '#44ff44', 0.8);
    }
  }

  draw(ctx) {
    const bob = Math.sin(this.animTime * 3) * 3;
    Assets.drawAnim(ctx, 'xp_gem', this.x, this.y + bob, this.animTime, false, 0.8);
  }
}
