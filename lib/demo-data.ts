export const NEIGHBORHOODS = ["서초동", "반포동", "방배동", "양재동", "내곡동", "잠원동"] as const;
export const CATEGORIES = [
  "스마트폰 사용 도움",
  "키오스크 이용 연습",
  "복지관 프로그램 안내",
  "가벼운 물품 운반",
  "공공장소 이동·길 안내",
  "기타 생활 도움",
] as const;

export type Role = "senior" | "volunteer" | "partner" | "admin";
export type RequestStatus = "open" | "awaiting_schedule" | "matched" | "in_progress" | "awaiting_confirmation" | "completed" | "cancelled";
export type DatePreference = "earliest" | "this_week" | "next_week" | "specific" | "flexible";
export type TimeWindow = "morning" | "afternoon" | "evening" | "flexible";

export type HelpRequestDraft = {
  category?: string;
  detail?: string;
  datePreference?: DatePreference;
  specificDate?: string | null;
  timeWindow?: TimeWindow;
  neighborhood?: string;
};

export type DemoUser = {
  id: string;
  nickname: string;
  role: Role;
  neighborhood: string;
  preferredCategories: string[];
};

export type HelpRequest = {
  id: string;
  activityId?: string;
  seniorId: string;
  title: string;
  description: string;
  category: string;
  neighborhood: string;
  requestedDate: string;
  requestedTime: string;
  estimatedMinutes: number;
  status: RequestStatus;
  createdAt: string;
  matchedVolunteerId: string | null;
  createdById?: string;
  createdByRole?: Role;
  elderConsent?: boolean;
  datePreference?: DatePreference;
  specificDate?: string | null;
  timeWindow?: TimeWindow;
  confirmedStartAt?: string | null;
  confirmedEndAt?: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationMinutes: number | null;
  confirmedAt: string | null;
  simulated: boolean;
};

export type PointTransaction = {
  id: string;
  volunteerId: string;
  activityId: string;
  amount: number;
  type: "earn" | "redeem";
  createdAt: string;
  title: string;
};

export type Redemption = {
  id: string;
  volunteerId: string;
  title: string;
  pointsSpent: number;
  createdAt: string;
};

export type Report = {
  id: string;
  reporterId: string;
  requestId: string;
  reason: string;
  status: "접수" | "확인 중" | "처리 완료";
  createdAt: string;
};

export type ScheduleProposal = {
  id: string;
  requestId: string;
  volunteerId: string;
  proposedStartAt: string;
  proposedEndAt: string;
  status: "pending" | "accepted" | "rejected" | "withdrawn";
  createdAt: string;
};

export type DemoStore = {
  currentUserId: string | null;
  users: DemoUser[];
  requests: HelpRequest[];
  transactions: PointTransaction[];
  redemptions: Redemption[];
  reports: Report[];
  scheduleProposals: ScheduleProposal[];
};

const ago = (days: number, hour = 11) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

