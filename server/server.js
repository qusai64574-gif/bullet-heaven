// server.js - Main server file using ws (standard WebSocket)
const WebSocket = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const Database = require('./database');
const RoomManager = require('./rooms/RoomManager');

const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bullet Heaven Server');
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Initialize database and room manager
const db = new Database();
const roomManager = new RoomManager(db);

// Client connections
const clients = new Map();

wss.on('connection', (ws) => {
  const playerId = uuidv4();
  clients.set(playerId, { ws, playerId, roomId: null, name: 'Player' });

  console.log(`Player connected: ${playerId}`);

  // Send player ID
  ws.send(JSON.stringify({ type: 'playerId', playerId }));

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      handleMessage(playerId, msg);
    } catch (e) {
      console.error('Invalid message:', e);
    }
  });

  ws.on('close', () => {
    handleDisconnect(playerId);
  });

  ws.on('error', (e) => {
    console.error(`WebSocket error for ${playerId}:`, e);
  });
});

function handleMessage(playerId, msg) {
  const client = clients.get(playerId);
  if (!client) return;

  switch (msg.type) {
    case 'ping':
      client.ws.send(JSON.stringify({ type: 'pong' }));
      break;

    case 'host':
      handleHost(playerId, msg);
      break;

    case 'join':
      handleJoin(playerId, msg);
      break;

    case 'getServers':
      handleGetServers(playerId);
      break;

    case 'ready':
      handleReady(playerId, msg);
      break;

    case 'startGame':
      handleStartGame(playerId);
      break;

    case 'leaveRoom':
      handleLeaveRoom(playerId);
      break;

    case 'playerState':
      handlePlayerState(playerId, msg);
      break;

    default:
      console.log('Unknown message type:', msg.type);
  }
}

function handleHost(playerId, msg) {
  const client = clients.get(playerId);
  if (!client) return;

  // Validate
  if (!msg.name || msg.name.length > 30) {
    sendError(playerId, 'Invalid server name');
    return;
  }

  const maxPlayers = Math.min(Math.max(parseInt(msg.maxPlayers) || 4, 1), 8);
  const seed = msg.seed ? parseInt(msg.seed) : Math.floor(Math.random() * 1000000);
  const isPublic = msg.isPublic !== false;

  // Generate server code
  const code = generateCode();

  // Create room
  const room = roomManager.createRoom({
    id: code,
    name: msg.name,
    maxPlayers,
    seed,
    isPublic,
    hostId: playerId,
  });

  if (!room) {
    sendError(playerId, 'Failed to create room');
    return;
  }

  // Add host to room
  room.addPlayer(playerId, msg.playerName || 'Host');
  client.roomId = code;
  client.name = msg.playerName || 'Host';

  // Save to database
  db.saveServer({
    id: code,
    name: msg.name,
    maxPlayers,
    seed,
    isPublic,
    hostId: playerId,
    createdAt: Date.now(),
    lastActive: Date.now(),
    online: true,
  });

  // Send room info
  client.ws.send(JSON.stringify({
    type: 'roomJoined',
    room: room.getInfo(),
    players: room.getPlayers(),
    isHost: true,
    maxPlayers,
  }));

  console.log(`Room created: ${code} by ${playerId}`);
}

function handleJoin(playerId, msg) {
  const client = clients.get(playerId);
  if (!client) return;

  const code = (msg.code || '').toUpperCase().trim();

  if (!code || code.length !== 6) {
    sendError(playerId, 'Invalid server code');
    return;
  }

  const room = roomManager.getRoom(code);
  if (!room) {
    sendError(playerId, 'Server not found');
    return;
  }

  if (room.isFull()) {
    sendError(playerId, 'Server is full');
    return;
  }

  if (!room.isOnline) {
    sendError(playerId, 'Server is offline');
    return;
  }

  // Add player to room
  room.addPlayer(playerId, msg.playerName || 'Player');
  client.roomId = code;
  client.name = msg.playerName || 'Player';

  // Update last active
  db.updateServerActivity(code);

  // Send room info to joined player
  client.ws.send(JSON.stringify({
    type: 'roomJoined',
    room: room.getInfo(),
    players: room.getPlayers(),
    isHost: false,
    maxPlayers: room.maxPlayers,
  }));

  // Notify other players
  broadcastToRoom(code, {
    type: 'playerJoined',
    player: { id: playerId, name: msg.playerName || 'Player', ready: false, isHost: false },
  }, playerId);

  console.log(`Player ${playerId} joined room ${code}`);
}

