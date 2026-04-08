# 주문화면/견적흐름 PHP 포팅 가이드

이 문서는 React SPA의 주문/견적 흐름(`Configure`, `Cart`, `Checkout`, `Orders`, `Admin`)을 PHP 기반 서버 렌더링 또는 PHP API 백엔드 구조로 옮길 때 필요한 상세 설계를 정리합니다.

## 1) 현재 프론트 흐름 요약

1. `Configure`에서 사양 선택 -> 실시간 `calcQuote`
2. 파일 업로드(옵션) -> 장바구니 추가
3. `Cart`에서 수량 변경 시 재계산
4. `Checkout`에서 주문 생성
5. `Orders`에서 재주문/상태 확인
6. `Admin`에서 가격/설정/주문상태 관리

## 2) PHP 포팅 방식 선택

### A. 프론트 유지 + PHP API 백엔드 (권장)
- React는 그대로 유지
- 모든 저장/조회/계산을 PHP API로 위임
- 리스크 최소, 단계적 전환 용이

### B. 화면까지 PHP 렌더링
- Blade/Twig 등으로 전면 재작성
- 초기 비용 큼, 재사용 코드 적음

## 3) 핵심 API 계약 (권장)

### 견적
- `POST /api/quotes/calc`
  - req: `cfg`, `mode(normal|custom)`, `options`
  - res: `quote`

### 장바구니
- `GET /api/cart`
- `POST /api/cart/items`
- `PUT /api/cart/items/{id}` (수량 변경)
- `DELETE /api/cart/items/{id}`

### 주문
- `POST /api/orders`
- `GET /api/orders`
- `GET /api/orders/{id}`
- `POST /api/orders/{id}/reorder`

### 관리자
- `GET/PUT /api/admin/settings`
- `GET/PUT /api/admin/pricing/*`
- `PUT /api/admin/orders/{id}/status`

## 4) 주문 생성 트랜잭션 설계

`POST /api/orders` 서버 처리 순서:

1. 요청 스키마 검증
2. 장바구니 아이템 조회(서버 저장 기준)
3. 아이템별 견적 재계산(서버 `QuoteService`)
4. 총액 계산
5. `orders` insert
6. `order_items` bulk insert
7. `order_files` insert
8. `order_history` insert (접수)
9. 커밋

실패 시 롤백 + 에러 응답

## 5) 견적서 화면 포팅 포인트

- React의 `lines[]` 구조를 그대로 사용하면 UI 포팅 쉬움
  - `key`, `label`, `unit`, `qty`, `total`, `desc`
- 견적서 출력(인쇄/PDF)
  - PHP 템플릿 + CSS print 스타일
  - 또는 서버 PDF 생성 라이브러리(domPDF/snappy)

## 6) 파일 업로드 포팅

- 엔드포인트: `POST /api/uploads/order-files`
- 처리:
  - 파일 유효성 검사(크기/MIME)
  - 저장소 업로드
  - 파일 메타 DB 저장
  - URL 반환
- 주문 생성 시 파일 ID/URL 연결

## 7) 상태 전이 규칙

현재 단계:
- 접수 -> 인쇄 -> 후가공 -> 제본 -> 검수 -> 출고 -> 배송완료

서버에서 강제:
- 이전 단계 건너뛰기 금지(필요 시 관리자 권한 override)
- 변경 이력 기록(`order_history`)

## 8) 화면별 PHP 포팅 체크리스트

### Configure
- [ ] 사양 선택 폼
- [ ] 실시간 견적 API 호출
- [ ] 저장 사양 불러오기
- [ ] 파일 업로드 연동

### Cart
- [ ] 아이템 목록/합계
- [ ] 수량 변경 시 재계산 API
- [ ] 삭제/이동

### Checkout
- [ ] 고객정보 검증
- [ ] 주문 생성 API 호출
- [ ] 성공 페이지 이동

### Orders
- [ ] 목록/상세
- [ ] 재주문 API
- [ ] 상태 타임라인

### Admin
- [ ] 가격표 CRUD/엑셀 I/O
- [ ] 설정(`taxRate`, `deliveryFee`, `useInnerPaperCost`)
- [ ] 주문 상태 관리

## 9) 보안/운영 필수사항

- CSRF 보호
- 관리자 API 권한 검사
- 입력 유효성 검사
- 파일 업로드 제한(확장자/크기)
- 감사 로그(누가, 무엇을, 언제 수정)

## 10) 성능 전략

- 주문 목록 pagination
- 가격표 캐싱(메모리/Redis)
- 견적 계산 endpoint rate limit
- 인덱스 최적화:
  - `orders(created_at, status)`
  - `order_items(order_id)`
  - `order_files(order_item_id)`

## 11) 단계별 전환 계획

1. QuoteService(PHP) 완성 + 기존 결과와 비교검증
2. 주문 API 전환 (`Checkout`, `Orders`, `Admin` 순)
3. 설정/가격표 API 전환
4. 파일 업로드 전환
5. Supabase 코드 제거

## 12) 완료 기준 (Definition of Done)

- 일반/커스텀 견적 계산 결과가 기존과 동일
- 주문 생성/상태 변경/재주문 동작 동일
- 관리자 설정에서 `useInnerPaperCost` 반영 확인
- 장애 대응 문서(복구/롤백) 준비 완료

