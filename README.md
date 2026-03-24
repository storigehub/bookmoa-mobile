# 북모아 Printable

(주)북모아 디지털 인쇄 견적/주문 시스템

## 기술 스택

- **프론트엔드**: React 18 + Vite + Tailwind CSS 4
- **차트**: Recharts
- **엑셀**: SheetJS (xlsx)
- **배포**: Vercel
- **데이터**: localStorage (Stage 1) → Supabase (Stage 2)

## 로컬 개발

```bash
npm install
npm run dev
```

`http://localhost:5173` 에서 확인

## 배포 (Vercel)

### Stage 1: Vercel 배포 (localStorage)

1. GitHub에 push
2. [vercel.com](https://vercel.com) → New Project → GitHub 레포 연결
3. Framework: Vite (자동 감지)
4. Deploy 클릭 → 완료

### Stage 2: Supabase 연동

1. [supabase.com](https://supabase.com) → New Project (Region: Northeast Asia)
2. SQL Editor에서 `supabase/migration.sql` 실행
3. Project Settings → API → URL과 anon key 복사
4. Vercel → Settings → Environment Variables:
   - `VITE_SUPABASE_URL` = Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = Supabase anon key
5. Redeploy → Supabase 자동 연동

## 프로젝트 구조

```
bookmoa-printable/
├── index.html          # HTML 엔트리
├── package.json
├── vite.config.js      # Vite + Tailwind 설정
├── vercel.json         # Vercel SPA 설정
├── .env.example        # 환경변수 템플릿
├── public/
│   └── favicon.svg
├── src/
│   ├── main.jsx        # React 엔트리
│   ├── index.css       # Tailwind import
│   ├── App.jsx         # 메인 앱 (전체 기능)
│   └── lib/
│       ├── storage.js  # 스토리지 추상화 (localStorage ↔ Supabase)
│       └── supabase.js # Supabase 클라이언트
└── supabase/
    └── migration.sql   # DB 스키마 (Stage 2)
```

## 라이선스

© 2025 (주)북모아. All rights reserved.
