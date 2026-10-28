import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const DB_DIR = process.env.DB_DIR || path.join(process.cwd(), "data");
const DB_PATH = process.env.DB_PATH || path.join(DB_DIR, "ydevhub.db");
const UPLOADS_DIR = path.join(DB_DIR, "uploads");

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

let dbInstance: DatabaseSync | null = null;

export function getDbPath(): string {
  return DB_PATH;
}

export function getUploadsDir(): string {
  return UPLOADS_DIR;
}

export const SESSION_COOKIE_NAME = "ydevhub_session";

export function hashPassword(password: string): string {
  return crypto
    .pbkdf2Sync(password, "ydevhub_homelab_salt_v2", 10000, 32, "sha256")
    .toString("hex");
}

export function legacyHashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "_ydevhub_salt").digest("hex");
}

export function safeCompareHex(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export function verifySessionToken(token?: string): boolean {
  const db = getDb();
  const authEnabled = db
    .prepare("SELECT value FROM settings WHERE key = 'auth_enabled'")
    .get() as { value: string } | undefined;

  if (authEnabled && authEnabled.value === "0") {
    return true;
  }

  if (!token || typeof token !== "string" || token.length > 128) return false;

  const session = db
    .prepare(
      "SELECT token FROM sessions WHERE token = ? AND datetime(expires_at) > datetime('now')"
    )
    .get(token) as { token: string } | undefined;

  return Boolean(session);
}

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    dbInstance.exec("PRAGMA journal_mode = WAL;");
    dbInstance.exec("PRAGMA foreign_keys = ON;");
    initSchema(dbInstance);
  }
  return dbInstance;
}

