"use client";

import {
  ArrowDownLeft, ArrowLeft, ArrowRight, BadgeCheck, Bell, BookOpen, CalendarDays,
  Check, CheckCircle2, ChevronDown, CircleHelp, Clock3, Coffee, Download, FileText,
  HandHeart, HeartHandshake, Home, MapPin, Menu, MessageCircle, Mic, MonitorSmartphone,
  Plus, RotateCcw, Search, ShieldCheck, Smartphone, Sparkles, Store, Users, Wallet,
  X,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { PartnerDashboard, PartnerRequestForm, ProposalForm, RequestReview, ScheduleProposalsPanel, SeniorManualWizard, SeniorVoiceRequest } from "@/components/request-flow";
import {
  CATEGORIES, createSeedStore, DemoStore, DemoUser, HelpRequest, HelpRequestDraft, NEIGHBORHOODS, newId,
  PointTransaction, Redemption, RequestStatus, ScheduleProposal, STORAGE_KEY, statusLabel, userFor,
} from "@/lib/demo-data";

const REWARDS = [
  { id: "cafe", title: "가상 제휴 카페 1,000원 할인", points: 500, icon: Coffee, description: "동네 카페에서 따뜻한 음료 한 잔을 떠올려 보세요." },
  { id: "meal", title: "가상 제휴 식당 2,000원 할인", points: 1000, icon: Store, description: "함께하는 식사처럼 기분 좋은 상상 리워드예요." },
  { id: "culture", title: "가상 문화 프로그램 할인", points: 1200, icon: BookOpen, description: "공연·전시를 즐기는 가상의 체험 혜택이에요." },
];

const categoryExamples: Record<string, string> = {
  "스마트폰 사용 도움": "예: 손주에게 사진을 보내는 방법을 함께 연습하고 싶어요.",
  "키오스크 이용 연습": "예: 공공장소에서 키오스크로 주문하는 순서를 연습하고 싶어요.",
  "복지관 프로그램 안내": "예: 가까운 복지관의 프로그램을 검색하는 방법을 알고 싶어요.",
  "가벼운 물품 운반": "예: 복지관에서 안내 책자를 함께 옮겨 주실 분이 필요해요.",
  "공공장소 이동·길 안내": "예: 복지관 안에서 프로그램실 위치를 함께 찾아가고 싶어요.",
  "기타 생활 도움": "예: 가까운 공공시설에서 필요한 정보를 함께 찾아보고 싶어요.",
};

const volunteerLinks = [
  ["/volunteer", "홈", Home],
  ["/volunteer/calendar", "일정", CalendarDays],
  ["/volunteer/requests", "도움 요청 찾기", Search],
  ["/volunteer/history", "활동 기록", FileText],
  ["/volunteer/rewards", "리워드", Wallet],
] as const;

const seniorLinks = [["/senior", "홈", Home], ["/senior/request/manual", "도움 요청", HandHeart], ["/senior/schedule", "일정", CalendarDays]] as const;
const partnerLinks = [["/partner", "기관 대시보드", Home], ["/partner/requests/new", "대리 요청 등록", Plus]] as const;
const REQUEST_DRAFT_KEY = "seocho-sonjabi-request-draft-v1";
const EMPTY_REQUEST_DRAFT: HelpRequestDraft = { datePreference: "flexible", timeWindow: "flexible" };

function navigateStatic(path: string, replace = false) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const route = `${basePath}${path.startsWith("/") ? path : `/${path}`}`;
  window.history[replace ? "replaceState" : "pushState"](null, "", route || "/");
}

