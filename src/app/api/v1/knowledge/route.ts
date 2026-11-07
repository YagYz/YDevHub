import { NextRequest, NextResponse } from "next/server";
import { getDb, SESSION_COOKIE_NAME, verifyAuthOrApiKey } from "@/lib/db";

// Helper to extract [[topic]] links from text
function extractWikiLinks(text: string): string[] {
  const matches = text.match(/\[\[(.*?)\]\]/g);
  if (!matches) return [];
  const links = matches.map((m) => m.slice(2, -2).trim().toLowerCase());
  return Array.from(new Set(links));
}

export async function GET(req: NextRequest) {
  try {
    if (!verifyAuthOrApiKey(req.headers, req.cookies.get(SESSION_COOKIE_NAME)?.value)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const service = searchParams.get("service") || searchParams.get("tag");
    const search = searchParams.get("search");
    const link = searchParams.get("link");
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 200);

    const conditions: string[] = [];
    const params: any[] = [];

    if (service) {
      conditions.push("LOWER(service_tag) = LOWER(?)");
      params.push(service.trim());
    }

    if (link) {
      conditions.push("linked_topics LIKE ?");
      params.push(`%"${link.trim().toLowerCase()}"%`);
    }

    if (search) {
      conditions.push("(title LIKE ? OR summary LIKE ? OR content LIKE ?)");
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    let sql = "SELECT * FROM agent_knowledge";
    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY updated_at DESC, id DESC LIMIT ?";
    params.push(limit);

    const db = getDb();
    const rows = db.prepare(sql).all(...params) as any[];

    return NextResponse.json({
      success: true,
      count: rows.length,
      knowledge: rows.map((r) => ({
        ...r,
        linked_topics: JSON.parse(r.linked_topics || "[]"),
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
    const serviceTag = (body.service_tag || body.service || "general").trim();
    const title = (body.title || "").trim();
    const summary = (body.summary || "").trim();
    const content = (body.content || "").trim();
    const diffDigest = (body.diff_digest || "").trim();
    const sourceDevice = (body.source_device || "").trim();
    const projectId = body.project_id ? Number(body.project_id) : null;

    if (!title || !summary) {
      return NextResponse.json(
        { error: "Başlık ('title') ve özet ('summary') alanları zorunludur" },
        { status: 400 }
      );
    }

    // Auto-detect wiki links from content and summary, merged with any provided
    const detectedLinks = [
      ...extractWikiLinks(content),
      ...extractWikiLinks(summary),
      ...extractWikiLinks(title),
      ...(Array.isArray(body.linked_topics) ? body.linked_topics : []),
    ];
    const uniqueLinks = Array.from(new Set(detectedLinks.map((l: string) => l.trim().toLowerCase())));

    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO agent_knowledge (
        project_id, service_tag, title, summary, content, diff_digest, linked_topics, source_device
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      projectId,
      serviceTag,
      title,
      summary,
      content,
      diffDigest,
      JSON.stringify(uniqueLinks),
      sourceDevice
    );

    const inserted = db
      .prepare("SELECT * FROM agent_knowledge WHERE id = ?")
      .get(result.lastInsertRowid) as any;

    return NextResponse.json(
      {
        success: true,
        knowledge: {
          ...inserted,
          linked_topics: JSON.parse(inserted.linked_topics || "[]"),
        },
      },
      { status: 201 }
    );
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
    const existing = db.prepare("SELECT * FROM agent_knowledge WHERE id = ?").get(id) as any;
    if (!existing) {
      return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 });
    }

    const serviceTag = body.service_tag !== undefined ? String(body.service_tag).trim() : existing.service_tag;
    const title = body.title !== undefined ? String(body.title).trim() : existing.title;
    const summary = body.summary !== undefined ? String(body.summary).trim() : existing.summary;
    const content = body.content !== undefined ? String(body.content).trim() : existing.content;
    const diffDigest = body.diff_digest !== undefined ? String(body.diff_digest).trim() : existing.diff_digest;
    const sourceDevice = body.source_device !== undefined ? String(body.source_device).trim() : existing.source_device;
    const projectId = body.project_id !== undefined ? (body.project_id ? Number(body.project_id) : null) : existing.project_id;

    let linkedTopics = existing.linked_topics ? JSON.parse(existing.linked_topics) : [];
    if (body.linked_topics !== undefined && Array.isArray(body.linked_topics)) {
      linkedTopics = body.linked_topics;
    }
    const detected = [
      ...extractWikiLinks(content),
      ...extractWikiLinks(summary),
      ...extractWikiLinks(title),
      ...linkedTopics,
    ];
    const uniqueLinks = Array.from(new Set(detected.map((l: string) => l.trim().toLowerCase())));

    db.prepare(`
      UPDATE agent_knowledge
      SET project_id = ?, service_tag = ?, title = ?, summary = ?, content = ?, diff_digest = ?, linked_topics = ?, source_device = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      projectId,
      serviceTag,
      title,
      summary,
      content,
      diffDigest,
      JSON.stringify(uniqueLinks),
      sourceDevice,
      id
    );

    const updated = db.prepare("SELECT * FROM agent_knowledge WHERE id = ?").get(id) as any;

    return NextResponse.json({
      success: true,
      knowledge: {
        ...updated,
        linked_topics: JSON.parse(updated.linked_topics || "[]"),
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
    const res = db.prepare("DELETE FROM agent_knowledge WHERE id = ?").run(id);

    return NextResponse.json({
      success: true,
      deleted_id: id,
      changes: Number(res.changes),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
