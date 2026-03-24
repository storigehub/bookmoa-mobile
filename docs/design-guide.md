# 나의이야기 (My Story) — Design Guide

> **최종 업데이트**: 2026-03-21
> **적용 버전**: Phase 8 완료 시점

---

## 1. 디자인 철학

**"따뜻한 미니멀리즘 (Warm Minimalism)"**

- 고급스러운 편집 디자인을 기반으로 한 에디토리얼 스타일
- 따뜻한 브라운 계열 색상 팔레트 — 책과 종이의 질감을 연상
- 과도한 장식 배제, 타이포그래피와 여백으로 격조를 표현
- 주 타겟이 중장년층이므로 가독성과 직관성 최우선

---

## 2. 색상 팔레트 (Color Palette)

### 기본 색상

| 토큰명 | 값 | 용도 |
|--------|-----|------|
| `bg` | `#FAFAF8` | 전체 배경 (따뜻한 오프화이트) |
| `warm` | `#F5F2ED` | 섹션 교번 배경, 입력 영역 배경 |
| `dark` | `#1A1816` | CTA 버튼, 다크 섹션 배경 |
| `card` | `#FFF` | 카드 배경 |
| `text` | `#1A1816` | 본문 텍스트 |
| `subtext` | `#6B6560` | 보조 텍스트 |
| `muted` | `#78716C` | 비활성 텍스트, 라벨 |
| `light` | `#D6D3D1` | 구분선(밝은) |

### 강조 색상

| 토큰명 | 값 | 용도 |
|--------|-----|------|
| `accent` | `#8B5E34` | 브랜드 강조 (브라운), 링크, 포커스 링 |
| `accentBg` | `#FBF7F2` | 강조 배경 |
| `accentBorder` | `#E8D5BF` | 강조 테두리 |

### 테두리

| 토큰명 | 값 | 용도 |
|--------|-----|------|
| `border` | `#E7E5E0` | 기본 테두리 |
| `borderLight` | `#F0EEEA` | 미세 구분선, 테이블 행 구분 |

### 기능 색상 (토큰 외)

| 색상 | 용도 |
|------|------|
| `#7C3AED` | 인터뷰어 메시지 (보라색) |
| `#16a34a` | 성공 상태, 공개 배지 |
| `#c0392b` | 에러 메시지 |
| `#ea580c` | 통계 강조 (오렌지) |

---

## 3. 타이포그래피 (Typography)

### 서체

| 용도 | 서체 스택 |
|------|----------|
| **제목/본문** (serif) | `'Noto Serif KR', Georgia, serif` |
| **UI/라벨** (sans) | `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` |

### 크기 체계

| 토큰 | 크기 | 용도 |
|------|------|------|
| `xs` | 10px | 뱃지, 캡션 |
| `sm` | 11px | 라벨, 태그 |
| `base` | 14px | 기본 UI 텍스트 |
| `lg` | 15px | 강조 본문 |
| `xl` | 16px | 큰 본문 |
| `2xl` | 17px | 섹션 소제목 |
| `3xl` | 18px | 카드 제목 |
| `4xl` | 20px | 페이지 제목 |

### 반응형 제목

| 토큰 | clamp 값 | 용도 |
|------|----------|------|
| `h1` | `clamp(2rem, 7vw, 2.6rem)` | 히어로 대제목 |
| `h2` | `clamp(1.1rem, 4.5vw, 1.3rem)` | 섹션 제목 |

### 글꼴 크기 프리셋 (사용자 설정)

| 프리셋 | 본문 | 채팅 | 산문 | 책 | 행간 |
|--------|------|------|------|-----|------|
| `normal` | 16px | 16px | 17px | 17px | 2.0 |
| `large` | 19px | 19px | 20px | 20px | 2.2 |

---

## 4. 간격과 모서리 (Spacing & Radius)

### 모서리 반경

| 토큰 | 값 | 용도 |
|------|-----|------|
| `radius` | 8px | 카드, 컨테이너 |
| `radiusSm` | 6px | 버튼, 입력 |