const futureDate = (days: number) => {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export function createSeedStore(): DemoStore {
  const users: DemoUser[] = [
    { id: "senior-kim", nickname: "김어르신", role: "senior", neighborhood: "방배동", preferredCategories: [] },
    { id: "senior-park", nickname: "박어르신", role: "senior", neighborhood: "양재동", preferredCategories: [] },
    { id: "senior-lee", nickname: "이어르신", role: "senior", neighborhood: "반포동", preferredCategories: [] },
    { id: "volunteer-lee", nickname: "이청년", role: "volunteer", neighborhood: "방배동", preferredCategories: ["스마트폰 사용 도움", "복지관 프로그램 안내"] },
    { id: "volunteer-choi", nickname: "최청년", role: "volunteer", neighborhood: "양재동", preferredCategories: ["키오스크 이용 연습"] },
    { id: "volunteer-jung", nickname: "정청년", role: "volunteer", neighborhood: "서초동", preferredCategories: ["공공장소 이동·길 안내"] },
    { id: "partner-demo", nickname: "햇살복지관 담당자", role: "partner", neighborhood: "방배동", preferredCategories: [] },
    { id: "admin-demo", nickname: "운영자", role: "admin", neighborhood: "서초구", preferredCategories: [] },
  ];
  const requests: HelpRequest[] = [
    {
      id: "activity-demo-1", seniorId: "senior-kim", title: "스마트폰으로 사진 보내는 방법을 알려주세요", description: "손주에게 사진을 보내고 싶은데 방법을 잘 모르겠어요.", category: CATEGORIES[0], neighborhood: "방배동", requestedDate: futureDate(1), requestedTime: "오전 10:30", estimatedMinutes: 30, status: "open", createdAt: ago(0), matchedVolunteerId: null, startedAt: null, endedAt: null, durationMinutes: null, confirmedAt: null, simulated: false,
    },
    {
      id: "activity-demo-2", seniorId: "senior-park", title: "키오스크로 음식 주문하는 연습을 하고 싶어요", description: "자주 가는 식당에서 천천히 주문 연습을 해보고 싶어요.", category: CATEGORIES[1], neighborhood: "양재동", requestedDate: futureDate(2), requestedTime: "오후 2:00", estimatedMinutes: 45, status: "open", createdAt: ago(0, 13), matchedVolunteerId: null, startedAt: null, endedAt: null, durationMinutes: null, confirmedAt: null, simulated: false,
    },
    {
      id: "activity-demo-3", seniorId: "senior-lee", title: "복지관 프로그램을 찾는 방법을 알려주세요", description: "집 근처 복지관 프로그램을 휴대폰으로 같이 찾아보고 싶어요.", category: CATEGORIES[2], neighborhood: "반포동", requestedDate: futureDate(2), requestedTime: "오전 11:00", estimatedMinutes: 30, status: "matched", createdAt: ago(1), matchedVolunteerId: "volunteer-lee", startedAt: null, endedAt: null, durationMinutes: null, confirmedAt: null, simulated: false,
    },
    {
      id: "activity-demo-4", seniorId: "senior-kim", title: "스마트폰 글자 크기 설정을 도와주세요", description: "화면 글씨가 작아서 읽기 편한 크기로 바꾸고 싶어요.", category: CATEGORIES[0], neighborhood: "방배동", requestedDate: futureDate(0), requestedTime: "오후 3:00", estimatedMinutes: 30, status: "awaiting_confirmation", createdAt: ago(2), matchedVolunteerId: "volunteer-lee", startedAt: ago(2, 14), endedAt: ago(2, 14), durationMinutes: 30, confirmedAt: null, simulated: true,
    },
    {
      id: "activity-demo-5", seniorId: "senior-park", title: "공공시설 홈페이지 이용을 도와주세요", description: "주민센터 홈페이지에서 운영시간을 확인하는 법을 배웠어요.", category: CATEGORIES[2], neighborhood: "서초동", requestedDate: futureDate(-3), requestedTime: "오전 10:00", estimatedMinutes: 60, status: "completed", createdAt: ago(5), matchedVolunteerId: "volunteer-lee", startedAt: ago(5, 10), endedAt: ago(5, 11), durationMinutes: 60, confirmedAt: ago(5, 11), simulated: true,
    },
    {
      id: "activity-demo-6", seniorId: "senior-kim", title: "복지관 컴퓨터 교실 위치를 같이 찾아봤어요", description: "복지관 안에서 프로그램실 위치를 함께 확인한 시연용 기록이에요.", category: CATEGORIES[4], neighborhood: "방배동", requestedDate: futureDate(-10), requestedTime: "오후 1:00", estimatedMinutes: 60, status: "completed", createdAt: ago(10), matchedVolunteerId: "volunteer-lee", startedAt: ago(10, 13), endedAt: ago(10, 14), durationMinutes: 60, confirmedAt: ago(10, 14), simulated: true,
    },
  ];
  return {
    currentUserId: null,
    users,
    requests,
    transactions: [
      { id: "seed-point-1", volunteerId: "volunteer-lee", activityId: "activity-demo-5", amount: 200, type: "earn", createdAt: ago(5, 11), title: "활동 확인 포인트" },
      { id: "seed-point-2", volunteerId: "volunteer-lee", activityId: "activity-demo-6", amount: 200, type: "earn", createdAt: ago(10, 14), title: "활동 확인 포인트" },
    ],
    redemptions: [],
    reports: [],
    scheduleProposals: [],
  };
}

export const STORAGE_KEY = "seocho-sonjabi-demo-v1";

export function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function userFor(store: DemoStore, id: string | null | undefined) {
  return store.users.find((user) => user.id === id);
}

export function statusLabel(status: RequestStatus) {
  return {
    open: "청년 기다리는 중",
    awaiting_schedule: "일정 확인 대기",
    matched: "매칭 완료",
    in_progress: "활동 진행 중",
    awaiting_confirmation: "완료 확인 대기",
    completed: "활동 완료",
    cancelled: "취소",
  }[status];
}

