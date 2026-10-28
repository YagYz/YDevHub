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

export function resolveDateString(str: string, now: Date = new Date()): { iso: string; label: string } | null {
  const pad = (n: number) => String(n).padStart(2, "0");
  const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const clean = str.replace(/[\[\]]/g, "").trim().toLowerCase();

  if (clean === "bugun" || clean === "bugün" || clean === "today") {
    return { iso: formatDate(now), label: "Bugün" };
  }
  if (clean === "yarin" || clean === "yarın" || clean === "tomorrow") {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { iso: formatDate(tomorrow), label: `Yarın (${formatDate(tomorrow)})` };
  }
  if (clean === "dun" || clean === "dün" || clean === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return { iso: formatDate(yesterday), label: `Dün (${formatDate(yesterday)})` };
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return { iso: clean, label: clean };
  }

  // DD.MM.YYYY
  const ddmmyyyy = clean.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ddmmyyyy) {
    const iso = `${ddmmyyyy[3]}-${pad(Number(ddmmyyyy[2]))}-${pad(Number(ddmmyyyy[1]))}`;
    return { iso, label: iso };
  }

  // DD.MM (bu yıl)
  const ddmm = clean.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (ddmm) {
    const iso = `${now.getFullYear()}-${pad(Number(ddmm[2]))}-${pad(Number(ddmm[1]))}`;
    return { iso, label: iso };
  }

  return null;
}

export function resolveTimeString(str: string): string | null {
  const clean = str.replace(/[\[\]]/g, "").trim();
  const timeMatch = clean.match(/^([0-1]?[0-9]|2[0-3])[:.]([0-5][0-9])$/);
  if (timeMatch) {
    const h = String(timeMatch[1]).padStart(2, "0");
    const m = String(timeMatch[2]).padStart(2, "0");
    return `${h}:${m}`;
  }
  return null;
}