### 그림자

| 토큰 | 값 | 용도 |
|------|-----|------|
| `shadowSm` | `0 1px 3px rgba(0,0,0,.04)` | 미세 그림자 |
| `shadowLg` | `0 4px 20px rgba(0,0,0,.06)` | 카드 그림자 |

---

## 5. 애니메이션 (Animation)

### Keyframes

| 이름 | 동작 | 용도 |
|------|------|------|
| `fadeIn` | 아래→위 6px + 투명→불투명 | FAQ 답변 |
| `fadeUp` | 아래→위 32px + 투명→불투명 | 히어로 진입 |
| `fadeLeft` | 오른쪽→왼쪽 32px + 투명→불투명 | 히어로 이미지 |
| `scrollBounce` | Y축 바운스 | 스크롤 힌트 |
| `pulse` | 투명도 깜빡임 | 로딩 상태 |
| `dot` | Y축 점프 | 로딩 도트 |

### 히어로 진입 시퀀스

```
.hero-content  → fadeUp 1s     (0ms delay)
.hero-sub      → fadeUp 1s     (180ms delay)
.hero-cta      → fadeUp 1s     (320ms delay)
.hero-img      → fadeLeft 1.1s (100ms delay)
```

이징: `cubic-bezier(0.16, 1, 0.3, 1)` — 빠르게 감속하는 자연스러운 모션

### 스크롤 Reveal (업데이트: 2026-03-21)

**GPU 가속**: 모든 reveal 요소에 `will-change: transform, opacity` + `backface-visibility: hidden` 적용

| 클래스 | 시작 상태 | 종료 상태 | 용도 |
|--------|----------|----------|------|
| `.reveal` | `translateY(44px)` + opacity 0 | 원위치 | 기본 하단→위 슬라이드 |
| `.reveal-left` | `translateX(-48px) translateY(12px)` + opacity 0 | 원위치 | 좌측에서 진입 |
| `.reveal-right` | `translateX(48px) translateY(12px)` + opacity 0 | 원위치 | 우측에서 진입 |
| `.reveal-blur` | `scale(0.97) translateY(28px)` + `blur(10px)` + opacity 0 | 원위치 | 블러 해제 효과 (고급) |
| `.reveal-scale` | `scale(0.93) translateY(20px)` + opacity 0 | 원위치 | 확대 진입 |

**딜레이 클래스**: `.reveal-delay-1`(0.1s) ~ `.reveal-delay-5`(0.60s) — 5단계
**이징**: `cubic-bezier(0.16, 1, 0.3, 1)`, 0.85~0.95s
**트리거**: `IntersectionObserver` (threshold: 0.12)

### 랜딩 섹션별 reveal 배치

| 섹션 | 제목 | 카드/콘텐츠 |
|------|------|------------|
| HOW IT WORKS | `.reveal-blur` | `.reveal` + delay |
| WHY 카드 | `.reveal` | 좌(`reveal-left`) · 중(`reveal-blur`) · 우(`reveal-right`) 교차 진입 |
| FOR WHOM 카드 | `.reveal` | 대형 좌(`reveal-left`), 우측 카드(`reveal-right`) + delay 1~4 |
| CTA 다크 섹션 | `.reveal` | 버튼 `.cta-btn reveal` |
| FAQ | `.reveal` | 각 항목 delay 순차 |

### 인터랙션 애니메이션

| 클래스 | 효과 |
|--------|------|
| `.cta-btn:hover` | Y -3px + 진한 그림자 |
| `.card-hover:hover` | Y -6px + 넓은 그림자 |
| `.img-zoom:hover img` | scale(1.05) |
| `.btn-outline-hover:hover` | 배경 다크 전환 |

---

## 6. 랜딩 페이지 구조 (Landing Page)

### 아키텍처

```
app/page.tsx (Server Component, ISR)
  └── getLandingConfig() → Supabase site_config 테이블 조회
  └── <LandingClient config={config} />

components/LandingClient.tsx (Client Component)
  └── config prop으로 서버에서 받은 데이터 사용
  └── 관리자 설정 없으면 DEFAULT_* 상수로 폴백
```

