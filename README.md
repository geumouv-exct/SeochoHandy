# 서초손잡이 · GitHub Pages 업로드 폴더

이 폴더를 GitHub 저장소의 루트에 올리면 GitHub Actions가 정적 사이트를 빌드하고 Pages에 배포합니다.

## 올리는 방법

1. 이 폴더 안의 파일 전체를 새 GitHub 저장소의 루트에 업로드합니다.
2. 기본 브랜치 이름을 `main`으로 설정하고 파일을 커밋합니다.
3. 저장소의 **Settings → Pages → Build and deployment → Source**에서 **GitHub Actions**를 선택합니다.
4. **Actions** 탭에서 `Deploy to GitHub Pages` 작업이 끝나면 표시된 URL을 엽니다.

워크플로가 저장소 이름을 읽어 프로젝트 Pages용 경로를 자동 설정합니다. `username.github.io` 저장소는 루트 경로로 배포합니다.

## 이 버전에서 사용할 수 있는 기능

- 어르신·청년·기관·관리자 데모 계정 전환
- 도움 요청, 일정 제안과 수락, 활동 기록, 포인트 및 시연용 확인서
- 이 브라우저에 저장되는 데모 데이터
- GitHub Pages의 하위 경로 배포와 앱 내부 화면 이동

GitHub Pages는 정적 파일 호스팅이라 서버를 실행하지 않습니다. 따라서 이 배포판은 로그인 없는 데모 모드로 동작하고, Supabase 저장·인증과 ElevenLabs 실시간 음성 연결은 사용할 수 없습니다. 관련 서버 소스는 `backend-reference/`에 참고용으로 보존했으며 Pages 빌드에서는 제외됩니다. API 키나 비밀 환경 변수는 이 저장소에 올리지 마세요.

## 로컬에서 정적 파일 만들기

Node.js 20.9 이상이 필요합니다.

```bash
npm ci
npm run build
node scripts/finalize-pages.mjs
```

정적 결과물은 `out/` 폴더에 생성됩니다. 수동으로 `out/`을 게시하려면 먼저 저장소 경로를 지정해 빌드하세요.

```bash
GITHUB_REPOSITORY=OWNER/REPOSITORY npm run build
node scripts/finalize-pages.mjs
```

`OWNER/REPOSITORY`는 실제 GitHub 저장소 주소로 바꿉니다. Actions 배포에서는 이 값이 자동으로 제공됩니다.

`backend-reference/README_LOCAL_DEV.md`에는 원래 Next.js 서버 버전의 기능과 로컬 실행 방법이 있습니다. 이 버전에서 서버 기능을 운영하려면 GitHub Pages 대신 Vercel 등 서버를 지원하는 호스팅에 배포하세요.
