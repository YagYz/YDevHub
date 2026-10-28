import { NextRequest, NextResponse } from "next/server";
import {
  getDb,
  getDbPath,
  getUploadsDir,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/db";
import fs from "fs";

function getSystemConfig(db: any) {
  const rows = db.prepare("SELECT key, value FROM settings").all() as Array<{
    key: string;
    value: string;
  }>;
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }

  let dbSizeKb = 0;
  try {
    const stat = fs.statSync(getDbPath());
    dbSizeKb = Math.round(stat.size / 1024);
  } catch {}

  let uploadedFilesCount = 0;
  try {
    const files = fs.readdirSync(getUploadsDir());
    uploadedFilesCount = files.filter((f) => !f.startsWith(".")).length;
  } catch {}

  return {
    appPort: map.cfg_app_port || process.env.APP_PORT || "3080",
    hostDataDir:
      map.cfg_host_data_dir || process.env.HOST_DATA_DIR || "/DATA/AppData/ydevhub",
    containerDataDir: process.env.DB_DIR || "/app/data",
    dbPath: getDbPath(),
    uploadsDir: getUploadsDir(),
    localDomain:
      map.cfg_local_domain || process.env.LOCAL_DOMAIN || "ydevhub.yagyz.server",
    secondaryLocalDomain:
      map.cfg_secondary_local_domain ||
      process.env.SECONDARY_LOCAL_DOMAIN ||
      "ydevhub.local",
    publicDomain: map.cfg_public_domain ?? process.env.PUBLIC_DOMAIN ?? "",
    dnsServerIp: map.cfg_dns_server_ip || "192.168.1.150 (AdGuard Home)",
    maxUploadMb: Number(map.cfg_max_upload_mb || process.env.MAX_UPLOAD_MB || 8),
    watchtowerInterval: Number(
      map.cfg_watchtower_interval || process.env.WATCHTOWER_POLL_INTERVAL || 60
    ),
    dbSizeKb,
    uploadedFilesCount,
  };
}