**ISR 설정**: `revalidate = 3600` (1시간 캐시) + 관리자 저장 시 `revalidatePath('/')` 온디맨드 재검증

### 섹션 구성

| 순서 | 섹션 | 배경색 | 설명 |
|------|------|--------|------|
| 1 | Hero | `#FAFAF8` | 2컬럼 분할 (텍스트 + 전면 이미지) |
| 2 | HOW IT WORKS | `#FAFAF8` | 3단계 가이드 (아웃라인 원 + 워터마크 숫자) |
| 3 | WHY (가치 제안) | `#F5F2ED` | 3개 카드 (이미지 + 태그 + 제목 + 설명) |
| 4 | FOR WHOM | `#FFF` | 5개 비대칭 그리드 카드 |
| 5 | CTA | `#1A1816` | 다크 섹션, 시작하기 버튼 |
| 6 | FAQ | `#FAFAF8` | 아코디언 형식 |
| 7 | Footer | `#FAFAF8` | 미니멀 푸터 |

### 히어로 레이아웃

```
Desktop (min-width: 769px)
┌─────────────────────────────────────────┐
│  텍스트 (55%)           │  이미지 (45%) │
│  - 제목 (h1, accent)   │  - objectFit  │
│  - 부제목               │    cover      │
│  - CTA 버튼 2개         │  - 인용구 카드 │
│  - 스크롤 인디케이터     │    (overlay)  │
└─────────────────────────────────────────┘

Mobile (max-width: 768px)
┌───────────────┐
│  이미지 (52vh) │  ← order: -1로 상단 배치
│  (전체 폭)     │
├───────────────┤
│  텍스트        │
│  - 제목        │
│  - 부제목      │
│  - CTA 버튼    │
│  (인용구 숨김)  │
└───────────────┘
```

### HOW IT WORKS 카드

- 왼쪽: 아웃라인 원(56px, border: 1.5px `#D6D3D1`) + SVG 아이콘
- 워터마크: 큰 숫자(01/02/03), opacity 0.045, 오른쪽 정렬
- 영문 라벨: `CHOOSE` / `TALK` / `FINISH` (11px, letterSpacing 3px)
- 세로 점선 연결선 (1px dashed `#E7E5E0`)

### WHY 카드 (3개)

```
┌──────────────────┐
│  이미지 (56% 높이) │  objectFit: cover
├──────────────────┤
│  태그 (pill)      │  accent 색상
│  제목 (serif)     │  18px, 행간 1.6
│  설명 (sans)      │  13px, muted
└──────────────────┘
```

### FOR WHOM 카드 (5개 비대칭 그리드)

```
Desktop Grid: 3열 × 3행
┌───────────────────────────────────────────┐
│  Card 1 (대형)    │  Card 2            │
│  col 1, row 1-2   │  col 2, row 1      │
│  420px             │  224px             │
├───────────────────┼────────────────────┤
│                    │  Card 3            │
│                    │  col 2, row 2      │
│                    │  224px             │
├───────────────────┴────────────────────┤
│  Card 4        │  Card 5              │
│  col 1, row 3  │  col 2, row 3        │
│  176px         │  176px               │
└───────────────────────────────────────────┘

gridTemplateColumns: '1.1fr 1fr'
gridTemplateRows: '224px 224px 176px'
gap: 14px

Mobile: 단일 컬럼, 첫 카드 240px, 나머지 200px
```

카드 스타일:
- 이미지 배경 + 그라데이션 오버레이 (`rgba(0,0,0,0) 30%` → `rgba(0,0,0,0.55)`)
- 텍스트는 하단 좌측 (흰색)
- 태그: pill 스타일 (`rgba(255,255,255,0.2)` 배경)

---

## 7. 반응형 디자인 (Responsive)

### 브레이크포인트

