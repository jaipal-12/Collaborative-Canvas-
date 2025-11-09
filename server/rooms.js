import { DrawingState } from './drawing-state.js';

export class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.userColors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
    ];
  }

  getOrCreateRoom(roomId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        id: roomId,
        users: new Map(),
        drawingState: new DrawingState(roomId),
        colorIndex: 0
      });
    }
    return this.rooms.get(roomId);
  }

  addUserToRoom(roomId, userId, username) {
    const room = this.getOrCreateRoom(roomId);
    const userColor = this.userColors[room.colorIndex % this.userColors.length];
    room.colorIndex++;

    room.users.set(userId, {
      id: userId,
      username: username || `User${userId.slice(0, 4)}`,
      color: userColor,
      cursor: null
    });

    return {
      user: room.users.get(userId),
      users: Array.from(room.users.values()),
      operations: room.drawingState.getOperations()
    };
  }

  removeUserFromRoom(roomId, userId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.users.delete(userId);

    if (room.users.size === 0) {
      this.rooms.delete(roomId);
      return null;
    }

    return Array.from(room.users.values());
  }

  getUsersInRoom(roomId) {
    const room = this.rooms.get(roomId);
    return room ? Array.from(room.users.values()) : [];
  }

  updateUserCursor(roomId, userId, cursor) {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    const user = room.users.get(userId);
    if (!user) return false;

    user.cursor = cursor;
    return true;
  }

  addDrawOperation(roomId, operation) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const index = room.drawingState.addOperation(operation);
    return { index, operation };
  }

  undoOperation(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    return room.drawingState.undo();
  }

  redoOperation(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    return room.drawingState.redo();
  }
}
