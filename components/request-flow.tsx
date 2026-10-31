"use client";

import {
  ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, Clock3, HandHeart,
  MapPin, MessageCircle, Mic, MicOff, Play, RotateCcw, ShieldCheck, Sparkles,
  StopCircle, Volume2,
} from "lucide-react";
import {
  useConversation, useConversationClientTool, useConversationControls,
  useConversationMode, useConversationStatus,
} from "@elevenlabs/react";
import { useState } from "react";
import type { ReactNode } from "react";
import { z } from "zod";
import { CATEGORIES, HelpRequestDraft, NEIGHBORHOODS, statusLabel } from "@/lib/demo-data";

const datePreferences = [
  ["earliest", "가장 빠른 날"], ["this_week", "이번 주 안에"],
  ["next_week", "다음 주에"], ["flexible", "언제든 괜찮아요"], ["specific", "날짜 직접 선택"],
] as const;
const timeWindows = [["morning", "오전 (9시~12시)"], ["afternoon", "오후 (12시~6시)"], ["evening", "저녁 (6시~9시)"], ["flexible", "시간 상관없어요"]] as const;
const areas = ["서초동", "반포동", "방배동", "양재동", "내곡동", "잠원동"];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}, "날짜 형식이 올바르지 않습니다.");
const patchSchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  detail: z.string().trim().min(5).max(240).optional(),
  datePreference: z.enum(["earliest", "this_week", "next_week", "specific", "flexible"]).optional(),
  specificDate: isoDate.nullable().optional(),
  timeWindow: z.enum(["morning", "afternoon", "evening", "flexible"]).optional(),
  neighborhood: z.enum(NEIGHBORHOODS).optional(),
}).strict();
type VoiceTools = {
  updateHelpRequestDraft: (parameters: Record<string, unknown>) => Promise<string>;
  showRequestSummary: (parameters: Record<string, unknown>) => Promise<string>;
  getCurrentDraft: (parameters: Record<string, unknown>) => Promise<string>;
  requestManualInput: (parameters: Record<string, unknown>) => Promise<string>;
};

