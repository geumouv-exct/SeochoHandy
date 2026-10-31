import { NextResponse } from "next/server";

export const runtime = "nodejs";
const recentRequests = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  const now = Date.now();
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limit = recentRequests.get(address);
  if (limit && now < limit.resetAt && limit.count >= 8) return NextResponse.json({ error: "잠시 후 다시 음성 연결을 시도해 주세요." }, { status: 429 });
  recentRequests.set(address, !limit || now >= limit.resetAt ? { count: 1, resetAt: now + 60_000 } : { ...limit, count: limit.count + 1 });
  if (recentRequests.size > 500) for (const [key, value] of recentRequests) if (value.resetAt <= now) recentRequests.delete(key);
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!agentId || !apiKey) {
    return NextResponse.json({ error: "ElevenLabs Agent ID와 서버 API 키를 설정해 주세요." }, { status: 503 });
  }
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`, {
      method: "GET",
      headers: { "xi-api-key": apiKey, Accept: "application/json" },
      cache: "no-store",
    });
    const payload = await response.json() as { token?: unknown; detail?: unknown; message?: unknown };
    if (!response.ok || typeof payload.token !== "string") {
      return NextResponse.json({ error: "ElevenLabs 대화 인증값을 발급하지 못했어요. Agent 설정과 API 키를 확인해 주세요." }, { status: 502 });
    }
    return NextResponse.json({ token: payload.token }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "ElevenLabs에 연결할 수 없어요. 잠시 뒤 다시 시도해 주세요." }, { status: 502 });
  }
}
