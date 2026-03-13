import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { ROLE_DEFS } from '../shared/gameData.js';
import { advancePhase, allPlayersSubmitted, allocateStats, createRoom, resolveAction, teamView } from '../shared/gameLogic.js';
import { narratePhase } from './narration.js';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 3001;
const rooms = new Map();
const sessions = new Map();

function roomOrCreate(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, createRoom(roomId));
  return rooms.get(roomId);
}

function emitRoomViews(room) {
  for (const player of Object.values(room.players)) {
    io.to(player.socketId).emit('room:view', teamView(room, player));
  }
}

app.get('/meta/roles', (_req, res) => {
  res.json(ROLE_DEFS);
});

app.post('/auth/login', (req, res) => {
  const { name, team, roleKey, roomId, stats } = req.body || {};
  if (!name || !team || !roleKey || !roomId || !stats) return res.status(400).json({ error: 'Missing fields' });

  try {
    allocateStats(team, roleKey, stats);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const playerId = `p_${Math.random().toString(36).slice(2, 10)}`;
  const token = `t_${Math.random().toString(36).slice(2, 14)}`;
  sessions.set(token, { id: playerId, name, team, roleKey, stats, roomId });
  res.json({ token, playerId });
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  const session = sessions.get(token);
  if (!session) return next(new Error('Unauthorized'));
  socket.data.session = session;
  next();
});

io.on('connection', (socket) => {
  const session = socket.data.session;
  const room = roomOrCreate(session.roomId);
  const player = { ...session, socketId: socket.id };
  room.players[player.id] = player;
  socket.join(room.id);
  emitRoomViews(room);
  io.to(room.id).emit('room:presence', { roomId: room.id, players: Object.values(room.players).map((p) => ({ id: p.id, name: p.name, team: p.team, roleKey: p.roleKey })) });

  socket.on('command:autocomplete', (prefix, cb) => {
    const role = ROLE_DEFS[player.team].find((r) => r.key === player.roleKey);
    const cmds = Object.keys(role?.commands || {}).filter((cmd) => cmd.startsWith(prefix || ''));
    cb({ suggestions: cmds });
  });

  socket.on('command:submit', async ({ command }, cb) => {
    const liveRoom = rooms.get(player.roomId);
    if (!liveRoom) return cb?.({ error: 'Room not found' });
    if (liveRoom.phase !== player.team) return cb?.({ error: `It is currently ${liveRoom.phase} team's turn` });

    const already = liveRoom.submitted[player.team].find((a) => a.playerId === player.id);
    if (already) return cb?.({ error: 'You already submitted this phase' });

    try {
      const action = resolveAction(liveRoom, player, command);
      liveRoom.submitted[player.team].push(action);
      emitRoomViews(liveRoom);
      io.to(liveRoom.id).emit('room:event', { type: 'action_submitted', team: player.team, playerId: player.id, actor: action.actor, command, outcome: action.result.outcome });

      if (allPlayersSubmitted(liveRoom)) {
        const phase = liveRoom.phase;
        const actions = structuredClone(liveRoom.submitted[phase]);
        const narration = await narratePhase(liveRoom, actions, phase);
        advancePhase(liveRoom, narration);
        io.to(liveRoom.id).emit('room:narration', { round: liveRoom.round, previousPhase: phase, narration });
        emitRoomViews(liveRoom);
      }

      return cb?.({ ok: true, action });
    } catch (err) {
      return cb?.({ error: err.message });
    }
  });

  socket.on('disconnect', () => {
    const liveRoom = rooms.get(player.roomId);
    if (!liveRoom) return;
    delete liveRoom.players[player.id];
    io.to(liveRoom.id).emit('room:presence', { roomId: liveRoom.id, players: Object.values(liveRoom.players).map((p) => ({ id: p.id, name: p.name, team: p.team, roleKey: p.roleKey })) });
    emitRoomViews(liveRoom);
  });
});

httpServer.listen(PORT, () => {
  console.log(`CyberSec Ops server listening on http://localhost:${PORT}`);
});
