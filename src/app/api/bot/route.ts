import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
  getSetting,
  setSetting,
} from "@/lib/db";
import {
  getBotConfig,
  sendTelegramMessage,
  startTelegramPolling,
  stopTelegramPolling,
  pollTelegramUpdates,
} from "@/lib/telegramBot";
import { checkMorningSummary, runSchedulerCycle } from "@/lib/scheduler";

export async function GET(req: NextRequest) {
  try {
    if (!verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { token, chatId, enabled } = getBotConfig();
    const morningTime = getSetting("morning_summary_time", "08:30");
    const lastSummaryDate = getSetting("morning_summary_last_date", "");

    // Mask token for security
    const maskedToken = token
      ? `${token.slice(0, 6)}...${token.slice(-4)}`
      : "";

    return NextResponse.json({
      configured: Boolean(token),
      tokenMasked: maskedToken,
      chatId,
      enabled,
      morningSummaryTime: morningTime,
      lastSummaryDate,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    // Ayarları güncelleme
    if (action === "update_settings") {
      if (body.token !== undefined) {
        setSetting("telegram_bot_token", String(body.token).trim());
      }
      if (body.chat_id !== undefined) {
        setSetting("telegram_chat_id", String(body.chat_id).trim());
      }
      if (body.enabled !== undefined) {
        setSetting("telegram_bot_enabled", body.enabled ? "1" : "0");
      }
      if (body.morning_summary_time !== undefined) {
        setSetting("morning_summary_time", String(body.morning_summary_time).trim());
      }

      // Polling servisini yeni ayarlarla tazele
      stopTelegramPolling();
      startTelegramPolling();

      return NextResponse.json({ success: true, message: "Ayarlar kaydedildi." });
    }

    // Test mesajı gönderme
    if (action === "test_message") {
      const { chatId } = getBotConfig();
      const targetChat = body.chat_id || chatId;
      if (!targetChat) {
        return NextResponse.json(
          { error: "Gönderilecek Chat ID bulunamadı." },
          { status: 400 }
        );
      }

      const testText =
        body.text ||
        "🚀 <b>YDevHub Telegram Bot Testi</b>\n\nBağlantı başarıyla kuruldu! Komutları görmek için <code>/yardim</code> yazabilirsiniz.";

      const ok = await sendTelegramMessage(targetChat, testText);
      if (!ok) {
        return NextResponse.json(
          { error: "Mesaj iletilemedi. Token ve Chat ID'yi kontrol edin." },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, message: "Test mesajı iletildi." });
    }

    // Sabah özeti manuel tetikleme
    if (action === "trigger_morning_summary") {
      // Geçici olarak last_date'i sıfırlayıp zorla çalıştır
      setSetting("morning_summary_last_date", "");
      await checkMorningSummary();
      return NextResponse.json({ success: true, message: "Sabah özeti tetiklendi." });
    }

    // Anlık döngü tetikleme
    if (action === "cycle_now") {
      await pollTelegramUpdates();
      await runSchedulerCycle();
      return NextResponse.json({ success: true, message: "Döngü çalıştırıldı." });
    }

    return NextResponse.json({ error: "Geçersiz işlem (action)" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
