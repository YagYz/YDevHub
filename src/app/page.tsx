"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  FolderGit2,
  Kanban,
  FileText,
  KeyRound,
  Plus,
  Search,
  ExternalLink,
  GitBranch,
  Server,
  Terminal,
  Pin,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  Copy,
  Check,
  Eye,
  EyeOff,
  Layers,
  Edit3,
  ArrowRight,
  RefreshCw,
  Cpu,
  HardDrive,
  X,
} from "lucide-react";

type Project = {
  id: number;
  name: string;
  slug: string;
  description: string;
  status: "active" | "planning" | "paused" | "completed";
  priority: "low" | "medium" | "high" | "critical";
  tech_stack: string[];
  repo_url: string;
  live_url: string;
  local_path: string;
  server_ip: string;
  server_port: string;
  docker_container: string;
  color: string;
  pinned: boolean;
  updated_at: string;
};

type Task = {
  id: number;
  project_id: number | null;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  tag: string;
  due_date: string;
};

type Note = {
  id: number;
  project_id: number | null;
  title: string;
  content: string;
  category: string;
  pinned: boolean;
  updated_at: string;
};

type ConfigItem = {
  id: number;
  project_id: number | null;
  label: string;
  key_name: string;
  value_content: string;
  is_secret: boolean;
  environment: string;
};

