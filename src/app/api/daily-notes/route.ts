import { NextRequest, NextResponse } from "next/server";
import { getDb, SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    if (!verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date"); // YYYY-MM-DD
    const db = getDb();

    let notes;
    if (date) {
      notes = db
        .prepare("SELECT * FROM daily_notes WHERE date = ? ORDER BY is_done ASC, created_at DESC")
        .all(date);
    } else {
      notes = db
        .prepare("SELECT * FROM daily_notes ORDER BY date DESC, is_done ASC, created_at DESC LIMIT 100")
        .all();
    }

    return NextResponse.json({
      notes: notes.map((n: any) => ({
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
    if (!verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const content = (body.content || "").trim();
    if (!content) {
      return NextResponse.json({ error: "İçerik boş olamaz" }, { status: 400 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const date = body.date || today;
    const priority = body.priority || "medium";
    const source = body.source || "web";

    const db = getDb();
    const result = db
      .prepare(
        "INSERT INTO daily_notes (content, date, is_done, priority, source) VALUES (?, ?, 0, ?, ?)"
      )
      .run(content, date, priority, source);

    const inserted = db
      .prepare("SELECT * FROM daily_notes WHERE id = ?")
      .get(result.lastInsertRowid) as any;

    return NextResponse.json({
      note: {
        ...inserted,
        is_done: Boolean(inserted.is_done),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, is_done, content, priority } = body;

    if (!id) {
      return NextResponse.json({ error: "ID belirtilmedi" }, { status: 400 });
    }

    const db = getDb();
    const existing = db.prepare("SELECT * FROM daily_notes WHERE id = ?").get(id) as any;
    if (!existing) {
      return NextResponse.json({ error: "Not bulunamadı" }, { status: 404 });
    }

    const newDone = typeof is_done === "boolean" ? (is_done ? 1 : 0) : existing.is_done;
    const newContent = content !== undefined ? String(content).trim() : existing.content;
    const newPriority = priority !== undefined ? priority : existing.priority;

    db.prepare(
      "UPDATE daily_notes SET content = ?, is_done = ?, priority = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(newContent, newDone, newPriority, id);

    const updated = db.prepare("SELECT * FROM daily_notes WHERE id = ?").get(id) as any;

    return NextResponse.json({
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
    if (!verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID belirtilmedi" }, { status: 400 });
    }

    const db = getDb();
    db.prepare("DELETE FROM daily_notes WHERE id = ?").run(Number(id));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
