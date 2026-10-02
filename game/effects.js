// effects.js - Visual effects with neon/cyberpunk aesthetic
// All glow effects use additive blending (globalCompositeOperation = 'lighter')

// ─────────────────────────────────────────────────────────────────────────────
// Particle - Base particle with multi-layer glow, trails, and additive blending
// ─────────────────────────────────────────────────────────────────────────────
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

    // Trail history
    this.trail = [];
    this.maxTrail = 8;

    // Physics
    this.drag = 0.96;
    this.gravity = 0;

    // Visual
    this.glowSize = size * 3;
    this.colorRGB = this.hexToRGB(color);
  }

  hexToRGB(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
  }

  update(dt) {
    // Store trail position
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > this.maxTrail) {
      this.trail.shift();
    }

    // Physics
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= this.drag;
    this.vy *= this.drag;
    this.vy += this.gravity * dt;

    this.lifetime -= dt;
    if (this.lifetime <= 0) {
      this.dead = true;
    }
  }

  draw(ctx) {
    const alpha = this.lifetime / this.maxLifetime;
    const rgb = this.colorRGB;

    // Draw trail with additive blending
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      const trailAlpha = (i / this.trail.length) * alpha * 0.5;
      const trailSize = this.size * (i / this.trail.length) * 0.8;

      ctx.globalAlpha = trailAlpha;
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},1)`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, trailSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw outer glow
    ctx.globalAlpha = alpha * 0.2;
    ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},1)`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.glowSize * alpha, 0, Math.PI * 2);
    ctx.fill();

    // Draw mid glow
    ctx.globalAlpha = alpha * 0.4;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.glowSize * 0.6 * alpha, 0, Math.PI * 2);
    ctx.fill();

    // Draw core
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},1)`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
    ctx.fill();

    // Draw bright center
    ctx.globalAlpha = alpha * 0.9;
    ctx.fillStyle = `rgba(255,255,255,1)`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * alpha * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HitEffect - Shockwave rings with sparks on hit
// ─────────────────────────────────────────────────────────────────────────────
class HitEffect {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color || '#ffffff';
    this.lifetime = 0.35;
    this.maxLifetime = 0.35;
    this.dead = false;

    // Shockwave rings
    this.rings = [];
    const ringCount = 3;
    for (let i = 0; i < ringCount; i++) {
      this.rings.push({
        radius: 0,
        maxRadius: 30 + i * 15,
        delay: i * 0.05,
        alpha: 1 - i * 0.2
      });
    }

    // Spark particles
    this.sparks = [];
    const sparkCount = 8;
    for (let i = 0; i < sparkCount; i++) {
      const angle = (i / sparkCount) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 100 + Math.random() * 150;
      this.sparks.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 2,
        lifetime: 0.2 + Math.random() * 0.15,
        maxLifetime: 0.35
      });
    }

    this.colorRGB = this.hexToRGB(this.color);
  }

  hexToRGB(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
  }

  update(dt) {
    this.lifetime -= dt;

    // Update rings
    for (const ring of this.rings) {
      if (ring.delay > 0) {
        ring.delay -= dt;
      } else {
        const progress = 1 - (this.lifetime / this.maxLifetime);
        ring.radius = ring.maxRadius * progress;
        ring.alpha = (1 - progress) * 0.8;
      }
    }

    // Update sparks
    for (const spark of this.sparks) {
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.vx *= 0.92;
      spark.vy *= 0.92;
      spark.lifetime -= dt;
    }

    if (this.lifetime <= 0) {
      this.dead = true;
    }
  }

  draw(ctx) {
    const rgb = this.colorRGB;
    ctx.globalCompositeOperation = 'lighter';

    // Draw shockwave rings
    for (const ring of this.rings) {
      if (ring.radius > 0 && ring.alpha > 0) {
        // Outer glow
        ctx.globalAlpha = ring.alpha * 0.3;
        ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},1)`;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(this.x, this.y, ring.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Inner bright ring
        ctx.globalAlpha = ring.alpha;
        ctx.strokeStyle = `rgba(255,255,255,1)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, ring.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Draw sparks
    for (const spark of this.sparks) {
      if (spark.lifetime > 0) {
        const sparkAlpha = spark.lifetime / spark.maxLifetime;
        ctx.globalAlpha = sparkAlpha;
        ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},1)`;
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, spark.size * sparkAlpha, 0, Math.PI * 2);
        ctx.fill();

        // Spark glow
        ctx.globalAlpha = sparkAlpha * 0.4;
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, spark.size * sparkAlpha * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ExplosionEffect - Fireball with smoke and shockwave
// ─────────────────────────────────────────────────────────────────────────────
class ExplosionEffect {
  constructor(x, y, radius, color) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.color = color || '#ff8800';
    this.lifetime = 0.6;
    this.maxLifetime = 0.6;
    this.dead = false;

