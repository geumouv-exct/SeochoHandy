# Vercel 배포와 ElevenLabs 음성 연결

GitHub Pages는 정적 파일만 제공하므로 서버 API 키를 사용할 수 없습니다. 이 프로젝트는 Vercel에서 정적 Next.js 화면과 `/api/elevenlabs/token` 서버 함수를 함께 제공하도록 준비되어 있습니다.

## Vercel 프로젝트 설정

1. Vercel에서 **New Project**를 선택하고 `geumouv-exct/SeochoHandy` 저장소를 연결합니다.
2. Root Directory는 저장소 루트로 둡니다. Framework는 Next.js 자동 감지를 사용합니다.
3. Build Command를 `npm run build`로 둡니다. Output Directory를 별도로 덮어쓰지 않습니다.
4. Project Settings → Environment Variables에 아래 항목을 Production과 Preview에 추가합니다.

| 변수 | 값 | 비밀 여부 |
| --- | --- | --- |
| `ELEVENLABS_API_KEY` | ElevenLabs에서 발급한 서버 키 | Secret |
| `ELEVENLABS_AGENT_ID` | 사용할 ElevenLabs Agent ID | 서버 전용으로 저장 |
| `ELEVENLABS_AGENT_LABEL` | 선택 사항. 화면에 표시할 이름 | 일반 변수 |

저장 후 Vercel에서 재배포합니다. 앱은 빌드 시 Agent ID와 API 키가 모두 있을 때만 실시간 음성 연결 버튼을 활성화합니다. API 키는 서버 함수가 토큰 발급에만 사용하며, 브라우저 코드에 포함하지 않습니다.

## 안전하게 키 설정하기

- CLI가 생성한 로컬 키는 프로젝트 루트의 `.env.local`에 있으며 Git에서 제외됩니다.
- 키를 소스 코드, `NEXT_PUBLIC_` 변수, GitHub 저장소 파일에 넣지 마세요.
- Vercel의 환경변수 화면에서 키를 직접 입력하세요. 채팅에 이미 붙여 넣은 이전 키는 폐기하고 새 키를 사용하세요.
- Agent ID가 아직 없다면 ElevenLabs에서 Agent를 만든 뒤 해당 ID를 설정해야 합니다.

## 배포 후 확인

- Vercel 배포 URL에서 `/senior/request/voice/`를 엽니다.
- Agent 안내와 음성 시작 버튼이 활성화됐는지 확인합니다.
- 첫 음성 대화는 어르신이 음성 처리 안내에 동의하고 버튼을 누른 뒤 시작합니다.
- GitHub Pages 주소는 기존 정적 데모로 남으며 ElevenLabs 서버 기능을 제공하지 않습니다.
