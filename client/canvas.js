export class CanvasManager {
  constructor(mainCanvas, drawingCanvas, cursorCanvas) {
    this.mainCanvas = mainCanvas;
    this.drawingCanvas = drawingCanvas;
    this.cursorCanvas = cursorCanvas;

    this.mainCtx = mainCanvas.getContext('2d', { willReadFrequently: false });
    this.drawingCtx = drawingCanvas.getContext('2d', { willReadFrequently: false });
    this.cursorCtx = cursorCanvas.getContext('2d', { willReadFrequently: false });

    this.isDrawing = false;
    this.currentPath = [];
    this.tool = 'brush';
    this.color = '#000000';
    this.size = 5;

    this.activePaths = new Map();
    this.userCursors = new Map();

    this.initializeCanvas();
    this.setupEventListeners();
  }

  initializeCanvas() {
    const container = this.mainCanvas.parentElement;
    const rect = container.getBoundingClientRect();

    const dpr = window.devicePixelRatio || 1;

    [this.mainCanvas, this.drawingCanvas, this.cursorCanvas].forEach(canvas => {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
    });

    this.mainCtx.lineCap = 'round';
    this.mainCtx.lineJoin = 'round';
    this.drawingCtx.lineCap = 'round';
    this.drawingCtx.lineJoin = 'round';
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.initializeCanvas());
  }

  getCanvasCoordinates(e) {
    const rect = this.mainCanvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  startDrawing(e, callbacks) {
    this.isDrawing = true;
    const pos = this.getCanvasCoordinates(e);

    this.currentPath = [{
      x: pos.x,
      y: pos.y,
      tool: this.tool,
      color: this.color,
      size: this.size
    }];

    if (callbacks?.onStart) {
      callbacks.onStart({
        x: pos.x,
        y: pos.y,
        tool: this.tool,
        color: this.color,
        size: this.size
      });
    }
  }

  draw(e, callbacks) {
    if (!this.isDrawing) return;

    const pos = this.getCanvasCoordinates(e);
    this.currentPath.push({
      x: pos.x,
      y: pos.y
    });

    this.clearDrawingLayer();
    this.renderPath(this.drawingCtx, this.currentPath);

    if (callbacks?.onMove) {
      callbacks.onMove({
        x: pos.x,
        y: pos.y
      });
    }
  }

  stopDrawing(callbacks) {
    if (!this.isDrawing) return;

    this.isDrawing = false;

    if (this.currentPath.length > 0) {
      this.renderPath(this.mainCtx, this.currentPath);
      this.clearDrawingLayer();

      if (callbacks?.onEnd) {
        callbacks.onEnd({
          path: this.currentPath,
          tool: this.tool,
          color: this.color,
          size: this.size
        });
      }
    }

    this.currentPath = [];
  }

  renderPath(ctx, path) {
    if (path.length === 0) return;

    const firstPoint = path[0];
    ctx.strokeStyle = firstPoint.tool === 'eraser' ? '#FFFFFF' : firstPoint.color;
    ctx.lineWidth = firstPoint.size;
    ctx.globalCompositeOperation = firstPoint.tool === 'eraser' ? 'destination-out' : 'source-over';

    ctx.beginPath();
    ctx.moveTo(firstPoint.x, firstPoint.y);

    if (path.length === 1) {
      ctx.lineTo(firstPoint.x + 0.1, firstPoint.y + 0.1);
    } else if (path.length === 2) {
      ctx.lineTo(path[1].x, path[1].y);
    } else {
      for (let i = 1; i < path.length - 1; i++) {
        const xc = (path[i].x + path[i + 1].x) / 2;
        const yc = (path[i].y + path[i + 1].y) / 2;
        ctx.quadraticCurveTo(path[i].x, path[i].y, xc, yc);
      }
      ctx.lineTo(path[path.length - 1].x, path[path.length - 1].y);
    }

    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }

  startRemoteDrawing(userId, data) {
    this.activePaths.set(userId, [{
      x: data.x,
      y: data.y,
      tool: data.tool,
      color: data.color,
      size: data.size
    }]);
  }

  updateRemoteDrawing(userId, data) {
    const path = this.activePaths.get(userId);
    if (!path) return;

    path.push({
      x: data.x,
      y: data.y
    });

    this.clearDrawingLayer();

    if (this.isDrawing && this.currentPath.length > 0) {
      this.renderPath(this.drawingCtx, this.currentPath);
    }

    this.activePaths.forEach((remotePath) => {
      this.renderPath(this.drawingCtx, remotePath);
    });
  }

  endRemoteDrawing(userId, data) {
    const path = this.activePaths.get(userId);
    if (!path) return;

    this.renderPath(this.mainCtx, path);
    this.activePaths.delete(userId);

    this.clearDrawingLayer();

    if (this.isDrawing && this.currentPath.length > 0) {
      this.renderPath(this.drawingCtx, this.currentPath);
    }
  }

  addOperation(operation) {
    if (operation.type === 'draw') {
      this.renderPath(this.mainCtx, operation.path);
    } else if (operation.type === 'clear') {
      this.clearMainCanvas();
    }
  }

  updateCursor(pos, callbacks) {
    if (callbacks?.onCursorMove) {
      callbacks.onCursorMove(pos);
    }
  }

  drawRemoteCursor(userId, data, userColor, username) {
    this.userCursors.set(userId, { ...data, color: userColor, username });
    this.redrawCursors();
  }

  removeRemoteCursor(userId) {
    this.userCursors.delete(userId);
    this.redrawCursors();
  }

  redrawCursors() {
    this.clearCursorLayer();

    this.userCursors.forEach((cursor) => {
      this.cursorCtx.fillStyle = cursor.color;
      this.cursorCtx.strokeStyle = 'white';
      this.cursorCtx.lineWidth = 2;

      this.cursorCtx.beginPath();
      this.cursorCtx.arc(cursor.x, cursor.y, 6, 0, Math.PI * 2);
      this.cursorCtx.fill();
      this.cursorCtx.stroke();

      if (cursor.username) {
        this.cursorCtx.font = '12px sans-serif';
        this.cursorCtx.fillStyle = cursor.color;
        this.cursorCtx.strokeStyle = 'white';
        this.cursorCtx.lineWidth = 3;
        this.cursorCtx.strokeText(cursor.username, cursor.x + 10, cursor.y - 5);
        this.cursorCtx.fillText(cursor.username, cursor.x + 10, cursor.y - 5);
      }
    });
  }

  clearMainCanvas() {
    this.mainCtx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
  }

  clearDrawingLayer() {
    this.drawingCtx.clearRect(0, 0, this.drawingCanvas.width, this.drawingCanvas.height);
  }

  clearCursorLayer() {
    this.cursorCtx.clearRect(0, 0, this.cursorCanvas.width, this.cursorCanvas.height);
  }

  setTool(tool) {
    this.tool = tool;
  }

  setColor(color) {
    this.color = color;
  }

  setSize(size) {
    this.size = size;
  }
}
