# CLAUDE.md — Claude Code CLI 프로젝트 컨텍스트

## 프로젝트 개요
- **프로젝트명**: 북모아 Printable (BookMoa Printable)
- **설명**: (주)북모아 디지털 인쇄 견적/주문 시스템
- **사업자**: (주)북모아 / 대표 김동명 / TEL 1644-1814
- **현재 버전**: v1.0 (Phase 6 완료)

## 기술 스택
- React 18 (단일 파일 SPA: src/App.jsx)
- Vite 6 + Tailwind CSS 4
- Recharts (차트)
- SheetJS/xlsx (엑셀 import/export)
- Supabase (DB, 선택적)
- Vercel (배포)

## 주요 명령어
```bash
npm install        # 의존성 설치
npm run dev        # 개발 서버 (localhost:5173)
npm run build      # 프로덕션 빌드
npm run preview    # 빌드 미리보기
```

## 파일 구조
```
src/App.jsx           # 메인 앱 (전체 컴포넌트, 1220줄)
src/lib/storage.js    # 스토리지 추상화 (localStorage ↔ Supabase)
src/lib/supabase.js   # Supabase 클라이언트
supabase/migration.sql # DB 스키마
docs/                 # 개발 문서
```

## 아키텍처 핵심
- **단일 파일 SPA**: 모든 컴포넌트가 App.jsx에 포함
- **라우팅**: useState 기반 page 상태 (home, configure, cart, checkout, orders, admin 등)
- **상태관리**: React Context (Ctx) + useCallback으로 전역 상태 공유
- **스토리지**: sLoad/sSave 함수 — localStorage 기본, 환경변수 설정 시 Supabase 자동 전환
- **스토리지 키**: p4-cart, p4-orders, p4-pricing, p4-notifs, p4-phist, p4-saved, p4-settings, p4-cprods

## 디자인 시스템
- **테마**: BookMoa 그린 (#7CB342 기반)
- **디자인 토큰**: T 객체 (App.jsx 상단)
- **주요 색상**: accent=#7CB342, dark=#1C2912, bg=#FFFFFF, warm=#F7F7F5
- **카드 스타일**: Editorial Card (사진/일러스트 + 제목 + 설명 + 링크)
- **폰트**: Noto Sans KR (산세리프 중심)

## 개발 시 주의사항
- App.jsx가 154KB로 크므로 수정 시 정확한 줄 번호 확인 필요
- 가격 데이터(innerPapers)가 45종×9규격으로 용량이 큼
- 46판/국판은 기준가, 나머지 7개 절수는 자동 계산 (recalcPaper 함수)
- 견적 계산 로직: calcQuote (일반), calcCustomQuote (커스텀 상품)

## 향후 개발 계획 (TODO)
- [ ] Supabase Auth 연동 (관리자 로그인)
- [ ] RLS 정책 적용
- [ ] 컴포넌트 파일 분리 (App.jsx → 개별 파일)
- [ ] 주문 알림 (이메일/카카오톡)
- [ ] 결제 연동 (토스페이먼츠 등)
