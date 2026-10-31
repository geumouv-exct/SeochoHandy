import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return NextResponse.json({ error: "NEXT_PUBLIC_SITE_URL is not configured." }, { status: 503 });
  let redirectBase: string;
  try {
    const configuredUrl = new URL(siteUrl);
    if (!['http:', 'https:'].includes(configuredUrl.protocol)) throw new Error("Unsupported redirect protocol.");
    redirectBase = configuredUrl.origin;
  } catch {
    return NextResponse.json({ error: "NEXT_PUBLIC_SITE_URL is invalid." }, { status: 503 });
  }
  const code = searchParams.get("code");
  const supabase = await createSupabaseServerClient();
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${redirectBase}/`);
  }
  return NextResponse.redirect(`${redirectBase}/?authError=link`);
}
