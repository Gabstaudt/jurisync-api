import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type Attachment = {
  fileName: string;
  filePath: string;
  fileType?: string;
  fileSize?: number;
};

const parseAttachments = (value: any): Attachment[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value as Attachment[];
  try {
    return JSON.parse(value as string);
  } catch {
    return [];
  }
};

async function ensureParticipant(conversationId: string, userId: string, ecosystemId: string) {
  const { rows } = await q(
    `SELECT 1
     FROM chat_conversations c
     JOIN chat_participants p ON p.conversation_id = c.id
     WHERE c.id = $1 AND p.user_id = $2 AND c.ecosystem_id = $3`,
    [conversationId, userId, ecosystemId],
  );
  return Boolean(rows[0]);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

export async function GET(req: NextRequest, context: any) {
  try {
    const params = context?.params as { id?: string } | undefined;
    const conversationId = params?.id;
    if (!conversationId) {
      return NextResponse.json({ error: "Conversa nao encontrada" }, { status: 404, headers: H });
    }
    const session = await requireAuth(req);
    if (!session) {
      return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
    }

    const allowed = await ensureParticipant(conversationId, session.user.id, session.user.ecosystemId);
    if (!allowed) {
      return NextResponse.json({ error: "Conversa nao encontrada" }, { status: 404, headers: H });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const before = searchParams.get("before");

    const sqlParams: any[] = [conversationId];
    let sql = `SELECT m.*, u.name AS sender_name, u.email AS sender_email
               FROM chat_messages m
               LEFT JOIN users u ON u.id = m.sender_id
               WHERE m.conversation_id = $1 AND m.is_deleted = FALSE`;

    if (before) {
      sqlParams.push(new Date(before));
      sql += ` AND m.created_at < $${sqlParams.length}`;
    }

    sqlParams.push(limit);
    sql += ` ORDER BY m.created_at DESC LIMIT $${sqlParams.length}`;

    const { rows } = await q(sql, sqlParams);
    const messages = rows
      .reverse()
      .map((m: any) => ({
        id: m.id,
        conversationId: m.conversation_id,
        senderId: m.sender_id,
        senderName: m.sender_name,
        senderEmail: m.sender_email,
        content: m.content,
        attachments: parseAttachments(m.attachments),
        createdAt: m.created_at,
      }));

    await q(
      "UPDATE chat_participants SET last_read_at = NOW() WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, session.user.id],
    );

    return NextResponse.json(messages, { headers: H });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500, headers: H });
  }
}

export async function POST(req: NextRequest, context: any) {
  try {
    const params = context?.params as { id?: string } | undefined;
    const conversationId = params?.id;
    if (!conversationId) {
      return NextResponse.json({ error: "Conversa nao encontrada" }, { status: 404, headers: H });
    }
    const session = await requireAuth(req);
    if (!session) {
      return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
    }

    const allowed = await ensureParticipant(conversationId, session.user.id, session.user.ecosystemId);
    if (!allowed) {
      return NextResponse.json({ error: "Conversa nao encontrada" }, { status: 404, headers: H });
    }

    const body = await req.json().catch(() => ({}));
    const attachments = parseAttachments(body.attachments);
    const content = (body.content || "").toString();

    if (!content && !attachments.length) {
      return NextResponse.json(
        { error: "Mensagem vazia" },
        { status: 400, headers: H },
      );
    }

    const { rows } = await q(
      `INSERT INTO chat_messages (conversation_id, sender_id, content, attachments)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [conversationId, session.user.id, content, JSON.stringify(attachments)],
    );
    const message = rows[0];

    await q(
      `UPDATE chat_conversations
       SET last_message_at = $1,
           last_message_preview = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [
        message.created_at,
        content ? content.slice(0, 140) : "Arquivo enviado",
        conversationId,
      ],
    );

    await q(
      "UPDATE chat_participants SET last_read_at = NOW() WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, session.user.id],
    );

    // Notificar outros participantes do chat
    try {
      const { rows: recipients } = await q(
        `SELECT u.id, u.name
         FROM chat_participants cp
         JOIN users u ON u.id = cp.user_id
         WHERE cp.conversation_id = $1 AND cp.user_id <> $2`,
        [conversationId, session.user.id],
      );
      const senderName = session.user.name || "Usuario";
      const title = "Nova mensagem no chat";
      const msg = `${senderName} enviou uma mensagem`;
      const actionUrl = `/chat?conversation=${conversationId}`;
      await Promise.all(
        recipients.map((r: any) =>
          createNotification({
            userId: r.id,
            ecosystemId: session.user.ecosystemId,
            title,
            message: msg,
            type: "info",
            actionUrl,
          }),
        ),
      );
    } catch {
      // silencioso para não bloquear envio
    }

    return NextResponse.json(
      {
        id: message.id,
        conversationId: message.conversation_id,
        senderId: message.sender_id,
        content: message.content,
        attachments,
        createdAt: message.created_at,
      },
      { status: 201, headers: H },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500, headers: H });
  }
}