    // Fireball particles
    this.fireball = [];
    const fireCount = 20;
    for (let i = 0; i < fireCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 200;
      const colors = ['#ff4400', '#ff8800', '#ffcc00', '#ffffff'];
      this.fireball.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 4 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        lifetime: 0.3 + Math.random() * 0.3,
        maxLifetime: 0.6
      });
    }

    // Smoke particles
    this.smoke = [];
    const smokeCount = 12;
    for (let i = 0; i < smokeCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 60;
      this.smoke.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        size: 10 + Math.random() * 15,
        lifetime: 0.5 + Math.random() * 0.4,
        maxLifetime: 0.9
      });
    }

    // Shockwave ring
    this.shockwave = {
      radius: 0,
      maxRadius: radius * 1.5,
      alpha: 1
    };

    // Flash
    this.flash = {
      radius: radius * 0.8,
      alpha: 1
    };

    this.colorRGB = this.hexToRGB(this.color);
  }

  hexToRGB(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 136, b: 0 };
  }

  update(dt) {
    this.lifetime -= dt;
    const progress = 1 - this.lifetime / this.maxLifetime;

    // Update fireball
    for (const p of this.fireball) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.lifetime -= dt;
    }

    // Update smoke
    for (const p of this.smoke) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.size += dt * 15;
      p.lifetime -= dt;
    }

    // Update shockwave
    this.shockwave.radius = this.shockwave.maxRadius * progress;
    this.shockwave.alpha = (1 - progress) * 0.6;

    // Update flash
    this.flash.alpha = Math.max(0, 1 - progress * 3);

    if (this.lifetime <= 0) {
      this.dead = true;
    }
  }

  draw(ctx) {
    const rgb = this.colorRGB;
    const progress = 1 - this.lifetime / this.maxLifetime;

    ctx.globalCompositeOperation = 'lighter';

    // Draw flash
    if (this.flash.alpha > 0) {
      const gradient = ctx.createRadialGradient(
        this.x, this.y, 0,
        this.x, this.y, this.flash.radius
      );
      gradient.addColorStop(0, `rgba(255,255,255,${this.flash.alpha})`);
      gradient.addColorStop(0.3, `rgba(${rgb.r},${rgb.g},${rgb.b},${this.flash.alpha * 0.5})`);
      gradient.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);

      ctx.globalAlpha = 1;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.flash.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw shockwave
    if (this.shockwave.alpha > 0) {
      ctx.globalAlpha = this.shockwave.alpha * 0.4;
      ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},1)`;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.shockwave.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = this.shockwave.alpha;
      ctx.strokeStyle = `rgba(255,255,255,1)`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.shockwave.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw fireball particles
    for (const p of this.fireball) {
      if (p.lifetime > 0) {
        const alpha = p.lifetime / p.maxLifetime;
        const pRGB = this.hexToRGB(p.color);

        // Glow
        ctx.globalAlpha = alpha * 0.3;
        ctx.fillStyle = `rgba(${pRGB.r},${pRGB.g},${pRGB.b},1)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2.5 * alpha, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.globalAlpha = alpha;
        ctx.fillStyle = `rgba(${pRGB.r},${pRGB.g},${pRGB.b},1)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw smoke (uses source-over for contrast)
    ctx.globalCompositeOperation = 'source-over';
    for (const p of this.smoke) {
      if (p.lifetime > 0) {
        const alpha = (p.lifetime / p.maxLifetime) * 0.4;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = `rgba(80,80,80,1)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DamageNumber - Pop animation with crit styling
