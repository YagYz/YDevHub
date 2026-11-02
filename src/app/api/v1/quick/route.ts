import { NextRequest, NextResponse } from "next/server";
import { getDb, SESSION_COOKIE_NAME, verifyAuthOrApiKey } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    if (!verifyAuthOrApiKey(req.headers, req.cookies.get(SESSION_COOKIE_NAME)?.value)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const rawText = String(body.text || body.content || "").trim();
    if (!rawText) {
      return NextResponse.json({ error: "Metin (text) zorunludur" }, { status: 400 });
    }

    const db = getDb();
    const priority = body.priority || "medium";

    // Detect if this is a task
    const isTaskPrefix = /^(!task|task:|!gorev|gorev:)\s*/i;
    const isTask = body.type === "task" || isTaskPrefix.test(rawText);
    const cleanText = rawText.replace(isTaskPrefix, "").trim();

    if (isTask) {
      const result = db
        .prepare(`
          INSERT INTO tasks (title, description, status, priority, tag)
          VALUES (?, ?, 'todo', ?, 'quick')
        `)
        .run(cleanText, body.description || "", priority);

      const inserted = db
        .prepare("SELECT * FROM tasks WHERE id = ?")
        .get(result.lastInsertRowid) as any;

      return NextResponse.json({
        success: true,
        type: "task",
        data: inserted,
      }, { status: 201 });
    }

    // Default: daily note
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
    const date = body.date || today;
    const source = body.source || "quick-api";

    const result = db
      .prepare(`
        INSERT INTO daily_notes (content, date, due_time, is_done, priority, source)
        VALUES (?, ?, '', 0, ?, ?)
      `)
      .run(cleanText, date, priority, source);

    const inserted = db
      .prepare("SELECT * FROM daily_notes WHERE id = ?")
      .get(result.lastInsertRowid) as any;

    return NextResponse.json({
      success: true,
      type: "note",
      data: {
        ...inserted,
        is_done: Boolean(inserted.is_done),
      },
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
