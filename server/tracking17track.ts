const API_BASE = 'https://api.17track.net/track/v2.4';

function getToken(): string | null {
  return process.env.TRACKING_API_KEY || null;
}

async function call(endpoint: string, body: any): Promise<any> {
  const token = getToken();
  if (!token) {
    throw new Error('TRACKING_API_KEY is not configured');
  }
  const resp = await fetch(`${API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: {
      '17token': token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    throw new Error(`17track ${endpoint} HTTP ${resp.status}`);
  }
  return await resp.json();
}

// Map 17track v2.4 main status to a friendly label + colour keyword the UI understands.
const STATUS_MAP: Record<string, { label: string; tone: string }> = {
  NotFound: { label: 'Not Found', tone: 'gray' },
  InfoReceived: { label: 'Info Received', tone: 'yellow' },
  InTransit: { label: 'In Transit', tone: 'blue' },
  Expired: { label: 'Expired', tone: 'gray' },
  AvailableForPickup: { label: 'Ready for Pickup', tone: 'purple' },
  OutForDelivery: { label: 'Out for Delivery', tone: 'indigo' },
  DeliveryFailure: { label: 'Delivery Failed', tone: 'red' },
  Delivered: { label: 'Delivered', tone: 'green' },
  Exception: { label: 'Exception', tone: 'red' },
};

export interface NormalizedTracking {
  provider: '17track';
  status: string;        // raw 17track status, e.g. 'InTransit'
  statusLabel: string;   // friendly label, e.g. 'In Transit'
  tone: string;          // colour keyword for the UI badge
  subStatus?: string | null;
  lastEvent?: string | null;
  lastEventTime?: string | null;
  lastLocation?: string | null;
  checkedAt: string;
  registered: boolean;
  notFound?: boolean;
}

export function friendlyStatus(raw: string | undefined | null): { label: string; tone: string } {
  if (!raw) return { label: 'Pending', tone: 'gray' };
  return STATUS_MAP[raw] || { label: raw, tone: 'gray' };
}

export function isDeliveredStatus(raw: string | undefined | null): boolean {
  return raw === 'Delivered';
}

// Register tracking numbers so 17track begins crawling them. Consumes 1 quota per NEW number.
// Numbers already registered are returned in `rejected` with an "already exists" style error — that's fine.
export async function registerTracking(numbers: string[]): Promise<{ accepted: string[]; rejected: Record<string, string> }> {
  const clean = Array.from(new Set(numbers.map((n) => (n || '').trim()).filter(Boolean)));
  const accepted: string[] = [];
  const rejected: Record<string, string> = {};
  if (clean.length === 0) return { accepted, rejected };

  // 17track accepts up to 40 numbers per call.
  for (let i = 0; i < clean.length; i += 40) {
    const batch = clean.slice(i, i + 40).map((number) => ({ number }));
    const json = await call('register', batch);
    for (const a of json?.data?.accepted || []) {
      if (a?.number) accepted.push(a.number);
    }
    for (const r of json?.data?.rejected || []) {
      if (r?.number) rejected[r.number] = r?.error?.message || 'rejected';
    }
  }
  return { accepted, rejected };
}

// Fetch current tracking status for the given numbers.
export async function getTrackInfo(numbers: string[]): Promise<Map<string, NormalizedTracking>> {
  const clean = Array.from(new Set(numbers.map((n) => (n || '').trim()).filter(Boolean)));
  const result = new Map<string, NormalizedTracking>();
  if (clean.length === 0) return result;
  const now = new Date().toISOString();

  for (let i = 0; i < clean.length; i += 40) {
    const batch = clean.slice(i, i + 40).map((number) => ({ number }));
    const json = await call('gettrackinfo', batch);

    for (const item of json?.data?.accepted || []) {
      const number = item?.number;
      if (!number) continue;
      const ti = item?.track_info || {};
      const rawStatus = ti?.latest_status?.status || 'InfoReceived';
      const fr = friendlyStatus(rawStatus);
      const ev = ti?.latest_event || {};
      result.set(number, {
        provider: '17track',
        status: rawStatus,
        statusLabel: fr.label,
        tone: fr.tone,
        subStatus: ti?.latest_status?.sub_status || null,
        lastEvent: ev?.description || null,
        lastEventTime: ev?.time_iso || ev?.time_utc || null,
        lastLocation: ev?.location || null,
        checkedAt: now,
        registered: true,
      });
    }

    for (const item of json?.data?.rejected || []) {
      const number = item?.number;
      if (!number) continue;
      const msg: string = item?.error?.message || '';
      const code = item?.error?.code;
      // -18019909 = "No tracking information at this time" (registered but nothing yet).
      // -18019902 = number does not exist / not registered.
      const notRegistered = code === -18019902 || /not.*register|does not exist/i.test(msg);
      result.set(number, {
        provider: '17track',
        status: 'Pending',
        statusLabel: 'Pending',
        tone: 'gray',
        lastEvent: msg || null,
        checkedAt: now,
        registered: !notRegistered,
        notFound: notRegistered,
      });
    }
  }
  return result;
}