function handleGetServers(playerId) {
  const servers = db.getAllServers();
  const serverList = servers.map(s => {
    const room = roomManager.getRoom(s.id);
    return {
      id: s.id,
      name: s.name,
      players: room ? room.getPlayerCount() : 0,
      maxPlayers: s.maxPlayers,
      ping: Math.floor(Math.random() * 50) + 10,
      online: s.online && room !== null,
      isPublic: s.isPublic,
    };
  });

  const client = clients.get(playerId);
  if (client) {
    client.ws.send(JSON.stringify({
      type: 'serverList',
      servers: serverList,
    }));
  }
}

function handleReady(playerId, msg) {
  const client = clients.get(playerId);
  if (!client || !client.roomId) return;

  const room = roomManager.getRoom(client.roomId);
  if (!room) return;

  room.setReady(playerId, msg.ready);

  broadcastToRoom(client.roomId, {
    type: 'playerReady',
    playerId,
    ready: msg.ready,
  });
}

function handleStartGame(playerId) {
  const client = clients.get(playerId);
  if (!client || !client.roomId) return;

  const room = roomManager.getRoom(client.roomId);
  if (!room) return;

  if (room.hostId !== playerId) {
    sendError(playerId, 'Only host can start the game');
    return;
  }

  // Check if all players are ready
  const players = room.getPlayers();
  const allReady = players.every(p => p.ready || p.isHost);
  if (!allReady) {
    sendError(playerId, 'All players must be ready');
    return;
  }

  // Start game
  broadcastToRoom(client.roomId, {
    type: 'gameStarting',
    seed: room.seed,
  });

  console.log(`Game starting in room ${client.roomId}`);
}

function handleLeaveRoom(playerId) {
  const client = clients.get(playerId);
  if (!client || !client.roomId) return;

  const room = roomManager.getRoom(client.roomId);
  if (room) {
    room.removePlayer(playerId);

    // Notify other players
    broadcastToRoom(client.roomId, {
      type: 'playerLeft',
      playerId,
    });

    // If host left, assign new host or close room
    if (room.hostId === playerId) {
      const players = room.getPlayers();
      if (players.length > 0) {
        room.hostId = players[0].id;
        broadcastToRoom(client.roomId, {
          type: 'hostChanged',
          newHostId: room.hostId,
        });
      } else {
        // Close room
        roomManager.closeRoom(client.roomId);
        db.updateServerOnline(client.roomId, false);
      }
    }
  }

  client.roomId = null;
}

function handlePlayerState(playerId, msg) {
  const client = clients.get(playerId);
  if (!client || !client.roomId) return;

  // Validate position (basic anti-cheat)
  const x = Math.max(0, Math.min(3000, parseInt(msg.x) || 0));
  const y = Math.max(0, Math.min(3000, parseInt(msg.y) || 0));
  const hp = Math.max(0, Math.min(10000, parseInt(msg.hp) || 100));
  const level = Math.max(1, Math.min(100, parseInt(msg.level) || 1));

  // Broadcast to other players
  broadcastToRoom(client.roomId, {
    type: 'playerState',
    playerId,
    x, y, hp, level,
  }, playerId);
}

function handleDisconnect(playerId) {
  const client = clients.get(playerId);
  if (!client) return;

  if (client.roomId) {
    const room = roomManager.getRoom(client.roomId);
    if (room) {
      room.removePlayer(playerId);

      broadcastToRoom(client.roomId, {
        type: 'playerLeft',
        playerId,
      });

      // Handle host disconnect
      if (room.hostId === playerId) {
        const players = room.getPlayers();
        if (players.length > 0) {
          room.hostId = players[0].id;
          broadcastToRoom(client.roomId, {
            type: 'hostChanged',
            newHostId: room.hostId,
          });
        } else {
          roomManager.closeRoom(client.roomId);
          db.updateServerOnline(client.roomId, false);
        }
      }
    }
  }

  clients.delete(playerId);
  console.log(`Player disconnected: ${playerId}`);
}

function broadcastToRoom(roomId, msg, excludePlayerId = null) {
  const room = roomManager.getRoom(roomId);
  if (!room) return;

  const players = room.getPlayers();
  for (const player of players) {
    if (player.id === excludePlayerId) continue;

    const client = clients.get(player.id);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(msg));
    }
  }
}

function sendError(playerId, message) {
  const client = clients.get(playerId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify({ type: 'error', message }));
  }
}

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Cleanup inactive rooms every 5 minutes
setInterval(() => {
  const inactiveRooms = roomManager.getInactiveRooms(30 * 60 * 1000); // 30 minutes
  for (const roomId of inactiveRooms) {
    roomManager.closeRoom(roomId);
    db.updateServerOnline(roomId, false);
    console.log(`Closed inactive room: ${roomId}`);
  }
}, 5 * 60 * 1000);

server.listen(PORT, () => {
  console.log(`Bullet Heaven server running on port ${PORT}`);
});
