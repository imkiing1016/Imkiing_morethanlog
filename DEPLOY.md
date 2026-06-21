# 배포 가이드

구성: **웹(Next.js) → Vercel**, **실시간 서버 → PartyKit**.
PartyKit 배포만 한 번 노트북에서 하고, 그 뒤로는 `git push` → Vercel 자동 재배포.

---

## STEP 0. 준비물 (노트북, 한 번만)

- **Git** (이미 설치됨)
- **Node.js LTS** — https://nodejs.org 에서 LTS 설치 후 cmd 새로 열고 `node -v` 로 확인
- **GitHub 계정** (PartyKit·Vercel 로그인에 사용)

## STEP 1. 코드 내려받기

```cmd
cd %USERPROFILE%\Desktop
git clone https://github.com/imkiing1016/Imkiing_morethanlog.git
cd Imkiing_morethanlog
git checkout feature/game
npm install
```

## STEP 2. PartyKit(실시간 서버) 배포

```cmd
npx partykit login
```
→ 브라우저가 열리면 **GitHub로 로그인 → 승인(Authorize)**.

```cmd
npm run party:deploy
```
→ 끝나면 이런 줄이 나온다:
```
Deployed to https://bluffing-stock-game.<당신의-아이디>.partykit.dev
```
이 **호스트 주소를 복사**해 둔다. (예: `bluffing-stock-game.imkiing1016.partykit.dev`)

## STEP 3. 웹(Next.js) → Vercel 배포 (브라우저)

1. https://vercel.com → **GitHub로 로그인**.
2. **Add New… → Project** → `Imkiing_morethanlog` 레포 **Import**.
3. **Environment Variables** 에 추가:
   - Name: `NEXT_PUBLIC_PARTYKIT_HOST`
   - Value: STEP 2에서 복사한 호스트 (앞에 `https://` 빼고)
     예) `bluffing-stock-game.imkiing1016.partykit.dev`
4. (브랜치) Production Branch 를 `feature/game` 으로 두거나, 나중에 `main` 으로 머지.
5. **Deploy** 클릭 → 1~2분 후 `https://...vercel.app` 주소가 나온다.

## STEP 4. 확인

- 나온 `https://...vercel.app` 링크를 연다 → 방 만들기.
- 그 링크를 친구 2명에게 공유 → 각자 폰/노트북에서 접속 → 같은 방에 모이면 성공.

---

## 자주 막히는 곳

| 증상 | 원인 / 해결 |
|---|---|
| 배지가 계속 "연결 중…" | Vercel 환경변수 `NEXT_PUBLIC_PARTYKIT_HOST` 오타/누락. 값에 `https://` 넣지 말 것. 고친 뒤 Vercel에서 **Redeploy** |
| `partykit deploy` 가 로그인 요구 | STEP 2의 `npx partykit login` 먼저 |
| 환경변수 바꿨는데 그대로 | NEXT_PUBLIC_* 는 빌드 때 박힌다 → **Redeploy** 필요 |

## 코드 수정 후 재배포

- 웹: `git push` 하면 Vercel이 자동 재배포.
- 서버 로직(`party/`) 바꾸면: 노트북에서 `npm run party:deploy` 다시 한 번.
