# Architecture Documentation

## Overview

This document provides detailed technical information about the collaborative drawing canvas implementation, including data flow, protocol design, state management, and performance optimizations.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Layer                         │
├──────────────┬──────────────────────┬──────────────────────┤
│   Canvas     │   WebSocket Client   │     UI Controls      │
│   Manager    │                      │                      │
└──────┬───────┴───────────┬──────────┴──────────────┬───────┘
       │                   │                         │
       │              WebSocket Protocol              │
       │                   │                         │
┌──────┴───────────────────┴─────────────────────────┴───────┐
│                      Server Layer                           │
├──────────────┬──────────────────────┬──────────────────────┤
│  Socket.IO   │    Room Manager     │   Drawing State      │
│   Server     │                      │                      │
└──────────────┴──────────────────────┴──────────────────────┘
```

## Data Flow Diagram

### Drawing Event Flow

```
User Input (Mouse/Touch)
        ↓
Canvas Manager (client/canvas.js)
    - Capture coordinates
    - Render locally (optimistic UI)
        ↓
WebSocket Client (client/websocket.js)
    - Batch/stream drawing data
    - Send via Socket.IO
        ↓
Socket.IO Server (server/server.js)
    - Receive event
    - Broadcast to room
        ↓
Room Manager (server/rooms.js)
    - Add to operation history
    - Update drawing state
        ↓
Other Clients in Room
    - Receive broadcasted event
    - Render on their canvas
```

### Undo/Redo Flow

```
User Action (Ctrl+Z or Undo Button)
        ↓
WebSocket Client
    - Send undo request
        ↓
Server - Drawing State (server/drawing-state.js)
    - Decrement operation index
    - Return undo result
        ↓
Broadcast to ALL clients
        ↓
All Clients
    - Clear canvas
    - Replay all operations up to new index
```

## WebSocket Protocol

### Message Types

#### Client → Server

**1. join-room**
```javascript
{
  roomId: string,    // Room identifier
  username: string   // Display name
}
```

**2. draw-start**
```javascript
{
  x: number,         // X coordinate
  y: number,         // Y coordinate
  tool: string,      // 'brush' or 'eraser'
  color: string,     // Hex color code
  size: number       // Stroke width
}
```

**3. draw-move**
```javascript
{
  x: number,         // X coordinate
  y: number          // Y coordinate
}
```

**4. draw-end**
```javascript
{
  path: Array<{x, y, tool?, color?, size?}>,
  tool: string,
  color: string,
  size: number
}
```

**5. cursor-move**
```javascript
{
  x: number,         // Cursor X coordinate
  y: number          // Cursor Y coordinate
}
```

**6. undo**
```javascript
// No payload - triggers global undo
```

**7. redo**
```javascript
// No payload - triggers global redo
```

**8. clear-canvas**
```javascript
// No payload - clears entire canvas
```

#### Server → Client

**1. room-joined**
```javascript
{
  userId: string,
  user: {
    id: string,
    username: string,
    color: string
  },
  users: Array<User>,
  operations: Array<Operation>
}
```

**2. user-joined**
```javascript
{
  user: User,
  users: Array<User>
}
```

**3. user-left**
```javascript
{
  userId: string,
  users: Array<User>
}
```

**4. user-draw-start**
```javascript
{
  userId: string,
  x: number,
  y: number,
  tool: string,
  color: string,
  size: number
}
```

**5. user-draw-move**
```javascript
{
  userId: string,
  x: number,
  y: number
}
```

**6. user-cursor-move**
```javascript
{
  userId: string,
  x: number,
  y: number
}
```

**7. operation-added**
```javascript
{
  index: number,
  operation: {
    type: 'draw' | 'clear',
    userId: string,
    timestamp: number,
    path?: Array,      // For draw operations
    tool?: string,
    color?: string,
    size?: number
  }
}
```

**8. operation-undo**
```javascript
{
  index: number       // New operation index after undo
}
```

**9. operation-redo**
```javascript
{
  index: number,
  operation: Operation
}
```

## Undo/Redo Strategy

### Design Philosophy

The undo/redo system implements a **global operation history** approach where all users share the same history stack. This ensures consistency across all clients.

### Implementation Details

**Data Structure:**
```javascript
class DrawingState {
  operations: Array<Operation>  // Complete history
  operationIndex: number        // Current position in history
}
```

**Operation Types:**
- `draw`: Represents a complete stroke (path)
- `clear`: Represents canvas clear action

**Undo Operation:**
1. User triggers undo (Ctrl+Z or button)
2. Client sends `undo` event to server
3. Server decrements `operationIndex`
4. Server broadcasts `operation-undo` with new index
5. All clients redraw canvas with operations[0...operationIndex]

**Redo Operation:**
1. User triggers redo (Ctrl+Y or button)
2. Client sends `redo` event to server
3. Server increments `operationIndex`
4. Server broadcasts `operation-redo` with operation at new index
5. All clients apply the operation

**Key Design Decisions:**

1. **Server-side Authority**: The server maintains the single source of truth for the operation history and current index, preventing conflicts.

2. **Linear History**: When a new operation is added, any "redoable" operations are discarded:
```javascript
addOperation(operation) {
  this.operations = this.operations.slice(0, this.operationIndex);
  this.operations.push(operation);
  this.operationIndex = this.operations.length;
}
```

3. **Full Redraw on Undo**: Instead of reversing individual operations, we clear the canvas and replay all operations up to the current index. This is simpler and more reliable for global state.

4. **No Per-User Undo**: All users share the same undo stack. When User A undos User B's action, it affects everyone. This prevents complex conflict scenarios.

### Conflict Resolution

**Scenario: User A undos while User B is drawing**

1. User B's active drawing continues unaffected (rendering on local drawing layer)
2. When User B completes the stroke, it becomes a new operation
3. This new operation is added to history, potentially overwriting redo operations
4. All clients sync to the new state

**Trade-off:** Simplicity over individual control. This prevents conflicts but means users must coordinate on undo actions.

## Performance Optimizations

### 1. Canvas Layering Strategy

Three separate canvas layers:

```javascript
// Layer 1: Main Canvas (completed drawings)
<canvas id="main-canvas">