export function parseDateAndContent(raw: string): {
  targetDate: string;
  targetTime: string;
  content: string;
  dateLabel: string;
} {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  let text = raw.trim();
  let targetDate = formatDate(now);
  let targetTime = "";
  let dateLabel = "Bugün";

  // 1) Köşeli parantez: [yarin 14:30] veya [14:30] veya [30.10]
  const bracketMatch = text.match(/^\[(.*?)\]\s*(.*)$/s);
  if (bracketMatch) {
    const tag = bracketMatch[1].trim();
    const rest = bracketMatch[2].trim();
    const tagParts = tag.split(/\s+/);

    for (const part of tagParts) {
      const d = resolveDateString(part, now);
      if (d) {
        targetDate = d.iso;
        dateLabel = d.label;
        continue;
      }
      const t = resolveTimeString(part);
      if (t) {
        targetTime = t;
        continue;
      }
    }
    text = rest;
  }

  // 2) Başlangıçtaki kelimeleri tara (tarih ve/veya saat)
  // Örn: "yarin 15:00 toplantı" veya "15:00 toplantı" veya "30.10 14:00 bakım"
  let words = text.split(/\s+/);
  let changed = true;

  while (changed && words.length > 1) {
    changed = false;
    const w = words[0];
    const d = resolveDateString(w, now);
    if (d) {
      targetDate = d.iso;
      dateLabel = d.label;
      words.shift();
      changed = true;
      continue;
    }
    const t = resolveTimeString(w);
    if (t) {
      targetTime = t;
      words.shift();
      changed = true;
      continue;
    }
  }

  text = words.join(" ").trim();

  // 3) İçerik sonundaki veya ortasındaki "saat 15:30" veya "15:30" kalıbını da yakala
  if (!targetTime) {
    const inlineTime = text.match(/\b(?:saat\s+)?([0-1]?[0-9]|2[0-3])[:.]([0-5][0-9])\b/i);
    if (inlineTime) {
      const h = String(inlineTime[1]).padStart(2, "0");
      const m = String(inlineTime[2]).padStart(2, "0");
      targetTime = `${h}:${m}`;
    }
  }

  return { targetDate, targetTime, content: text, dateLabel };
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
📋 <b>Görev Yönetimi & 1 Saat Kala Hatırlatma:</b>
• <code>/gorev [başlık]</code> - Bugün için genel görev ekler
• <code>/gorev 15:30 [başlık]</code> - Bugün saat 15:30 için görev <i>(14:30'da otomatik hatırlatır!)</i>
• <code>/gorev yarin 14:00 [başlık]</code> - Yarın saat 14:00 için görev
• <code>/gorev 30.10 11:00 [başlık]</code> - Belirli gün ve saat
• <code>/tamam [ID]</code> veya <code>/tamamla [ID]</code> - Görevi tamamlandı yapar!

📝 <b>Not Alma & Tarih Seçimi:</b>
• <i>Düz metin:</i> Doğrudan bugünün notlarına ekler.
• <code>/not [not]</code> - Bugünün notlarına ekler
• <code>/not yarin [not]</code> veya <code>/not [yarin] [not]</code> - Yarının notlarına ekler
• <code>/not YYYY-AA-GG [not]</code> veya <code>/not GG.AA [not]</code> - Belirli güne ekler

📊 <b>Sistem & Süreç Kontrolü:</b>
• <code>/durum</code> veya <code>/ps</code> - Aktif Docker ve sunucu süreçlerini listeler
• <code>/bugun</code> - Bugünün notlarını ve görevlerini (ID numaralarıyla) döker

⚙️ <b>Yönetim:</b>
• <code>/yardim</code> - Bu yardım mesajını gösterir`;
    await sendTelegramMessage(senderChatId, helpMsg);
    return;
  }

  // /tamam [id] veya /tamamla [id] veya /done [id]
  if (text.startsWith("/tamam") || text.startsWith("/done") || text.startsWith("/bitir")) {
    const rawId = text.replace(/^\/(tamamla|tamam|done|bitir)\s*/i, "").replace(/^#/, "").trim();
    const targetId = parseInt(rawId, 10);
    if (isNaN(targetId) || targetId <= 0) {
      await sendTelegramMessage(
        senderChatId,
        "⚠️ Lütfen tamamlanacak görev veya not ID'sini belirtin.\nÖrnek: <code>/tamam 5</code>"
      );
      return;
    }

    // 1) Görevlerde ara
    const task = db
      .prepare("SELECT id, title, status FROM tasks WHERE id = ?")
      .get(targetId) as { id: number; title: string; status: string } | undefined;

    if (task) {
      db.prepare("UPDATE tasks SET status = 'done' WHERE id = ?").run(targetId);
      await sendTelegramMessage(
        senderChatId,
        `✅ <b>Görev Tamamlandı!</b>\n📌 <b>[#${task.id}]</b> <s>${escapeHtml(task.title)}</s>`
      );
      return;
    }

    // 2) Gündelik notlarda ara
    const dailyNote = db
      .prepare("SELECT id, content, is_done, date FROM daily_notes WHERE id = ?")
      .get(targetId) as { id: number; content: string; is_done: number; date: string } | undefined;

    if (dailyNote) {
      db.prepare("UPDATE daily_notes SET is_done = 1 WHERE id = ?").run(targetId);
      await sendTelegramMessage(
        senderChatId,
        `✅ <b>Gündelik Not Tamamlandı!</b>\n📝 <b>[#${dailyNote.id}]</b> <s>${escapeHtml(dailyNote.content)}</s> (${dailyNote.date})`
      );
      return;
    }

    await sendTelegramMessage(
      senderChatId,
      `❌ <b>Bulunamadı:</b> #${targetId} numaralı açık görev veya not bulunamadı.`
    );
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
        "SELECT * FROM tasks WHERE status != 'done' AND (due_date = ? OR due_date = '' OR due_date IS NULL) ORDER BY priority DESC LIMIT 15"
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
        rep += `${check}<b>[#${n.id}]</b> ${escapeHtml(n.content)}${end}\n`;
      }
    }

    rep += `\n📋 <b>Bekleyen Görevler (${pendingTasks.length}):</b>\n`;
    if (pendingTasks.length === 0) {
      rep += `<i>Bekleyen açık görev yok.</i>\n`;
    } else {
      for (const t of pendingTasks) {
        const timeStr = t.due_time ? ` [⏰ ${t.due_time}]` : "";
        rep += `• <b>[#${t.id}]</b> <b>${escapeHtml(t.title)}</b>${timeStr} (${t.priority})\n`;
      }
      rep += `\n💡 <i>Görevi tamamlamak için:</i> <code>/tamam &lt;ID&gt;</code>\n`;
    }

    await sendTelegramMessage(senderChatId, rep);
    return;
  }

  // /gorev [başlık]
  if (text.startsWith("/gorev ") || text.startsWith("/task ")) {
    const rawTask = text.replace(/^\/(gorev|task)\s+/, "").trim();
    if (!rawTask) {
      await sendTelegramMessage(
        senderChatId,
        "⚠️ Lütfen görev başlığı yazınız: <code>/gorev [tarih] [saat] Başlık</code>\nÖrnek: <code>/gorev 15:30 Sunucu bakımı</code>"
      );
      return;
    }

    const { targetDate, targetTime, content, dateLabel } = parseDateAndContent(rawTask);
    if (!content) {
      await sendTelegramMessage(senderChatId, "⚠️ Lütfen görev başlığı yazınız.");
      return;
    }

    const info = db.prepare(
      "INSERT INTO tasks (title, description, status, priority, tag, due_date, due_time, reminder_sent) VALUES (?, '', 'todo', 'medium', 'telegram', ?, ?, 0)"
    ).run(content, targetDate, targetTime || null);

    const newTaskId = Number(info.lastInsertRowid);
    const timeDisplay = targetTime ? ` ⏰ <b>${targetTime}</b> <i>(1 saat önce hatırlatılır)</i>` : "";

    await sendTelegramMessage(
      senderChatId,
      `✅ <b>Görev Eklendi!</b>\n📌 <b>[#${newTaskId}]</b> ${escapeHtml(content)}\n📅 <b>Tarih/Saat:</b> ${dateLabel}${timeDisplay}\n\n💡 <i>Tamamlamak için:</i> <code>/tamam ${newTaskId}</code>`
    );
    return;
  }

  // /not veya /n tek başına gönderilirse format yardımı
  if (text === "/not" || text === "/n") {
    await sendTelegramMessage(
      senderChatId,
      `⚠️ <b>Not Ekleme Formatı:</b>\n• <code>/not [içerik]</code> (Bugün)\n• <code>/not yarin [içerik]</code> (Yarın)\n• <code>/not 2026-10-31 [içerik]</code> (Tarih)\n• <code>/not 30.10 14:00 [içerik]</code> (Tarih + Saat)`
    );
    return;
  }

  // /not [içerik] veya doğrudan düz metin gönderme
  let noteRaw = text;
  if (text.startsWith("/not ") || text.startsWith("/n ")) {
    noteRaw = text.replace(/^\/(not|n)\s+/, "").trim();
  }

  if (noteRaw) {
    const { targetDate, targetTime, content, dateLabel } = parseDateAndContent(noteRaw);

    if (!content) {
      await sendTelegramMessage(senderChatId, "⚠️ Lütfen kaydedilecek not içeriğini yazınız.");
      return;
    }

    const info = db.prepare(
      "INSERT INTO daily_notes (content, date, is_done, priority, source) VALUES (?, ?, 0, 'medium', 'telegram')"
    ).run(content, targetDate);

    const noteId = Number(info.lastInsertRowid);
    const timeDisplay = targetTime ? ` ⏰ ${targetTime}` : "";

    await sendTelegramMessage(
      senderChatId,
      `📝 <b>Gündelik Nota Kaydedildi (${dateLabel}${timeDisplay}):</b>\n<b>[#${noteId}]</b> "<i>${escapeHtml(content)}</i>"\n\n💡 <i>Tamamlamak için:</i> <code>/tamam ${noteId}</code>`
    );
    return;
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
