import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const SocketProvider = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // Initialize authenticated Socket.IO connection
    const newSocket = io(SOCKET_SERVER_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      console.log('[Socket Connected] Authenticated WebSocket connected.');
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[Socket Disconnected]', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.warn('[Socket Connect Error]', err.message);
      setIsConnected(false);
    });

    newSocket.on('account_deactivated', (data) => {
      console.warn('[Socket Account Deactivated]', data?.message);
      newSocket.disconnect();
      setIsConnected(false);
      setSocket(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('auth:session_revoked', {
            detail: {
              message:
                data?.message ||
                'Your account has been deactivated. Please contact the administrator for assistance.',
            },
          })
        );
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [isAuthenticated, token]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export default SocketContext;
