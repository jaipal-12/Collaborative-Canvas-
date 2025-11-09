# Real-Time Collaborative Drawing Canvas

A multi-user drawing application where multiple people can draw simultaneously on the same canvas with real-time synchronization.

## Features

- **Real-time Collaboration**: See other users drawing in real-time as they draw
- **Drawing Tools**: Brush and eraser with adjustable colors and stroke widths
- **User Indicators**: Visual indicators showing online users and their cursor positions
- **Global Undo/Redo**: Undo and redo operations work across all users
- **Conflict Resolution**: Smooth handling of simultaneous drawing in overlapping areas
- **Room-based Sessions**: Multiple isolated drawing rooms
- **Touch Support**: Works on mobile devices with touch events

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- npm

### Installation

1. Clone or download this project

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

## Testing with Multiple Users

To test the collaborative features:

1. Start the server with `npm start`
2. Open multiple browser windows/tabs pointing to `http://localhost:3000`
3. Enter different usernames in each window
4. Use the same room ID to join the same drawing session
5. Start drawing in one window and observe real-time updates in others

You can also test across different devices on the same network by accessing `http://[your-ip]:3000`

## Usage

### Joining a Room

- Enter your username (or leave blank for "Anonymous")
- Enter a room ID (or leave blank for "main" room)
- Click "Join Room"

### Drawing Tools

- **Brush**: Select the brush tool and choose your color
- **Eraser**: Switch to eraser mode to remove drawings
- **Size**: Adjust the stroke width using the slider (1-50px)
- **Color**: Pick any color using the color picker

### Actions

- **Undo**: Click the undo button or press `Ctrl+Z` (global operation)
- **Redo**: Click the redo button or press `Ctrl+Y` (global operation)
- **Clear Canvas**: Click the clear button to remove all drawings (affects all users)

### User Indicators

- Each user is assigned a unique color
- User list in the header shows all online users
- Colored cursors show where other users are drawing

## Known Limitations

- Canvas state is stored in server memory only (resets on server restart)
- No authentication or user persistence
- Drawing operations are not persisted to a database
- Limited to 8 predefined user colors (colors repeat after 8 users)
- Canvas size is fixed to viewport dimensions
- No drawing history export functionality
- Undo/redo stack is unlimited (may cause memory issues with very long sessions)
- No rate limiting on drawing events (may cause network congestion with rapid drawing)

## Time Spent

Approximately 4-5 hours:
- 1 hour: Project structure and server setup
- 1.5 hours: Canvas implementation and drawing logic
- 1 hour: WebSocket integration and real-time sync
- 0.5 hours: UI/UX polish and styling
- 1 hour: Testing, debugging, and documentation

## Technology Stack

- **Frontend**: Vanilla JavaScript (ES6 modules), HTML5 Canvas API
- **Backend**: Node.js, Express
- **Real-time Communication**: Socket.IO
- **No external drawing libraries** - all canvas operations implemented from scratch

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed technical documentation including:
- Data flow diagrams
- WebSocket protocol specification
- Undo/redo strategy
- Performance optimizations
- Conflict resolution approach
