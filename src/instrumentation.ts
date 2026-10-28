export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { startTelegramPolling } = await import("./lib/telegramBot");
      const { startScheduler } = await import("./lib/scheduler");

      console.log("[Instrumentation] Sunucu başlatıldı, arka plan servisleri devreye alınıyor...");
      startTelegramPolling();
      startScheduler(60000); // her 60 saniyede bir kontrol
    } catch (err) {
      console.error("[Instrumentation] Servis başlatma hatası:", err);
    }
  }
}
