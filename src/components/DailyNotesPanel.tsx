"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Smartphone,
  Globe,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";

export type DailyNote = {
  id: number;
  content: string;
  date: string;
  is_done: boolean;
  priority: "low" | "medium" | "high";
  source: "web" | "telegram";
  created_at: string;
  updated_at?: string;
};

interface DailyNotesPanelProps {
  onRefreshStats?: () => void;
}

export default function DailyNotesPanel({ onRefreshStats }: DailyNotesPanelProps) {
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [showAllDates, setShowAllDates] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "pending" | "done">("all");

  const [notes, setNotes] = useState<DailyNote[]>([]);
  const [loading, setLoading] = useState(true);

  // New note form
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [submitting, setSubmitting] = useState(false);

  const fetchNotes = async (date?: string) => {
    setLoading(true);
    try {
      const url = date ? `/api/daily-notes?date=${date}` : "/api/daily-notes";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes || []);
        onRefreshStats?.();
      }
    } catch (err) {
      console.error("Notlar alınamadı:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showAllDates) {
      fetchNotes();
    } else {
      fetchNotes(selectedDate);
    }
  }, [selectedDate, showAllDates]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/daily-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          date: showAllDates ? todayStr : selectedDate,
          priority,
          source: "web",
        }),
      });
      if (res.ok) {
        setContent("");
        if (showAllDates) {
          fetchNotes();
        } else {
          fetchNotes(selectedDate);
        }
      }
    } catch (err) {
      console.error("Not eklenemedi:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleDone = async (note: DailyNote) => {
    // Optimistic UI update
    setNotes((prev) =>
      prev.map((n) => (n.id === note.id ? { ...n, is_done: !n.is_done } : n))
    );
    try {
      await fetch("/api/daily-notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: note.id,
          is_done: !note.is_done,
        }),
      });
      onRefreshStats?.();
    } catch (err) {
      console.error("Durum güncellenemedi:", err);
      // Revert on error
      fetchNotes(showAllDates ? undefined : selectedDate);
    }
  };

  const handleDelete = async (id: number) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    try {
      await fetch(`/api/daily-notes?id=${id}`, { method: "DELETE" });
      onRefreshStats?.();
    } catch (err) {
      console.error("Silinemedi:", err);
      fetchNotes(showAllDates ? undefined : selectedDate);
    }
  };

  const changeDateBy = (days: number) => {
    const curr = new Date(selectedDate);
    curr.setDate(curr.getDate() + days);
    const nextStr = curr.toISOString().slice(0, 10);
    setSelectedDate(nextStr);
    setShowAllDates(false);
  };

  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      if (filterMode === "pending") return !n.is_done;
      if (filterMode === "done") return n.is_done;
      return true;
    });
  }, [notes, filterMode]);

  const pendingCount = useMemo(() => notes.filter((n) => !n.is_done).length, [notes]);
  const doneCount = useMemo(() => notes.filter((n) => n.is_done).length, [notes]);

  const formattedDateTitle = useMemo(() => {
    if (showAllDates) return "Tüm Gündelik Notlar";
    const d = new Date(selectedDate);
    const isToday = selectedDate === todayStr;
    const dateFormatted = d.toLocaleDateString("tr-TR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    return isToday ? `${dateFormatted} (Bugün)` : dateFormatted;
  }, [selectedDate, showAllDates, todayStr]);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* HEADER CONTROLS STRIP */}
      <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
        {/* Date Selector */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => changeDateBy(-1)}
            disabled={showAllDates}
            className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 disabled:opacity-30 disabled:pointer-events-none transition"
            title="Önceki Gün"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm font-medium text-white">
            <Calendar className="w-4 h-4 text-indigo-400" />
            <span>{formattedDateTitle}</span>
          </div>

          <button
            onClick={() => changeDateBy(1)}
            disabled={showAllDates}
            className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 disabled:opacity-30 disabled:pointer-events-none transition"
            title="Sonraki Gün"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {selectedDate !== todayStr && !showAllDates && (
            <button
              onClick={() => setSelectedDate(todayStr)}
              className="text-xs px-2.5 py-1.5 rounded-xl bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 transition border border-indigo-500/30 font-medium"
            >
              Bugüne Dön
            </button>
          )}

          <button
            onClick={() => setShowAllDates(!showAllDates)}
            className={`text-xs px-3 py-1.5 rounded-xl font-medium transition border ${
              showAllDates
                ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20"
                : "bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 border-zinc-700/60"
            }`}
          >
            {showAllDates ? "Sadece Seçili Gün" : "Tüm Günleri Listele"}
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs">
          <button
            onClick={() => setFilterMode("all")}
            className={`px-3 py-1 rounded-lg font-medium transition ${
              filterMode === "all"
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Hepsi ({notes.length})
          </button>
          <button
            onClick={() => setFilterMode("pending")}
            className={`px-3 py-1 rounded-lg font-medium transition ${
              filterMode === "pending"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Bekleyenler ({pendingCount})
          </button>
          <button
            onClick={() => setFilterMode("done")}
            className={`px-3 py-1 rounded-lg font-medium transition ${
              filterMode === "done"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Tamamlananlar ({doneCount})
          </button>
        </div>
      </div>

      {/* QUICK ADD BOX */}
      <form
        onSubmit={handleAddNote}
        className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 shadow-lg space-y-3"
      >
        <div className="flex items-center gap-2">
          <input
            type="text"
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Hızlıca bir gündelik not veya yapılacak iş yaz... (Enter ile kaydet)"
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/60"
          />

          {/* Priority selector */}
          <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-xl p-1 text-xs">
            <button
              type="button"
              onClick={() => setPriority("low")}
              className={`px-2.5 py-1.5 rounded-lg transition ${
                priority === "low"
                  ? "bg-zinc-800 text-zinc-200 font-medium"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Düşük
            </button>
            <button
              type="button"
              onClick={() => setPriority("medium")}
              className={`px-2.5 py-1.5 rounded-lg transition ${
                priority === "medium"
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/30 font-medium"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Orta
            </button>
            <button
              type="button"
              onClick={() => setPriority("high")}
              className={`px-2.5 py-1.5 rounded-lg transition ${
                priority === "high"
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 font-medium"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Yüksek
            </button>
          </div>

          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none text-white text-sm font-medium transition shadow-md shadow-indigo-600/20 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Ekle
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500 px-1">
          <span className="flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-sky-400" />
            Telegram'dan metin gönderdiğinizde buraya düşer • Not kartına <b>çift tıklayarak</b> tamamlayabilirsiniz!
          </span>
          {showAllDates && (
            <span className="text-amber-400">Not bugünün tarihine ({todayStr}) kaydedilecek</span>
          )}
        </div>
      </form>

      {/* NOTES LIST */}
      <div className="space-y-2.5">
        {loading ? (
          <div className="p-12 text-center text-zinc-500 text-sm">Notlar yükleniyor...</div>
        ) : filteredNotes.length === 0 ? (
          <div className="p-12 rounded-2xl bg-zinc-900/30 border border-zinc-800/50 text-center space-y-2">
            <Sparkles className="w-8 h-8 text-indigo-400/50 mx-auto" />
            <p className="text-sm font-medium text-zinc-300">
              {filterMode === "pending"
                ? "Tüm işler tamamlandı, bekleyen not yok! 🎉"
                : filterMode === "done"
                ? "Henüz tamamlanan bir not yok."
                : "Bu tarihte henüz bir not bulunmuyor."}
            </p>
            <p className="text-xs text-zinc-500">
              Yukarıdaki alandan veya Telegram üzerinden hızlıca ekleyebilirsiniz.
            </p>
          </div>
        ) : (
          filteredNotes.map((note) => {
            const isDone = note.is_done;
            const isTelegram = note.source === "telegram";
            return (
              <div
                key={note.id}
                onDoubleClick={() => handleToggleDone(note)}
                title="Çift tıklayarak durumu değiştir (Tamamlandı / Bekliyor)"
                className={`group p-4 rounded-xl border transition-all flex items-start justify-between gap-3 cursor-pointer select-none ${
                  isDone
                    ? "bg-zinc-950/40 border-zinc-800/50 opacity-60"
                    : "bg-zinc-900/60 hover:bg-zinc-900/90 border-zinc-800"
                }`}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Checkbox */}
                  <button
                    onClick={() => handleToggleDone(note)}
                    className="mt-0.5 shrink-0 text-zinc-400 hover:text-white transition"
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Circle className="w-5 h-5 text-zinc-500 hover:text-zinc-300" />
                    )}
                  </button>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <p
                      className={`text-sm break-words leading-relaxed ${
                        isDone ? "line-through text-zinc-400" : "text-zinc-100"
                      }`}
                    >
                      {note.content}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      {/* Priority pill */}
                      {note.priority === "high" && (
                        <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/30 font-medium">
                          Yüksek
                        </span>
                      )}
                      {note.priority === "medium" && (
                        <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-300 border border-sky-500/30">
                          Orta
                        </span>
                      )}
                      {note.priority === "low" && (
                        <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400">
                          Düşük
                        </span>
                      )}

                      {/* Source badge */}
                      {isTelegram ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono">
                          <Smartphone className="w-3 h-3" />
                          Telegram
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800/80 text-zinc-400 border border-zinc-700/40">
                          <Globe className="w-3 h-3" />
                          Web
                        </span>
                      )}

                      {/* Date & Time */}
                      <span className="text-zinc-500 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        {note.date}
                        {note.created_at && ` • ${note.created_at.slice(11, 16)}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <button
                  onClick={() => handleDelete(note.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition shrink-0"
                  title="Sil"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
