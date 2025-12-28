import { NextResponse } from "next/server";
import { getUserByToken } from "@/lib/auth";
import { subscribeNotifications } from "@/lib/notificationStream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const baseHeaders = {
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Credentials": "true",
};

const withCors = (req: Request) => {
  const origin = req.headers.get("origin") || "*";
  return { ...baseHeaders, "Access-Control-Allow-Origin": origin };
};

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 200, headers: withCors(req) });
}

export async function GET(req: Request) {
  // Token pode vir no header Authorization ou em query ?token=
  const { searchParams } = new URL(req.url);
  const queryToken = searchParams.get("token");
  const headerAuth = req.headers.get("authorization");
  let token = queryToken;
  if (!token && headerAuth && headerAuth.startsWith("Bearer ")) {
    token = headerAuth.slice(7).trim();
  }
  if (!token) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: withCors(req) });
  }

  const session = await getUserByToken(token);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: withCors(req) });
  }

  let keepAlive: NodeJS.Timeout | null = null;
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: any) => {
        controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
      };
      // Keep-alive
      keepAlive = setInterval(() => send({ type: "ping" }), 15000);

      unsubscribe = subscribeNotifications((payload) => {
        if (payload.userId === session.user.id) {
          send({ type: "notification", data: payload.data });
        }
      });

      controller.enqueue(`data: ${JSON.stringify({ type: "ready" })}\n\n`);
    },
    cancel() {
      if (keepAlive) clearInterval(keepAlive);
      if (unsubscribe) unsubscribe();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...withCors(req),
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
