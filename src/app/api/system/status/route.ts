import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/db";
import { getSystemStatus } from "@/lib/systemMonitor";

export async function GET(req: NextRequest) {
  try {
    if (!verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const status = await getSystemStatus();
    return NextResponse.json(status);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
