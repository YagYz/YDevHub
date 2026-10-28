import { getDb, getSetting, setSetting } from "./db";
import { getSystemStatus } from "./systemMonitor";

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
      title?: string;
      username?: string;
    };
    date: number;
    text?: string;
  };
}

let pollingAbortController: AbortController | null = null;
let isPolling = false;
let lastUpdateId = 0;

export function getBotConfig() {
  const token = getSetting("telegram_bot_token") || process.env.TELEGRAM_BOT_TOKEN || "";
  const chatId = getSetting("telegram_chat_id") || process.env.TELEGRAM_CHAT_ID || "";
  const enabled = getSetting("telegram_bot_enabled", "1") === "1";
  return { token, chatId, enabled };
}

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  parseMode: "HTML" | "Markdown" = "HTML"
): Promise<boolean> {
  const { token } = getBotConfig();
  if (!token) {
    console.warn("[TelegramBot] Token ayarlanmamış, mesaj gönderilemedi.");
    return false;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });

    const data = await res.json();
    if (!data.ok) {
      console.error("[TelegramBot] Mesaj gönderme hatası:", data.description);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error("[TelegramBot] Ağ hatası:", err.message);
    return false;
  }
}

export async function handleIncomingMessage(msg: NonNullable<TelegramUpdate["message"]>) {
  const text = (msg.text || "").trim();
  const senderChatId = String(msg.chat.id);
  const senderName = msg.from?.first_name || "Kullanıcı";
  let { chatId: configuredChatId } = getBotConfig();

  // Henüz chat_id ayarlanmadıysa ilk /start veya /pair ile eşleştir
  if (!configuredChatId) {
    if (text.startsWith("/start") || text.startsWith("/pair")) {
      setSetting("telegram_chat_id", senderChatId);
      configuredChatId = senderChatId;
      await sendTelegramMessage(
        senderChatId,
        `🎉 <b>YDevHub Bot Eşleştirildi!</b>\n\nHoş geldin ${senderName}. Bu sohbet yöneticiniz olarak kaydedildi (Chat ID: <code>${senderChatId}</code>).\n\nKomutları görmek için: /yardim`
      );
      return;
    } else {
      await sendTelegramMessage(
        senderChatId,
        `⚠️ Bot henüz bir yöneticiye bağlı değil. Eşleştirmek için <b>/start</b> yazınız.`
      );
      return;
    }
  }

  // Yetkisiz kullanıcı engelleme
  if (senderChatId !== configuredChatId) {
    console.warn(`[TelegramBot] Yetkisiz erişim denemesi: ChatID ${senderChatId}`);
    await sendTelegramMessage(
      senderChatId,
      "⛔ <b>Erişim Engellendi:</b> Bu bot kişisel YDevHub sunucusuna aittir."
    );
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const db = getDb();

  // Komutlar
  if (text === "/start" || text === "/yardim" || text === "/help") {
    const helpMsg = `⚡ <b>YDevHub Asistan Komutları</b>\n
📝 <b>Not Alma:</b>
• <i>Herhangi bir metin</i> yazıp gönderirseniz doğrudan bugünün gündelik notlarına eklenir.
• Veya: <code>/not [not içeriği]</code>

📋 <b>Görev Ekleme:</b>
• <code>/gorev [başlık]</code> - Hızlı görev ekler

📊 <b>Sistem & Süreç Kontrolü:</b>
• <code>/durum</code> veya <code>/ps</code> - Aktif Docker ve sunucu süreçlerini listeler
• <code>/bugun</code> - Bugünün notlarını ve bekleyen işleri döker

⚙️ <b>Yönetim:</b>
• <code>/yardim</code> - Bu yardım mesajını gösterir`;
    await sendTelegramMessage(senderChatId, helpMsg);
    return;
  }

  // /durum veya /ps
  if (text === "/durum" || text === "/ps" || text === "/sistem") {
    try {
      const status = await getSystemStatus();
      let report = `🖥️ <b>Sunucu Durumu: ${status.hostname}</b>\n`;
      report += `⏱️ <b>Çalışma Süresi:</b> ${status.uptimeHours} saat\n`;
      report += `🧠 <b>RAM:</b> ${status.memory.usedMb} MB / ${status.memory.totalMb} MB (%${status.memory.percentUsed})\n`;
      report += `⚙️ <b>CPU Yükü:</b> ${status.cpu.loadAvg.join(", ")} (${status.cpu.cores} Çekirdek)\n\n`;

      report += `🐳 <b>Docker Konteynerleri (${status.docker.runningCount}/${status.docker.containersCount} Aktif):</b>\n`;
      if (!status.docker.available) {
        report += `<i>⚠️ ${status.docker.error || "Docker socket bulunamadı"}</i>\n`;
      } else if (status.docker.containers.length === 0) {
        report += `<i>Hiç konteyner bulunamadı.</i>\n`;
      } else {
        for (const c of status.docker.containers) {
          const isUp = c.state === "running";
          const icon = isUp ? "🟢" : "🔴";
          const name = c.names[0] || c.id;
          report += `${icon} <b>${name}</b> (${c.status})\n`;
        }
      }

      await sendTelegramMessage(senderChatId, report);
    } catch (err: any) {
      await sendTelegramMessage(senderChatId, `❌ Sistem durumu alınırken hata oluştu: ${err.message}`);
    }
    return;
  }

  // /bugun
  if (text === "/bugun" || text === "/today") {
    const dailyNotes = db
      .prepare("SELECT * FROM daily_notes WHERE date = ? ORDER BY is_done ASC, created_at ASC")
      .all(today) as any[];

    const pendingTasks = db
      .prepare(
        "SELECT * FROM tasks WHERE status != 'done' AND (due_date = ? OR due_date = '' OR due_date IS NULL) ORDER BY priority DESC LIMIT 10"
      )
      .all(today) as any[];

    let rep = `📅 <b>Bugünün Özeti (${today})</b>\n\n`;
    rep += `📝 <b>Gündelik Notlar (${dailyNotes.length}):</b>\n`;
    if (dailyNotes.length === 0) {
      rep += `<i>Bugün için henüz not yok.</i>\n`;
    } else {
      for (const n of dailyNotes) {
        const check = n.is_done ? "✅ <s>" : "▫️ ";
        const end = n.is_done ? "</s>" : "";
        rep += `${check}${escapeHtml(n.content)}${end}\n`;
      }
    }

    rep += `\n📋 <b>Bekleyen Görevler (${pendingTasks.length}):</b>\n`;
    if (pendingTasks.length === 0) {
      rep += `<i>Bekleyen açık görev yok.</i>\n`;
    } else {
      for (const t of pendingTasks) {
        const timeStr = t.due_time ? ` [⏰ ${t.due_time}]` : "";
        rep += `• <b>${escapeHtml(t.title)}</b>${timeStr} (${t.priority})\n`;
      }
    }

    await sendTelegramMessage(senderChatId, rep);
    return;
  }

  // /gorev [başlık]
  if (text.startsWith("/gorev ") || text.startsWith("/task ")) {
    const taskTitle = text.replace(/^\/(gorev|task)\s+/, "").trim();
    if (!taskTitle) {
      await sendTelegramMessage(senderChatId, "⚠️ Lütfen görev başlığı yazınız: <code>/gorev Başlık</code>");
      return;
    }

    db.prepare(
      "INSERT INTO tasks (title, description, status, priority, tag, due_date) VALUES (?, '', 'todo', 'medium', 'telegram', ?)"
    ).run(taskTitle, today);

    await sendTelegramMessage(senderChatId, `✅ <b>Görev eklendi:</b> ${escapeHtml(taskTitle)}`);
    return;
  }

  // /not [içerik] veya doğrudan metin gönderme
  let noteContent = text;
  if (text.startsWith("/not ") || text.startsWith("/n ")) {
    noteContent = text.replace(/^\/(not|n)\s+/, "").trim();
  }

  if (noteContent) {
    db.prepare(
      "INSERT INTO daily_notes (content, date, is_done, priority, source) VALUES (?, ?, 0, 'medium', 'telegram')"
    ).run(noteContent, today);

    await sendTelegramMessage(
      senderChatId,
      `📝 <b>Gündelik nota kaydedildi:</b>\n"<i>${escapeHtml(noteContent)}</i>"`
    );
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function pollTelegramUpdates(): Promise<void> {
  const { token, enabled } = getBotConfig();
  if (!token || !enabled) return;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=20`,
      { signal: pollingAbortController?.signal }
    );

    if (!res.ok) {
      return;
    }

    const data = await res.json();
    if (data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        lastUpdateId = Math.max(lastUpdateId, update.update_id);
        if (update.message) {
          try {
            await handleIncomingMessage(update.message);
          } catch (err: any) {
            console.error("[TelegramBot] Mesaj işleme hatası:", err);
          }
        }
      }
    }
  } catch (err: any) {
    if (err.name !== "AbortError") {
      // transient network error, silently retry on next cycle
    }
  }
}

export function startTelegramPolling() {
  if (isPolling) return;
  const { token, enabled } = getBotConfig();
  if (!token || !enabled) {
    console.log("[TelegramBot] Token veya bot aktif değil, polling beklemede.");
    return;
  }

  isPolling = true;
  pollingAbortController = new AbortController();
  console.log("[TelegramBot] Telegram polling başlatıldı.");

  (async () => {
    while (isPolling) {
      await pollTelegramUpdates();
      // Küçük bekleme ile CPU yükünü ve flood'u önle
      await new Promise((r) => setTimeout(r, 1000));
    }
  })();
}

export function stopTelegramPolling() {
  isPolling = false;
  if (pollingAbortController) {
    pollingAbortController.abort();
    pollingAbortController = null;
  }
  console.log("[TelegramBot] Telegram polling durduruldu.");
}
