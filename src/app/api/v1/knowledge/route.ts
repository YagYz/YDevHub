import { NextRequest, NextResponse } from "next/server";
import { getDb, SESSION_COOKIE_NAME, verifyAuthOrApiKey } from "@/lib/db";

// Format validator and normalizer for taxonomy: [[project/layer/topic]] or [[project/topic]]
export function normalizeWikiLink(raw: string): string {
  if (typeof raw !== "string") return "";
  let clean = raw.trim().toLowerCase();
  clean = clean.replace(/^[\[\s]+|[\]\s]+$/g, "");
  // Block directory traversal components
  clean = clean.replace(/\.{2,}/g, "");
  // Allow only alphanumeric, underscore, dash, dot, and slash
  clean = clean.replace(/[^a-z0-9_\-\.\/]/g, "-");
  clean = clean.replace(/\/+/g, "/").replace(/\-+/g, "-");
  clean = clean.replace(/^[\-\/\.]+|[\-\/\.]+$/g, "");
  return clean.slice(0, 80);
}

export function extractWikiLinks(text: string): string[] {
  if (typeof text !== "string") return [];
  const matches = text.match(/\[\[(.*?)\]\]/g);
  if (!matches) return [];
  const links = matches.map((m) => normalizeWikiLink(m));
  return Array.from(new Set(links.filter((l) => l.length > 0)));
}

// Sync relational links in knowledge_links table
export function syncKnowledgeLinks(db: any, sourceId: number, links: string[]): void {
  db.prepare("DELETE FROM knowledge_links WHERE source_id = ?").run(sourceId);
  if (links.length > 0) {
    const insertStmt = db.prepare(
      "INSERT INTO knowledge_links (source_id, target_tag) VALUES (?, ?)"
    );
    for (const link of links) {
      insertStmt.run(sourceId, link);
    }
  }
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
      conditions.push("LOWER(k.service_tag) = LOWER(?)");
      params.push(service.trim());
    }

    if (link) {
      const normLink = normalizeWikiLink(link);
      conditions.push(
        "k.id IN (SELECT source_id FROM knowledge_links WHERE target_tag = ? OR target_tag LIKE ?)"
      );
      params.push(normLink, `${normLink}/%`);
    }

    if (search) {
      conditions.push("(k.title LIKE ? OR k.summary LIKE ? OR k.content LIKE ?)");
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    let sql = "SELECT k.* FROM agent_knowledge k";
    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY k.updated_at DESC, k.id DESC LIMIT ?";
    params.push(limit);

    const db = getDb();
    const rows = db.prepare(sql).all(...params) as any[];

    // Fetch backlinks for each row
    const enriched = rows.map((r) => {
      const selfTags = [
        normalizeWikiLink(r.service_tag),
        normalizeWikiLink(`${r.service_tag}/${r.title}`),
      ];
      const backlinks = db
        .prepare(`
          SELECT ak.id, ak.service_tag, ak.title, ak.summary
          FROM knowledge_links kl
          JOIN agent_knowledge ak ON ak.id = kl.source_id
          WHERE (kl.target_tag = ? OR kl.target_tag = ?) AND ak.id != ?
          LIMIT 10
        `)
        .all(selfTags[0], selfTags[1], r.id) as any[];

      return {
        ...r,
        linked_topics: JSON.parse(r.linked_topics || "[]"),
        backlinks: backlinks.map((b) => ({
          id: b.id,
          service_tag: b.service_tag,
          title: b.title,
          summary: b.summary,
        })),
      };
    });

    return NextResponse.json({
      success: true,
      count: enriched.length,
      knowledge: enriched,
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
    const serviceTag = (body.service_tag || body.service || "general").trim().slice(0, 50);
    const title = (body.title || "").trim().slice(0, 200);
    const summary = (body.summary || "").trim().slice(0, 1000);
    const content = (body.content || "").trim().slice(0, 50000);
    const diffDigest = (body.diff_digest || "").trim().slice(0, 20000);
    const sourceDevice = (body.source_device || "").trim().slice(0, 50);
    const projectId = body.project_id ? Number(body.project_id) : null;

    if (!title || !summary) {
      return NextResponse.json(
        { error: "Başlık ('title') ve özet ('summary') alanları zorunludur" },
        { status: 400 }
      );
    }

    const detectedLinks = [
      ...extractWikiLinks(content),
      ...extractWikiLinks(summary),
      ...extractWikiLinks(title),
      ...(Array.isArray(body.linked_topics) ? body.linked_topics.map(normalizeWikiLink) : []),
    ];
    const uniqueLinks = Array.from(new Set(detectedLinks.filter((l) => l.length > 0)));

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

    const insertedId = Number(result.lastInsertRowid);
    syncKnowledgeLinks(db, insertedId, uniqueLinks);

    const inserted = db
      .prepare("SELECT * FROM agent_knowledge WHERE id = ?")
      .get(insertedId) as any;

    return NextResponse.json(
      {
        success: true,
        knowledge: {
          ...inserted,
          linked_topics: uniqueLinks,
          backlinks: [],
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

    const serviceTag = body.service_tag !== undefined ? String(body.service_tag).trim().slice(0, 50) : existing.service_tag;
    const title = body.title !== undefined ? String(body.title).trim().slice(0, 200) : existing.title;
    const summary = body.summary !== undefined ? String(body.summary).trim().slice(0, 1000) : existing.summary;
    const content = body.content !== undefined ? String(body.content).trim().slice(0, 50000) : existing.content;
    const diffDigest = body.diff_digest !== undefined ? String(body.diff_digest).trim().slice(0, 20000) : existing.diff_digest;
    const sourceDevice = body.source_device !== undefined ? String(body.source_device).trim().slice(0, 50) : existing.source_device;
    const projectId = body.project_id !== undefined ? (body.project_id ? Number(body.project_id) : null) : existing.project_id;

    let linkedTopics = existing.linked_topics ? JSON.parse(existing.linked_topics) : [];
    if (body.linked_topics !== undefined && Array.isArray(body.linked_topics)) {
      linkedTopics = body.linked_topics.map(normalizeWikiLink);
    }
    const detected = [
      ...extractWikiLinks(content),
      ...extractWikiLinks(summary),
      ...extractWikiLinks(title),
      ...linkedTopics,
    ];
    const uniqueLinks = Array.from(new Set(detected.map(normalizeWikiLink).filter((l) => l.length > 0)));

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

    syncKnowledgeLinks(db, id, uniqueLinks);

    const updated = db.prepare("SELECT * FROM agent_knowledge WHERE id = ?").get(id) as any;

    return NextResponse.json({
      success: true,
      knowledge: {
        ...updated,
        linked_topics: uniqueLinks,
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
    db.prepare("DELETE FROM knowledge_links WHERE source_id = ?").run(id);
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
