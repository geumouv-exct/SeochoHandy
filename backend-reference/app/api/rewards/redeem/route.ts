import { NextResponse } from "next/server";
import { authenticatedSupabaseClient } from "@/lib/supabase/server";

const REWARD_IDS: Record<string, string> = {
  cafe: "00000000-0000-4000-8000-000000000001",
  meal: "00000000-0000-4000-8000-000000000002",
  culture: "00000000-0000-4000-8000-000000000003",
};

export async function POST(request: Request) {
  const { supabase } = await authenticatedSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Supabase session is required." }, { status: 401 });
  let body: { rewardId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const rewardId = typeof body.rewardId === "string" ? REWARD_IDS[body.rewardId] : undefined;
  if (!rewardId) return NextResponse.json({ error: "Invalid reward ID." }, { status: 400 });
  const { data, error } = await supabase.rpc("redeem_reward", { p_reward_id: rewardId });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true, redemptionId: data });
}