function dateLabel(value: string, options?: Intl.DateTimeFormatOptions) {
  if (!value) return "날짜 미정";
  const date = new Date(value.length === 10 ? `${value}T12:00:00+09:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", { ...(options ?? { month: "long", day: "numeric", weekday: "short" }), timeZone: "Asia/Seoul" }).format(date);
}

const agreedScheduleStatuses: RequestStatus[] = ["matched", "in_progress", "awaiting_confirmation", "completed"];

function scheduleStartFor(request: HelpRequest) {
  if (!request.matchedVolunteerId || !agreedScheduleStatuses.includes(request.status)) return null;
  if (request.confirmedStartAt) {
    const confirmed = new Date(request.confirmedStartAt);
    return Number.isNaN(confirmed.getTime()) ? null : confirmed;
  }
  const match = request.requestedTime.match(/(오전|오후)\s*(\d{1,2}):(\d{2})/);
  if (!match) {
    const fallback = new Date(`${request.requestedDate}T12:00:00+09:00`);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  let hour = Number(match[2]);
  if (match[1] === "오후" && hour < 12) hour += 12;
  if (match[1] === "오전" && hour === 12) hour = 0;
  const start = new Date(`${request.requestedDate}T${String(hour).padStart(2, "0")}:${match[3]}:00+09:00`);
  return Number.isNaN(start.getTime()) ? null : start;
}

function agreedSchedules(requests: HelpRequest[]) {
  return requests.flatMap(request => {
    const startAt = scheduleStartFor(request);
    if (!startAt) return [];
    const endAt = request.confirmedEndAt ? new Date(request.confirmedEndAt) : new Date(startAt.getTime() + (request.durationMinutes ?? request.estimatedMinutes) * 60_000);
    return [{ request, startAt, endAt }];
  }).sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

function scheduleDayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function todaySeoulIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function dateForPreference(preference: HelpRequestDraft["datePreference"], specificDate?: string | null) {
  if (preference === "specific" && specificDate) return specificDate;
  const today = new Date(`${todaySeoulIso()}T00:00:00+09:00`);
  const day = today.getDay();
  if (preference === "this_week") today.setDate(today.getDate() + (day === 0 ? 0 : Math.max(1, 7 - day)));
  else if (preference === "next_week") today.setDate(today.getDate() + (day === 0 ? 1 : 8 - day));
  else today.setDate(today.getDate() + 1);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(today);
}

function timeWindowLabel(window?: HelpRequestDraft["timeWindow"]) {
  return ({ morning: "오전", afternoon: "오후", evening: "저녁", flexible: "시간 상관없음" } as const)[window ?? "flexible"];
}

function timeLabel(value?: string | Date | null) {
  if (!value) return "기록 없음";
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "numeric", minute: "2-digit" }).format(value instanceof Date ? value : new Date(value));
}

function cx(...values: (string | false | null | undefined)[]) {
  return values.filter(Boolean).join(" ");
}

function IconCircle({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "orange" | "blue" | "cream" }) {
  return <span className={`icon-circle tone-${tone}`}>{children}</span>;
}

function StatusPill({ status }: { status: RequestStatus }) {
  return <span className={`status-pill status-${status}`}><i />{statusLabel(status)}</span>;
}

function Metric({ label, value, unit, icon }: { label: string; value: string | number; unit?: string; icon: ReactNode }) {
  return <div className="metric-card"><div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div><strong>{value}<small>{unit}</small></strong></div>;
}

function DemoLabel() {
  return <span className="demo-label"><span /> DEMO MODE</span>;
}

function ConnectedLogin() {
  const [role, setRole] = useState<"senior" | "volunteer" | "partner">("senior");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function requestLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"), role, nickname: form.get("nickname"), neighborhood: form.get("neighborhood"),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "로그인 링크를 보내지 못했어요.");
      setMessage("인증 링크를 이메일로 보냈어요. 메일의 링크를 눌러 로그인을 마쳐 주세요.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "로그인 링크를 보내지 못했어요.");
    } finally {
      setSending(false);
    }
  }

  return <div className="start-page"><div className="start-top"><a className="brand" href="/"><span className="brand-mark"><HandHeart size={22}/></span><span className="brand-name">서초손잡이<small>SEOCHO HAND-IN-HAND</small></span></a><span className="demo-label"><span/> SUPABASE 연결</span></div><main className="connected-login"><span className="eyebrow">이메일로 안전하게 시작해요</span><h1>어떤 마음으로 오셨나요?</h1><p>이메일 인증 링크로 로그인합니다. 인증 후 도움 요청과 활동 기록이 Supabase에 저장돼요.</p><div className="login-role-choice" role="group" aria-label="이용 역할 선택"><button type="button" className={cx("button", role === "senior" ? "button-primary" : "button-outline")} onClick={() => setRole("senior")}><HandHeart size={18}/>도움이 필요해요</button><button type="button" className={cx("button", role === "volunteer" ? "button-primary" : "button-outline")} onClick={() => setRole("volunteer")}><HeartHandshake size={18}/>도움을 나누고 싶어요</button><button type="button" className={cx("button", role === "partner" ? "button-primary" : "button-outline")} onClick={() => setRole("partner")}><Users size={18}/>기관 담당자</button></div><form className="connected-login-form" onSubmit={requestLink}><label><span className="field-label">이메일</span><input className="form-input" name="email" type="email" autoComplete="email" placeholder="you@example.com" required/></label><label><span className="field-label">표시 이름</span><input className="form-input" name="nickname" minLength={1} maxLength={30} autoComplete="nickname" placeholder="이름 또는 별칭" required/></label><label><span className="field-label">활동 동네</span><select className="form-input" name="neighborhood" defaultValue="방배동">{NEIGHBORHOODS.map(place => <option key={place}>{place}</option>)}</select></label><button className="button button-primary button-large full-width" type="submit" disabled={sending}>{sending ? "보내는 중…" : "인증 링크 받기"}<ArrowRight size={18}/></button>{message && <p className="connected-login-message" role="status">{message}</p>}</form><div className="start-note"><ShieldCheck size={17}/>개인 연락처와 정확한 집 주소는 요청에 공개하지 마세요.</div></main></div>;
}

function formatPoints(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function pointsFor(store: DemoStore, volunteerId: string) {
  return store.transactions.reduce((sum, tx) => tx.volunteerId === volunteerId ? sum + (tx.type === "earn" ? tx.amount : -tx.amount) : sum, 0);
}

function requestsForSenior(store: DemoStore, seniorId: string) {
  return store.requests
    .filter(request => request.seniorId === seniorId && request.status !== "cancelled")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function completedFor(store: DemoStore, volunteerId: string) {
  return store.requests.filter((request) => request.status === "completed" && request.matchedVolunteerId === volunteerId);
}

function totalMinutes(requests: HelpRequest[]) {
  return requests.reduce((sum, request) => sum + (request.durationMinutes ?? 0), 0);
}

function recommendScore(request: HelpRequest, neighborhood: string, preferences: string[]) {
  return (request.neighborhood === neighborhood ? 40 : 0) + (preferences.includes(request.category) ? 35 : 0) + 25;
}

function RequestCard({
  request, store, isVolunteer, currentUserId, onOpen, onMatch,
}: {
  request: HelpRequest; store: DemoStore; isVolunteer: boolean; currentUserId: string;
  onOpen: (id: string) => void; onMatch: (id: string) => void;
}) {
  const senior = userFor(store, request.seniorId);
  const volunteer = userFor(store, request.matchedVolunteerId);
  const current = userFor(store, currentUserId);
  const score = current?.role === "volunteer" ? recommendScore(request, current.neighborhood, current.preferredCategories) : 0;
  return (
    <article className="request-card">
      <div className="request-card-top"><span className="category-tag"><Smartphone size={15} />{request.category}</span><StatusPill status={request.status} /></div>
      <button className="request-title-button" onClick={() => onOpen(request.id)}><h3>{request.title}</h3></button>
      <p className="request-description">{request.description}</p>
      <div className="request-facts">
        <span><MapPin size={16} />{request.neighborhood} · 공공장소</span>
        <span><Clock3 size={16} />약 {request.estimatedMinutes}분</span>
        <span><CalendarDays size={16} />{dateLabel(request.requestedDate)} · {request.requestedTime}</span>
      </div>
      {(volunteer || senior) && <div className="request-person">{volunteer ? `함께할 청년 · ${volunteer.nickname}` : `요청자 · ${senior?.nickname ?? "이웃 어르신"}`}{request.status === "open" && score > 0 && <span className="match-score"><Sparkles size={13} /> 추천 {score}점</span>}</div>}
      <div className="request-card-actions">
        <button className="button button-quiet" onClick={() => onOpen(request.id)}>자세히 보기 <ArrowRight size={17} /></button>
        {isVolunteer && ["open", "awaiting_schedule"].includes(request.status) && <button className="button button-primary" onClick={() => onMatch(request.id)}>{request.status === "awaiting_schedule" ? "가능한 일정 제안하기" : "도움 신청하기"}</button>}
        {request.matchedVolunteerId === currentUserId && request.status !== "completed" && request.status !== "cancelled" && <button className="button button-soft" onClick={() => onOpen(request.id)}>활동 열기</button>}
      </div>
    </article>
  );
}

export function SeochoApp({ connectedMode = false, voiceConfigured = false, agentLabel = "" }: { connectedMode?: boolean; voiceConfigured?: boolean; agentLabel?: string }) {
  const pathname = usePathname();
  const [store, setStore] = useState<DemoStore>(() => createSeedStore());
  const [requestDraft, setRequestDraft] = useState<HelpRequestDraft>(EMPTY_REQUEST_DRAFT);
  const requestDraftRef = useRef<HelpRequestDraft>(EMPTY_REQUEST_DRAFT);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState("");
  const [fontLarge, setFontLarge] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [connectedState, setConnectedState] = useState<"loading" | "ready" | "logged-out" | "error">(connectedMode ? "loading" : "ready");
  const currentUser = userFor(store, store.currentUserId);
  const availablePoints = currentUser?.role === "volunteer" ? pointsFor(store, currentUser.id) : 0;

  useEffect(() => {
    try { setFontLarge(localStorage.getItem("seocho-sonjabi-large-text") === "true"); } catch {}
    try {
      const savedDraft = sessionStorage.getItem(REQUEST_DRAFT_KEY);
      if (savedDraft) {
        const parsedDraft = JSON.parse(savedDraft) as HelpRequestDraft;
        requestDraftRef.current = parsedDraft;
        setRequestDraft(parsedDraft);
      }
    } catch {}
    if (connectedMode) {
      let active = true;
      fetch("/api/bootstrap", { cache: "no-store" }).then(async (response) => {
        if (!active) return;
        if (response.status === 401) {
          setConnectedState("logged-out");
          setReady(true);
          return;
        }
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "데이터를 불러오지 못했어요.");
        if (!active) return;
        setStore(body.store as DemoStore);
        setConnectedState("ready");
        setReady(true);
      }).catch(() => {
        if (!active) return;
        setConnectedState("error");
        setReady(true);
      });
      return () => { active = false; };
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DemoStore;
        if (Array.isArray(parsed.users) && Array.isArray(parsed.requests)) setStore({ ...createSeedStore(), ...parsed, scheduleProposals: Array.isArray(parsed.scheduleProposals) ? parsed.scheduleProposals : [] });
      }
      setFontLarge(localStorage.getItem("seocho-sonjabi-large-text") === "true");
    } catch {
      setToast("저장된 데모 데이터를 읽지 못해 샘플 데이터를 표시합니다.");
    }
    setReady(true);
  }, [connectedMode]);

  useEffect(() => {
    if (!ready) return;
    try { sessionStorage.setItem(REQUEST_DRAFT_KEY, JSON.stringify(requestDraft)); } catch {}
  }, [ready, requestDraft]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!ready) return;
    if (connectedMode && connectedState !== "ready") return;
    if (!currentUser && !["/", "/start"].includes(pathname)) navigateStatic("/start", true);
    if (currentUser && pathname === "/") navigateStatic(currentUser.role === "senior" ? "/senior" : currentUser.role === "volunteer" ? "/volunteer" : currentUser.role === "partner" ? "/partner" : "/admin", true);
  }, [ready, currentUser, pathname, connectedMode, connectedState]);

  async function refreshConnected() {
    const response = await fetch("/api/bootstrap", { cache: "no-store" });
    if (response.status === 401) {
      setConnectedState("logged-out");
      setStore((previous) => ({ ...previous, currentUserId: null }));
      return false;
    }
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "데이터를 새로 불러오지 못했어요.");
    setStore(body.store as DemoStore);
    setConnectedState("ready");
    return true;
  }

  async function connectedOperation(action: string, id: string) {
    const response = await fetch("/api/activities/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, id }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "요청을 처리하지 못했어요.");
    return body;
  }

  function persist(next: DemoStore, message?: string) {
    setStore(next);
    if (connectedMode) {
      if (message) setToast(message);
      return;
    }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch { setToast("저장 공간이 부족해 변경 사항을 저장하지 못했어요."); return; }
    if (message) setToast(message);
  }

  function updateRequestDraft(patch: HelpRequestDraft) {
    const next = { ...requestDraftRef.current, ...patch };
    requestDraftRef.current = next;
    setRequestDraft(next);
    try { sessionStorage.setItem(REQUEST_DRAFT_KEY, JSON.stringify(next)); } catch {}
  }

  async function switchAccount(id: string) {
    if (connectedMode) {
      await fetch("/api/auth/logout", { method: "POST" });
      setStore({ ...createSeedStore(), currentUserId: null });
      setConnectedState("logged-out");
      navigateStatic("/", true);
      return;
    }
    const user = userFor(store, id);
    if (!user) return;
    const next = { ...store, currentUserId: id };
    persist(next, `${user.nickname} 계정으로 체험을 전환했어요.`);
    navigateStatic(user.role === "senior" ? "/senior" : user.role === "volunteer" ? "/volunteer" : user.role === "partner" ? "/partner" : "/admin");
    setMobileMenu(false);
    setAccountOpen(false);
  }

  function resetDemo() {
    if (connectedMode) return;
    const fresh = createSeedStore();
    fresh.currentUserId = store.currentUserId;
    requestDraftRef.current = EMPTY_REQUEST_DRAFT;
    setRequestDraft(EMPTY_REQUEST_DRAFT);
    try { sessionStorage.removeItem(REQUEST_DRAFT_KEY); } catch {}
    persist(fresh, "샘플 데이터를 처음 상태로 되돌렸어요.");
  }

  async function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (currentUser?.role !== "senior") { setToast("어르신 체험 계정으로 전환해 주세요."); return; }
    const form = new FormData(event.currentTarget);
    const category = String(form.get("category") ?? "");
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const date = String(form.get("date") ?? "");
    const time = String(form.get("time") ?? "");
    const minutes = Number(form.get("minutes"));
    const neighborhood = String(form.get("neighborhood") ?? "");
    if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number]) || title.length < 5 || title.length > 80 || description.length < 5 || description.length > 240 || !date || !time || ![30, 45, 60].includes(minutes) || !NEIGHBORHOODS.includes(neighborhood as (typeof NEIGHBORHOODS)[number])) {
      setToast("입력한 내용을 확인해 주세요. 요청 제목과 설명은 5자 이상 적어 주세요."); return;
    }
    if (connectedMode) {
      const response = await fetch("/api/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, description, category, neighborhood, requestedDate: date, requestedTime: time, estimatedMinutes: minutes }) });
      const body = await response.json();
      if (!response.ok) { setToast(body.error || "요청을 등록하지 못했어요."); return; }
      await refreshConnected();
      setToast("도움 요청을 등록했어요. 청년이 신청하면 알려드릴게요.");
      navigateStatic("/senior");
      return;
    }
    const request: HelpRequest = {
      id: newId("activity"), seniorId: currentUser.id, title, description, category, neighborhood,
      requestedDate: date, requestedTime: time, estimatedMinutes: minutes, status: "open", createdAt: new Date().toISOString(),
      matchedVolunteerId: null, startedAt: null, endedAt: null, durationMinutes: null, confirmedAt: null, simulated: false,
      createdById: currentUser.id, createdByRole: "senior", elderConsent: true, datePreference: "specific", specificDate: date,
      timeWindow: time.startsWith("오전") ? "morning" : time.startsWith("오후") ? "afternoon" : "flexible",
    };
    persist({ ...store, requests: [request, ...store.requests] }, "도움 요청을 등록했어요. 청년이 신청하면 알려드릴게요.");
    navigateStatic("/senior");
  }

  async function createRequestFromDraft(draft: HelpRequestDraft, delegation?: { seniorId: string; consent: boolean }) {
    const actingPartner = currentUser?.role === "partner";
    if ((!actingPartner && currentUser?.role !== "senior") || (actingPartner && (!delegation?.seniorId || !delegation.consent))) {
      setToast("요청자 역할과 어르신 동의를 확인해 주세요."); return;
    }
    const category = draft.category ?? "";
    const detail = draft.detail?.trim() ?? "";
    const preference = draft.datePreference;
    const timeWindow = draft.timeWindow;
    const neighborhood = draft.neighborhood ?? "";
    const specificDate = draft.specificDate ?? null;
    const requestedDate = dateForPreference(preference, specificDate);
    const date = new Date(`${requestedDate}T00:00:00+09:00`);
    const today = new Date(`${todaySeoulIso()}T00:00:00+09:00`);
    if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number]) || detail.length < 5 || detail.length > 240 || !["earliest", "this_week", "next_week", "specific", "flexible"].includes(preference ?? "") || !["morning", "afternoon", "evening", "flexible"].includes(timeWindow ?? "") || !NEIGHBORHOODS.includes(neighborhood as (typeof NEIGHBORHOODS)[number]) || date < today || (preference === "specific" && (!specificDate || specificDate < todaySeoulIso()))) {
      setToast("도움 내용, 날짜, 시간대, 활동 동네를 확인해 주세요."); return;
    }
    if (actingPartner && connectedMode && !delegation?.consent) { setToast("어르신 동의가 확인되지 않았어요."); return; }
    if (submittingRequest) return;
    setSubmittingRequest(true);
    const requestedTime = timeWindowLabel(timeWindow);
    const estimatedMinutes = category === "키오스크 이용 연습" ? 45 : category === "가벼운 물품 운반" ? 60 : 30;
    const title = detail.length > 80 ? `${detail.slice(0, 77)}…` : detail;
    const seniorId = actingPartner ? delegation!.seniorId : currentUser!.id;
    if (connectedMode) {
      try {
        const response = await fetch("/api/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, description: detail, category, neighborhood, requestedDate, requestedTime, estimatedMinutes, datePreference: preference, specificDate, timeWindow, seniorId: actingPartner ? seniorId : undefined, elderConsent: actingPartner ? delegation!.consent : undefined }) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "요청을 등록하지 못했어요.");
        await refreshConnected();
      } catch (error) { setToast(error instanceof Error ? error.message : "요청을 등록하지 못했어요."); return; }
      finally { setSubmittingRequest(false); }
    } else {
      const now = new Date().toISOString();
      const request: HelpRequest = {
        id: newId("activity"), seniorId, title, description: detail, category, neighborhood, requestedDate, requestedTime,
        estimatedMinutes, status: "open", createdAt: now, matchedVolunteerId: null, startedAt: null, endedAt: null,
        durationMinutes: null, confirmedAt: null, simulated: false, createdById: currentUser!.id,
        createdByRole: actingPartner ? "partner" : "senior", elderConsent: actingPartner ? delegation!.consent : true,
        datePreference: preference, specificDate, timeWindow,
      };
      persist({ ...store, requests: [request, ...store.requests] }, "도움 요청을 등록했어요. 가까운 청년에게 전달했어요.");
      setSubmittingRequest(false);
    }
    setRequestDraft({ datePreference: "flexible", timeWindow: "flexible" });
    requestDraftRef.current = EMPTY_REQUEST_DRAFT;
    try { sessionStorage.removeItem(REQUEST_DRAFT_KEY); } catch {}
    navigateStatic(actingPartner ? "/partner" : "/senior");
  }

  function beginProposal(id: string) {
    const target = store.requests.find((request) => request.id === id);
    if (currentUser?.role !== "volunteer" || !target || !["open", "awaiting_schedule"].includes(target.status)) { setToast("일정 제안을 보낼 수 없는 요청이에요."); return; }
    navigateStatic(`/volunteer/requests/${encodeURIComponent(id)}/propose`);
  }

  async function submitProposal(id: string, choices: { startsAt: string; endsAt: string }[]) {
    const target = store.requests.find((request) => request.id === id);
    if (currentUser?.role !== "volunteer" || !target || !["open", "awaiting_schedule"].includes(target.status) || !choices.length || choices.length > 2) { setToast("일정 제안을 보낼 수 없어요."); return; }
    if (choices.some((choice) => new Date(choice.startsAt) <= new Date() || new Date(choice.endsAt) <= new Date(choice.startsAt))) { setToast("미래의 날짜와 시간을 선택해 주세요."); return; }
    const conflict = choices.some((choice, index) => choices.some((other, otherIndex) => otherIndex > index && new Date(choice.startsAt) < new Date(other.endsAt) && new Date(choice.endsAt) > new Date(other.startsAt)) || store.requests.some((request) => request.id !== id && request.matchedVolunteerId === currentUser.id && request.status !== "cancelled" && request.status !== "completed" && request.confirmedStartAt && request.confirmedEndAt && new Date(request.confirmedStartAt) < new Date(choice.endsAt) && new Date(request.confirmedEndAt) > new Date(choice.startsAt)));
    if (conflict) { setToast("이미 확정된 일정과 겹쳐요. 다른 시간을 골라 주세요."); return; }
    if (connectedMode) {
      try {
        const response = await fetch("/api/schedule-proposals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: id, proposals: choices }) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "일정 제안을 저장하지 못했어요.");
        await refreshConnected();
        setToast("일정 제안을 보냈어요. 어르신의 확인을 기다립니다.");
      } catch (error) { setToast(error instanceof Error ? error.message : "일정 제안을 저장하지 못했어요."); return; }
      navigateStatic("/volunteer");
      return;
    }
    const newProposals: ScheduleProposal[] = choices.map((choice) => ({ id: newId("proposal"), requestId: id, volunteerId: currentUser.id, proposedStartAt: choice.startsAt, proposedEndAt: choice.endsAt, status: "pending", createdAt: new Date().toISOString() }));
    const proposals = [...newProposals, ...(store.scheduleProposals ?? [])];
    persist({ ...store, scheduleProposals: proposals, requests: store.requests.map((request) => request.id === id ? { ...request, status: "awaiting_schedule" } : request) }, "일정 제안을 보냈어요. 어르신의 확인을 기다립니다.");
    navigateStatic("/volunteer");
  }

  async function respondToProposal(proposalId: string, accept: boolean) {
    const proposal = store.scheduleProposals.find((item) => item.id === proposalId);
    const target = proposal && store.requests.find((request) => request.id === proposal.requestId);
    const canRespond = currentUser?.role === "senior" && target?.seniorId === currentUser.id || currentUser?.role === "partner" && target?.createdById === currentUser.id && target.elderConsent;
    if (!proposal || !target || proposal.status !== "pending" || !canRespond || target.status !== "awaiting_schedule") { setToast("이 일정 제안을 처리할 권한이 없거나 이미 처리됐어요."); return; }
    if (accept && new Date(proposal.proposedStartAt) <= new Date()) { setToast("이미 지난 제안 시간은 선택할 수 없어요."); return; }
    if (accept && store.requests.some((request) => request.id !== target.id && request.matchedVolunteerId === proposal.volunteerId && request.status !== "cancelled" && request.status !== "completed" && request.confirmedStartAt && request.confirmedEndAt && new Date(request.confirmedStartAt) < new Date(proposal.proposedEndAt) && new Date(request.confirmedEndAt) > new Date(proposal.proposedStartAt))) { setToast("청년의 다른 확정 일정과 겹쳐 이 시간을 선택할 수 없어요."); return; }
    if (connectedMode) {
      try {
        const response = await fetch("/api/schedule-proposals/respond", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proposalId, accept }) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "일정 확인을 처리하지 못했어요.");
        await refreshConnected();
        setToast(accept ? "일정이 확정됐어요. 활동을 시작할 준비가 됐어요." : "다른 일정 제안을 기다립니다.");
      } catch (error) { setToast(error instanceof Error ? error.message : "일정 확인을 처리하지 못했어요."); }
      return;
    }
    const remaining = accept ? [] : store.scheduleProposals.filter((item) => item.requestId === target.id && item.id !== proposalId && item.status === "pending");
    const nextStatus: RequestStatus = accept ? "matched" : remaining.length ? "awaiting_schedule" : "open";
    const updatedRequest: HelpRequest = accept ? { ...target, status: "matched", matchedVolunteerId: proposal.volunteerId, confirmedStartAt: proposal.proposedStartAt, confirmedEndAt: proposal.proposedEndAt, requestedDate: proposal.proposedStartAt.slice(0, 10), requestedTime: dateLabel(proposal.proposedStartAt, { hour: "numeric", minute: "2-digit" }), activityId: newId("activity") } : { ...target, status: nextStatus };
    const updatedProposals = store.scheduleProposals.map((item) => item.requestId !== target.id ? item : item.id === proposalId ? { ...item, status: accept ? "accepted" as const : "rejected" as const } : accept && item.status === "pending" ? { ...item, status: "rejected" as const } : item);
    persist({ ...store, scheduleProposals: updatedProposals, requests: store.requests.map((item) => item.id === target.id ? updatedRequest : item) }, accept ? "일정이 확정됐어요. 활동을 시작할 준비가 됐어요." : "다른 일정 제안을 기다립니다.");
  }

  async function startActivity(id: string) {
    const target = store.requests.find((request) => request.id === id);
    if (currentUser?.role !== "volunteer" || !target || target.matchedVolunteerId !== currentUser.id || target.status !== "matched") { setToast("이 활동을 시작할 권한이 없거나 이미 시작된 활동이에요."); return; }
    if (connectedMode) {
      if (!target.activityId) { setToast("활동 기록을 찾지 못했어요. 새로고침해 주세요."); return; }
      try { await connectedOperation("start", target.activityId); await refreshConnected(); setToast("활동을 시작했어요."); }
      catch (error) { setToast(error instanceof Error ? error.message : "활동을 시작하지 못했어요."); }
      return;
    }
    const updated = { ...target, status: "in_progress" as const, startedAt: new Date().toISOString() };
    persist({ ...store, requests: store.requests.map((request) => request.id === id ? updated : request) }, "활동을 시작했어요.");
  }

  async function finishActivity(id: string, simulated: boolean) {
    const target = store.requests.find((request) => request.id === id);
    if (currentUser?.role !== "volunteer" || !target || target.matchedVolunteerId !== currentUser.id || target.status !== "in_progress" || !target.startedAt) { setToast("진행 중인 활동만 종료할 수 있어요."); return; }
    if (connectedMode) {
      if (!target.activityId) { setToast("활동 기록을 찾지 못했어요. 새로고침해 주세요."); return; }
      try { await connectedOperation("finish", target.activityId); await refreshConnected(); setToast("활동 종료를 기록했어요. 어르신의 확인을 기다립니다."); }
      catch (error) { setToast(error instanceof Error ? error.message : "활동을 종료하지 못했어요."); }
      return;
    }
    const elapsed = Math.max(1, Math.round((Date.now() - new Date(target.startedAt).getTime()) / 60000));
    const durationMinutes = simulated ? 30 : elapsed;
    const updated = { ...target, status: "awaiting_confirmation" as const, endedAt: new Date().toISOString(), durationMinutes, simulated };
    persist({ ...store, requests: store.requests.map((request) => request.id === id ? updated : request) }, simulated ? "30분 활동 체험이 끝났어요. 어르신 계정에서 완료를 확인해 주세요." : "활동 종료를 기록했어요. 어르신의 확인을 기다립니다.");
  }

  async function confirmActivity(id: string) {
    const target = store.requests.find((request) => request.id === id);
    const canConfirm = currentUser?.role === "senior" && target?.seniorId === currentUser.id || currentUser?.role === "partner" && target?.createdById === currentUser.id && target.elderConsent;
    if (!canConfirm || !target || target.status !== "awaiting_confirmation" || !target.matchedVolunteerId) { setToast("어르신 본인 또는 동의가 확인된 기관 담당자만 활동을 확인할 수 있어요."); return; }
    if (store.transactions.some((transaction) => transaction.activityId === id && transaction.type === "earn")) { setToast("이미 확인된 활동이에요. 포인트는 한 번만 적립됩니다."); return; }
    if (connectedMode) {
      if (!target.activityId) { setToast("활동 기록을 찾지 못했어요. 새로고침해 주세요."); return; }
      try {
        const result = await connectedOperation("confirm", target.activityId);
        await refreshConnected();
        setToast(`도움 확인이 완료됐어요. 청년에게 ${formatPoints(Number(result.result ?? 0))}P를 적립했어요.`);
      } catch (error) { setToast(error instanceof Error ? error.message : "활동을 확인하지 못했어요."); }
      return;
    }
    const today = todaySeoulIso();
    const earnedToday = store.transactions.filter((transaction) => transaction.volunteerId === target.matchedVolunteerId && transaction.type === "earn" && new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(transaction.createdAt)) === today).reduce((sum, transaction) => sum + transaction.amount, 0);
    const rawPoints = target.durationMinutes! < 30 ? 50 : Math.floor(target.durationMinutes! / 30) * 100;
    const amount = Math.max(0, Math.min(rawPoints, 600 - earnedToday));
    const transaction: PointTransaction = { id: newId("point"), volunteerId: target.matchedVolunteerId, activityId: id, amount, type: "earn", createdAt: new Date().toISOString(), title: `${target.category} 활동 확인` };
    const updated = { ...target, status: "completed" as const, confirmedAt: new Date().toISOString() };
    persist({ ...store, requests: store.requests.map((request) => request.id === id ? updated : request), transactions: [transaction, ...store.transactions] }, amount > 0 ? `도움 확인이 완료됐어요. 청년에게 ${formatPoints(amount)}P를 적립했어요.` : "도움 확인이 완료됐어요. 오늘 적립 한도에 도달해 포인트는 추가되지 않았어요.");
  }

  async function cancelRequest(id: string) {
    const target = store.requests.find((request) => request.id === id);
    const canCancel = currentUser?.role === "senior" && target?.seniorId === currentUser.id || currentUser?.role === "partner" && target?.createdById === currentUser.id && target.elderConsent;
    if (!canCancel || !target || !["open", "awaiting_schedule", "matched"].includes(target.status)) { setToast("진행 중이거나 완료된 활동은 여기서 취소할 수 없어요."); return; }
    if (connectedMode) {
      try { await connectedOperation("cancel", id); await refreshConnected(); setToast("요청을 취소했어요."); }
      catch (error) { setToast(error instanceof Error ? error.message : "요청을 취소하지 못했어요."); }
      return;
    }
    persist({ ...store, requests: store.requests.map((request) => request.id === id ? { ...request, status: "cancelled" } : request) }, "요청을 취소했어요.");
  }

  async function redeemReward(reward: (typeof REWARDS)[number]) {
    if (currentUser?.role !== "volunteer") { setToast("청년 계정에서 리워드를 체험해 주세요."); return; }
    const balance = pointsFor(store, currentUser.id);
    if (balance < reward.points) { setToast(`교환하려면 ${formatPoints(reward.points - balance)}P가 더 필요해요.`); return; }
    if (connectedMode) {
      const response = await fetch("/api/rewards/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rewardId: reward.id }) });
      const body = await response.json();
      if (!response.ok) { setToast(body.error || "리워드를 교환하지 못했어요."); return; }
      await refreshConnected();
      setToast(`가상 리워드 교환을 기록했어요. ${formatPoints(reward.points)}P를 사용했어요.`);
      return;
    }
    const transaction: PointTransaction = { id: newId("point"), volunteerId: currentUser.id, activityId: newId("reward"), amount: reward.points, type: "redeem", createdAt: new Date().toISOString(), title: reward.title };
    const redemption: Redemption = { id: transaction.activityId, volunteerId: currentUser.id, title: reward.title, pointsSpent: reward.points, createdAt: transaction.createdAt };
    persist({ ...store, transactions: [transaction, ...store.transactions], redemptions: [redemption, ...store.redemptions] }, `가상 리워드 교환을 기록했어요. ${formatPoints(reward.points)}P를 사용했어요.`);
  }

  async function reportRequest(id: string) {
    if (!currentUser) { setToast("먼저 데모 계정을 선택해 주세요."); return; }
    const reason = window.prompt("신고 내용을 적어 주세요. (긴급한 상황은 112 또는 119에 연락해 주세요.)");
    if (!reason?.trim()) return;
    if (connectedMode) {
      const response = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: id, reason: reason.trim().slice(0, 300) }) });
      const body = await response.json();
      if (!response.ok) { setToast(body.error || "신고를 접수하지 못했어요."); return; }
      await refreshConnected();
      setToast("신고가 접수됐어요.");
      return;
    }
    const report = { id: newId("report"), reporterId: currentUser.id, requestId: id, reason: reason.trim().slice(0, 300), status: "접수" as const, createdAt: new Date().toISOString() };
    persist({ ...store, reports: [report, ...store.reports] }, "신고가 데모 기록에 접수됐어요.");
  }

  function goto(path: string) {
    navigateStatic(path);
    setMobileMenu(false);
  }

  if (!ready) return <div className="boot-screen"><span className="brand-mark"><HandHeart /></span><p>서초손잡이를 준비하고 있어요</p></div>;
  if (connectedMode && connectedState === "error") return <div className="boot-screen"><span className="brand-mark"><HandHeart/></span><p>Supabase 데이터를 불러오지 못했어요. 환경 변수, 스키마 적용, 연결 상태를 확인해 주세요.</p><button className="button button-outline" onClick={() => window.location.reload()}>다시 시도</button></div>;
  if (pathname === "/start") return connectedMode ? <ConnectedLogin/> : <StartPage onChoose={id => void switchAccount(id)} />;
  if (!currentUser || pathname === "/") {
    return <Landing onStart={() => goto("/start")} connectedMode={connectedMode}/>;
  }

  const requestId = pathname.startsWith("/activities/") ? decodeURIComponent(pathname.split("/")[2] ?? "") : "";
  const foundRequest = requestId ? store.requests.find((request) => request.id === requestId) : undefined;
  const activeRequest = foundRequest && (currentUser.role !== "senior" || foundRequest.seniorId === currentUser.id) ? foundRequest : undefined;
  const roleNav = currentUser.role === "senior" ? seniorLinks : currentUser.role === "partner" ? partnerLinks : currentUser.role === "admin" ? [["/admin", "운영 현황", ShieldCheck]] as const : volunteerLinks;
  const proposalRoute = pathname.match(/^\/volunteer\/requests\/([^/]+)\/propose$/);
  const proposalRequest = proposalRoute ? store.requests.find((request) => request.id === decodeURIComponent(proposalRoute[1])) : undefined;

  return (
    <div className={cx("app-shell", currentUser.role === "senior" && "senior-mode", fontLarge && "large-text")}>
      <header className="app-header">
        <button className="mobile-menu-button" aria-label="메뉴 열기" onClick={() => setMobileMenu(!mobileMenu)}><Menu /></button>
        <button className="brand" onClick={() => goto(currentUser.role === "senior" ? "/senior" : currentUser.role === "volunteer" ? "/volunteer" : currentUser.role === "partner" ? "/partner" : "/admin")}>
          <span className="brand-mark"><HandHeart size={23} /></span><span className="brand-name">서초손잡이<small>SEOCHO HAND-IN-HAND</small></span>
        </button>
        <div className="header-note">{connectedMode ? <span className="demo-label connected-label"><span/>SUPABASE 연결</span> : <DemoLabel />}<span>{connectedMode ? "실제 계정으로 저장되는 MVP 기록이에요." : "모든 계정과 기록은 시연용 가상 데이터예요."}</span></div>
        <div className="header-actions">
          <button className="text-size-toggle" onClick={() => { const next = !fontLarge; setFontLarge(next); try { localStorage.setItem("seocho-sonjabi-large-text", String(next)); } catch {} }} aria-pressed={fontLarge}>가<span>+</span><small>글자 크게</small></button>
          <div className="account-switcher">{connectedMode ? <div className="account-current"><span className={`avatar ${currentUser.role}`}>{currentUser.nickname.slice(0, 1)}</span><span><b>{currentUser.nickname}</b><small>{currentUser.role === "senior" ? "어르신" : currentUser.role === "volunteer" ? "청년 봉사자" : currentUser.role === "partner" ? "기관 담당자" : "관리자"}</small></span></div> : <button className="account-current" aria-haspopup="menu" aria-expanded={accountOpen} aria-label={`현재 ${currentUser.nickname} 계정. 데모 계정 바꾸기`} onClick={() => setAccountOpen(open => !open)}><span className={`avatar ${currentUser.role}`}>{currentUser.nickname.slice(0, 1)}</span><span><b>{currentUser.nickname}</b><small>{currentUser.role === "senior" ? "어르신" : currentUser.role === "volunteer" ? "청년 봉사자" : currentUser.role === "partner" ? "가상 기관 담당자" : "관리자 데모"}</small></span><ChevronDown size={15}/></button>}</div>
        </div>
      </header>

      <div className={cx("app-body", mobileMenu && "menu-open")}>
        <aside className="sidebar">
          <div className="side-label">내 활동</div>
          <nav className="side-nav" aria-label="주요 메뉴">
            {roleNav.map(([href, title, Icon]) => <button key={href} className={cx("side-link", pathname === href && "active")} onClick={() => goto(href)}><Icon size={19} /><span>{title}</span>{href === "/volunteer/rewards" && <b className="side-nav-points">{formatPoints(availablePoints)}</b>}</button>)}
          </nav>
          <div className="sidebar-help"><div className="sidebar-help-icon"><CircleHelp size={20} /></div><b>처음 이용하시나요?</b><p>누구나 안전한 공공장소에서 만나요.</p><button onClick={() => goto("/safety")}>안전 안내 보기 <ArrowRight size={15} /></button></div>
          {!connectedMode && <button className="reset-demo" onClick={resetDemo}><RotateCcw size={16} />샘플 데이터 초기화</button>}
          <button className="back-landing" onClick={() => connectedMode ? void switchAccount(currentUser.id) : (persist({ ...store, currentUserId: null }), goto("/"))}>{connectedMode ? "로그아웃" : "처음 화면으로 돌아가기"}</button>
        </aside>

        <main className="main-content">
          {pathname === "/senior" && currentUser.role === "senior" && <SeniorDashboard store={store} currentUserId={currentUser.id} onNavigate={goto} onOpen={id => goto(`/activities/${id}`)} onMatch={beginProposal} proposals={store.scheduleProposals ?? []} onRespond={respondToProposal} />}
          {pathname === "/senior/schedule" && currentUser.role === "senior" && <div className="page-stack"><AppHeading eyebrow="함께 정한 일정" title="내 일정 달력" description="청년과 서로 정한 활동 날짜를 확인해요."/><AgreedScheduleCalendar requests={requestsForSenior(store, currentUser.id)} store={store} role="senior" onOpen={id => goto(`/activities/${id}`)}/><ScheduleProposalsPanel requests={requestsForSenior(store, currentUser.id)} proposals={store.scheduleProposals ?? []} store={store} onRespond={respondToProposal} onOpen={id => goto(`/activities/${id}`)}/></div>}
          {pathname === "/senior/request/voice" && currentUser.role === "senior" && <SeniorVoiceRequest draft={requestDraft} onChange={updateRequestDraft} onReview={() => goto("/senior/request/review")} onManual={() => goto("/senior/request/manual")} configured={voiceConfigured} agentLabel={agentLabel}/>}
          {pathname === "/senior/request/manual" && currentUser.role === "senior" && <SeniorManualWizard draft={requestDraft} onChange={updateRequestDraft} onReview={() => goto("/senior/request/review")} onBack={() => goto("/senior")}/>}
          {pathname === "/senior/request/review" && currentUser.role === "senior" && <RequestReview draft={requestDraft} onEdit={() => goto("/senior/request/manual")} onBack={() => goto("/senior/request/voice")} onSubmit={() => void createRequestFromDraft(requestDraft)} submitting={submittingRequest}/>}
          {pathname === "/senior/request/new" && currentUser.role === "senior" && <NewRequestPage user={currentUser} onSubmit={createRequest} onBack={() => goto("/senior")} />}
          {pathname === "/volunteer" && currentUser.role === "volunteer" && <VolunteerDashboard store={store} user={currentUser} onNavigate={goto} onOpen={id => goto(`/activities/${id}`)} onMatch={beginProposal} />}
          {pathname === "/volunteer/calendar" && currentUser.role === "volunteer" && <div className="page-stack"><AppHeading eyebrow="함께 정한 일정" title="내 일정 달력" description="어르신과 서로 정한 활동 날짜를 확인해요."/><AgreedScheduleCalendar requests={store.requests.filter(request => request.matchedVolunteerId === currentUser.id)} store={store} role="volunteer" onOpen={id => goto(`/activities/${id}`)}/></div>}
          {pathname === "/volunteer/requests" && currentUser.role === "volunteer" && <RequestsPage store={store} user={currentUser} onOpen={id => goto(`/activities/${id}`)} onMatch={beginProposal} connectedMode={connectedMode} />}
          {proposalRequest && currentUser.role === "volunteer" && <ProposalForm title={proposalRequest.title} neighborhood={proposalRequest.neighborhood} datePreference={proposalRequest.datePreference} specificDate={proposalRequest.specificDate} timeWindow={proposalRequest.timeWindow} onBack={() => goto("/volunteer/requests")} onSubmit={(choices) => void submitProposal(proposalRequest.id, choices)}/>}
          {pathname === "/volunteer/history" && currentUser.role === "volunteer" && <HistoryPage store={store} user={currentUser} onOpen={id => goto(`/activities/${id}`)} onCertificate={request => downloadCertificate(request, currentUser.nickname)} />}
          {pathname === "/volunteer/rewards" && currentUser.role === "volunteer" && <RewardsPage store={store} user={currentUser} onRedeem={redeemReward} />}
          {pathname === "/partner" && currentUser.role === "partner" && <PartnerDashboard partnerName={currentUser.nickname} requests={store.requests.filter((request) => request.createdById === currentUser.id && request.createdByRole === "partner")} store={store} proposals={store.scheduleProposals ?? []} onRespond={respondToProposal} onNewRequest={() => goto("/partner/requests/new")} onOpen={(id) => goto(`/activities/${id}`)} onConfirm={confirmActivity}/>}
          {pathname === "/partner/requests/new" && currentUser.role === "partner" && <PartnerRequestForm partnerName={currentUser.nickname} seniors={store.users.filter((user) => user.role === "senior").map(({id,nickname}) => ({id,nickname}))} onBack={() => goto("/partner")} onSubmit={(values) => void createRequestFromDraft(values, { seniorId: values.seniorId, consent: values.consent })}/>}
          {requestId && activeRequest && <ActivityPage request={activeRequest} store={store} userId={currentUser.id} role={currentUser.role} onStart={startActivity} onFinish={finishActivity} onConfirm={confirmActivity} onCancel={cancelRequest} onReport={reportRequest} onBack={() => goto(currentUser.role === "senior" ? "/senior" : currentUser.role === "partner" ? "/partner" : "/volunteer/requests")} connectedMode={connectedMode} />}
          {requestId && !activeRequest && <EmptyPage title="활동을 찾을 수 없어요" body="목록에서 다른 활동을 선택해 주세요." action="도움 요청 목록으로" onAction={() => goto(currentUser.role === "senior" ? "/senior" : "/volunteer/requests")} />}
          {pathname === "/admin" && currentUser.role === "admin" && <AdminPage store={store} onOpen={id => goto(`/activities/${id}`)} onSwitchAccount={id => void switchAccount(id)} canPreview={!connectedMode} />}
          {pathname === "/admin" && currentUser.role !== "admin" && <EmptyPage title="관리자 전용 화면이에요" body="운영 현황은 승인된 관리자 계정에서만 볼 수 있어요." action="내 홈으로" onAction={() => goto(currentUser.role === "senior" ? "/senior" : currentUser.role === "partner" ? "/partner" : "/volunteer")} />}
          {pathname === "/safety" && <SafetyPage onBack={() => goto(currentUser.role === "senior" ? "/senior" : currentUser.role === "partner" ? "/partner" : "/volunteer")} />}
          {!requestId && !proposalRoute && !["/senior", "/senior/schedule", "/senior/request/new", "/senior/request/voice", "/senior/request/manual", "/senior/request/review", "/volunteer", "/volunteer/calendar", "/volunteer/requests", "/volunteer/history", "/volunteer/rewards", "/partner", "/partner/requests/new", "/admin", "/safety"].includes(pathname) && <EmptyPage title="화면을 찾을 수 없어요" body="상단 메뉴에서 이동할 곳을 선택해 주세요." action="내 홈으로" onAction={() => goto(currentUser.role === "senior" ? "/senior" : currentUser.role === "partner" ? "/partner" : currentUser.role === "volunteer" ? "/volunteer" : "/admin")} />}
        </main>
      </div>
      <MobileNav role={currentUser.role} pathname={pathname} onNavigate={goto} />
      <footer className="app-footer"><span>서초손잡이 · 가까운 이웃과 함께, 세대를 잇는 따뜻한 연결</span><span>해커톤 시연용 서비스 · 모든 데이터는 가상 정보입니다</span></footer>
      {accountOpen && !connectedMode && <div className="account-popover" role="menu" aria-label="데모 계정 선택"><p>데모 계정 바꾸기</p>{store.users.map(account => <button key={account.id} role="menuitem" onClick={() => void switchAccount(account.id)}><span className={`avatar ${account.role}`}>{account.nickname.slice(0, 1)}</span><span>{account.nickname}<small>{account.role === "senior" ? "어르신" : account.role === "volunteer" ? "청년 봉사자" : account.role === "partner" ? "기관 담당자" : "관리자"} · {account.neighborhood}</small></span>{account.id === currentUser.id && <Check size={17}/>}</button>)}<button className="account-popover-close" role="menuitem" onClick={() => setAccountOpen(false)}><X size={15}/>닫기</button></div>}
      {toast && <div className="toast-message" role="status"><CheckCircle2 size={18} />{toast}</div>}
    </div>
  );
}

function Landing({ onStart, connectedMode = false }: { onStart: () => void; connectedMode?: boolean }) {
  return <div className="landing-page">
    <header className="landing-header"><a className="brand" href="#top"><span className="brand-mark"><HandHeart size={23} /></span><span className="brand-name">서초손잡이<small>SEOCHO HAND-IN-HAND</small></span></a><nav><a href="#how">이용 방법</a><a href="#help">어떤 도움을 나누나요?</a><a href="#faq">자주 묻는 질문</a><button className="button button-primary" onClick={onStart}>체험 시작 <ArrowRight size={17} /></button></nav></header>
    <main id="top">
      <section className="landing-hero">
        <div className="hero-copy"><span className="eyebrow"><span className="eyebrow-dot" />서초구 이웃 돌봄 연결</span><h1>가까운 이웃과 함께,<br /><em>세대를 잇는 따뜻한 연결</em></h1><p>도움이 필요한 순간, 우리 동네 청년과 어르신이<br className="desktop-break" /> 가볍게 손잡을 수 있도록 서초손잡이가 함께해요.</p><div className="hero-actions"><button className="button button-primary button-large" onClick={onStart}>무료로 체험하기 <ArrowRight size={20} /></button><a className="text-link" href="#how">어떻게 이용하나요? <ArrowDownLeft size={17} /></a></div><div className="hero-trust"><span><ShieldCheck size={17} />개인정보는 최소한으로</span><span><MapPin size={17} />서초구 동네 단위로 연결</span></div></div>
        <div className="hero-art" aria-label="이웃끼리 돕는 따뜻한 연결"><div className="art-sun"/><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-blob blob-green"/><div className="art-blob blob-orange"/><div className="art-home-card"><div className="art-card-header"><span className="art-dot"/><span className="art-dot"/><span className="art-dot"/><b>오늘의 우리 동네</b></div><div className="art-person-row"><span className="art-avatar art-senior">김</span><div><strong>도움이 필요한 이웃</strong><small>방배동 · 스마트폰 사용 도움</small></div><span className="art-status">매칭 대기</span></div><div className="art-connection"><span/><HeartHandshake size={22}/><span/></div><div className="art-person-row"><span className="art-avatar art-volunteer">이</span><div><strong>함께하고 싶은 청년</strong><small>방배동 · 30분 활동</small></div><span className="art-heart">♥</span></div></div><div className="art-note note-one"><Sparkles size={15} />작은 도움, 큰 안심</div><div className="art-note note-two"><MapPin size={15} />가까운 동네에서 만나요</div><div className="art-decoration dec-leaf">✳</div></div>
      </section>
      <section className="landing-stats"><div><strong>1:1</strong><span>한 요청에 한 청년</span></div><div><strong>공공장소</strong><span>안전한 만남을 권해요</span></div><div><strong>30분부터</strong><span>부담 없는 짧은 활동</span></div><div><strong>서초구</strong><span>동네 가까이 연결해요</span></div></section>
      <section className="landing-section how-section" id="how"><div className="section-intro"><span className="eyebrow">HOW IT WORKS</span><h2>요청부터 활동 확인까지,<br />간단하게 이어져요</h2><p>누구나 편하게 참여할 수 있도록 필요한 과정만 담았어요.</p></div><div className="step-grid"><article><span className="step-number">01</span><IconCircle><MessageCircle size={23}/></IconCircle><h3>도움 요청하기</h3><p>어르신이 필요한 도움과 편한 시간을 골라요.</p></article><article><span className="step-number">02</span><IconCircle tone="orange"><Users size={23}/></IconCircle><h3>이웃 청년과 연결</h3><p>가까운 동네에서 가능한 청년이 신청해요.</p></article><article><span className="step-number">03</span><IconCircle tone="blue"><HeartHandshake size={23}/></IconCircle><h3>함께 활동하기</h3><p>복지관 등 공개된 장소에서 도움을 나눠요.</p></article><article><span className="step-number">04</span><IconCircle tone="cream"><BadgeCheck size={23}/></IconCircle><h3>확인하고 기록하기</h3><p>어르신 확인 후 청년의 활동 기록이 쌓여요.</p></article></div></section>
      <section className="landing-section help-section" id="help"><div className="section-intro"><span className="eyebrow">A LITTLE HELP, A LOT OF CARE</span><h2>이런 도움을 주고받을 수 있어요</h2><p>일상에서 함께 연습하고 안내하는 활동이에요.</p></div><div className="help-grid"><div><IconCircle><Smartphone size={22}/></IconCircle><b>스마트폰 사용</b><span>사진 보내기, 글자 크기 설정</span></div><div><IconCircle tone="orange"><MonitorSmartphone size={22}/></IconCircle><b>키오스크 연습</b><span>주문·발권 순서 차근차근 익히기</span></div><div><IconCircle tone="blue"><BookOpen size={22}/></IconCircle><b>복지관 프로그램 안내</b><span>프로그램 검색과 신청 방법 찾기</span></div><div><IconCircle tone="cream"><MapPin size={22}/></IconCircle><b>공공장소 길 안내</b><span>복지관·공공시설 안에서 동행하기</span></div></div><div className="safety-strip"><ShieldCheck size={21}/><p><b>안전한 활동을 위해</b> 금융 거래 대행, 비밀번호 입력, 의료행위, 신체 부축은 요청할 수 없어요.</p><a href="#faq">안전 기준 보기 <ArrowRight size={16}/></a></div></section>
      <section className="landing-cta"><div><span className="eyebrow">ONE SMALL MOMENT CAN MAKE A DIFFERENCE</span><h2>우리 동네에서 손잡아 볼까요?</h2><p>{connectedMode ? "이메일 인증 후 도움 요청과 활동을 이어갈 수 있어요." : "데모 계정으로 요청부터 활동 완료까지 직접 체험할 수 있어요."}</p></div><button className="button button-white button-large" onClick={onStart}>{connectedMode ? "이메일로 시작하기" : "역할을 선택하고 시작"} <ArrowRight size={19}/></button><div className="cta-flower">✳</div></section>
      <section className="landing-section faq-section" id="faq"><div className="section-intro"><span className="eyebrow">FAQ</span><h2>자주 묻는 질문</h2></div><div className="faq-list"><details><summary>실제 봉사시간이 인정되나요?</summary><p>아니요. 현재는 해커톤 시연용 데모 서비스이며, 활동 시간은 서비스 내부 기록입니다. 1365 자원봉사포털과 연동되지 않고 공식 봉사실적으로 사용할 수 없어요.</p></details><details><summary>활동은 어디에서 하나요?</summary><p>복지관이나 공공시설 등 공개된 장소에서 만나는 방식을 권해요. 정확한 집 주소나 개인 연락처는 요청에 표시하지 않습니다.</p></details><details><summary>어떤 요청은 할 수 없나요?</summary><p>금융 거래, 비밀번호 입력, 의료행위, 신체 부축이 필요한 돌봄은 지원하지 않아요. 급한 도움이 필요한 경우 112 또는 119에 연락해 주세요.</p></details><details><summary>리워드는 실제 쿠폰인가요?</summary><p>아니요. 포인트와 혜택은 서비스 흐름을 체험하기 위한 가상 데이터이며 실제 사용할 수 없어요.</p></details></div></section>
    </main><footer className="landing-footer"><a className="brand" href="#top"><span className="brand-mark"><HandHeart size={20}/></span><span className="brand-name">서초손잡이<small>DEMO SERVICE</small></span></a><span>© 2026 서초손잡이 해커톤 MVP · 공식 인증 및 기관 제휴 없음</span></footer>
  </div>;
}

function StartPage({ onChoose }: { onChoose: (id: string) => void }) {
  return <div className="start-page"><div className="start-top"><a className="brand" href="/"><span className="brand-mark"><HandHeart size={22}/></span><span className="brand-name">서초손잡이<small>SEOCHO HAND-IN-HAND</small></span></a><DemoLabel/></div><main><button className="back-link" onClick={() => window.location.assign("/")}><ArrowLeft size={17}/> 처음으로</button><span className="eyebrow">ROLE SELECTION</span><h1>어떤 마음으로 오셨나요?</h1><p>역할을 고르면 가상 계정으로 바로 체험할 수 있어요.</p><div className="role-cards"><button className="role-card senior-card" onClick={() => onChoose("senior-kim")}><span className="role-icon"><HandHeart size={30}/></span><span className="role-overline">어르신</span><strong>도움이 필요해요</strong><small>필요한 도움을 요청하고<br/>활동을 확인해요.</small><span className="role-action">어르신으로 체험하기 <ArrowRight size={17}/></span></button><button className="role-card volunteer-card" onClick={() => onChoose("volunteer-lee")}><span className="role-icon"><HeartHandshake size={30}/></span><span className="role-overline">청년 봉사자</span><strong>도움을 나누고 싶어요</strong><small>동네 요청을 살펴보고<br/>함께할 활동을 찾아요.</small><span className="role-action">청년으로 체험하기 <ArrowRight size={17}/></span></button></div><div className="start-note"><ShieldCheck size={17}/>회원가입이 없어요. 모두 시연용 가상 계정입니다.</div><div className="start-extra"><span>관리자 데모는 별도 운영자 계정으로 시작해요.</span><div><button onClick={() => onChoose("admin-demo")}>관리자 데모 시작하기</button></div></div></main></div>;
}

function AppHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}

function SeniorDashboard({ store, currentUserId, onNavigate, onOpen, onMatch, proposals, onRespond }: { store: DemoStore; currentUserId: string; onNavigate: (path: string) => void; onOpen: (id: string) => void; onMatch: (id: string) => void; proposals: ScheduleProposal[]; onRespond: (id: string, accept: boolean) => void }) {
  const user = userFor(store, currentUserId)!;
  const mine = requestsForSenior(store, currentUserId);
  const pending = mine.filter(request => request.status === "awaiting_confirmation");
  const hasScheduleProposal = proposals.some(proposal => proposal.status === "pending" && mine.some(request => request.id === proposal.requestId));
  return <div className="page-stack"><section className="welcome-panel senior-welcome"><div><span className="eyebrow">어르신 홈</span><h1>{user.nickname}님,<br/><em>어떤 도움이 필요하세요?</em></h1><p>편한 방법을 골라 도움을 요청해 주세요.</p><div className="senior-home-actions"><button className="button button-primary button-large" onClick={() => onNavigate("/senior/request/voice")}><Mic size={22}/><span className="senior-action-label"><b>말로 요청하기</b><small>편하게 이야기해 주세요</small></span><ArrowRight size={19}/></button><button className="button button-outline button-large" onClick={() => onNavigate("/senior/request/manual")}><HandHeart size={22}/><span className="senior-action-label"><b>화면에서 고르기</b><small>큰 버튼을 눌러 하나씩 선택해요</small></span><ArrowRight size={19}/></button></div></div><div className="welcome-art"><span className="welcome-sun"/><div className="welcome-icon-card"><HandHeart size={66}/><span>같이 해요!</span></div><div className="welcome-spark spark-a">✳</div><div className="welcome-spark spark-b">✦</div></div></section>
    {hasScheduleProposal && <ScheduleProposalsPanel requests={mine} proposals={proposals} store={store} onRespond={onRespond} onOpen={onOpen}/>}
    <UpcomingSchedules requests={mine} store={store} role="senior" onNavigate={() => onNavigate("/senior/schedule")} onOpen={onOpen}/>
    <div className="section-title-row"><div><span className="eyebrow">요청 현황</span><h2>내 도움 요청</h2></div><span className="soft-count">{mine.length}건</span></div>
    {pending.length > 0 && <button className="confirm-callout" onClick={() => onOpen(pending[0].id)}><span className="confirm-callout-icon"><CheckCircle2 size={22}/></span><span><b>도움받으셨나요?</b><small>활동 내용을 살펴보고 완료를 확인해 주세요.</small></span><ArrowRight size={19}/></button>}
    {mine.length === 0 ? <EmptyCard title="아직 등록한 요청이 없어요" body="필요한 도움을 선택해 이웃에게 알려 주세요." action="도움 요청하기" onAction={() => onNavigate("/senior/request/manual")}/> : <div className="request-grid">{mine.map(request => <RequestCard key={request.id} request={request} store={store} isVolunteer={false} currentUserId={currentUserId} onOpen={onOpen} onMatch={onMatch}/>)}</div>}
    <SafetyNote/></div>;
}

function UpcomingSchedules({ requests, store, role, onNavigate, onOpen }: { requests: HelpRequest[]; store: DemoStore; role: "senior" | "volunteer"; onNavigate: () => void; onOpen: (id: string) => void }) {
  const today = todaySeoulIso();
  const upcoming = agreedSchedules(requests).filter(item => ["matched", "in_progress"].includes(item.request.status) && scheduleDayKey(item.startAt) >= today).slice(0, 2);
  return <section className="upcoming-schedules"><div className="section-title-row"><div><span className="eyebrow">SHARED SCHEDULE</span><h2>다가오는 약속</h2></div><button className="text-button" onClick={onNavigate}>달력 보기 <ArrowRight size={16}/></button></div>{upcoming.length ? <div className="upcoming-schedule-list">{upcoming.map(item => {
    const counterpart = role === "senior" ? userFor(store, item.request.matchedVolunteerId)?.nickname : userFor(store, item.request.seniorId)?.nickname;
    return <button className="upcoming-schedule-row" key={item.request.id} onClick={() => onOpen(item.request.id)}><span className="upcoming-date"><b>{new Intl.DateTimeFormat("ko-KR", {timeZone:"Asia/Seoul",month:"numeric",day:"numeric"}).format(item.startAt)}</b><small>{new Intl.DateTimeFormat("ko-KR", {timeZone:"Asia/Seoul",weekday:"short"}).format(item.startAt)}</small></span><span className="upcoming-copy"><b>{item.request.title}</b><small>{timeLabel(item.startAt)} · {role === "senior" ? "함께할 청년" : "함께할 어르신"} {counterpart ?? "이웃"} · {item.request.neighborhood}</small></span><ArrowRight size={17}/></button>;
  })}</div> : <button className="upcoming-empty" onClick={onNavigate}><CalendarDays size={20}/><span><b>아직 확정된 일정이 없어요</b><small>일정을 정하면 달력에서 확인할 수 있어요.</small></span><ArrowRight size={17}/></button>}</section>;
}

function AgreedScheduleCalendar({ requests, store, role, onOpen }: { requests: HelpRequest[]; store: DemoStore; role: "senior" | "volunteer"; onOpen: (id: string) => void }) {
  const today = todaySeoulIso();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)) - 1);
  const [selectedDay, setSelectedDay] = useState(today);
  const events = agreedSchedules(requests);
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: Array<{ key: string; day: number } | null> = Array(firstWeekday).fill(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push({ key: `${monthPrefix}-${String(day).padStart(2, "0")}`, day });
  while (cells.length % 7) cells.push(null);
  const eventCountByDay = new Map<string, number>();
  for (const event of events) {
    const key = scheduleDayKey(event.startAt);
    eventCountByDay.set(key, (eventCountByDay.get(key) ?? 0) + 1);
  }
  const selectedEvents = events.filter(event => scheduleDayKey(event.startAt) === selectedDay);
  const monthEvents = events.filter(event => scheduleDayKey(event.startAt).startsWith(monthPrefix));
  const monthLabel = new Intl.DateTimeFormat("ko-KR", {timeZone:"Asia/Seoul",year:"numeric",month:"long"}).format(new Date(`${monthPrefix}-01T12:00:00+09:00`));
  const changeMonth = (amount: number) => {
    const next = new Date(Date.UTC(year, month + amount, 1));
    const nextYear = next.getUTCFullYear();
    const nextMonth = next.getUTCMonth();
    const prefix = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}`;
    const nextEvent = events.find(event => scheduleDayKey(event.startAt).startsWith(prefix));
    setYear(nextYear);
    setMonth(nextMonth);
    setSelectedDay(nextEvent ? scheduleDayKey(nextEvent.startAt) : `${prefix}-01`);
  };
  const selectToday = () => {
    setYear(Number(today.slice(0, 4)));
    setMonth(Number(today.slice(5, 7)) - 1);
    setSelectedDay(today);
  };
  return <section className="agreed-calendar" aria-label="합의된 일정 달력">
    <div className="calendar-toolbar"><div><b>{monthLabel}</b><span>{monthEvents.length}건의 합의 일정</span></div><div className="calendar-controls"><button aria-label="이전 달" onClick={() => changeMonth(-1)}><ArrowLeft size={17}/></button><button className="calendar-today" onClick={selectToday}>오늘</button><button aria-label="다음 달" onClick={() => changeMonth(1)}><ArrowRight size={17}/></button></div></div>
    <div className="calendar-weekdays" aria-hidden="true">{["일","월","화","수","목","금","토"].map(day => <span key={day}>{day}</span>)}</div>
    <div className="calendar-days">{cells.map((cell, index) => {
      if (!cell) return <span className="calendar-day-empty" key={`empty-${index}`}/>;
      const count = eventCountByDay.get(cell.key) ?? 0;
      return <button key={cell.key} className={cx("calendar-day", selectedDay === cell.key && "selected", today === cell.key && "today", count > 0 && "has-events")} aria-label={`${cell.key}${count ? `, 일정 ${count}건` : ", 일정 없음"}`} aria-pressed={selectedDay === cell.key} onClick={() => setSelectedDay(cell.key)}><span>{cell.day}</span>{count > 0 && <i aria-hidden="true"/>}</button>;
    })}</div>
    <div className="calendar-selected-day"><div className="section-title-row"><div><span className="eyebrow">선택한 날짜</span><h2>{dateLabel(selectedDay, {year:"numeric",month:"long",day:"numeric",weekday:"long"})}</h2></div><span className="soft-count">{selectedEvents.length}건</span></div>
      {selectedEvents.length ? <div className="calendar-event-list">{selectedEvents.map(item => {
        const counterpart = role === "senior" ? userFor(store, item.request.matchedVolunteerId)?.nickname : userFor(store, item.request.seniorId)?.nickname;
        return <article className="calendar-event" key={item.request.id}><div className="calendar-event-time"><b>{timeLabel(item.startAt)}</b><small>약 {item.request.durationMinutes ?? item.request.estimatedMinutes}분</small></div><div className="calendar-event-main"><b>{item.request.title}</b><small>{role === "senior" ? "함께할 청년" : "함께할 어르신"} · {counterpart ?? "이웃"} · {item.request.neighborhood}</small><span className={`status-pill status-${item.request.status}`}><i/>{statusLabel(item.request.status)}</span></div><button className="calendar-event-open" onClick={() => onOpen(item.request.id)}>상세 <ArrowRight size={15}/></button></article>;
      })}</div> : <div className="calendar-empty-day"><CalendarDays size={22}/><p>이 날짜에 확정된 일정이 없어요.</p></div>}
    </div>
    <p className="calendar-note"><ShieldCheck size={15}/>어르신과 청년이 확정한 일정만 표시돼요. 일정 변경이 필요하면 활동 상세에서 서로 확인해 주세요.</p>
  </section>;
}