function todayInSeoul() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function nextTuesday() {
  const now = new Date(`${todayInSeoul()}T00:00:00+09:00`);
  const days = (2 - now.getDay() + 7) % 7 + 7;
  now.setDate(now.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
function dateText(value?: string | null) {
  if (!value) return "날짜 미정";
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "long" }).format(new Date(`${value}T00:00:00+09:00`));
}
function preferenceText(value?: string) { return datePreferences.find(([key]) => key === value)?.[1] ?? "선택하지 않았어요"; }
function timeText(value?: string) { return timeWindows.find(([key]) => key === value)?.[1] ?? "선택하지 않았어요"; }
function addIsoDays(value: string, days: number) { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function scheduleBounds(preference?: HelpRequestDraft["datePreference"], specificDate?: string | null) {
  const today = todayInSeoul();
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const sunday = addIsoDays(today, weekday === 0 ? 0 : 7 - weekday);
  const nextMonday = addIsoDays(today, weekday === 0 ? 1 : 8 - weekday);
  if (preference === "specific" && specificDate) return { min: specificDate, max: specificDate };
  if (preference === "this_week") return { min: today, max: sunday };
  if (preference === "next_week") return { min: nextMonday, max: addIsoDays(nextMonday, 6) };
  return { min: today, max: undefined };
}

export function SeniorManualWizard({ draft, onChange, onReview, onBack }: {
  draft: HelpRequestDraft; onChange: (patch: HelpRequestDraft) => void; onReview: () => void; onBack: () => void;
}) {
  const [step, setStep] = useState(0);
  const [otherDetail, setOtherDetail] = useState(draft.detail ?? "");
  const selectedCategory = draft.category ?? "";
  const isOther = selectedCategory === "기타 생활 도움";
  const details: Record<string, string[]> = {
    "스마트폰 사용 도움": ["사진 보내는 방법 배우기", "문자 보내기", "글자 크게 하기", "다른 기능 배우기"],
    "키오스크 이용 연습": ["음식 주문 연습", "병원 접수 연습", "기차표 예매 연습", "다른 키오스크 연습"],
    "공공장소 이동·길 안내": ["복지관 안에서 길 찾기", "공공시설 이용 안내", "동네 길 안내", "다른 장소 안내"],
    "기타 생활 도움": ["복지관 프로그램 찾기", "공공기관 홈페이지 보기", "가벼운 물품 함께 옮기기", "직접 적을게요"],
  };
  const currentDetails = details[selectedCategory] ?? ["천천히 같이 배우기", "사용 방법 알아보기", "다른 내용" ];
  const [showCustomInput, setShowCustomInput] = useState(isOther || Boolean(draft.detail && !currentDetails.includes(draft.detail)));
  const progress = <div className="request-flow-progress" aria-label={`${step + 1}단계, 전체 5단계`}><span style={{ width: `${(step + 1) * 20}%` }} /></div>;
  function chooseDetail(value: string) {
    if (value === "직접 적을게요" || value.startsWith("다른 ")) { setShowCustomInput(true); setOtherDetail(""); onChange({ detail: "" }); }
    else { setShowCustomInput(false); setOtherDetail(value); onChange({ detail: value }); }
  }
  return <div className="senior-flow page-stack narrow-page">
    <button className="back-link" onClick={step ? () => setStep(step - 1) : onBack}><ArrowLeft size={18}/> {step ? "이전" : "어르신 홈"}</button>
    {progress}<p className="senior-step-count">{step + 1} / 5</p>
    {step === 0 && <section className="senior-step"><span className="eyebrow">도움 종류</span><h1>어떤 도움이 필요하세요?</h1><p>가장 가까운 항목을 눌러 주세요.</p><div className="senior-choice-grid">{[["스마트폰 사용 도움", "휴대폰 도움", "📱"], ["키오스크 이용 연습", "키오스크 도움", "🖥️"], ["공공장소 이동·길 안내", "길 안내", "🧭"], ["기타 생활 도움", "다른 도움", "🤝"]].map(([value, label, icon]) => <button key={value} className={`senior-choice ${selectedCategory === value ? "selected" : ""}`} onClick={() => { onChange({ category: value, detail: "" }); setOtherDetail(""); setShowCustomInput(value === "기타 생활 도움"); setStep(1); }}><span>{icon}</span><b>{label}</b><ArrowRight size={20}/></button>)}</div></section>}
    {step === 1 && <section className="senior-step"><span className="eyebrow">자세한 내용</span><h1>무엇을 같이 해볼까요?</h1><p>원하는 내용을 하나 골라 주세요.</p><div className="senior-option-list">{currentDetails.map((item) => <button key={item} className={`senior-option ${draft.detail === item ? "selected" : ""}`} onClick={() => chooseDetail(item)}>{item}{draft.detail === item && <CheckCircle2 size={20}/>}</button>)}</div>{showCustomInput && <label className="senior-free-text"><span>다른 내용 적기</span><input className="form-input" value={otherDetail} maxLength={240} onChange={(event) => { setOtherDetail(event.target.value); onChange({ detail: event.target.value }); }} placeholder="예: 휴대폰으로 사진을 보내고 싶어요"/></label>}<button className="button button-primary button-large full-width" disabled={(draft.detail ?? "").trim().length < 5} onClick={() => setStep(2)}>다음 <ArrowRight size={20}/></button></section>}
    {step === 2 && <section className="senior-step"><span className="eyebrow">희망 날짜</span><h1>언제가 편하세요?</h1><p>정확한 만남 시간은 청년과 함께 정해요.</p><div className="senior-option-list">{datePreferences.map(([key, label]) => <button key={key} className={`senior-option ${draft.datePreference === key ? "selected" : ""}`} onClick={() => onChange({ datePreference: key })}>{label}{draft.datePreference === key && <CheckCircle2 size={20}/>}</button>)}</div>{draft.datePreference === "specific" && <label className="senior-free-text"><span>원하시는 날짜</span><input className="form-input" type="date" min={todayInSeoul()} value={draft.specificDate ?? ""} onChange={(event) => onChange({ specificDate: event.target.value || null })}/></label>}<button className="button button-primary button-large full-width" disabled={!draft.datePreference || (draft.datePreference === "specific" && !draft.specificDate)} onClick={() => setStep(3)}>다음 <ArrowRight size={20}/></button></section>}
    {step === 3 && <section className="senior-step"><span className="eyebrow">희망 시간대</span><h1>몇 시쯤이 좋으세요?</h1><p>편한 시간대를 골라 주세요.</p><div className="senior-option-list">{timeWindows.map(([key, label]) => <button key={key} className={`senior-option ${draft.timeWindow === key ? "selected" : ""}`} onClick={() => onChange({ timeWindow: key })}>{label}{draft.timeWindow === key && <CheckCircle2 size={20}/>}</button>)}</div><button className="button button-primary button-large full-width" disabled={!draft.timeWindow} onClick={() => setStep(4)}>다음 <ArrowRight size={20}/></button></section>}
    {step === 4 && <section className="senior-step"><span className="eyebrow">활동 지역</span><h1>어느 동네가 편하세요?</h1><p>정확한 집 주소는 공개하지 않아요.</p><div className="senior-area-grid">{areas.map((area) => <button key={area} className={`senior-area ${draft.neighborhood === area ? "selected" : ""}`} onClick={() => onChange({ neighborhood: area })}>{area}{draft.neighborhood === area && <Check size={17}/>}</button>)}</div><div className="public-place-note"><MapPin size={19}/><span><b>처음 만남은 복지관 등 공공장소를 권해요.</b><small>구체적인 장소와 일정은 매칭 후 함께 정해요.</small></span></div><button className="button button-primary button-large full-width" disabled={!draft.neighborhood} onClick={onReview}>내용 확인하기 <ArrowRight size={20}/></button></section>}
  </div>;
}

export function RequestReview({ draft, onEdit, onSubmit, onBack, submitting = false }: {
  draft: HelpRequestDraft; onEdit: () => void; onSubmit: () => void; onBack: () => void; submitting?: boolean;
}) {
  const complete = Boolean(draft.category && (draft.detail ?? "").trim().length >= 5 && draft.datePreference && draft.timeWindow && draft.neighborhood && (draft.datePreference !== "specific" || draft.specificDate));
  return <div className="senior-flow page-stack narrow-page"><button className="back-link" onClick={onBack}><ArrowLeft size={18}/> 돌아가기</button><section className="senior-step review-step"><span className="eyebrow">마지막 확인</span><h1>이렇게 도움을 요청할까요?</h1><p>내용이 맞으면 큰 버튼을 눌러 주세요.</p><div className="request-review-card"><ReviewRow icon={<HandHeart/>} label="필요한 도움" value={draft.category ?? "선택하지 않았어요"}/><ReviewRow icon={<MessageCircle/>} label="자세한 내용" value={draft.detail ?? "선택하지 않았어요"}/><ReviewRow icon={<CalendarDays/>} label="희망 날짜" value={draft.datePreference === "specific" ? dateText(draft.specificDate) : preferenceText(draft.datePreference)}/><ReviewRow icon={<Clock3/>} label="희망 시간" value={timeText(draft.timeWindow)}/><ReviewRow icon={<MapPin/>} label="활동 지역" value={draft.neighborhood ?? "선택하지 않았어요"}/></div><p className="public-place-note"><ShieldCheck size={19}/>정확한 주소나 전화번호는 요청에 포함되지 않아요.</p><button className="button button-primary button-large full-width" disabled={!complete || submitting} onClick={onSubmit}>{submitting ? "요청을 등록하고 있어요…" : "이대로 요청하기"}<ArrowRight size={21}/></button><button className="button button-outline button-large full-width" onClick={onEdit} disabled={submitting}>내용 수정하기</button></section></div>;
}
function ReviewRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="request-review-row"><span className="review-icon">{icon}</span><span><small>{label}</small><b>{value}</b></span></div>;
}

