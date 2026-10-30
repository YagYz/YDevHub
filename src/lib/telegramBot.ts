import { getDb, getSetting, setSetting } from "./db";
import { getSystemStatus, restartDockerContainer } from "./systemMonitor";
import {
  getYNetMonSummary,
  getAdGuardStats,
  setAdGuardProtection,
  formatBitsPerSec,
} from "./integrations";

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

const TURKISH_MONTHS: Record<string, number> = {
  ocak: 1,
  subat: 2,
  şubat: 2,
  mart: 3,
  nisan: 4,
  mayis: 5,
  mayıs: 5,
  haziran: 6,
  temmuz: 7,
  agustos: 8,
  ağustos: 8,
  eylul: 9,
  eylül: 9,
  ekim: 10,
  kasim: 11,
  kasım: 11,
  aralik: 12,
  aralık: 12,
};

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

  // YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD
  const yyyymmdd = clean.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (yyyymmdd) {
    const y = Number(yyyymmdd[1]);
    const m = Number(yyyymmdd[2]);
    const d = Number(yyyymmdd[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const iso = `${y}-${pad(m)}-${pad(d)}`;
      return { iso, label: iso };
    }
  }

  // DD-MM-YYYY, DD.MM.YYYY, DD/MM/YYYY
  const ddmmyyyy = clean.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/);
  if (ddmmyyyy) {
    const d = Number(ddmmyyyy[1]);
    const m = Number(ddmmyyyy[2]);
    const y = Number(ddmmyyyy[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const iso = `${y}-${pad(m)}-${pad(d)}`;
      return { iso, label: iso };
    }
  }

  // DD-MM, DD.MM, DD/MM (bu yıl)
  const ddmm = clean.match(/^(\d{1,2})[-./](\d{1,2})$/);
  if (ddmm) {
    const d = Number(ddmm[1]);
    const m = Number(ddmm[2]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const iso = `${now.getFullYear()}-${pad(m)}-${pad(d)}`;
      return { iso, label: iso };
    }
  }

  return null;
}

