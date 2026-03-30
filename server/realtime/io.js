import { Server } from "socket.io";
import jwt from "jsonwebtoken";

let ioInstance = null;
const userIdToSockets = new Map(); // userId -> Set<socket>

export const initIO = (httpServer) => {
  if (ioInstance) return ioInstance;
  ioInstance = new Server(httpServer, {
    cors: {
      origin: true,
      methods: ["GET", "POST"],
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
    } catch {}
    // notify others this user is online
    try { ioInstance.emit("presence:update", { userId, online: true }); } catch {}

    socket.on("disconnect", () => {
      const set = userIdToSockets.get(userId);
      if (set) {
        set.delete(socket);
        if (set.size === 0) userIdToSockets.delete(userId);
      }
      // notify others this user is offline
      try { ioInstance.emit("presence:update", { userId, online: false }); } catch {}
    });

    // typing indicator relay
    socket.on("chat:typing", ({ toUserId, typing }) => {
      if (!socket.userId || !toUserId) return;
      try {
        emitToUser(String(toUserId), "chat:typing", { fromUserId: String(socket.userId), typing: !!typing });
      } catch {}
    });
  });

  return ioInstance;
};

export const emitToUser = (userId, event, payload) => {
  const set = userIdToSockets.get(String(userId));
  if (!set) return;
  for (const s of set) {
    s.emit(event, payload);
  }
};

export const getIO = () => ioInstance;

export const isUserOnline = (userId) => userIdToSockets.has(String(userId));


