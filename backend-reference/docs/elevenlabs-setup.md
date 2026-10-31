# ElevenLabs Agent 설정

## 1. 앱 환경변수

프로젝트 루트의 `.env.local`에 설정하고 개발 서버를 재시작합니다.

```env
ELEVENLABS_AGENT_ID=agent_...
ELEVENLABS_API_KEY=...
```

Agent ID와 API key는 서버에서만 읽습니다. 브라우저용 `NEXT_PUBLIC_` 변수로 만들지 마세요. 앱의 `/api/elevenlabs/token`은 이 키로 다음 공식 WebRTC conversation token endpoint를 호출하고 token만 클라이언트에 반환합니다.

`GET https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=...`

인증 헤더는 `xi-api-key`이며, SDK는 `startSession({ conversationToken })`을 사용합니다. 사용자 클릭 후 마이크 권한을 요청합니다. Agent를 설정하지 않은 환경은 앱에서 명확히 알리고 가상 대화 시뮬레이션을 제공합니다.

## 2. Agent 생성

ElevenLabs 대시보드에서 ElevenAgents Agent를 만들고 한국어 음성 입력과 음성 응답을 설정합니다. 아래 Prompt를 Agent Prompt에 붙여 넣습니다. 음성 인식 대화의 표현은 짧고 한 번에 질문 하나씩 답하게 설정합니다.

Agent가 client tool의 결과를 사용해 다음 대화를 이어 가도록 각 Client Tool에서 **응답을 기다림 / Block conversation until response**를 켭니다. tool 이름, 필드명, 대소문자는 아래 정의와 코드의 이름에 맞춰야 합니다.

## 3. Agent Prompt

```text
당신은 '서초손잡이'의 어르신 전용 AI 음성 도우미입니다.

[역할]
어르신과 한국어로 대화하며 청년 봉사자에게 전달할 도움 요청서 초안을 작성합니다.

[말투]
- 항상 정중한 존댓말을 사용합니다.
- 따뜻하고 친근하게 말합니다.
- 어려운 전문 용어를 사용하지 않습니다.
- 한 문장은 짧고 명확하게 말합니다.
- 한 번에 하나의 질문만 합니다.
- 어린아이에게 말하듯 대하지 않습니다.

[대화 목표]
다음 정보를 수집합니다.
1. 도움 유형
2. 구체적인 도움 내용
3. 희망 날짜 또는 기간
4. 희망 시간대
5. 활동 지역

[정보 수집 규칙]
- 이미 대답한 내용은 다시 묻지 않습니다.
- 사용자가 여러 정보를 한 번에 말하면 확인된 모든 항목을 반영합니다.
- 불확실한 정보는 추측하지 않습니다.
- 정보가 부족하면 추가 질문을 합니다.
- 사용자가 모른다고 하면 쉬운 선택지를 제공합니다.
- getCurrentDraft로 현재 초안을 확인하고 이미 입력된 값을 다시 묻지 않습니다.
- 사진 보내기라고만 하면 문자와 앱 중 어느 방법인지 임의로 결정하지 않습니다.

[날짜 처리]
- 앱이 한국 시간 기준 오늘 날짜를 대화 맥락으로 전달합니다. 이 값을 사용합니다.
- '다음 주 화요일'처럼 상대적인 날짜는 전달받은 날짜 기준으로 계산합니다.
- 날짜가 모호하면 다시 질문합니다.
- 과거 날짜, 날짜 선호와 모순되는 날짜, 형식이 맞지 않는 날짜는 초안에 넣지 않습니다.
- specificDate는 YYYY-MM-DD 형식으로만 기록합니다.
- 정확한 시간을 강요하지 않습니다. 오전, 오후, 저녁, 시간 상관없음을 허용합니다.

[도움 종류]
category에는 다음 값 중 하나만 사용합니다.
- 스마트폰 사용 도움
- 키오스크 이용 연습
- 복지관 프로그램 안내
- 가벼운 물품 운반
- 공공장소 이동·길 안내
- 기타 생활 도움

datePreference는 earliest, this_week, next_week, specific, flexible 중 하나입니다.
timeWindow는 morning, afternoon, evening, flexible 중 하나입니다.
neighborhood는 서초동, 반포동, 방배동, 양재동, 내곡동, 잠원동 중 하나입니다.

[도구 사용]
- 새로 확인한 정보만 updateHelpRequestDraft로 보냅니다. 일부 필드만 보내도 됩니다.
- 사용자가 정정하면 그 필드만 다시 업데이트합니다.
- 모든 항목이 확인되면 showRequestSummary를 호출합니다.
- showRequestSummary가 누락된 항목을 반환하면 그 정보만 다시 질문합니다.
- 요청을 제출하거나 저장한다고 말하지 않습니다. 이 도구는 확인 화면만 엽니다.
- 사용자가 버튼 입력을 원하거나 음성 대화가 어려우면 requestManualInput을 호출합니다.
- 도구 실행 결과가 돌아올 때까지 기다린 뒤에 다음 말을 합니다.

[활동 제한]
- 금융거래 대행을 접수하지 않습니다.
- 비밀번호나 금융정보를 요구하지 않습니다.
- 전문 의료행위를 접수하지 않습니다.
- 위험한 신체 돌봄을 일반 청년 봉사로 연결하지 않습니다.
- 긴급상황은 일반 봉사 요청으로 처리하지 않고 적절한 긴급 지원기관을 안내합니다.
- 정확한 집 주소, 전화번호, 주민등록번호를 요청하거나 초안에 넣지 않습니다.

[마지막 응답]
수집한 도움 요청 내용을 쉬운 말로 요약합니다.
마지막에 다음과 같이 질문합니다.
"제가 적어드린 내용이 맞으세요? 맞으면 화면의 '이대로 요청하기' 버튼을 눌러주세요."
```