function ensureColumn(db: DatabaseSync, table: string, column: string, definition: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      ip TEXT PRIMARY KEY,
      attempts INTEGER DEFAULT 0,
      locked_until TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT DEFAULT '',
      readme_md TEXT DEFAULT '',
      cover_image TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      priority TEXT DEFAULT 'medium',
      tech_stack TEXT DEFAULT '[]',
      repo_url TEXT DEFAULT '',
      live_url TEXT DEFAULT '',
      local_path TEXT DEFAULT '',
      server_ip TEXT DEFAULT '',
      server_port TEXT DEFAULT '',
      docker_container TEXT DEFAULT '',
      color TEXT DEFAULT '#6366f1',
      pinned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS project_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      title TEXT DEFAULT '',
      image_url TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS commands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      title TEXT NOT NULL,
      command_text TEXT NOT NULL,
      category TEXT DEFAULT 'docker', -- 'docker' | 'ssh' | 'git' | 'sql' | 'system'
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'todo',
      priority TEXT DEFAULT 'medium',
      tag TEXT DEFAULT 'feature',
      due_date TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      category TEXT DEFAULT 'general',
      pinned INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      label TEXT NOT NULL,
      key_name TEXT NOT NULL,
      value_content TEXT NOT NULL,
      is_secret INTEGER DEFAULT 1,
      environment TEXT DEFAULT 'production',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS daily_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      date TEXT NOT NULL,
      is_done INTEGER DEFAULT 0,
      priority TEXT DEFAULT 'medium',
      source TEXT DEFAULT 'web',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Safe migration for existing databases
  ensureColumn(db, "projects", "readme_md", "TEXT DEFAULT ''");
  ensureColumn(db, "projects", "cover_image", "TEXT DEFAULT ''");
  ensureColumn(db, "tasks", "due_time", "TEXT DEFAULT ''");
  ensureColumn(db, "tasks", "reminder_sent", "INTEGER DEFAULT 0");
  ensureColumn(db, "daily_notes", "source", "TEXT DEFAULT 'web'");

  // Initialize default admin password if not set
  const existingPass = db
    .prepare("SELECT value FROM settings WHERE key = 'admin_password_hash'")
    .get() as { value: string } | undefined;

  if (!existingPass) {
    const defaultPassword = process.env.ADMIN_PASSWORD || "yagyz123";
    db.prepare("INSERT INTO settings (key, value) VALUES ('admin_password_hash', ?)").run(
      hashPassword(defaultPassword)
    );
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('auth_enabled', '1')").run();
  }

  // Initialize default Telegram and automation settings
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('telegram_bot_token', ?)").run(
    process.env.TELEGRAM_BOT_TOKEN || ""
  );
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('telegram_chat_id', ?)").run(
    process.env.TELEGRAM_CHAT_ID || ""
  );
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('telegram_bot_enabled', '1')").run();
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('morning_summary_time', '08:30')").run();
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('morning_summary_last_date', '')").run();

  // Seed default commands if commands table is empty
  const cmdCount = db.prepare("SELECT COUNT(*) as c FROM commands").get() as { c: number };
  if (cmdCount.c === 0) {
    const firstProj = db.prepare("SELECT id FROM projects ORDER BY id ASC LIMIT 1").get() as
      | { id: number }
      | undefined;
    const pid = firstProj ? firstProj.id : null;
    const insertCmd = db.prepare(`
      INSERT INTO commands (project_id, title, command_text, category)
      VALUES (?, ?, ?, ?)
    `);
    insertCmd.run(
      pid,
      "Docker Konteynerlerini Yeniden Başlat & Derle",
      "docker compose up -d --build",
      "docker"
    );
    insertCmd.run(
      pid,
      "Canlı Konteyner Loglarını İzle",
      "docker logs -f --tail 100 ydevhub-app",
      "docker"
    );
    insertCmd.run(
      pid,
      "SQLite Veritabanını Sıcak Yedekle",
      "cp ./data/ydevhub.db ./data/ydevhub_backup_$(date +%F_%H-%M).db",
      "system"
    );
    insertCmd.run(
      pid,
      "Git Dev Dalından Main Dalına Merge (--no-ff)",
      "git checkout main && git merge --no-ff dev && git push origin main && git checkout dev",
      "git"
    );
  }

  // Populate starter README on first project if empty
  const p1Row = db
    .prepare("SELECT id, readme_md FROM projects WHERE slug = 'ydevhub' LIMIT 1")
    .get() as { id: number; readme_md: string } | undefined;
  if (p1Row && !p1Row.readme_md) {
    db.prepare("UPDATE projects SET readme_md = ? WHERE id = ?").run(
      `# ⚡ YDevHub Mimari & Homelab Dokümanı

Bu ekran üzerinden projeye ait **README.md** dosyasını görsel olarak okuyabilir, bilgisayardan \`.md\` dosyası yükleyebilir veya ekran görüntüleri ekleyebilirsin.

## Mimari Bileşenler
- **Uygulama Katmanı:** Next.js 15 App Router (Standalone Docker)
- **Veritabanı:** Yerleşik \`node:sqlite\` (WAL Modu)
- **Görsel Depolama:** \`/app/data/uploads\` (Kalıcı Docker Volume)

## Hızlı Kontrol Listesi
- [x] GitHub Actions CI/CD (\`dev\` & \`main\`)
- [x] Yönetici Şifre & Brute-Force Koruması
- [x] Görsel Markdown & Ekran Görüntüsü Galerisi
- [ ] Homelab Reverse Proxy & SSL Tanımlaması`,
      p1Row.id
    );
  }
}

export function getSetting(key: string, defaultValue = ""): string {
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
      | { value: string }
      | undefined;
    return row ? row.value : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?").run(
    key,
    value,
    value
  );
}

export function getAllSettings(): Record<string, string> {
  try {
    const db = getDb();
    const rows = db.prepare("SELECT key, value FROM settings").all() as Array<{
      key: string;
      value: string;
    }>;
    const res: Record<string, string> = {};
    for (const r of rows) {
      res[r.key] = r.value;
    }
    return res;
  } catch {
    return {};
  }
}

