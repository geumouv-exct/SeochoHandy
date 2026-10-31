import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const neighborhoods = ["방배동", "양재동", "반포동", "서초동", "내곡동", "잠원동"];

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = body.role === "volunteer" || body.role === "partner" ? body.role : body.role === "senior" ? "senior" : "";
  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
  const neighborhood = typeof body.neighborhood === "string" ? body.neighborhood : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !role || nickname.length < 1 || nickname.length > 30 || !neighborhoods.includes(neighborhood)) {
    return NextResponse.json({ error: "입력 내용을 확인해 주세요." }, { status: 400 });
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return NextResponse.json({ error: "NEXT_PUBLIC_SITE_URL is not configured." }, { status: 503 });
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${siteUrl.replace(/\/$/, "")}/auth/callback`, data: { role, nickname, neighborhood } },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