function NewRequestPage({ user, onSubmit, onBack }: { user: DemoUser; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onBack: () => void }) {
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  return <div className="page-stack narrow-page"><button className="back-link" onClick={onBack}><ArrowLeft size={17}/> 내 도움 요청으로</button><AppHeading eyebrow="ASK YOUR NEIGHBORS" title="어떤 도움이 필요하세요?" description={`${user.nickname}님, 쉬운 항목을 골라 알려 주세요.`}/><form className="request-form" onSubmit={onSubmit}>
      <fieldset><legend><span>1</span>도움 종류를 골라 주세요</legend><div className="category-choice-grid">{CATEGORIES.map((item, index) => <label key={item} className={cx("category-choice", category === item && "selected")}><input type="radio" name="category" value={item} checked={category === item} onChange={() => setCategory(item)}/><span className="choice-number">0{index + 1}</span><b>{item}</b>{category === item && <CheckCircle2 size={17}/>}</label>)}</div><p className="form-example"><MessageCircle size={16}/>{categoryExamples[category]}</p></fieldset>
      <fieldset><legend><span>2</span>요청 내용을 적어 주세요</legend><label className="field-label" htmlFor="requestTitle">한 줄 제목</label><input id="requestTitle" name="title" className="form-input" required minLength={5} maxLength={80} placeholder="예: 스마트폰으로 사진 보내는 방법"/><label className="field-label" htmlFor="requestDescription">자세한 내용</label><textarea id="requestDescription" name="description" className="form-input" required minLength={5} maxLength={240} rows={3} placeholder={categoryExamples[category]}/><small className="field-hint">전화번호, 집 주소, 비밀번호 등 개인정보는 적지 말아 주세요.</small></fieldset>
      <fieldset><legend><span>3</span>편한 일정과 동네를 알려 주세요</legend><div className="form-two-col"><label><span className="field-label">희망 날짜</span><input type="date" name="date" className="form-input" required min={todaySeoulIso()}/></label><label><span className="field-label">희망 시간</span><select name="time" className="form-input" defaultValue="오전 10:00"><option>오전 10:00</option><option>오전 11:00</option><option>오후 1:00</option><option>오후 2:00</option><option>오후 3:00</option><option>오후 4:00</option></select></label><label><span className="field-label">예상 시간</span><select name="minutes" className="form-input" defaultValue="30"><option value="30">약 30분</option><option value="45">약 45분</option><option value="60">약 1시간</option></select></label><label><span className="field-label">활동 동네</span><select name="neighborhood" className="form-input" defaultValue={user.neighborhood}>{NEIGHBORHOODS.map(place => <option key={place}>{place}</option>)}</select></label></div><div className="public-place-note"><MapPin size={18}/><span><b>활동 장소는 복지관 등 공공장소로 정해 주세요.</b><small>정확한 만남 장소와 일정은 매칭 이후 안전하게 상의해요.</small></span></div></fieldset>
      <div className="request-safety-check"><ShieldCheck size={20}/><p><b>안전한 활동을 위해</b><br/>금융 거래, 비밀번호 입력, 의료행위, 신체 부축이 필요한 요청은 등록할 수 없어요.</p></div>
      <div className="form-actions"><button type="button" className="button button-quiet" onClick={onBack}>취소</button><button type="submit" className="button button-primary button-large">요청 등록하기 <ArrowRight size={18}/></button></div>
    </form></div>;
}

