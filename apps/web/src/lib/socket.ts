'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_URL } from './api';
import type { AutomationProgress } from './api';

export function useApplicationSocket(
  applicationId: string | null,
  onUpdate: (data: unknown) => void,
  onInputRequired: (data: unknown) => void,
  onProgress?: (progress: AutomationProgress) => void,
) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!applicationId) return;

    const socket = io(API_URL, {
      transports: ['websocket'],
      auth: { token: typeof window !== 'undefined' ? localStorage.getItem('token') : undefined },
    });
    socketRef.current = socket;

    socket.emit('subscribe', applicationId);
    socket.on('application:update', onUpdate);
    socket.on('application:input_required', onInputRequired);
    socket.on('job:event', (event: { payload?: AutomationProgress }) => {
      if (event?.payload && onProgress) {
        onProgress(event.payload);
      }
    });

    return () => {
      socket.emit('unsubscribe', applicationId);
      socket.disconnect();
    };
  }, [applicationId, onUpdate, onInputRequired, onProgress]);
}
