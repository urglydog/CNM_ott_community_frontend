import { io, Socket } from "socket.io-client";

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:4000";

let socketInstance: Socket | null = null;

export function getSocket(token?: string): Socket {
  if (socketInstance?.connected) {
    return socketInstance;
  }

  socketInstance = io(WS_URL, {
    auth: token ? { token } : {},
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  return socketInstance;
}

export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

export { WS_URL };