// ─────────────────────────────────────────────────────────────────────────────
class DamageNumber {
  constructor(x, y, damage, isCrit) {
    this.x = x;
    this.y = y;
    this.damage = damage;
    this.isCrit = isCrit;
    this.lifetime = 1.0;
    this.maxLifetime = 1.0;
    this.vy = -120;
    this.vx = (Math.random() - 0.5) * 40;
    this.dead = false;

    // Animation
    this.popScale = 0;
    this.popProgress = 0;
    this.baseSize = isCrit ? 24 : 16;
    this.critColor = '#ffd700';
    this.normalColor = '#ffffff';
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy *= 0.92;
    this.vx *= 0.95;

    // Pop animation
    this.popProgress += dt * 6;
    if (this.popProgress < 1) {
      // Overshoot pop
      this.popScale = 1 + Math.sin(this.popProgress * Math.PI) * 0.5;
    } else {
      this.popScale = 1;
    }

    this.lifetime -= dt;
    if (this.lifetime <= 0) {
      this.dead = true;
    }
  }

  draw(ctx) {
    const alpha = Math.min(1, this.lifetime / (this.maxLifetime * 0.4));
    const scale = this.popScale;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(scale, scale);

    if (this.isCrit) {
      // Crit styling with glow
      ctx.globalCompositeOperation = 'lighter';

      // Outer glow
      ctx.globalAlpha = alpha * 0.4;
      ctx.fillStyle = this.critColor;
      ctx.font = `bold ${this.baseSize}px "Courier New", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(this.damage.toString(), 2, 2);

      // Main text
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.critColor;
      ctx.fillText(this.damage.toString(), 0, 0);

      // Bright center
      ctx.globalAlpha = alpha * 0.7;
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${this.baseSize * 0.85}px "Courier New", monospace`;
      ctx.fillText(this.damage.toString(), 0, 0);

      // "CRIT" label
      ctx.globalAlpha = alpha * 0.8;
      ctx.fillStyle = '#ff4444';
      ctx.font = `bold ${this.baseSize * 0.5}px "Courier New", monospace`;
      ctx.fillText('CRIT!', 0, -this.baseSize * 0.8);
    } else {
      // Normal damage
      ctx.globalCompositeOperation = 'lighter';

      // Glow
      ctx.globalAlpha = alpha * 0.3;
      ctx.fillStyle = this.normalColor;
      ctx.font = `bold ${this.baseSize}px "Courier New", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(this.damage.toString(), 1, 1);

      // Main text
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.normalColor;
      ctx.fillText(this.damage.toString(), 0, 0);
    }

    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FloatingText - Glowing text that floats upward
// ─────────────────────────────────────────────────────────────────────────────
class FloatingText {
  constructor(x, y, text, color, scale) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color || '#ffffff';
    this.scale = scale || 1;
    this.lifetime = 2.0;
    this.maxLifetime = 2.0;
    this.vy = -50;
    this.vx = (Math.random() - 0.5) * 20;
    this.dead = false;

    this.baseSize = Math.floor(18 * this.scale);
    this.colorRGB = this.hexToRGB(this.color);
  }

  hexToRGB(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy *= 0.97;
    this.vx *= 0.98;

    this.lifetime -= dt;
    if (this.lifetime <= 0) {
      this.dead = true;
    }
  }

  draw(ctx) {
    const alpha = Math.min(1, this.lifetime / (this.maxLifetime * 0.5));
    const rgb = this.colorRGB;

    ctx.globalCompositeOperation = 'lighter';

    // Outer glow layers
    for (let i = 3; i >= 1; i--) {
      ctx.globalAlpha = alpha * 0.15;
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},1)`;
      ctx.font = `bold ${this.baseSize + i * 2}px "Courier New", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(this.text, this.x, this.y);
    }

    // Main text
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},1)`;
    ctx.font = `bold ${this.baseSize}px "Courier New", monospace`;
    ctx.fillText(this.text, this.x, this.y);

    // Bright center
    ctx.globalAlpha = alpha * 0.6;
    ctx.fillStyle = `rgba(255,255,255,1)`;
    ctx.font = `bold ${this.baseSize * 0.9}px "Courier New", monospace`;
    ctx.fillText(this.text, this.x, this.y);

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MuzzleFlash - Bright flash when weapons fire
// ─────────────────────────────────────────────────────────────────────────────
class MuzzleFlash {
  constructor(x, y, angle, color) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.color = color || '#ffff00';
    this.lifetime = 0.12;
    this.maxLifetime = 0.12;
    this.dead = false;

    // Flash rays
    this.rays = [];
    const rayCount = 6;
    for (let i = 0; i < rayCount; i++) {
      const rayAngle = angle + (Math.random() - 0.5) * 0.8;
      const length = 15 + Math.random() * 25;
      this.rays.push({
        angle: rayAngle,
        length: length,
        width: 2 + Math.random() * 3
      });
    }

    // Core flash
    this.coreRadius = 12;

    // Particles
    this.particles = [];
    for (let i = 0; i < 4; i++) {
      const pAngle = angle + (Math.random() - 0.5) * 1.2;
      const speed = 80 + Math.random() * 120;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(pAngle) * speed,
        vy: Math.sin(pAngle) * speed,
        size: 2 + Math.random() * 2,
        lifetime: 0.08 + Math.random() * 0.06,
        maxLifetime: 0.14
      });
    }

    this.colorRGB = this.hexToRGB(this.color);
  }

