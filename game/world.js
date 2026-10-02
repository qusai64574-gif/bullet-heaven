// world.js - World generation

const World = {
  seed: 0,
  tiles: [],
  obstacles: [],
  decorations: [],

  generate(seed) {
    this.seed = seed;
    this.tiles = [];
    this.obstacles = [];
    this.decorations = [];

    this.generateTerrain();
    this.obstacles = this.generateObstacles();
    this.decorations = this.generateDecorations();
  },

  generateTerrain() {
    const tileCount = Math.ceil(WORLD.width / WORLD.tileSize);
    for (let x = 0; x < tileCount; x++) {
      this.tiles[x] = [];
      for (let y = 0; y < tileCount; y++) {
        const noise = this.simpleNoise(x * 0.1, y * 0.1);
        if (noise > 0.7) {
          this.tiles[x][y] = 'water';
        } else if (noise > 0.5) {
          this.tiles[x][y] = 'rock';
        } else {
          this.tiles[x][y] = 'grass';
        }
      }
    }
  },

  simpleNoise(x, y) {
    const n = Math.sin(x * 12.9898 + y * 78.233 + this.seed) * 43758.5453;
    return n - Math.floor(n);
  },

  generateObstacles() {
    const obstacles = [];
    const count = 50 + Math.floor(this.simpleNoise(this.seed, 0) * 50);

    for (let i = 0; i < count; i++) {
      const x = 100 + this.simpleNoise(i, 1) * (WORLD.width - 200);
      const y = 100 + this.simpleNoise(i, 2) * (WORLD.height - 200);

      const dx = x - WORLD.width / 2;
      const dy = y - WORLD.height / 2;
      if (dx * dx + dy * dy < 200 * 200) continue;

      const type = this.simpleNoise(i, 3) > 0.5 ? 'rock' : 'tree';
      obstacles.push(new Obstacle(x, y, type));
    }

    return obstacles;
  },

  generateDecorations() {
    const decorations = [];
    const count = 100 + Math.floor(this.simpleNoise(this.seed, 4) * 100);

    for (let i = 0; i < count; i++) {
      const x = 50 + this.simpleNoise(i, 5) * (WORLD.width - 100);
      const y = 50 + this.simpleNoise(i, 6) * (WORLD.height - 100);

      const type = this.simpleNoise(i, 7) > 0.6 ? 'flower' :
                   this.simpleNoise(i, 7) > 0.3 ? 'grass' : 'mushroom';
      decorations.push(new Decoration(x, y, type));
    }

    return decorations;
  },

  isOnScreen(x, y, margin) {
    margin = margin || 0;
    return x > Engine.camera.x - margin &&
           x < Engine.camera.x + Engine.width + margin &&
           y > Engine.camera.y - margin &&
           y < Engine.camera.y + Engine.height + margin;
  },
};

class Obstacle {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;

    if (type === 'rock') {
      this.size = 30 + Math.random() * 20;
      this.color = '#4a4a6a';
    } else {
      this.size = 40;
      this.color = '#0f3460';
    }
  }

  draw(ctx) {
    if (this.type === 'rock') {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5a5a7a';
      ctx.beginPath();
      ctx.arc(this.x - 5, this.y - 5, this.size / 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Tree trunk
      ctx.fillStyle = '#533483';
      ctx.fillRect(this.x - 5, this.y, 10, 20);
      // Tree top
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y - 10, this.size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a4470';
      ctx.beginPath();
      ctx.arc(this.x - 8, this.y - 15, this.size / 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

class Decoration {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.size = 4 + Math.random() * 4;
  }

  draw(ctx) {
    switch (this.type) {
      case 'flower':
        ctx.fillStyle = '#ff6699';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'grass':
        ctx.fillStyle = '#3a6a3a';
        ctx.fillRect(this.x - 1, this.y - this.size, 2, this.size);
        break;
      case 'mushroom':
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size / 2, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(this.x - 1, this.y, 2, this.size / 2);
        break;
    }
  }
}