function VolunteerDashboard({ store, user, onNavigate, onOpen, onMatch }: { store: DemoStore; user: NonNullable<ReturnType<typeof userFor>>; onNavigate: (path: string) => void; onOpen: (id: string) => void; onMatch: (id: string) => void }) {
  const done = completedFor(store, user.id);
  const mine = store.requests.filter(request => request.matchedVolunteerId === user.id);
  const points = pointsFor(store, user.id);
  const recommendations = store.requests.filter(request => ["open", "awaiting_schedule"].includes(request.status)).map(request => ({ request, score: recommendScore(request, user.neighborhood, user.preferredCategories) })).sort((a,b) => b.score - a.score).slice(0,3);
  return <div className="page-stack"><section className="welcome-panel volunteer-welcome"><div><span className="eyebrow">YOUR NEIGHBORHOOD, YOUR KINDNESS</span><h1>{user.nickname}님,<br/><em>함께할 이웃이 기다려요.</em></h1><p>{user.neighborhood} 가까이에서<br/>짧은 도움을 나눠 보세요.</p><button className="button button-primary button-large" onClick={() => onNavigate("/volunteer/requests")}><Search size={19}/> 도움 요청 둘러보기</button></div><div className="volunteer-illustration"><div className="illustration-circle"><HeartHandshake size={55}/></div><div className="illustration-pill pill-one"><MapPin size={14}/> {user.neighborhood}</div><div className="illustration-pill pill-two"><Sparkles size={14}/> 작은 손길</div><span className="illustration-star">✳</span></div></section>
    <div className="metric-grid"><Metric label="확인된 활동" value={done.length} unit="회" icon={<HeartHandshake size={17}/>}/><Metric label="누적 활동 시간" value={Math.floor(totalMinutes(done) / 60)} unit={`시간 ${totalMinutes(done) % 60}분`} icon={<Clock3 size={17}/>}/><Metric label="손잡이 포인트" value={formatPoints(points)} unit="P" icon={<Wallet size={17}/>}/><Metric label="함께한 어르신" value={new Set(done.map(request => request.seniorId)).size} unit="분" icon={<Users size={17}/>}/></div>
    <UpcomingSchedules requests={mine} store={store} role="volunteer" onNavigate={() => onNavigate("/volunteer/calendar")} onOpen={onOpen}/>
    {mine.some(request => request.status === "awaiting_confirmation") && <button className="confirm-callout volunteer-callout" onClick={() => onOpen(mine.find(request => request.status === "awaiting_confirmation")!.id)}><span className="confirm-callout-icon"><Clock3 size={22}/></span><span><b>활동 확인을 기다리고 있어요</b><small>어르신이 확인하면 활동 기록과 포인트가 반영돼요.</small></span><ArrowRight size={19}/></button>}
    <div className="section-title-row"><div><span className="eyebrow">NEAR YOUR NEIGHBORHOOD</span><h2>이웃의 도움 요청</h2></div><button className="text-button" onClick={() => onNavigate("/volunteer/requests")}>모두 보기 <ArrowRight size={17}/></button></div>
    {recommendations.length ? <div className="request-grid">{recommendations.map(({request}) => <RequestCard key={request.id} request={request} store={store} isVolunteer currentUserId={user.id} onOpen={onOpen} onMatch={onMatch}/>)}</div> : <EmptyCard title="현재 대기 중인 요청이 없어요" body="새로운 요청이 등록되면 이곳에 표시됩니다." action="다른 동네도 둘러보기" onAction={() => onNavigate("/volunteer/requests")}/>}
    <div className="section-title-row"><div><span className="eyebrow">MY ACTIVITIES</span><h2>내 활동</h2></div><button className="text-button" onClick={() => onNavigate("/volunteer/history")}>활동 기록 <ArrowRight size={17}/></button></div>
    <div className="compact-activity-list">{mine.length ? mine.slice(0,3).map(request => <button key={request.id} className="compact-activity" onClick={() => onOpen(request.id)}><IconCircle tone={request.status === "completed" ? "green" : "orange"}><HandHeart size={20}/></IconCircle><span><b>{request.title}</b><small>{request.neighborhood} · {dateLabel(request.requestedDate)} · 약 {request.durationMinutes ?? request.estimatedMinutes}분</small></span><StatusPill status={request.status}/><ArrowRight size={17}/></button>) : <div className="empty-inline">아직 신청한 활동이 없어요. 가까운 이웃의 요청을 확인해 보세요.</div>}</div>
    <p className="demo-reward-note"><Sparkles size={16}/> 포인트와 혜택은 가상 데모이며 실제 교환이나 봉사시간 인증이 되지 않아요.</p></div>;
}

