import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { sendCustomOrderAdminEmail } from "@/lib/email";
import { CUSTOM_ORDER_BUCKET, MAX_FILE_BYTES } from "@/lib/customOrders";

export const dynamic = "force-dynamic";

function clean(value, max) {
  return String(value || "")
    .trim()
    .slice(0, max);
}

function generateCode() {
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CUS-${random}`;
}

// Never trust the browser-declared MIME type — check the real file header.
function sniffFile(buf, name) {
  const b = buf;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return { ext: "jpg", mime: "image/jpeg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return { ext: "png", mime: "image/png" };
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  )
    return { ext: "webp", mime: "image/webp" };
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46)
    return { ext: "pdf", mime: "application/pdf" };
  if (b[0] === 0x50 && b[1] === 0x4b && /\.docx$/i.test(name))
    return {
      ext: "docx",
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  if (
    b[0] === 0xd0 &&
    b[1] === 0xcf &&
    b[2] === 0x11 &&
    b[3] === 0xe0 &&
    /\.doc$/i.test(name)
  )
    return { ext: "doc", mime: "application/msword" };
  return null;
}

function parseDriveUrl(value) {
  const raw = clean(value, 500);
  if (!raw) return { ok: true, url: null };
  try {
    const u = new URL(raw);
    const hosts = ["drive.google.com", "docs.google.com"];
    if (u.protocol !== "https:" || !hosts.includes(u.hostname)) {
      return { ok: false };
    }
    return { ok: true, url: u.toString() };
  } catch {
    return { ok: false };
  }
}

export async function POST(req) {
  const ip = clientIp(req);
  const limited = rateLimit(`custom-order:${ip}`, {
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  try {
    const form = await req.formData();

    // Honeypot: bots fill hidden fields. Pretend success, store nothing.
    if (clean(form.get("website"), 100)) {
      return NextResponse.json({ ok: true, code: "CUS-000000" });
    }

    const name = clean(form.get("name"), 120);
    const phone = clean(form.get("phone"), 30);
    const email = clean(form.get("email"), 160);
    const message = clean(form.get("message"), 2000);
    const drive = parseDriveUrl(form.get("drive_url"));
    const file = form.get("file");

    if (!name || !phone) {
      return NextResponse.json(
        { error: "Name and phone are required." },
        { status: 400 },
      );
    }
    if (phone.replace(/\D/g, "").length < 8) {
      return NextResponse.json(
        { error: "Enter a valid phone number." },
        { status: 400 },
      );
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    }
    if (message.length < 10) {
      return NextResponse.json(
        {
          error: "Please describe your custom order (at least 10 characters).",
        },
        { status: 400 },
      );
    }
    if (!drive.ok) {
      return NextResponse.json(
        { error: "Please paste a valid Google Drive share link (https)." },
        { status: 400 },
      );
    }

    const id = crypto.randomUUID();
    let filePath = null;
    let fileName = null;
    let fileSize = null;
    let fileMime = null;

    // ---- Optional file upload ----
    if (file && typeof file === "object" && file.size > 0) {
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: "File is too large. Maximum size is 2 MB." },
          { status: 400 },
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const originalName = clean(
        String(file.name || "file")
          .split(/[\\/]/)
          .pop(),
        120,
      );
      const detected = sniffFile(buffer, originalName);
      if (!detected) {
        return NextResponse.json(
          { error: "Unsupported file. Use JPG, PNG, WebP, PDF, DOC or DOCX." },
          { status: 400 },
        );
      }

      filePath = `${id}/${Date.now()}.${detected.ext}`;
      const { error: uploadError } = await supabase.storage
        .from(CUSTOM_ORDER_BUCKET)
        .upload(filePath, buffer, {
          contentType: detected.mime,
          upsert: false,
        });
      if (uploadError) {
        console.error("[custom-orders] upload failed:", uploadError.message);
        return NextResponse.json(
          { error: "Could not upload the file. Please try again." },
          { status: 500 },
        );
      }
      fileName = originalName;
      fileSize = buffer.length;
      fileMime = detected.mime;
    }

    // ---- Insert (retry on the rare code collision) ----
    // anon has INSERT only, so we do not .select() the row back.
    let code = generateCode();
    let insertError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await supabase.from("custom_orders").insert({
        id,
        code,
        customer_name: name,
        phone,
        email: email || null,
        message,
        file_path: filePath,
        file_name: fileName,
        file_size: fileSize,
        file_mime: fileMime,
        drive_url: drive.url,
      });
      insertError = error;
      if (!error || error.code !== "23505") break;
      code = generateCode();
    }
    if (insertError) {
      console.error("[custom-orders] insert failed:", insertError.message);
      return NextResponse.json(
        { error: "Could not submit your request. Please try again." },
        { status: 500 },
      );
    }

    // ---- Notify admin (awaited so serverless doesn't kill it) ----
    try {
      const origin =
        process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
      await sendCustomOrderAdminEmail({
        code,
        customerName: name,
        phone,
        email,
        message,
        fileName,
        fileSize,
        driveUrl: drive.url,
        origin,
      });
    } catch (mailErr) {
      // The order is saved; a mail failure must not fail the customer.
      console.error("[custom-orders] admin email failed:", mailErr.message);
    }

    return NextResponse.json({ ok: true, code });
  } catch (err) {
    console.error("[custom-orders] unexpected error:", err);
    return NextResponse.json(
      { error: "Could not submit your request." },
      { status: 500 },
    );
  }
}
