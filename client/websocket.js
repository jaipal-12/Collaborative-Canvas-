export class WebSocketClient {
  constructor() {
    this.socket = null;
    this.userId = null;
    this.roomId = null;
    this.users = new Map();
    this.operations = [];
    this.callbacks = {};
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = io();

      this.socket.on('connect', () => {
        console.log('Connected to server');
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        reject(error);
      });

      this.setupEventListeners();
    });
  }

  setupEventListeners() {
    this.socket.on('room-joined', (data) => {
      this.userId = data.userId;
      this.users = new Map(data.users.map(u => [u.id, u]));
      this.operations = data.operations;

      if (this.callbacks.onRoomJoined) {
        this.callbacks.onRoomJoined(data);
      }
    });

    this.socket.on('user-joined', (data) => {
      this.users = new Map(data.users.map(u => [u.id, u]));

      if (this.callbacks.onUserJoined) {
        this.callbacks.onUserJoined(data);
      }
    });

    this.socket.on('user-left', (data) => {
      this.users = new Map(data.users.map(u => [u.id, u]));

      if (this.callbacks.onUserLeft) {
        this.callbacks.onUserLeft(data);
      }
    });

    this.socket.on('user-draw-start', (data) => {
      if (this.callbacks.onRemoteDrawStart) {
        this.callbacks.onRemoteDrawStart(data);
      }
    });

    this.socket.on('user-draw-move', (data) => {
      if (this.callbacks.onRemoteDrawMove) {
        this.callbacks.onRemoteDrawMove(data);
      }
    });

    this.socket.on('user-cursor-move', (data) => {
      if (this.callbacks.onRemoteCursorMove) {
        this.callbacks.onRemoteCursorMove(data);
      }
    });

    this.socket.on('operation-added', (data) => {
      this.operations = this.operations.slice(0, data.index);
      this.operations.push(data.operation);

      if (this.callbacks.onOperationAdded) {
        this.callbacks.onOperationAdded(data);
      }
    });

    this.socket.on('operation-undo', (data) => {
      // Truncate operations array to the new index
      this.operations = this.operations.slice(0, data.index);
      
      if (this.callbacks.onOperationUndo) {
        this.callbacks.onOperationUndo(data);
      }
    });

    this.socket.on('operation-redo', (data) => {
      this.operations = this.operations.slice(0, data.index + 1);

      if (this.callbacks.onOperationRedo) {
        this.callbacks.onOperationRedo(data);
      }
    });
  }

  joinRoom(roomId, username) {
    this.roomId = roomId;
    this.socket.emit('join-room', { roomId, username });
  }

  sendDrawStart(data) {
    this.socket.emit('draw-start', data);
  }

  sendDrawMove(data) {
    this.socket.emit('draw-move', data);
  }

  sendDrawEnd(data) {
    this.socket.emit('draw-end', data);
  }

  sendCursorMove(data) {
    this.socket.emit('cursor-move', data);
  }

  sendUndo() {
    this.socket.emit('undo');
  }

  sendRedo() {
    this.socket.emit('redo');
  }

  sendClearCanvas() {
    this.socket.emit('clear-canvas');
  }

  on(event, callback) {
    this.callbacks[event] = callback;
  }

  getUser(userId) {
    return this.users.get(userId);
  }

  getAllUsers() {
    return Array.from(this.users.values());
  }
}
