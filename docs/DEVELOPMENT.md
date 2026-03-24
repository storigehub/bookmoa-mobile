# 개발 이력 및 아키텍처 문서

> 최종 업데이트: 2026-03-24 | 버전: v1.3 (Stage 4 완료)

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

용지 수식: 46판→3절(÷1500),8절(÷4000),16절(÷8000) / 국판→국4절(÷2000),국8절(÷4000),국16절(÷8000),32절=국16절

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
- [x] Stage 2: Supabase DB 연동 완료
- [x] Stage 3: Supabase Auth + RLS 완료
- [x] Stage 4: 파일 업로드 완료
- [ ] Stage 5: 주문 알림 (Resend 이메일)
- [ ] Stage 6: 결제 연동 (토스페이먼츠)
- [ ] Stage 7: 컴포넌트 파일 분리