function ConversationControls() {
  const { status, message } = useConversationStatus();
  const { isSpeaking, isListening } = useConversationMode();
  return <div className="voice-status" aria-live="polite"><span className={`voice-status-dot ${status}`} />{status === "connecting" ? "AI와 연결하고 있어요" : status === "connected" ? isSpeaking ? "AI가 이야기하고 있어요" : isListening ? "말씀을 듣고 있어요" : "대화 중이에요" : status === "error" ? message || "연결을 확인해 주세요" : "음성 AI 연결 전"}</div>;
}

export function SeniorVoiceRequest({ draft, onChange, onReview, onManual, configured, agentLabel }: {
  draft: HelpRequestDraft; onChange: (patch: HelpRequestDraft) => void; onReview: () => void; onManual: () => void; configured: boolean; agentLabel: string;
}) {
  const [transcript, setTranscript] = useState<{ role: string; message: string }[]>([]);
  const [feedback, setFeedback] = useState("");
  const [demoRunning, setDemoRunning] = useState(false);
  const [micConsent, setMicConsent] = useState(false);
  const controls = useConversationControls();
  const status = useConversationStatus();
  const { isSpeaking, isListening } = useConversationMode();
  useConversation({ onMessage: ({ message, source }) => setTranscript((lines) => [...lines.slice(-7), { role: source === "user" ? "말씀" : "서초손잡이 AI", message }]) });

  useConversationClientTool<VoiceTools>("updateHelpRequestDraft", async (parameters) => {
    const parsed = patchSchema.safeParse(parameters);
    if (!parsed.success) return JSON.stringify({ ok: false, error: "입력 형식이나 값이 올바르지 않습니다. 확인되지 않은 값은 넣지 말고 한 가지만 다시 질문해 주세요." });
    onChange(parsed.data);
    return JSON.stringify({ ok: true, updated: Object.keys(parsed.data), note: "전달되지 않은 기존 값은 유지했습니다." });
  });
  useConversationClientTool<VoiceTools>("getCurrentDraft", async () => JSON.stringify(draft));
  useConversationClientTool<VoiceTools>("showRequestSummary", async () => {
    const complete = Boolean(draft.category && draft.detail && draft.detail.trim().length >= 5 && draft.datePreference && draft.timeWindow && draft.neighborhood && (draft.datePreference !== "specific" || draft.specificDate));
    if (!complete) return JSON.stringify({ ok: false, missing: [!draft.category && "도움 종류", !draft.detail && "자세한 내용", !draft.datePreference && "희망 날짜", !draft.timeWindow && "희망 시간대", !draft.neighborhood && "활동 지역"].filter(Boolean), note: "초안을 제출하지 않았습니다. 빠진 항목을 한 번에 하나씩 물어보세요." });
    onReview();
    return JSON.stringify({ ok: true, message: "화면에 최종 확인 초안을 표시했습니다. 어르신이 직접 요청 버튼을 눌러야 등록됩니다." });
  });
  useConversationClientTool<VoiceTools>("requestManualInput", async () => { onManual(); return "버튼으로 고르는 화면으로 이동합니다. 지금까지 작성한 초안은 유지됩니다."; });

  async function beginConversation() {
    setFeedback("");
    if (!micConsent) { setFeedback("먼저 마이크 사용과 ElevenLabs 음성 대화 전송 안내를 확인해 주세요."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      const response = await fetch("/api/elevenlabs/token", { method: "POST" });
      const body = await response.json();
      if (!response.ok || typeof body.token !== "string") throw new Error(body.error ?? "음성 연결 준비가 되지 않았어요.");
      await controls.startSession({ conversationToken: body.token });
      controls.sendContextualUpdate(`현재 날짜는 한국 시간(Asia/Seoul) 기준 ${todayInSeoul()}입니다. 상대 날짜는 이 기준으로 해석하되 불분명하면 어르신에게 확인하세요. 현재 요청 초안: ${JSON.stringify(draft)}`);
      setFeedback("서초손잡이 AI와 연결됐어요.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "음성 연결에 실패했어요.");
    }
  }

  async function runDemoConversation() {
    setDemoRunning(true);
    setFeedback("시뮬레이션 대화입니다. 실제 AI 음성 연결은 사용하지 않아요.");
    const date = nextTuesday();
    const turns: { role: string; message: string; patch?: HelpRequestDraft }[] = [
      { role: "서초손잡이 AI · 시뮬레이션", message: "안녕하세요. 어떤 도움이 필요하세요?" },
      { role: "말씀 · 시뮬레이션", message: "휴대폰으로 딸한테 사진 보내는 법을 배우고 싶어요.", patch: { category: "스마트폰 사용 도움", detail: "휴대폰으로 사진을 보내는 방법 배우기" } },
      { role: "서초손잡이 AI · 시뮬레이션", message: "좋아요. 언제가 편하세요?" },
      { role: "말씀 · 시뮬레이션", message: "다음 주 화요일 오후가 좋아요.", patch: { datePreference: "specific", specificDate: date, timeWindow: "afternoon" } },
      { role: "서초손잡이 AI · 시뮬레이션", message: "어느 동네에서 도움받고 싶으세요?" },
      { role: "말씀 · 시뮬레이션", message: "방배동이에요.", patch: { neighborhood: "방배동" } },
      { role: "서초손잡이 AI · 시뮬레이션", message: "말씀하신 내용으로 신청서를 만들었어요. 아래에서 확인해 주세요." },
    ];
    for (const turn of turns) {
      await new Promise((resolve) => window.setTimeout(resolve, 550));
      if (turn.patch) onChange(turn.patch);
      setTranscript((current) => [...current.slice(-7), { role: turn.role, message: turn.message }]);
    }
    setDemoRunning(false);
    onReview();
  }

  const connected = status.status === "connected";
  const draftComplete = Boolean(draft.category && draft.detail && draft.detail.trim().length >= 5 && draft.datePreference && draft.timeWindow && draft.neighborhood && (draft.datePreference !== "specific" || draft.specificDate));
  return <div className="senior-flow page-stack narrow-page">
    <button className="back-link" onClick={onManual}><ArrowLeft size={18}/> 버튼으로 신청하기</button>
    <section className="voice-panel"><span className="eyebrow">말로 요청하기</span><h1>편하게 말씀해 주세요</h1><p>마이크는 대화 중에만 사용합니다. 음성 원본은 이 앱에 저장하지 않아요.</p>
      <ConversationControls />
      <div className="voice-mic-wrap"><button className={`voice-mic ${connected ? "active" : ""}`} aria-label={connected ? "음성 대화 종료" : "음성 대화 시작"} disabled={!configured && !connected} onClick={() => connected ? void controls.endSession() : void beginConversation()}>{connected ? <StopCircle size={38}/> : configured ? <Mic size={40}/> : <MicOff size={40}/>}</button><b>{connected ? isSpeaking ? "AI가 말하는 중" : isListening ? "듣고 있어요" : "대화 중" : configured ? "눌러서 AI 대화 시작" : "실시간 음성 AI 미연결"}</b></div>
      {configured ? <><p className="voice-connection-note">ElevenLabs Agent가 설정되어 있어요{agentLabel ? ` · ${agentLabel}` : ""}. 음성은 대화 처리를 위해 ElevenLabs에 전송되며, 이 앱에는 음성 원본을 저장하지 않아요.</p><label className="consent-check"><input type="checkbox" checked={micConsent} onChange={(event) => setMicConsent(event.target.checked)}/><span>위 안내를 읽었고, 이 대화 중 마이크 사용과 음성 처리에 동의합니다.</span></label></> : <div className="voice-demo-notice"><Sparkles size={18}/><span><b>실시간 ElevenLabs 연결 전</b><small>환경변수에 Agent와 서버 키를 설정하면 실시간 음성 대화를 사용할 수 있어요.</small></span></div>}
      {feedback && <p className="voice-feedback" role="status">{feedback}</p>}
      <div className="voice-transcript" aria-live="polite"><div className="voice-transcript-heading"><b>대화 내용</b>{connected && <span><span className="voice-pulse"/> 실시간</span>}</div>{transcript.length ? transcript.map((line, index) => <p key={`${index}-${line.role}`}><b>{line.role}</b><span>{line.message}</span></p>) : <p className="voice-empty">대화가 시작되면 여기에 표시돼요.</p>}</div>
    </section>
    <section className="voice-draft"><div><span className="eyebrow">작성 중인 초안</span><h2>도움 요청 내용</h2></div><div className="voice-draft-grid">{[["도움 종류", draft.category], ["자세한 내용", draft.detail], ["희망 날짜", draft.datePreference === "specific" ? dateText(draft.specificDate) : preferenceText(draft.datePreference)], ["희망 시간", timeText(draft.timeWindow)], ["활동 지역", draft.neighborhood]].map(([label, value]) => <div key={label}><small>{label}</small><b>{value || "아직 듣지 못했어요"}</b></div>)}</div></section>
    <div className="voice-actions">{configured ? <button className="button button-primary button-large" onClick={() => void beginConversation()} disabled={!micConsent || connected || status.status === "connecting"}><Mic size={20}/> {status.status === "connecting" ? "연결 중…" : "음성 대화 시작"}</button> : <button className="button button-primary button-large" disabled={demoRunning} onClick={() => void runDemoConversation()}><Play size={19}/>{demoRunning ? "대화 시뮬레이션 중…" : "데모 대화 시뮬레이션"}</button>}{connected && <button className="button button-outline button-large" onClick={() => void controls.endSession()}><StopCircle size={19}/> 대화 종료</button>}{draftComplete && <button className="button button-primary button-large" onClick={onReview}><CheckCircle2 size={20}/> 작성 내용 확인하기</button>}<button className="button button-soft button-large" onClick={onManual}><MessageCircle size={19}/> 버튼으로 입력하기</button>{transcript.length > 0 && <button className="button button-quiet" onClick={() => setTranscript([])}><RotateCcw size={16}/> 대화 표시 지우기</button>}</div>
    <p className="voice-privacy"><ShieldCheck size={17}/>대화 원본은 저장하지 않습니다. 요청서 초안은 최종 확인 전에 언제든 수정할 수 있어요.</p>
  </div>;
}

export function PartnerRequestForm({ seniors, partnerName, onSubmit, onBack }: {
  seniors: { id: string; nickname: string }[]; partnerName: string; onSubmit: (values: HelpRequestDraft & { seniorId: string; consent: boolean }) => void; onBack: () => void;
}) {
  const [values, setValues] = useState<HelpRequestDraft & { seniorId: string; consent: boolean }>({ category: CATEGORIES[0], detail: "", datePreference: "flexible", timeWindow: "flexible", neighborhood: "방배동", seniorId: seniors[0]?.id ?? "", consent: false });
  function update(patch: Partial<typeof values>) { setValues((current) => ({ ...current, ...patch })); }
  return <div className="page-stack narrow-page"><button className="back-link" onClick={onBack}><ArrowLeft size={17}/> 기관 대시보드</button><header className="page-heading"><span className="eyebrow">가상 기관 · {partnerName}</span><h1>어르신 대신 요청 등록</h1><p>데모용 기관 담당자 화면입니다. 실제 제휴 기관이 아닙니다.</p></header><div className="partner-form-card">
    <label><span className="field-label">요청하실 어르신</span><select className="form-input" value={values.seniorId} onChange={(event) => update({ seniorId: event.target.value })}>{seniors.map((person) => <option key={person.id} value={person.id}>{person.nickname}</option>)}</select></label>
    <label><span className="field-label">도움 종류</span><select className="form-input" value={values.category} onChange={(event) => update({ category: event.target.value })}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
    <label><span className="field-label">도움 내용</span><textarea className="form-input" rows={4} maxLength={240} value={values.detail} onChange={(event) => update({ detail: event.target.value })} placeholder="어르신과 확인한 요청 내용을 적어 주세요."/></label>
    <div className="form-two-col"><label><span className="field-label">희망 날짜</span><select className="form-input" value={values.datePreference} onChange={(event) => update({ datePreference: event.target.value as HelpRequestDraft["datePreference"] })}>{datePreferences.map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>{values.datePreference === "specific" && <label><span className="field-label">날짜</span><input className="form-input" type="date" min={todayInSeoul()} value={values.specificDate ?? ""} onChange={(event) => update({ specificDate: event.target.value || null })}/></label>}<label><span className="field-label">시간대</span><select className="form-input" value={values.timeWindow} onChange={(event) => update({ timeWindow: event.target.value as HelpRequestDraft["timeWindow"] })}>{timeWindows.map(([key,label]) => <option value={key} key={key}>{label}</option>)}</select></label><label><span className="field-label">활동 지역</span><select className="form-input" value={values.neighborhood} onChange={(event) => update({ neighborhood: event.target.value })}>{areas.map((area) => <option key={area}>{area}</option>)}</select></label></div>
    <label className="consent-check"><input type="checkbox" checked={values.consent} onChange={(event) => update({ consent: event.target.checked })}/><span>어르신에게 대리 요청 등록 내용을 설명했고, 게시와 일정 조율에 동의하셨습니다.</span></label>
    <button className="button button-primary button-large full-width" disabled={!values.seniorId || (values.detail ?? "").trim().length < 5 || !values.consent || (values.datePreference === "specific" && !values.specificDate)} onClick={() => onSubmit(values)}>동의 확인 후 요청 등록 <ArrowRight size={18}/></button>
  </div></div>;
}

export function ProposalForm({ title, neighborhood, datePreference, specificDate, timeWindow, onBack, onSubmit }: {
  title: string; neighborhood: string; datePreference?: HelpRequestDraft["datePreference"]; specificDate?: string | null; timeWindow?: HelpRequestDraft["timeWindow"]; onBack: () => void; onSubmit: (values: { startsAt: string; endsAt: string }[]) => void;
}) {
  const preferredHour = timeWindow === "morning" ? "10:00" : timeWindow === "evening" ? "19:00" : timeWindow === "flexible" ? "14:00" : "14:00";
  const bounds = scheduleBounds(datePreference, specificDate);
  const [choices, setChoices] = useState([{ date: specificDate && specificDate >= todayInSeoul() ? specificDate : datePreference === "next_week" ? bounds.min : "", time: preferredHour }]);
  const [error, setError] = useState("");
  const times = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"].filter((time) => timeWindow === "morning" ? time < "12:00" : timeWindow === "afternoon" ? time >= "12:00" && time < "18:00" : timeWindow === "evening" ? time >= "18:00" : true);
  function addChoice() { if (choices.length < 2) setChoices((current) => [...current, { date: "", time: preferredHour }]); }
  function submit() {
    if (choices.some((choice) => !choice.date || choice.date < bounds.min || (bounds.max && choice.date > bounds.max) || new Date(`${choice.date}T${choice.time}:00+09:00`) <= new Date())) { setError("희망 날짜 범위 안의 미래 시간을 골라 주세요."); return; }
    setError("");
    onSubmit(choices.map(({ date, time }) => { const start = new Date(`${date}T${time}:00+09:00`); return { startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 30 * 60000).toISOString() }; }));
  }
  return <div className="page-stack narrow-page"><button className="back-link" onClick={onBack}><ArrowLeft size={17}/> 요청 목록</button><header className="page-heading"><span className="eyebrow">일정 제안</span><h1>가능한 시간을 골라 주세요</h1><p>{title}</p></header><div className="proposal-form-card"><p className="proposal-preference"><CalendarDays size={17}/>{preferenceText(datePreference)} · {timeText(timeWindow)} 희망 · {neighborhood}</p>{choices.map((choice, index) => <div className="proposal-choice" key={index}><b>제안 {index + 1}</b><label><span className="field-label">날짜</span><input type="date" className="form-input" min={bounds.min} max={bounds.max} value={choice.date} onChange={(event) => setChoices((current) => current.map((item, i) => i === index ? { ...item, date: event.target.value } : item))}/></label><label><span className="field-label">시작 시간</span><select className="form-input" value={choice.time} onChange={(event) => setChoices((current) => current.map((item, i) => i === index ? { ...item, time: event.target.value } : item))}>{times.map((time) => <option key={time}>{time}</option>)}</select></label></div>)}<p className="field-hint">활동 예상 시간 30분으로 표시합니다. 어르신이 희망한 기간과 시간대를 먼저 고려해 주세요.</p>{error && <p className="voice-feedback" role="alert">{error}</p>}{choices.length < 2 && <button className="button button-outline" onClick={addChoice}>다른 시간도 제안하기</button>}<button className="button button-primary button-large full-width" disabled={choices.some((choice) => !choice.date)} onClick={submit}>일정 제안 보내기 <ArrowRight size={18}/></button></div></div>;
}

export function PartnerDashboard({ partnerName, requests, store, proposals, onNewRequest, onOpen, onConfirm, onRespond }: {
  partnerName: string; requests: import("@/lib/demo-data").HelpRequest[]; store: import("@/lib/demo-data").DemoStore; proposals: import("@/lib/demo-data").ScheduleProposal[]; onNewRequest: () => void; onOpen: (id: string) => void; onConfirm: (id: string) => void; onRespond: (proposalId: string, accept: boolean) => void;
}) {
  const awaiting = requests.filter((request) => request.status === "awaiting_confirmation").length;
  return <div className="page-stack"><section className="welcome-panel partner-welcome"><div><span className="eyebrow">가상 기관 담당자 · DEMO</span><h1>{partnerName}<br/><em>함께 돌봄을 이어가요.</em></h1><p>어르신 동의를 확인한 시연용 요청만 관리합니다.</p><button className="button button-primary button-large" onClick={onNewRequest}>어르신 요청 대신 등록 <ArrowRight size={18}/></button></div><div className="welcome-art"><HandHeart size={64}/></div></section><div className="metric-grid partner-metrics"><div className="metric-card"><div className="metric-top">등록한 요청</div><strong>{requests.length}<small>건</small></strong></div><div className="metric-card"><div className="metric-top">일정 확인 대기</div><strong>{requests.filter((request) => request.status === "awaiting_schedule").length}<small>건</small></strong></div><div className="metric-card"><div className="metric-top">완료 확인 대기</div><strong>{awaiting}<small>건</small></strong></div><div className="metric-card"><div className="metric-top">완료한 활동</div><strong>{requests.filter((request) => request.status === "completed").length}<small>건</small></strong></div></div><ScheduleProposalsPanel requests={requests} proposals={proposals} store={store} onRespond={onRespond} onOpen={onOpen}/><div className="section-title-row"><div><span className="eyebrow">DELEGATED REQUESTS</span><h2>대리 등록 및 활동 현황</h2></div><span className="soft-count">{requests.length}건</span></div>{requests.length ? <div className="request-grid">{requests.map((request) => <article className="request-card" key={request.id}><div className="request-card-top"><span className="category-tag">{request.category}</span><span className={`status-pill status-${request.status}`}>{statusLabel(request.status)}</span></div><button className="request-title-button" onClick={() => onOpen(request.id)}><h3>{request.title}</h3></button><p>{userLabel(store, request.seniorId)} · {request.neighborhood} · {preferenceText(request.datePreference)}</p><div className="request-card-actions"><button className="button button-outline" onClick={() => onOpen(request.id)}>자세히 보기</button>{request.status === "awaiting_confirmation" && request.elderConsent && <button className="button button-primary" onClick={() => onConfirm(request.id)}>동의된 활동 확인</button>}</div></article>)}</div> : <div className="empty-inline">아직 등록한 요청이 없어요.</div>}<p className="demo-reward-note"><Sparkles size={16}/> 기관과 이용자는 모두 가상 데모 데이터입니다.</p></div>;
}
function userLabel(store: import("@/lib/demo-data").DemoStore, id: string) { return store.users.find((user) => user.id === id)?.nickname ?? "어르신"; }

export function ScheduleProposalsPanel({ requests, proposals, store, onRespond, onOpen }: {
  requests: import("@/lib/demo-data").HelpRequest[]; proposals: import("@/lib/demo-data").ScheduleProposal[]; store: import("@/lib/demo-data").DemoStore;
  onRespond: (proposalId: string, accept: boolean) => void; onOpen: (id: string) => void;
}) {
  const pending = proposals.filter((proposal) => proposal.status === "pending" && requests.some((request) => request.id === proposal.requestId));
  return <section className="schedule-proposal-section"><div className="section-title-row"><div><span className="eyebrow">일정 제안</span><h2>청년이 가능한 시간을 보냈어요</h2></div><span className="soft-count">{pending.length}건</span></div>{pending.length ? <div className="proposal-list">{pending.map((proposal) => {
    const request = requests.find((item) => item.id === proposal.requestId)!;
    const volunteer = userLabel(store, proposal.volunteerId);
    const start = new Date(proposal.proposedStartAt);
    return <article className="proposal-card" key={proposal.id}><div><span className="category-tag">{request.category}</span><h3>{request.title}</h3><p>{volunteer}님 제안 · {dateLabelKorean(start)} · 약 30분</p><small>장소와 만남 방법은 확정 후 공공장소 기준으로 정해 주세요.</small></div><div className="proposal-actions"><button className="button button-primary" onClick={() => onRespond(proposal.id, true)}><CheckCircle2 size={17}/> 이 시간으로 확정</button><button className="button button-outline" onClick={() => onRespond(proposal.id, false)}>다른 제안 기다리기</button><button className="text-button" onClick={() => onOpen(request.id)}>요청 자세히 보기 <ArrowRight size={15}/></button></div></article>;
  })}</div> : <div className="empty-inline">아직 받은 일정 제안이 없어요. 청년이 가능한 시간을 보내면 이곳에서 확인할 수 있어요.</div>}</section>;
}
function dateLabelKorean(value: Date) { return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric", weekday: "long", hour: "numeric", minute: "2-digit" }).format(value); }
