import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseWebSocketConfig {
  url: string;
  protocols?: string | string[];
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onMessage?: (event: MessageEvent) => void;
  shouldReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface WebSocketState {
  socket: WebSocket | null;
  lastMessage: MessageEvent | null;
  readyState: number;
  isConnected: boolean;
  isConnecting: boolean;
  error: Event | null;
}

export const useWebSocket = (config: UseWebSocketConfig) => {
  const {
    url,
    protocols,
    onOpen,
    onClose,
    onError,
    onMessage,
    shouldReconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
  } = config;

  const [state, setState] = useState<WebSocketState>({
    socket: null,
    lastMessage: null,
    readyState: WebSocket.CONNECTING,
    isConnected: false,
    isConnecting: false,
    error: null,
  });

  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const shouldConnectRef = useRef(true);

  const connect = useCallback(() => {
    if (state.socket?.readyState === WebSocket.OPEN || state.isConnecting) {
      return;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const socket = new WebSocket(url, protocols);

      socket.onopen = (event) => {
        setState(prev => ({
          ...prev,
          socket,
          readyState: socket.readyState,
          isConnected: true,
          isConnecting: false,
          error: null,
        }));
        reconnectAttemptsRef.current = 0;
        onOpen?.(event);
      };

      socket.onclose = (event) => {
        setState(prev => ({
          ...prev,
          socket: null,
          readyState: WebSocket.CLOSED,
          isConnected: false,
          isConnecting: false,
        }));

        onClose?.(event);

        // Attempt to reconnect if enabled and not manually closed
        if (
          shouldReconnect &&
          shouldConnectRef.current &&
          reconnectAttemptsRef.current < maxReconnectAttempts &&
          !event.wasClean
        ) {
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      socket.onerror = (event) => {
        setState(prev => ({
          ...prev,
          error: event,
          isConnecting: false,
        }));
        onError?.(event);
      };

      socket.onmessage = (event) => {
        setState(prev => ({
          ...prev,
          lastMessage: event,
        }));
        onMessage?.(event);
      };

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error as Event,
        isConnecting: false,
      }));
    }
  }, [url, protocols, onOpen, onClose, onError, onMessage, shouldReconnect, reconnectInterval, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    shouldConnectRef.current = false;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (state.socket) {
      state.socket.close(1000, 'Manual disconnect');
    }
  }, [state.socket]);

  const sendMessage = useCallback((data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
    if (state.socket?.readyState === WebSocket.OPEN) {
      state.socket.send(data);
      return true;
    }
    return false;
  }, [state.socket]);

  const sendJsonMessage = useCallback((data: any) => {
    return sendMessage(JSON.stringify(data));
  }, [sendMessage]);

  useEffect(() => {
    connect();

    return () => {
      shouldConnectRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (state.socket) {
        state.socket.close(1000, 'Component unmount');
      }
    };
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    sendMessage,
    sendJsonMessage,
    reconnectAttempts: reconnectAttemptsRef.current,
  };
};