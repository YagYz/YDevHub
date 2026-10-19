import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/db";
import net from "net";

function isValidHost(host: string): boolean {
  return /^[a-zA-Z0-9.-]{1,253}$/.test(host);
}

function checkTcpPort(
  host: string,
  port: number,
  timeoutMs = 1500
): Promise<{ online: boolean; latencyMs: number }> {
  return new Promise((resolve) => {
    if (!isValidHost(host) || port < 1 || port > 65535 || !Number.isInteger(port)) {
      resolve({ online: false, latencyMs: 0 });
      return;
    }

    const start = Date.now();
    const socket = new net.Socket();

    const onError = () => {
      socket.destroy();
      resolve({ online: false, latencyMs: 0 });
    };

    socket.setTimeout(timeoutMs);
    socket.once("error", onError);
    socket.once("timeout", onError);

    socket.connect(port, host, () => {
      const latencyMs = Date.now() - start;
      socket.end();
      resolve({ online: true, latencyMs });
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    if (!verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { targets } = await req.json();
    if (!Array.isArray(targets)) {
      return NextResponse.json({ results: {} });
    }

    const results: Record<number, { online: boolean; latencyMs: number }> = {};

    await Promise.all(
      targets.slice(0, 50).map(async (t) => {
        if (!t.port) {
          results[t.id] = { online: false, latencyMs: 0 };
          return;
        }
        const host = String(t.host || "127.0.0.1").trim();
        results[t.id] = await checkTcpPort(host, Number(t.port));
      })
    );

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Health check failed" }, { status: 500 });
  }
}
