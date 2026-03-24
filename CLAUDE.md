# CLAUDE.md — Claude Code CLI 프로젝트 컨텍스트

## 프로젝트 개요
- **프로젝트명**: 북모아 Printable (BookMoa Printable)
- **설명**: (주)북모아 디지털 인쇄 견적/주문 시스템
- **사업자**: (주)북모아 / 대표 김동명 / TEL 1644-1814
- **현재 버전**: v1.3 (Stage 2/3/4 완료)

## 기술 스택
- React 18 (단일 파일 SPA: src/App.jsx)
- Vite 6 + Tailwind CSS 4
- Recharts (차트)
- SheetJS/xlsx (엑셀 import/export)
- Supabase (DB + Auth + Storage — 활성화됨)
- Vercel (배포 / GitHub 자동 배포 연동)

## 배포 정보
- **GitHub**: https://github.com/storigehub/bookmoa-mobile
- **Vercel**: https://bookmoa-mobile.vercel.app (고정 URL)
- **Vercel 팀**: storigehubs-projects
- **Supabase 프로젝트**: bookmoa (ap-northeast-1 / ctzfhlqkvkuvpioiincm)
- **배포 방식**: main 브랜치 push → Vercel 자동 배포 (별도 배포 명령 불필요)

## 주요 명령어
```bash
npm install        # 의존성 설치
npm run dev        # 개발 서버 (localhost:5173)
npm run build      # 프로덕션 빌드
npm run preview    # 빌드 미리보기
```

## 파일 구조
```
src/App.jsx           # 메인 앱 (전체 컴포넌트, ~1290줄)
src/lib/storage.js    # 스토리지 추상화 (localStorage ↔ Supabase)
src/lib/supabase.js   # Supabase 클라이언트
supabase/migration.sql # DB 스키마 (Stage 1)
docs/                 # 개발 문서
```

## 아키텍처 핵심
- **단일 파일 SPA**: 모든 컴포넌트가 App.jsx에 포함
- **라우팅**: useState 기반 page 상태 (home, configure, cart, checkout, orders, admin 등)
- **상태관리**: React Context (Ctx) + useCallback으로 전역 상태 공유
- **스토리지**: sLoad/sSave 함수 — localStorage 기본, 환경변수 설정 시 Supabase 자동 전환
- **스토리지 키**: p4-cart, p4-orders, p4-pricing, p4-notifs, p4-phist, p4-saved, p4-settings, p4-cprods
- **인증**: Supabase Auth (이메일/비밀번호) — Admin 페이지 진입 시 필수
- **관리자 계정**: admin@bookmoa.com (초기 비밀번호: Bookmoa1234!)

## Supabase 구성
- **DB 테이블**: app_config (KV 스토어, RLS 활성화)
- **Auth**: 이메일/비밀번호, admin@bookmoa.com 계정
- **Storage**: order-files 버킷 (공개, 100MB 제한)
  - 파일 업로드: 견적/커스텀 상품 장바구니 담기 시 자동 업로드
  - 관리자 주문 목록에서 다운로드 링크 표시

## 디자인 시스템
- **테마**: BookMoa 그린 (#7CB342 기반)
- **디자인 토큰**: T 객체 (App.jsx 상단)
- **주요 색상**: accent=#7CB342, dark=#1C2912, bg=#FFFFFF, warm=#F7F7F5
- **카드 스타일**: Editorial Card (사진/일러스트 + 제목 + 설명 + 링크)
- **폰트**: Noto Sans KR (산세리프 중심)

## 개발 시 주의사항
- App.jsx가 ~170KB로 크므로 수정 시 정확한 줄 번호 확인 필요
- 가격 데이터(innerPapers)가 45종×9규격으로 용량이 큼
- 46판/국판은 기준가, 나머지 7개 절수는 자동 계산 (recalcPaper 함수)
- 견적 계산 로직: calcQuote (일반), calcCustomQuote (커스텀 상품)
- supabase import가 App.jsx 상단에 추가됨 (`import { supabase } from './lib/supabase'`)
- session/setSession이 Context(Ctx)에 포함됨
- Admin 컴포넌트: session 없으면 AdminLogin 렌더링 (조기 반환)
- handleAdd (Configure, ProdConfigure): async 함수, 파일 업로드 후 장바구니 추가

## 향후 개발 계획 (TODO)
- [x] Supabase DB 연동 (Stage 2 완료)
- [x] Supabase Auth 관리자 로그인 (Stage 3 완료)
- [x] RLS 정책 적용 (Stage 2 완료)
- [x] 파일 업로드 — Supabase Storage (Stage 4 완료)
- [ ] 컴포넌트 파일 분리 (App.jsx → 개별 파일)
- [ ] 주문 알림 (이메일/카카오톡) — Resend API 활용 가능
- [ ] 결제 연동 (토스페이먼츠 등)
- [ ] 관리자 비밀번호 변경 UI
