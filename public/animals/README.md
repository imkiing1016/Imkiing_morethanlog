# 동물 캐릭터 스프라이트 시트

**경로**: `public/animals/sheet.png`

## 규격

- **한 장의 PNG** — 5열 × 4행 = 총 20칸
- 각 칸은 동일 크기 (사각형 or 정사각형 모두 OK)
- 배경 투명(권장) — 원형 배경색이 시트 밑으로 비치도록
- 권장 해상도: 각 셀 최소 128×128 이상 (레티나 대응) — 총 640×512 이상

## 셀 순서 (매우 중요)

좌→우, 상→하로 다음 순서:

|   | 열 0 | 열 1 | 열 2 | 열 3 | 열 4 |
|---|---|---|---|---|---|
| **행 0** | ghost 유령 | fox 여우 | rabbit 토끼 | owl 부엉이 | bear 곰 |
| **행 1** | tiger 호랑이 | penguin 펭귄 | koala 코알라 | panda 판다 | lion 사자 |
| **행 2** | cat 고양이 | dog 강아지 | elephant 코끼리 | giraffe 기린 | hedgehog 고슴도치 |
| **행 3** | frog 개구리 | horse 말 | mouse 쥐 | monkey 원숭이 | alien 외계인 |

⚠️ 순서가 어긋나면 편집기 라벨과 실제 아이콘이 맞지 않게 됩니다. 참고 이미지의 원본 순서 그대로 유지 권장.

## 업로드 방법

### GitHub 웹 UI
1. https://github.com/imkiing1016/Imkiing_morethanlog/tree/main/public/animals 접속
2. **Add file → Upload files**
3. 파일명 `sheet.png` 로 저장
4. 커밋 → Vercel 자동 재배포

### 로컬
```bash
cp <내려받은.png> public/animals/sheet.png
git add public/animals/sheet.png
git commit -m "art: 동물 20종 스프라이트 시트 추가"
git push
```

## 동작

- 파일 존재 → `Avatar` 컴포넌트가 CSS `background-position` 으로 각 칸을 슬라이스해서 렌더
- 파일 없음(404) → 이모지 폴백 (현재 상태와 동일)
- 원형 배경색 · 우측 상단 장식 뱃지는 시트 위에 오버레이 → 시트 자체는 배경 투명이 이상적

## 셀 크기가 규격과 다를 때

`components/Avatar.tsx` 상단의 `SHEET_COLS`, `SHEET_ROWS` 를 조정하면 됨. 예:
- 4×5 배치 (열 4개, 행 5개) 로 하고 싶으면 `SHEET_COLS = 4, SHEET_ROWS = 5` 로 변경 + `ANIMAL_LIST` 순서 재정렬
