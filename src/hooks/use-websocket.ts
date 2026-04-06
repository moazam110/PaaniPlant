// PHASE 3: WebSocket Hook for Real-Time Updates
// This hook manages WebSocket connections and provides real-time data updates
// Eliminates the need for polling by receiving push updates from the server

import { useEffect, useRef, useState, useCallback } from 'react';

// Get WebSocket URL from environment or use default
const getWebSocketUrl = () => {
  if (typeof window === 'undefined') return 'ws://localhost:4000'; // SSR fallback
  
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  // Convert HTTP URL to WebSocket URL
  const wsUrl = apiBaseUrl.replace(/^http/, 'ws');
  return wsUrl;
};

const WS_URL = getWebSocketUrl();

export function useWebSocket(room: string, onMessage?: (data: any) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const onMessageRef = useRef(onMessage);

  // Update onMessage ref when it changes
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    // Don't connect during SSR
    if (typeof window === 'undefined') return;
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    try {
      console.log(`🔌 Attempting WebSocket connection to: ${WS_URL} (room: ${room})`);
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`🔌 WebSocket connected to room: ${room}`);
        setIsConnected(true);
        reconnectAttempts.current = 0;
        
        // Subscribe to room
        ws.send(JSON.stringify({ type: 'subscribe', room }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'update') {
            setLastMessage(message.data);
            if (onMessageRef.current) {
              onMessageRef.current(message.data);
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        // WebSocket errors don't provide much detail, but we can log connection attempts
        console.warn(`⚠️ WebSocket connection error for room: ${room}`);
        console.warn(`   URL: ${WS_URL}`);
        console.warn(`   This is normal if the backend server is not running.`);
        setIsConnected(false);
      };

      ws.onclose = (event) => {
        console.log(`🔌 WebSocket disconnected (room: ${room}, code: ${event.code}, reason: ${event.reason || 'none'})`);
        setIsConnected(false);
        
        // Reconnect logic with exponential backoff (limit to 3 attempts to avoid spam)
        if (reconnectAttempts.current < 3) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;
          
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`🔄 Attempting to reconnect WebSocket (attempt ${reconnectAttempts.current}, room: ${room})...`);
            connect();
          }, delay);
        } else {
          console.log(`⏸️  Stopped reconnection attempts for room: ${room} (backend may be offline - will retry on page refresh)`);
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setIsConnected(false);
    }
  }, [room]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  // Unsubscribe function
  const unsubscribe = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe', room }));
    }
  }, [room]);

  return { isConnected, lastMessage, unsubscribe };
}

