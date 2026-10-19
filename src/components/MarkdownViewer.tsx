"use client";

import React, { useState } from "react";
import { Check, Copy, CheckSquare, Square } from "lucide-react";

function renderInline(text: string, onImageClick?: (url: string) => void): React.ReactNode[] {
  // Handle inline images ![alt](url), links [label](url), inline code `code`, bold **bold**
  const tokens: React.ReactNode[] = [];
  const pattern =
    /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }

    if (match[1] !== undefined || match[2] !== undefined) {
      // Image ![alt](url)
      const alt = match[1] || "Görsel";
      const url = match[2] || "";
      const isSafeUrl =
        url.startsWith("/api/uploads/") ||
        url.startsWith("https://") ||
        url.startsWith("http://");
      if (isSafeUrl) {
        tokens.push(
          <span key={`img-${idx++}`} className="block my-3">
            <img
              src={url}
              alt={alt}
              onClick={() => onImageClick && onImageClick(url)}
              className="max-h-96 rounded-xl border border-zinc-800 object-contain cursor-zoom-in hover:border-indigo-500/50 transition shadow-lg"
            />
            {alt && alt !== "Görsel" && (
              <span className="block text-[11px] text-zinc-500 mt-1">{alt}</span>
            )}
          </span>
        );
      }
    } else if (match[3] !== undefined && match[4] !== undefined) {
      // Link [label](url)
      const label = match[3];
      const url = match[4];
      const isSafeLink =
        url.startsWith("https://") ||
        url.startsWith("http://") ||
        url.startsWith("/") ||
        url.startsWith("#");
      tokens.push(
        isSafeLink ? (
          <a
            key={`lnk-${idx++}`}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
          >
            {label}
          </a>
        ) : (
          <span key={`lnk-${idx++}`}>{label}</span>
        )
      );
    } else if (match[5] !== undefined) {
      // Inline code
      tokens.push(
        <code
          key={`code-${idx++}`}
          className="px-1.5 py-0.5 rounded bg-zinc-800/90 text-amber-300 font-mono text-xs border border-zinc-700/60"
        >
          {match[5]}
        </code>
      );
    } else if (match[6] !== undefined) {
      // Bold
      tokens.push(
        <strong key={`bold-${idx++}`} className="font-semibold text-white">
          {match[6]}
        </strong>
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }

  return tokens;
}

export default function MarkdownViewer({
  content,
  onImageClick,
}: {
  content: string;
  onImageClick?: (url: string) => void;
}) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  if (!content || !content.trim()) {
    return (
      <div className="text-xs text-zinc-500 italic py-6">
        Henüz içerik veya .md dokümanı eklenmemiş.
      </div>
    );
  }

  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const elements: React.ReactNode[] = [];

  let i = 0;
  let blockId = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block ```
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim() || "code";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const codeString = codeLines.join("\n");
      const currentBlockId = blockId++;

      elements.push(
        <div
          key={`cb-${currentBlockId}`}
          className="my-3 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950"
        >
          <div className="px-3.5 py-1.5 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between text-[11px] font-mono text-zinc-400">
            <span className="uppercase">{lang}</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(codeString);
                setCopiedIdx(currentBlockId);
                setTimeout(() => setCopiedIdx(null), 1500);
              }}
              className="flex items-center gap-1 text-zinc-400 hover:text-emerald-400 transition"
            >
              {copiedIdx === currentBlockId ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Kopyalandı
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Kopyala
                </>
              )}
            </button>
          </div>
          <pre className="p-4 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
            {codeString}
          </pre>
        </div>
      );
      continue;
    }

    // Empty line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Headings
    if (line.startsWith("# ")) {
      elements.push(
        <h1
          key={`h1-${blockId++}`}
          className="text-xl font-bold text-white border-b border-zinc-800 pb-2 mt-4 mb-3"
        >
          {renderInline(line.slice(2), onImageClick)}
        </h1>
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h2
          key={`h2-${blockId++}`}
          className="text-base font-bold text-indigo-300 mt-4 mb-2"
        >
          {renderInline(line.slice(3), onImageClick)}
        </h2>
      );
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      elements.push(
        <h3
          key={`h3-${blockId++}`}
          className="text-sm font-semibold text-zinc-100 mt-3 mb-1.5"
        >
          {renderInline(line.slice(4), onImageClick)}
        </h3>
      );
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      elements.push(
        <blockquote
          key={`bq-${blockId++}`}
          className="border-l-2 border-indigo-500 bg-indigo-500/5 pl-3.5 py-2 my-2 text-xs text-zinc-300 rounded-r-lg"
        >
          {renderInline(line.slice(2), onImageClick)}
        </blockquote>
      );
      i++;
      continue;
    }

    // Checklist item - [x] or - [ ]
    if (/^- \[(x| )\] /i.test(line.trim())) {
      const checked = line.trim().toLowerCase().startsWith("- [x]");
      const itemText = line.trim().slice(6);
      elements.push(
        <div
          key={`chk-${blockId++}`}
          className="flex items-center gap-2 text-sm my-1.5 text-zinc-200"
        >
          {checked ? (
            <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <Square className="w-4 h-4 text-zinc-500 shrink-0" />
          )}
          <span className={checked ? "line-through text-zinc-500" : ""}>
            {renderInline(itemText, onImageClick)}
          </span>
        </div>
      );
      i++;
      continue;
    }

    // Unordered list
    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      elements.push(
        <div
          key={`ul-${blockId++}`}
          className="flex items-start gap-2 text-sm my-1 text-zinc-300 pl-1"
        >
          <span className="text-indigo-400 mt-1">•</span>
          <div className="flex-1">{renderInline(line.trim().slice(2), onImageClick)}</div>
        </div>
      );
      i++;
      continue;
    }

    // Paragraph
    elements.push(
      <p key={`p-${blockId++}`} className="text-sm text-zinc-300 leading-relaxed my-2">
        {renderInline(line, onImageClick)}
      </p>
    );
    i++;
  }

  return <div className="space-y-1">{elements}</div>;
}
