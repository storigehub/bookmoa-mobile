# PHP 포팅 작업 현황 (WIP)

> 작성일: 2026-04-08  
> 컨텍스트 한도로 중단된 지점 기록 — 재개 시 이 파일 먼저 확인

---

## 요청 원문

> 현재 supabase DB를 php+mariaDB로 운영하고 있는 시스템으로 데이터베이스를 마이그레이션하기 위한 방법과 절차를 자세히 정리해서 md 파일로 작성해서 /docs 폴더에 저장해주세요,  
> 그리고 **계산로직과 견적을 계산하는 주문화면의 소스도 php로 포팅하기 위한 내용을 아주 자세하게 md 파일로 각각 저장해주세요**

---

## 완료된 작업

| # | 파일 | 상태 | 설명 |
|---|------|------|------|
| 1 | `docs/migration-supabase-to-php-mariadb.md` | ✅ 완료 | Supabase→PHP+MariaDB 마이그레이션 전체 가이드 (871줄) |
| 2 | `docs/php-porting-calc-logic.md` | ✅ 완료 | 견적 계산 로직 PHP 포팅 |
| 3 | `docs/php-porting-order-screen.md` | ✅ 완료 | 주문/견적 화면 PHP 포팅 |

---

## 이어서 작성할 내용

### 파일 2: `docs/php-porting-calc-logic.md`

**포팅 대상 함수 (src/App.jsx)**

- `lookupLE(val, rows, key)` — 계단식 테이블 조회
- `calcQuote(cfg, pricing, options)` — 일반 책자 견적 8단계
  - 인쇄비: `lookupLE(pages * quantity, printTable, 'c')` → rate × pages
  - 내지비: `innerPapers[innerPaper][innerSize]` / (양면 ÷2) × pages
  - 면지비: `endpapers[endpaper][format]`
  - 표지지비: `coverPapers[coverPaper][coverSize]` (무선날개/양장+A5~A4 → 3절)
  - 표지인쇄: `coverPrintRate[coverSide]` (단면200/양면400)
  - 코팅비: `coatingTable[coverSize][coating]`
  - 제본비: `lookupLE(quantity, bindingTable, 'q')`
  - 후가공비: postProc 합산
  - 최종: round(unitPrice) × quantity → subtotal → vat(10%) → total
- `calcCustomQuote(prod, selections, quantity)` — 커스텀 상품 견적
  - qtyTiers 구간별 basePrice 결정
  - optGroups priceAdj 합산
- `recalcPaper(paper)` — 46판/국판 기준가에서 절수 자동 계산
- DEF_PRICING 전체 데이터 (45종 내지, 코팅/제본/면지 테이블) → PHP 배열로 변환
- 검증 케이스: A4/모조80/양면/2001p/10부 → 1부단가 65,808.935원

**포함할 내용**
- PHP 8.1 함수 완전 구현 (JSDoc 수준 주석)
- DEF_PRICING 전체를 PHP 연관 배열로 변환
- calcQuote 결과를 JSON API로 반환하는 엔드포인트 예시
- 검증 스크립트 (엑셀 원본 케이스 대조)

---

### 파일 3: `docs/php-porting-order-screen.md`

**포팅 대상 화면 (src/App.jsx 컴포넌트)**

- `Configure` 컴포넌트 — 6단계 스텝 견적 구성 화면
  - 판형/인쇄 선택 (STEP 0)
  - 내지 종이 2단계 선택: 종류 → 평량 (STEP 1)
  - 표지/코팅 선택 (STEP 2)
  - 제본/후가공 선택 (STEP 3)
  - 견적 확인/견적서 출력 (STEP 4)
  - 파일 업로드 (STEP 5)
  - 사이드바 실시간 견적 계산 표시
- `Cart` 컴포넌트 — 장바구니 (수량 변경 시 재계산)
- `Checkout` 컴포넌트 — 주문 정보 입력 + 주문 생성
- `handleAdd` — Supabase Storage 업로드 + 장바구니 추가 로직

**포함할 내용**
- PHP+HTML 기반 페이지 구조 설계 (SPA → MPA 전환 방안)
- AJAX(fetch) 기반 실시간 견적 계산 흐름
- 파일 업로드 PHP 처리 (multipart → `/api/upload`)
- 세션/장바구니 서버 사이드 관리 방안
- 주문 생성 API 엔드포인트 (`POST /api/orders`)

---

## 핵심 소스 참조 위치

| 항목 | 파일 | 줄 범호 |
|------|------|---------|
| DEF_PRICING 전체 | src/App.jsx | 44~119 |
| lookupLE | src/App.jsx | 130 |
| calcQuote | src/App.jsx | 154~216 |
| calcCustomQuote | src/App.jsx | 227~252 |
| recalcPaper | src/App.jsx | 256~263 |
| Configure 컴포넌트 | src/App.jsx | ~579~800 |
| handleAdd (일반) | src/App.jsx | ~610 |
| Cart 컴포넌트 | src/App.jsx | ~858 |
| Checkout 컴포넌트 | src/App.jsx | ~869 |
| handleAdd (커스텀) | src/App.jsx | ProdConfigure ~1224 |

---

## 검증 케이스 (엑셀 원본 대조)

```
입력: format=A4, printType=IX-Eco, pages=2001, quantity=10,
      innerPaper=모조80, innerSide=양면,
      coverPaper=아트지250, coverSide=단면,
      coating=유광코팅, binding=무선, endpaper=없음

기대 출력:
  1. 인쇄비: 25 × 2001 = 50,025원   (전체카운터 20010 → c=20000 구간)
  2. 내지비: 6.2 × 2001 = 12,406.2원 (모조80 국8절=12.4 ÷2)
  3. 면지비: 0원
  4. 표지지: 77.735원               (아트지250 국4절)
  5. 표지인쇄: 200원
  6. 코팅: 100원                    (국4절 유광코팅)
  7. 제본: 3,000원                  (무선, 10부 → q=0 구간)
  1부단가: 65,808.935원 ✅
  공급가액: 658,090원 (×10부)
  부가세: 65,809원
  합계: 723,899원
```
