import { CanvasManager } from './canvas.js';
import { WebSocketClient } from './websocket.js';

class CollaborativeCanvas {
  constructor() {
    this.ws = new WebSocketClient();
    this.canvas = null;
    this.currentUser = null;

    this.loginScreen = document.getElementById('login-screen');
    this.canvasScreen = document.getElementById('canvas-screen');

    this.setupLoginScreen();
  }

  setupLoginScreen() {
    const usernameInput = document.getElementById('username-input');
    const roomInput = document.getElementById('room-input');
    const joinBtn = document.getElementById('join-btn');

    const join = async () => {
      const username = usernameInput.value.trim() || 'Anonymous';
      const roomId = roomInput.value.trim() || 'main';

      try {
        await this.ws.connect();
        this.ws.joinRoom(roomId, username);

        this.setupWebSocketCallbacks();
      } catch (error) {
        console.error('Failed to connect:', error);
        alert('Failed to connect to server. Please try again.');
      }
    };

    joinBtn.addEventListener('click', join);

    usernameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') join();
    });

    roomInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') join();
    });
  }

  setupWebSocketCallbacks() {
    this.ws.on('onRoomJoined', (data) => {
      this.currentUser = data.user;
      document.getElementById('room-id').textContent = `Room: ${this.ws.roomId}`;

      this.loginScreen.classList.remove('active');
      this.canvasScreen.classList.add('active');

      this.initializeCanvas();
      this.updateUsersList(data.users);

      data.operations.forEach(op => {
        this.canvas.addOperation(op);
      });
    });

    this.ws.on('onUserJoined', (data) => {
      this.updateUsersList(data.users);
    });

    this.ws.on('onUserLeft', (data) => {
      this.updateUsersList(data.users);
      this.canvas.removeRemoteCursor(data.userId);
    });

    this.ws.on('onRemoteDrawStart', (data) => {
      this.canvas.startRemoteDrawing(data.userId, data);
    });

    this.ws.on('onRemoteDrawMove', (data) => {
      this.canvas.updateRemoteDrawing(data.userId, data);
    });

    this.ws.on('onRemoteCursorMove', (data) => {
      const user = this.ws.getUser(data.userId);
      if (user) {
        this.canvas.drawRemoteCursor(data.userId, data, user.color, user.username);
      }
    });

    this.ws.on('onOperationAdded', (data) => {
      if (data.operation.userId !== this.ws.userId) {
        this.canvas.addOperation(data.operation);
      }
    });

    this.ws.on('onOperationUndo', (data) => {
      // Update operations from server and redraw
      if (data.operations) {
        this.ws.operations = data.operations;
      }
      this.redrawCanvas();
    });

    this.ws.on('onOperationRedo', (data) => {
      this.canvas.addOperation(data.operation);
    });
  }

  initializeCanvas() {
    const mainCanvas = document.getElementById('main-canvas');
    const drawingCanvas = document.getElementById('drawing-canvas');
    const cursorCanvas = document.getElementById('cursor-canvas');

    this.canvas = new CanvasManager(mainCanvas, drawingCanvas, cursorCanvas);

    this.setupCanvasEvents();
    this.setupToolbar();
    this.setupKeyboardShortcuts();
  }

  setupCanvasEvents() {
    const canvasContainer = document.getElementById('canvas-container');

    let isMouseDown = false;

    canvasContainer.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      isMouseDown = true;

      this.canvas.startDrawing(e, {
        onStart: (data) => {
          this.ws.sendDrawStart(data);
        }
      });
    });

    canvasContainer.addEventListener('mousemove', (e) => {
      if (isMouseDown) {
        this.canvas.draw(e, {
          onMove: (data) => {
            this.ws.sendDrawMove(data);
          }
        });
      }

      this.canvas.updateCursor(this.canvas.getCanvasCoordinates(e), {
        onCursorMove: (pos) => {
          this.ws.sendCursorMove(pos);
        }
      });
    });

    const stopDrawing = () => {
      if (!isMouseDown) return;
      isMouseDown = false;

      this.canvas.stopDrawing({
        onEnd: (data) => {
          this.ws.sendDrawEnd(data);
        }
      });
    };

    canvasContainer.addEventListener('mouseup', stopDrawing);
    canvasContainer.addEventListener('mouseleave', stopDrawing);

    canvasContainer.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      canvasContainer.dispatchEvent(mouseEvent);
      isMouseDown = true;
    });

    canvasContainer.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      canvasContainer.dispatchEvent(mouseEvent);
    });

    canvasContainer.addEventListener('touchend', (e) => {
      e.preventDefault();
      stopDrawing();
    });
  }

  setupToolbar() {
    const brushBtn = document.getElementById('tool-brush');
    const eraserBtn = document.getElementById('tool-eraser');
    const colorPicker = document.getElementById('color-picker');
    const sizeSlider = document.getElementById('size-slider');
    const sizeValue = document.getElementById('size-value');
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const clearBtn = document.getElementById('clear-btn');

    brushBtn.addEventListener('click', () => {
      this.canvas.setTool('brush');
      brushBtn.classList.add('active');
      eraserBtn.classList.remove('active');
    });

    eraserBtn.addEventListener('click', () => {
      this.canvas.setTool('eraser');
      eraserBtn.classList.add('active');
      brushBtn.classList.remove('active');
    });

    colorPicker.addEventListener('input', (e) => {
      this.canvas.setColor(e.target.value);
    });

    sizeSlider.addEventListener('input', (e) => {
      const size = parseInt(e.target.value);
      this.canvas.setSize(size);
      sizeValue.textContent = size;
    });

    undoBtn.addEventListener('click', () => {
      this.ws.sendUndo();
    });

    redoBtn.addEventListener('click', () => {
      this.ws.sendRedo();
    });

    clearBtn.addEventListener('click', () => {
      if (confirm('Clear the entire canvas? This action affects all users.')) {
        this.ws.sendClearCanvas();
      }
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          this.ws.sendUndo();
        } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          this.ws.sendRedo();
        }
      }
    });
  }

  updateUsersList(users) {
    const usersList = document.getElementById('users-list');
    usersList.innerHTML = '';

    users.forEach(user => {
      const userIndicator = document.createElement('div');
      userIndicator.className = 'user-indicator';

      const colorDot = document.createElement('div');
      colorDot.className = 'user-color';
      colorDot.style.backgroundColor = user.color;

      const username = document.createElement('span');
      username.textContent = user.username;

      if (user.id === this.ws.userId) {
        username.textContent += ' (You)';
      }

      userIndicator.appendChild(colorDot);
      userIndicator.appendChild(username);
      usersList.appendChild(userIndicator);
    });
  }

  redrawCanvas() {
    this.canvas.clearMainCanvas();

    this.ws.operations.forEach(op => {
      this.canvas.addOperation(op);
    });
  }
}

new CollaborativeCanvas();
