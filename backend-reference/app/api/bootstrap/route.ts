import { NextResponse } from "next/server";
import { authenticatedSupabaseClient } from "@/lib/supabase/server";
import { DemoStore, HelpRequest } from "@/lib/demo-data";

export async function GET() {
  const { supabase, user } = await authenticatedSupabaseClient();
  if (!supabase || !user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const [profileResult, profilesResult, requestsResult, matchesResult, activitiesResult, proposalsResult, pointsResult, rewardsResult, redemptionsResult, reportsResult] = await Promise.all([
    supabase.from("profiles").select("id,nickname,role,neighborhood,preferred_categories,created_at").eq("id", user.id).single(),
    supabase.from("profiles").select("id,nickname,role,neighborhood,preferred_categories"),
    supabase.from("help_requests").select("*").order("created_at", { ascending: false }),
    supabase.from("matches").select("id,request_id,volunteer_id,status,matched_at,confirmed_start_at,confirmed_end_at"),
    supabase.from("activities").select("id,match_id,started_at,ended_at,duration_minutes,elder_confirmed_at,status,created_at"),
    supabase.from("schedule_proposals").select("id,request_id,volunteer_id,proposed_start_at,proposed_end_at,status,created_at").order("created_at", { ascending: false }),
    supabase.from("point_transactions").select("id,volunteer_id,activity_id,reward_id,amount,transaction_type,title,created_at").order("created_at", { ascending: false }),
    supabase.from("rewards").select("id,title,required_points,is_demo").eq("is_demo", true),
    supabase.from("reward_redemptions").select("id,volunteer_id,reward_id,points_spent,created_at").order("created_at", { ascending: false }),
    supabase.from("reports").select("id,reporter_id,request_id,reason,status,created_at").order("created_at", { ascending: false }),
  ]);
  const firstError = [profileResult, profilesResult, requestsResult, matchesResult, activitiesResult, proposalsResult, pointsResult, rewardsResult, redemptionsResult, reportsResult].find(result => result.error);
  if (firstError?.error) return NextResponse.json({ error: firstError.error.message }, { status: 403 });

  const profiles = profilesResult.data ?? [];
  const matches = matchesResult.data ?? [];
  const activities = activitiesResult.data ?? [];
  const requests: HelpRequest[] = (requestsResult.data ?? []).map((row) => {
    const match = matches.find((item) => item.request_id === row.id);
    const activity = match ? activities.find((item) => item.match_id === match.id) : undefined;
    return {
      id: row.id,
      activityId: activity?.id,
      seniorId: row.senior_id,
      title: row.title,
      description: row.description,
      category: row.category,
      neighborhood: row.neighborhood,
      requestedDate: row.requested_date,
      requestedTime: row.requested_time,
      estimatedMinutes: row.estimated_minutes,
      status: row.status,
      createdAt: row.created_at,
      matchedVolunteerId: match?.volunteer_id ?? null,
      createdById: row.created_by ?? row.senior_id,
      createdByRole: row.created_by_role ?? "senior",
      elderConsent: row.elder_consent ?? true,
      datePreference: row.date_preference ?? "specific",
      specificDate: row.specific_date ?? null,
      timeWindow: row.time_window ?? "flexible",
      confirmedStartAt: match?.confirmed_start_at ?? null,
      confirmedEndAt: match?.confirmed_end_at ?? null,
      startedAt: activity?.started_at ?? null,
      endedAt: activity?.ended_at ?? null,
      durationMinutes: activity?.duration_minutes ?? null,
      confirmedAt: activity?.elder_confirmed_at ?? null,
      simulated: false,
    };
  });
  const store: DemoStore = {
    currentUserId: user.id,
    users: profiles.map((profile) => ({ id: profile.id, nickname: profile.nickname, role: profile.role, neighborhood: profile.neighborhood, preferredCategories: profile.preferred_categories ?? [] })),
    requests,
    transactions: (pointsResult.data ?? []).map((transaction) => ({
      id: transaction.id, volunteerId: transaction.volunteer_id, activityId: transaction.activity_id ?? transaction.id,
      amount: transaction.amount, type: transaction.transaction_type, createdAt: transaction.created_at, title: transaction.title,
    })),
    redemptions: (redemptionsResult.data ?? []).map((redemption) => ({
      id: redemption.id, volunteerId: redemption.volunteer_id,
      title: rewardsResult.data?.find((reward) => reward.id === redemption.reward_id)?.title ?? "가상 혜택",
      pointsSpent: redemption.points_spent, createdAt: redemption.created_at,
    })),
    reports: (reportsResult.data ?? []).map((report) => ({ id: report.id, reporterId: report.reporter_id, requestId: report.request_id, reason: report.reason, status: report.status, createdAt: report.created_at })),
    scheduleProposals: (proposalsResult.data ?? []).map((proposal) => ({ id: proposal.id, requestId: proposal.request_id, volunteerId: proposal.volunteer_id, proposedStartAt: proposal.proposed_start_at, proposedEndAt: proposal.proposed_end_at, status: proposal.status, createdAt: proposal.created_at })),
  };
  return NextResponse.json({ store });
}
