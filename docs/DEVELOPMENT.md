# 개발 이력 및 아키텍처 문서

> 최종 업데이트: 2026-04-08 | 버전: v1.3 (PHP 마이그레이션 문서 완료)

## 1. 개발 히스토리

### Phase 1-2: 기본 구조 (Claude Chat)
- React SPA 프레임워크, 6개 고객 페이지
- 가격 엔진 (calcQuote) — 엑셀 단가표 기반 자동 계산

### Phase 3-4: 관리자 백오피스 (Claude Chat)
- Admin Console (대시보드, 주문관리, 가격관리, 설정)
- 매출 차트 (Recharts), 알림 센터, 가격 변경 이력

### Phase 5: 편의 기능 (Claude Chat)
- 즐겨찾기 사양, 장바구니 수량 편집, 재주문, 드래그앤드롭 파일

### Phase 6: 커스텀 상품 관리 (Claude Chat)
- 커스텀 상품 CRUD (옵션 그룹, 수량별 가격, 엑셀 I/O)

### 추가 개선 (Claude Chat)
- 용지 45종 × 9규격, 수식 자동 계산 (46판/국판 기준가)
- 엑셀 수식 포함 다운로드, 북모아 그린 테마
- Editorial Card + SVG 일러스트, 공식 견적서 양식

### Stage 2: Supabase DB 연동 (Claude Code — 2026-03-24)
- app_config 테이블 RLS 활성화
- anon 읽기/쓰기 정책 적용
- localStorage → Supabase 자동 전환 (환경변수 기반, 이미 구현된 storage.js 활용)

### Stage 3: 관리자 인증 (Claude Code — 2026-03-24)
- Supabase Auth 이메일/비밀번호 로그인
- AdminLogin 컴포넌트 추가
- Admin 페이지 세션 가드 (session 없으면 로그인 화면)
- 관리자 로그아웃 버튼 추가
- 관리자 계정: admin@bookmoa.com

### Stage 4: 파일 업로드 (Claude Code — 2026-03-24)
- Supabase Storage order-files 버킷 생성 (공개, 100MB 제한)
- Configure/ProdConfigure handleAdd → async 변환, 파일 업로드 후 URL 저장
- 파일 데이터 구조: `{ name: string, url: string }` 배열
- Admin 주문 목록에 📎 파일 다운로드 링크 컬럼 추가

### 가격 엔진 버그 수정 (Claude Code — 2026-04-08)
- **버그 1**: printTable 조회 기준을 `pages` → `pages × quantity` (전체카운터)로 수정
- **버그 2**: innerPaper 비용이 sideRate 고정값만 쓰던 것을 `innerPapers[paper][size]` 직접 조회로 수정
- **버그 3**: formatMap.innerSize 4개 판형 모두 "국8절"이던 것을 올바른 절수로 수정 (B6=32절, A5=국16절, B5=16절, A4=국8절)
- **버그 4**: coatingTable을 판형 기준 → 표지 절수(coverSize) 기준으로 구조 재편
- `useInnerPaperCost` 설정 토글 추가 (관리자 설정 → 런타임 ON/OFF)
- 검증 케이스: A4/모조80/양면/2001p/10부 → 합계 723,899원 ✅

### PHP+MariaDB 마이그레이션 문서 작성 (Claude Code — 2026-04-08)
- `docs/migration-supabase-to-php-mariadb.md` — Supabase→PHP+MariaDB 마이그레이션 전체 가이드 (871줄)
  - Method A/B 전략 비교, MariaDB DDL, PHP REST API 전체 구현, 체크리스트
- `docs/php-porting-calc-logic.md` — 견적 계산 로직 PHP 포팅
  - BookmoaPricing.php (PHP 8.1, 45종 내지 포함 완전 구현), QuoteController.php
- `docs/php-porting-order-screen.md` — 주문/견적 화면 PHP 포팅
  - Configure 6단계 MPA, AJAX 실시간 견적, CartManager.php, OrderController.php, Checkout
- `docs2/` — Cursor AI 작성 보완 문서 (SQL 스키마, 데이터 적재 템플릿, p4-pricing 변환기)

### 인프라 구성 (Claude Code — 2026-03-24)
- GitHub: storigehub/bookmoa-mobile
- Vercel: storigehubs-projects 팀, main 브랜치 자동 배포
- Supabase: bookmoa 프로젝트 (ap-northeast-1)

## 2. 컴포넌트 구조
```
App (Context Provider — session/setSession 포함)
├── Nav, Home, Products
├── Configure (6단계 위저드)
│   ├── 판형&인쇄 → 내지 → 표지&코팅 → 제본&후가공
│   ├── 견적확인 (공식 양식 + 인쇄/엑셀)
│   └── 파일 업로드 (Supabase Storage 업로드)
├── Cart, Checkout, OrderDone, Orders
├── ProdConfigure (커스텀 상품 — 파일 업로드 포함)
├── AdminLogin (세션 없을 때 렌더링)
├── Admin (세션 있을 때만 — 대시보드/주문/가격/상품/알림/설정)
└── 모달 (Estimate, Receipt, Compare, ProductEditor)
```

## 3. 데이터 모델