export function resolveTimeString(str: string): string | null {
  const clean = str.replace(/[\[\]]/g, "").trim().toLowerCase();
  const stripped = clean.replace(/^(?:saat|saati)\s*/i, "").replace(/['’](?:te|ta|de|da)$/i, "");
  const timeMatch = stripped.match(/^([0-1]?[0-9]|2[0-3])[:.]([0-5][0-9])$/);
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

  // 1) Köşeli parantez: [yarin 14:30] veya [04-11-2026 14:00] veya [4 kasım 14:00]
  const bracketMatch = text.match(/^\[(.*?)\]\s*(.*)$/s);
  if (bracketMatch) {
    const tag = bracketMatch[1].trim();
    const rest = bracketMatch[2].trim();
    const tagParts = tag.split(/\s+/);

    let i = 0;
    while (i < tagParts.length) {
      const dayNum = Number(tagParts[i]);
      if (dayNum >= 1 && dayNum <= 31 && i + 1 < tagParts.length) {
        const monthKey = tagParts[i + 1].toLowerCase();
        if (TURKISH_MONTHS[monthKey]) {
          const m = TURKISH_MONTHS[monthKey];
          let y = now.getFullYear();
          let advance = 2;
          if (i + 2 < tagParts.length && /^\d{4}$/.test(tagParts[i + 2])) {
            y = Number(tagParts[i + 2]);
            advance = 3;
          }
          targetDate = `${y}-${pad(m)}-${pad(dayNum)}`;
          dateLabel = targetDate;
          i += advance;
          continue;
        }
      }

      const d = resolveDateString(tagParts[i], now);
      if (d) {
        targetDate = d.iso;
        dateLabel = d.label;
        i++;
        continue;
      }
      const t = resolveTimeString(tagParts[i]);
      if (t) {
        targetTime = t;
        i++;
        continue;
      }
      i++;
    }
    text = rest;
  }

  // 2) Başlangıçtaki kelimeleri tara (tarih ve/veya saat)
  let words = text.split(/\s+/);
  let changed = true;

  while (changed && words.length > 0) {
    changed = false;

    // "saat 14:00" kalıbı
    if (words[0].toLowerCase().startsWith("saat") && words.length > 1) {
      const nextT = resolveTimeString(words[1]);
      if (nextT) {
        targetTime = nextT;
        words.splice(0, 2);
        changed = true;
        continue;
      }
    }

    // "4 kasım 2026" veya "4 kasım" kalıbı
    const dayNum = Number(words[0]);
    if (dayNum >= 1 && dayNum <= 31 && words.length > 1) {
      const monthKey = words[1].toLowerCase();
      if (TURKISH_MONTHS[monthKey]) {
        const m = TURKISH_MONTHS[monthKey];
        let y = now.getFullYear();
        let removeCount = 2;
        if (words.length > 2 && /^\d{4}$/.test(words[2])) {
          y = Number(words[2]);
          removeCount = 3;
        }
        targetDate = `${y}-${pad(m)}-${pad(dayNum)}`;
        dateLabel = targetDate;
        words.splice(0, removeCount);
        changed = true;
        continue;
      }
    }

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

  text = text.replace(/^[-–—:\s]+/, "").trim();

  return { targetDate, targetTime, content: text, dateLabel };
}

export function parseTargetIdentifier(raw: string): { type: "task" | "note" | "auto"; id: number } | null {
  const clean = raw.trim().toLowerCase();

  // "n2", "n-2", "not 2", "not-2"
  const notPrefix = clean.match(/^(?:not|n)[-_\s]?(\d+)$/i);
  if (notPrefix) {
    return { type: "note", id: parseInt(notPrefix[1], 10) };
  }

  // "g2", "g-2", "gorev 2", "task 2", "t2"
  const taskPrefix = clean.match(/^(?:gorev|task|g|t)[-_\s]?(\d+)$/i);
  if (taskPrefix) {
    return { type: "task", id: parseInt(taskPrefix[1], 10) };
  }

  // Pure number "2", "#2"
  const pureNum = clean.match(/^#?(\d+)$/);
  if (pureNum) {
    return { type: "auto", id: parseInt(pureNum[1], 10) };
  }

  return null;
}

export function computePostponedTimeAndDate(
  currentDate: string,
  currentTime: string,
  argsStr: string
): { newDate: string; newTime: string; label: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  let targetDate = currentDate || formatDate(now);
  let targetTime = currentTime || "";
  const raw = argsStr.trim().toLowerCase();

  // Boş veya "+1" / "1 saat" / "1s" / "60"
  if (!raw || raw === "1 saat" || raw === "1s" || raw === "+1" || raw === "60" || raw === "+1h") {
    let baseHour = now.getHours();
    let baseMin = now.getMinutes();
    if (targetTime) {
      const parts = targetTime.split(":").map(Number);
      baseHour = parts[0];
      baseMin = parts[1];
    }
    const dt = new Date(now);
    dt.setHours(baseHour + 1, baseMin, 0, 0);
    targetTime = `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    if (dt.getDate() !== now.getDate()) {
      targetDate = formatDate(dt);
    }
    return { newDate: targetDate, newTime: targetTime, label: `1 Saat (${targetTime})` };
  }

  // "2 saat" / "2s" / "+2"
  if (raw === "2 saat" || raw === "2s" || raw === "+2") {
    let baseHour = now.getHours();
    let baseMin = now.getMinutes();
    if (targetTime) {
      const parts = targetTime.split(":").map(Number);
      baseHour = parts[0];
      baseMin = parts[1];
    }
    const dt = new Date(now);
    dt.setHours(baseHour + 2, baseMin, 0, 0);
    targetTime = `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    if (dt.getDate() !== now.getDate()) {
      targetDate = formatDate(dt);
    }
    return { newDate: targetDate, newTime: targetTime, label: `2 Saat (${targetTime})` };
  }

  // "yarin", "30.10", "16:00" vb. ayrıştırma
  const parsed = parseDateAndContent(raw);
  return {
    newDate: parsed.targetDate,
    newTime: parsed.targetTime || targetTime,
    label: `${parsed.dateLabel}${parsed.targetTime ? " " + parsed.targetTime : ""}`,
  };
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
  if (/^[/]?(?:start|yardim|help)$/i.test(text)) {
    const helpMsg = `⚡ <b>YDevHub Asistan Komutları</b>\n
📋 <b>Görev Yönetimi & Hatırlatma:</b>
• <code>/gorev [başlık]</code> - Genel görev ekler
• <code>/gorev 15:30 [başlık]</code> - Saatli görev (1 saat önce hatırlatır)
• <code>/gorev 04-11-2026 14:00 [başlık]</code> - Tarihli ve saatli görev
• <code>/tamam g2</code> - [G-2] numaralı görevi tamamlar
• <code>/ertele g2</code> - Görevi 1 saat erteler
• <code>/ertele g2 yarin</code> - Görevi yarına erteler

📝 <b>Not Alma & Erteleme:</b>
• <i>Düz metin:</i> Doğrudan bugünün notlarına ekler.
• <code>/not [not]</code> veya <code>not [not]</code> - Bugünün notlarına ekler
• <code>/not 04-11-2026 14:00 [not]</code> - Belirli tarih ve saate ekler
• <code>/tamam n2</code> - [N-2] notunu tamamlar
• <code>/ertele n2</code> - Notu yarına erteler

🌐 <b>Ağ & DNS (YNetMon & AdGuard):</b>
• <code>/ag</code> - YNetMon anlık bant genişliği, aktif bağlantı ve alarmlar
• <code>/dns</code> - AdGuard 24 saatlik reklam/tehdit engelleme raporu
• <code>/dns kapat 10m</code> - DNS korumasını 10 dakika duraklatır
• <code>/dns ac</code> - DNS korumasını tekrar açar

🐳 <b>Sistem & Konteyner:</b>
• <code>/durum</code> veya <code>/ps</code> - Aktif Docker ve sunucu süreçleri
• <code>/restart [konteyner]</code> - Konteyneri yeniden başlatır (örn: <code>/restart ynetmon</code>)
• <code>/bugun</code> - Bugünün notlarını ve bekleyen görevlerini döker

⚙️ <b>Yönetim:</b>
• <code>/yardim</code> - Bu yardım mesajını gösterir`;
    await sendTelegramMessage(senderChatId, helpMsg);
    return;
  }

  // tamam, /tamam, ntamam, /ntamam, gtamam, /gtamam
  const isDedicatedNoteDone = /^[/]?(?:ntamam|nottamama)\b/i.test(text);
  const isDedicatedTaskDone = /^[/]?(?:gtamam|gorevtamam)\b/i.test(text);
  const isGenericDone = /^[/]?(?:tamamla|tamam|done|bitir)\b/i.test(text);

  if (isDedicatedNoteDone || isDedicatedTaskDone || isGenericDone) {
    let rawArg = "";
    let forcedType: "note" | "task" | null = null;

    if (isDedicatedNoteDone) {
      rawArg = text.replace(/^[/]?(?:ntamam|nottamama)\s*/i, "").trim();
      forcedType = "note";
    } else if (isDedicatedTaskDone) {
      rawArg = text.replace(/^[/]?(?:gtamam|gorevtamam)\s*/i, "").trim();
      forcedType = "task";
    } else {
      rawArg = text.replace(/^[/]?(?:tamamla|tamam|done|bitir)\s*/i, "").trim();
    }

    const parsedTarget = parseTargetIdentifier(rawArg);
    if (!parsedTarget) {
      await sendTelegramMessage(
        senderChatId,
        `⚠️ Lütfen tamamlanacak ID'yi belirtin.\n• <b>Not için:</b> <code>/tamam n2</code>\n• <b>Görev için:</b> <code>/tamam g2</code>`
      );
      return;
    }

    const targetType = forcedType || parsedTarget.type;
    const targetId = parsedTarget.id;

    if (targetType === "note") {
      const dailyNote = db
        .prepare("SELECT id, content, is_done, date FROM daily_notes WHERE id = ?")
        .get(targetId) as { id: number; content: string; is_done: number; date: string } | undefined;

      if (!dailyNote) {
        await sendTelegramMessage(senderChatId, `❌ <b>[N-${targetId}]</b> numaralı gündelik not bulunamadı.`);
        return;
      }
      db.prepare("UPDATE daily_notes SET is_done = 1 WHERE id = ?").run(targetId);
      await sendTelegramMessage(
        senderChatId,
        `✅ <b>Gündelik Not Tamamlandı!</b>\n📝 <b>[N-${dailyNote.id}]</b> <s>${escapeHtml(dailyNote.content)}</s> (${dailyNote.date})`
      );
      return;
    }

    if (targetType === "task") {
      const task = db
        .prepare("SELECT id, title, status FROM tasks WHERE id = ?")
        .get(targetId) as { id: number; title: string; status: string } | undefined;

      if (!task) {
        await sendTelegramMessage(senderChatId, `❌ <b>[G-${targetId}]</b> numaralı görev bulunamadı.`);
        return;
      }
      db.prepare("UPDATE tasks SET status = 'done' WHERE id = ?").run(targetId);
      await sendTelegramMessage(
        senderChatId,
        `✅ <b>Görev Tamamlandı!</b>\n📌 <b>[G-${task.id}]</b> <s>${escapeHtml(task.title)}</s>`
      );
      return;
    }

    // Otomatik ayrıştırma (saf numara örn: /tamam 2)
    const task = db
      .prepare("SELECT id, title, status FROM tasks WHERE id = ?")
      .get(targetId) as { id: number; title: string; status: string } | undefined;

    const dailyNote = db
      .prepare("SELECT id, content, is_done, date FROM daily_notes WHERE id = ?")
      .get(targetId) as { id: number; content: string; is_done: number; date: string } | undefined;

    // İkisi de varsa ve ikisi de açıksa kullanıcıya net seçenek sun
    if (task && dailyNote && task.status !== "done" && dailyNote.is_done === 0) {
      await sendTelegramMessage(
        senderChatId,
        `⚠️ <b>Birden Fazla Eşleşme Var (#${targetId}):</b>\n• Notu tamamlamak için: <code>/tamam n${targetId}</code>\n• Görevi tamamlamak için: <code>/tamam g${targetId}</code>`
      );
      return;
    }

    if (dailyNote && dailyNote.is_done === 0) {
      db.prepare("UPDATE daily_notes SET is_done = 1 WHERE id = ?").run(targetId);
      await sendTelegramMessage(
        senderChatId,
        `✅ <b>Gündelik Not Tamamlandı!</b>\n📝 <b>[N-${dailyNote.id}]</b> <s>${escapeHtml(dailyNote.content)}</s> (${dailyNote.date})`
      );
      return;
    }

    if (task) {
      db.prepare("UPDATE tasks SET status = 'done' WHERE id = ?").run(targetId);
      await sendTelegramMessage(
        senderChatId,
        `✅ <b>Görev Tamamlandı!</b>\n📌 <b>[G-${task.id}]</b> <s>${escapeHtml(task.title)}</s>`
      );
      return;
    }

    if (dailyNote) {
      db.prepare("UPDATE daily_notes SET is_done = 1 WHERE id = ?").run(targetId);
      await sendTelegramMessage(
        senderChatId,
        `✅ <b>Gündelik Not Tamamlandı!</b>\n📝 <b>[N-${dailyNote.id}]</b> <s>${escapeHtml(dailyNote.content)}</s> (${dailyNote.date})`
      );
      return;
    }

    await sendTelegramMessage(senderChatId, `❌ #${targetId} numaralı açık görev veya not bulunamadı.`);
    return;
  }

  // ertele, /ertele [hedef] [süre/saat/gün]
  if (/^[/]?(?:ertele|snooze|postpone)\b/i.test(text)) {
    const rawRest = text.replace(/^[/]?(?:ertele|snooze|postpone)\s*/i, "").trim();
    if (!rawRest) {
      await sendTelegramMessage(
        senderChatId,
        `⚠️ <b>Erteleme Kullanımı:</b>\n• <code>/ertele g2</code> (1 saat ertele)\n• <code>/ertele g2 15:30</code> (Saati 15:30 yap)\n• <code>/ertele g2 yarin</code> (Yarına ertele)\n• <code>/ertele n2</code> veya <code>/ertele n2 yarin</code> (Notu yarına ertele)`
      );
      return;
    }

    const match = rawRest.match(/^(\S+)(?:\s+(.*))?$/s);
    const targetToken = match ? match[1] : rawRest;
    const snoozeArgs = match && match[2] ? match[2].trim() : "";

    const parsedTarget = parseTargetIdentifier(targetToken);
    if (!parsedTarget) {
      await sendTelegramMessage(
        senderChatId,
        `⚠️ Geçersiz hedef. Örnek: <code>/ertele g2 1 saat</code> veya <code>/ertele n2 yarin</code>`
      );
      return;
    }

    let targetType = parsedTarget.type;
    const targetId = parsedTarget.id;

    if (targetType === "auto") {
      const task = db.prepare("SELECT id FROM tasks WHERE id = ?").get(targetId);
      const note = db.prepare("SELECT id FROM daily_notes WHERE id = ?").get(targetId);
      if (task && note) {
        await sendTelegramMessage(
          senderChatId,
          `⚠️ <b>Birden Fazla Eşleşme Var (#${targetId}):</b>\n• Görev için: <code>/ertele g${targetId} ${snoozeArgs}</code>\n• Not için: <code>/ertele n${targetId} ${snoozeArgs}</code>`
        );
        return;
      }
      targetType = task ? "task" : "note";
    }

    if (targetType === "note") {
      const note = db
        .prepare("SELECT * FROM daily_notes WHERE id = ?")
        .get(targetId) as any;

      if (!note) {
        await sendTelegramMessage(senderChatId, `❌ <b>[N-${targetId}]</b> numaralı gündelik not bulunamadı.`);
        return;
      }

      const postponed = computePostponedTimeAndDate(note.date, note.due_time || "", snoozeArgs || "yarin");
      db.prepare("UPDATE daily_notes SET date = ?, due_time = ?, is_done = 0 WHERE id = ?").run(
        postponed.newDate,
        postponed.newTime || "",
        targetId
      );

      const timeStr = postponed.newTime ? ` ⏰ <b>${postponed.newTime}</b>` : "";
      await sendTelegramMessage(
        senderChatId,
        `⏰ <b>Gündelik Not Ertelendi!</b>\n📝 <b>[N-${note.id}]</b> ${escapeHtml(note.content)}\n📅 <b>Yeni Zaman:</b> ${postponed.newDate}${timeStr}`
      );
      return;
    }

    // Görev Erteleme
    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(targetId) as any;
    if (!task) {
      await sendTelegramMessage(senderChatId, `❌ <b>[G-${targetId}]</b> numaralı görev bulunamadı.`);
      return;
    }

    const postponed = computePostponedTimeAndDate(task.due_date, task.due_time, snoozeArgs);
    db.prepare(
      "UPDATE tasks SET due_date = ?, due_time = ?, reminder_sent = 0, status = 'todo' WHERE id = ?"
    ).run(postponed.newDate, postponed.newTime || null, targetId);

    const timeStr = postponed.newTime ? ` ⏰ <b>${postponed.newTime}</b>` : "";
    await sendTelegramMessage(
      senderChatId,
      `⏰ <b>Görev Ertelendi!</b>\n📌 <b>[G-${task.id}]</b> ${escapeHtml(task.title)}\n📅 <b>Yeni Zaman:</b> ${postponed.newDate}${timeStr}\n<i>(1 saat kala tekrar hatırlatılacak)</i>`
    );
    return;
  }

  // durum, /durum, ps, /ps, sistem, /sistem
  if (/^[/]?(?:durum|ps|sistem)$/i.test(text)) {
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

  // restart, /restart, reboot, /reboot [konteyner]
  if (/^[/]?(?:restart|reboot)\b/i.test(text)) {
    const rawTarget = text.replace(/^[/]?(?:restart|reboot)[:\s]*/i, "").trim();
    if (!rawTarget) {
      await sendTelegramMessage(
        senderChatId,
        "⚠️ Lütfen yeniden başlatılacak konteyner adını yazın.\nÖrnek: <code>/restart ynetmon</code> veya <code>/restart adguard</code>"
      );
      return;
    }

    await sendTelegramMessage(
      senderChatId,
      `🔄 <code>${escapeHtml(rawTarget)}</code> yeniden başlatılıyor, lütfen bekleyin...`
    );
    const res = await restartDockerContainer(rawTarget);
    await sendTelegramMessage(senderChatId, res.message);
    return;
  }

  // ag, /ag, ynetmon, /ynetmon, net, /net
  if (/^[/]?(?:ag|ynetmon|net|agdurum)$/i.test(text)) {
    try {
      const summary = await getYNetMonSummary();
      if (!summary) {
        await sendTelegramMessage(
          senderChatId,
          "⚠️ <b>YNetMon servisine ulaşılamadı.</b> Servis kapalı veya entegrasyon anahtarı eksik olabilir."
        );
        return;
      }

      const rx = formatBitsPerSec(summary.rx_bps || 0);
      const tx = formatBitsPerSec(summary.tx_bps || 0);

      let rep = `🌐 <b>YNetMon Canlı Ağ ve Güvenlik Raporu</b>\n`;
      rep += `🏠 <b>Sunucu IP:</b> <code>${summary.local_ip}</code>\n`;
      rep += `📡 <b>Yakalama Modu:</b> <code>${summary.capture_mode}</code>\n\n`;
      rep += `⚡ <b>Anlık Bant Genişliği:</b>\n`;
      rep += `⬇️ İndirme: <b>${rx}</b> | ⬆️ Yükleme: <b>${tx}</b>\n\n`;
      rep += `🔗 <b>Aktif Bağlantılar:</b> ${summary.active_connections}\n`;
      rep += `📱 <b>Ağdaki Cihazlar:</b> ${summary.storage?.devices_count || 0}\n`;
      rep += `📦 <b>Kaydedilen Paket:</b> ${(summary.storage?.packets_count || 0).toLocaleString("tr-TR")}\n`;
      rep += `🗄️ <b>Veritabanı Boyutu:</b> ${summary.storage?.db_size_mb || 0} MB\n`;

      if (summary.recent_alerts && summary.recent_alerts.length > 0) {
        rep += `\n🚨 <b>Son Güvenlik Alarmları (${summary.recent_alerts.length}):</b>\n`;
        for (const a of summary.recent_alerts.slice(0, 3)) {
          const icon = a.severity === "high" ? "🔴" : "🟡";
          rep += `${icon} <b>${escapeHtml(a.rule_name)}</b>\n`;
          rep += `   <i>${escapeHtml(a.message)}</i>\n`;
        }
      } else {
        rep += `\n✅ <i>Kritik güvenlik alarmı bulunmuyor.</i>\n`;
      }

      await sendTelegramMessage(senderChatId, rep);
    } catch (err: any) {
      await sendTelegramMessage(senderChatId, `❌ YNetMon verisi alınamadı: ${err.message}`);
    }
    return;
  }

  // dns kapat, /dns kapat, adguard kapat, /adguard kapat
  if (/^[/]?(?:dns|adguard)\s+(?:kapat|durdur|pause|stop)\b/i.test(text)) {
    const rawDuration = text
      .replace(/^[/]?(?:dns|adguard)\s+(?:kapat|durdur|pause|stop)[:\s]*/i, "")
      .trim()
      .toLowerCase();
    let minutes = 10;

    if (rawDuration) {
      const matchHour = rawDuration.match(/^(\d+)\s*(?:h|s|saat)$/);
      const matchMin = rawDuration.match(/^(\d+)\s*(?:m|dk|dakika)?$/);
      if (matchHour) {
        minutes = Number(matchHour[1]) * 60;
      } else if (matchMin) {
        minutes = Number(matchMin[1]);
      }
    }

    const res = await setAdGuardProtection(false, minutes);
    await sendTelegramMessage(senderChatId, res.message);
    return;
  }

  // dns ac, /dns ac, adguard ac, /adguard ac
  if (/^[/]?(?:dns|adguard)\s+(?:ac|aç|baslat|başlat|start|enable)\b/i.test(text)) {
    const res = await setAdGuardProtection(true);
    await sendTelegramMessage(senderChatId, res.message);
    return;
  }

  // dns, /dns, adguard, /adguard
  if (/^[/]?(?:dns|adguard)$/i.test(text)) {
    try {
      const stats = await getAdGuardStats();
      if (!stats) {
        await sendTelegramMessage(
          senderChatId,
          "⚠️ <b>AdGuard Home servisine ulaşılamadı.</b> Servis çalışmıyor veya port 8080 erişilemez."
        );
        return;
      }

      const statusIcon = stats.protection_enabled
        ? "🟢 Aktif (Filtreleme Açık)"
        : "🔴 Duraklatıldı (Filtreleme Kapalı)";
      let rep = `🛡️ <b>AdGuard Home DNS ve Tehdit Raporu</b>\n\n`;
      rep += `⚙️ <b>Durum:</b> ${statusIcon}\n`;
      rep += `📊 <b>Son 24 Saatlik Sorgu:</b> ${stats.dns_queries_24h.toLocaleString("tr-TR")}\n`;
      rep += `🚫 <b>Engellenen İstek:</b> ${stats.blocked_filtering_24h.toLocaleString("tr-TR")} <b>(%${stats.blocked_percentage})</b>\n`;

      if (stats.top_blocked && stats.top_blocked.length > 0) {
        rep += `\n🛑 <b>En Çok Engellenen Reklam/İzleyiciler:</b>\n`;
        for (const b of stats.top_blocked) {
          rep += `• <code>${escapeHtml(b.domain)}</code> (${b.count} istek)\n`;
        }
      }

      rep += `\n💡 <i>10 dakika duraklatmak:</i> <code>/dns kapat 10m</code>\n`;
      rep += `💡 <i>Tekrar açmak:</i> <code>/dns ac</code>`;

      await sendTelegramMessage(senderChatId, rep);
    } catch (err: any) {
      await sendTelegramMessage(senderChatId, `❌ AdGuard verisi alınamadı: ${err.message}`);
    }
    return;
  }

  // bugun, /bugun, today, /today
  if (/^[/]?(?:bugun|bugün|today)$/i.test(text)) {
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
        const timeStr = n.due_time ? ` [⏰ ${n.due_time}]` : "";
        rep += `${check}<b>[N-${n.id}]</b> ${escapeHtml(n.content)}${timeStr}${end}\n`;
      }
    }

    rep += `\n📋 <b>Bekleyen Görevler (${pendingTasks.length}):</b>\n`;
    if (pendingTasks.length === 0) {
      rep += `<i>Bekleyen açık görev yok.</i>\n`;
    } else {
      for (const t of pendingTasks) {
        const timeStr = t.due_time ? ` [⏰ ${t.due_time}]` : "";
        rep += `• <b>[G-${t.id}]</b> <b>${escapeHtml(t.title)}</b>${timeStr} (${t.priority})\n`;
      }
    }

    rep += `\n💡 <i>Tamamlamak:</i> <code>/tamam n2</code> veya <code>/tamam g2</code>\n`;
    rep += `⏰ <i>Ertelemek:</i> <code>/ertele g2 1 saat</code> veya <code>/ertele n2 yarin</code>\n`;

    await sendTelegramMessage(senderChatId, rep);
    return;
  }

  // gorev, /gorev, task, /task [başlık]
  const isGorev = /^[/]?(?:gorev|görev|task)\b/i.test(text);
  if (isGorev) {
    const rawTask = text.replace(/^[/]?(?:gorev|görev|task)[:\s]*/i, "").trim();
    if (!rawTask) {
      await sendTelegramMessage(
        senderChatId,
        "⚠️ Lütfen görev başlığı yazınız: <code>/gorev [tarih] [saat] Başlık</code>\nÖrnek: <code>/gorev 04-11-2026 14:00 Sunucu bakımı</code>"
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
      `✅ <b>Görev Eklendi!</b>\n📌 <b>[G-${newTaskId}]</b> ${escapeHtml(content)}\n📅 <b>Tarih/Saat:</b> ${dateLabel}${timeDisplay}\n\n💡 <i>Tamamlamak:</i> <code>/tamam g${newTaskId}</code> | <i>Ertelemek:</i> <code>/ertele g${newTaskId}</code>`
    );
    return;
  }

  // not, /not veya n, /n tek başına gönderilirse format yardımı
  if (/^[/]?(?:not|n)$/i.test(text)) {
    await sendTelegramMessage(
      senderChatId,
      `⚠️ <b>Not Ekleme Formatı:</b>\n• <code>/not [içerik]</code> veya doğrudan metin (Bugün)\n• <code>/not 04-11-2026 14:00 [içerik]</code> (Tarih + Saat)\n• <code>/not yarin [içerik]</code> (Yarın)\n• <code>/not 4 kasım 14:00 [içerik]</code> (Türkçe Tarih)`
    );
    return;
  }

  // not [içerik] veya /not [içerik] veya doğrudan düz metin gönderme
  let noteRaw = text;
  if (/^[/]?(?:not|n)[:\s]+/i.test(text)) {
    noteRaw = text.replace(/^[/]?(?:not|n)[:\s]+/i, "").trim();
  }

  if (noteRaw) {
    const { targetDate, targetTime, content, dateLabel } = parseDateAndContent(noteRaw);

    if (!content) {
      await sendTelegramMessage(senderChatId, "⚠️ Lütfen kaydedilecek not içeriğini yazınız.");
      return;
    }

    const info = db.prepare(
      "INSERT INTO daily_notes (content, date, due_time, is_done, priority, source) VALUES (?, ?, ?, 0, 'medium', 'telegram')"
    ).run(content, targetDate, targetTime || "");

    const noteId = Number(info.lastInsertRowid);
    const timeDisplay = targetTime ? ` ⏰ <b>${targetTime}</b>` : "";

    await sendTelegramMessage(
      senderChatId,
      `📝 <b>Gündelik Nota Kaydedildi (${dateLabel}${timeDisplay}):</b>\n<b>[N-${noteId}]</b> "<i>${escapeHtml(content)}</i>"\n\n💡 <i>Tamamlamak:</i> <code>/tamam n${noteId}</code> | <i>Ertelemek:</i> <code>/ertele n${noteId}</code>`
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