function RequestsPage({ store, user, onOpen, onMatch, connectedMode = false }: { store: DemoStore; user: NonNullable<ReturnType<typeof userFor>>; onOpen: (id: string) => void; onMatch: (id: string) => void; connectedMode?: boolean }) {
  const [region, setRegion] = useState("전체 동네");
  const [category, setCategory] = useState("전체 도움");
  const [duration, setDuration] = useState("모든 시간");
  const [day, setDay] = useState("모든 날짜");
  const [query, setQuery] = useState("");
  const rows = store.requests.filter(request => ["open", "awaiting_schedule"].includes(request.status)).filter(request => region === "전체 동네" || request.neighborhood === region).filter(request => category === "전체 도움" || request.category === category).filter(request => duration === "모든 시간" || (duration === "30분" ? request.estimatedMinutes <= 30 : duration === "45분" ? request.estimatedMinutes <= 45 : request.estimatedMinutes >= 60)).filter(request => day === "모든 날짜" || (day === "오늘" ? request.requestedDate === todaySeoulIso() : request.requestedDate <= (() => { const d = new Date(`${todaySeoulIso()}T00:00:00+09:00`); d.setDate(d.getDate() + 3); return new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(d); })())).filter(request => !query || `${request.title} ${request.description} ${request.neighborhood}`.toLowerCase().includes(query.toLowerCase())).sort((a,b) => recommendScore(b, user.neighborhood, user.preferredCategories) - recommendScore(a, user.neighborhood, user.preferredCategories));
  return <div className="page-stack"><AppHeading eyebrow="FIND A NEIGHBOR" title="도움 요청 둘러보기" description="가까운 동네의 요청을 살펴보고 함께할 활동을 찾아보세요." action={!connectedMode && <DemoLabel/>}/><div className="filter-panel"><label className="search-field"><Search size={18}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="요청 내용을 검색해 보세요" aria-label="도움 요청 검색"/></label><div className="filters-row"><label>동네<select value={region} onChange={event => setRegion(event.target.value)}><option>전체 동네</option>{NEIGHBORHOODS.map(place => <option key={place}>{place}</option>)}</select></label><label>도움 종류<select value={category} onChange={event => setCategory(event.target.value)}><option>전체 도움</option>{CATEGORIES.map(item => <option key={item}>{item}</option>)}</select></label><label>예상 시간<select value={duration} onChange={event => setDuration(event.target.value)}><option>모든 시간</option><option>30분</option><option>45분</option><option>1시간</option></select></label><label>희망 날짜<select value={day} onChange={event => setDay(event.target.value)}><option>모든 날짜</option><option>오늘</option><option>3일 이내</option></select></label></div><div className="recommend-note"><Sparkles size={15}/><span>추천 순서는 <b>동네 40점 · 선호 도움 35점 · 기본 25점</b> 기준으로 계산돼요. 자동 규칙이며 AI 판단이 아닙니다.</span></div></div><div className="section-title-row"><div><h2>대기 중인 도움 요청</h2><p className="muted-copy">{rows.length}건 · {user.neighborhood} 우선 추천</p></div><span className="soft-count">추천순</span></div>{rows.length ? <div className="request-grid">{rows.map(request => <RequestCard key={request.id} request={request} store={store} isVolunteer currentUserId={user.id} onOpen={onOpen} onMatch={onMatch}/>)}</div> : <EmptyCard title="조건에 맞는 요청이 없어요" body="필터를 바꾸거나 나중에 다시 확인해 주세요." action="필터 초기화" onAction={() => {setRegion("전체 동네");setCategory("전체 도움");setDuration("모든 시간");setDay("모든 날짜");setQuery("");}}/>}</div>;
}

