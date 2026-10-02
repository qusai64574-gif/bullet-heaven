// RoomManager.js - Manages game rooms
class RoomManager {
  constructor(db) {
    this.db = db;
    this.rooms = new Map();
  }

  createRoom({ id, name, maxPlayers, seed, isPublic, hostId }) {
    if (this.rooms.has(id)) {
      return null;
    }

    const room = new Room(id, name, maxPlayers, seed, isPublic, hostId);
    this.rooms.set(id, room);
    return room;
  }

  getRoom(id) {
    return this.rooms.get(id) || null;
  }

  closeRoom(id) {
    const room = this.rooms.get(id);
    if (room) {
      room.isOnline = false;
      this.rooms.delete(id);
    }
  }

  getInactiveRooms(maxAge) {
    const now = Date.now();
    const inactive = [];
    for (const [id, room] of this.rooms) {
      if (now - room.lastActivity > maxAge) {
        inactive.push(id);
      }
    }
    return inactive;
  }
}

class Room {
  constructor(id, name, maxPlayers, seed, isPublic, hostId) {
    this.id = id;
    this.name = name;
    this.maxPlayers = maxPlayers;
    this.seed = seed;
    this.isPublic = isPublic;
    this.hostId = hostId;
    this.players = [];
    this.isOnline = true;
    this.lastActivity = Date.now();
    this.gameStarted = false;
  }

  addPlayer(playerId, name) {
    if (this.isFull()) return false;
    this.players.push({
      id: playerId,
      name,
      ready: false,
      isHost: playerId === this.hostId,
    });
    this.lastActivity = Date.now();
    return true;
  }

  removePlayer(playerId) {
    this.players = this.players.filter(p => p.id !== playerId);
    this.lastActivity = Date.now();
  }

  setReady(playerId, ready) {
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      player.ready = ready;
      this.lastActivity = Date.now();
    }
  }

  isFull() {
    return this.players.length >= this.maxPlayers;
  }

  getPlayerCount() {
    return this.players.length;
  }

  getPlayers() {
    return this.players;
  }

  getInfo() {
    return {
      id: this.id,
      name: this.name,
      maxPlayers: this.maxPlayers,
      seed: this.seed,
      isPublic: this.isPublic,
      playerCount: this.players.length,
    };
  }
}

module.exports = RoomManager;
