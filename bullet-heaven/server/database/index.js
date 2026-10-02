// database.js - Lightweight JSON-based persistent storage
const fs = require('fs');
const path = require('path');

class Database {
  constructor() {
    this.dataDir = path.join(__dirname, '..', 'database');
    this.serversFile = path.join(this.dataDir, 'servers.json');
    this.data = { servers: {} };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.serversFile)) {
        const raw = fs.readFileSync(this.serversFile, 'utf8');
        this.data = JSON.parse(raw);
      } else {
        this.ensureDir();
        this.save();
      }
    } catch (e) {
      console.error('Database load error:', e);
      this.data = { servers: {} };
    }
  }

  save() {
    try {
      this.ensureDir();
      fs.writeFileSync(this.serversFile, JSON.stringify(this.data, null, 2));
    } catch (e) {
      console.error('Database save error:', e);
    }
  }

  ensureDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  saveServer(serverData) {
    this.data.servers[serverData.id] = serverData;
    this.save();
  }

  getServer(id) {
    return this.data.servers[id] || null;
  }

  getAllServers() {
    return Object.values(this.data.servers);
  }

  updateServerActivity(id) {
    const server = this.data.servers[id];
    if (server) {
      server.lastActive = Date.now();
      this.save();
    }
  }

  updateServerOnline(id, online) {
    const server = this.data.servers[id];
    if (server) {
      server.online = online;
      server.lastActive = Date.now();
      this.save();
    }
  }

  deleteServer(id) {
    delete this.data.servers[id];
    this.save();
  }

  // Cleanup servers that have been inactive for more than maxAge ms
  cleanupInactiveServers(maxAge) {
    const now = Date.now();
    let changed = false;
    for (const [id, server] of Object.entries(this.data.servers)) {
      if (now - server.lastActive > maxAge) {
        delete this.data.servers[id];
        changed = true;
      }
    }
    if (changed) {
      this.save();
    }
  }
}

module.exports = Database;
