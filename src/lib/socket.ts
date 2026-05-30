import { io, Socket } from "socket.io-client";

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:4000";

let socketInstance: Socket | null = null;

/**
 * Register an externally-created socket (e.g. from SocketContext) so that
 * `getSocket()` returns the same connected instance used for chat.
 * This fixes the bug where call event listeners were attached to a
 * separate, unauthenticated socket and never received call:incoming events.
 */
export function setExternalSocket(socket: Socket): void {
  socketInstance = socket;
}

/**
 * Return the shared socket instance.
 * If SocketContext already registered one via `setExternalSocket`, that is
 * returned. Otherwise a new socket is created (standalone mode).
 */
export function getSocket(token?: string): Socket {
  if (socketInstance) {
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