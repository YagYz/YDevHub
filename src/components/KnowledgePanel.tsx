"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Brain,
  Search,
  Network,
  Plus,
  ArrowUpRight,
  RefreshCw,
  Laptop,
  Layers,
  Sparkles,
  Link as LinkIcon,
  Filter,
  Trash2,
  Edit2,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

type KnowledgeItem = {
  id: number;
  project_id: number | null;
  service_tag: string;
  title: string;
  summary: string;
  content: string;
  diff_digest: string;
  linked_topics: string[];
  source_device: string;
  created_at: string;
  updated_at: string;
  backlinks?: Array<{
    id: number;
    service_tag: string;
    title: string;
    summary: string;
  }>;
};

type GraphStats = {
  total_nodes: number;
  total_edges: number;
};

export default function KnowledgePanel() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedService, setSelectedService] = useState<string>("all");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<KnowledgeItem | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "graph">("list");
  const [graphData, setGraphData] = useState<{ nodes: any[]; edges: any[]; stats?: GraphStats }>({
    nodes: [],
    edges: [],
  });

  // New Note Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formService, setFormService] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formSummary, setFormSummary] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formDiff, setFormDiff] = useState("");
  const [formDevice, setFormDevice] = useState("web");
  const [saving, setSaving] = useState(false);

  const fetchKnowledge = async () => {
    try {
      setLoading(true);
      let url = "/api/v1/knowledge?limit=100";
      if (selectedService !== "all") {
        url += `&service=${encodeURIComponent(selectedService)}`;
      }
      if (search.trim()) {
        url += `&search=${encodeURIComponent(search.trim())}`;
      }
      if (selectedTopic) {
        url += `&link=${encodeURIComponent(selectedTopic)}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setItems(data.knowledge || []);
        if (data.knowledge?.length > 0 && !activeItem) {
          setActiveItem(data.knowledge[0]);
        }
      }
    } catch (e) {
      console.error("Knowledge fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchGraph = async () => {
    try {
      const res = await fetch("/api/v1/knowledge/graph");
      const data = await res.json();
      if (data.success) {
        setGraphData({
          nodes: data.nodes || [],
          edges: data.edges || [],
          stats: data.stats,
        });
      }
    } catch (e) {
      console.error("Graph fetch error:", e);
    }
  };

  useEffect(() => {
    fetchKnowledge();
  }, [selectedService, search, selectedTopic]);

  useEffect(() => {
    if (viewMode === "graph") {
      fetchGraph();
    }
  }, [viewMode]);

  // Unique services
  const services = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => set.add(it.service_tag.toLowerCase()));
    return Array.from(set);
  }, [items]);

  // Unique topics
  const allTopics = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      it.linked_topics?.forEach((t) => set.add(t));
    });
    return Array.from(set);
  }, [items]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formSummary.trim() || !formService.trim()) return;

    try {
      setSaving(true);
      const res = await fetch("/api/v1/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_tag: formService.trim(),
          title: formTitle.trim(),
          summary: formSummary.trim(),
          content: formContent.trim(),
          diff_digest: formDiff.trim(),
          source_device: formDevice.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        setFormTitle("");
        setFormSummary("");
        setFormContent("");
        setFormDiff("");
        fetchKnowledge();
      }
    } catch (e) {
      console.error("Save error:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Bu bilgi kaydını silmek istediğinize emin misiniz?")) return;
    try {
      const res = await fetch(`/api/v1/knowledge?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        if (activeItem?.id === id) setActiveItem(null);
        fetchKnowledge();
      }
    } catch (e) {
      console.error("Delete error:", e);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-zinc-100">Ajan Bilgi Ağı & Hafıza</h2>
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                {items.length} Kayıt
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Antigravity ajanlarının oturum kararları, mimari değişiklikler ve çift yönlü konu bağlantıları.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View mode toggle */}
          <div className="flex p-1 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-xs font-medium">
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === "list"
                  ? "bg-zinc-800 text-zinc-100 shadow"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Liste & Kartlar
            </button>
            <button
              onClick={() => setViewMode("graph")}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                viewMode === "graph"
                  ? "bg-cyan-600/30 text-cyan-300 border border-cyan-500/30"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              Ağ Haritası
            </button>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-950/40 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Yeni Kayıt
          </button>
        </div>
      </div>

      {/* FILTER & SEARCH */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/60">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-zinc-500 ml-2" />
          <input
            type="text"
            placeholder="Başlık, özet veya kod parçası ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent border-0 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Service pill filter */}
          <button
            onClick={() => {
              setSelectedService("all");
              setSelectedTopic(null);
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              selectedService === "all" && !selectedTopic
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-300 bg-zinc-950/50"
            }`}
          >
            Tümü
          </button>
          {services.map((s) => (
            <button
              key={s}
              onClick={() => {
                setSelectedService(s);
                setSelectedTopic(null);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                selectedService === s
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                  : "text-zinc-400 hover:text-zinc-300 bg-zinc-950/50 border border-transparent"
              }`}
            >
              {s}
            </button>
          ))}

          {selectedTopic && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-magenta-500/20 text-purple-300 border border-purple-500/30">
              <LinkIcon className="w-3 h-3" />
              [[{selectedTopic}]]
              <button
                onClick={() => setSelectedTopic(null)}
                className="hover:text-white font-bold ml-1"
              >
                ×
              </button>
            </span>
          )}
        </div>
      </div>

      {/* VIEW: GRAPH OVERVIEW */}
      {viewMode === "graph" && (
        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
              <Network className="w-4 h-4 text-cyan-400" />
              Çift Yönlü Bilgi & Konu Grafiği
            </h3>
            <span className="text-xs font-mono text-zinc-400">
              {graphData.stats?.total_nodes || 0} Düğüm • {graphData.stats?.total_edges || 0} Bağlantı
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {graphData.nodes.map((node) => (
              <div
                key={node.id}
                onClick={() => {
                  if (node.type === "topic") {
                    setSelectedTopic(node.label.replace(/^\[\[|\]\]$/g, ""));
                    setViewMode("list");
                  } else {
                    const found = items.find((it) => String(it.id) === node.id);
                    if (found) {
                      setActiveItem(found);
                      setViewMode("list");
                    }
                  }
                }}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  node.type === "topic"
                    ? "bg-purple-950/20 border-purple-500/30 hover:border-purple-400"
                    : "bg-zinc-900/80 border-zinc-800/80 hover:border-cyan-500/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span
                    className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
                      node.type === "topic"
                        ? "bg-purple-500/20 text-purple-300"
                        : "bg-cyan-500/20 text-cyan-300"
                    }`}
                  >
                    {node.service_tag}
                  </span>
                  {node.device && (
                    <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1">
                      <Laptop className="w-3 h-3" />
                      {node.device}
                    </span>
                  )}
                </div>
                <h4 className="text-xs font-bold text-zinc-100 truncate">{node.label}</h4>
                {node.summary && (
                  <p className="text-[11px] text-zinc-400 line-clamp-2 mt-1">{node.summary}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW: TWO-PANE LIST & DETAIL */}
      {viewMode === "list" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT LIST (5 COLS) */}
          <div className="lg:col-span-5 space-y-3">
            {loading ? (
              <div className="p-8 text-center text-xs text-zinc-500 font-mono">
                Bilgi ağı taranıyor...
              </div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800/60">
                <Brain className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-xs text-zinc-400">Henüz kayıtlı bilgi bulunamadı.</p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Agent bir işlem tamamladığında veya &apos;Yeni Kayıt&apos; ile buraya düşer.
                </p>
              </div>
            ) : (
              items.map((it) => {
                const isSelected = activeItem?.id === it.id;
                return (
                  <div
                    key={it.id}
                    onClick={() => setActiveItem(it)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-cyan-950/20 border-cyan-500/40 shadow-md"
                        : "bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-900/90 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-semibold">
                        {it.service_tag}
                      </span>
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono">
                        {it.source_device && <span>{it.source_device}</span>}
                        <span>•</span>
                        <span>{it.created_at?.split(" ")[0]}</span>
                      </div>
                    </div>

                    <h3 className="text-xs font-bold text-zinc-100 line-clamp-1">{it.title}</h3>
                    <p className="text-[11px] text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                      {it.summary}
                    </p>

                    {it.linked_topics && it.linked_topics.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2.5">
                        {it.linked_topics.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/20"
                          >
                            [[{tag}]]
                          </span>
                        ))}
                        {it.linked_topics.length > 3 && (
                          <span className="text-[10px] font-mono text-zinc-500">
                            +{it.linked_topics.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* RIGHT DETAIL PANE (7 COLS) */}
          <div className="lg:col-span-7 sticky top-6">
            {activeItem ? (
              <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 backdrop-blur-xl space-y-5">
                <div className="flex items-start justify-between gap-4 border-b border-zinc-800/80 pb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-mono uppercase px-2.5 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold">
                        {activeItem.service_tag}
                      </span>
                      <span className="text-xs font-mono text-zinc-500">
                        Cihaz: {activeItem.source_device || "Bilinmiyor"}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-zinc-100">{activeItem.title}</h3>
                  </div>

                  <button
                    onClick={() => handleDelete(activeItem.id)}
                    className="p-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    title="Kaydı Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* SUMMARY CARD */}
                <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400 mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Agent Hızlı Özet (Context Hapı)
                  </div>
                  <p className="text-xs text-zinc-200 leading-relaxed">{activeItem.summary}</p>
                </div>

                {/* DETAILED CONTENT */}
                {activeItem.content && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                      Detaylı Bilgi & Mimari
                    </h4>
                    <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-800/60 text-xs text-zinc-300 leading-relaxed font-mono whitespace-pre-wrap">
                      {activeItem.content}
                    </div>
                  </div>
                )}

                {/* DIFF DIGEST */}
                {activeItem.diff_digest && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                      Son Değişiklikler (Diff Digest)
                    </h4>
                    <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 font-mono text-[11px] text-zinc-400 whitespace-pre-wrap">
                      {activeItem.diff_digest}
                    </div>
                  </div>
                )}

                {/* LINKED TOPICS */}
                {activeItem.linked_topics && activeItem.linked_topics.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-purple-400 mb-2 flex items-center gap-1.5">
                      <LinkIcon className="w-3.5 h-3.5" />
                      Bağlantılı Konular
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {activeItem.linked_topics.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => setSelectedTopic(tag)}
                          className="text-xs font-mono px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 transition-all flex items-center gap-1"
                        >
                          [[{tag}]]
                          <ArrowUpRight className="w-3 h-3 opacity-60" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* BACKLINKS (TERSLİĞİ BESLEYEN NOTLAR) */}
                {activeItem.backlinks && activeItem.backlinks.length > 0 && (
                  <div className="border-t border-zinc-800/80 pt-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-2.5 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      Bu Notu Referans Gösterenler (Backlinks)
                    </h4>
                    <div className="space-y-2">
                      {activeItem.backlinks.map((b) => (
                        <div
                          key={b.id}
                          onClick={() => {
                            const found = items.find((it) => it.id === b.id);
                            if (found) setActiveItem(found);
                          }}
                          className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80 hover:border-amber-500/40 cursor-pointer transition-all flex items-center justify-between"
                        >
                          <div>
                            <span className="text-[10px] font-mono uppercase text-cyan-400 mr-2">
                              [{b.service_tag}]
                            </span>
                            <span className="text-xs font-semibold text-zinc-200">{b.title}</span>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-12 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800/60 text-zinc-500 text-xs font-mono">
                İncelemek için soldaki listeden bir bilgi kaydı seçin.
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-lg p-6 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Brain className="w-4 h-4 text-cyan-400" />
                Yeni Bilgi Ağı Kaydı
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Servis Etiketi *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="örn: ynetmon, ydevhub"
                    value={formService}
                    onChange={(e) => setFormService(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Cihaz Kaynağı
                  </label>
                  <input
                    type="text"
                    placeholder="cachyos, macbook vb."
                    value={formDevice}
                    onChange={(e) => setFormDevice(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Başlık *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Kısa, açıklayıcı konu başlığı"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Hızlı Özet (Context Hapı - 1-2 cümle) *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Ajanın ilk okuyacağı özet. [[konu]] etiketleri kullanabilirsiniz."
                  value={formSummary}
                  onChange={(e) => setFormSummary(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Detaylı İçerik (Opsiyonel)
                </label>
                <textarea
                  rows={3}
                  placeholder="Mimari kararlar, portlar, uç noktalar vb."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-all disabled:opacity-50"
                >
                  {saving ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
