import { NextResponse } from "next/server";
import { authenticatedSupabaseClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RPC_BY_ACTION = {
  start: "start_activity",
  finish: "finish_activity",
  confirm: "confirm_activity",
  cancel: "cancel_help_request",
} as const;

export async function POST(request: Request) {
  const { supabase } = await authenticatedSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Supabase session is required." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const action = body.action;
  const id = body.id;
  if (typeof action !== "string" || !Object.prototype.hasOwnProperty.call(RPC_BY_ACTION, action) || typeof id !== "string" || !UUID.test(id)) {
    return NextResponse.json({ error: "Unknown action or invalid ID." }, { status: 400 });
  }
  const rpcName = RPC_BY_ACTION[action as keyof typeof RPC_BY_ACTION];
  const argument = action === "cancel" ? { p_request_id: id } : { p_activity_id: id };
  const { data, error } = await supabase.rpc(rpcName, argument);
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true, result: data });
}
