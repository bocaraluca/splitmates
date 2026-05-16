import http from "node:http";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import { initializeSocket } from "./src/lib/socket-manager.ts";
import { prisma } from "./src/lib/prisma.ts";

const isProduction = process.argv.includes("--production") || process.env.NODE_ENV === "production";
const isDevelopment = process.argv.includes("--dev") || !isProduction;
const hostname = process.env.HOST ?? "0.0.0.0";
const port = 4000;

const app = next({ dev: isDevelopment, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

try {
  await prisma.$queryRaw`SELECT 1`;
  console.log("Database connection successful");
} catch (error) {
  console.error("Failed to connect to database:", error);
  process.exit(1);
}

const server = http.createServer((request, response) => {
  void handle(request, response);
});

try {
  await initializeSocket(server);
  console.log("Socket.IO initialized successfully");
} catch (error) {
  console.error("Failed to initialize Socket.IO:", error);
}

const websocketServer = new WebSocketServer({ noServer: true });
const sockets = new Set();

globalThis.__splitmatesBroadcastWebSocket = (payload) => {
  const message = JSON.stringify(payload);
  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(message);
    } else {
      sockets.delete(socket);
    }
  }
};

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${hostname}:${port}`}`);
  if (url.pathname !== "/ws") {
    return;
  }

  websocketServer.handleUpgrade(request, socket, head, (websocket) => {
    websocketServer.emit("connection", websocket, request);
  });
});

websocketServer.on("connection", (websocket) => {
  sockets.add(websocket);
  websocket.on("close", () => sockets.delete(websocket));
  websocket.on("error", () => sockets.delete(websocket));
  websocket.send(JSON.stringify({ type: "connected", timestamp: new Date().toISOString(), data: { ok: true } }));
});

server.listen(port, hostname, () => {
  console.log(`SplitMates backend ready at http://${hostname}:${port} (${isDevelopment ? "dev" : "prod"})`);
  console.log(`WebSocket ready for real-time chat on port ${port}`);
});