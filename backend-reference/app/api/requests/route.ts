import { NextResponse } from "next/server";
import { authenticatedSupabaseClient } from "@/lib/supabase/server";

const categories = ["스마트폰 사용 도움", "키오스크 이용 연습", "복지관 프로그램 안내", "가벼운 물품 운반", "공공장소 이동·길 안내", "기타 생활 도움"];
const neighborhoods = ["방배동", "양재동", "반포동", "서초동", "내곡동", "잠원동"];
const datePreferences = ["earliest", "this_week", "next_week", "specific", "flexible"];
const timeWindows = ["morning", "afternoon", "evening", "flexible"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function todaySeoul() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function addDays(value: string, days: number) { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }

export async function POST(request: Request) {
  const { supabase, user } = await authenticatedSupabaseClient();
  if (!supabase || !user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 }); }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const category = typeof body.category === "string" ? body.category : "";
  const neighborhood = typeof body.neighborhood === "string" ? body.neighborhood : "";
  const requestedDate = typeof body.requestedDate === "string" ? body.requestedDate : "";
  const requestedTime = typeof body.requestedTime === "string" ? body.requestedTime : "";
  const estimatedMinutes = Number(body.estimatedMinutes);
  const datePreference = typeof body.datePreference === "string" ? body.datePreference : "specific";
  const specificDate = typeof body.specificDate === "string" ? body.specificDate : datePreference === "specific" ? requestedDate : null;
  const timeWindow = typeof body.timeWindow === "string" ? body.timeWindow : requestedTime.startsWith("오전") ? "morning" : requestedTime.startsWith("오후") ? "afternoon" : "flexible";
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && !Number.isNaN(Date.parse(`${requestedDate}T00:00:00Z`)) && new Date(`${requestedDate}T00:00:00Z`).toISOString().slice(0,10) === requestedDate;
  const today = todaySeoul();
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const thisWeekEnd = addDays(today, weekday === 0 ? 0 : 7 - weekday);
  const nextWeekStart = addDays(today, weekday === 0 ? 1 : 8 - weekday);
  const outsidePreference = datePreference === "this_week" && requestedDate > thisWeekEnd || datePreference === "next_week" && (requestedDate < nextWeekStart || requestedDate > addDays(nextWeekStart, 6));
  if (title.length < 5 || title.length > 80 || description.length < 5 || description.length > 240 || !categories.includes(category) || !neighborhoods.includes(neighborhood) || !validDate || requestedDate < today || outsidePreference || !requestedTime || ![30, 45, 60].includes(estimatedMinutes) || !datePreferences.includes(datePreference) || !timeWindows.includes(timeWindow) || (datePreference === "specific" && (typeof specificDate !== "string" || specificDate !== requestedDate || specificDate < today))) {
    return NextResponse.json({ error: "도움 내용, 날짜, 시간대, 활동 동네를 확인해 주세요." }, { status: 400 });
  }
  const { data: profile, error: profileError } = await supabase.from("profiles").select("id,role").eq("id", user.id).single();
  if (profileError || !profile || !["senior", "partner"].includes(profile.role)) return NextResponse.json({ error: "어르신 또는 기관 담당자 계정만 요청을 등록할 수 있어요." }, { status: 403 });
  const delegated = profile.role === "partner";
  const seniorId = delegated ? (typeof body.seniorId === "string" ? body.seniorId : "") : user.id;
  if (delegated && (body.elderConsent !== true || !UUID.test(seniorId))) return NextResponse.json({ error: "어르신 동의와 대상 계정을 확인해 주세요." }, { status: 400 });
  if (delegated) {
    const { data: senior, error } = await supabase.from("profiles").select("id,role").eq("id", seniorId).single();
    if (error || senior?.role !== "senior") return NextResponse.json({ error: "대상 어르신 계정을 확인할 수 없습니다." }, { status: 400 });
  }
  const { data, error } = await supabase.from("help_requests").insert({
    senior_id: seniorId, created_by: user.id, created_by_role: profile.role, elder_consent: delegated ? true : false,
    title, description, category, neighborhood, requested_date: requestedDate, requested_time: requestedTime,
    date_preference: datePreference, specific_date: specificDate, time_window: timeWindow, estimated_minutes: estimatedMinutes,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ request: data }, { status: 201 });
}
