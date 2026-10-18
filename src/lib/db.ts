import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";

const DB_DIR = process.env.DB_DIR || path.join(process.cwd(), "data");
const DB_PATH = process.env.DB_PATH || path.join(DB_DIR, "ydevhub.db");

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    dbInstance.exec("PRAGMA journal_mode = WAL;");
    dbInstance.exec("PRAGMA foreign_keys = ON;");
    initSchema(dbInstance);
  }
  return dbInstance;
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT DEFAULT '',
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
  `);

  const count = db.prepare("SELECT COUNT(*) as c FROM projects").get() as { c: number };
  if (count.c === 0) {
    const insertProject = db.prepare(`
      INSERT INTO projects (name, slug, description, status, priority, tech_stack, repo_url, live_url, local_path, server_ip, server_port, docker_container, color, pinned)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const p1 = insertProject.run(
      "YDevHub Komuta Merkezi",
      "ydevhub",
      "Kişisel projeleri, sunucu yapılandırmalarını, Kanban görevlerini ve teknik dokümantasyonları tek noktadan yöneten yeni nesil geliştirici platformu.",
      "active",
      "critical",
      JSON.stringify(["Next.js 15", "TypeScript", "SQLite (Native)", "Docker", "TailwindCSS", "Watchtower"]),
      "https://github.com/yagyz/YDevHub",
      "http://localhost:3000",
      "/mnt/Depo/Projeler/YDevHub",
      "127.0.0.1",
      "3000",
      "ydevhub-app",
      "#6366f1",
      1
    );

    const p2 = insertProject.run(
      "YSentry Monitoring",
      "ysentry",
      "Sunucu ve servis sağlığını takip eden güvenlik & log izleme aracı.",
      "active",
      "high",
      JSON.stringify(["Go", "Docker", "Linux", "WebSockets"]),
      "https://github.com/yagyz/YSentry",
      "",
      "/mnt/Depo/Projeler/YSentry",
      "192.168.1.100",
      "8080",
      "ysentry-core",
      "#10b981",
      1
    );

    const p3 = insertProject.run(
      "3+1 Web Platformu",
      "3arti1-web",
      "Web tabanlı modern içerik ve yönetim uygulaması.",
      "planning",
      "medium",
      JSON.stringify(["React", "Node.js", "MSSQL", "Docker"]),
      "",
      "",
      "/mnt/Depo/Projeler/3arti1_web",
      "192.168.1.100",
      "5000",
      "3arti1-web",
      "#f59e0b",
      0
    );

    const insertTask = db.prepare(`
      INSERT INTO tasks (project_id, title, description, status, priority, tag)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertTask.run(Number(p1.lastInsertRowid), "GitHub Actions CI/CD ve GHCR entegrasyonu", "Main branch push sonrası otomatik Docker imajı derlenmesi", "done", "high", "devops");
    insertTask.run(Number(p1.lastInsertRowid), "Watchtower ile otomatik konteyner güncelleme", "Sunucu tarafında yeni imaj çıktığında sıfır kesintiyle güncelleme", "in_progress", "urgent", "devops");
    insertTask.run(Number(p1.lastInsertRowid), "Proje bazlı .env ve SSH/Port kasası", "Sunucu bilgilerini ve gizli anahtarları kopyalanabilir şekilde saklama", "done", "medium", "feature");
    insertTask.run(Number(p2.lastInsertRowid), "MSSQL Docker konteyner bağlantı testi", "Mevcut MSSQL konteyneri ile sağlık kontrolü entegrasyonu", "todo", "medium", "feature");

    const insertNote = db.prepare(`
      INSERT INTO notes (project_id, title, content, category, pinned)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertNote.run(
      Number(p1.lastInsertRowid),
      "🚀 Otomatik Deploy & Watchtower Kurulum Rehberi",
      `# GitHub + Docker + Watchtower Otomatik Güncelleme Sistemi

Bu sistem sayesinde bilgisayarında kodu yazıp \`git push origin main\` yaptığın anda:

1. **GitHub Actions** devreye girer ve projeyi Docker imajı olarak paketleyip **GitHub Container Registry (GHCR)** üzerine yükler.
2. Kendi sunucunda çalışan **Watchtower** konteyneri her 60 saniyede bir (veya belirlediğin sürede) GHCR'ı kontrol eder.
3. Yeni imaj algılandığında mevcut konteyneri durdurur, veritabanı volume'ünü (\`/app/data\`) koruyarak yeni sürümü ayağa kaldırır!

### Yararlı Docker Komutları
\`\`\`bash
# Sistemi başlatmak için
docker compose up -d --build

# Logları canlı izlemek için
docker logs -f ydevhub-app

# SQLite veritabanını yedeklemek için
cp ./data/ydevhub.db ./data/ydevhub_backup_$(date +%F).db
\`\`\``,
      "server",
      1
    );

    insertNote.run(
      Number(p2.lastInsertRowid),
      "🗄️ Mevcut MSSQL Docker Bağlantı Notları",
      `# MSSQL Server Docker Bağlantısı

Sunucudaki mevcut MSSQL konteynerine diğer konteynerlerden erişmek için aynı Docker network'ünde olmaları yeterlidir:

\`\`\`yaml
networks:
  default:
    external: true
    name: sql_network
\`\`\`

**Varsayılan Port:** \`1433\`
**Connection String Örneği:**
\`Server=mssql-container,1433;Database=Master;User Id=sa;Password=YourStrong!Passw0rd;TrustServerCertificate=True;\``,
      "architecture",
      1
    );

    const insertConfig = db.prepare(`
      INSERT INTO configs (project_id, label, key_name, value_content, is_secret, environment)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertConfig.run(Number(p1.lastInsertRowid), "Uygulama Portu", "PORT", "3000", 0, "production");
    insertConfig.run(Number(p1.lastInsertRowid), "SQLite Veri Yolu", "DB_PATH", "/app/data/ydevhub.db", 0, "production");
    insertConfig.run(Number(p1.lastInsertRowid), "Watchtower Kontrol Süresi (sn)", "WATCHTOWER_POLL_INTERVAL", "60", 0, "production");
    insertConfig.run(Number(p2.lastInsertRowid), "MSSQL Bağlantı Cümlesi", "MSSQL_CONNECTION_STRING", "Server=localhost,1433;Database=AppDB;User Id=sa;Password=ChangeMe123!;", 1, "production");
  }
}
