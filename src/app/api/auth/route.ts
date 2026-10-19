import { NextRequest, NextResponse } from "next/server";
import {
  getDb,
  hashPassword,
  legacyHashPassword,
  safeCompareHex,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/db";
import crypto from "crypto";

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim().slice(0, 64);
  }
  return req.headers.get("x-real-ip")?.slice(0, 64) || "127.0.0.1";
}

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
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();
    const { action, password, newPassword, authEnabled } = body;
    const clientIp = getClientIp(req);

    if (action === "login") {
      // Check Brute-Force Rate Limit
      const attemptRow = db
        .prepare(
          "SELECT attempts, locked_until, CASE WHEN locked_until != '' AND datetime(locked_until) > datetime('now') THEN 1 ELSE 0 END as is_locked FROM login_attempts WHERE ip = ?"
        )
        .get(clientIp) as
        | { attempts: number; locked_until: string; is_locked: number }
        | undefined;

      if (attemptRow && attemptRow.is_locked === 1) {
        return NextResponse.json(
          {
            error:
              "Çok fazla başarısız giriş denemesi! Güvenlik nedeniyle 5 dakika kilitlendi.",
          },
          { status: 429 }
        );
      }

      const stored = db
        .prepare("SELECT value FROM settings WHERE key = 'admin_password_hash'")
        .get() as { value: string } | undefined;

      const envPassword = process.env.ADMIN_PASSWORD;
      const rawPassword = String(password || "");
      const pbkdf2Hash = hashPassword(rawPassword);
      const sha256Hash = legacyHashPassword(rawPassword);

      const valid =
        (stored &&
          (safeCompareHex(stored.value, pbkdf2Hash) ||
            safeCompareHex(stored.value, sha256Hash))) ||
        Boolean(envPassword && rawPassword === envPassword);

      if (!valid) {
        const nextAttempts = (attemptRow?.attempts || 0) + 1;
        if (nextAttempts >= 5) {
          db.prepare(
            "INSERT OR REPLACE INTO login_attempts (ip, attempts, locked_until) VALUES (?, ?, datetime('now', '+5 minutes'))"
          ).run(clientIp, nextAttempts);
        } else {
          db.prepare(
            "INSERT OR REPLACE INTO login_attempts (ip, attempts, locked_until) VALUES (?, ?, '')"
          ).run(clientIp, nextAttempts);
        }

        return NextResponse.json(
          {
            error: `Hatalı şifre! (${Math.max(0, 5 - nextAttempts)} deneme hakkınız kaldı)`,
          },
          { status: 401 }
        );
      }

      // Reset brute-force counter on success & upgrade hash to PBKDF2 if needed
      db.prepare("DELETE FROM login_attempts WHERE ip = ?").run(clientIp);
      if (stored && stored.value === sha256Hash) {
        db.prepare(
          "INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_password_hash', ?)"
        ).run(pbkdf2Hash);
      }

      // Cleanup expired sessions
      db.prepare("DELETE FROM sessions WHERE datetime(expires_at) <= datetime('now')").run();

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

      if (newPassword && String(newPassword).trim().length >= 4) {
        db.prepare(
          "INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_password_hash', ?)"
        ).run(hashPassword(String(newPassword).trim()));
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
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
