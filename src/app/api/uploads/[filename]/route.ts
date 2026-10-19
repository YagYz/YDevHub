import { NextRequest, NextResponse } from "next/server";
import { getUploadsDir, SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/db";
import fs from "fs";
import path from "path";

const MIME_MAP: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  try {
    if (!verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value)) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { filename } = await context.params;

    // Strict regex validation prevents any Path Traversal (../)
    if (!/^[a-f0-9]{32}\.(png|jpg|gif|webp)$/.test(filename)) {
      return new NextResponse("Invalid filename", { status: 400 });
    }

    const filePath = path.join(getUploadsDir(), filename);
    if (!fs.existsSync(filePath)) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const ext = filename.split(".").pop() || "png";
    const contentType = MIME_MAP[ext] || "application/octet-stream";
    const fileBuffer = fs.readFileSync(filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
