// assets.js - Asset loading and animation system

const Assets = {
  images: {},
  loaded: false,
  totalAssets: 0,
  loadedCount: 0,

  definitions: {
    player_idle: { file: 'assets/player_idle.png', frameW: 64, frameH: 64, fps: 8 },
    player_run: { file: 'assets/player_run.png', frameW: 64, frameH: 64, fps: 10 },
    enemy_1_walk: { file: 'assets/enemy_1_walk.png', frameW: 64, frameH: 64, fps: 8 },
    enemy_2_walk: { file: 'assets/enemy_2_walk.png', frameW: 64, frameH: 64, fps: 10 },
    enemy_3_walk: { file: 'assets/enemy_3_walk.png', frameW: 64, frameH: 64, fps: 6 },
    enemy_4_walk: { file: 'assets/enemy_4_walk.png', frameW: 64, frameH: 64, fps: 12 },
    enemy_5_walk: { file: 'assets/enemy_5_walk.png', frameW: 64, frameH: 64, fps: 8 },
    boss: { file: 'assets/boss.png', frameW: 128, frameH: 128, fps: 6 },
    projectile: { file: 'assets/projectile.png', frameW: 16, frameH: 16, fps: 4 },
    xp_gem: { file: 'assets/xp_gem.png', frameW: 16, frameH: 16, fps: 6 },
    hit_effect: { file: 'assets/hit_effect.png', frameW: 32, frameH: 32, fps: 12 },
    explosion_effect: { file: 'assets/explosion_effect.png', frameW: 64, frameH: 64, fps: 16 },
    floor_tile: { file: 'assets/floor_tile.png', frameW: 32, frameH: 32, fps: 1 },
    upgrade_icons: { file: 'assets/upgrade_icons.png', frameW: 32, frameH: 32, fps: 1 },
  },

  load(onProgress) {
    const keys = Object.keys(this.definitions);
    this.totalAssets = keys.length;
    this.loadedCount = 0;

    return Promise.all(keys.map(key => {
      const def = this.definitions[key];
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          this.images[key] = {
            img: img,
            frameW: def.frameW,
            frameH: def.frameH,
            fps: def.fps,
            frameCount: Math.floor(img.width / def.frameW),
            frameHeight: Math.floor(img.height / def.frameH),
          };
          this.loadedCount++;
          if (onProgress) onProgress(this.loadedCount / this.totalAssets);
          resolve();
        };
        img.onerror = () => {
          const canvas = document.createElement('canvas');
          canvas.width = def.frameW * 4;
          canvas.height = def.frameH;
          const ctx = canvas.getContext('2d');
          const colors = {
            player_idle: '#4488ff', player_run: '#4488ff',
            enemy_1_walk: '#ff4444', enemy_2_walk: '#ff8844',
            enemy_3_walk: '#8844ff', enemy_4_walk: '#44ff44',
            enemy_5_walk: '#ff44ff', boss: '#ff0000',
            projectile: '#ffff00', xp_gem: '#44ff44',
            hit_effect: '#ffffff', explosion_effect: '#ff8800',
            floor_tile: '#336633', upgrade_icons: '#ffd700',
          };
          ctx.fillStyle = colors[key] || '#888888';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          this.images[key] = {
            img: canvas,
            frameW: def.frameW,
            frameH: def.frameH,
            fps: def.fps,
            frameCount: 4,
            frameHeight: 1,
          };
          this.loadedCount++;
          if (onProgress) onProgress(this.loadedCount / this.totalAssets);
          resolve();
        };
        img.src = def.file;
      });
    })).then(() => {
      this.loaded = true;
    });
  },

  drawAnim(ctx, name, x, y, time, flip, scale) {
    scale = scale || 1;
    const asset = this.images[name];
    if (!asset) {
      ctx.fillStyle = '#888';
      ctx.beginPath();
      ctx.arc(x, y, 10 * scale, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    const frame = Math.floor(time * asset.fps) % asset.frameCount;
    const fw = asset.frameW;
    const fh = asset.frameH;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (flip) {
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      ctx.drawImage(asset.img, frame * fw, 0, fw, fh, -fw * scale / 2, -fh * scale / 2, fw * scale, fh * scale);
    } else {
      ctx.drawImage(asset.img, frame * fw, 0, fw, fh, x - fw * scale / 2, y - fh * scale / 2, fw * scale, fh * scale);
    }
    ctx.restore();
  },

  drawStatic(ctx, name, x, y, w, h) {
    const asset = this.images[name];
    if (!asset) {
      ctx.fillStyle = '#888';
      ctx.fillRect(x - w/2, y - h/2, w, h);
      return;
    }
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(asset.img, x - w/2, y - h/2, w, h);
    ctx.restore();
  },

  getIcon(ctx, name, iconIndex, x, y, size) {
    const asset = this.images[name];
    if (!asset) {
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(x - size/2, y - size/2, size, size);
      return;
    }
    const fw = asset.frameW;
    const fh = asset.frameH;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(asset.img, iconIndex * fw, 0, fw, fh, x - size/2, y - size/2, size, size);
    ctx.restore();
  }
};
