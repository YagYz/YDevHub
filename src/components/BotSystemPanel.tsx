"use client";

import React, { useState, useEffect } from "react";
import {
  Bot,
  Send,
  RefreshCw,
  Cpu,
  Server,
  Activity,
  Check,
  AlertCircle,
  HardDrive,
  Clock,
  ShieldCheck,
} from "lucide-react";

interface BotSystemPanelProps {
  sysConfig: any;
  onSaveSysConfig: (cfg: any) => Promise<void>;
  sysConfigSaved: string;
}

export default function BotSystemPanel({
  sysConfig,
  onSaveSysConfig,
  sysConfigSaved,
}: BotSystemPanelProps) {
  // Bot states
  const [botConfig, setBotConfig] = useState({
    configured: false,
    tokenMasked: "",
    chatId: "",
    enabled: true,
    morningSummaryTime: "08:30",
    lastSummaryDate: "",
  });
  const [editToken, setEditToken] = useState("");
  const [editChatId, setEditChatId] = useState("");
  const [editEnabled, setEditEnabled] = useState(true);
  const [editMorningTime, setEditMorningTime] = useState("08:30");
  const [botSaving, setBotSaving] = useState(false);
  const [botMsg, setBotMsg] = useState("");
  const [testSending, setTestSending] = useState(false);

  // System status state
  const [systemData, setSystemData] = useState<any>(null);
  const [systemLoading, setSystemLoading] = useState(true);

  const fetchBotConfig = async () => {
    try {
      const res = await fetch("/api/bot");
      if (res.ok) {
        const data = await res.json();
        setBotConfig(data);
        setEditChatId(data.chatId || "");
        setEditEnabled(Boolean(data.enabled));
        setEditMorningTime(data.morningSummaryTime || "08:30");
      }
    } catch (err) {
      console.error("Bot ayarları çekilemedi:", err);
    }
  };

  const fetchSystemData = async () => {
    setSystemLoading(true);
    try {
      const res = await fetch("/api/system/status");
      if (res.ok) {
        const data = await res.json();
        setSystemData(data);
      }
    } catch (err) {
      console.error("Sistem durumu çekilemedi:", err);
    } finally {
      setSystemLoading(false);
    }
  };

  useEffect(() => {
    fetchBotConfig();
    fetchSystemData();
  }, []);

  const handleSaveBotSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBotSaving(true);
    setBotMsg("");
    try {
      const payload: any = {
        action: "update_settings",
        chat_id: editChatId,
        enabled: editEnabled,
        morning_summary_time: editMorningTime,
      };
      if (editToken.trim()) {
        payload.token = editToken.trim();
      }
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setBotMsg("✅ Telegram ayarları başarıyla kaydedildi.");
        setEditToken("");
        fetchBotConfig();
      } else {
        setBotMsg(`❌ Hata: ${data.error || "Kaydedilemedi"}`);
      }
    } catch (err: any) {
      setBotMsg(`❌ Bağlantı hatası: ${err.message}`);
    } finally {
      setBotSaving(false);
      setTimeout(() => setBotMsg(""), 4000);
    }
  };

  const handleSendTestMessage = async () => {
    setTestSending(true);
    setBotMsg("");
    try {
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test_message" }),
      });
      const data = await res.json();
      if (res.ok) {
        setBotMsg("🎉 Test mesajı Telegram'a gönderildi!");
      } else {
        setBotMsg(`❌ Test başarısız: ${data.error || "İletilemedi"}`);
      }
    } catch (err: any) {
      setBotMsg(`❌ Hata: ${err.message}`);
    } finally {
      setTestSending(false);
      setTimeout(() => setBotMsg(""), 4000);
    }
  };

  const handleTriggerMorningSummary = async () => {
    setBotMsg("");
    try {
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trigger_morning_summary" }),
      });
      const data = await res.json();
      if (res.ok) {
        setBotMsg("📬 Sabah özeti Telegram'a iletildi!");
        fetchBotConfig();
      } else {
        setBotMsg(`❌ Hata: ${data.error}`);
      }
    } catch (err: any) {
      setBotMsg(`❌ Hata: ${err.message}`);
    } finally {
      setTimeout(() => setBotMsg(""), 4000);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* CARD 1: TELEGRAM BOT & NOTIFICATION ENGINE */}
      <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Telegram Asistan & Otomasyon Botu
                {botConfig.configured ? (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    🟢 Aktif
                  </span>
                ) : (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                    ⚪ Yapılandırılmadı
                  </span>
                )}
              </h2>
              <p className="text-xs text-zinc-400">
                Uzaktan not ekleme, görev açma, her sabah günlük özet ve 1 saat kala hatırlatma
                mesajları.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSendTestMessage}
              disabled={testSending || !botConfig.configured}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:pointer-events-none text-xs font-medium text-white transition border border-zinc-700/60"
            >
              <Send className="w-3.5 h-3.5 text-sky-400" />
              {testSending ? "Gönderiliyor..." : "Test Mesajı Gönder"}
            </button>
            <button
              onClick={handleTriggerMorningSummary}
              disabled={!botConfig.configured}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 disabled:opacity-40 disabled:pointer-events-none text-xs font-medium text-indigo-300 transition border border-indigo-500/30"
            >
              <Clock className="w-3.5 h-3.5" />
              Sabah Özetini Tetikle
            </button>
          </div>
        </div>

        {botMsg && (
          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-medium text-zinc-200">
            {botMsg}
          </div>
        )}

        <form onSubmit={handleSaveBotSettings} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-400 font-medium mb-1.5">
                Bot Token (@BotFather)
              </label>
              <input
                type="password"
                value={editToken}
                onChange={(e) => setEditToken(e.target.value)}
                placeholder={botConfig.tokenMasked ? `Mevcut: ${botConfig.tokenMasked}` : "Token girin (123456:ABC-DEF...)"}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/60"
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                Değiştirmek istemiyorsanız boş bırakın.
              </p>
            </div>

            <div>
              <label className="block text-zinc-400 font-medium mb-1.5">
                Yetkili Chat ID (Yönetici)
              </label>
              <input
                type="text"
                value={editChatId}
                onChange={(e) => setEditChatId(e.target.value)}
                placeholder="Örn: 123456789"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/60"
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                Boş bırakırsanız botla Telegram'da ilk <code>/start</code> yapan hesap yönetici
                olarak bağlanır.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-zinc-400 font-medium mb-1.5">
                Günlük Sabah Özeti Saati
              </label>
              <input
                type="time"
                value={editMorningTime}
                onChange={(e) => setEditMorningTime(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/60"
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                Her sabah bu saatte günün işleri ve notları özet olarak Telegram'a iletilir.
              </p>
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editEnabled}
                  onChange={(e) => setEditEnabled(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 bg-zinc-950 border-zinc-800 focus:ring-0"
                />
                <span className="text-sm font-medium text-white">
                  Telegram Bot Dinleyicisi (Polling) Açık
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={botSaving}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold transition shadow-md shadow-indigo-600/20"
            >
              {botSaving ? "Kaydediliyor..." : "Ayarları Kaydet"}
            </button>
          </div>
        </form>
      </div>

      {/* CARD 2: LIVE HOMELAB & DOCKER PROCESSES */}
      <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-5">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">
              Canlı Homelab & Docker Süreçleri
            </h3>
          </div>
          <button
            onClick={fetchSystemData}
            disabled={systemLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${systemLoading ? "animate-spin" : ""}`} />
            Yenile
          </button>
        </div>

        {systemData ? (
          <div className="space-y-4">
            {/* System Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
                <span className="text-[11px] text-zinc-500 block mb-1">Bellek (RAM)</span>
                <p className="text-base font-bold text-white font-mono">
                  {systemData.memory?.usedMb} / {systemData.memory?.totalMb} MB
                </p>
                <div className="w-full bg-zinc-900 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-emerald-400 h-full rounded-full transition-all"
                    style={{ width: `${systemData.memory?.percentUsed || 0}%` }}
                  />
                </div>
                <span className="text-[10px] text-emerald-400 font-mono mt-1 block">
                  %{systemData.memory?.percentUsed} Kullanımda
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
                <span className="text-[11px] text-zinc-500 block mb-1">CPU Yükü</span>
                <p className="text-base font-bold text-white font-mono">
                  {systemData.cpu?.loadAvg?.join(", ")}
                </p>
                <p className="text-[11px] text-zinc-400 mt-2 truncate">
                  {systemData.cpu?.cores} Çekirdek • {systemData.cpu?.model}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
                <span className="text-[11px] text-zinc-500 block mb-1">Sistem Çalışma Süresi</span>
                <p className="text-base font-bold text-white font-mono">
                  {systemData.uptimeHours} Saat
                </p>
                <p className="text-[11px] text-zinc-400 mt-2 truncate">
                  {systemData.hostname} ({systemData.platform})
                </p>
              </div>
            </div>

            {/* Docker Containers Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-400 px-1">
                <span>
                  Docker Konteynerleri (
                  {systemData.docker?.runningCount || 0}/
                  {systemData.docker?.containersCount || 0} Aktif)
                </span>
                <span className="text-[11px] text-zinc-500 font-mono">
                  Socket: {systemData.docker?.socketPath}
                </span>
              </div>

              {!systemData.docker?.available ? (
                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-amber-400/90 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    {systemData.docker?.error ||
                      "Docker soketine erişilemedi. Docker servisinin çalıştığından emin olun."}
                  </span>
                </div>
              ) : systemData.docker?.containers?.length === 0 ? (
                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-500 text-center">
                  Çalışan veya durdurulmuş Docker konteyneri bulunamadı.
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/60 rounded-xl border border-zinc-800/80 bg-zinc-950 overflow-hidden">
                  {systemData.docker.containers.map((c: any) => {
                    const isRunning = c.state === "running";
                    return (
                      <div
                        key={c.id}
                        className="p-3 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isRunning ? "bg-emerald-400" : "bg-rose-500"
                            }`}
                          />
                          <span className="font-semibold text-white font-mono truncate">
                            {c.names[0] || c.id}
                          </span>
                          <span className="text-[11px] text-zinc-500 font-mono truncate hidden sm:inline">
                            {c.image}
                          </span>
                        </div>
                        <span
                          className={`font-mono text-[11px] px-2 py-0.5 rounded ${
                            isRunning
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {c.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-zinc-500 text-xs">Sistem verileri alınıyor...</div>
        )}
      </div>

      {/* CARD 3: DNS & DATA CONFIGURATION */}
      <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Server className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white">
              AdGuard Home DNS & Sunucu Depolama Ayarları
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-emerald-400">
              DB: {sysConfig.dbSizeKb} KB
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-indigo-300">
              Görsel: {sysConfig.uploadedFilesCount} Dosya
            </span>
          </div>
        </div>

        {sysConfigSaved && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
            {sysConfigSaved}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSaveSysConfig(sysConfig);
          }}
          className="space-y-4 text-xs"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">
                Yerel Domain (AdGuard Home)
              </label>
              <input
                type="text"
                value={sysConfig.localDomain}
                onChange={(e) =>
                  onSaveSysConfig({ ...sysConfig, localDomain: e.target.value })
                }
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-zinc-400 font-medium mb-1">
                Sunucu Depolama Dizini (Host)
              </label>
              <input
                type="text"
                value={sysConfig.hostDataDir}
                onChange={(e) =>
                  onSaveSysConfig({ ...sysConfig, hostDataDir: e.target.value })
                }
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-white font-mono"
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