function HistoryPage({ store, user, onOpen, onCertificate }: { store: DemoStore; user: NonNullable<ReturnType<typeof userFor>>; onOpen: (id: string) => void; onCertificate: (request: HelpRequest) => void }) {
  const rows = store.requests.filter(request => request.matchedVolunteerId === user.id).sort((a,b) => (b.confirmedAt ?? b.createdAt).localeCompare(a.confirmedAt ?? a.createdAt));
  const completed = rows.filter(request => request.status === "completed");
  const minutes = totalMinutes(completed);
  return <div className="page-stack"><AppHeading eyebrow="ACTIVITY HISTORY" title="내 활동 기록" description="어르신 확인이 끝난 활동과 진행 상황을 살펴보세요."/><div className="history-summary"><div><span>확인된 활동</span><b>{completed.length}<small>회</small></b></div><div><span>누적 활동 시간</span><b>{Math.floor(minutes / 60)}<small>시간</small> {minutes % 60}<small>분</small></b></div><div className="internal-only"><ShieldCheck size={17}/>서비스 내부 기록 · 공식 봉사시간 인증 아님</div></div><div className="certificate-alert"><FileText size={19}/><p><b>시연용 활동 확인서</b><span>문서에는 큰 DEMO 표시가 있으며 공식 증빙으로 사용할 수 없습니다.</span></p></div><div className="history-list">{rows.length ? rows.map(request => <article key={request.id} className="history-row"><div className="history-date"><b>{dateLabel(request.confirmedAt ?? request.createdAt, {month:"short",day:"numeric"})}</b><small>{request.neighborhood}</small></div><div className="history-main"><b>{request.title}</b><span>{request.category} · {request.durationMinutes ?? request.estimatedMinutes}분 · {request.simulated && <em>체험 활동</em>}</span><StatusPill status={request.status}/></div><div className="history-actions"><button className="button button-quiet" onClick={() => onOpen(request.id)}>상세 보기</button>{request.status === "completed" && <button className="button button-outline" onClick={() => onCertificate(request)}><Download size={16}/>확인서</button>}</div></article>) : <EmptyCard title="아직 활동 기록이 없어요" body="도움 요청에 신청하고 이웃과 활동해 보세요." action="요청 찾아보기" onAction={() => window.location.assign("/volunteer/requests")}/>}</div><SafetyNote/></div>;
}

