import { storage } from "./storage";
import { db } from "./db";
import { orders } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { notifyUser } from "./websocket";

interface FulfillmentResult {
  success: boolean;
  supplierNotified: boolean;
  message: string;
  estimatedDelivery?: string;
}

export async function autoFulfillOrder(orderId: number): Promise<FulfillmentResult> {
  try {
    const order = await storage.getOrder(orderId);
    if (!order) return { success: false, supplierNotified: false, message: "Order not found" };

    await storage.updateOrder(orderId, {
      fulfillmentStatus: "fulfilled",
      status: "shipped",
    });

    await storage.createNotification({
      userId: order.userId,
      type: "order_shipped",
      title: `Order #${orderId} — Awaiting Tracking`,
      message: `Order placed with supplier. Add the real tracking number when you receive it to notify the customer and update the marketplace.`,
      orderId,
    });

    notifyUser(Number(order.userId), "order_fulfilled", { orderId, needsTracking: true });

    return {
      success: true,
      supplierNotified: true,
      message: "Order placed with supplier. Add tracking from the Orders page to notify your customer.",
      estimatedDelivery: "5-10 business days",
    };
  } catch (err: any) {
    console.error(`[Fulfillment] Error fulfilling order #${orderId}:`, err.message);
    return { success: false, supplierNotified: false, message: err.message };
  }
}

export async function checkAndFulfillPendingOrders(): Promise<number> {
  try {
    const allOrders = await db.select().from(orders).where(
      and(eq(orders.status, "pending"), eq(orders.fulfillmentStatus, "unfulfilled"))
    );

    let fulfilledCount = 0;
    for (const order of allOrders) {
      try {
        const result = await autoFulfillOrder(order.id);
        if (result.success) fulfilledCount++;
      } catch (err) {
        console.error(`[Fulfillment] Failed to fulfill order #${order.id}:`, err);
      }
    }

    return fulfilledCount;
  } catch (err) {
    console.error("[Fulfillment] Error checking pending orders:", err);
    return 0;
  }
}
