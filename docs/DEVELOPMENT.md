# 개발 이력 및 아키텍처 문서

> 최종 업데이트: 2026-03-24 | 버전: v1.0 (Phase 6 완료)

## 1. 개발 히스토리

### Phase 1-2: 기본 구조
- React SPA 프레임워크, 6개 고객 페이지
- 가격 엔진 (calcQuote) — 엑셀 단가표 기반 자동 계산

### Phase 3-4: 관리자 백오피스
- Admin Console (대시보드, 주문관리, 가격관리, 설정)
- 매출 차트 (Recharts), 알림 센터, 가격 변경 이력

### Phase 5: 편의 기능
- 즐겨찾기 사양, 장바구니 수량 편집, 재주문, 드래그앤드롭 파일

### Phase 6: 커스텀 상품 관리
- 커스텀 상품 CRUD (옵션 그룹, 수량별 가격, 엑셀 I/O)

### 추가 개선
- 용지 45종 × 9규격, 수식 자동 계산 (46판/국판 기준가)
- 엑셀 수식 포함 다운로드, 북모아 그린 테마
- Editorial Card + SVG 일러스트, 공식 견적서 양식

## 2. 컴포넌트 구조
```
App (Context Provider)
├── Nav, Home, Products
├── Configure (6단계 위저드)
│   ├── 판형&인쇄 → 내지 → 표지&코팅 → 제본&후가공
│   ├── 견적확인 (공식 양식 + 인쇄/엑셀)
│   └── 파일 업로드
├── Cart, Checkout, OrderDone, Orders
├── ProdConfigure (커스텀 상품)
├── Admin (대시보드/주문/가격/상품/알림/설정)
└── 모달 (Estimate, Receipt, Compare, ProductEditor)
```

## 3. 데이터 모델

### cfg (견적 설정)
format, pages, quantity, printType, innerPaper, innerSide,
coverPaper, coverSide, coating, binding, endpaper, postProcessing[]

### quote (견적 결과)
unitPrice, subtotal, vat, total, quantity, lines[]

### order (주문)
id, date, status(0~6), items[{cfg,quote,isCustom}], total, customer, payment, history[]

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

## 7. 향후 로드맵
- Stage 2: Supabase DB 연동 (환경변수만 설정하면 자동 전환)
- Stage 3: Supabase Auth + RLS
- 컴포넌트 파일 분리, 결제 연동, 배송 추적
