import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { RoomManager } from './rooms.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);

// CORS configuration - allow specific origins in production
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['*']; // Default to allow all in development

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins.length === 1 && allowedOrigins[0] === '*' 
      ? '*' 
      : allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

const roomManager = new RoomManager();

app.use(express.static(join(__dirname, '../client')));

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, '../client/index.html'));
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join-room', ({ roomId, username }) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username;

    const roomData = roomManager.addUserToRoom(roomId, socket.id, username);

    socket.emit('room-joined', {
      userId: socket.id,
      user: roomData.user,
      users: roomData.users,
      operations: roomData.operations
    });

    socket.to(roomId).emit('user-joined', {
      user: roomData.user,
      users: roomData.users
    });

    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  socket.on('draw-start', (data) => {
    if (!socket.roomId) return;

    socket.to(socket.roomId).emit('user-draw-start', {
      userId: socket.id,
      ...data
    });
  });

  socket.on('draw-move', (data) => {
    if (!socket.roomId) return;

    socket.to(socket.roomId).emit('user-draw-move', {
      userId: socket.id,
      ...data
    });
  });

  socket.on('draw-end', (data) => {
    if (!socket.roomId) return;

    const operation = {
      type: 'draw',
      userId: socket.id,
      timestamp: Date.now(),
      ...data
    };

    const result = roomManager.addDrawOperation(socket.roomId, operation);

    if (result) {
      io.to(socket.roomId).emit('operation-added', {
        index: result.index,
        operation: result.operation
      });
    }
  });

  socket.on('cursor-move', (data) => {
    if (!socket.roomId) return;

    roomManager.updateUserCursor(socket.roomId, socket.id, data);

    socket.to(socket.roomId).emit('user-cursor-move', {
      userId: socket.id,
      ...data
    });
  });

  socket.on('undo', () => {
    if (!socket.roomId) return;

    const result = roomManager.undoOperation(socket.roomId);

    if (result.success) {
      io.to(socket.roomId).emit('operation-undo', {
        index: result.index,
        operations: result.operations // Include the updated operations list
      });
    }
  });

  socket.on('redo', () => {
    if (!socket.roomId) return;

    const result = roomManager.redoOperation(socket.roomId);

    if (result.success) {
      io.to(socket.roomId).emit('operation-redo', {
        index: result.index,
        operation: result.operation
      });
    }
  });

  socket.on('clear-canvas', () => {
    if (!socket.roomId) return;

    const operation = {
      type: 'clear',
      userId: socket.id,
      timestamp: Date.now()
    };

    const result = roomManager.addDrawOperation(socket.roomId, operation);

    if (result) {
      io.to(socket.roomId).emit('operation-added', {
        index: result.index,
        operation: result.operation
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);

    if (socket.roomId) {
      const remainingUsers = roomManager.removeUserFromRoom(socket.roomId, socket.id);

      if (remainingUsers) {
        socket.to(socket.roomId).emit('user-left', {
          userId: socket.id,
          users: remainingUsers
        });
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
