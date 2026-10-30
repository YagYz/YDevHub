import { getSetting } from "./db";

export interface YNetMonSummary {
  service: string;
  local_ip: string;
  capture_mode: string;
  rx_bps: number;
  tx_bps: number;
  active_connections: number;
  docker_containers: number;
  storage: {
    db_size_bytes: number;
    db_size_mb: number;
    packets_count: number;
    devices_count: number;
    alerts_count: number;
  };
  recent_alerts: Array<{
    id: number;
    timestamp: number;
    severity: string;
    rule_name: string;
    src_ip: string;
    message: string;
  }>;
}

export interface AdGuardStats {
  running: boolean;
  protection_enabled: boolean;
  dns_queries_24h: number;
  blocked_filtering_24h: number;
  blocked_percentage: number;
  top_blocked: Array<{ domain: string; count: number }>;
}

export function formatBitsPerSec(bps: number): string {
  if (bps >= 1_000_000) {
    return `${(bps / 1_000_000).toFixed(2)} Mbps`;
  }
  if (bps >= 1_000) {
    return `${(bps / 1_000).toFixed(1)} Kbps`;
  }
  return `${Math.round(bps)} bps`;
}

export async function getYNetMonSummary(): Promise<YNetMonSummary | null> {
  const url = getSetting("ynetmon_url") || process.env.YNETMON_URL || "http://10.10.50.1:8765";
  const apiKey = getSetting("ynetmon_api_key") || process.env.YNETMON_API_KEY || "ynetmon_secret_hub_key_2026";
  try {
    const res = await fetch(`${url}/api/v1/integration/summary`, {
      headers: { "X-API-Key": apiKey },
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function getAdGuardStats(): Promise<AdGuardStats | null> {
  const baseUrl = getSetting("adguard_url") || process.env.ADGUARD_URL || "http://10.10.50.1:8080";
  try {
    const [statusRes, statsRes] = await Promise.all([
      fetch(`${baseUrl}/control/status`, { signal: AbortSignal.timeout(3500) }),
      fetch(`${baseUrl}/control/stats`, { signal: AbortSignal.timeout(3500) }),
    ]);

    if (!statusRes.ok || !statsRes.ok) return null;

    const statusData = await statusRes.json();
    const statsData = await statsRes.json();

    const queries = statsData.num_dns_queries || 0;
    const blocked = statsData.num_blocked_filtering || 0;
    const pct = queries > 0 ? Math.round((blocked / queries) * 1000) / 10 : 0;

    const topBlocked: Array<{ domain: string; count: number }> = [];
    if (Array.isArray(statsData.top_blocked_domains)) {
      for (const item of statsData.top_blocked_domains.slice(0, 3)) {
        const domain = Object.keys(item)[0];
        if (domain) topBlocked.push({ domain, count: item[domain] });
      }
    }

    return {
      running: Boolean(statusData.running),
      protection_enabled: Boolean(statusData.protection_enabled),
      dns_queries_24h: queries,
      blocked_filtering_24h: blocked,
      blocked_percentage: pct,
      top_blocked: topBlocked,
    };
  } catch (err) {
    return null;
  }
}

export async function setAdGuardProtection(
  enabled: boolean,
  durationMinutes?: number
): Promise<{ success: boolean; message: string }> {
  const baseUrl = getSetting("adguard_url") || process.env.ADGUARD_URL || "http://10.10.50.1:8080";
  try {
    const payload: { enabled: boolean; duration?: number } = { enabled };
    if (!enabled && durationMinutes && durationMinutes > 0) {
      payload.duration = durationMinutes * 60 * 1000;
    }

    const res = await fetch(`${baseUrl}/control/protection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000),
    });

    if (res.ok) {
      if (enabled) {
        return { success: true, message: "🛡️ <b>AdGuard Koruması Açıldı!</b> DNS filtreleme devrede." };
      } else {
        const durStr = durationMinutes ? `${durationMinutes} dakika boyunca` : "geçici olarak";
        return { success: true, message: `⏸️ <b>AdGuard Koruması Durduruldu!</b> (${durStr})` };
      }
    }
    return { success: false, message: `AdGuard yanıt hatası: HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, message: `AdGuard bağlantı hatası: ${err.message}` };
  }
}
