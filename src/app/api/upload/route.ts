import { NextRequest, NextResponse } from "next/server";
import { getUploadsDir, SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/db";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB

function detectImageExtension(buf: Buffer): "png" | "jpg" | "gif" | "webp" | null {
  if (buf.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "png";
  }

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "jpg";
  }

  // GIF: 47 49 46 38 (GIF87a / GIF89a)
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return "gif";
  }

  // WEBP: RIFF....WEBP
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "webp";
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    if (!verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value)) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 });
    }

    const db = (await import("@/lib/db")).getDb();
    const maxMbRow = db
      .prepare("SELECT value FROM settings WHERE key = 'cfg_max_upload_mb'")
      .get() as { value: string } | undefined;
    const maxMb = Number(maxMbRow?.value || process.env.MAX_UPLOAD_MB || 8);
    const maxBytes = maxMb * 1024 * 1024;

    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `Dosya boyutu maksimum ${maxMb} MB olabilir.` },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const ext = detectImageExtension(buffer);
    if (!ext) {
      return NextResponse.json(
        {
          error:
            "Güvenlik reddi: Yalnızca geçerli PNG, JPG, GIF veya WEBP görselleri yüklenebilir.",
        },
        { status: 400 }
      );
    }

    const randomHex = crypto.randomBytes(16).toString("hex");
    const filename = `${randomHex}.${ext}`;
    const targetPath = path.join(getUploadsDir(), filename);

    fs.writeFileSync(targetPath, buffer, { mode: 0o600 });

    return NextResponse.json({
      success: true,
      url: `/api/uploads/${filename}`,
      filename,
    });
  } catch {
    return NextResponse.json({ error: "Görsel yükleme başarısız" }, { status: 500 });
  }
}
