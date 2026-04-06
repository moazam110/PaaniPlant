// PHASE 3: WebSocket Server for Real-Time Updates
// This eliminates the need for polling by pushing updates to clients instantly

import { WebSocketServer } from 'ws';

// Room management for different data types
const rooms = {
  deliveryRequests: new Set(),
  dashboardMetrics: new Set(),
  customers: new Set(),
  customerLogout: new Set(),
  priceChange: new Set()
};

let wss = null;

// Initialize WebSocket server
export function initializeWebSocket(server) {
  wss = new WebSocketServer({ server });
  
  wss.on('connection', (ws) => {
    console.log('🔌 New WebSocket connection');
    
    ws.on('message', (message) => {
      try {
        const { type, room } = JSON.parse(message.toString());
        
        if (type === 'subscribe') {
          if (rooms[room]) {
            rooms[room].add(ws);
            console.log(`📡 Client subscribed to room: ${room}`);
          } else {
            console.warn(`⚠️ Unknown room: ${room}`);
          }
        } else if (type === 'unsubscribe') {
          if (rooms[room]) {
            rooms[room].delete(ws);
            console.log(`📡 Client unsubscribed from room: ${room}`);
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      console.log('🔌 WebSocket connection closed');
      // Remove from all rooms
      Object.values(rooms).forEach(room => room.delete(ws));
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  console.log('✅ WebSocket server initialized');
  return wss;
}

// Broadcast updates to all clients in a room
export function broadcastUpdate(room, data) {
  if (!rooms[room]) {
    console.warn(`⚠️ Attempted to broadcast to unknown room: ${room}`);
    return;
  }
  
  const message = JSON.stringify({ type: 'update', data });
  let sentCount = 0;
  let errorCount = 0;
  
  rooms[room].forEach((ws) => {
    if (ws.readyState === 1) { // OPEN
      try {
        ws.send(message);
        sentCount++;
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        errorCount++;
        // Remove broken connection
        rooms[room].delete(ws);
      }
    } else {
      // Remove closed connections
      rooms[room].delete(ws);
    }
  });
  
  if (sentCount > 0) {
    console.log(`📤 Broadcasted to ${sentCount} clients in room: ${room}`);
  }
  if (errorCount > 0) {
    console.warn(`⚠️ Failed to send to ${errorCount} clients in room: ${room}`);
  }
}

export { rooms };

