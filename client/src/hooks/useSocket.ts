import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { Message } from '../types';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let socketInstance: Socket | null = null;

export function useSocket() {
  const { accessToken, isAuthenticated } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    if (!socketInstance) {
      socketInstance = io(SOCKET_URL, {
        auth: { token: accessToken },
        path: '/socket.io',
        transports: ['websocket', 'polling'],
      });
    }

    socketRef.current = socketInstance;

    return () => {
      // Don't disconnect on unmount — keep socket alive
    };
  }, [isAuthenticated, accessToken]);

  const joinCookbook = useCallback((cookbookId: string) => {
    socketRef.current?.emit('cookbook:join', cookbookId);
  }, []);

  const leaveCookbook = useCallback((cookbookId: string) => {
    socketRef.current?.emit('cookbook:leave', cookbookId);
  }, []);

  const sendMessage = useCallback((cookbookId: string, content: string) => {
    socketRef.current?.emit('cookbook:sendMessage', { cookbookId, content });
  }, []);

  const onMessage = useCallback((handler: (msg: Message) => void) => {
    socketRef.current?.on('cookbook:message', handler);
    return () => { socketRef.current?.off('cookbook:message', handler); };
  }, []);

  return { joinCookbook, leaveCookbook, sendMessage, onMessage };
}

export function disconnectSocket() {
  socketInstance?.disconnect();
  socketInstance = null;
}