function RewardsPage({ store, user, onRedeem }: { store: DemoStore; user: NonNullable<ReturnType<typeof userFor>>; onRedeem: (reward: (typeof REWARDS)[number]) => void }) {
  const points = pointsFor(store, user.id);
  const transactions = store.transactions.filter(tx => tx.volunteerId === user.id).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  return <div className="page-stack"><AppHeading eyebrow="HAND-IN-HAND REWARDS" title="손잡이 리워드" description="도움 확인 후 적립된 가상 포인트를 체험해 보세요."/><section className="points-card"><div><span>사용 가능한 포인트</span><strong>{formatPoints(points)}<small>P</small></strong><p>어르신이 활동을 확인하면 포인트가 적립돼요.</p></div><div className="points-graphic"><div className="point-orbit">P</div><Sparkles size={19}/></div><span className="demo-watermark-small">DEMO</span></section><div className="reward-warning"><ShieldCheck size={18}/><span>가상 리워드예요. 실제 제휴처·쿠폰이 아니며 실제 사용할 수 없습니다.</span></div><div className="section-title-row"><div><span className="eyebrow">IMAGINARY PERKS</span><h2>가상의 혜택 둘러보기</h2></div></div><div className="rewards-grid">{REWARDS.map(reward => <article className="reward-card" key={reward.id}><IconCircle tone={reward.id === "culture" ? "blue" : reward.id === "meal" ? "orange" : "green"}><reward.icon size={22}/></IconCircle><span className="virtual-label">가상 혜택</span><h3>{reward.title}</h3><p>{reward.description}</p><div className="reward-card-bottom"><b><Sparkles size={16}/>{formatPoints(reward.points)}P</b><button className="button button-soft" disabled={points < reward.points} onClick={() => onRedeem(reward)}>교환 체험하기</button></div></article>)}</div><div className="section-title-row"><div><span className="eyebrow">POINT HISTORY</span><h2>포인트 내역</h2></div></div><div className="transaction-list">{transactions.length ? transactions.map(transaction => <div className="transaction-row" key={transaction.id}><span className={cx("transaction-symbol", transaction.type)}>{transaction.type === "earn" ? <Plus size={17}/> : <ArrowDownLeft size={17}/>}</span><span><b>{transaction.title}</b><small>{dateLabel(transaction.createdAt, {year:"numeric",month:"short",day:"numeric"})}</small></span><strong className={transaction.type}>{transaction.type === "earn" ? "+" : "−"}{formatPoints(transaction.amount)}P</strong></div>) : <div className="empty-inline">확인된 활동이 생기면 포인트 내역이 이곳에 보여요.</div>}</div></div>;
}

function ActivityPage({ request, store, userId, role, onStart, onFinish, onConfirm, onCancel, onReport, onBack, connectedMode = false }: { request: HelpRequest; store: DemoStore; userId: string; role: string; onStart: (id:string)=>void; onFinish:(id:string,simulated:boolean)=>void; onConfirm:(id:string)=>void; onCancel:(id:string)=>void; onReport:(id:string)=>void; onBack:()=>void; connectedMode?: boolean }) {
  const senior = userFor(store, request.seniorId);
  const volunteer = userFor(store, request.matchedVolunteerId);
  const isSeniorOwner = role === "senior" && request.seniorId === userId;
  const isPartnerConfirmer = role === "partner" && request.createdById === userId && request.elderConsent === true;
  const isVolunteer = role === "volunteer" && request.matchedVolunteerId === userId;
  return <div className="page-stack narrow-page"><button className="back-link" onClick={onBack}><ArrowLeft size={17}/> 목록으로</button><div className="activity-heading"><div><span className="eyebrow">ACTIVITY DETAILS</span><h1>함께하는 활동</h1></div><StatusPill status={request.status}/></div><article className="activity-detail-card"><span className="category-tag"><Smartphone size={15}/>{request.category}</span><h2>{request.title}</h2><p>{request.description}</p><div className="detail-divider"/><dl className="detail-facts"><div><dt><CalendarDays size={17}/>희망 일정</dt><dd>{dateLabel(request.requestedDate)} · {request.requestedTime}</dd></div><div><dt><MapPin size={17}/>활동 지역</dt><dd>{request.neighborhood} · 복지관 등 공공장소</dd></div><div><dt><Clock3 size={17}/>예상 소요시간</dt><dd>약 {request.estimatedMinutes}분</dd></div><div><dt><Users size={17}/>참여자</dt><dd>{senior?.nickname ?? "어르신"}{volunteer ? ` · ${volunteer.nickname}` : " · 청년 기다리는 중"}</dd></div>{request.startedAt && <div><dt><CheckCircle2 size={17}/>활동 기록</dt><dd>시작 {timeLabel(request.startedAt)}{request.endedAt ? ` · 종료 ${timeLabel(request.endedAt)}` : ""}{request.durationMinutes ? ` · ${request.durationMinutes}분` : ""}</dd></div>}</dl>{request.simulated && <div className="simulation-banner"><Sparkles size={17}/><span><b>30분 데모 체험</b><small>발표 시연을 위한 가상 활동 기록입니다.</small></span></div>}
      {request.status === "open" && <div className="activity-state-box"><span className="state-icon"><Users size={21}/></span><div><b>함께할 청년을 기다리고 있어요</b><small>요청은 어르신이 일정 제안을 선택한 뒤 확정됩니다.</small></div></div>}
      {request.status === "awaiting_schedule" && <div className="activity-state-box waiting"><span className="state-icon"><CalendarDays size={21}/></span><div><b>일정 제안을 확인하고 있어요</b><small>어르신이 제안 시간 중 하나를 고르면 매칭됩니다.</small></div></div>}
      {request.status === "matched" && <div className="activity-state-box"><span className="state-icon"><HeartHandshake size={21}/></span><div><b>일정이 확정됐어요</b><small>{request.confirmedStartAt ? dateLabel(request.confirmedStartAt, {year:"numeric",month:"long",day:"numeric",weekday:"long",hour:"numeric",minute:"2-digit"}) : "공공장소에서 만나 활동을 시작해 주세요."}</small></div></div>}
      {request.status === "in_progress" && <div className="activity-state-box active"><span className="state-icon"><Clock3 size={21}/></span><div><b>활동 진행 중</b><small>활동이 끝나면 청년이 종료를 기록해요.</small></div></div>}
      {request.status === "awaiting_confirmation" && <div className="activity-state-box waiting"><span className="state-icon"><Bell size={21}/></span><div><b>어르신의 확인을 기다리고 있어요</b><small>완료 확인 후 활동 시간이 기록되고 청년에게 포인트가 적립돼요.</small></div></div>}
      {request.status === "completed" && <div className="activity-state-box success"><span className="state-icon"><CheckCircle2 size={21}/></span><div><b>활동 확인이 완료됐어요</b><small>{dateLabel(request.confirmedAt ?? request.createdAt)} · 서비스 내부 활동 기록</small></div></div>}
      {isVolunteer && request.status === "matched" && <div className="activity-buttons"><button className="button button-primary button-large full-width" onClick={() => onStart(request.id)}><Check size={19}/> 활동 시작</button></div>}
      {isVolunteer && request.status === "in_progress" && <div className="activity-buttons"><button className="button button-primary button-large full-width" onClick={() => onFinish(request.id,false)}><CheckCircle2 size={19}/> 활동 종료 기록</button>{!connectedMode && <><button className="button button-soft full-width" onClick={() => onFinish(request.id,true)}><Sparkles size={17}/> 발표용 30분 활동 체험 종료</button><small>체험 종료 버튼은 시연 전용이며 실제 활동을 기록하지 않습니다.</small></>}</div>}
      {(isSeniorOwner || isPartnerConfirmer) && request.status === "awaiting_confirmation" && <div className="confirm-section"><div className="confirm-question"><b>도움받으셨나요?</b><span>{isPartnerConfirmer ? "어르신의 사전 동의에 따른 기관 담당자 확인 경로입니다." : "진행한 활동과 시간을 확인하고 완료를 눌러 주세요."}</span></div><div className="confirm-preview"><span>함께한 청년</span><b>{volunteer?.nickname ?? "청년 봉사자"}</b><span>활동 소요시간</span><b>{request.durationMinutes ?? 0}분 {request.simulated && "· 시연용"}</b></div><button className="button button-primary button-large full-width" onClick={() => onConfirm(request.id)}><CheckCircle2 size={19}/> 도움받았어요 · 활동 확인</button><small>확인 후 청년에게 포인트가 한 번 적립됩니다.</small></div>}
      {role === "senior" && request.seniorId !== userId && request.status === "awaiting_confirmation" && <div className="activity-state-box"><span className="state-icon"><ShieldCheck size={21}/></span><div><b>요청자 계정으로 확인해 주세요</b><small>완료 확인은 이 요청을 등록한 어르신만 할 수 있어요.</small></div></div>}
      {(isSeniorOwner || isPartnerConfirmer) && ["open","awaiting_schedule","matched"].includes(request.status) && <button className="cancel-request-button" onClick={() => {if (window.confirm("이 도움 요청을 취소할까요?")) onCancel(request.id)}}>요청 취소</button>}
    </article><div className="activity-safety"><ShieldCheck size={19}/><p><b>안전을 먼저 생각해요</b><br/>정확한 집 주소와 연락처는 공개되지 않아요. 공공장소에서 만나고 불편하거나 위험한 상황이면 활동을 중단해 주세요.</p></div><button className="report-link" onClick={() => onReport(request.id)}>이 요청 신고하기</button></div>;
}

