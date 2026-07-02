import { db } from "./db";
import { orders } from "@shared/schema";
import { eq, and, inArray, lte, isNotNull, isNull, or } from "drizzle-orm";
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
        or(
          isNull(orders.trackingUpdatedAt),
          lte(orders.trackingUpdatedAt, oneHourAgo),
        ),
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

// Auto-detect carrier from tracking number pattern (for supplier tracking conversion)
export function detectCarrier(trackingNumber: string): string | null {
  const t = trackingNumber.trim().toUpperCase();

  // UPS: 1Z + alphanumeric
  if (/^1Z[A-Z0-9]{16,18}$/i.test(t)) return "ups";
  // FedEx: 12-15 digits, or FX/RF prefix
  if (/^(FX|RF|D\.P\.|W\.B\.)/i.test(t) || /^\d{12,15}$/.test(t)) return "fedex";
  // USPS: 20-22 digits starting with 9, or 2 letters + 9 digits + US
  if (/^(94|93|92|91|90|95|96|97|98|99)\d{18,20}$/.test(t) || /^[A-Z]{2}\d{9}US$/i.test(t)) return "usps";
  // DHL: starts with JD, or 10 digits, or 3 letters + 7 digits
  if (/^JD\d{18}/i.test(t) || /^\d{10}$/.test(t) || /^[A-Z]{3}\d{7}$/i.test(t)) return "dhl";
  // Royal Mail: 2 letters + 9 digits + GB
  if (/^[A-Z]{2}\d{9}GB$/i.test(t)) return "royal mail";
  // Evri/Hermes: starts with H, or 16 digits
  if (/^H[A-Z0-9]{12,15}$/i.test(t) || /^\d{16}$/.test(t)) return "evri";
  // DPD: 14 digits
  if (/^\d{14}$/.test(t)) return "dpd";
  // Parcelforce: starts with CF, CP, P, or 10-12 digits
  if (/^(CF|CP|PG|P[A-Z])/i.test(t) || /^\d{10,12}$/.test(t)) return "parcelforce";
  // China Post / AliExpress: starts with LP or CP
  if (/^LP\d{13,16}$/i.test(t) || /^CP\d{13,16}$/i.test(t) || /^[A-Z]{2}\d{9}CN$/i.test(t)) return "china post";
  // Australia Post: 3 letters + 7 digits
  if (/^[A-Z]{3}\d{7}$/i.test(t)) return "australia post";

  return null;
}
