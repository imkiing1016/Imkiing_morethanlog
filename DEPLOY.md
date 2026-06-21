# 배포 가이드

구성: **웹(Next.js) → Vercel**, **실시간 서버(WebSocket) → Render**.
둘 다 **브라우저에서 GitHub 연결만으로** 배포된다(노트북 명령어 불필요).
한 번 연결해두면 이후 `git push` → 자동 재배포.

---

## STEP 1. 실시간 서버 → Render (브라우저)

1. https://render.com → **GitHub로 로그인**.
2. **New → Web Service** → `Imkiing_morethanlog` 레포 연결.
3. 설정 (대부분 자동 인식 / `render.yaml` 있음):
   - Branch: `feature/game` (나중에 `main` 으로 머지하면 거기로)
   - Runtime: **Node**
   - Build Command: `npm install`
   - Start Command: `npm run server:start`
   - Instance Type: **Free**
4. **Create Web Service** → 1~2분 후 주소가 나온다:
   ```
   https://bluffing-stock-game-server.onrender.com
   ```
   이 **호스트**(`onrender.com` 부분)를 복사해 둔다.
   - 확인: 그 주소를 브라우저로 열면 `...: ok` 텍스트가 보이면 정상.

> Render 무료 플랜은 15분간 아무도 안 들어오면 잠들었다가, 다음 접속 때
> 깨어나는 데 ~30~60초 걸린다(첫 접속이 느릴 수 있음). 테스트엔 충분.

## STEP 2. 웹 → Vercel (브라우저)

1. https://vercel.com → **GitHub로 로그인**.
2. **Add New… → Project** → `Imkiing_morethanlog` **Import**.
3. **Environment Variables** 에 추가:
   - Name: `NEXT_PUBLIC_REALTIME_HOST`
   - Value: STEP 1의 호스트 (앞에 `https://` 빼고)
     예) `bluffing-stock-game-server.onrender.com`
4. Production Branch 를 `feature/game` 로 두거나, 나중에 `main` 으로 머지.
5. **Deploy** → 1~2분 후 `https://...vercel.app` 주소가 나온다.

## STEP 3. 확인

- `https://...vercel.app` 를 연다 → 새 방 만들기 → 상단 배지 **연결됨**(초록).
- 그 링크를 친구 2명에게 공유 → 각자 접속 → 같은 방에 모이면 성공.

---

## 자주 막히는 곳

| 증상 | 원인 / 해결 |
|---|---|
| 배지가 계속 "연결 중…" | Vercel 의 `NEXT_PUBLIC_REALTIME_HOST` 오타/누락, 또는 `https://` 를 값에 넣음(호스트만!). 고친 뒤 Vercel **Redeploy** |
| 첫 접속이 느림 | Render 무료 플랜이 자고 있던 것. 30~60초 기다리면 깨어남 |
| 환경변수 바꿨는데 그대로 | `NEXT_PUBLIC_*` 는 빌드 때 박힌다 → Vercel **Redeploy** 필요 |

## 코드 수정 후 재배포

- `git push` 하면 **Vercel·Render 둘 다 자동 재배포**된다(autoDeploy).
