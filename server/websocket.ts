import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { IncomingMessage } from "http";

interface Client {
  ws: WebSocket;
  userId: number | null;
  subscriptions: Set<string>;
}

const clients = new Map<WebSocket, Client>();

export function setupWebSocket(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const client: Client = { ws, userId: null, subscriptions: new Set() };
    clients.set(ws, client);

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        switch (msg.type) {
          case "auth":
            client.userId = msg.userId;
            break;
          case "subscribe":
            if (msg.channel) client.subscriptions.add(msg.channel);
            break;
          case "unsubscribe":
            if (msg.channel) client.subscriptions.delete(msg.channel);
            break;
        }
      } catch { /* ignore malformed */ }
    });

    ws.on("close", () => {
      clients.delete(ws);
    });

    ws.send(JSON.stringify({ type: "connected", message: "WebSocket connected" }));
  });

  return wss;
}

export function broadcast(event: string, data: any, channel?: string) {
  const message = JSON.stringify({ type: event, ...data });
  for (const client of clients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      if (!channel || client.subscriptions.has(channel)) {
        client.ws.send(message);
      }
    }
  }
}

export function notifyUser(userId: number, event: string, data: any) {
  const message = JSON.stringify({ type: event, ...data });
  for (const client of clients.values()) {
    if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  }
}
