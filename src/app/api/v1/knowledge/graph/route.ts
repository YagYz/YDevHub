import { NextRequest, NextResponse } from "next/server";
import { getDb, SESSION_COOKIE_NAME, verifyAuthOrApiKey } from "@/lib/db";
import { normalizeWikiLink } from "../route";

export async function GET(req: NextRequest) {
  try {
    if (!verifyAuthOrApiKey(req.headers, req.cookies.get(SESSION_COOKIE_NAME)?.value)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const target = searchParams.get("target") || searchParams.get("tag");

    const db = getDb();

    // If specific target tag requested, return its direct connections & backlinks
    if (target) {
      const normTarget = normalizeWikiLink(target);
      const backlinks = db
        .prepare(`
          SELECT ak.id, ak.service_tag, ak.title, ak.summary, ak.source_device, ak.updated_at
          FROM knowledge_links kl
          JOIN agent_knowledge ak ON ak.id = kl.source_id
          WHERE kl.target_tag = ? OR kl.target_tag LIKE ?
          ORDER BY ak.updated_at DESC
        `)
        .all(normTarget, `${normTarget}/%`) as any[];

      const exactNode = db
        .prepare("SELECT * FROM agent_knowledge WHERE LOWER(service_tag) = ? OR LOWER(title) = ? LIMIT 1")
        .get(normTarget, normTarget) as any;

      return NextResponse.json({
        success: true,
        target: normTarget,
        node: exactNode ? {
          ...exactNode,
          linked_topics: JSON.parse(exactNode.linked_topics || "[]"),
        } : null,
        backlinks,
      });
    }

    // Return the full graph (nodes and edges) for UI visualization
    const nodesRaw = db.prepare("SELECT id, service_tag, title, summary, source_device, updated_at FROM agent_knowledge").all() as any[];
    const edgesRaw = db.prepare("SELECT source_id, target_tag FROM knowledge_links").all() as any[];

    // Extract all unique target tags that might not be full nodes yet
    const knownNodeIds = new Set(nodesRaw.map((n) => n.id));
    const targetTagMap = new Map<string, string>();
    for (const e of edgesRaw) {
      if (!targetTagMap.has(e.target_tag)) {
        targetTagMap.set(e.target_tag, `tag:${e.target_tag}`);
      }
    }

    const nodes = [
      ...nodesRaw.map((n) => ({
        id: String(n.id),
        type: "entry",
        service_tag: n.service_tag,
        label: n.title,
        summary: n.summary,
        device: n.source_device,
      })),
      ...Array.from(targetTagMap.entries()).map(([tag, id]) => ({
        id,
        type: "topic",
        service_tag: tag.split("/")[0] || "tag",
        label: `[[${tag}]]`,
        summary: "",
        device: "",
      })),
    ];

    const edges = edgesRaw.map((e: any, idx: number) => ({
      id: `e-${idx}`,
      source: String(e.source_id),
      target: targetTagMap.get(e.target_tag) || e.target_tag,
      label: e.target_tag,
    }));

    return NextResponse.json({
      success: true,
      nodes,
      edges,
      stats: {
        total_nodes: nodes.length,
        total_edges: edges.length,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