  hexToRGB(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 0 };
  }

  update(dt) {
    this.lifetime -= dt;

    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.9;
      p.vy *= 0.9;
      p.lifetime -= dt;
    }

    if (this.lifetime <= 0) {
      this.dead = true;
    }
  }

  draw(ctx) {
    const progress = 1 - this.lifetime / this.maxLifetime;
    const alpha = 1 - progress;
    const rgb = this.colorRGB;

    ctx.globalCompositeOperation = 'lighter';

    // Draw rays
    for (const ray of this.rays) {
      const rayLength = ray.length * (1 - progress * 0.5);
      const endX = this.x + Math.cos(ray.angle) * rayLength;
      const endY = this.y + Math.sin(ray.angle) * rayLength;

      ctx.globalAlpha = alpha * 0.6;
      ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},1)`;
      ctx.lineWidth = ray.width * (1 - progress);
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }

    // Draw core flash
    const coreSize = this.coreRadius * (1 - progress * 0.5);
    const gradient = ctx.createRadialGradient(
      this.x, this.y, 0,
      this.x, this.y, coreSize
    );
    gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
    gradient.addColorStop(0.4, `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha * 0.8})`);
    gradient.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);

    ctx.globalAlpha = 1;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.x, this.y, coreSize, 0, Math.PI * 2);
    ctx.fill();

    // Draw particles
    for (const p of this.particles) {
      if (p.lifetime > 0) {
        const pAlpha = p.lifetime / p.maxLifetime;
        ctx.globalAlpha = pAlpha;
        ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},1)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * pAlpha, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TrailEffect - Projectile trail with fading glow
// ─────────────────────────────────────────────────────────────────────────────
class TrailEffect {
  constructor(x, y, color, size) {
    this.x = x;
    this.y = y;
    this.color = color || '#ffffff';
    this.size = size || 6;
    this.lifetime = 0.3;
    this.maxLifetime = 0.3;
    this.dead = false;

    this.trail = [];
    this.maxTrail = 10;

    this.colorRGB = this.hexToRGB(this.color);
  }

  hexToRGB(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
  }

  update(dt) {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > this.maxTrail) {
      this.trail.shift();
    }

    this.lifetime -= dt;
    if (this.lifetime <= 0) {
      this.dead = true;
    }
  }

  draw(ctx) {
    const rgb = this.colorRGB;
    ctx.globalCompositeOperation = 'lighter';

    // Draw trail segments
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      const progress = i / this.trail.length;
      const alpha = progress * 0.5;
      const size = this.size * progress;

      // Glow
      ctx.globalAlpha = alpha * 0.3;
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},1)`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, size * 2, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},1)`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw head glow
    const headAlpha = this.lifetime / this.maxLifetime;
    ctx.globalAlpha = headAlpha * 0.5;
    ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},1)`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ShockwaveEffect - Expanding rings for boss deaths
