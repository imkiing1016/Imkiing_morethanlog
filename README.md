# 블러핑 주식게임 (Bluffing Stock Game)

매 회차, 내가 아는 미래 정보를 진실 혹은 뻥카로 흘려 남을 내 주식에 끌어들이고,
동시에 남의 뻥카를 간파해 차익을 먹는 링크 공유형 멀티플레이어 게임.

> 설계의 단일 진실 원천은 [`SPEC.md`](./SPEC.md) 다. 모든 구현 판단은 이 문서를 우선한다.

## 기술 스택

- Next.js (App Router) + TypeScript + Tailwind CSS
- PartyKit — 방(room) 단위 권위 서버. **모든 게임 상태 계산은 서버에서만**.
- Zustand — 서버 스냅샷 수신 → 렌더

## 개발 실행

PartyKit 서버와 Next.js 개발 서버를 각각 띄운다(터미널 2개).

```bash
npm install
cp .env.example .env.local   # 필요 시 호스트 수정

# 터미널 1: 권위 서버
npm run party     # 127.0.0.1:1999

# 터미널 2: 웹
npm run dev       # http://localhost:3000
```

## 현재 진행 (마일스톤)

- [x] **M0 — 스캐폴드**: Next.js + TS + Tailwind + PartyKit 연결, 빈 방 생성/입장.
- [ ] M1 — 로비/방 (방 코드·링크 공유·닉네임·호스트 시작, 3~6명)
- [ ] M2 — 5페이즈 상태머신 (서버 권위)
- [ ] M3 — 코어 루프 로직
- [ ] M4 — UI 4화면
- [ ] M5 — 관리 화면 (스탯/피벗/엑시트)
- [ ] M6 — 이벤트/밸런스
- [ ] M7 — 마감
