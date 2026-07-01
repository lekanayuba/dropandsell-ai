import { db } from "./db";
import { orders } from "@shared/schema";
import { eq, and, inArray, lte, isNotNull } from "drizzle-orm";
import { updateEbayOrderStatus } from "./platforms/ebay";
import { storage } from "./storage";
import { sendTrackingUpdate } from "./email";

const CARRIER_TRACKING_URLS: Record<string, (tracking: string) => string> = {
  "royal mail": (t) => `https://www.royalmail.com/track-your-item#/tracking-results/${t}`,
  "ups": (t) => `https://www.ups.com/track?tracknum=${t}`,
  "dhl": (t) => `https://www.dhl.com/en/express/tracking.html?AWB=${t}`,
  "fedex": (t) => `https://www.fedex.com/fedextrack/?trknbr=${t}`,
  "usps": (t) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`,
  "evri": (t) => `https://www.evri.com/tracking/#/parcel/${t}`,
  "dpd": (t) => `https://track.dpd.co.uk/parcel/${t}`,
  "parcelforce": (t) => `https://www.parcelforce.com/track-trace?trackNumber=${t}`,
};

function getTrackingUrl(carrier: string, trackingNumber: string): string {
  const normalizedCarrier = carrier.toLowerCase().trim();
  const builder = CARRIER_TRACKING_URLS[normalizedCarrier];
  return builder ? builder(trackingNumber) : "";
}

// Simple tracking status check via tracking API
// Uses the free PostPone/17Track API or falls back to carrier URL generation
async function checkTrackingStatus(
  trackingNumber: string,
  carrier: string,
): Promise<{ status: "pending" | "in_transit" | "delivered" | "failed"; statusText: string }> {
  const apiKey = process.env.TRACKING_API_KEY;

  if (apiKey) {
    try {
      const carrierMap: Record<string, string> = {
        "royal mail": "royal-mail",
        "ups": "ups",
        "dhl": "dhl",
        "fedex": "fedex",
        "usps": "usps",
        "evri": "hermes",
        "dpd": "dpd",
        "parcelforce": "parcelforce",
      };

      const normalizedCarrier = carrier.toLowerCase().trim();
      const apiCarrier = carrierMap[normalizedCarrier] || normalizedCarrier;

      // Try 17Track API (free tier available)
      const res = await fetch("https://api.17track.net/track/v2.2/gettrackinfo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "17token": apiKey,
        },
        body: JSON.stringify([{ number: trackingNumber, carrier: apiCarrier }]),
      });

      if (res.ok) {
        const data = await res.json();
        const accepted = data.data?.accepted?.[0];
        if (accepted?.track) {
          const trackData = accepted.track;
          const statusCode = trackData.e;
          if (statusCode === 30) {
            return { status: "delivered", statusText: "Delivered" };
          } else if (statusCode >= 10 && statusCode <= 29) {
            return { status: "in_transit", statusText: "In Transit" };
          } else if (statusCode >= 40) {
            return { status: "failed", statusText: "Exception" };
          } else if (statusCode >= 1 && statusCode <= 9) {
            return { status: "in_transit", statusText: "Pre-Transit" };
          }
          return { status: "in_transit", statusText: trackData.z ?? "In Transit" };
        }
        const rejected = data.data?.rejected?.[0];
        if (rejected) {
          console.warn(`[Tracking] 17Track rejected ${trackingNumber}: ${rejected.err_msg || 'unknown'}`);
        }
      }
    } catch (err) {
      console.error(`[Tracking] API check failed for ${trackingNumber}:`, err);
    }
  }

  // Without API key, generate tracking URL for manual reference
  const url = getTrackingUrl(carrier, trackingNumber);
  if (!url) {
    return { status: "pending", statusText: "Tracking number registered" };
  }

  return { status: "in_transit", statusText: `Track at ${new URL(url).hostname}` };
}

export async function monitorTracking(): Promise<void> {
  try {
    // Step 0: pull tracking from eBay for unfulfilled eBay orders
    try {
      const { syncEbayFulfillmentTracking } = await import("./platforms/ebay");
      const synced = await syncEbayFulfillmentTracking();
      if (synced > 0) {
        console.log(`[TrackingMonitor] Synced ${synced} tracking numbers from eBay`);
      }
    } catch (err) {
      console.error("[TrackingMonitor] eBay tracking sync error:", err);
    }

    // Find orders that are shipped but not yet delivered, checked >1h ago
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const pendingOrders = await db.select().from(orders).where(
      and(
        isNotNull(orders.trackingNumber),
        inArray(orders.trackingStatus, ["pending", "in_transit"]),
        lte(orders.trackingUpdatedAt ?? new Date(0), oneHourAgo),
      ),
    );

    if (pendingOrders.length === 0) return;
    console.log(`[TrackingMonitor] Checking ${pendingOrders.length} orders...`);

    for (const order of pendingOrders) {
      try {
        const { status, statusText } = await checkTrackingStatus(
          order.trackingNumber!,
          order.carrier ?? "",
        );

        await db.update(orders)
          .set({ trackingStatus: status, trackingUpdatedAt: new Date() })
          .where(eq(orders.id, order.id));

        if (status !== order.trackingStatus) {
          // Notify customer via email on any status change
          if (order.customerEmail) {
            sendTrackingUpdate(
              order.customerEmail,
              order.customerName,
              order.trackingNumber!,
              status,
              order.carrier ?? "",
            );
          }
        }

        if (status === "delivered" && order.trackingStatus !== "delivered") {
          await storage.createNotification({
            userId: order.userId,
            type: "order_delivered",
            title: `Order #${order.id} Delivered`,
            message: `Order #${order.id} has been marked as delivered. Tracking: ${order.trackingNumber}`,
            orderId: order.id,
          });

          // Sync to eBay if it has an external order ID
          if (order.externalOrderId) {
            await updateEbayOrderStatus(
              order.externalOrderId,
              "DELIVERED",
              order.trackingNumber!,
              order.carrier ?? "",
              order.storeId ?? undefined,
            );
          }
        }

        console.log(`[TrackingMonitor] Order #${order.id}: ${status} — ${statusText}`);
      } catch (err) {
        console.error(`[TrackingMonitor] Failed to check order #${order.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[TrackingMonitor] Error:", err);
  }
}

export function getTrackingUrlForOrder(carrier: string, trackingNumber: string): string {
  return getTrackingUrl(carrier, trackingNumber);
}
