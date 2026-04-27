import { io } from 'socket.io-client'

// In production: frontend and backend are the same server → use current origin
// In development: connect to local backend
const SOCKET_URL = import.meta.env.VITE_BACKEND_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001')

export const socket = io(SOCKET_URL, {
  autoConnect: false // We connect manually when user is authenticated
})
