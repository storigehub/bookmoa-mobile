# Supabase -> PHP + MariaDB 마이그레이션 가이드

이 문서는 현재 `bookmoa-mobile`의 Supabase 기반 데이터 저장 구조를 PHP + MariaDB 운영 환경으로 이전하기 위한 실제 절차를 정리합니다.

## 1) 목표와 범위

- 현재 상태
  - 앱 데이터 저장: `app_config` KV 구조 (Supabase)
  - 인증: Supabase Auth (관리자 로그인)
  - 파일: Supabase Storage `order-files` 버킷
- 이전 목표
  - 데이터: MariaDB 정규 테이블로 분리 저장
  - API: PHP(REST)로 조회/저장/인증/파일업로드 제공
  - 프론트: 기존 React 유지 또는 단계적 교체 가능

## 2) 권장 마이그레이션 전략

- Big Bang보다 **점진적 전환(Parallel Run)** 권장
  1. PHP API + MariaDB 먼저 구축
  2. Supabase 데이터 읽기 -> MariaDB 이관 스크립트 실행
  3. 프론트 저장/조회 API를 점진 전환
  4. 안정화 후 Supabase 의존 제거

## 3) 데이터 모델 설계 (MariaDB)

현재 `p4-*` 키를 그대로 JSON 컬럼으로만 두지 말고, 아래처럼 분리 권장:

- `settings`
  - `id`, `biz_name`, `ceo`, `biz_no`, `tel`, `fax`, `email`, `addr`
  - `tax_rate`, `delivery_fee`, `delivery_days`, `memo`, `use_inner_paper_cost`
- `pricing_profiles`
  - `id`, `name`, `is_active`, `created_at`, `updated_at`
- `pricing_print_table`
  - `profile_id`, `counter_c`, `print_type`, `unit_price`
- `pricing_binding_table`
  - `profile_id`, `qty_q`, `binding_type`, `unit_price`
- `pricing_inner_papers`
  - `profile_id`, `paper_name`, `size_code`, `unit_price`
- `pricing_cover_papers`
  - `profile_id`, `paper_name`, `size_code`, `unit_price`
- `pricing_coating_table`
  - `profile_id`, `cover_size`, `coating_type`, `unit_price`
- `pricing_endpapers`, `pricing_postproc`
- `orders`, `order_items`, `order_files`, `order_history`
- `custom_products`, `custom_option_groups`, `custom_options`, `custom_qty_tiers`
- `saved_configs`, `notifications`, `price_histories`
- `admin_users`, `admin_sessions` (또는 JWT/Redis)

## 4) Supabase 데이터 추출

현재 구조는 `app_config(key, value)`이므로 key별 JSON 추출:

- `p4-cart`
- `p4-orders`
- `p4-pricing`
- `p4-notifs`
- `p4-phist`
- `p4-saved`
- `p4-settings`
- `p4-cprods`

추출 원칙:
- JSON 그대로 파일로 백업 (`.json`)
- 각 key별 레코드 건수/해시값 기록
- 마이그레이션 로그 테이블(`migration_logs`)에 단계별 기록

## 5) 변환(Transform) 규칙

- 주문
  - `orders[].items[]`를 `orders` + `order_items`로 분리
  - `files[]`는 `order_files`로 분리
- 가격
  - `printTable`, `bindingTable`, `innerPapers` 등 중첩 배열/객체를 row화
- 설정
  - `settings.useInnerPaperCost` 포함
- 커스텀 상품
  - 옵션그룹/선택지/수량구간 정규화

## 6) 적재(Load) 절차

1. 스키마 생성
2. 기준 데이터(설정/가격) 적재
3. 상품/옵션 적재
4. 주문/주문상세/파일/이력 적재
5. 검증 쿼리 실행

검증 예시:
- 총 주문 건수 일치
- 주문별 총액 합계 일치
- 최근 N건 주문의 품목/수량/합계 랜덤 샘플 대조

## 7) PHP API 설계 권장

엔드포인트 예시:
- `POST /api/admin/login`
- `GET /api/settings`, `PUT /api/settings`
- `GET /api/pricing`, `PUT /api/pricing/*`
- `GET /api/orders`, `POST /api/orders`, `PUT /api/orders/{id}/status`
- `POST /api/uploads/order-files`
- `GET /api/custom-products`, `POST/PUT/DELETE /api/custom-products/{id}`

공통 규칙:
- JSON 응답 표준화: `{ ok, data, error }`
- 서버측 유효성 검사 필수
- 트랜잭션 사용(주문 생성/수정)

## 8) 인증/권한 전환

- Supabase Auth -> PHP 인증 전환
- 최소 요건:
  - `admin_users` 비밀번호 해시(`password_hash`)
  - 세션 쿠키(HttpOnly, Secure, SameSite) 또는 JWT
  - 관리자 API 권한 미들웨어
  - 로그인 시도 제한/로그 기록

## 9) 파일 업로드 전환

- Supabase Storage -> PHP 업로드 스토리지
- 선택지:
  - 로컬/NAS
  - S3 호환 스토리지
- 저장 필드:
  - 원본명, 저장경로, mime, size, checksum, uploaded_at

## 10) Cutover 체크리스트

- [ ] DB 백업/복구 리허설 완료
- [ ] API 부하 테스트 통과
- [ ] 견적 계산 결과 샘플 비교 완료
- [ ] 관리자 로그인/주문 상태 변경/파일 다운로드 검증 완료
- [ ] 롤백 절차 문서화 완료

## 11) 롤백 플랜

- 전환 직전 전체 백업
- 문제 발생 시:
  1. 프론트 API 엔드포인트 Supabase 경로로 즉시 복귀
  2. MariaDB 쓰기 중단
  3. 장애 원인 분석 후 재이관

## 12) 권장 일정(예시)

- Day 1-2: MariaDB 스키마 + PHP API 골격
- Day 3: 데이터 추출/변환 스크립트 작성
- Day 4: 스테이징 이관 + 검증
- Day 5: 운영 반영 + 모니터링

