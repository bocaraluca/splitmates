import http from "node:http";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";

const isProduction = process.argv.includes("--production") || process.env.NODE_ENV === "production";
const isDevelopment = process.argv.includes("--dev") || !isProduction;
const hostname = "localhost";
const port = 4000;

const app = next({ dev: isDevelopment, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const server = http.createServer((request, response) => {
  void handle(request, response);
});

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
    socket.destroy();
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
});