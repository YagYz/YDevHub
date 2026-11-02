import { NextRequest, NextResponse } from "next/server";
import { getDb, SESSION_COOKIE_NAME, verifyAuthOrApiKey } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    if (!verifyAuthOrApiKey(req.headers, req.cookies.get(SESSION_COOKIE_NAME)?.value)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const isDone = searchParams.get("is_done");
    const search = searchParams.get("search");
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 200);

    const conditions: string[] = [];
    const params: any[] = [];

    if (date) {
      conditions.push("date = ?");
      params.push(date);
    }
    if (isDone !== null && isDone !== undefined) {
      const boolVal = isDone === "true" || isDone === "1";
      conditions.push("is_done = ?");
      params.push(boolVal ? 1 : 0);
    }
    if (search) {
      conditions.push("content LIKE ?");
      params.push(`%${search.trim()}%`);
    }

    let sql = "SELECT * FROM daily_notes";
    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY date DESC, is_done ASC, created_at DESC LIMIT ?";
    params.push(limit);

    const db = getDb();
    const rows = db.prepare(sql).all(...params) as any[];

    return NextResponse.json({
      success: true,
      count: rows.length,
      notes: rows.map((n) => ({
        ...n,
        is_done: Boolean(n.is_done),
      })),
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
    const content = (body.content || "").trim();
    if (!content) {
      return NextResponse.json({ error: "İçerik (content) zorunludur" }, { status: 400 });
    }

    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
    const date = body.date || today;
    const dueTime = (body.due_time || "").trim();
    const priority = body.priority || "medium";
    const source = body.source || "cli";

    const db = getDb();
    const result = db
      .prepare(
        "INSERT INTO daily_notes (content, date, due_time, is_done, priority, source) VALUES (?, ?, ?, 0, ?, ?)"
      )
      .run(content, date, dueTime, priority, source);

    const inserted = db
      .prepare("SELECT * FROM daily_notes WHERE id = ?")
      .get(result.lastInsertRowid) as any;

    return NextResponse.json({
      success: true,
      note: {
        ...inserted,
        is_done: Boolean(inserted.is_done),
      },
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
    const existing = db.prepare("SELECT * FROM daily_notes WHERE id = ?").get(id) as any;
    if (!existing) {
      return NextResponse.json({ error: "Not bulunamadı" }, { status: 404 });
    }

    const newDone = typeof body.is_done === "boolean" ? (body.is_done ? 1 : 0) : existing.is_done;
    const newContent = body.content !== undefined ? String(body.content).trim() : existing.content;
    const newPriority = body.priority !== undefined ? body.priority : existing.priority;
    const newDueTime = body.due_time !== undefined ? String(body.due_time).trim() : (existing.due_time || "");
    const newDate = body.date !== undefined ? String(body.date).trim() : existing.date;

    db.prepare(`
      UPDATE daily_notes
      SET content = ?, is_done = ?, priority = ?, due_time = ?, date = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newContent, newDone, newPriority, newDueTime, newDate, id);

    const updated = db.prepare("SELECT * FROM daily_notes WHERE id = ?").get(id) as any;

    return NextResponse.json({
      success: true,
      note: {
        ...updated,
        is_done: Boolean(updated.is_done),
      },
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
    const res = db.prepare("DELETE FROM daily_notes WHERE id = ?").run(id);

    return NextResponse.json({
      success: true,
      deleted_id: id,
      changes: Number(res.changes),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
