import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "./use-auth";
import { queryClient } from "@/lib/queryClient";

type EventHandler = (data: any) => void;

const listeners = new Map<string, Set<EventHandler>>();
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let userId: number | null = null;

function connect() {
  if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  try {
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      if (userId) {
        socket?.send(JSON.stringify({ type: "auth", userId }));
      }
      subscribeToChannels();
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const handlers = listeners.get(msg.type);
        if (handlers) {
          handlers.forEach((fn) => fn(msg));
        }
        // Auto-invalidate queries based on event type
        handleAutoInvalidation(msg);
      } catch { /* ignore */ }
    };

    socket.onclose = () => {
      socket = null;
      reconnectTimer = setTimeout(connect, 3000);
    };

    socket.onerror = () => {
      socket?.close();
    };
  } catch {
    reconnectTimer = setTimeout(connect, 3000);
  }
}

function subscribeToChannels() {
  const channels = ["orders", "notifications", "dashboard", "products"];
  channels.forEach((ch) => {
    socket?.send(JSON.stringify({ type: "subscribe", channel: ch }));
  });
}

function handleAutoInvalidation(msg: any) {
  switch (msg.type) {
    case "order_updated":
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      break;
    case "notification_new":
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      break;
    case "product_updated":
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      break;
    case "store_synced":
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      break;
    case "dashboard_update":
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      break;
  }
}

export function useWebSocket() {
  const { user } = useAuth();
  const prevUserId = useRef<number | null>(null);

  useEffect(() => {
    const uid = Number(user?.id);
    if (uid && uid !== prevUserId.current) {
      userId = uid;
      prevUserId.current = uid;
      if (socket?.readyState === WebSocket.OPEN) {
        if (user) socket.send(JSON.stringify({ type: "auth", userId: user.id }));
      }
    }
  }, [user?.id]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  const subscribe = useCallback((event: string, handler: EventHandler) => {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event)!.add(handler);
    return () => {
      listeners.get(event)?.delete(handler);
    };
  }, []);

  return { subscribe, isConnected: socket?.readyState === WebSocket.OPEN };
}
