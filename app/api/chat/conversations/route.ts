import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

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

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

export async function GET(req: Request) {
  try {
    const session = await requireAuth(req);
    if (!session) {
      return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
    }

    const { rows: convRows } = await q(
      `SELECT c.*, p.last_read_at
       FROM chat_conversations c
       JOIN chat_participants p ON p.conversation_id = c.id
       WHERE p.user_id = $1 AND c.ecosystem_id = $2
       ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`,
      [session.user.id, session.user.ecosystemId],
    );

    const convIds = convRows.map((c: any) => c.id);

    const participantsMap: Record<string, any[]> = {};
    if (convIds.length) {
      const { rows: participantRows } = await q(
        `SELECT cp.conversation_id, u.id, u.name, u.email, u.role
         FROM chat_participants cp
         JOIN users u ON u.id = cp.user_id
         WHERE cp.conversation_id = ANY($1::uuid[])
         ORDER BY u.name`,
        [convIds],
      );
      participantRows.forEach((r: any) => {
        if (!participantsMap[r.conversation_id]) participantsMap[r.conversation_id] = [];
        participantsMap[r.conversation_id].push({
          id: r.id,
          name: r.name,
          email: r.email,
          role: r.role,
        });
      });
    }

    const lastMessageMap: Record<string, any> = {};
    if (convIds.length) {
      const { rows: lastRows } = await q(
        `SELECT DISTINCT ON (conversation_id) conversation_id, id, sender_id, content, attachments, created_at
         FROM chat_messages
         WHERE conversation_id = ANY($1::uuid[]) AND is_deleted = FALSE
         ORDER BY conversation_id, created_at DESC`,
        [convIds],
      );
      lastRows.forEach((r: any) => {
        lastMessageMap[r.conversation_id] = {
          id: r.id,
          senderId: r.sender_id,
          content: r.content,
          attachments: parseAttachments(r.attachments),
          createdAt: r.created_at,
        };
      });
    }

    const unreadMap: Record<string, number> = {};
    if (convIds.length) {
      const { rows: unreadRows } = await q(
        `SELECT m.conversation_id, COUNT(*) AS unread
         FROM chat_messages m
         JOIN chat_participants p ON p.conversation_id = m.conversation_id AND p.user_id = $1
         WHERE m.conversation_id = ANY($2::uuid[])
           AND m.is_deleted = FALSE
           AND m.created_at > COALESCE(p.last_read_at, 'epoch'::timestamptz)
         GROUP BY m.conversation_id`,
        [session.user.id, convIds],
      );
      unreadRows.forEach((r: any) => {
        unreadMap[r.conversation_id] = Number(r.unread || 0);
      });
    }

    const result = convRows.map((c: any) => ({
      id: c.id,
      title: c.title,
      isGroup: c.is_group,
      participants: participantsMap[c.id] || [],
      lastMessage: lastMessageMap[c.id] || null,
      lastMessageAt: c.last_message_at || c.created_at,
      unreadCount: unreadMap[c.id] || 0,
      lastReadAt: c.last_read_at,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));

    return NextResponse.json(result, { headers: H });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500, headers: H });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth(req);
    if (!session) {
      return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
    }

    const body = await req.json().catch(() => ({}));
    const rawParticipants: string[] = Array.isArray(body.participantIds) ? body.participantIds : [];
    const uniqueParticipants = Array.from(new Set([...rawParticipants, session.user.id]));
    const participants = uniqueParticipants.filter((id) => id);

    if (participants.length < 2) {
      return NextResponse.json(
        { error: "Informe pelo menos um destinatario" },
        { status: 400, headers: H },
      );
    }

    const { rows: validUsers } = await q(
      "SELECT id FROM users WHERE id = ANY($1::uuid[]) AND ecosystem_id = $2",
      [participants, session.user.ecosystemId],
    );
    const validIds = validUsers.map((u: any) => u.id);
    if (validIds.length !== participants.length) {
      return NextResponse.json(
        { error: "Participante invalido para este ecossistema" },
        { status: 400, headers: H },
      );
    }

    const participantsSorted = [...participants].sort();
    const isGroup = Boolean(body.title) || participantsSorted.length > 2;

    let conversationId: string | null = null;
    if (!isGroup) {
      const { rows: existing } = await q(
        `SELECT c.id, ARRAY_AGG(cp.user_id ORDER BY cp.user_id) AS member_ids
         FROM chat_conversations c
         JOIN chat_participants cp ON cp.conversation_id = c.id
         WHERE c.ecosystem_id = $1 AND c.is_group = FALSE
         GROUP BY c.id
         HAVING ARRAY_AGG(cp.user_id ORDER BY cp.user_id) = $2::uuid[]`,
        [session.user.ecosystemId, participantsSorted],
      );
      if (existing[0]) {
        conversationId = existing[0].id;
      }
    }

    if (!conversationId) {
      const { rows } = await q(
        `INSERT INTO chat_conversations (ecosystem_id, title, is_group, created_by)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [session.user.ecosystemId, body.title || null, isGroup, session.user.id],
      );
      conversationId = rows[0].id;

      for (const pid of participants) {
        await q(
          `INSERT INTO chat_participants (conversation_id, user_id, last_read_at)
           VALUES ($1,$2,$3)
           ON CONFLICT DO NOTHING`,
          [conversationId, pid, pid === session.user.id ? new Date() : null],
        );
      }
    }

    let message = null;
    if (body.message || (Array.isArray(body.attachments) && body.attachments.length)) {
      const attachments = parseAttachments(body.attachments);
      const { rows: msgRows } = await q(
        `INSERT INTO chat_messages (conversation_id, sender_id, content, attachments)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [conversationId, session.user.id, body.message || "", JSON.stringify(attachments)],
      );
      message = msgRows[0];

      await q(
        `UPDATE chat_conversations
         SET last_message_at = $1,
             last_message_preview = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [
          message.created_at,
          body.message?.slice(0, 140) ||
            (attachments.length ? "Arquivo enviado" : "Nova mensagem"),
          conversationId,
        ],
      );

      await q(
        "UPDATE chat_participants SET last_read_at = NOW() WHERE conversation_id = $1 AND user_id = $2",
        [conversationId, session.user.id],
      );
    }

    return NextResponse.json(
      {
        id: conversationId,
        created: !body.skipCreatedFlag,
        message,
      },
      { status: 201, headers: H },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500, headers: H });
  }
}