// ─────────────────────────────────────────────────────────────────────────────
class ShockwaveEffect {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color || '#ff0000';
    this.lifetime = 1.2;
    this.maxLifetime = 1.2;
    this.dead = false;

    // Multiple expanding rings
    this.rings = [];
    const ringCount = 5;
    for (let i = 0; i < ringCount; i++) {
      this.rings.push({
        radius: 0,
        maxRadius: 80 + i * 40,
        delay: i * 0.08,
        alpha: 1,
        lineWidth: 4 - i * 0.5
      });
    }

    // Burst particles
    this.burstParticles = [];
    const burstCount = 40;
    for (let i = 0; i < burstCount; i++) {
      const angle = (i / burstCount) * Math.PI * 2;
      const speed = 150 + Math.random() * 250;
      const colors = ['#ff0000', '#ff4400', '#ff8800', '#ffcc00', '#ffffff'];
      this.burstParticles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        lifetime: 0.6 + Math.random() * 0.6,
        maxLifetime: 1.2
      });
    }

    // Central flash
    this.flashRadius = 60;
    this.flashAlpha = 1;

    this.colorRGB = this.hexToRGB(this.color);
  }

  hexToRGB(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 0, b: 0 };
  }

  update(dt) {
    this.lifetime -= dt;
    const progress = 1 - this.lifetime / this.maxLifetime;

    // Update rings
    for (const ring of this.rings) {
      if (ring.delay > 0) {
        ring.delay -= dt;
      } else {
        const ringProgress = Math.min(1, (progress - ring.delay) / (1 - ring.delay));
        ring.radius = ring.maxRadius * ringProgress;
        ring.alpha = (1 - ringProgress) * 0.7;
      }
    }

    // Update burst particles
    for (const p of this.burstParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.lifetime -= dt;
    }

    // Update flash
    this.flashAlpha = Math.max(0, 1 - progress * 2.5);
    this.flashRadius = 60 + progress * 40;

    if (this.lifetime <= 0) {
      this.dead = true;
    }
  }

  draw(ctx) {
    const rgb = this.colorRGB;
    ctx.globalCompositeOperation = 'lighter';

    // Draw central flash
    if (this.flashAlpha > 0) {
      const gradient = ctx.createRadialGradient(
        this.x, this.y, 0,
        this.x, this.y, this.flashRadius
      );
      gradient.addColorStop(0, `rgba(255,255,255,${this.flashAlpha})`);
      gradient.addColorStop(0.3, `rgba(${rgb.r},${rgb.g},${rgb.b},${this.flashAlpha * 0.6})`);
      gradient.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);

      ctx.globalAlpha = 1;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.flashRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw rings
    for (const ring of this.rings) {
      if (ring.radius > 0 && ring.alpha > 0) {
        // Outer glow
        ctx.globalAlpha = ring.alpha * 0.3;
        ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},1)`;
        ctx.lineWidth = ring.lineWidth * 3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, ring.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Main ring
        ctx.globalAlpha = ring.alpha;
        ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},1)`;
        ctx.lineWidth = ring.lineWidth;
        ctx.beginPath();
        ctx.arc(this.x, this.y, ring.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Inner bright ring
        ctx.globalAlpha = ring.alpha * 0.8;
        ctx.strokeStyle = `rgba(255,255,255,1)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, ring.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Draw burst particles
    for (const p of this.burstParticles) {
      if (p.lifetime > 0) {
        const alpha = p.lifetime / p.maxLifetime;
        const pRGB = this.hexToRGB(p.color);

        // Glow
        ctx.globalAlpha = alpha * 0.4;
        ctx.fillStyle = `rgba(${pRGB.r},${pRGB.g},${pRGB.b},1)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2.5 * alpha, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.globalAlpha = alpha;
        ctx.fillStyle = `rgba(${pRGB.r},${pRGB.g},${pRGB.b},1)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LevelUpEffect - Beam of light with rising particles
// ─────────────────────────────────────────────────────────────────────────────
class LevelUpEffect {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.lifetime = 1.5;
    this.maxLifetime = 1.5;
    this.dead = false;

    // Light beam
    this.beamWidth = 40;
    this.beamAlpha = 1;

    // Rising particles
    this.risingParticles = [];
    const count = 30;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 30;
      const colors = ['#ffd700', '#ffcc00', '#ffffff', '#ffaa00'];
      this.risingParticles.push({
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 30,
        vy: -80 - Math.random() * 120,
        size: 3 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        lifetime: 0.8 + Math.random() * 0.7,
        maxLifetime: 1.5
      });
    }

    // Ground ring
    this.groundRing = {
      radius: 0,
      maxRadius: 60,
      alpha: 1
    };

    // Sparkles
    this.sparkles = [];
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 40;
      this.sparkles.push({
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        size: 2 + Math.random() * 3,
        phase: Math.random() * Math.PI * 2,
        lifetime: 0.5 + Math.random() * 0.5,
        maxLifetime: 1.0
      });
    }
  }

  update(dt) {
    this.lifetime -= dt;
    const progress = 1 - this.lifetime / this.maxLifetime;

    // Update beam
    this.beamAlpha = Math.max(0, 1 - progress * 1.5);
    this.beamWidth = 40 + progress * 20;

    // Update rising particles
    for (const p of this.risingParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy *= 0.98;
      p.lifetime -= dt;
    }

    // Update ground ring
    const ringProgress = Math.min(1, progress * 2);
    this.groundRing.radius = this.groundRing.maxRadius * ringProgress;
    this.groundRing.alpha = (1 - ringProgress) * 0.6;

    // Update sparkles
    for (const s of this.sparkles) {
      s.phase += dt * 5;
      s.lifetime -= dt;
    }

    if (this.lifetime <= 0) {
      this.dead = true;
    }
  }

  draw(ctx) {
    ctx.globalCompositeOperation = 'lighter';

    // Draw light beam
    if (this.beamAlpha > 0) {
      const gradient = ctx.createLinearGradient(
        this.x, this.y - 200,
        this.x, this.y
      );
      gradient.addColorStop(0, `rgba(255,215,0,0)`);
      gradient.addColorStop(0.5, `rgba(255,215,0,${this.beamAlpha * 0.3})`);
      gradient.addColorStop(1, `rgba(255,215,0,${this.beamAlpha * 0.8})`);

      ctx.globalAlpha = 1;
      ctx.fillStyle = gradient;
      ctx.fillRect(
        this.x - this.beamWidth / 2,
        this.y - 200,
        this.beamWidth,
        200
      );

      // Beam core
      const coreGradient = ctx.createLinearGradient(
        this.x, this.y - 200,
        this.x, this.y
      );
      coreGradient.addColorStop(0, `rgba(255,255,255,0)`);
      coreGradient.addColorStop(0.7, `rgba(255,255,255,${this.beamAlpha * 0.4})`);
      coreGradient.addColorStop(1, `rgba(255,255,255,${this.beamAlpha})`);

      ctx.fillStyle = coreGradient;
      ctx.fillRect(
        this.x - this.beamWidth / 4,
        this.y - 200,
        this.beamWidth / 2,
        200
      );
    }

    // Draw ground ring
    if (this.groundRing.alpha > 0) {
      ctx.globalAlpha = this.groundRing.alpha * 0.4;
      ctx.strokeStyle = 'rgba(255,215,0,1)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.groundRing.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = this.groundRing.alpha;
      ctx.strokeStyle = 'rgba(255,255,255,1)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.groundRing.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw rising particles
    for (const p of this.risingParticles) {
      if (p.lifetime > 0) {
        const alpha = p.lifetime / p.maxLifetime;
        const pRGB = this.hexToRGB(p.color);

        // Glow
        ctx.globalAlpha = alpha * 0.4;
        ctx.fillStyle = `rgba(${pRGB.r},${pRGB.g},${pRGB.b},1)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2.5 * alpha, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.globalAlpha = alpha;
        ctx.fillStyle = `rgba(${pRGB.r},${pRGB.g},${pRGB.b},1)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw sparkles
    for (const s of this.sparkles) {
      if (s.lifetime > 0) {
        const alpha = (s.lifetime / s.maxLifetime) * (0.5 + Math.sin(s.phase) * 0.5);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(255,255,255,1)';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  hexToRGB(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 215, b: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ComboText - Kill streak text with scaling
// ─────────────────────────────────────────────────────────────────────────────
class ComboText {
  constructor(x, y, combo) {
    this.x = x;
    this.y = y;
    this.combo = combo;
    this.lifetime = 1.5;
    this.maxLifetime = 1.5;
    this.dead = false;

    // Animation
    this.popScale = 0;
    this.popProgress = 0;
    this.baseSize = 20 + Math.min(combo * 2, 20);

    // Color based on combo
    if (combo >= 20) {
      this.color = '#ff00ff';
    } else if (combo >= 15) {
      this.color = '#ff0000';
    } else if (combo >= 10) {
      this.color = '#ff8800';
    } else if (combo >= 5) {
      this.color = '#ffff00';
    } else {
      this.color = '#ffffff';
    }

    this.colorRGB = this.hexToRGB(this.color);
  }

  hexToRGB(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
  }

  update(dt) {
    this.y -= 30 * dt;

    // Pop animation
    this.popProgress += dt * 5;
    if (this.popProgress < 1) {
      this.popScale = 1 + Math.sin(this.popProgress * Math.PI) * 0.4;
    } else {
      this.popScale = 1;
    }

    this.lifetime -= dt;
    if (this.lifetime <= 0) {
      this.dead = true;
    }
  }

  draw(ctx) {
    const alpha = Math.min(1, this.lifetime / (this.maxLifetime * 0.4));
    const rgb = this.colorRGB;
    const scale = this.popScale;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(scale, scale);

    ctx.globalCompositeOperation = 'lighter';

    // Outer glow layers
    for (let i = 4; i >= 1; i--) {
      ctx.globalAlpha = alpha * 0.12;
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},1)`;
      ctx.font = `bold ${this.baseSize + i * 2}px "Courier New", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`${this.combo}x COMBO!`, 0, 0);
    }

    // Main text
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},1)`;
    ctx.font = `bold ${this.baseSize}px "Courier New", monospace`;
    ctx.fillText(`${this.combo}x COMBO!`, 0, 0);

    // Bright center
    ctx.globalAlpha = alpha * 0.7;
    ctx.fillStyle = `rgba(255,255,255,1)`;
    ctx.font = `bold ${this.baseSize * 0.9}px "Courier New", monospace`;
    ctx.fillText(`${this.combo}x COMBO!`, 0, 0);

    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EffectPool - Object pooling for particles (performance)
// ─────────────────────────────────────────────────────────────────────────────
class EffectPool {
  constructor(size) {
    this.pool = [];
    this.active = [];
    this.size = size || 200;

    for (let i = 0; i < this.size; i++) {
      this.pool.push(null);
    }
  }

  get() {
    if (this.pool.length > 0) {
      return this.pool.pop();
    }
    return null;
  }

  release(obj) {
    if (this.active.length > 0) {
      const index = this.active.indexOf(obj);
      if (index !== -1) {
        this.active.splice(index, 1);
      }
    }
    if (this.pool.length < this.size) {
      this.pool.push(obj);
    }
  }

  clear() {
    while (this.active.length > 0) {
      const obj = this.active.pop();
      if (this.pool.length < this.size) {
        this.pool.push(obj);
      }
    }
  }
}

// Global particle pool
const particlePool = new EffectPool(300);
