import { Server } from "socket.io";
import jwt from "jsonwebtoken";

let ioInstance = null;
const userIdToSockets = new Map(); // userId -> Set<socket>

export const initIO = (httpServer) => {
  if (ioInstance) return ioInstance;

  // Use configurable CORS origins for Socket.io
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : ["http://localhost:3000", "http://localhost:3001"];

  ioInstance = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  ioInstance.use((socket, next) => {
    try {
      const { token } = socket.handshake.auth || {};
      if (!token) return next(new Error("unauthorized"));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = String(payload.id);
      next();
    } catch (e) {
      next(e);
    }
  });

  ioInstance.on("connection", (socket) => {
    const userId = socket.userId;
    if (!userIdToSockets.has(userId)) userIdToSockets.set(userId, new Set());
    userIdToSockets.get(userId).add(socket);

    // send snapshot of online users
    try {
      socket.emit("presence:snapshot", Array.from(userIdToSockets.keys()));
    } catch (err) {
      console.error("[Socket] Error emitting presence snapshot:", err.message);
    }

    // notify others (except sender) that this user is online
    try {
      socket.broadcast.emit("presence:update", { userId, online: true });
    } catch (err) {
      console.error("[Socket] Error broadcasting presence:update:", err.message);
    }

    socket.on("disconnect", () => {
      const set = userIdToSockets.get(userId);
      if (set) {
        set.delete(socket);
        if (set.size === 0) userIdToSockets.delete(userId);
      }
      // notify others (except sender) that this user is offline
      try {
        socket.broadcast.emit("presence:update", { userId, online: false });
      } catch (err) {
        console.error("[Socket] Error broadcasting disconnect:", err.message);
      }
    });

    // typing indicator relay with error handling
    socket.on("chat:typing", ({ toUserId, typing }) => {
      if (!socket.userId || !toUserId) {
        console.warn("[Socket] Missing userId or toUserId in typing event");
        return;
      }
      try {
        emitToUser(String(toUserId), "chat:typing", {
          fromUserId: String(socket.userId),
          typing: !!typing,
        });
      } catch (err) {
        console.error("[Socket] Error emitting typing indicator:", err.message);
      }
    });
  });

  return ioInstance;
};

export const emitToUser = (userId, event, payload) => {
  const set = userIdToSockets.get(String(userId));
  if (!set) {
    console.warn(`[Socket] User ${userId} not connected or no sockets available`);
    return;
  }
  for (const s of set) {
    try {
      s.emit(event, payload);
    } catch (err) {
      console.error(`[Socket] Error emitting ${event} to user ${userId}:`, err.message);
    }
  }
};

export const getIO = () => ioInstance;

export const isUserOnline = (userId) => userIdToSockets.has(String(userId));
