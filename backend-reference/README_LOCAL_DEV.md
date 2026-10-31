# 서초손잡이

서초구 어르신과 청년 이웃을 연결하는 해커톤 MVP입니다. 어르신은 ElevenLabs 음성 대화 또는 큰 버튼으로 요청 초안을 만들고 직접 최종 등록합니다. 청년의 일정 제안을 어르신이 수락한 뒤에만 매칭과 활동이 만들어집니다.

> Demo Mode의 계정·요청·기관·포인트·리워드는 모두 가상 데이터입니다. 실제 복지기관, 상점, 1365 자원봉사포털과 연동되지 않습니다. PDF는 공식 봉사실적 증빙이 아닙니다.

## 실행

필요 환경: Node.js 20.9 이상, npm

```bash
npm install
npm run dev
```

`http://localhost:3000`을 열고 체험 시작에서 역할을 선택합니다. ElevenLabs와 Supabase 환경변수가 없어도 Demo Mode의 전체 주요 흐름을 체험할 수 있습니다.

## 전체 데모 시나리오

1. 어르신으로 전환하고 **말로 도움 요청하기**를 엽니다. ElevenLabs가 설정되지 않은 경우 **데모 대화 시뮬레이션**을 눌러 미리 정한 대화가 실제 AI가 아닌 시뮬레이션임을 확인합니다. 시나리오가 끝나면 확인 화면으로 이동합니다.
2. 요청을 최종 확인해 등록합니다. 초안 작성 도구는 저장 권한이 없고 이 화면의 **이대로 요청하기**만 등록을 수행합니다.
3. 이청년으로 전환하고 **도움 요청 찾기**에서 새 요청을 엽니다. 가능한 미래 시간 한두 개를 제안합니다. 요청이 바로 매칭되지는 않습니다.
4. 어르신 계정의 **일정 확인**에서 제안을 수락합니다. 이때 일정이 확정되고 활동 기록이 생성됩니다. 제안을 거절하면 다른 제안을 기다리며, 대기 중인 제안이 없으면 요청이 다시 열립니다.
5. 청년으로 돌아가 활동 상세를 열고 시작한 뒤 **발표용 30분 활동 체험 종료**를 누릅니다. 어르신 계정에서 도움 완료를 확인합니다.
6. 청년 계정의 활동 기록과 포인트를 확인하고, **활동 확인서 다운로드**와 가상 리워드 교환을 체험합니다.

가상 복지관 담당자는 계정 메뉴의 **햇살복지관 담당자**에서 체험합니다. 요청 등록 시 어르신을 선택하고 동의 확인란을 체크해야 합니다. 기관 이름과 요청은 데모 표기로만 표시됩니다.

## 기능

- 어르신 전용 큰 버튼 화면, 단계별 입력, 확대 글씨, 음성 대화와 초안 보존
- ElevenLabs client tools로 초안 수정, 읽기, 최종 확인 화면 열기, 버튼 입력 전환
- 날짜 선호와 시간대를 저장하고 청년이 미래 일정 제안, 어르신 또는 동의된 담당자가 수락
- 기관 담당자의 동의 기반 대리 요청과 완료 확인
- 청년 요청 검색, 동네·도움 종류·시간·날짜 필터와 규칙 기반 추천
- 확정 활동 시작·종료, 어르신 완료 확인, 1일 600P 적립 한도와 중복 방지
- 가상 리워드, 한국어 DEMO 워터마크 활동 확인서 PDF, 신고 및 관리자 조회
- localStorage Demo Mode, 계정 전환, 시연 데이터 초기화
- Supabase용 Auth, RLS, 권한별 Route Handler 및 일정·포인트 원자적 검증 RPC

## ElevenLabs 음성 에이전트 설정

공식 React SDK의 `ConversationProvider`, `useConversationControls`, `useConversationStatus`, `useConversationMode`, `useConversationClientTool`를 사용합니다. WebRTC 연결 토큰은 `/api/elevenlabs/token`이 서버에서 발급하며 API 키는 브라우저에 전달하지 않습니다. 설정 단계, Agent Prompt, Client Tools용 JSON Schema는 [docs/elevenlabs-setup.md](docs/elevenlabs-setup.md)에 있습니다.

`.env.local`에 다음을 설정합니다.