export async function GET(req: NextRequest) {
  try {
    if (!verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value)) {
      return NextResponse.json({ error: "Unauthorized", unauthorized: true }, { status: 401 });
    }

    const db = getDb();
    const projects = db
      .prepare("SELECT * FROM projects ORDER BY pinned DESC, updated_at DESC")
      .all();
    const projectImages = db
      .prepare("SELECT * FROM project_images ORDER BY created_at DESC")
      .all();
    const commands = db
      .prepare("SELECT * FROM commands ORDER BY created_at DESC")
      .all();
    const tasks = db
      .prepare("SELECT * FROM tasks ORDER BY created_at DESC")
      .all();
    const notes = db
      .prepare("SELECT * FROM notes ORDER BY pinned DESC, updated_at DESC")
      .all();
    const configs = db
      .prepare("SELECT * FROM configs ORDER BY created_at DESC")
      .all();

    return NextResponse.json({
      systemConfig: getSystemConfig(db),
      projects: projects.map((p: any) => ({
        ...p,
        readme_md: p.readme_md || "",
        cover_image: p.cover_image || "",
        tech_stack: JSON.parse(p.tech_stack || "[]"),
        pinned: Boolean(p.pinned),
      })),
      projectImages,
      commands,
      tasks,
      notes: notes.map((n: any) => ({
        ...n,
        pinned: Boolean(n.pinned),
      })),
      configs: configs.map((c: any) => ({
        ...c,
        is_secret: Boolean(c.is_secret),
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value)) {
      return NextResponse.json({ error: "Unauthorized", unauthorized: true }, { status: 401 });
    }

    const db = getDb();
    const body = await req.json();
    const { entity, action, payload } = body;

    if (entity === "system_config" && action === "update") {
      const upsert = db.prepare(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)"
      );
      if (payload.appPort !== undefined)
        upsert.run("cfg_app_port", String(payload.appPort).trim());
      if (payload.hostDataDir !== undefined)
        upsert.run("cfg_host_data_dir", String(payload.hostDataDir).trim());
      if (payload.localDomain !== undefined)
        upsert.run("cfg_local_domain", String(payload.localDomain).trim());
      if (payload.secondaryLocalDomain !== undefined)
        upsert.run(
          "cfg_secondary_local_domain",
          String(payload.secondaryLocalDomain).trim()
        );
      if (payload.publicDomain !== undefined)
        upsert.run("cfg_public_domain", String(payload.publicDomain).trim());
      if (payload.dnsServerIp !== undefined)
        upsert.run("cfg_dns_server_ip", String(payload.dnsServerIp).trim());
      if (payload.maxUploadMb !== undefined)
        upsert.run("cfg_max_upload_mb", String(Number(payload.maxUploadMb) || 8));
      if (payload.watchtowerInterval !== undefined)
        upsert.run(
          "cfg_watchtower_interval",
          String(Number(payload.watchtowerInterval) || 60)
        );

      return NextResponse.json({
        success: true,
        systemConfig: getSystemConfig(db),
      });
    }

    if (entity === "project") {
      if (action === "create") {
        const slug = (payload.name || "project")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-");
        const stmt = db.prepare(`
          INSERT INTO projects (name, slug, description, readme_md, cover_image, status, priority, tech_stack, repo_url, live_url, local_path, server_ip, server_port, docker_container, color, pinned)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const info = stmt.run(
          payload.name,
          slug,
          payload.description || "",
          payload.readme_md || "",
          payload.cover_image || "",
          payload.status || "active",
          payload.priority || "medium",
          JSON.stringify(payload.tech_stack || []),
          payload.repo_url || "",
          payload.live_url || "",
          payload.local_path || "",
          payload.server_ip || "",
          payload.server_port || "",
          payload.docker_container || "",
          payload.color || "#6366f1",
          payload.pinned ? 1 : 0
        );
        return NextResponse.json({ id: Number(info.lastInsertRowid), success: true });
      }

      if (action === "update") {
        const stmt = db.prepare(`
          UPDATE projects
          SET name = ?, description = ?, readme_md = ?, cover_image = ?, status = ?, priority = ?, tech_stack = ?,
              repo_url = ?, live_url = ?, local_path = ?, server_ip = ?, server_port = ?,
              docker_container = ?, color = ?, pinned = ?, updated_at = datetime('now')
          WHERE id = ?
        `);
        stmt.run(
          payload.name,
          payload.description || "",
          payload.readme_md || "",
          payload.cover_image || "",
          payload.status || "active",
          payload.priority || "medium",
          JSON.stringify(payload.tech_stack || []),
          payload.repo_url || "",
          payload.live_url || "",
          payload.local_path || "",
          payload.server_ip || "",
          payload.server_port || "",
          payload.docker_container || "",
          payload.color || "#6366f1",
          payload.pinned ? 1 : 0,
          payload.id
        );
        return NextResponse.json({ success: true });
      }

      if (action === "update_readme") {
        db.prepare(
          "UPDATE projects SET readme_md = ?, updated_at = datetime('now') WHERE id = ?"
        ).run(payload.readme_md || "", payload.id);
        return NextResponse.json({ success: true });
      }

      if (action === "update_cover") {
        db.prepare(
          "UPDATE projects SET cover_image = ?, updated_at = datetime('now') WHERE id = ?"
        ).run(payload.cover_image || "", payload.id);
        return NextResponse.json({ success: true });
      }

      if (action === "toggle_pin") {
        db.prepare(
          "UPDATE projects SET pinned = CASE WHEN pinned = 1 THEN 0 ELSE 1 END, updated_at = datetime('now') WHERE id = ?"
        ).run(payload.id);
        return NextResponse.json({ success: true });
      }

      if (action === "delete") {
        db.prepare("DELETE FROM projects WHERE id = ?").run(payload.id);
        return NextResponse.json({ success: true });
      }
    }

    if (entity === "project_image") {
      if (action === "create") {
        const stmt = db.prepare(`
          INSERT INTO project_images (project_id, title, image_url)
          VALUES (?, ?, ?)
        `);
        const info = stmt.run(
          Number(payload.project_id),
          payload.title || "",
          payload.image_url
        );
        return NextResponse.json({ id: Number(info.lastInsertRowid), success: true });
      }

      if (action === "delete") {
        db.prepare("DELETE FROM project_images WHERE id = ?").run(payload.id);
        return NextResponse.json({ success: true });
      }
    }

    if (entity === "command") {
      if (action === "create") {
        const stmt = db.prepare(`
          INSERT INTO commands (project_id, title, command_text, category)
          VALUES (?, ?, ?, ?)
        `);
        const info = stmt.run(
          payload.project_id ? Number(payload.project_id) : null,
          payload.title,
          payload.command_text,
          payload.category || "docker"
        );
        return NextResponse.json({ id: Number(info.lastInsertRowid), success: true });
      }

      if (action === "delete") {
        db.prepare("DELETE FROM commands WHERE id = ?").run(payload.id);
        return NextResponse.json({ success: true });
      }
    }

    if (entity === "task") {
      if (action === "create") {
        const stmt = db.prepare(`
          INSERT INTO tasks (project_id, title, description, status, priority, tag, due_date, due_time)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const info = stmt.run(
          payload.project_id || null,
          payload.title,
          payload.description || "",
          payload.status || "todo",
          payload.priority || "medium",
          payload.tag || "feature",
          payload.due_date || "",
          payload.due_time || ""
        );
        return NextResponse.json({ id: Number(info.lastInsertRowid), success: true });
      }

      if (action === "update_status") {
        db.prepare("UPDATE tasks SET status = ? WHERE id = ?").run(
          payload.status,
          payload.id
        );
        return NextResponse.json({ success: true });
      }

      if (action === "delete") {
        db.prepare("DELETE FROM tasks WHERE id = ?").run(payload.id);
        return NextResponse.json({ success: true });
      }
    }

    if (entity === "note") {
      if (action === "create") {
        const stmt = db.prepare(`
          INSERT INTO notes (project_id, title, content, category, pinned)
          VALUES (?, ?, ?, ?, ?)
        `);
        const info = stmt.run(
          payload.project_id || null,
          payload.title,
          payload.content || "",
          payload.category || "general",
          payload.pinned ? 1 : 0
        );
        return NextResponse.json({ id: Number(info.lastInsertRowid), success: true });
      }

      if (action === "update") {
        const stmt = db.prepare(`
          UPDATE notes
          SET project_id = ?, title = ?, content = ?, category = ?, pinned = ?, updated_at = datetime('now')
          WHERE id = ?
        `);
        stmt.run(
          payload.project_id || null,
          payload.title,
          payload.content || "",
          payload.category || "general",
          payload.pinned ? 1 : 0,
          payload.id
        );
        return NextResponse.json({ success: true });
      }

      if (action === "delete") {
        db.prepare("DELETE FROM notes WHERE id = ?").run(payload.id);
        return NextResponse.json({ success: true });
      }
    }

    if (entity === "config") {
      if (action === "create") {
        const stmt = db.prepare(`
          INSERT INTO configs (project_id, label, key_name, value_content, is_secret, environment)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        const info = stmt.run(
          payload.project_id || null,
          payload.label,
          payload.key_name,
          payload.value_content,
          payload.is_secret ? 1 : 0,
          payload.environment || "production"
        );
        return NextResponse.json({ id: Number(info.lastInsertRowid), success: true });
      }

      if (action === "delete") {
        db.prepare("DELETE FROM configs WHERE id = ?").run(payload.id);
        return NextResponse.json({ success: true });
      }
    }

    return NextResponse.json({ error: "Invalid action or entity" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
