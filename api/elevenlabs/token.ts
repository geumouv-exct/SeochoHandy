import type { IncomingMessage, ServerResponse } from "node:http";

type RequestHeader = string | string[] | undefined;
type RequestLimit = { count: number; resetAt: number };

const recentRequests = new Map<string, RequestLimit>();

function firstHeader(value: RequestHeader) {
  return (Array.isArray(value) ? value[0] : value)?.split(",")[0]?.trim() ?? "";
}

function json(response: ServerResponse, status: number, payload: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

module.exports = async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return json(response, 405, { error: "POST 요청만 사용할 수 있어요." });
  }

  const origin = firstHeader(request.headers.origin);
  const host = firstHeader(request.headers["x-forwarded-host"]) || firstHeader(request.headers.host);
  if (!origin || !host) return json(response, 403, { error: "허용되지 않은 요청입니다." });
  try {
    if (new URL(origin).host !== host) return json(response, 403, { error: "허용되지 않은 요청입니다." });
  } catch {
    return json(response, 403, { error: "허용되지 않은 요청입니다." });
  }

  const now = Date.now();
  const address = firstHeader(request.headers["x-forwarded-for"]) || "unknown";
  const limit = recentRequests.get(address);
  if (limit && now < limit.resetAt && limit.count >= 8) {
    return json(response, 429, { error: "잠시 후 음성 연결을 다시 시도해 주세요." });
  }
  recentRequests.set(address, !limit || now >= limit.resetAt ? { count: 1, resetAt: now + 60_000 } : { ...limit, count: limit.count + 1 });
  if (recentRequests.size > 500) {
    for (const [key, value] of recentRequests) if (value.resetAt <= now) recentRequests.delete(key);
  }

  const agentId = process.env.ELEVENLABS_AGENT_ID;
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!agentId || !apiKey) {
    return json(response, 503, { error: "Vercel에 ElevenLabs Agent ID와 서버 API 키를 설정해 주세요." });
  }

  try {
    const upstream = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`, {
      method: "GET",
      headers: { "xi-api-key": apiKey, Accept: "application/json" },
      cache: "no-store",
    });
    const payload = await upstream.json() as { token?: unknown };
    if (!upstream.ok || typeof payload.token !== "string") {
      return json(response, 502, { error: "ElevenLabs 대화 토큰을 발급하지 못했어요. Agent 설정을 확인해 주세요." });
    }
    return json(response, 200, { token: payload.token });
  } catch {
    return json(response, 502, { error: "ElevenLabs에 연결할 수 없어요. 잠시 뒤 다시 시도해 주세요." });
  }
}
