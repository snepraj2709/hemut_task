import { useEffect, useState, useRef, useCallback, useMemo } from 'react';

interface WebSocketMessage {
  type: string;
  data?: unknown;
  timestamp?: string;
}

interface UseWebSocketOptions {
  url: string;
  token?: string | null;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
}

export function useWebSocket(options: UseWebSocketOptions) {
  const {
    url,
    token,
    reconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
    onOpen,
    onClose,
    onError,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const pingIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);

  // Memoize the WebSocket URL to prevent unnecessary reconnections
  const wsUrl = useMemo(() => {
    return token ? `${url}?token=${token}` : url;
  }, [url, token]);

  // Stable disconnect function
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current !== undefined) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    if (pingIntervalRef.current !== undefined) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = undefined;
    }
    if (wsRef.current) {
      // Remove event listeners to prevent memory leaks
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      
      if (wsRef.current.readyState === WebSocket.OPEN || 
          wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
  }, []);

  // Stable connect function with reconnection limit
  const connect = useCallback(() => {
    // Prevent connection if unmounted or max attempts reached
    if (!isMountedRef.current || reconnectAttemptsRef.current >= maxReconnectAttempts) {
      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        console.error('❌ Max reconnection attempts reached');
      }
      return;
    }

    // Clean up existing connection
    disconnect();

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        
        console.log('✅ WebSocket connected');
        reconnectAttemptsRef.current = 0; // Reset attempts on success
        setIsConnected(true);
        onOpen?.();

        // Setup ping interval (every 30 seconds)
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        if (!isMountedRef.current) return;
        
        console.error('❌ WebSocket error:', error);
        onError?.(error);
      };

      ws.onclose = (event) => {
        if (!isMountedRef.current) return;
        
        console.log('🔌 WebSocket disconnected');
        setIsConnected(false);
        onClose?.();

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }

        // Attempt reconnection with exponential backoff
        if (reconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          const backoffDelay = Math.min(
            reconnectInterval * Math.pow(2, reconnectAttemptsRef.current - 1),
            30000 // Max 30 seconds
          );
          
          console.log(
            `🔄 Attempting to reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttempts}) in ${backoffDelay}ms...`
          );
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, backoffDelay);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      reconnectAttemptsRef.current += 1;
    }
  }, [wsUrl, reconnect, reconnectInterval, maxReconnectAttempts, onOpen, onClose, onError, disconnect]);

  // Stable sendMessage function
  const sendMessage = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    } else {
      console.warn('⚠️ WebSocket is not connected');
      return false;
    }
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    isMountedRef.current = true;
    connect();
    
    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, [connect, disconnect]);

  // Return memoized object to prevent unnecessary re-renders
  return useMemo(
    () => ({
      isConnected,
      lastMessage,
      sendMessage,
      disconnect,
      reconnect: connect,
    }),
    [isConnected, lastMessage, sendMessage, disconnect, connect]
  );
}
