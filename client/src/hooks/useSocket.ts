import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { Message, Presence, PresenceMember } from '../types';

const SOCKET_URL = import.meta.env.VITE_API_URL || window.location.origin;

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

  /**
   * État de présence de la room, envoyé au seul arrivant lors du `cookbook:join`.
   *
   * Il est indispensable : `cookbook:joined` n'est diffusé qu'aux **autres** membres, si bien qu'un
   * arrivant ne saurait jamais qui est déjà là et verrait une liste vide jusqu'à la prochaine
   * arrivée.
   */
  const onPresence = useCallback((handler: (p: Presence) => void) => {
    socketRef.current?.on('cookbook:presence', handler);
    return () => { socketRef.current?.off('cookbook:presence', handler); };
  }, []);

  const onJoined = useCallback((handler: (m: PresenceMember & { cookbookId: string }) => void) => {
    socketRef.current?.on('cookbook:joined', handler);
    return () => { socketRef.current?.off('cookbook:joined', handler); };
  }, []);

  const onLeft = useCallback((handler: (m: PresenceMember & { cookbookId: string }) => void) => {
    socketRef.current?.on('cookbook:left', handler);
    return () => { socketRef.current?.off('cookbook:left', handler); };
  }, []);

  /**
   * Refus émis par le serveur — appartenance manquante, rôle insuffisant.
   *
   * Sans abonnement, le serveur refusait en silence : l'interface désactive déjà la saisie pour un
   * `READER`, donc le cas n'était atteignable qu'en la contournant, mais l'utilisateur n'avait alors
   * aucun retour.
   */
  const onSocketError = useCallback((handler: (reason: string) => void) => {
    socketRef.current?.on('error', handler);
    return () => { socketRef.current?.off('error', handler); };
  }, []);

  return {
    joinCookbook,
    leaveCookbook,
    sendMessage,
    onMessage,
    onPresence,
    onJoined,
    onLeft,
    onSocketError,
  };
}

export function disconnectSocket() {
  socketInstance?.disconnect();
  socketInstance = null;
}