| 너비 | 대상 |
|------|------|
| `≤ 639px` | 모바일 (히어로 텍스트 패딩, 인용구 숨김, 인터뷰어 레이아웃) |
| `≤ 768px` | 태블릿 (히어로 세로 전환, 5카드 단일 컬럼) |
| `≥ 700px` | 로그인 브랜드 패널 표시 |

### 터치 타겟

```css
@media(hover:none) and (pointer:coarse) {
  button, a, [role=button] { min-height: 44px; min-width: 44px; }
  .touch-compact { min-height: 36px; min-width: 36px; }
}
```

### Safe Area

```css
.sa-b    { padding-bottom: max(14px, env(safe-area-inset-bottom)); }
.sa-b-lg { padding-bottom: max(20px, calc(env(safe-area-inset-bottom) + 8px)); }
```

### 접근성

- `prefers-reduced-motion: reduce` → 모든 애니메이션 0.01ms로 단축
- `button:focus-visible` → 2px solid `#A0522D` 아웃라인
- 입력 포커스 → 브라운 테두리 + 12% 투명도 글로우

---

## 8. 컴포넌트 스타일 패턴

### 카드 기본

```typescript
{
  background: TOKENS.card,        // #FFF
  border: `1px solid ${TOKENS.borderLight}`,  // #F0EEEA
  borderRadius: 12,
  padding: '20px 24px',
}
```

### 입력 필드

```typescript
{
  padding: '10px 12px',
  border: `1px solid ${TOKENS.border}`,
  borderRadius: TOKENS.radiusSm,  // 6px
  fontFamily: TOKENS.sans,
  fontSize: 14,
  background: TOKENS.card,
  color: TOKENS.text,
}
```

### 라벨

```typescript
{
  fontSize: 11,
  fontFamily: TOKENS.sans,
  color: TOKENS.muted,
  letterSpacing: 2,
}
```

### CTA 버튼 (Primary)

```typescript
{
  background: TOKENS.dark,        // #1A1816
  color: '#FAFAF9',
  border: 'none',
  borderRadius: TOKENS.radiusSm,
  fontSize: 14,
  fontFamily: TOKENS.sans,
}
```

### 태그/배지 (Pill)

```typescript
// 공개 상태
{ background: '#F0FDF4', color: '#16a34a', border: '1px solid #bbf7d0' }

// 비공개 상태
{ background: TOKENS.warm, color: TOKENS.muted, border: `1px solid ${TOKENS.borderLight}` }

// 강조 태그
{ background: TOKENS.accentBg, color: TOKENS.accent, border: `1px solid ${TOKENS.accentBorder}` }
```

---

## 9. 이미지 처리

### 클라이언트 압축 (`lib/compress-image.ts`)

Vercel Serverless Function의 4.5MB 요청 제한 대응:

- **최대 해상도**: 1920px (긴 변 기준)
- **목표 크기**: ≤ 3MB (JPEG)
- **품질 단계**: 0.85 → 0.25 (0.1씩 감소, 목표 미달 시)
- **처리 방식**: HTML5 Canvas 리사이즈 + toBlob JPEG 변환
- **적용 위치**: NormalEditor (글쓰기 사진), CoverEditor (표지 사진)

### 이미지 소스

- **사용자 사진**: Cloudinary CDN (`/api/upload/photo`)
- **랜딩 기본 이미지**: Pexels CDN (한국/아시아인 사진)
- **관리자 커스텀 이미지**: Cloudinary 업로드 또는 외부 URL

### 랜딩 이미지 관리

관리자 페이지(`/admin/landing`)에서 모든 랜딩 이미지 교체 가능:
- Cloudinary 직접 업로드 (버튼)
- 외부 이미지 URL 입력
- Supabase `site_config` 테이블에 JSON 저장
- 저장 시 ISR 캐시 즉시 무효화 → 다음 방문자부터 반영

---

## 10. 관리자 CMS (Admin Landing)

### 경로

- **UI**: `/admin/landing`
- **API**: `/api/admin/landing` (GET/POST, `x-admin-password` 헤더 인증)

### 관리 가능 항목