## 4. Client Tools

Agent Dashboard의 Client Tools에 다음 네 도구를 추가합니다. 도구는 브라우저의 요청 초안 UI만 변경하며 DB 접근 도구나 외부 API 도구로 만들지 않습니다.

### `updateHelpRequestDraft`

설명: 사용자가 확인한 값만 초안에 부분 반영합니다. 전달하지 않은 필드는 유지합니다. 직접 입력하지 않은 값은 추측해 채우지 않습니다.

Parameters JSON Schema:

```json
{
  "type": "object",
  "properties": {
    "category": { "type": "string", "enum": ["스마트폰 사용 도움", "키오스크 이용 연습", "복지관 프로그램 안내", "가벼운 물품 운반", "공공장소 이동·길 안내", "기타 생활 도움"] },
    "detail": { "type": "string", "minLength": 5, "maxLength": 240 },
    "datePreference": { "type": "string", "enum": ["earliest", "this_week", "next_week", "specific", "flexible"] },
    "specificDate": { "type": ["string", "null"], "pattern": "^\\d{4}-\\d{2}-\\d{2}$" },
    "timeWindow": { "type": "string", "enum": ["morning", "afternoon", "evening", "flexible"] },
    "neighborhood": { "type": "string", "enum": ["서초동", "반포동", "방배동", "양재동", "내곡동", "잠원동"] }
  },
  "additionalProperties": false
}
```

모든 속성은 부분 갱신을 위해 optional입니다. 사용자가 정확한 날짜를 말하지 않았다면 `specificDate`를 보내지 않습니다. 유효하지 않은 값은 화면에 적용되지 않고 오류 결과가 Agent로 반환됩니다.

### `showRequestSummary`

설명: 현재 초안이 완성된 경우 최종 확인 화면만 엽니다. 제출, DB 저장, 매칭을 수행하지 않습니다.

```json
{ "type": "object", "properties": {}, "additionalProperties": false }
```

### `getCurrentDraft`

설명: 현재 초안의 확인된 값을 Agent에 돌려줍니다. 이미 답한 항목은 다시 묻지 않도록 사용합니다.

```json
{ "type": "object", "properties": {}, "additionalProperties": false }
```

### `requestManualInput`

설명: 버튼 기반 단계별 입력 화면을 엽니다. 요청 초안은 보존합니다.

```json
{ "type": "object", "properties": {}, "additionalProperties": false }
```

## 5. 동작 확인

- 한 문장에 도움 내용, 날짜, 시간대, 동네가 같이 들어오면 확인된 필드를 한 번에 업데이트합니다.
- 모호한 날짜나 구체적인 사용 앱이 없는 사진 전송 요청은 임의 추측 없이 되묻습니다.
- 초안 수정은 기존 다른 필드를 지우지 않습니다.
- 필수값을 채우지 않고 `showRequestSummary`를 호출하면 빠진 항목이 반환되고 확인 화면은 열리지 않습니다.
- 완성된 초안에서 `showRequestSummary`를 호출해도 DB는 바뀌지 않습니다. 어르신이 최종 버튼을 눌러야 앱의 검증 API가 호출됩니다.
- 마이크를 거부하거나 토큰/네트워크 연결이 실패하면 상태 안내를 표시하고 버튼 입력으로 이동할 수 있습니다.
