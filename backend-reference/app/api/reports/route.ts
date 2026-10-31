import { NextResponse } from "next/server";
import { authenticatedSupabaseClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const { supabase, user } = await authenticatedSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Supabase session is required." }, { status: 401 });
  let body: { requestId?: unknown; reason?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (typeof body.requestId !== "string" || !UUID.test(body.requestId) || reason.length < 1 || reason.length > 300) {
    return NextResponse.json({ error: "Report fields are invalid." }, { status: 400 });
  }
  const { data, error } = await supabase.from("reports").insert({ reporter_id: user!.id, request_id: body.requestId, reason }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ report: data }, { status: 201 });
}