| 섹션 | 필드 |
|------|------|
| **Hero** | 이미지, 제목, 강조 단어, 부제목, 인용구, 인용 저자 |
| **WHY 카드** (×3) | 이미지, 태그, 제목, 설명 |
| **FOR WHOM 카드** (×5) | 이미지, 태그, 제목, 설명 |

### 제로 깜빡임 구조

```
관리자 저장 → Supabase upsert → revalidatePath('/') 호출
  → CDN 캐시 즉시 무효화
  → 다음 요청 시 Server Component가 새 데이터 fetch
  → LandingClient에 props로 전달 (클라이언트 fetch 없음)
  → 깜빡임 없이 즉시 새 이미지/텍스트 표시
```

---

## 11. 페이지별 디자인 특성

### 글쓰기 (`/write`)

- 좌측 사이드바: 챕터 목록 (모바일: 상단 수평 칩)
- 대화 모드: 채팅 버블 (user: 우측, ai: 좌측, interviewer: 보라색 좌측)
- 일반 모드: 자유 텍스트 영역 + 사진 삽입
- 모드 탭: 모바일에서 컴팩트 (12px, 패딩 축소)

### 책 읽기 (`/book`, `/shared/[id]`)

- Brunch 스타일 스크롤 리더
- FlipBook: react-pageflip 페이지 넘기기
- 챕터 네비게이션: IntersectionObserver, 이전/다음 버튼, 플로팅 TOC
- 공유 드로어: 데스크탑 우측 패널, 모바일 바텀시트 전환

### 마이페이지 (`/my`)

- 에디토리얼 헤더 (로고 좌측, 로그아웃 pill 우측)
- 정렬 탭: 최신순/오래된순/제목순
- 책 카드: 이어쓰기 + 읽기 버튼 분리, 챕터 진행률 바
- 빈 상태: CSS 책 아이콘 + 따뜻한 안내문 + 시작 CTA

### 인터뷰어 (`/interviewer/[id]`)

- 좌측 사이드바: 챕터 칩 (모바일: 상단 수평 스크롤)
- "실시간 연결 중" 헤더 표시
- 질문 입력: 하단 고정 바
- 모바일: safe-area-inset-bottom 대응

---

## 12. 한글 IME 처리

모든 텍스트 입력에 필수 적용:

```typescript
const composingRef = useRef(false);

<input
  onCompositionStart={() => { composingRef.current = true; }}
  onCompositionEnd={() => { composingRef.current = false; }}
  onKeyDown={(e) => {
    if (e.key === 'Enter' && !e.shiftKey && !composingRef.current) {
      e.preventDefault();
      handleSubmit();
    }
  }}
/>
```

---

## 13. 온보딩 모달

- 첫 방문 시만 표시 (`localStorage.mystory_visited`)
- `dynamic(() => import(...), { ssr: false })` — hydration 불일치 방지
- CSS 책 모양 아이콘 + 3단계 가이드 + "시작하기" CTA
- 배경 클릭 또는 X 버튼으로 닫기

---

## 14. 커버 템플릿

5종의 책 표지 디자인:

| ID | 이름 | 특징 |
|----|------|------|
| `classic` | 클래식 | 기본 브라운 톤 |
| `modern` | 모던 | 미니멀 다크 |
| `warm` | 따뜻한` | 밝은 베이지 |
| `nature` | 자연 | 그린 톤 |
| `elegant` | 우아한 | 딥 네이비 |

---

## 15. 파일 참조

| 파일 | 역할 |
|------|------|
| `lib/design-tokens.ts` | 디자인 토큰 정의 (색상, 서체, 크기, 그림자) |
| `app/globals.css` | 글로벌 CSS (애니메이션, 반응형, 접근성) |
| `lib/compress-image.ts` | 이미지 클라이언트 압축 유틸 |
| `components/LandingClient.tsx` | 랜딩 페이지 클라이언트 컴포넌트 |
| `app/admin/landing/page.tsx` | 관리자 랜딩 CMS UI |
| `app/api/admin/landing/route.ts` | 관리자 랜딩 API |
