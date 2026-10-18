import { NextRequest, NextResponse } from "next/server";
import { getDb, hashPassword, SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/db";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const authEnabledRow = db
      .prepare("SELECT value FROM settings WHERE key = 'auth_enabled'")
      .get() as { value: string } | undefined;
    const authEnabled = authEnabledRow ? authEnabledRow.value === "1" : true;
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const authenticated = verifySessionToken(token);

    return NextResponse.json({
      authenticated,
      authEnabled,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();
    const { action, password, newPassword, authEnabled } = body;

    if (action === "login") {
      const stored = db
        .prepare("SELECT value FROM settings WHERE key = 'admin_password_hash'")
        .get() as { value: string } | undefined;

      const envPassword = process.env.ADMIN_PASSWORD;
      const inputHash = hashPassword(password || "");
      const valid =
        (stored && stored.value === inputHash) ||
        (envPassword && password === envPassword);

      if (!valid) {
        return NextResponse.json(
          { error: "Hatalı şifre! Lütfen tekrar deneyin." },
          { status: 401 }
        );
      }

      const token = crypto.randomBytes(32).toString("hex");
      db.prepare(
        "INSERT INTO sessions (token, expires_at) VALUES (?, datetime('now', '+30 days'))"
      ).run(token);

      const res = NextResponse.json({ success: true, authenticated: true });
      res.cookies.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      return res;
    }

    if (action === "logout") {
      const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
      if (token) {
        db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
      }
      const res = NextResponse.json({ success: true, authenticated: false });
      res.cookies.delete(SESSION_COOKIE_NAME);
      return res;
    }

    if (action === "update_security") {
      const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
      if (!verifySessionToken(token)) {
        return NextResponse.json({ error: "Yetkisiz işlem" }, { status: 401 });
      }

      if (newPassword && newPassword.trim().length >= 4) {
        db.prepare(
          "INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_password_hash', ?)"
        ).run(hashPassword(newPassword.trim()));
      }

      if (typeof authEnabled === "boolean") {
        db.prepare(
          "INSERT OR REPLACE INTO settings (key, value) VALUES ('auth_enabled', ?)"
        ).run(authEnabled ? "1" : "0");
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