function AdminPage({ store, onOpen, onSwitchAccount, canPreview }: { store: DemoStore; onOpen: (id:string)=>void; onSwitchAccount: (id:string)=>void; canPreview: boolean }) {
  const statusCounts = (status: RequestStatus) => store.requests.filter(request => request.status === status).length;
  return <div className="page-stack"><AppHeading eyebrow="ADMIN DEMO · READ ONLY" title="운영 현황" description="시연용 데이터의 매칭과 활동 상태를 조회합니다." action={<span className="read-only-label"><ShieldCheck size={16}/>조회 전용</span>}/>
    {canPreview && <section className="admin-panel admin-preview-panel"><div className="section-title-row"><div><span className="eyebrow">ROLE PREVIEW</span><h2>역할별 화면 미리보기</h2></div></div><p>다른 역할의 화면 전환은 관리자 페이지에서 할 수 있어요.</p><div className="admin-preview-actions"><button onClick={() => onSwitchAccount("senior-kim")}><HandHeart size={18}/>어르신 화면 보기</button><button onClick={() => onSwitchAccount("volunteer-lee")}><HeartHandshake size={18}/>청년 화면 보기</button><button onClick={() => onSwitchAccount("partner-demo")}><Users size={18}/>기관 담당자 화면 보기</button></div></section>}
    <div className="metric-grid admin-metrics"><Metric label="전체 요청" value={store.requests.length} unit="건" icon={<MessageCircle size={17}/>}/><Metric label="매칭 대기" value={statusCounts("open")} unit="건" icon={<Users size={17}/>}/><Metric label="완료 확인 대기" value={statusCounts("awaiting_confirmation")} unit="건" icon={<Clock3 size={17}/>}/><Metric label="활동 완료" value={statusCounts("completed")} unit="건" icon={<CheckCircle2 size={17}/>}/></div>
    <div className="admin-panels"><section className="admin-panel"><div className="section-title-row"><div><span className="eyebrow">REQUEST STATUS</span><h2>도움 요청 현황</h2></div></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>요청 내용</th><th>지역</th><th>요청자</th><th>상태</th><th></th></tr></thead><tbody>{store.requests.map(request => <tr key={request.id}><td><b>{request.title}</b><small>{request.category}</small></td><td>{request.neighborhood}</td><td>{userFor(store,request.seniorId)?.nickname}</td><td><StatusPill status={request.status}/></td><td><button className="table-open" onClick={() => onOpen(request.id)}>보기 <ArrowRight size={15}/></button></td></tr>)}</tbody></table></div></section><section className="admin-panel"><div className="section-title-row"><div><span className="eyebrow">COMMUNITY</span><h2>데모 참여자</h2></div></div><div className="participant-list">{store.users.map(user => <div key={user.id}><span className={`avatar ${user.role}`}>{user.nickname.slice(0,1)}</span><span><b>{user.nickname}</b><small>{user.role === "senior" ? "어르신" : user.role === "volunteer" ? "청년 봉사자" : user.role === "partner" ? "기관 담당자" : "관리자"} · {user.neighborhood}</small></span><span className="demo-only-chip">가상 계정</span></div>)}</div></section><section className="admin-panel reports-panel"><div className="section-title-row"><div><span className="eyebrow">REPORTS</span><h2>신고 확인</h2></div><span className="soft-count">{store.reports.length}건</span></div>{store.reports.length ? store.reports.map(report => <div className="report-row" key={report.id}><b>{report.reason}</b><small>{dateLabel(report.createdAt)} · {report.status} · 활동 ID {report.requestId.slice(-8)}</small></div>) : <div className="empty-inline">접수된 신고가 없어요.</div>}</section></div><p className="read-only-note"><ShieldCheck size={16}/>관리자 계정은 데모 조회용입니다. 실제 운영 승인이나 실적 인증 권한이 없습니다.</p></div>;
}

function SafetyPage({ onBack }: { onBack:()=>void }) {
  return <div className="page-stack narrow-page"><button className="back-link" onClick={onBack}><ArrowLeft size={17}/> 돌아가기</button><AppHeading eyebrow="SAFETY FIRST" title="안전하게 손잡아요" description="서초손잡이는 안전한 일상 도움을 연결하는 시연용 서비스예요."/><div className="safety-guide-list"><article><ShieldCheck/><div><b>처음 만날 때는 공공장소에서</b><p>복지관, 주민센터 등 다른 사람이 함께 있는 곳을 이용해 주세요.</p></div></article><article><X/><div><b>금융·의료·전문 돌봄은 지원하지 않아요</b><p>돈을 대신 보내거나 비밀번호를 입력하는 일, 의료행위, 신체 부축은 요청할 수 없습니다.</p></div></article><article><MapPin/><div><b>개인정보는 꼭 필요한 만큼만</b><p>정확한 집 주소, 주민등록번호, 금융정보, 개인 연락처를 요청 내용에 적지 마세요.</p></div></article><article><Bell/><div><b>불편하거나 위험하면 바로 중단해요</b><p>필요하면 주변에 알리고, 긴급한 위험은 112 또는 119에 연락해 주세요.</p></div></article><article><FileText/><div><b>포인트와 활동 시간은 데모 기록</b><p>1365 연동이나 공식 봉사시간 인정이 되지 않으며, 리워드는 실제 쿠폰이 아닙니다.</p></div></article></div><button className="button button-primary button-large" onClick={onBack}>확인했어요</button></div>;
}

function SafetyNote() {
  return <div className="safety-note"><ShieldCheck size={18}/><span>활동은 복지관 등 공공장소에서 만나요. 금융·의료·비밀번호 관련 도움은 지원하지 않아요.</span><a href="/safety">안전 안내</a></div>;
}

function EmptyCard({ title, body, action, onAction }: { title:string; body:string; action:string; onAction:()=>void }) {
  return <div className="empty-card"><span className="empty-card-icon"><HandHeart size={26}/></span><h3>{title}</h3><p>{body}</p><button className="button button-outline" onClick={onAction}>{action} <ArrowRight size={16}/></button></div>;
}

function EmptyPage({ title, body, action, onAction }: { title:string; body:string; action:string; onAction:()=>void }) {
  return <div className="page-stack"><EmptyCard title={title} body={body} action={action} onAction={onAction}/></div>;
}

function MobileNav({ role, pathname, onNavigate }: { role:string; pathname:string; onNavigate:(path:string)=>void }) {
  const links = role === "senior" ? seniorLinks : role === "volunteer" ? volunteerLinks : role === "admin" ? [["/admin","운영 현황",ShieldCheck]] as const : partnerLinks;
  return <nav className="mobile-nav" aria-label="빠른 메뉴">{links.slice(0,4).map(([href,title,Icon]) => <button key={href} className={cx(pathname === href && "active")} onClick={() => onNavigate(href)}><Icon size={20}/><span>{title}</span></button>)}</nav>;
}

function downloadCertificate(request: HelpRequest, nickname: string) {
  void (async () => {
    try {
      const { jsPDF } = await import("jspdf");
      const canvas = document.createElement("canvas");
      canvas.width = 1275;
      canvas.height = 1800;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas unavailable");
      context.fillStyle = "#fffdf8"; context.fillRect(0,0,canvas.width,canvas.height);
      context.strokeStyle = "#d8e0d4"; context.lineWidth = 4; context.strokeRect(72,72,canvas.width-144,canvas.height-144);
      context.strokeStyle = "#e8c49d"; context.lineWidth = 2; context.strokeRect(96,96,canvas.width-192,canvas.height-192);
      context.textAlign = "center";
      context.font = "700 38px 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"; context.fillStyle = "#a65332"; context.fillText("해커톤 시연용 · 공식 인증서 아님", canvas.width/2, 180);
      context.save(); context.translate(canvas.width/2, canvas.height/2+40); context.rotate(-Math.PI/5); context.font = "900 205px Arial, sans-serif"; context.fillStyle = "rgba(193, 102, 63, 0.11)"; context.fillText("DEMO",0,0); context.restore();
      context.fillStyle="#245943"; context.font="800 54px 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"; context.fillText("서초손잡이 봉사활동 참여 확인서",canvas.width/2,330);
      context.fillStyle="#65756a"; context.font="400 27px 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"; context.fillText("Seocho Hand-in-Hand · Activity Record",canvas.width/2,385);
      context.strokeStyle="#dfe7dc"; context.beginPath(); context.moveTo(170,435); context.lineTo(canvas.width-170,435); context.stroke();
      const values = [["참여자",nickname],["활동 날짜",dateLabel(request.confirmedAt ?? request.requestedDate,{year:"numeric",month:"long",day:"numeric"})],["활동 내용",request.title],["도움 유형",request.category],["활동 지역",request.neighborhood],["활동 시간",`${request.durationMinutes ?? 0}분 · 서비스 내부 기록`],["서비스 내부 확인 여부","어르신 확인 완료"],["문서 발급 일자",dateLabel(new Date().toISOString(),{year:"numeric",month:"long",day:"numeric"})],["활동 기록 ID",request.id]];
      let y=530;
      for (const [label,value] of values) {
        context.textAlign="left"; context.font="700 25px 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"; context.fillStyle="#68796b"; context.fillText(label,175,y);
        context.font="600 28px 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"; context.fillStyle="#26392e";
        const lines = wrapCanvasText(context,value,760);
        lines.forEach((line,index) => context.fillText(line,450,y+index*42));
        y += Math.max(84,lines.length*44);
      }
      context.textAlign="center"; context.fillStyle="#fff3e8"; context.beginPath(); context.roundRect(190,1300,canvas.width-380,116,18); context.fill();
      context.fillStyle="#a65332"; context.font="800 38px Arial,sans-serif"; context.fillText("DEMO",canvas.width/2,1375);
      context.fillStyle="#5e6a60"; context.font="400 22px 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
      const disclaimer="본 문서는 서초손잡이에서 생성한 시연용 활동 기록입니다. 1365 자원봉사포털에서 발급한 공식 봉사실적확인서가 아니며 공식 봉사시간 증빙으로 사용할 수 없습니다.";
      wrapCanvasText(context,disclaimer,canvas.width-320).forEach((line,index)=>context.fillText(line,canvas.width/2,1505+index*39));
      context.fillStyle="#8b958c"; context.font="400 19px 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"; context.fillText("서초손잡이 해커톤 MVP · 가상 활동 데이터",canvas.width/2,1680);
      const pdf = new jsPDF({orientation:"portrait",unit:"mm",format:"a4",compress:true});
      pdf.addImage(canvas.toDataURL("image/jpeg",0.94),"JPEG",0,0,210,297,undefined,"FAST");
      pdf.save(`seocho-sonjabi-demo-${request.id}.pdf`);
    } catch {
      window.alert("확인서를 만들지 못했어요. 브라우저에서 다시 시도해 주세요.");
    }
  })();
}

function wrapCanvasText(context: CanvasRenderingContext2D, value: string, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const char of value) {
    const next = line + char;
    if (context.measureText(next).width > maxWidth && line) { lines.push(line); line = char; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
