import { NextRequest, NextResponse } from "next/server";
import { getDb, SESSION_COOKIE_NAME, verifyAuthOrApiKey } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    if (!verifyAuthOrApiKey(req.headers, req.cookies.get(SESSION_COOKIE_NAME)?.value)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status"); // 'todo' | 'in_progress' | 'done'
    const projectId = searchParams.get("project_id");
    const priority = searchParams.get("priority");
    const search = searchParams.get("search");
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 200);

    const conditions: string[] = [];
    const params: any[] = [];

    if (status) {
      conditions.push("status = ?");
      params.push(status);
    }
    if (projectId) {
      conditions.push("project_id = ?");
      params.push(Number(projectId));
    }
    if (priority) {
      conditions.push("priority = ?");
      params.push(priority);
    }
    if (search) {
      conditions.push("(title LIKE ? OR description LIKE ?)");
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }

    let sql = "SELECT * FROM tasks";
    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY CASE status WHEN 'todo' THEN 1 WHEN 'in_progress' THEN 2 ELSE 3 END, created_at DESC LIMIT ?";
    params.push(limit);

    const db = getDb();
    const rows = db.prepare(sql).all(...params) as any[];

    return NextResponse.json({
      success: true,
      count: rows.length,
      tasks: rows,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!verifyAuthOrApiKey(req.headers, req.cookies.get(SESSION_COOKIE_NAME)?.value)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const title = (body.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "Başlık (title) zorunludur" }, { status: 400 });
    }

    const description = (body.description || "").trim();
    const projectId = body.project_id ? Number(body.project_id) : null;
    const status = body.status || "todo";
    const priority = body.priority || "medium";
    const tag = body.tag || "feature";
    const dueDate = (body.due_date || "").trim();
    const dueTime = (body.due_time || "").trim();

    const db = getDb();
    const result = db
      .prepare(`
        INSERT INTO tasks (project_id, title, description, status, priority, tag, due_date, due_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(projectId, title, description, status, priority, tag, dueDate, dueTime);

    const inserted = db
      .prepare("SELECT * FROM tasks WHERE id = ?")
      .get(result.lastInsertRowid) as any;

    return NextResponse.json({
      success: true,
      task: inserted,
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!verifyAuthOrApiKey(req.headers, req.cookies.get(SESSION_COOKIE_NAME)?.value)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const id = Number(body.id);
    if (!id) {
      return NextResponse.json({ error: "Geçerli bir 'id' zorunludur" }, { status: 400 });
    }

    const db = getDb();
    const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as any;
    if (!existing) {
      return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
    }

    const newTitle = body.title !== undefined ? String(body.title).trim() : existing.title;
    const newDescription = body.description !== undefined ? String(body.description).trim() : existing.description;
    const newStatus = body.status !== undefined ? String(body.status).trim() : existing.status;
    const newPriority = body.priority !== undefined ? String(body.priority).trim() : existing.priority;
    const newTag = body.tag !== undefined ? String(body.tag).trim() : existing.tag;
    const newDueDate = body.due_date !== undefined ? String(body.due_date).trim() : existing.due_date;
    const newDueTime = body.due_time !== undefined ? String(body.due_time).trim() : existing.due_time;
    const newProjectId = body.project_id !== undefined ? (body.project_id ? Number(body.project_id) : null) : existing.project_id;

    db.prepare(`
      UPDATE tasks
      SET title = ?, description = ?, status = ?, priority = ?, tag = ?, due_date = ?, due_time = ?, project_id = ?
      WHERE id = ?
    `).run(newTitle, newDescription, newStatus, newPriority, newTag, newDueDate, newDueTime, newProjectId, id);

    const updated = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as any;

    return NextResponse.json({
      success: true,
      task: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!verifyAuthOrApiKey(req.headers, req.cookies.get(SESSION_COOKIE_NAME)?.value)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let id: number | null = null;
    const { searchParams } = new URL(req.url);
    if (searchParams.get("id")) {
      id = Number(searchParams.get("id"));
    } else {
      try {
        const body = await req.json();
        if (body.id) id = Number(body.id);
      } catch {}
    }

    if (!id) {
      return NextResponse.json({ error: "Geçerli bir 'id' zorunludur" }, { status: 400 });
    }

    const db = getDb();
    const res = db.prepare("DELETE FROM tasks WHERE id = ?").run(id);

    return NextResponse.json({
      success: true,
      deleted_id: id,
      changes: Number(res.changes),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
