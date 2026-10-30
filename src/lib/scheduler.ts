import { getDb, getSetting, setSetting } from "./db";
import { getBotConfig, sendTelegramMessage } from "./telegramBot";

let schedulerTimer: NodeJS.Timeout | null = null;
let isRunning = false;

function getTodayString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getTimeString(d: Date = new Date()): string {
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${min}`;
}

export async function checkMorningSummary(now: Date = new Date()): Promise<void> {
  const { chatId, enabled } = getBotConfig();
  if (!chatId || !enabled) return;

  const targetTime = getSetting("morning_summary_time", "08:30");
  const lastDate = getSetting("morning_summary_last_date", "");
  const today = getTodayString(now);
  const currentTime = getTimeString(now);

  if (currentTime >= targetTime && lastDate !== today) {
    const db = getDb();

    // Bugünün gündelik notları
    const dailyNotes = db
      .prepare("SELECT * FROM daily_notes WHERE date = ? ORDER BY is_done ASC, created_at ASC")
      .all(today) as any[];

    // Bugünün veya genel bekleyen işleri
    const todayTasks = db
      .prepare(
        "SELECT * FROM tasks WHERE status != 'done' AND (due_date = ? OR due_date = '' OR due_date IS NULL) ORDER BY priority DESC LIMIT 15"
      )
      .all(today) as any[];

    // Geçmişte kalmış ama tamamlanmamış kritik işler
    const overdueTasks = db
      .prepare(
        "SELECT * FROM tasks WHERE status != 'done' AND due_date != '' AND due_date < ? ORDER BY due_date ASC LIMIT 5"
      )
      .all(today) as any[];

    let msg = `☀️ <b>Günaydın! YDevHub Günlük Raporu</b> (${today})\n\n`;

    if (overdueTasks.length > 0) {
      msg += `🚨 <b>Gecikmiş Görevler (${overdueTasks.length}):</b>\n`;
      for (const t of overdueTasks) {
        msg += `• <b>[G-${t.id}] ${escapeHtml(t.title)}</b> (Tarih: ${t.due_date}) → <code>/tamam g${t.id}</code> | <code>/ertele g${t.id}</code>\n`;
      }
      msg += `\n`;
    }

    msg += `📋 <b>Bugünün Bekleyen Görevleri (${todayTasks.length}):</b>\n`;
    if (todayTasks.length === 0) {
      msg += `<i>Bugün için atanmış bekleyen görev yok.</i>\n`;
    } else {
      for (const t of todayTasks) {
        const timePart = t.due_time ? ` [⏰ <b>${t.due_time}</b>]` : "";
        msg += `• <b>[G-${t.id}] ${escapeHtml(t.title)}</b>${timePart} (${t.priority}) → <code>/tamam g${t.id}</code> | <code>/ertele g${t.id}</code>\n`;
      }
    }

    msg += `\n📝 <b>Gündelik Notlar (${dailyNotes.length}):</b>\n`;
    if (dailyNotes.length === 0) {
      msg += `<i>Bugün henüz not eklenmedi. Eklemek için buraya doğrudan yazabilirsin.</i>\n`;
    } else {
      for (const n of dailyNotes) {
        const icon = n.is_done ? "✅ <s>" : "▫️ ";
        const end = n.is_done ? "</s>" : "";
        const timePart = n.due_time ? ` [⏰ <b>${n.due_time}</b>]` : "";
        msg += `${icon}[N-${n.id}] ${escapeHtml(n.content)}${timePart}${end}\n`;
      }
    }

    msg += `\n💪 <i>Başarılı ve verimli bir gün dilerim!</i>`;

    const sent = await sendTelegramMessage(chatId, msg);
    if (sent) {
      setSetting("morning_summary_last_date", today);
      console.log(`[Scheduler] Sabah özeti gönderildi: ${today}`);
    }
  }
}

export async function checkTaskReminders(now: Date = new Date()): Promise<void> {
  const { chatId, enabled } = getBotConfig();
  if (!chatId || !enabled) return;

  const today = getTodayString(now);
  const db = getDb();

  // Saati belirtilmiş, henüz hatırlatılmamış ve bugün teslim edilmesi gereken görevler
  const tasks = db
    .prepare(
      "SELECT * FROM tasks WHERE status != 'done' AND due_date = ? AND due_time != '' AND due_time IS NOT NULL AND reminder_sent = 0"
    )
    .all(today) as any[];

  for (const t of tasks) {
    try {
      const [hStr, mStr] = t.due_time.split(":");
      const targetDate = new Date(now);
      targetDate.setHours(Number(hStr), Number(mStr), 0, 0);

      const diffMs = targetDate.getTime() - now.getTime();
      const diffMinutes = Math.round(diffMs / 60000);

      // 0 ile 60 dakika (1 saat) kala hatırlatma gönder
      if (diffMinutes > 0 && diffMinutes <= 60) {
        let reminderMsg = `⏰ <b>Görev Hatırlatması (1 Saat Kaldı)</b>\n\n`;
        reminderMsg += `🆔 <b>Görev ID:</b> <code>[G-${t.id}]</code>\n`;
        reminderMsg += `📌 <b>Görev:</b> ${escapeHtml(t.title)}\n`;
        reminderMsg += `🕒 <b>Kalan Süre:</b> Yaklaşık ~${diffMinutes} dakika (Saat: <b>${t.due_time}</b>)\n`;
        reminderMsg += `🏷️ <b>Öncelik:</b> ${t.priority}\n`;
        if (t.description) {
          reminderMsg += `📝 <b>Açıklama:</b> ${escapeHtml(t.description)}\n`;
        }
        reminderMsg += `\n✅ <i>Tamamlamak:</i> <code>/tamam g${t.id}</code>\n⏰ <i>1 Saat Ertelemek:</i> <code>/ertele g${t.id}</code>`;

        const sent = await sendTelegramMessage(chatId, reminderMsg);
        if (sent) {
          db.prepare("UPDATE tasks SET reminder_sent = 1 WHERE id = ?").run(t.id);
          console.log(`[Scheduler] Görev hatırlatması iletildi (ID: ${t.id})`);
        }
      } else if (diffMinutes < 0) {
        // Süresi zaten geçmiş, tekrar tekrar kontrol etmemek için işaretle
        db.prepare("UPDATE tasks SET reminder_sent = 1 WHERE id = ?").run(t.id);
      }
    } catch (err: any) {
      console.error(`[Scheduler] Görev zaman kontrolü hatası (ID: ${t.id}):`, err);
    }
  }
}

import { findDockerSocket, fetchDockerContainers } from "./systemMonitor";

const lastContainerStates: Map<string, string> = new Map();
let isFirstContainerScan = true;

export async function checkContainerHealth(): Promise<void> {
  const { chatId, enabled } = getBotConfig();
  if (!chatId || !enabled) return;

  const socketPath = findDockerSocket();
  if (!socketPath) return;

  try {
    const containers = await fetchDockerContainers(socketPath);
    for (const c of containers) {
      const name = c.names[0] || c.id;
      const prevState = lastContainerStates.get(name);
      const currState = c.state;

      if (!isFirstContainerScan && prevState) {
        if (prevState === "running" && currState !== "running") {
          const alertMsg =
            `🚨 <b>[ALARM] Konteyner Durdu!</b>\n\n` +
            `🐳 <b>Konteyner:</b> <code>${name}</code>\n` +
            `⚠️ <b>Yeni Durum:</b> <b>${currState}</b> (${escapeHtml(c.status)})\n\n` +
            `🔄 <i>Yeniden başlatmak için:</i> <code>/restart ${name}</code>`;
          await sendTelegramMessage(chatId, alertMsg);
          console.warn(`[Scheduler] Konteyner çökme alarmı gönderildi: ${name} (${currState})`);
        } else if (prevState !== "running" && currState === "running") {
          const recoveredMsg =
            `✅ <b>[SERVİS KURTARILDI]</b>\n\n` +
            `🐳 <b>Konteyner:</b> <code>${name}</code>\n` +
            `🟢 <b>Durum:</b> Yeniden aktif (${escapeHtml(c.status)})`;
          await sendTelegramMessage(chatId, recoveredMsg);
          console.log(`[Scheduler] Konteyner kurtarıldı bildirimi gönderildi: ${name}`);
        }
      }

      lastContainerStates.set(name, currState);
    }
    isFirstContainerScan = false;
  } catch {
    // Docker socket read error, silently skip
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function runSchedulerCycle(): Promise<void> {
  const now = new Date();
  await checkMorningSummary(now);
  await checkTaskReminders(now);
  await checkContainerHealth();
}

export function startScheduler(intervalMs = 60000): void {
  if (isRunning) return;
  isRunning = true;
  console.log(`[Scheduler] Zamanlayıcı başlatıldı (Periyot: ${intervalMs / 1000}s).`);

  // İlk döngüyü 5 saniye sonra başlat, ardından periyodik sürdür
  setTimeout(async () => {
    try {
      await runSchedulerCycle();
    } catch (err) {
      console.error("[Scheduler] İlk döngü hatası:", err);
    }
  }, 5000);

  schedulerTimer = setInterval(async () => {
    try {
      await runSchedulerCycle();
    } catch (err) {
      console.error("[Scheduler] Döngü hatası:", err);
    }
  }, intervalMs);
}

export function stopScheduler(): void {
  isRunning = false;
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
  console.log("[Scheduler] Zamanlayıcı durduruldu.");
}
