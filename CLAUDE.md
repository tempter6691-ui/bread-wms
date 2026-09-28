# 더브레드뱅크 WMS

빌드 없는 정적 HTML 앱(Firebase compat SDK, 인라인 JS)과 Firestore(`bread-wms` 프로젝트)로 구성됨.
GitHub에 "Add files via upload"로 올려서 배포함.

## 파일
- `index.html` — 메인 WMS(재고, 입고/출고 스캔, 주문, 거래처, 이카운트 전송, 백업/복원). **실제로 수정할 파일은 이것.**
- `index (2).html`, `index.html.html` — 옛날 사본으로 보임. 사용자가 요청하지 않으면 수정하지 말 것.
- `production.html` — 생산 관리(`production_*`, `recipes`, `batch_counters`, `ingredientEcountMap`).
- `order.html` / `order-admin.html` — 거래처 주문 요청(`orders_request`, `client_messages`, `settings`). SDK 9.22.1 사용.
- `driver-a~e.html` — 배송기사별 페이지(`orders` 읽기).
- `scripts/` — firebase-admin을 쓰는 Node 스크립트(아래 참고).

## Firestore 직접 접근 (scripts/)
- 키: 프로젝트 루트의 `serviceAccountKey.json`, 또는 `FIREBASE_KEY` 환경변수로 경로 지정. 둘 다 gitignore 처리됨. **키 파일은 절대 커밋하거나 출력하지 말 것.**
- `npm run check` — 읽기 전용 연결 확인 + 컬렉션별 문서 수.
- `npm run backup [-- 컬렉션...]` — `backups/<타임스탬프>/`에 JSON으로 덤프(gitignore 처리됨).
  `logs`, `priceHistory`는 `--allow-large`를 붙여야만 포함됨.
- **읽기 한도 주의:** 무료 요금제 일일 읽기 한도(5만 건, 16:00 KST 초기화)를 운영 페이지들과 같이 씀.
  2026-09-28에 logs 전체를 읽다가 한도를 넘김. 대량으로 읽기 전에 문서 수를 확인하고 사용자에게 알릴 것.
- 새 스크립트는 `require('./lib/admin')`으로 `{ db, FieldValue, FieldPath, APPLY }`를 가져와 씀.
- **쓰기 스크립트 규칙:** 기본은 dry-run(변경 예정 내용만 출력)이고, `--apply`를 붙였을 때만 반영. 반영 전에 먼저 `npm run backup`으로 해당 컬렉션을 백업. 운영 데이터이므로 반영하기 전에 사용자에게 dry-run 결과를 보여주고 확인받을 것.
- 재고 수량은 `FieldValue.increment()`로 변경(앱과 동일한 방식). 스캔이 동시에 일어나므로 읽은 값에 더해서 `set`하지 말 것.

## 핵심 규칙

### 데이터 복원은 기존 상품/거래처를 절대 덮어쓰지 않음
`index.html`의 `doRestore()` 참고. 옛날 백업을 복원하다가 이후에 수정된 이름/단위가 되살아나는 사고
(예: "체리쿠키(1kg/봉)" → "체리쿠키")가 반복되어 2026-09-28에 수정함.
- `products`, `clients`: **백업에는 있지만 현재 없는 문서만** 새로 만듦. 이미 있는 문서는 어떤 필드도 건드리지 않음.
- 복원 대상에서도 `ecountCode`, `ecountQtyMultiplier`, `orderUnitDivisor`(상품)와 `code`, `ecountCode`(거래처)는 제외함.
- 스크립트로 복원/마이그레이션할 때도 같은 원칙을 지킬 것. 필드를 "좀 더 넓게" 덮어쓰도록 되돌리지 말 것.
- 참고: `inventory`, `orders`, `templates`는 아직 복원 시 통째로 덮어씀(보호되지 않음).

### 3호 케익은 2개/box 단위
WMS 재고는 판/박스 단위로 세지만, 비즈모아 전송 시에는 개 단위로 보내므로 1판(박스) = 2개로 환산함
(수량 ×2, 단가 ÷2). 이 환산은 **Firestore 필드가 아니라** `index.html` 비즈모아 전송 쪽 `bmBoxMult()`에서
상품명으로 처리함.
- 이름에 `(N개/box)`, `(N개/박스)`, `(2개/봉)`이 있으면 그 N을 사용.
- 괄호 표기가 없는 제품은 `NAME_BOX_MULT` 하드코딩 목록으로 처리. 현재 목록: `3호생크림케익(화이트아이씽JWG용)`,
  `3호생크림아이씽컷팅JWG`, `바나나3JWG호`, `녹차3JWG호`, `당근3호JWG`.
- 목록은 이름이 **정확히 일치**해야 적용되므로, 상품명을 바꾸면 환산이 조용히 풀림.
- `3호생크림 케익(원형)`(P001)과 `3호생크림 원형(라온)`(P861408)은 단위가 `박스`지만 **일부러 환산 대상에서 뺌**
  (사용자 확인, 2026-09-28). 비즈모아에는 1박스 = 1개로 전송함. `NAME_BOX_MULT`에 추가하지 말 것.
- 이카운트 전송 배수는 별도로 `products.ecountQtyMultiplier`, 주문→재고 단위 환산은 `products.orderUnitDivisor`를 사용함.

### "마카롱엘로우" 오타 주의
노랑 마카롱의 표기가 코드 안에서 섞여 있음.
- `index.html` 기본 상품 목록과 **실제 Firestore `products`**: `마카롱엘로우1단` / `마카롱엘로우2단`(P053/P054) ← **"엘로우"**
- `index.html` `ecAdjustNamePrice()`의 1단 단가 절반 예외 목록: 원래 `마카롱옐로우1단`만 있어서 노랑 1단만 단가가
  절반으로 전송됐음. 2026-09-28에 `마카롱엘로우1단`을 추가함(두 표기 모두 유지).
- 옛날 사본들: `마카롱옐로우1` / `마카롱옐로우2`

상품명을 문자열로 비교하는 로직(단가 보정, 이카운트 매칭, 검색)은 이 차이 때문에 조용히 매칭에 실패할 수 있음.
상품명 비교 코드를 건드릴 때는 Firestore `products`에 실제로 저장된 이름을 확인하고, 가능하면 이름 대신 상품 ID(P053 등)로 비교할 것.
이름을 멋대로 "고치지" 말 것. 이카운트 품목명이나 거래처 주문 데이터와 연결되어 있을 수 있음.

## 작업 방식
- `index.html`은 매우 큼(약 25만 자). 파일 전체를 읽지 말고 grep으로 필요한 함수만 찾아서 볼 것.
- 수정한 곳에는 기존 코드 스타일대로 날짜와 이유를 적은 한국어 주석을 남길 것(`// 2026-09-28 수정: ...`).
