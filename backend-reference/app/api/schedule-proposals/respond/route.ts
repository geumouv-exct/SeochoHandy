import { NextResponse } from "next/server";
import { authenticatedSupabaseClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const { supabase, user } = await authenticatedSupabaseClient();
  if (!supabase || !user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 }); }
  if (typeof body.proposalId !== "string" || !UUID.test(body.proposalId) || typeof body.accept !== "boolean") return NextResponse.json({ error: "일정 선택을 확인해 주세요." }, { status: 400 });
  const { data, error } = await supabase.rpc("respond_schedule_proposal", { p_proposal_id: body.proposalId, p_accept: body.accept });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true, result: data });
}