### cfg (견적 설정)
format, pages, quantity, printType, innerPaper, innerSide,
coverPaper, coverSide, coating, binding, endpaper, postProcessing[]

### quote (견적 결과)
unitPrice, subtotal, vat, total, quantity, lines[]

### order (주문)
id, date, status(0~6), items[{cfg,quote,isCustom,files:[{name,url}]}], total, customer, payment, history[]

### CustomProduct (커스텀 상품)
id, name, icon, desc, active, optGroups[{choices[{priceAdj}]}], qtyTiers[{minQty,basePrice}]

### settings (사업자 설정)
bizName, ceo, bizNo, tel, fax, email, addr, taxRate, deliveryFee, deliveryDays, memo

## 4. 가격 엔진
```
단가 = 인쇄비 + 내지 + 면지 + 표지 + 표지인쇄 + 코팅 + 제본 + 후가공
합계 = 단가 × 수량 + VAT(10%)
```

상세 계산 흐름과 데이터 소스는 별도 문서 참고:
- [견적 기본 계산 로직 설명](./기본계산로직%20설명.md)

현재 적용 계산 포인트:
- 인쇄비 구간 조회 기준: `pages × quantity` (전체카운터 기준), 단가 적용은 `pages` 기준
- 내지비: `innerPapers[innerPaper][innerSize]` 직접 조회, 양면은 페이지당 1/2 적용
- 표지 절수: 기본 `국4절`, 단 `무선날개/양장 + A5/B5/A4`는 `3절` 적용
- 코팅비: 판형이 아닌 표지 절수(`coverSize`) 기준 조회

용지 수식(가격표 산출): 46판→3절(÷1500),8절(÷4000),16절(÷8000) / 국판→국4절(÷2000),국8절(÷4000),국16절(÷8000),32절=국16절

검증 메모:
- 가격 계산 함수(`calcQuote`, `calcCustomQuote`, `recalcPaper`)에는 설명 주석이 추가됨
- 관리자 설정에 `useInnerPaperCost` 옵션이 추가되어 런타임 ON/OFF 제어 가능

## 5. 스토리지 키 (8개)
p4-cart, p4-orders, p4-pricing, p4-notifs, p4-phist, p4-saved, p4-settings, p4-cprods

## 6. 디자인 토큰
accent: #7CB342, dark: #1C2912, bg: #FFFFFF, warm: #F7F7F5
폰트: Noto Sans KR, 모서리: 12px

## 7. 환경 변수
```
VITE_SUPABASE_URL=https://ctzfhlqkvkuvpioiincm.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>   # .env.local 및 Vercel 환경 변수에 설정됨
```

## 8. Supabase 스키마 현황
| 리소스 | 종류 | 설명 |
|--------|------|------|
| app_config | 테이블 | KV 스토어, RLS 활성화, anon 읽기/쓰기 |
| order-files | Storage 버킷 | 인쇄 파일 업로드, 공개, 100MB 제한 |
| admin@bookmoa.com | Auth 유저 | 관리자 계정 |

## 9. 향후 로드맵

### React/Supabase 현재 버전 (v1.3)
- [x] Stage 2: Supabase DB 연동 완료
- [x] Stage 3: Supabase Auth + RLS 완료
- [x] Stage 4: 파일 업로드 완료
- [x] 가격 엔진 버그 수정 4건 + useInnerPaperCost 토글
- [ ] Stage 5: 주문 알림 (Resend 이메일/카카오톡)
- [ ] Stage 6: 결제 연동 (토스페이먼츠)
- [ ] Stage 7: 컴포넌트 파일 분리 (App.jsx → 개별 파일)
- [ ] 관리자 비밀번호 변경 UI

### PHP+MariaDB 마이그레이션 (다음 단계)
> 문서 준비 완료. 아래 순서로 구현 진행 예정.

- [x] 마이그레이션 설계 문서 3종 + SQL 스키마/데이터 적재 완료
- [ ] **Step 1**: MariaDB 서버 구축 + `docs2/mariadb_이관_스키마.sql` 실행
- [ ] **Step 2**: `BookmoaPricing.php` 구현 (`docs/php-porting-calc-logic.md` 참조)
- [ ] **Step 3**: `/api/quote.php`, `/api/cart.php`, `/api/orders.php`, `/api/upload.php` 구현
- [ ] **Step 4**: `CartManager.php`, `OrderController.php` 구현
- [ ] **Step 5**: 프론트엔드 스토리지 레이어 교체 — Supabase sLoad/sSave → PHP API fetch
- [ ] **Step 6**: 기존 Supabase 데이터 MariaDB로 이관 (ETL)
- [ ] **Step 7**: 스테이징 환경 검증 + 컷오버

#### 참조 문서 순서
1. `docs/migration-supabase-to-php-mariadb.md` — 전체 전략 및 API 구조
2. `docs/php-porting-calc-logic.md` — BookmoaPricing.php 완전 구현체
3. `docs/php-porting-order-screen.md` — 화면별 PHP 구현 (Configure→Cart→Checkout)
4. `docs2/mariadb_이관_스키마.sql` — 운영용 DDL
5. `docs2/generate_full_insert_from_p4_pricing.php` — 가격 데이터 SQL 자동 생성기
