"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
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
  Clock,
  Sparkles,
  Copy,
  Check,
  Eye,
  EyeOff,
  Layers,
  Edit3,
  ArrowRight,
  RefreshCw,
  HardDrive,
  X,
  Lock,
  LogOut,
  ShieldCheck,
  Activity,
  Download,
  Upload,
  Image as ImageIcon,
  BookOpen,
  Columns,
  Code2,
  Command,
  Maximize2,
} from "lucide-react";
import MarkdownViewer from "@/components/MarkdownViewer";

type Project = {
  id: number;
  name: string;
  slug: string;
  description: string;
  readme_md: string;
  cover_image: string;
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

type ProjectImage = {
  id: number;
  project_id: number;
  title: string;
  image_url: string;
  created_at: string;
};

type QuickCommand = {
  id: number;
  project_id: number | null;
  title: string;
  command_text: string;
  category: string;
  created_at: string;
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
  active: {
    label: "Aktif Geliştirme",
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  planning: {
    label: "Planlama",
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  paused: {
    label: "Askıda",
    badge: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  },
  completed: {
    label: "Tamamlandı",
    badge: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  },
};

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  low: { label: "Düşük", color: "text-zinc-400" },
  medium: { label: "Orta", color: "text-sky-400" },
  high: { label: "Yüksek", color: "text-amber-400" },
  critical: { label: "Kritik", color: "text-rose-400" },
  urgent: { label: "Acil", color: "text-rose-400" },
};

export default function YDevHubPage() {
  // Auth states
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authEnabled, setAuthEnabled] = useState(true);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [securitySavedMsg, setSecuritySavedMsg] = useState("");

  const [activeTab, setActiveTab] = useState<
    "dashboard" | "kanban" | "notes" | "commands" | "vault" | "cicd"
  >("dashboard");
  const [selectedProjectId, setSelectedProjectId] = useState<number | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectImages, setProjectImages] = useState<ProjectImage[]>([]);
  const [commands, setCommands] = useState<QuickCommand[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [configs, setConfigs] = useState<ConfigItem[]>([]);

  // Health / Ping states
  const [healthStatus, setHealthStatus] = useState<
    Record<number, { online: boolean; latencyMs: number }>
  >({});
  const [checkingHealth, setCheckingHealth] = useState(false);

  // Active note for editor
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteCategory, setNoteCategory] = useState("architecture");
  const [noteProjectId, setNoteProjectId] = useState<number | null>(null);
  const [noteViewMode, setNoteViewMode] = useState<"split" | "preview" | "edit">("split");

  // Project Detail Drawer / Workspace Modal
  const [detailProjectId, setDetailProjectId] = useState<number | null>(null);
  const [detailSubTab, setDetailSubTab] = useState<"readme" | "gallery" | "commands">("readme");
  const [detailReadmeMode, setDetailReadmeMode] = useState<"preview" | "split" | "edit">("preview");
  const [detailReadmeText, setDetailReadmeText] = useState("");
  const [galleryImageTitle, setGalleryImageTitle] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // File input refs
  const noteMdInputRef = useRef<HTMLInputElement | null>(null);
  const noteImgInputRef = useRef<HTMLInputElement | null>(null);
  const projectMdInputRef = useRef<HTMLInputElement | null>(null);
  const projectImgInputRef = useRef<HTMLInputElement | null>(null);
  const galleryImgInputRef = useRef<HTMLInputElement | null>(null);

  // Modals
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showCommandModal, setShowCommandModal] = useState(false);

  // Vault visibility & copy states
  const [visibleSecrets, setVisibleSecrets] = useState<Record<number, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Project Form State
  const [pForm, setPForm] = useState({
    name: "",
    description: "",
    readme_md: "",
    cover_image: "",
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

  // Command Form State
  const [cmdForm, setCmdForm] = useState({
    project_id: "" as string | number,
    title: "",
    command_text: "",
    category: "docker",
  });

  const detailProject = useMemo(
    () => projects.find((p) => p.id === detailProjectId) || null,
    [projects, detailProjectId]
  );

  const checkServersHealth = async (projectList: Project[]) => {
    setCheckingHealth(true);
    try {
      const targets = projectList
        .filter((p) => p.server_port)
        .map((p) => ({
          id: p.id,
          host: p.server_ip || "127.0.0.1",
          port: Number(p.server_port),
        }));
      const res = await fetch("/api/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets }),
      });
      const data = await res.json();
      if (data.results) {
        setHealthStatus(data.results);
      }
    } catch (e) {
      console.error("Health check error:", e);
    } finally {
      setCheckingHealth(false);
    }
  };

  const fetchHubData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/hub");
      if (res.status === 401) {
        setAuthenticated(false);
        setAuthChecked(true);
        setLoading(false);
        return;
      }
      const data = await res.json();
      const loadedProjects: Project[] = data.projects || [];
      setProjects(loadedProjects);
      setProjectImages(data.projectImages || []);
      setCommands(data.commands || []);
      setTasks(data.tasks || []);
      setNotes(data.notes || []);
      setConfigs(data.configs || []);
      setAuthenticated(true);
      setAuthChecked(true);

      if (!selectedNote && data.notes?.length > 0) {
        selectNoteForEdit(data.notes[0]);
      }

      if (loadedProjects.length > 0) {
        checkServersHealth(loadedProjects);
      }
    } catch (err) {
      console.error("Veri yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        setAuthEnabled(Boolean(d.authEnabled));
        if (d.authenticated) {
          setAuthenticated(true);
          fetchHubData();
        } else {
          setAuthenticated(false);
          setAuthChecked(true);
          setLoading(false);
        }
      })
      .catch(() => {
        setAuthChecked(true);
        setLoading(false);
      });
  }, []);

  const uploadImageFile = async (file: File): Promise<string | null> => {
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Görsel yüklenemedi.");
        return null;
      }
      return data.url as string;
    } catch {
      alert("Görsel yükleme sırasında hata oluştu.");
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  // Handle Ctrl+V image paste in Markdown editors
  const handleMarkdownPaste = async (
    e: React.ClipboardEvent<HTMLTextAreaElement>,
    currentValue: string,
    setter: (val: string) => void
  ) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (!file) return;
        const uploadedUrl = await uploadImageFile(file);
        if (uploadedUrl) {
          const mdImage = `\n![Ekran Görüntüsü](${uploadedUrl})\n`;
          setter(currentValue + mdImage);
        }
        return;
      }
    }
  };

  const downloadMarkdownFile = (filename: string, content: string) => {
    const safeName = filename.toLowerCase().endsWith(".md")
      ? filename
      : `${filename.replace(/[^a-zA-Z0-9_-]+/g, "-")}.md`;
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = safeName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", password: loginPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      setLoginError(data.error || "Giriş başarısız");
      return;
    }
    setLoginPassword("");
    setAuthenticated(true);
    fetchHubData();
  };

  const handleLogout = async () => {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    setAuthenticated(false);
  };

  const handleUpdateSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_security",
        newPassword: newAdminPassword,
        authEnabled,
      }),
    });
    if (res.ok) {
      setNewAdminPassword("");
      setSecuritySavedMsg("Güvenlik ayarları kaydedildi!");
      setTimeout(() => setSecuritySavedMsg(""), 2500);
    }
  };

  const handleExportBackup = () => {
    const backup = {
      exported_at: new Date().toISOString(),
      projects,
      projectImages,
      commands,
      tasks,
      notes,
      configs,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ydevhub-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectNoteForEdit = (n: Note) => {
    setSelectedNote(n);
    setNoteTitle(n.title);
    setNoteContent(n.content);
    setNoteCategory(n.category);
    setNoteProjectId(n.project_id);
  };

  const openProjectWorkspace = (p: Project, initialSubTab: "readme" | "gallery" | "commands" = "readme") => {
    setDetailProjectId(p.id);
    setDetailSubTab(initialSubTab);
    setDetailReadmeText(p.readme_md || `# ${p.name}\n\n${p.description || ""}`);
    setDetailReadmeMode("preview");
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

  const filteredCommands = useMemo(() => {
    return commands.filter((c) => {
      if (selectedProjectId !== "all" && c.project_id !== selectedProjectId) return false;
      if (!searchQuery.trim()) return true;
      return (
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.command_text.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [commands, selectedProjectId, searchQuery]);

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
      readme_md: "",
      cover_image: "",
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
      readme_md: p.readme_md || "",
      cover_image: p.cover_image || "",
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
    setNoteContent("# Başlık\n\nProje ile ilgili mimari kararlar, komutlar veya görseller...");
    setNoteCategory("architecture");
    setNoteProjectId(selectedProjectId === "all" ? (projects[0]?.id ?? null) : selectedProjectId);
    setNoteViewMode("split");
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

  const handleSaveCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiCall("command", "create", {
      ...cmdForm,
      project_id: cmdForm.project_id ? Number(cmdForm.project_id) : null,
    });
    setCmdForm({
      project_id: selectedProjectId === "all" ? "" : selectedProjectId,
      title: "",
      command_text: "",
      category: "docker",
    });
    setShowCommandModal(false);
  };

  // Show sleek Login Screen if not authenticated
  if (authChecked && !authenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-zinc-900/80 border border-zinc-800 p-8 space-y-6 shadow-2xl">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-1">
              <Lock className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">YDevHub Komuta Merkezi</h1>
            <p className="text-xs text-zinc-400">
              Proje verilerine, görsellere, sunucu yapılandırmalarına ve{" "}
              <code className="text-indigo-400">.env</code> kasasına erişmek için yönetici şifresini
              girin.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Yönetici Şifresi / PIN
              </label>
              <input
                type="password"
                autoFocus
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition shadow-lg shadow-indigo-600/25"
            >
              Kilidi Aç & Giriş Yap
            </button>
          </form>

          <div className="pt-3 border-t border-zinc-800/80 text-center">
            <p className="text-[11px] text-zinc-500">
              PBKDF2 & Brute-Force Koruması Aktif • İlk Kurulum Şifresi:{" "}
              <code className="text-zinc-300 font-mono">yagyz123</code>
            </p>
          </div>
        </div>
      </div>
    );
  }

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
                    v2.0
                  </span>
                </h1>
                <p className="text-xs text-zinc-400">Proje & Homelab Üssü</p>
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
                Projeler & Galeri
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
                Görsel Notlar (.md)
              </span>
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400">
                {notes.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("commands")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === "commands"
                  ? "bg-indigo-600/15 text-indigo-300 border border-indigo-500/30"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/70"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Command className="w-4 h-4" />
                Hızlı Komutlar (SSH)
              </span>
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400">
                {commands.length}
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

            {projects.map((p) => {
              const h = healthStatus[p.id];
              return (
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
                  <span className="flex items-center gap-1.5">
                    {p.server_port && (
                      <span className="font-mono text-[10px] text-zinc-500">:{p.server_port}</span>
                    )}
                    {h && (
                      <span
                        className={`w-2 h-2 rounded-full ${
                          h.online ? "bg-emerald-400" : "bg-zinc-600"
                        }`}
                        title={h.online ? `Online (${h.latencyMs}ms)` : "Port Kapalı"}
                      />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Storage, Backup & Security Controls */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-900/30 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              SQLite + Görsel Depo
            </span>
            <button
              onClick={handleExportBackup}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              title="Tüm verileri JSON olarak indir"
            >
              <Download className="w-3 h-3" /> Yedek İndir
            </button>
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            <button
              onClick={() => setShowSecurityModal(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-zinc-300 transition"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Şifre Ayarı
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg bg-zinc-900 hover:bg-rose-500/15 border border-zinc-800 hover:border-rose-500/30 text-[11px] text-zinc-400 hover:text-rose-300 transition"
              title="Oturumu Kapat ve Kilitle"
            >
              <LogOut className="w-3.5 h-3.5" />
              Kilitle
            </button>
          </div>
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
              placeholder="Proje, teknoloji, görev, komut, not veya .env ara..."
              className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/60"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => checkServersHealth(projects)}
              disabled={checkingHealth}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-medium transition"
              title="Proje portlarının açık olup olmadığını kontrol et"
            >
              <Activity
                className={`w-3.5 h-3.5 text-emerald-400 ${checkingHealth ? "animate-spin" : ""}`}
              />
              Portları Tara
            </button>
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
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-medium transition"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              Görev
            </button>
            <button
              onClick={() => {
                setCmdForm({
                  ...cmdForm,
                  project_id: selectedProjectId === "all" ? "" : selectedProjectId,
                });
                setShowCommandModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-medium transition"
            >
              <Terminal className="w-3.5 h-3.5 text-sky-400" />
              Komut
            </button>
            <button
              onClick={() => {
                setCForm({
                  ...cForm,
                  project_id: selectedProjectId === "all" ? "" : selectedProjectId,
                });
                setShowConfigModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-medium transition"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              Env
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
                  {projects.filter((p) => p.status === "active").length} aktif •{" "}
                  {projectImages.length} görsel
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
                  {tasks.filter((t) => t.status === "in_progress").length} şu an üzerinde
                  çalışılıyor
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-400">Görsel Not & .md Wiki</p>
                <p className="text-2xl font-bold text-white mt-1">{notes.length}</p>
                <p className="text-[11px] text-sky-400 mt-1">
                  Canlı önizleme & .md içe/dışa aktar
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-sky-400" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-400">Komut & Env Kasası</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {configs.length + commands.length}
                </p>
                <p className="text-[11px] text-purple-400 mt-1">
                  {commands.length} hızlı komut • {configs.length} gizli env
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
                  <h2 className="text-lg font-semibold text-white">
                    Proje Portföyü, Görsel Galeri & README.md
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Projeye tıklayarak <strong className="text-zinc-200">README.md</strong>{" "}
                    dokümanını açabilir, bilgisayardan <code className="text-indigo-300">.md</code>{" "}
                    dosyası veya ekran görüntüleri yükleyebilirsin
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
                  const pHealth = healthStatus[project.id];
                  const pImgs = projectImages.filter((img) => img.project_id === project.id);
                  const coverUrl = project.cover_image || pImgs[0]?.image_url || "";

                  return (
                    <div
                      key={project.id}
                      className="group rounded-2xl bg-zinc-900/60 border border-zinc-800/90 hover:border-indigo-500/40 transition-all flex flex-col justify-between overflow-hidden"
                    >
                      <div>
                        {/* Cover Image or Color Accent Header */}
                        {coverUrl ? (
                          <div
                            onClick={() => openProjectWorkspace(project, "gallery")}
                            className="relative h-36 w-full bg-zinc-950 overflow-hidden cursor-pointer border-b border-zinc-800/80"
                          >
                            <img
                              src={coverUrl}
                              alt={project.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-500 opacity-90"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
                            <span className="absolute bottom-2 right-2.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[10px] font-mono text-zinc-200 flex items-center gap-1 border border-white/10">
                              <ImageIcon className="w-3 h-3 text-indigo-400" /> {pImgs.length} Görsel
                            </span>
                          </div>
                        ) : (
                          <div
                            className="h-1.5 w-full"
                            style={{ backgroundColor: project.color }}
                          />
                        )}

                        <div className="p-5 space-y-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3
                                  onClick={() => openProjectWorkspace(project, "readme")}
                                  className="font-semibold text-base text-white group-hover:text-indigo-300 transition cursor-pointer"
                                >
                                  {project.name}
                                </h3>
                                {project.pinned && (
                                  <Pin className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                <span
                                  className={`inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                                    STATUS_MAP[project.status]?.badge || STATUS_MAP.active.badge
                                  }`}
                                >
                                  {STATUS_MAP[project.status]?.label || project.status}
                                </span>
                                {pHealth && (
                                  <span
                                    className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                                      pHealth.online
                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                        : "bg-zinc-800 text-zinc-400 border-zinc-700"
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        pHealth.online ? "bg-emerald-400" : "bg-zinc-500"
                                      }`}
                                    />
                                    {pHealth.online
                                      ? `Online (${pHealth.latencyMs}ms)`
                                      : "Port Kapalı"}
                                  </span>
                                )}
                              </div>
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
                                onClick={() => apiCall("project", "delete", { id: project.id })}
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition"
                                title="Sil"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
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
                              <span>
                                Görev İlerlemesi ({doneTasks}/{projectTasks.length})
                              </span>
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
                      <div className="px-5 py-3 bg-zinc-950/60 border-t border-zinc-800/80 flex items-center justify-between text-xs">
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

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openProjectWorkspace(project, "gallery")}
                            className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 flex items-center gap-1 transition"
                            title="Görsel Galeri"
                          >
                            <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                            <span>{pImgs.length}</span>
                          </button>
                          <button
                            onClick={() => openProjectWorkspace(project, "readme")}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 text-indigo-300 font-medium flex items-center gap-1 transition"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            README & Detay
                          </button>
                        </div>
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
                              <span
                                className={`font-mono ${
                                  PRIORITY_MAP[task.priority]?.color || "text-zinc-400"
                                }`}
                              >
                                {PRIORITY_MAP[task.priority]?.label || task.priority}
                              </span>
                            </div>

                            <p className="text-sm font-medium text-zinc-100">{task.title}</p>
                            {task.description && (
                              <p className="text-xs text-zinc-400 line-clamp-2">
                                {task.description}
                              </p>
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

          {/* TAB 3: VISUAL NOTES & MARKDOWN WIKI */}
          {activeTab === "notes" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-220px)]">
              {/* Note List */}
              <div className="lg:col-span-3 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Notlar & .md Dokümanlar</h3>
                  <button
                    onClick={handleCreateNewNote}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Yeni
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

              {/* Visual Markdown Split Editor & Reader */}
              <div className="lg:col-span-9 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col overflow-hidden">
                {/* Editor Toolbar */}
                <div className="p-3.5 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2 bg-zinc-900/80">
                  <input
                    type="text"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="Not / Doküman Başlığı..."
                    className="bg-transparent text-base font-semibold text-white focus:outline-none flex-1 min-w-[180px]"
                  />

                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* View Mode Switcher */}
                    <div className="flex items-center rounded-lg bg-zinc-950 p-0.5 border border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setNoteViewMode("preview")}
                        className={`px-2.5 py-1 rounded-md text-xs flex items-center gap-1 transition ${
                          noteViewMode === "preview"
                            ? "bg-indigo-600 text-white"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        <BookOpen className="w-3.5 h-3.5" /> Görsel
                      </button>
                      <button
                        type="button"
                        onClick={() => setNoteViewMode("split")}
                        className={`px-2.5 py-1 rounded-md text-xs flex items-center gap-1 transition ${
                          noteViewMode === "split"
                            ? "bg-indigo-600 text-white"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        <Columns className="w-3.5 h-3.5" /> Split
                      </button>
                      <button
                        type="button"
                        onClick={() => setNoteViewMode("edit")}
                        className={`px-2.5 py-1 rounded-md text-xs flex items-center gap-1 transition ${
                          noteViewMode === "edit"
                            ? "bg-indigo-600 text-white"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        <Code2 className="w-3.5 h-3.5" /> Markdown
                      </button>
                    </div>

                    {/* Hidden inputs for .md and image upload */}
                    <input
                      ref={noteMdInputRef}
                      type="file"
                      accept=".md,.markdown,.txt"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const text = await file.text();
                        setNoteTitle(file.name.replace(/\.(md|markdown|txt)$/i, ""));
                        setNoteContent(text);
                        e.target.value = "";
                      }}
                    />
                    <input
                      ref={noteImgInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const url = await uploadImageFile(file);
                        if (url) {
                          setNoteContent((prev) => `${prev}\n![${file.name}](${url})\n`);
                        }
                        e.target.value = "";
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => noteMdInputRef.current?.click()}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 flex items-center gap-1 transition"
                      title="Bilgisayardan .md dosyası yükle"
                    >
                      <Upload className="w-3.5 h-3.5 text-indigo-400" /> .md Yükle
                    </button>

                    <button
                      type="button"
                      onClick={() => downloadMarkdownFile(noteTitle || "dokuman", noteContent)}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 flex items-center gap-1 transition"
                      title="Bu notu .md dosyası olarak bilgisayara indir"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" /> .md İndir
                    </button>

                    <button
                      type="button"
                      disabled={uploadingImage}
                      onClick={() => noteImgInputRef.current?.click()}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 flex items-center gap-1 transition"
                      title="Not içerisine görsel/ekran görüntüsü yükle (veya doğrudan Ctrl+V yapıştır)"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                      {uploadingImage ? "Yükleniyor..." : "Görsel Ekle"}
                    </button>

                    <select
                      value={noteProjectId || ""}
                      onChange={(e) =>
                        setNoteProjectId(e.target.value ? Number(e.target.value) : null)
                      }
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-300"
                    >
                      <option value="">Genel</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
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

                {/* Split / Preview / Edit Body */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
                  {(noteViewMode === "edit" || noteViewMode === "split") && (
                    <div
                      className={`${
                        noteViewMode === "split"
                          ? "md:col-span-6 border-r border-zinc-800"
                          : "md:col-span-12"
                      } flex flex-col h-full overflow-hidden`}
                    >
                      <div className="px-4 py-1.5 bg-zinc-950 border-b border-zinc-800/80 text-[11px] text-zinc-500 flex items-center justify-between">
                        <span>MARKDOWN EDİTÖRÜ</span>
                        <span>İpucu: Ekran görüntüsünü doğrudan Ctrl+V ile yapıştırabilirsin</span>
                      </div>
                      <textarea
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        onPaste={(e) => handleMarkdownPaste(e, noteContent, setNoteContent)}
                        placeholder="Markdown formatında proje notlarını yaz veya bilgisayardan .md dosyası yükle..."
                        className="flex-1 w-full p-5 bg-zinc-950/60 text-zinc-200 font-mono text-sm leading-relaxed focus:outline-none resize-none"
                      />
                    </div>
                  )}

                  {(noteViewMode === "preview" || noteViewMode === "split") && (
                    <div
                      className={`${
                        noteViewMode === "split" ? "md:col-span-6" : "md:col-span-12"
                      } flex flex-col h-full overflow-hidden bg-zinc-950/30`}
                    >
                      <div className="px-4 py-1.5 bg-zinc-950 border-b border-zinc-800/80 text-[11px] text-zinc-500">
                        CANLI GÖRSEL ÖNİZLEME (.MD)
                      </div>
                      <div className="flex-1 p-6 overflow-y-auto">
                        <MarkdownViewer
                          content={noteContent}
                          onImageClick={(url) => setLightboxUrl(url)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: QUICK SSH / DOCKER COMMANDS LIBRARY */}
          {activeTab === "commands" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Hızlı SSH, Docker & Git Komut Kütüphanesi
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Homelab sunucunda ve projelerinde sık kullandığın terminal komutlarını tek tıkla
                    kopyala
                  </p>
                </div>
                <button
                  onClick={() => setShowCommandModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Yeni Komut Ekle
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredCommands.map((cmd) => (
                  <div
                    key={cmd.id}
                    className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                            {getProjectName(cmd.project_id)}
                          </span>
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                            {cmd.category}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-white mt-2">{cmd.title}</h3>
                      </div>

                      <button
                        onClick={() => apiCall("command", "delete", { id: cmd.id })}
                        className="p-1.5 text-zinc-500 hover:text-rose-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/90 flex items-center justify-between gap-3">
                      <code className="text-xs font-mono text-emerald-300 overflow-x-auto">
                        {cmd.command_text}
                      </code>
                      <button
                        onClick={() => copyToClipboard(cmd.command_text, `cmd-${cmd.id}`)}
                        className="shrink-0 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 flex items-center gap-1 transition"
                      >
                        {copiedKey === `cmd-${cmd.id}` ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" /> Kopyalandı
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> Kopyala
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: CONFIG & ENV VAULT */}
          {activeTab === "vault" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Ortam Değişkenleri (.env), Port & Bağlantı Kasası
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Projelerin için gerekli veritabanı bağlantı cümleleri, portlar, API anahtarları
                    ve sunucu parametreleri
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
                              onClick={() => copyToClipboard(cfg.value_content, `cfg-${cfg.id}`)}
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
                              onClick={() => apiCall("config", "delete", { id: cfg.id })}
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

          {/* TAB 6: DOCKER & CI/CD AUTO DEPLOY GUIDE */}
          {activeTab === "cicd" && (
            <div className="space-y-6 max-w-4xl">
              <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-950/50 via-zinc-900 to-zinc-900 border border-indigo-500/30 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      Homelab & Otomatik Güncelleme Mimarisi (Pentest Sertleştirmeli)
                    </h2>
                    <p className="text-xs text-zinc-300">
                      PBKDF2 şifreleme, Brute-Force engelleme, Magic-Byte görsel doğrulama ve CSP
                      güvenlik başlıkları aktif!
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-1.5">
                    <span className="text-xs font-mono text-indigo-400">1. Adım: dev Dalı</span>
                    <p className="text-sm font-semibold text-white">Geliştir & Test Et</p>
                    <p className="text-xs text-zinc-400">
                      Yeni özellikleri <code className="text-zinc-200">dev</code> dalında geliştir.
                      GitHub Actions derleme testini otomatik yapar.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-1.5">
                    <span className="text-xs font-mono text-emerald-400">2. Adım: main Merge</span>
                    <p className="text-sm font-semibold text-white">Bulutta Docker İmajı</p>
                    <p className="text-xs text-zinc-400">
                      <code className="text-zinc-200">main</code> dalına merge ettiğinde GitHub
                      imajı derler ve <code className="text-zinc-200">ghcr.io</code> adresine
                      yükler.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-1.5">
                    <span className="text-xs font-mono text-amber-400">3. Adım: Watchtower</span>
                    <p className="text-sm font-semibold text-white">Sıfır Dokunuşla Güncelleme</p>
                    <p className="text-xs text-zinc-400">
                      Homelab sunucundaki Watchtower yeni imajı algılar, SQLite ve yüklenen
                      görselleri (<code className="text-zinc-200">/app/data</code>) koruyarak
                      günceller!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* PROJECT WORKSPACE / DETAIL MODAL (README.md + IMAGE GALLERY + QUICK COMMANDS) */}
      {detailProject && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-5xl w-full h-[88vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Workspace Header */}
            <div className="p-5 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-4 bg-zinc-950/70">
              <div className="flex items-center gap-3">
                <span
                  className="w-4 h-4 rounded-full shrink-0"
                  style={{ backgroundColor: detailProject.color }}
                />
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    {detailProject.name}
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                      {detailProject.server_ip || "localhost"}:{detailProject.server_port || "3000"}
                    </span>
                  </h2>
                  <p className="text-xs text-zinc-400">{detailProject.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-xl bg-zinc-900 p-1 border border-zinc-800">
                  <button
                    onClick={() => setDetailSubTab("readme")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                      detailSubTab === "readme"
                        ? "bg-indigo-600 text-white"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" /> README.md
                  </button>
                  <button
                    onClick={() => setDetailSubTab("gallery")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                      detailSubTab === "gallery"
                        ? "bg-indigo-600 text-white"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5" /> Görsel Galeri (
                    {projectImages.filter((i) => i.project_id === detailProject.id).length})
                  </button>
                  <button
                    onClick={() => setDetailSubTab("commands")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                      detailSubTab === "commands"
                        ? "bg-indigo-600 text-white"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" /> Komutlar
                  </button>
                </div>

                <button
                  onClick={() => setDetailProjectId(null)}
                  className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* SUB-TAB 1: PROJECT README.md */}
            {detailSubTab === "readme" && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-5 py-3 bg-zinc-900/90 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setDetailReadmeMode("preview")}
                      className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 ${
                        detailReadmeMode === "preview"
                          ? "bg-indigo-600 text-white"
                          : "bg-zinc-950 text-zinc-400 hover:text-white"
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5" /> Görsel Okuma
                    </button>
                    <button
                      onClick={() => setDetailReadmeMode("split")}
                      className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 ${
                        detailReadmeMode === "split"
                          ? "bg-indigo-600 text-white"
                          : "bg-zinc-950 text-zinc-400 hover:text-white"
                      }`}
                    >
                      <Columns className="w-3.5 h-3.5" /> Yan Yana (Split)
                    </button>
                    <button
                      onClick={() => setDetailReadmeMode("edit")}
                      className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 ${
                        detailReadmeMode === "edit"
                          ? "bg-indigo-600 text-white"
                          : "bg-zinc-950 text-zinc-400 hover:text-white"
                      }`}
                    >
                      <Code2 className="w-3.5 h-3.5" /> Düzenle
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      ref={projectMdInputRef}
                      type="file"
                      accept=".md,.markdown,.txt"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const text = await file.text();
                        setDetailReadmeText(text);
                        await apiCall("project", "update_readme", {
                          id: detailProject.id,
                          readme_md: text,
                        });
                        e.target.value = "";
                      }}
                    />
                    <input
                      ref={projectImgInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const url = await uploadImageFile(file);
                        if (url) {
                          const updated = `${detailReadmeText}\n![${file.name}](${url})\n`;
                          setDetailReadmeText(updated);
                          await apiCall("project", "update_readme", {
                            id: detailProject.id,
                            readme_md: updated,
                          });
                        }
                        e.target.value = "";
                      }}
                    />

                    <button
                      onClick={() => projectMdInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-200 flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5 text-indigo-400" /> Bilgisayardan .md Yükle
                    </button>

                    <button
                      onClick={() =>
                        downloadMarkdownFile(`${detailProject.slug}-README.md`, detailReadmeText)
                      }
                      className="px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-200 flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" /> .md İndir
                    </button>

                    <button
                      onClick={() => projectImgInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-200 flex items-center gap-1.5"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-amber-400" /> Görsel Ekle
                    </button>

                    <button
                      onClick={() =>
                        apiCall("project", "update_readme", {
                          id: detailProject.id,
                          readme_md: detailReadmeText,
                        })
                      }
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                    >
                      README Kaydet
                    </button>
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
                  {(detailReadmeMode === "edit" || detailReadmeMode === "split") && (
                    <div
                      className={`${
                        detailReadmeMode === "split"
                          ? "md:col-span-6 border-r border-zinc-800"
                          : "md:col-span-12"
                      } flex flex-col h-full overflow-hidden`}
                    >
                      <textarea
                        value={detailReadmeText}
                        onChange={(e) => setDetailReadmeText(e.target.value)}
                        onPaste={(e) =>
                          handleMarkdownPaste(e, detailReadmeText, setDetailReadmeText)
                        }
                        placeholder="Proje README.md içeriğini buraya yaz, Ctrl+V ile ekran görüntüsü yapıştır veya üstten .md dosyası seç..."
                        className="flex-1 w-full p-5 bg-zinc-950 text-zinc-200 font-mono text-sm leading-relaxed focus:outline-none resize-none"
                      />
                    </div>
                  )}

                  {(detailReadmeMode === "preview" || detailReadmeMode === "split") && (
                    <div
                      className={`${
                        detailReadmeMode === "split" ? "md:col-span-6" : "md:col-span-12"
                      } flex-1 p-6 overflow-y-auto bg-zinc-950/40`}
                    >
                      <MarkdownViewer
                        content={detailReadmeText}
                        onImageClick={(url) => setLightboxUrl(url)}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SUB-TAB 2: PROJECT IMAGE & ARCHITECTURE GALLERY */}
            {detailSubTab === "gallery" && (
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                <div className="p-4 rounded-2xl bg-zinc-950/90 border border-zinc-800 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex-1 min-w-[220px]">
                    <h3 className="text-sm font-semibold text-white">
                      Proje Ekran Görüntüsü / Mimari Diyagram Yükle
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Yüklenen görseller <code className="text-indigo-300">/app/data/uploads</code>{" "}
                      altında kalıcı olarak saklanır.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={galleryImageTitle}
                      onChange={(e) => setGalleryImageTitle(e.target.value)}
                      placeholder="Görsel başlığı (Örn: Veritabanı Şeması)..."
                      className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white w-64"
                    />
                    <input
                      ref={galleryImgInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const url = await uploadImageFile(file);
                        if (url) {
                          await apiCall("project_image", "create", {
                            project_id: detailProject.id,
                            title: galleryImageTitle || file.name,
                            image_url: url,
                          });
                          setGalleryImageTitle("");
                        }
                        e.target.value = "";
                      }}
                    />
                    <button
                      disabled={uploadingImage}
                      onClick={() => galleryImgInputRef.current?.click()}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5"
                    >
                      <Upload className="w-4 h-4" />
                      {uploadingImage ? "Yükleniyor..." : "Bilgisayardan Görsel Seç"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {projectImages
                    .filter((img) => img.project_id === detailProject.id)
                    .map((img) => {
                      const isCover = detailProject.cover_image === img.image_url;
                      return (
                        <div
                          key={img.id}
                          className="rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden flex flex-col justify-between group"
                        >
                          <div
                            onClick={() => setLightboxUrl(img.image_url)}
                            className="relative h-48 bg-black cursor-zoom-in overflow-hidden"
                          >
                            <img
                              src={img.image_url}
                              alt={img.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                            />
                            <span className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 transition">
                              <Maximize2 className="w-4 h-4" />
                            </span>
                          </div>

                          <div className="p-3.5 flex items-center justify-between gap-2">
                            <div className="truncate">
                              <p className="text-xs font-medium text-white truncate">
                                {img.title || "Proje Görseli"}
                              </p>
                              <p className="text-[10px] font-mono text-zinc-500">
                                {img.created_at}
                              </p>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() =>
                                  apiCall("project", "update_cover", {
                                    id: detailProject.id,
                                    cover_image: isCover ? "" : img.image_url,
                                  })
                                }
                                className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition ${
                                  isCover
                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
                                }`}
                              >
                                {isCover ? "Kapak Görseli" : "Kapak Yap"}
                              </button>
                              <button
                                onClick={() =>
                                  apiCall("project_image", "delete", { id: img.id })
                                }
                                className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* SUB-TAB 3: PROJECT QUICK COMMANDS */}
            {detailSubTab === "commands" && (
              <div className="flex-1 p-6 overflow-y-auto space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">
                    {detailProject.name} — Hızlı Terminal & Docker Komutları
                  </h3>
                  <button
                    onClick={() => {
                      setCmdForm({
                        project_id: detailProject.id,
                        title: "",
                        command_text: "",
                        category: "docker",
                      });
                      setShowCommandModal(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Bu Projeye Komut Ekle
                  </button>
                </div>

                <div className="space-y-3">
                  {commands
                    .filter((c) => c.project_id === detailProject.id || c.project_id === null)
                    .map((cmd) => (
                      <div
                        key={cmd.id}
                        className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-4"
                      >
                        <div className="space-y-1 overflow-hidden">
                          <p className="text-xs font-semibold text-zinc-200">{cmd.title}</p>
                          <code className="block text-xs font-mono text-emerald-400 truncate">
                            {cmd.command_text}
                          </code>
                        </div>
                        <button
                          onClick={() => copyToClipboard(cmd.command_text, `dcmd-${cmd.id}`)}
                          className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-200 flex items-center gap-1.5 shrink-0"
                        >
                          {copiedKey === `dcmd-${cmd.id}` ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" /> Kopyalandı
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" /> Kopyala
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FULLSCREEN IMAGE LIGHTBOX */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 cursor-zoom-out"
        >
          <img
            src={lightboxUrl}
            alt="Tam Ekran Görsel"
            className="max-w-full max-h-full rounded-xl border border-zinc-800 shadow-2xl"
          />
        </div>
      )}

      {/* MODAL: SECURITY & PASSWORD SETTINGS */}
      {showSecurityModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Yönetici Güvenlik & Şifre Ayarları
              </h3>
              <button
                onClick={() => setShowSecurityModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateSecurity} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">
                  Yeni Yönetici Şifresi (Değiştirmek istemiyorsan boş bırak)
                </label>
                <input
                  type="password"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  placeholder="En az 4 karakterli yeni şifre..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white"
                />
              </div>

              <label className="flex items-center gap-2.5 text-zinc-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={authEnabled}
                  onChange={(e) => setAuthEnabled(e.target.checked)}
                  className="rounded bg-zinc-950 border-zinc-700"
                />
                Giriş Ekranı Şifre Koruması Aktif Olsun
              </label>

              {securitySavedMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                  {securitySavedMsg}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowSecurityModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300"
                >
                  Kapat
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                >
                  Ayarları Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                <label className="block text-zinc-400 mb-1">Kısa Açıklama</label>
                <textarea
                  rows={2}
                  value={pForm.description}
                  onChange={(e) => setPForm({ ...pForm, description: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
                  placeholder="Projenin amacı ve önemli detayları..."
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Teknolojiler (Virgülle ayır)</label>
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
                    onChange={(e) => setPForm({ ...pForm, docker_container: e.target.value })}
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

      {/* MODAL 4: CREATE QUICK COMMAND */}
      {showCommandModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-semibold text-white">Hızlı Terminal Komutu Ekle</h3>
              <button
                onClick={() => setShowCommandModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCommand} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">Proje</label>
                  <select
                    value={cmdForm.project_id}
                    onChange={(e) => setCmdForm({ ...cmdForm, project_id: e.target.value })}
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
                  <label className="block text-zinc-400 mb-1">Kategori</label>
                  <select
                    value={cmdForm.category}
                    onChange={(e) => setCmdForm({ ...cmdForm, category: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
                  >
                    <option value="docker">Docker</option>
                    <option value="ssh">SSH / Sunucu</option>
                    <option value="git">Git</option>
                    <option value="sql">SQL / Database</option>
                    <option value="system">Linux / System</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Komut Başlığı *</label>
                <input
                  required
                  value={cmdForm.title}
                  onChange={(e) => setCmdForm({ ...cmdForm, title: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
                  placeholder="Örn: Homelab Sunucuya SSH Bağlantısı"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Komut Satırı *</label>
                <input
                  required
                  value={cmdForm.command_text}
                  onChange={(e) => setCmdForm({ ...cmdForm, command_text: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono text-emerald-300"
                  placeholder="ssh yagyz@192.168.1.100 -p 22"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowCommandModal(false)}
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