```env
ELEVENLABS_AGENT_ID=agent_...
ELEVENLABS_API_KEY=서버에서만_사용하는_키
```

API 키에 `NEXT_PUBLIC_` 접두사를 붙이지 마세요. 음성 연결 전에 사용 목적과 ElevenLabs 전송 안내를 읽고 동의해야 합니다. 마이크 거부나 연결 실패 시 작성 중 초안을 유지하며 버튼 입력으로 전환할 수 있습니다. 앱은 음성 원본을 저장하지 않습니다. 대화 자막은 현재 화면에서만 유지됩니다.

Agent가 준비되기 전에는 **데모 대화 시뮬레이션**을 사용할 수 있습니다. 이는 실제 음성 대화가 아니라고 화면에 표시합니다.

## Supabase 연결 모드

Demo Mode는 기본값입니다. 연결 모드에서는 아래 설정으로 이메일 링크 인증과 DB 저장을 사용합니다.

1. `.env.example`을 `.env.local`로 복사하고 Supabase URL, anon key, 사이트 주소를 설정합니다.
2. 신규 Supabase 프로젝트의 SQL Editor에서 `supabase/schema.sql`을 한 번 실행합니다. 이 파일은 깨끗한 신규 DB용 전체 스키마입니다.
3. Supabase Auth에서 Email provider를 켜고 Site URL과 `${NEXT_PUBLIC_SITE_URL}/auth/callback` redirect URL을 허용합니다.
4. `npm run dev` 후 `/start`에서 어르신, 청년 또는 기관 담당자를 선택하고 이메일 인증을 마칩니다.

관리자 역할은 가입 화면에서 선택할 수 없습니다. 실제 운영 관리자 계정은 프로젝트 소유자가 Supabase에서 별도 승인해야 합니다. 이전 v1 스키마를 이미 적용한 프로젝트는 `schema.sql`을 그대로 재실행하지 마세요. 필요한 스키마 변경을 백업한 뒤 마이그레이션으로 적용해야 합니다.

서버는 사용자 세션과 역할을 확인하고, 일정 제안·수락 및 활동 완료는 PostgreSQL RPC에서 다시 검증합니다. 일정 충돌 검사는 봉사자 프로필 행 잠금과 확정 일정 겹침 검사를 사용합니다. 실제 배포 전에는 별도의 Supabase 테스트 프로젝트에서 Auth, RLS, 동시 요청, 일정 충돌을 확인하세요. `service_role` 키는 사용하지 않습니다.

## 테스트 및 빌드

```bash
npm run typecheck
npm run build
```

수동 점검 시나리오:

- 음성 미설정 데모 대화 → 초안 갱신 → 최종 확인 → 취소 또는 최종 등록
- ElevenLabs 실제 연결, 마이크 권한 거부, 네트워크 끊김, 수동 입력 전환
- 필수 초안 누락, 잘못된 카테고리·동네, 과거 날짜 제출 방지
- 청년이 요청별 일정 한두 개 제안, 어르신 거절·수락, 수락 시에만 매칭 생성
- 동시간대 청년 일정 충돌과 지난 제안 수락 방지
- 어르신 또는 동의가 있는 담당자의 완료 확인, 확인 전 적립 금지, 중복 적립 방지
- 포인트 부족 교환 차단, 가상 리워드 차감, 한국어 PDF 및 DEMO 고지
- 기관의 동의 없는 대리 등록 차단, 요청·일정·활동 화면 확인

## Vercel 배포

Vercel에서 이 프로젝트를 연결하고 Build Command를 `npm run build`로 설정합니다. 실시간 음성은 `ELEVENLABS_AGENT_ID`와 서버 전용 `ELEVENLABS_API_KEY`를 프로젝트 환경변수에 등록합니다. Supabase 모드라면 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, 실제 도메인으로 된 `NEXT_PUBLIC_SITE_URL`도 설정하고 Supabase Auth Redirect URLs에 `/auth/callback`을 추가합니다.

음성 토큰 API에는 동일 출처 확인과 프로세스 내 요청 제한이 있습니다. 서버리스 인스턴스마다 메모리가 나뉘므로 운영 배포에는 공유 저장소 기반 rate limit을 추가해야 합니다. 실제 이용 전 개인정보·음성 보존 정책, 기관 동의 절차, 신원 확인, 안전 운영 기준을 검토해야 합니다.
