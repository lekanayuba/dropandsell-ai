import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { IncomingMessage } from "http";
import { getSession } from "./replit_integrations/auth/replitAuth";

interface Client {
  ws: WebSocket;
  userId: string | null;
  subscriptions: Set<string>;
}

const clients = new Map<WebSocket, Client>();
const sessionMiddleware = getSession();

function getSessionUserId(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve) => {
    sessionMiddleware(req as any, {} as any, (err?: unknown) => {
      if (err) {
        console.warn("[WebSocket] Session lookup failed:", err);
        resolve(null);
        return;
      }

      const sessionUserId = (req as any).session?.userId;
      resolve(sessionUserId ? String(sessionUserId) : null);
    });
  });
}

export function setupWebSocket(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const client: Client = { ws, userId: null, subscriptions: new Set() };
    clients.set(ws, client);

    getSessionUserId(req).then((sessionUserId) => {
      if (!clients.has(ws) || ws.readyState !== WebSocket.OPEN) return;
      client.userId = sessionUserId;
      ws.send(JSON.stringify({
        type: "authenticated",
        authenticated: Boolean(sessionUserId),
      }));
    }).catch((err) => {
      console.warn("[WebSocket] Failed to authenticate connection:", err);
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        switch (msg.type) {
          case "auth":
            ws.send(JSON.stringify({
              type: "authenticated",
              authenticated: Boolean(client.userId),
            }));
            break;
          case "subscribe":
            if (client.userId && msg.channel) client.subscriptions.add(msg.channel);
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

export function notifyUser(userId: string, event: string, data: any) {
  const message = JSON.stringify({ type: event, ...data });
  for (const client of clients.values()) {
    if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  }
}
