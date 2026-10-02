// effects.js - Visual effects

class Particle {
  constructor(x, y, vx, vy, color, lifetime, size) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.lifetime = lifetime;
    this.maxLifetime = lifetime;
    this.size = size;
    this.dead = false;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.98;
    this.vy *= 0.98;
    this.lifetime -= dt;

    if (this.lifetime <= 0) {
      this.dead = true;
    }
  }

  draw(ctx) {
    const alpha = this.lifetime / this.maxLifetime;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

class HitEffect {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.lifetime = 0.2;
    this.maxLifetime = 0.2;
    this.dead = false;
  }

  update(dt) {
    this.lifetime -= dt;
    if (this.lifetime <= 0) {
      this.dead = true;
    }
  }

  draw(ctx) {
    const progress = 1 - this.lifetime / this.maxLifetime;
    const size = 20 * progress;
    ctx.globalAlpha = 1 - progress;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

class ExplosionEffect {
  constructor(x, y, radius) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.lifetime = 0.4;
    this.maxLifetime = 0.4;
    this.dead = false;
  }

  update(dt) {
    this.lifetime -= dt;
    if (this.lifetime <= 0) {
      this.dead = true;
    }
  }

  draw(ctx) {
    const progress = 1 - this.lifetime / this.maxLifetime;
    const currentRadius = this.radius * progress;

    // Outer ring
    ctx.globalAlpha = (1 - progress) * 0.5;
    ctx.strokeStyle = '#ff8800';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner fill
    ctx.globalAlpha = (1 - progress) * 0.3;
    ctx.fillStyle = '#ff4400';
    ctx.beginPath();
    ctx.arc(this.x, this.y, currentRadius * 0.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
  }
}

class DamageNumber {
  constructor(x, y, damage, isCrit) {
    this.x = x;
    this.y = y;
    this.damage = damage;
    this.isCrit = isCrit;
    this.lifetime = 1;
    this.maxLifetime = 1;
    this.vy = -80;
    this.dead = false;
  }

  update(dt) {
    this.y += this.vy * dt;
    this.vy *= 0.95;
    this.lifetime -= dt;

    if (this.lifetime <= 0) {
      this.dead = true;
    }
  }

  draw(ctx) {
    const alpha = this.lifetime / this.maxLifetime;
    ctx.globalAlpha = alpha;

    if (this.isCrit) {
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 20px Courier New';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Courier New';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
    }

    ctx.textAlign = 'center';
    ctx.strokeText(this.damage.toString(), this.x, this.y);
    ctx.fillText(this.damage.toString(), this.x, this.y);

    ctx.globalAlpha = 1;
  }
}

class FloatingText {
  constructor(x, y, text, color, scale) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.scale = scale || 1;
    this.lifetime = 2;
    this.maxLifetime = 2;
    this.vy = -40;
    this.dead = false;
  }

  update(dt) {
    this.y += this.vy * dt;
    this.vy *= 0.98;
    this.lifetime -= dt;

    if (this.lifetime <= 0) {
      this.dead = true;
    }
  }

  draw(ctx) {
    const alpha = Math.min(1, this.lifetime / (this.maxLifetime * 0.5));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.font = `bold ${Math.floor(16 * this.scale)}px Courier New`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillText(this.text, this.x, this.y);
    ctx.globalAlpha = 1;
  }
}
