import { NextRequest, NextResponse } from "next/server";
import net from "net";

function checkTcpPort(host: string, port: number, timeoutMs = 1500): Promise<{ online: boolean; latencyMs: number }> {
  return new Promise((resolve) => {
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
    const { targets } = await req.json();
    // targets: Array<{ id: number; host: string; port: number }>
    if (!Array.isArray(targets)) {
      return NextResponse.json({ results: {} });
    }

    const results: Record<number, { online: boolean; latencyMs: number }> = {};

    await Promise.all(
      targets.map(async (t) => {
        if (!t.port) {
          results[t.id] = { online: false, latencyMs: 0 };
          return;
        }
        const host = t.host || "127.0.0.1";
        results[t.id] = await checkTcpPort(host, Number(t.port));
      })
    );

    return NextResponse.json({ results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