const STATUS_MAP: Record<string, { label: string; badge: string }> = {
  active: { label: "Aktif Geliştirme", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  planning: { label: "Planlama", badge: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  paused: { label: "Askıda", badge: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
  completed: { label: "Tamamlandı", badge: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30" },
};

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  low: { label: "Düşük", color: "text-zinc-400" },
  medium: { label: "Orta", color: "text-sky-400" },
  high: { label: "Yüksek", color: "text-amber-400" },
  critical: { label: "Kritik", color: "text-rose-400" },
  urgent: { label: "Acil", color: "text-rose-400" },
};

export default function YDevHubPage() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "kanban" | "notes" | "vault" | "cicd">("dashboard");
  const [selectedProjectId, setSelectedProjectId] = useState<number | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [configs, setConfigs] = useState<ConfigItem[]>([]);

  // Active note for editor
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteCategory, setNoteCategory] = useState("architecture");
  const [noteProjectId, setNoteProjectId] = useState<number | null>(null);

  // Modals
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Vault visibility & copy states
  const [visibleSecrets, setVisibleSecrets] = useState<Record<number, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Project Form State
  const [pForm, setPForm] = useState({
    name: "",
    description: "",
    status: "active",
    priority: "high",
    tech_stack: "",
    repo_url: "",
    live_url: "",
    local_path: "",
    server_ip: "",
    server_port: "",
    docker_container: "",
    color: "#6366f1",
    pinned: true,
  });

  // Task Form State
  const [tForm, setTForm] = useState({
    project_id: "" as string | number,
    title: "",
    description: "",
    status: "todo",
    priority: "medium",
    tag: "feature",
  });

  // Config Form State
  const [cForm, setCForm] = useState({
    project_id: "" as string | number,
    label: "",
    key_name: "",
    value_content: "",
    is_secret: true,
    environment: "production",
  });

  const fetchHubData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/hub");
      const data = await res.json();
      setProjects(data.projects || []);
      setTasks(data.tasks || []);
      setNotes(data.notes || []);
      setConfigs(data.configs || []);

      if (!selectedNote && data.notes?.length > 0) {
        selectNoteForEdit(data.notes[0]);
      }
    } catch (err) {
      console.error("Veri yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHubData();
  }, []);

  const selectNoteForEdit = (n: Note) => {
    setSelectedNote(n);
    setNoteTitle(n.title);
    setNoteContent(n.content);
    setNoteCategory(n.category);
    setNoteProjectId(n.project_id);
  };

  const apiCall = async (entity: string, action: string, payload: any) => {
    await fetch("/api/hub", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity, action, payload }),
    });
    await fetchHubData();
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  // Filtered collections
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (selectedProjectId !== "all" && p.id !== selectedProjectId) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tech_stack.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [projects, selectedProjectId, searchQuery]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (selectedProjectId !== "all" && t.project_id !== selectedProjectId) return false;
      if (!searchQuery.trim()) return true;
      return t.title.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [tasks, selectedProjectId, searchQuery]);

  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      if (selectedProjectId !== "all" && n.project_id !== selectedProjectId) return false;
      if (!searchQuery.trim()) return true;
      return (
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.content.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [notes, selectedProjectId, searchQuery]);

  const filteredConfigs = useMemo(() => {
    return configs.filter((c) => {
      if (selectedProjectId !== "all" && c.project_id !== selectedProjectId) return false;
      if (!searchQuery.trim()) return true;
      return (
        c.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.key_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [configs, selectedProjectId, searchQuery]);

  const getProjectName = (id: number | null) => {
    if (!id) return "Genel";
    return projects.find((p) => p.id === id)?.name || "Genel";
  };

  const openCreateProject = () => {
    setEditingProject(null);
    setPForm({
      name: "",
      description: "",
      status: "active",
      priority: "high",
      tech_stack: "Next.js, Docker, TypeScript",
      repo_url: "",
      live_url: "",
      local_path: "/mnt/Depo/Projeler/",
      server_ip: "",
      server_port: "",
      docker_container: "",
      color: "#6366f1",
      pinned: true,
    });
    setShowProjectModal(true);
  };

  const openEditProject = (p: Project) => {
    setEditingProject(p);
    setPForm({
      name: p.name,
      description: p.description,
      status: p.status,
      priority: p.priority,
      tech_stack: p.tech_stack.join(", "),
      repo_url: p.repo_url,
      live_url: p.live_url,
      local_path: p.local_path,
      server_ip: p.server_ip,
      server_port: p.server_port,
      docker_container: p.docker_container,
      color: p.color,
      pinned: p.pinned,
    });
    setShowProjectModal(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const stackArray = pForm.tech_stack
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (editingProject) {
      await apiCall("project", "update", {
        ...pForm,
        id: editingProject.id,
        tech_stack: stackArray,
      });
    } else {
      await apiCall("project", "create", {
        ...pForm,
        tech_stack: stackArray,
      });
    }
    setShowProjectModal(false);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiCall("task", "create", {
      ...tForm,
      project_id: tForm.project_id ? Number(tForm.project_id) : null,
    });
    setTForm({
      project_id: selectedProjectId === "all" ? "" : selectedProjectId,
      title: "",
      description: "",
      status: "todo",
      priority: "medium",
      tag: "feature",
    });
    setShowTaskModal(false);
  };

  const handleSaveNote = async () => {
    if (!noteTitle.trim()) return;
    if (selectedNote) {
      await apiCall("note", "update", {
        id: selectedNote.id,
        title: noteTitle,
        content: noteContent,
        category: noteCategory,
        project_id: noteProjectId,
        pinned: selectedNote.pinned,
      });
    } else {
      await apiCall("note", "create", {
        title: noteTitle,
        content: noteContent,
        category: noteCategory,
        project_id: noteProjectId,
        pinned: true,
      });
    }
  };

  const handleCreateNewNote = () => {
    setSelectedNote(null);
    setNoteTitle("Yeni Teknik Not / Doküman");
    setNoteContent("# Başlık\n\nProje ile ilgili mimari kararlar, komutlar veya notlar...");
    setNoteCategory("architecture");
    setNoteProjectId(selectedProjectId === "all" ? (projects[0]?.id ?? null) : selectedProjectId);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiCall("config", "create", {
      ...cForm,
      project_id: cForm.project_id ? Number(cForm.project_id) : null,
    });
    setCForm({
      project_id: selectedProjectId === "all" ? "" : selectedProjectId,
      label: "",
      key_name: "",
      value_content: "",
      is_secret: true,
      environment: "production",
    });
    setShowConfigModal(false);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      {/* LEFT SIDEBAR */}
      <aside className="w-72 border-r border-zinc-800/80 bg-zinc-950/90 flex flex-col justify-between shrink-0">
        <div className="p-5 space-y-6 overflow-y-auto">
          {/* Brand Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Terminal className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                  YDevHub
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    v1.0
                  </span>
                </h1>
                <p className="text-xs text-zinc-400">Proje & Sunucu Üssü</p>
              </div>
            </div>
          </div>

          {/* Main Navigation */}
          <nav className="space-y-1">
            <p className="px-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
              Modüller
            </p>
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === "dashboard"
                  ? "bg-indigo-600/15 text-indigo-300 border border-indigo-500/30"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/70"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <FolderGit2 className="w-4 h-4" />
                Projeler & Künye
              </span>
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400">
                {projects.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("kanban")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === "kanban"
                  ? "bg-indigo-600/15 text-indigo-300 border border-indigo-500/30"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/70"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Kanban className="w-4 h-4" />
                Kanban & Görevler
              </span>
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400">
                {tasks.filter((t) => t.status !== "done").length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("notes")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === "notes"
                  ? "bg-indigo-600/15 text-indigo-300 border border-indigo-500/30"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/70"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <FileText className="w-4 h-4" />
                Notlar & Wiki
              </span>
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400">
                {notes.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("vault")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === "vault"
                  ? "bg-indigo-600/15 text-indigo-300 border border-indigo-500/30"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/70"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <KeyRound className="w-4 h-4" />
                Env & Port Kasası
              </span>
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400">
                {configs.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("cicd")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === "cicd"
                  ? "bg-indigo-600/15 text-indigo-300 border border-indigo-500/30"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/70"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <RefreshCw className="w-4 h-4" />
                Docker & Oto-Deploy
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </button>
          </nav>

          {/* Project Filter List */}
          <div className="space-y-1.5 pt-3 border-t border-zinc-800/80">
            <div className="flex items-center justify-between px-2.5 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Proje Filtresi
              </span>
              <button
                onClick={openCreateProject}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Yeni
              </button>
            </div>

            <button
              onClick={() => setSelectedProjectId("all")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                selectedProjectId === "all"
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              <span className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                Tüm Projeler
              </span>
              <span className="font-mono text-[11px] text-zinc-500">{projects.length}</span>
            </button>

            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProjectId(p.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  selectedProjectId === p.id
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="truncate">{p.name}</span>
                </span>
                {p.server_port && (
                  <span className="font-mono text-[10px] text-zinc-500">:{p.server_port}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Storage & DB Indicator */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-900/30 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              SQLite (WAL Mode)
            </span>
            <span className="text-[11px] font-mono text-emerald-400">Aktif</span>
          </div>
          <p className="text-[11px] font-mono text-zinc-500 truncate">
            /mnt/Depo/Projeler/YDevHub
          </p>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOP BAR */}
        <header className="h-16 border-b border-zinc-800/80 px-6 flex items-center justify-between gap-4 shrink-0 bg-zinc-950/80 backdrop-blur-md">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Proje, teknoloji, görev, not veya .env anahtarı ara..."
              className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/60"
            />
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={openCreateProject}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition shadow-lg shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" />
              Yeni Proje
            </button>
            <button
              onClick={() => {
                setTForm({
                  ...tForm,
                  project_id: selectedProjectId === "all" ? "" : selectedProjectId,
                });
                setShowTaskModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-medium transition"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              Görev Ekle
            </button>
            <button
              onClick={() => {
                setCForm({
                  ...cForm,
                  project_id: selectedProjectId === "all" ? "" : selectedProjectId,
                });
                setShowConfigModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-medium transition"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              Bilgi / Env Ekle
            </button>
          </div>
        </header>

        {/* SCROLLABLE VIEWPORT */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* STATS STRIP */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-400">Toplam Proje</p>
                <p className="text-2xl font-bold text-white mt-1">{projects.length}</p>
                <p className="text-[11px] text-emerald-400 mt-1">
                  {projects.filter((p) => p.status === "active").length} aktif geliştiriliyor
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <FolderGit2 className="w-5 h-5 text-indigo-400" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-400">Açık Görevler</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {tasks.filter((t) => t.status !== "done").length}
                </p>
                <p className="text-[11px] text-amber-400 mt-1">
                  {tasks.filter((t) => t.status === "in_progress").length} şu an üzerinde çalışılıyor
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-400">Teknik Not & Wiki</p>
                <p className="text-2xl font-bold text-white mt-1">{notes.length}</p>
                <p className="text-[11px] text-sky-400 mt-1">
                  Markdown & kod şablonları
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-sky-400" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-400">Sunucu & Env Kasası</p>
                <p className="text-2xl font-bold text-white mt-1">{configs.length}</p>
                <p className="text-[11px] text-purple-400 mt-1">
                  Port, bağlantı ve parametreler
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <Server className="w-5 h-5 text-purple-400" />
              </div>
            </div>
          </div>

          {/* TAB 1: PROJECTS DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Proje Portföyü & Teknik Künye</h2>
                  <p className="text-xs text-zinc-400">
                    Geliştirdiğin tüm sistemlerin dizin, port, Docker konteyner ve GitHub bağlantıları
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredProjects.map((project) => {
                  const projectTasks = tasks.filter((t) => t.project_id === project.id);
                  const doneTasks = projectTasks.filter((t) => t.status === "done").length;
                  const progress =
                    projectTasks.length > 0
                      ? Math.round((doneTasks / projectTasks.length) * 100)
                      : 0;

                  return (
                    <div
                      key={project.id}
                      className="group rounded-2xl bg-zinc-900/60 border border-zinc-800/90 hover:border-zinc-700 transition-all flex flex-col justify-between overflow-hidden"
                    >
                      <div>
                        {/* Color Accent Header */}
                        <div
                          className="h-1.5 w-full"
                          style={{ backgroundColor: project.color }}
                        />
                        <div className="p-5 space-y-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-base text-white group-hover:text-indigo-300 transition">
                                  {project.name}
                                </h3>
                                {project.pinned && (
                                  <Pin className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                                )}
                              </div>
                              <span
                                className={`inline-block mt-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                                  STATUS_MAP[project.status]?.badge || STATUS_MAP.active.badge
                                }`}
                              >
                                {STATUS_MAP[project.status]?.label || project.status}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openEditProject(project)}
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                                title="Projeyi Düzenle"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  apiCall("project", "toggle_pin", { id: project.id })
                                }
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition"
                                title="Sabitle"
                              >
                                <Pin className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  apiCall("project", "delete", { id: project.id })
                                }
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition"
                                title="Sil"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">
                            {project.description || "Açıklama eklenmemiş."}
                          </p>

                          {/* Tech Stack Pills */}
                          <div className="flex flex-wrap gap-1.5">
                            {project.tech_stack.map((tech, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 text-[11px] font-mono rounded-md bg-zinc-800/90 text-zinc-300 border border-zinc-700/60"
                              >
                                {tech}
                              </span>
                            ))}
                          </div>

                          {/* Server & Path Metadata Box */}
                          <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-1.5 text-xs font-mono">
                            {project.local_path && (
                              <div className="flex items-center justify-between text-zinc-400">
                                <span className="text-zinc-500">Dizin:</span>
                                <span className="truncate max-w-[190px] text-zinc-300">
                                  {project.local_path}
                                </span>
                              </div>
                            )}
                            {(project.server_ip || project.server_port) && (
                              <div className="flex items-center justify-between text-zinc-400">
                                <span className="text-zinc-500">Sunucu/Port:</span>
                                <span className="text-emerald-400">
                                  {project.server_ip || "localhost"}:{project.server_port || "80"}
                                </span>
                              </div>
                            )}
                            {project.docker_container && (
                              <div className="flex items-center justify-between text-zinc-400">
                                <span className="text-zinc-500">Docker:</span>
                                <span className="text-sky-400">{project.docker_container}</span>
                              </div>
                            )}
                          </div>

                          {/* Task Progress Bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] text-zinc-400">
                              <span>Görev İlerlemesi ({doneTasks}/{projectTasks.length})</span>
                              <span className="font-mono">{progress}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Links */}
                      <div className="px-5 py-3 bg-zinc-950/50 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          {project.repo_url && (
                            <a
                              href={project.repo_url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-zinc-400 hover:text-white transition"
                            >
                              <GitBranch className="w-3.5 h-3.5" />
                              GitHub
                            </a>
                          )}
                          {project.live_url && (
                            <a
                              href={project.live_url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Canlı Aç
                            </a>
                          )}
                        </div>

                        <button
                          onClick={() => {
                            setSelectedProjectId(project.id);
                            setActiveTab("notes");
                          }}
                          className="text-zinc-400 hover:text-white flex items-center gap-1"
                        >
                          Detay & Notlar <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: KANBAN TASK BOARD */}
          {activeTab === "kanban" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Kanban Görev Panosu</h2>
                  <p className="text-xs text-zinc-400">
                    Projelerdeki yapılacakları, devam eden geliştirmeleri ve tamamlanan işleri yönet
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {(
                  [
                    { key: "todo", title: "Yapılacaklar (To-Do)", dot: "bg-zinc-400" },
                    { key: "in_progress", title: "Geliştiriliyor", dot: "bg-amber-400" },
                    { key: "review", title: "Test / İnceleme", dot: "bg-sky-400" },
                    { key: "done", title: "Tamamlandı", dot: "bg-emerald-400" },
                  ] as const
                ).map((col) => {
                  const colTasks = filteredTasks.filter((t) => t.status === col.key);
                  return (
                    <div
                      key={col.key}
                      className="rounded-2xl bg-zinc-900/40 border border-zinc-800/80 p-4 flex flex-col gap-3 min-h-[480px]"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                            {col.title}
                          </h3>
                        </div>
                        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                          {colTasks.length}
                        </span>
                      </div>

                      <div className="space-y-3 flex-1">
                        {colTasks.map((task) => (
                          <div
                            key={task.id}
                            className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition space-y-2.5"
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium">
                                {getProjectName(task.project_id)}
                              </span>
                              <span className={`font-mono ${PRIORITY_MAP[task.priority]?.color || "text-zinc-400"}`}>
                                {PRIORITY_MAP[task.priority]?.label || task.priority}
                              </span>
                            </div>

                            <p className="text-sm font-medium text-zinc-100">{task.title}</p>
                            {task.description && (
                              <p className="text-xs text-zinc-400 line-clamp-2">{task.description}</p>
                            )}

                            <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-1">
                              <select
                                value={task.status}
                                onChange={(e) =>
                                  apiCall("task", "update_status", {
                                    id: task.id,
                                    status: e.target.value,
                                  })
                                }
                                className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-zinc-300 focus:outline-none"
                              >
                                <option value="todo">Yapılacak</option>
                                <option value="in_progress">Sürüyor</option>
                                <option value="review">Test</option>
                                <option value="done">Tamamlandı</option>
                              </select>

                              <button
                                onClick={() => apiCall("task", "delete", { id: task.id })}
                                className="p-1 text-zinc-500 hover:text-rose-400 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: NOTES & WIKI */}
          {activeTab === "notes" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-220px)]">
              {/* Note List */}
              <div className="lg:col-span-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Proje Notları & Dokümanlar</h3>
                  <button
                    onClick={handleCreateNewNote}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Yeni Not
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/60">
                  {filteredNotes.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => selectNoteForEdit(n)}
                      className={`p-4 cursor-pointer transition ${
                        selectedNote?.id === n.id
                          ? "bg-indigo-600/10 border-l-2 border-indigo-500"
                          : "hover:bg-zinc-900"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
                        <span className="text-indigo-400 font-medium">
                          {getProjectName(n.project_id)}
                        </span>
                        <span className="uppercase font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-800">
                          {n.category}
                        </span>
                      </div>
                      <h4 className="text-sm font-medium text-zinc-100 truncate">{n.title}</h4>
                      <p className="text-xs text-zinc-500 line-clamp-2 mt-1">{n.content}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Note Editor & Reader */}
              <div className="lg:col-span-8 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                  <input
                    type="text"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="Not Başlığı..."
                    className="bg-transparent text-base font-semibold text-white focus:outline-none flex-1"
                  />

                  <div className="flex items-center gap-2">
                    <select
                      value={noteProjectId || ""}
                      onChange={(e) =>
                        setNoteProjectId(e.target.value ? Number(e.target.value) : null)
                      }
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300"
                    >
                      <option value="">Genel (Tüm Projeler)</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={noteCategory}
                      onChange={(e) => setNoteCategory(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300"
                    >
                      <option value="architecture">Mimari</option>
                      <option value="server">Sunucu & Docker</option>
                      <option value="snippet">Kod & SQL</option>
                      <option value="idea">Fikir / Plan</option>
                    </select>

                    <button
                      onClick={handleSaveNote}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition"
                    >
                      Kaydet
                    </button>

                    {selectedNote && (
                      <button
                        onClick={() => {
                          apiCall("note", "delete", { id: selectedNote.id });
                          setSelectedNote(null);
                        }}
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Markdown formatında proje notlarını, sunucu komutlarını veya veritabanı şemalarını buraya yazabilirsin..."
                  className="flex-1 w-full p-5 bg-zinc-950/60 text-zinc-200 font-mono text-sm leading-relaxed focus:outline-none resize-none"
                />
              </div>
            </div>
          )}

          {/* TAB 4: CONFIG & ENV VAULT */}
          {activeTab === "vault" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Ortam Değişkenleri (.env), Port & Bağlantı Kasası
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Projelerin için gerekli veritabanı bağlantı cümleleri, portlar, API anahtarları ve sunucu parametreleri
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800/80 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 text-[11px] font-semibold uppercase text-zinc-400 bg-zinc-900/80">
                      <th className="py-3.5 px-4">Proje</th>
                      <th className="py-3.5 px-4">Açıklama</th>
                      <th className="py-3.5 px-4">Anahtar (Key)</th>
                      <th className="py-3.5 px-4">Değer (Value)</th>
                      <th className="py-3.5 px-4">Ortam</th>
                      <th className="py-3.5 px-4 text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-sm">
                    {filteredConfigs.map((cfg) => {
                      const isShown = !cfg.is_secret || visibleSecrets[cfg.id];
                      return (
                        <tr key={cfg.id} className="hover:bg-zinc-900/40 transition">
                          <td className="py-3.5 px-4 text-xs font-medium text-indigo-400">
                            {getProjectName(cfg.project_id)}
                          </td>
                          <td className="py-3.5 px-4 text-zinc-200">{cfg.label}</td>
                          <td className="py-3.5 px-4 font-mono text-xs text-amber-300">
                            {cfg.key_name}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-zinc-300 max-w-xs truncate">
                            {isShown ? cfg.value_content : "••••••••••••••••••••••••"}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                              {cfg.environment}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-1">
                            {cfg.is_secret && (
                              <button
                                onClick={() =>
                                  setVisibleSecrets((prev) => ({
                                    ...prev,
                                    [cfg.id]: !prev[cfg.id],
                                  }))
                                }
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                                title="Göster/Gizle"
                              >
                                {isShown ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </button>
                            )}
                            <button
                              onClick={() =>
                                copyToClipboard(cfg.value_content, `cfg-${cfg.id}`)
                              }
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 transition"
                              title="Kopyala"
                            >
                              {copiedKey === `cfg-${cfg.id}` ? (
                                <Check className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() =>
                                apiCall("config", "delete", { id: cfg.id })
                              }
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition"
                              title="Sil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: DOCKER & CI/CD AUTO DEPLOY GUIDE */}
          {activeTab === "cicd" && (
            <div className="space-y-6 max-w-4xl">
              <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-950/50 via-zinc-900 to-zinc-900 border border-indigo-500/30 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      GitHub Push / Merge Sonrası Otomatik Sunucu Güncelleme Mimarisi
                    </h2>
                    <p className="text-xs text-zinc-300">
                      Bu proje için hazırlanan <code className="text-indigo-300">Dockerfile</code>,{" "}
                      <code className="text-indigo-300">docker-compose.yml</code> ve{" "}
                      <code className="text-indigo-300">.github/workflows/deploy.yml</code> dosyaları
                      klasöründe hazır!
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-1.5">
                    <span className="text-xs font-mono text-indigo-400">1. Adım: Git Push</span>
                    <p className="text-sm font-semibold text-white">Kodu GitHub&apos;a Gönder</p>
                    <p className="text-xs text-zinc-400">
                      Sen <code className="text-zinc-200">main</code> dalına commit atıp push veya merge
                      yaptığında GitHub Actions otomatik tetiklenir.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-1.5">
                    <span className="text-xs font-mono text-emerald-400">2. Adım: GHCR Build</span>
                    <p className="text-sm font-semibold text-white">Bulutta Docker İmajı</p>
                    <p className="text-xs text-zinc-400">
                      Sunucunu hiç yormadan GitHub kendi sunucularında Docker imajını derler ve{" "}
                      <code className="text-zinc-200">ghcr.io</code> adresine yükler.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-1.5">
                    <span className="text-xs font-mono text-amber-400">3. Adım: Watchtower</span>
                    <p className="text-sm font-semibold text-white">Sıfır Dokunuşla Güncelleme</p>
                    <p className="text-xs text-zinc-400">
                      Sunucundaki Watchtower yeni imajı algılar, SQLite veritabanını koruyarak
                      konteyneri otomatik yeniler!
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-3">
                <h3 className="text-sm font-semibold text-white">
                  Hızlı Terminal Komutları (/mnt/Depo/Projeler/YDevHub)
                </h3>
                <pre className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
{`# 1. Yerelde veya Sunucuda Docker ile hemen başlatmak için:
docker compose up -d --build

# 2. GitHub'a ilk kez göndermek için:
git remote add origin https://github.com/KULLANICI_ADIN/ydevhub.git
git branch -M main
git push -u origin main`}
                </pre>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL 1: CREATE / EDIT PROJECT */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-semibold text-white">
                {editingProject ? "Projeyi Düzenle" : "Yeni Proje Ekle"}
              </h3>
              <button
                onClick={() => setShowProjectModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">Proje Adı *</label>
                  <input
                    required
                    value={pForm.name}
                    onChange={(e) => setPForm({ ...pForm, name: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
                    placeholder="Örn: YDevHub"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Durum</label>
                  <select
                    value={pForm.status}
                    onChange={(e) => setPForm({ ...pForm, status: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
                  >
                    <option value="active">Aktif Geliştirme</option>
                    <option value="planning">Planlama</option>
                    <option value="paused">Askıda</option>
                    <option value="completed">Tamamlandı</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Proje Açıklaması</label>
                <textarea
                  rows={2}
                  value={pForm.description}
                  onChange={(e) => setPForm({ ...pForm, description: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
                  placeholder="Projenin amacı ve önemli detayları..."
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">
                  Teknolojiler (Virgülle ayır)
                </label>
                <input
                  value={pForm.tech_stack}
                  onChange={(e) => setPForm({ ...pForm, tech_stack: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
                  placeholder="Next.js, Docker, SQLite, MSSQL, Go..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">Sunucu IP / Host</label>
                  <input
                    value={pForm.server_ip}
                    onChange={(e) => setPForm({ ...pForm, server_ip: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
                    placeholder="192.168.1.100"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Çalıştığı Port</label>
                  <input
                    value={pForm.server_port}
                    onChange={(e) => setPForm({ ...pForm, server_port: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
                    placeholder="3000"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Docker Konteyner Adı</label>
                  <input
                    value={pForm.docker_container}
                    onChange={(e) =>
                      setPForm({ ...pForm, docker_container: e.target.value })
                    }
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
                    placeholder="ydevhub-app"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">GitHub Repo URL</label>
                  <input
                    value={pForm.repo_url}
                    onChange={(e) => setPForm({ ...pForm, repo_url: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
                    placeholder="https://github.com/..."
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Yerel Disk Yolu</label>
                  <input
                    value={pForm.local_path}
                    onChange={(e) => setPForm({ ...pForm, local_path: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
                    placeholder="/mnt/Depo/Projeler/..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowProjectModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CREATE TASK */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-semibold text-white">Yeni Görev Ekle</h3>
              <button
                onClick={() => setShowTaskModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">İlgili Proje</label>
                <select
                  value={tForm.project_id}
                  onChange={(e) => setTForm({ ...tForm, project_id: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
                >
                  <option value="">Genel</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Görev Başlığı *</label>
                <input
                  required
                  value={tForm.title}
                  onChange={(e) => setTForm({ ...tForm, title: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
                  placeholder="Örn: Docker volume yedekleme scripti yaz"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Detay / Not</label>
                <textarea
                  rows={2}
                  value={tForm.description}
                  onChange={(e) => setTForm({ ...tForm, description: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">Durum</label>
                  <select
                    value={tForm.status}
                    onChange={(e) => setTForm({ ...tForm, status: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
                  >
                    <option value="todo">Yapılacak</option>
                    <option value="in_progress">Geliştiriliyor</option>
                    <option value="review">Test</option>
                    <option value="done">Tamamlandı</option>
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Öncelik</label>
                  <select
                    value={tForm.priority}
                    onChange={(e) => setTForm({ ...tForm, priority: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
                  >
                    <option value="low">Düşük</option>
                    <option value="medium">Orta</option>
                    <option value="high">Yüksek</option>
                    <option value="urgent">Acil</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                >
                  Ekle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CREATE CONFIG / ENV */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-semibold text-white">
                Sunucu Bilgisi / Env Anahtarı Ekle
              </h3>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">Proje</label>
                <select
                  value={cForm.project_id}
                  onChange={(e) => setCForm({ ...cForm, project_id: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
                >
                  <option value="">Genel Sunucu</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Etiket / Açıklama *</label>
                <input
                  required
                  value={cForm.label}
                  onChange={(e) => setCForm({ ...cForm, label: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
                  placeholder="Örn: MSSQL SA Şifresi veya API Key"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Anahtar Adı (Key) *</label>
                <input
                  required
                  value={cForm.key_name}
                  onChange={(e) => setCForm({ ...cForm, key_name: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono text-white"
                  placeholder="DATABASE_URL"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Değer (Value) *</label>
                <input
                  required
                  value={cForm.value_content}
                  onChange={(e) => setCForm({ ...cForm, value_content: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono text-white"
                  placeholder="Server=mssql,1433;..."
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cForm.is_secret}
                    onChange={(e) => setCForm({ ...cForm, is_secret: e.target.checked })}
                    className="rounded bg-zinc-950 border-zinc-700"
                  />
                  Gizli veri olarak maskele (••••)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
