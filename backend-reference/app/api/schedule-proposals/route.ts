import { NextResponse } from "next/server";
import { authenticatedSupabaseClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const { supabase, user } = await authenticatedSupabaseClient();
  if (!supabase || !user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 }); }
  if (typeof body.requestId !== "string" || !UUID.test(body.requestId) || !Array.isArray(body.proposals) || body.proposals.length < 1 || body.proposals.length > 2) {
    return NextResponse.json({ error: "요청 ID 또는 일정 제안 수를 확인해 주세요." }, { status: 400 });
  }
  const proposals = body.proposals as unknown[];
  const values: { proposed_start_at: string; proposed_end_at: string }[] = [];
  for (const item of proposals) {
    if (!item || typeof item !== "object") return NextResponse.json({ error: "일정 형식이 올바르지 않습니다." }, { status: 400 });
    const choice = item as Record<string, unknown>;
    const start = typeof choice.startsAt === "string" ? new Date(choice.startsAt) : null;
    const end = typeof choice.endsAt === "string" ? new Date(choice.endsAt) : null;
    if (!start || !end || Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || start <= new Date() || end <= start || end.getTime() - start.getTime() > 120 * 60000) {
      return NextResponse.json({ error: "미래의 유효한 활동 시간을 선택해 주세요." }, { status: 400 });
    }
    values.push({ proposed_start_at: start.toISOString(), proposed_end_at: end.toISOString() });
  }
  const { data, error } = await supabase.rpc("submit_schedule_proposals", { p_request_id: body.requestId, p_proposals: values });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true, proposalIds: data }, { status: 201 });
}