// Layer 2: Drawing Canvas (active strokes)
<canvas id="drawing-canvas">

// Layer 3: Cursor Canvas (user cursors)
<canvas id="cursor-canvas">
```

**Benefits:**
- Only redraw what changes (active strokes vs completed strokes)
- Avoid expensive full canvas redraws
- Separate concerns (drawing vs UI elements)

### 2. Path Smoothing with Quadratic Curves

Instead of drawing straight lines between points, we use quadratic Bezier curves:

```javascript
for (let i = 1; i < path.length - 1; i++) {
  const xc = (path[i].x + path[i + 1].x) / 2;
  const yc = (path[i].y + path[i + 1].y) / 2;
  ctx.quadraticCurveTo(path[i].x, path[i].y, xc, yc);
}
```

**Benefits:**
- Smoother, more natural-looking strokes
- Reduces jagged appearance of rapid mouse movements

### 3. Device Pixel Ratio Handling

```javascript
const dpr = window.devicePixelRatio || 1;
canvas.width = rect.width * dpr;
canvas.height = rect.height * dpr;
canvas.style.width = `${rect.width}px`;
canvas.style.height = `${rect.height}px`;
ctx.scale(dpr, dpr);
```

**Benefits:**
- Sharp rendering on high-DPI displays (Retina, 4K)
- Prevents blurry lines on modern displays

### 4. Optimistic UI Updates

Drawing appears instantly on the local canvas before server confirmation:

```javascript
// Immediate local render
this.renderPath(this.drawingCtx, this.currentPath);

// Send to server (async)
this.ws.sendDrawMove(data);
```

**Benefits:**
- Zero perceived latency for local user
- Smooth drawing experience despite network delays

### 5. Context Configuration

```javascript
this.mainCtx.lineCap = 'round';
this.mainCtx.lineJoin = 'round';
```

**Benefits:**
- Smoother line connections
- Professional appearance for strokes

### 6. Event Batching Consideration

While not currently implemented, the architecture supports event batching:

```javascript
// Current: Send each point immediately
socket.emit('draw-move', {x, y});

// Future optimization: Batch multiple points
if (Date.now() - lastSend > 16) { // ~60fps
  socket.emit('draw-move-batch', pointsBuffer);
  pointsBuffer = [];
  lastSend = Date.now();
}
```

**Trade-off:** Current implementation prioritizes real-time feel over network efficiency.

## Conflict Resolution

### Drawing Conflicts

**Scenario: Multiple users drawing in overlapping areas**

**Solution: Last-Write-Wins with Visual Layering**

1. Each stroke is added to the operation history in the order received by server
2. Canvas renders operations in sequential order
3. Later strokes appear on top of earlier strokes
4. No special conflict detection needed

**Visual Feedback:**
- Users see other users' active strokes in real-time (on drawing layer)
- Different user colors help distinguish overlapping work

### State Synchronization

**Scenario: New user joins mid-session**

1. Server sends complete operation history in `room-joined` event
2. Client replays all operations to reconstruct canvas state
3. New user sees exact current state

**Scenario: User reconnects after disconnect**

1. User rejoins room (new socket connection)
2. Receives fresh operation history
3. Canvas reconstructed from current state

### Race Conditions

**Scenario: User A undos while User B's draw-end is in flight**

Timeline:
```
t=0: User A sends undo
t=1: Server processes undo, broadcasts to all
t=2: User B's draw-end arrives at server
t=3: Server adds new operation, broadcasts
```

Result: User B's operation is added after the undo, becoming the new latest operation. The undo effectively happened in the past. This is consistent with the linear history model.

## Scalability Considerations

### Current Limitations

1. **Memory**: All operations stored in server memory
2. **Room Size**: No limit on users per room (could cause performance issues)
3. **History Size**: Unlimited operation history (could cause memory issues)

### Future Improvements

1. **Database Persistence**: Store operations in database
2. **Pagination**: Limit operation history, implement snapshots
3. **Rate Limiting**: Throttle draw events per user
4. **Room Caps**: Limit users per room
5. **Compression**: Compress path data before transmission
6. **Delta Encoding**: Send only changed points, not complete paths

## Testing Strategy

