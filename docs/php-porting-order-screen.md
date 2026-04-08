# 주문/견적 화면 PHP 포팅 가이드

> 기준: `src/App.jsx` v1.3 (2026-04-08)  
> PHP 8.1 + MariaDB 10.5 + 세션 기반 MPA 설계

---

## 목차

1. [아키텍처 전환 개요](#1-아키텍처-전환-개요-spa--mpa)
2. [페이지 구조 설계](#2-페이지-구조-설계)
3. [Configure 화면 — 6단계 견적 구성](#3-configure-화면--6단계-견적-구성)
4. [AJAX 실시간 견적 계산](#4-ajax-실시간-견적-계산)
5. [파일 업로드 PHP 처리](#5-파일-업로드-php-처리)
6. [Cart 컴포넌트 — 세션 기반 장바구니](#6-cart-컴포넌트--세션-기반-장바구니)
7. [Checkout 컴포넌트 — 주문 생성](#7-checkout-컴포넌트--주문-생성)
8. [OrderController.php 전체 구현](#8-ordercontrollerphp-전체-구현)
9. [커스텀 상품 (ProdConfigure) 포팅](#9-커스텀-상품-prodconfigure-포팅)
10. [주문 확인서 출력](#10-주문-확인서-출력)
11. [라우터 설정](#11-라우터-설정)
12. [세션/상태 관리 전략](#12-세션상태-관리-전략)
13. [검증 체크리스트](#13-검증-체크리스트)

---

## 1. 아키텍처 전환 개요 (SPA → MPA)

### React SPA 현재 구조

```
App.jsx (단일 파일)
├── useState("page")  ← 라우팅
├── Configure         ← 6단계 위저드
├── Cart              ← 장바구니
├── Checkout          ← 주문 입력
├── OrderDone         ← 완료 화면
└── ProdConfigure     ← 커스텀 상품 구성
```

- **상태**: React Context(Ctx) 전역 + localStorage/Supabase  
- **견적 계산**: 브라우저에서 calcQuote() 실행  
- **파일 업로드**: Supabase Storage 직접 호출  

### PHP MPA 전환 구조

```
/public/
├── configure.php      ← 6단계 견적 구성 (POST로 단계 이동)
├── cart.php           ← 장바구니 (세션)
├── checkout.php       ← 배송/결제 입력
├── order-done.php     ← 완료 화면
└── products/
    └── configure.php  ← 커스텀 상품 구성

/api/
├── quote.php          ← POST: 실시간 견적 계산 (JSON)
├── upload.php         ← POST: 파일 업로드
├── cart.php           ← POST: 장바구니 CRUD (JSON)
└── orders.php         ← POST: 주문 생성 (JSON)

/includes/
├── BookmoaPricing.php ← 견적 계산 엔진 (php-porting-calc-logic.md 참조)
├── CartManager.php    ← 세션 장바구니 관리
├── OrderController.php ← 주문 생성/조회
└── Session.php        ← 세션 초기화 헬퍼
```

### 핵심 설계 원칙

| 항목 | React SPA | PHP MPA |
|------|-----------|---------|
| 라우팅 | useState page 전환 | URL 기반 페이지 이동 |
| 상태 | Context + localStorage | PHP Session + MariaDB |
| 견적 계산 | 브라우저 calcQuote() | AJAX → `/api/quote.php` |
| 파일 업로드 | Supabase Storage | PHP multipart → `/uploads/` |
| 인증 | Supabase Auth | JWT (firebase/php-jwt) |

---

## 2. 페이지 구조 설계

### URL 맵핑

| React `page` 값 | PHP 페이지 | 메서드 |
|-----------------|-----------|--------|
| `configure` | `/configure.php?step=0` | GET/POST |
| `cart` | `/cart.php` | GET |
| `checkout` | `/checkout.php` | GET/POST |
| `orderDone` | `/order-done.php` | GET |
| `products` | `/products.php` | GET |
| `prodConfigure` | `/products/configure.php?id={productId}` | GET/POST |

### 공통 레이아웃 (`includes/layout.php`)

```php
<?php
// includes/layout.php
// 모든 페이지에서 include — 헤더/푸터 공통 구조

function renderHeader(string $title, string $backUrl = '/', string $backLabel = '홈'): void {
    $accent = '#7CB342';
    echo <<<HTML
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{$title} — 북모아</title>
        <link rel="stylesheet" href="/assets/app.css">
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet">
    </head>
    <body style="background:#F7F7F5; font-family:'Noto Sans KR',sans-serif;">
    <header style="background:#fff; border-bottom:1px solid #eee; position:sticky; top:0; z-index:40;">
        <div style="max-width:1200px; margin:0 auto; padding:0 16px; height:56px; display:flex; align-items:center; justify-content:space-between;">
            <a href="{$backUrl}" style="color:#888; font-size:14px; text-decoration:none;">← {$backLabel}</a>
            <span style="font-weight:900; font-size:18px; color:{$accent};">{$title}</span>
            <a href="/cart.php" style="color:#888;">🛒</a>
        </div>
    </header>
    <main style="max-width:1200px; margin:0 auto; padding:24px 16px;">
    HTML;
}

function renderFooter(): void {
    echo <<<HTML
    </main>
    <script src="/assets/app.js"></script>
    </body>
    </html>
    HTML;
}
```

---

## 3. Configure 화면 — 6단계 견적 구성

### 원본 React 구조

`src/App.jsx:579` — Configure 컴포넌트  

```
stps[0]: 판형 & 인쇄  — format, printType, pages, quantity
stps[1]: 내지          — innerPaper(2단계: 종류→평량), innerSide
stps[2]: 표지 & 코팅  — coverPaper, coverSide, coating
stps[3]: 제본 & 후가공 — binding, endpaper, postProcessing[]
stps[4]: 견적 확인     — 견적서 표시 + 인쇄/엑셀 다운로드
stps[5]: 파일 업로드   — 드래그앤드롭 + 장바구니 담기
```

### PHP 구현: `configure.php`

```php
<?php
// configure.php — 6단계 견적 구성 화면
// POST로 단계 이동, 세션에 cfg 유지

require_once __DIR__ . '/includes/Session.php';
require_once __DIR__ . '/includes/BookmoaPricing.php';
require_once __DIR__ . '/includes/layout.php';

Session::start();

// 기본 견적 설정값 (React DEF_CFG 대응)
$DEF_CFG = [
    'format'         => 'A5',
    'printType'      => 'IX-Eco',
    'pages'          => 100,
    'quantity'       => 10,
    'innerPaper'     => '모조80',
    'innerSide'      => '양면',
    'coverPaper'     => '아트지250',
    'coverSide'      => '단면',
    'coating'        => '유광코팅',
    'binding'        => '무선',
    'endpaper'       => '없음',
    'postProcessing' => [],
];

// 현재 단계와 저장된 cfg 불러오기
$step = (int)($_GET['step'] ?? $_SESSION['configure_step'] ?? 0);
$cfg  = $_SESSION['configure_cfg'] ?? $DEF_CFG;

// POST 처리 — 단계별 필드 저장 후 다음 단계로 이동
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? 'next';

    if ($action === 'reset') {
        // 전체 초기화
        $cfg  = $DEF_CFG;
        $step = 0;
    } elseif ($action === 'prev') {
        // 이전 단계
        $step = max(0, $step - 1);
    } else {
        // 단계별 필드 저장
        $step = (int)($_POST['step'] ?? $step);

        switch ($step) {
            case 0: // 판형 & 인쇄
                $cfg['format']    = $_POST['format']    ?? $cfg['format'];
                $cfg['printType'] = $_POST['printType'] ?? $cfg['printType'];
                $cfg['pages']     = max(1, (int)($_POST['pages'] ?? $cfg['pages']));
                $cfg['quantity']  = max(1, (int)($_POST['quantity'] ?? $cfg['quantity']));
                $step = 1;
                break;

            case 1: // 내지
                $cfg['innerPaper'] = $_POST['innerPaper'] ?? $cfg['innerPaper'];
                $cfg['innerSide']  = $_POST['innerSide']  ?? $cfg['innerSide'];
                $step = 2;
                break;

            case 2: // 표지 & 코팅
                $cfg['coverPaper'] = $_POST['coverPaper'] ?? $cfg['coverPaper'];
                $cfg['coverSide']  = $_POST['coverSide']  ?? $cfg['coverSide'];
                $cfg['coating']    = $_POST['coating']    ?? $cfg['coating'];
                $step = 3;
                break;

            case 3: // 제본 & 후가공
                $cfg['binding']        = $_POST['binding']    ?? $cfg['binding'];
                $cfg['endpaper']       = $_POST['endpaper']   ?? $cfg['endpaper'];
                // 체크박스 복수 선택
                $cfg['postProcessing'] = $_POST['postProcessing'] ?? [];
                $step = 4;
                break;

            case 4: // 견적 확인 → 다음(파일 업로드)
                $step = 5;
                break;
        }
    }

    // 세션 저장
    $_SESSION['configure_cfg']  = $cfg;
    $_SESSION['configure_step'] = $step;

    // PRG 패턴: POST 후 GET 리다이렉트
    header("Location: /configure.php?step={$step}");
    exit;
}

// 현재 견적 계산
$quote = BookmoaPricing::calcQuote($cfg);

// 단계 레이블
$stepLabels = [
    ['t' => '판형 & 인쇄',    's' => '규격과 인쇄 방식 선택'],
    ['t' => '내지',            's' => '내지 종이와 인쇄면'],
    ['t' => '표지 & 코팅',    's' => '표지 종이와 코팅'],
    ['t' => '제본 & 후가공',  's' => '제본 방식과 추가 옵션'],
    ['t' => '견적확인',        's' => '견적서를 확인하고 인쇄/다운로드'],
    ['t' => '파일 업로드',     's' => '인쇄 파일 업로드'],
];

renderHeader('견적 & 주문', '/', '홈');
?>

<!-- 단계 인디케이터 -->
<div style="background:#fff; border-radius:12px; padding:16px; margin-bottom:24px; box-shadow:0 1px 3px rgba(0,0,0,.08);">
    <div style="display:flex; gap:0;">
        <?php foreach ($stepLabels as $i => $s): ?>
        <div style="flex:1; text-align:center; position:relative;">
            <div style="width:32px; height:32px; border-radius:50%; margin:0 auto 4px;
                        background:<?= $i < $step ? '#7CB342' : ($i === $step ? '#7CB342' : '#e5e7eb') ?>;
                        color:<?= $i <= $step ? '#fff' : '#9ca3af' ?>;
                        display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13px;">
                <?= $i < $step ? '✓' : ($i + 1) ?>
            </div>
            <div style="font-size:11px; font-weight:<?= $i === $step ? '700' : '400' ?>;
                        color:<?= $i === $step ? '#1C2912' : '#9ca3af' ?>;">
                <?= htmlspecialchars($s['t']) ?>
            </div>
        </div>
        <?php endfor; ?>
    </div>
</div>

<div style="display:grid; grid-template-columns:1fr 300px; gap:24px;">

<!-- 메인 폼 영역 -->
<div style="background:#fff; border-radius:12px; padding:24px; box-shadow:0 1px 3px rgba(0,0,0,.08);">
    <h2 style="font-weight:900; font-size:18px; margin-bottom:4px;">
        <?= htmlspecialchars($stepLabels[$step]['t']) ?>
    </h2>
    <p style="color:#9ca3af; font-size:13px; margin-bottom:24px;">
        <?= htmlspecialchars($stepLabels[$step]['s']) ?>
    </p>

    <form method="POST" enctype="multipart/form-data" id="configureForm">
        <input type="hidden" name="step" value="<?= $step ?>">

        <?php if ($step === 0): // ─── STEP 0: 판형 & 인쇄 ─── ?>
            <?php
            $formats   = ['B6', 'A5', 'B5', 'A4'];
            $printTypes = ['IX-Eco', 'IX-Color', 'HP-Color', 'HP-Premium'];
            $formatDescs = [
                'B6'  => '46판변형 / 128×182mm',
                'A5'  => '국판 / 148×210mm',
                'B5'  => '46판 / 182×257mm',
                'A4'  => '국배판 / 210×297mm',
            ];
            ?>
            <div style="margin-bottom:20px;">
                <label style="font-weight:700; font-size:14px; display:block; margin-bottom:10px;">판형</label>
                <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px;">
                    <?php foreach ($formats as $f): ?>
                    <label style="cursor:pointer;">
                        <input type="radio" name="format" value="<?= $f ?>" <?= $cfg['format'] === $f ? 'checked' : '' ?>
                               style="display:none;" onchange="this.form.submit()">
                        <div class="chip <?= $cfg['format'] === $f ? 'chip-active' : '' ?>" onclick="this.previousElementSibling.checked=true; this.previousElementSibling.dispatchEvent(new Event('change'))">
                            <div style="font-weight:700;"><?= $f ?></div>
                            <div style="font-size:11px; color:#9ca3af;"><?= $formatDescs[$f] ?></div>
                        </div>
                    </label>
                    <?php endforeach; ?>
                </div>
            </div>

            <div style="margin-bottom:20px;">
                <label style="font-weight:700; font-size:14px; display:block; margin-bottom:10px;">인쇄 방식</label>
                <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px;">
                    <?php foreach ($printTypes as $pt): ?>
                    <label style="cursor:pointer;">
                        <input type="radio" name="printType" value="<?= $pt ?>" <?= $cfg['printType'] === $pt ? 'checked' : '' ?> style="display:none;">
                        <div class="chip <?= $cfg['printType'] === $pt ? 'chip-active' : '' ?>"><?= $pt ?></div>
                    </label>
                    <?php endforeach; ?>
                </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px;">
                <div>
                    <label style="font-weight:700; font-size:14px; display:block; margin-bottom:8px;">페이지 수</label>
                    <input type="number" name="pages" value="<?= (int)$cfg['pages'] ?>" min="1"
                           style="width:100%; height:44px; padding:0 16px; border:2px solid #e5e7eb; border-radius:8px; font-size:14px; box-sizing:border-box;">
                </div>
                <div>
                    <label style="font-weight:700; font-size:14px; display:block; margin-bottom:8px;">부수</label>
                    <input type="number" name="quantity" value="<?= (int)$cfg['quantity'] ?>" min="1"
                           style="width:100%; height:44px; padding:0 16px; border:2px solid #e5e7eb; border-radius:8px; font-size:14px; box-sizing:border-box;">
                </div>
            </div>

        <?php elseif ($step === 1): // ─── STEP 1: 내지 ─── ?>
            <?php
            // 내지 종이 종류 목록 (PAPER_TYPES 대응)
            $paperTypes = ['모조', '중질', '미색모조', '아트지', '스노우화이트', '랑데부', '스노우펄'];
            // 평량 목록 (PAPER_TYPE_MAP 대응)
            $paperTypeMap = [
                '모조'        => [60, 70, 80, 100, 120],
                '중질'        => [60, 70, 80],
                '미색모조'    => [60, 70, 80, 100],
                '아트지'      => [100, 120, 150, 200],
                '스노우화이트' => [80, 100, 120],
                '랑데부'      => [90, 120],
                '스노우펄'    => [100, 120],
            ];

            // 현재 선택된 내지 종이에서 종류/평량 분리
            preg_match('/^(.*?)(\d+)$/', $cfg['innerPaper'], $m);
            $currentType   = $m[1] ?? $paperTypes[0];
            $currentWeight = $m[2] ?? '80';

            $sides = ['양면', '단면'];
            ?>
            <div style="margin-bottom:20px;">
                <label style="font-weight:700; font-size:14px; display:block; margin-bottom:10px;">내지 종이</label>

                <!-- 1단계: 종이 종류 -->
                <div style="margin-bottom:12px;">
                    <p style="font-size:12px; color:#9ca3af; font-weight:500; margin-bottom:8px;">종이 종류</p>
                    <div style="display:flex; flex-wrap:wrap; gap:8px;">
                        <?php foreach ($paperTypes as $pt): ?>
                        <button type="button" onclick="selectPaperType('<?= $pt ?>')"
                                class="paper-type-btn <?= $currentType === $pt ? 'paper-type-active' : '' ?>"
                                id="ptype-<?= $pt ?>">
                            <?= htmlspecialchars($pt) ?>
                        </button>
                        <?php endforeach; ?>
                    </div>
                </div>

                <!-- 2단계: 평량 -->
                <?php foreach ($paperTypes as $pt): ?>
                <div id="weights-<?= $pt ?>" style="display:<?= $currentType === $pt ? 'block' : 'none' ?>; margin-bottom:12px;">
                    <p style="font-size:12px; color:#9ca3af; font-weight:500; margin-bottom:8px;">평량 (g/㎡)</p>
                    <div style="display:flex; flex-wrap:wrap; gap:8px;">
                        <?php foreach (($paperTypeMap[$pt] ?? []) as $w): ?>
                        <?php $key = $pt . $w; ?>
                        <label style="cursor:pointer;">
                            <input type="radio" name="innerPaper" value="<?= $key ?>"
                                   <?= $cfg['innerPaper'] === $key ? 'checked' : '' ?>
                                   style="display:none;"
                                   onchange="updateInnerPaperDisplay('<?= htmlspecialchars($key) ?>')">
                            <div class="weight-btn <?= $cfg['innerPaper'] === $key ? 'weight-active' : '' ?>"
                                 onclick="this.previousElementSibling.checked=true; this.previousElementSibling.dispatchEvent(new Event('change'))">
                                <?= $w ?>g
                            </div>
                        </label>
                        <?php endforeach; ?>
                    </div>
                </div>
                <?php endforeach; ?>

                <!-- 선택 결과 표시 -->
                <div style="background:#f0f7e6; border-radius:8px; padding:8px 12px; font-size:14px; margin-top:8px;">
                    <span style="color:#9ca3af; font-size:12px;">선택: </span>
                    <span id="innerPaperDisplay" style="font-weight:700; color:#7CB342;">
                        <?= htmlspecialchars($cfg['innerPaper']) ?>
                    </span>
                </div>
            </div>

            <div style="margin-bottom:20px;">
                <label style="font-weight:700; font-size:14px; display:block; margin-bottom:10px;">양/단면</label>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                    <?php foreach ($sides as $s): ?>
                    <label style="cursor:pointer;">
                        <input type="radio" name="innerSide" value="<?= $s ?>" <?= $cfg['innerSide'] === $s ? 'checked' : '' ?> style="display:none;">
                        <div class="chip <?= $cfg['innerSide'] === $s ? 'chip-active' : '' ?>">
                            <?= $s === '양면' ? '양면 (앞뒤)' : '단면 (한면)' ?>
                        </div>
                    </label>
                    <?php endforeach; ?>
                </div>
            </div>

        <?php elseif ($step === 2): // ─── STEP 2: 표지 & 코팅 ─── ?>
            <?php
            $coverPapers = ['아트지250', '스노우화이트250', '랑데부250', '레자크176'];
            $sides       = ['단면', '양면'];
            $coatings    = ['없음', '유광코팅', '무광코팅'];
            ?>
            <div style="margin-bottom:20px;">
                <label style="font-weight:700; font-size:14px; display:block; margin-bottom:10px;">표지 종이</label>
                <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:8px;">
                    <?php foreach ($coverPapers as $cp): ?>
                    <label style="cursor:pointer;">
                        <input type="radio" name="coverPaper" value="<?= $cp ?>" <?= $cfg['coverPaper'] === $cp ? 'checked' : '' ?> style="display:none;">
                        <div class="chip <?= $cfg['coverPaper'] === $cp ? 'chip-active' : '' ?>"><?= $cp ?></div>
                    </label>
                    <?php endforeach; ?>
                </div>
            </div>

            <div style="margin-bottom:20px;">
                <label style="font-weight:700; font-size:14px; display:block; margin-bottom:10px;">표지 인쇄면</label>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                    <?php foreach ($sides as $s): ?>
                    <label style="cursor:pointer;">
                        <input type="radio" name="coverSide" value="<?= $s ?>" <?= $cfg['coverSide'] === $s ? 'checked' : '' ?> style="display:none;">
                        <div class="chip <?= $cfg['coverSide'] === $s ? 'chip-active' : '' ?>"><?= $s ?></div>
                    </label>
                    <?php endforeach; ?>
                </div>
            </div>

            <div style="margin-bottom:20px;">
                <label style="font-weight:700; font-size:14px; display:block; margin-bottom:10px;">코팅</label>
                <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px;">
                    <?php foreach ($coatings as $c): ?>
                    <label style="cursor:pointer;">
                        <input type="radio" name="coating" value="<?= $c ?>" <?= $cfg['coating'] === $c ? 'checked' : '' ?> style="display:none;">
                        <div class="chip <?= $cfg['coating'] === $c ? 'chip-active' : '' ?>"><?= $c ?></div>
                    </label>
                    <?php endforeach; ?>
                </div>
            </div>

        <?php elseif ($step === 3): // ─── STEP 3: 제본 & 후가공 ─── ?>
            <?php
            $bindings  = ['무선', '무선날개', '양장', '중철', '떡제본', '링'];
            $endpapers = ['없음', '미색모조80', '아트지100', '랑데부90'];
            $postProcs = [
                '박(금)' => 5000, '박(은)' => 5000, '에폭시' => 3000,
                '엠보싱'  => 4000, '형압'   => 4000,
            ];
            ?>
            <div style="margin-bottom:20px;">
                <label style="font-weight:700; font-size:14px; display:block; margin-bottom:10px;">제본</label>
                <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px;">
                    <?php foreach ($bindings as $b): ?>
                    <label style="cursor:pointer;">
                        <input type="radio" name="binding" value="<?= $b ?>" <?= $cfg['binding'] === $b ? 'checked' : '' ?> style="display:none;">
                        <div class="chip <?= $cfg['binding'] === $b ? 'chip-active' : '' ?>"><?= $b ?></div>
                    </label>
                    <?php endforeach; ?>
                </div>
            </div>

            <div style="margin-bottom:20px;">
                <label style="font-weight:700; font-size:14px; display:block; margin-bottom:10px;">면지</label>
                <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px;">
                    <?php foreach ($endpapers as $e): ?>
                    <label style="cursor:pointer;">
                        <input type="radio" name="endpaper" value="<?= $e ?>" <?= $cfg['endpaper'] === $e ? 'checked' : '' ?> style="display:none;">
                        <div class="chip <?= $cfg['endpaper'] === $e ? 'chip-active' : '' ?>"><?= $e ?></div>
                    </label>
                    <?php endforeach; ?>
                </div>
            </div>

            <div style="margin-bottom:20px;">
                <label style="font-weight:700; font-size:14px; display:block; margin-bottom:10px;">후가공 (복수 선택)</label>
                <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px;">
                    <?php foreach ($postProcs as $pp => $price): ?>
                    <label style="cursor:pointer; display:block;">
                        <input type="checkbox" name="postProcessing[]" value="<?= $pp ?>"
                               <?= in_array($pp, $cfg['postProcessing']) ? 'checked' : '' ?>>
                        <span style="font-size:13px;"><?= $pp ?></span>
                        <span style="font-size:11px; color:#9ca3af;">+₩<?= number_format($price) ?></span>
                    </label>
                    <?php endforeach; ?>
                </div>
            </div>

        <?php elseif ($step === 4): // ─── STEP 4: 견적 확인 ─── ?>
            <?php
            // 견적 명세서 HTML 출력
            $lines = $quote['lines'] ?? [];
            $findLine = fn($key) => array_values(array_filter($lines, fn($l) => $l['key'] === $key))[0] ?? null;
            $innerLine   = $findLine('inner');
            $printLine   = $findLine('print');
            $bindingLine = $findLine('binding');
            $coatingLine = $findLine('coating');
            $ppTotal = array_sum(array_map(fn($l) => $l['total'], array_filter($lines, fn($l) => $l['key'] === 'pp')));
            ?>
            <div style="border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; background:#fff;">
                <div style="padding:24px 32px;">
                    <h1 style="font-size:24px; font-weight:900; text-align:center; letter-spacing:8px; margin-bottom:16px;">견 적 서</h1>
                    <div style="border-top:2px solid #1f2937; margin-bottom:24px;"></div>

                    <p style="font-size:13px; color:#7CB342; margin-bottom:12px;">아래와 같이 견적합니다.</p>
                    <div style="display:grid; grid-template-columns:3fr 2fr; gap:0; margin-bottom:24px;">
                        <div style="border:1px solid #e5e7eb; padding:12px 16px; font-size:13px; font-weight:500; background:#f9fafb; text-align:center;">
                            합계금액 ₩<?= number_format($quote['subtotal']) ?> 원 + 부가세 ₩<?= number_format($quote['vat']) ?> 원 + 배송비별도
                        </div>
                        <div style="border:1px solid #e5e7eb; border-left:none; padding:12px 16px; font-size:13px; font-weight:900; text-align:center;">
                            총 합계금액: ₩<?= number_format($quote['total']) ?>
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0; margin-bottom:24px;">
                        <!-- 재질 및 규격 -->
                        <div>
                            <div style="background:#7CB342; color:#fff; font-size:12px; font-weight:700; text-align:center; padding:8px;">재질 및 규격</div>
                            <table style="width:100%; font-size:13px; border-collapse:collapse; border:1px solid #e5e7eb; border-top:none;">
                                <?php foreach ([
                                    ['품 명', '디지털책자 통합상품'],
                                    ['규격', $cfg['format']],
                                    ['수량', $cfg['quantity'] . ' 부 × 1건'],
                                    ['재질(표지)', $cfg['coverPaper']],
                                    ['인쇄도수(표지)', '전면 : ' . $cfg['coverSide']],
                                    ['재질(내지1)', $cfg['innerPaper']],
                                    ['인쇄도수(내지1)', '전면 : ' . $cfg['innerSide']],
                                ] as [$k, $v]): ?>
                                <tr style="border-bottom:1px solid #e5e7eb;">
                                    <td style="padding:6px 12px; font-weight:700; background:#f9fafb; width:100px; text-align:center; border-right:1px solid #e5e7eb; font-size:11px;"><?= $k ?></td>
                                    <td style="padding:6px 12px; font-size:12px;"><?= htmlspecialchars($v) ?></td>
                                </tr>
                                <?php endforeach; ?>
                            </table>
                        </div>
                        <!-- 인쇄세부항목 -->
                        <div>
                            <div style="background:#555; color:#fff; font-size:12px; font-weight:700; text-align:center; padding:8px;">인쇄세부항목</div>
                            <table style="width:100%; font-size:13px; border-collapse:collapse; border:1px solid #e5e7eb; border-top:none; border-left:none;">
                                <?php foreach ([
                                    ['종이비',    $innerLine   ? $innerLine['total']   : 0],
                                    ['출력비',    0],
                                    ['인쇄비',    $printLine   ? $printLine['total']   : 0],
                                    ['제본비',    $bindingLine ? $bindingLine['total'] : 0],
                                    ['옵션비',    ($coatingLine ? $coatingLine['total'] : 0) + $ppTotal],
                                    ['공급가',    $quote['subtotal']],
                                    ['부가세',    $quote['vat']],
                                    ['정상판매가', $quote['total']],
                                    ['결제금액',  $quote['total']],
                                ] as [$k, $v]): ?>
                                <tr style="border-bottom:1px solid #e5e7eb;">
                                    <td style="padding:6px 12px; font-weight:700; background:#f9fafb; width:90px; text-align:center; border-right:1px solid #e5e7eb; font-size:11px;"><?= $k ?></td>
                                    <td style="padding:6px 12px; font-size:12px; text-align:right; font-weight:500;">₩ <?= number_format($v) ?></td>
                                </tr>
                                <?php endforeach; ?>
                            </table>
                        </div>
                    </div>

                    <div style="margin-bottom:24px;">
                        <div style="background:#333; color:#fff; font-size:12px; font-weight:700; text-align:center; padding:8px;">후가공 세부내역</div>
                        <div style="border:1px solid #e5e7eb; border-top:none; padding:16px; min-height:48px; font-size:13px; color:#6b7280;">
                            <?= !empty($cfg['postProcessing']) ? htmlspecialchars(implode(', ', $cfg['postProcessing'])) : '없음' ?>
                        </div>
                    </div>

                    <div style="border:1px solid #e5e7eb; border-radius:8px; padding:16px; background:#f9fafb; font-size:12px; color:#6b7280; line-height:1.8;">
                        <p>■ 본 견적의 유효기간은 견적일로부터 15일 입니다.</p>
                        <p>■ 본 견적에서 배송비는 별도 입니다.</p>
                        <p>■ 본 견적은 사양과 작업의 난이도에 따라서 가격이 변동이 될 수 있음을 알려드립니다.</p>
                    </div>
                </div>
            </div>

            <!-- 견적서 인쇄 버튼 -->
            <div style="display:flex; gap:12px; justify-content:center; margin-top:16px; flex-wrap:wrap;">
                <button type="button" onclick="window.print()"
                        style="padding:12px 24px; border-radius:8px; font-weight:700; background:#c0392b; color:#fff; border:none; cursor:pointer;">
                    🖨️ 견적서 인쇄
                </button>
            </div>

        <?php elseif ($step === 5): // ─── STEP 5: 파일 업로드 ─── ?>
            <div id="drop-zone"
                 style="border:2px dashed #d1d5db; border-radius:12px; padding:48px; text-align:center; cursor:pointer; transition:all .2s;"
                 onclick="document.getElementById('fileInput').click()"
                 ondragover="handleDragOver(event)"
                 ondragleave="handleDragLeave(event)"
                 ondrop="handleDrop(event)">
                <div style="font-size:40px; color:#d1d5db; margin-bottom:12px;">⬆️</div>
                <p style="font-weight:700; color:#6b7280;">파일 드래그 또는 클릭</p>
                <p style="font-size:13px; color:#9ca3af;">PDF, JPG, PNG, AI, EPS, INDD (최대 100MB)</p>
                <input id="fileInput" type="file" name="files[]" multiple style="display:none;"
                       accept=".pdf,.jpg,.jpeg,.png,.ai,.eps,.indd"
                       onchange="updateFileList(this.files)">
            </div>
            <div id="fileList" style="margin-top:16px;"></div>
            <!-- 파일 업로드 후 장바구니 담기는 JavaScript AJAX로 처리 (섹션 5 참조) -->
        <?php endif; ?>

        <!-- 네비게이션 버튼 -->
        <div style="display:flex; gap:12px; justify-content:space-between; margin-top:32px;">
            <?php if ($step > 0): ?>
            <button type="submit" name="action" value="prev"
                    style="padding:12px 24px; border-radius:8px; font-weight:700; border:2px solid #e5e7eb; background:#fff; cursor:pointer;">
                ← 이전
            </button>
            <?php else: ?>
            <div></div>
            <?php endif; ?>

            <?php if ($step < 5): ?>
            <button type="submit" name="action" value="next"
                    style="padding:12px 32px; border-radius:8px; font-weight:700; background:#7CB342; color:#fff; border:none; cursor:pointer;">
                <?= $step === 4 ? '파일 업로드 →' : '다음 단계 →' ?>
            </button>
            <?php else: ?>
            <!-- 파일 업로드 단계: JS AJAX 제출 -->
            <button type="button" id="addToCartBtn" onclick="submitWithFiles()"
                    style="padding:12px 32px; border-radius:8px; font-weight:700; background:#7CB342; color:#fff; border:none; cursor:pointer;">
                🛒 장바구니 담기
            </button>
            <?php endif; ?>
        </div>
    </form>
</div>

<!-- 사이드바: 실시간 견적 요약 -->
<div>
    <div style="background:#fff; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,.08); position:sticky; top:80px;">
        <h3 style="font-weight:700; font-size:16px; margin-bottom:16px;">실시간 견적</h3>
        <div id="quoteSummary">
            <?php include __DIR__ . '/includes/partials/quote-summary.php'; ?>
        </div>
    </div>
</div>

</div><!-- end grid -->

<style>
.chip {
    padding: 10px 12px; border-radius: 10px; border: 2px solid #e5e7eb;
    font-size: 13px; font-weight: 500; text-align: center; cursor: pointer; transition: all .15s;
    color: #6b7280;
}
.chip-active { border-color: #7CB342; background: #f0f7e6; color: #1C2912; font-weight: 700; box-shadow: 0 1px 4px rgba(124,179,66,.25); }
.paper-type-btn {
    padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 500;
    border: 1px solid #e5e7eb; background: #F7F7F5; color: #6b7280; cursor: pointer;
}
.paper-type-active { background: #7CB342; color: #fff; box-shadow: 0 1px 4px rgba(124,179,66,.3); }
.weight-btn {
    padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 600;
    border: 2px solid #e5e7eb; background: #fff; color: #1f2937; cursor: pointer;
}
.weight-active { border-color: #7CB342; background: #f0f7e6; color: #7CB342; }
</style>

<?php renderFooter(); ?>
```

---

## 4. AJAX 실시간 견적 계산

### 사이드바 실시간 업데이트 흐름

React에서는 `useMemo(()=>calcQuote(cfg,...), [cfg])` 로 즉시 재계산. PHP에서는 폼 변경 시 AJAX로 `/api/quote.php`를 호출.

### `api/quote.php` — 견적 계산 API

```php
<?php
// api/quote.php — POST: JSON 견적 계산 엔드포인트
// Content-Type: application/json 응답

require_once __DIR__ . '/../includes/BookmoaPricing.php';

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');

// POST body를 JSON으로 파싱
$body = json_decode(file_get_contents('php://input'), true);
if (!$body) {
    // 폼 POST 지원 (application/x-www-form-urlencoded)
    $body = $_POST;
}

// 필수 파라미터 검증
$required = ['format', 'printType', 'pages', 'quantity', 'innerPaper', 'innerSide',
             'coverPaper', 'coverSide', 'coating', 'binding', 'endpaper'];
foreach ($required as $key) {
    if (!isset($body[$key])) {
        http_response_code(400);
        echo json_encode(['error' => "Missing field: {$key}"]);
        exit;
    }
}

// cfg 구성
$cfg = [
    'format'         => $body['format'],
    'printType'      => $body['printType'],
    'pages'          => max(1, (int)$body['pages']),
    'quantity'       => max(1, (int)$body['quantity']),
    'innerPaper'     => $body['innerPaper'],
    'innerSide'      => $body['innerSide'],
    'coverPaper'     => $body['coverPaper'],
    'coverSide'      => $body['coverSide'],
    'coating'        => $body['coating'],
    'binding'        => $body['binding'],
    'endpaper'       => $body['endpaper'],
    'postProcessing' => $body['postProcessing'] ?? [],
];

// 견적 계산 (BookmoaPricing::calcQuote — php-porting-calc-logic.md 참조)
$quote = BookmoaPricing::calcQuote($cfg);

echo json_encode($quote, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
```

### 프론트엔드 AJAX 연동 (`assets/app.js`)

```javascript
// assets/app.js — 실시간 견적 계산 AJAX 연동

/**
 * 현재 폼 상태를 수집하여 /api/quote.php로 전송하고
 * 사이드바 #quoteSummary를 업데이트한다.
 */
async function updateQuote() {
    const form = document.getElementById('configureForm');
    if (!form) return;

    // 현재 폼 필드 직렬화
    const data = new FormData(form);
    const cfg = {
        format:         data.get('format')    || 'A5',
        printType:      data.get('printType') || 'IX-Eco',
        pages:          parseInt(data.get('pages'))    || 100,
        quantity:       parseInt(data.get('quantity')) || 10,
        innerPaper:     data.get('innerPaper')  || '모조80',
        innerSide:      data.get('innerSide')   || '양면',
        coverPaper:     data.get('coverPaper')  || '아트지250',
        coverSide:      data.get('coverSide')   || '단면',
        coating:        data.get('coating')     || '없음',
        binding:        data.get('binding')     || '무선',
        endpaper:       data.get('endpaper')    || '없음',
        postProcessing: data.getAll('postProcessing[]'),
    };

    try {
        const res = await fetch('/api/quote.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cfg),
        });
        const quote = await res.json();
        renderQuoteSummary(quote, cfg);
    } catch (e) {
        console.error('견적 계산 오류:', e);
    }
}

/**
 * 견적 요약 사이드바 렌더링
 * @param {object} quote  - calcQuote() 결과
 * @param {object} cfg    - 현재 사양 설정
 */
function renderQuoteSummary(quote, cfg) {
    const el = document.getElementById('quoteSummary');
    if (!el) return;

    const fmt = n => n.toLocaleString('ko-KR');
    const lines = (quote.lines || []).map(l =>
        `<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;border-bottom:1px solid #f3f4f6;">
            <span style="color:#6b7280;">${l.label}</span>
            <span style="font-weight:600;">₩${fmt(l.total)}</span>
         </div>`
    ).join('');

    el.innerHTML = `
        <div style="font-size:12px;color:#9ca3af;margin-bottom:4px;">
            ${cfg.format} / ${cfg.binding} / ${cfg.pages}p × ${cfg.quantity}부
        </div>
        ${lines}
        <div style="border-top:2px solid #1f2937;margin-top:12px;padding-top:12px;">
            <div style="display:flex;justify-content:space-between;">
                <span style="font-size:14px;font-weight:700;">공급가액</span>
                <span style="font-weight:700;">₩${fmt(quote.subtotal)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;color:#6b7280;font-size:12px;">
                <span>부가세 (10%)</span>
                <span>₩${fmt(quote.vat)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:8px;">
                <span style="font-size:16px;font-weight:900;">합계</span>
                <span style="font-size:20px;font-weight:900;color:#7CB342;">₩${fmt(quote.total)}</span>
            </div>
            <div style="font-size:11px;color:#9ca3af;margin-top:4px;text-align:right;">
                1부 단가: ₩${fmt(Math.round(quote.unitPrice))}
            </div>
        </div>
    `;
}

// 폼 필드 변경 시 견적 자동 갱신 (debounce 300ms)
let quoteTimer;
function scheduleQuoteUpdate() {
    clearTimeout(quoteTimer);
    quoteTimer = setTimeout(updateQuote, 300);
}

// 초기화: 모든 input/select/radio/checkbox에 이벤트 등록
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('configureForm');
    if (form) {
        form.addEventListener('change', scheduleQuoteUpdate);
        form.addEventListener('input', scheduleQuoteUpdate);
        // 첫 로드 시 사이드바 초기화
        updateQuote();
    }
});

// ─── 내지 종이 2단계 선택 UI ───

/**
 * 종이 종류 버튼 클릭 시: 해당 종류 평량 목록만 표시
 * @param {string} type - 종이 종류 (예: '모조', '아트지')
 */
function selectPaperType(type) {
    // 모든 평량 섹션 숨기기
    document.querySelectorAll('[id^="weights-"]').forEach(el => el.style.display = 'none');
    // 선택 종류 평량 표시
    const target = document.getElementById('weights-' + type);
    if (target) target.style.display = 'block';

    // 버튼 활성 상태 갱신
    document.querySelectorAll('.paper-type-btn').forEach(btn => {
        const isActive = btn.id === 'ptype-' + type;
        btn.classList.toggle('paper-type-active', isActive);
    });

    // 해당 종류의 첫 번째 평량 자동 선택
    const firstRadio = target?.querySelector('input[type="radio"]');
    if (firstRadio) {
        firstRadio.checked = true;
        updateInnerPaperDisplay(firstRadio.value);
    }
    scheduleQuoteUpdate();
}

/**
 * 내지 종이 선택 결과 표시 업데이트
 * @param {string} paperKey - 예: '모조80', '아트지150'
 */
function updateInnerPaperDisplay(paperKey) {
    const el = document.getElementById('innerPaperDisplay');
    if (el) el.textContent = paperKey;
    scheduleQuoteUpdate();
}
```

---

## 5. 파일 업로드 PHP 처리

### 원본 React `handleAdd` 로직 (`src/App.jsx:596`)

```
1. files[] 순회
2. Supabase Storage "order-files" 버킷에 {uid}/{파일명} 업로드
3. 업로드 성공 → getPublicUrl() → fileData에 url 저장
4. 업로드 실패 → url: '' (파일명만 유지)
5. addToCart({id, cfg, quote, files:fileData})
```

### `api/upload.php` — 파일 업로드 API

```php
<?php
// api/upload.php — POST multipart/form-data 파일 업로드
// 반환: JSON { success: true, files: [{name, url}] }

require_once __DIR__ . '/../includes/Session.php';

header('Content-Type: application/json; charset=UTF-8');

Session::start();

// 업로드 디렉토리 설정
$uploadDir   = __DIR__ . '/../uploads/order-files/';
$uploadUrl   = '/uploads/order-files/';  // 웹 접근 경로
$maxFileSize = 100 * 1024 * 1024;        // 100MB

// 허용 확장자
$allowedExts = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'ai', 'eps', 'indd'];

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

if (empty($_FILES['files'])) {
    echo json_encode(['success' => true, 'files' => []]);
    exit;
}

// 업로드 디렉토리 생성
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$uploaded = [];
$errors   = [];

// $_FILES['files'] 정규화 (multiple 파일 처리)
$fileCount = is_array($_FILES['files']['name']) ? count($_FILES['files']['name']) : 1;

for ($i = 0; $i < $fileCount; $i++) {
    $name  = is_array($_FILES['files']['name'])     ? $_FILES['files']['name'][$i]     : $_FILES['files']['name'];
    $tmp   = is_array($_FILES['files']['tmp_name']) ? $_FILES['files']['tmp_name'][$i] : $_FILES['files']['tmp_name'];
    $size  = is_array($_FILES['files']['size'])     ? $_FILES['files']['size'][$i]      : $_FILES['files']['size'];
    $error = is_array($_FILES['files']['error'])    ? $_FILES['files']['error'][$i]     : $_FILES['files']['error'];

    if ($error !== UPLOAD_ERR_OK) {
        $errors[] = "업로드 오류: {$name} (code: {$error})";
        continue;
    }

    // 파일 크기 검증
    if ($size > $maxFileSize) {
        $errors[] = "{$name}: 파일 크기 초과 (최대 100MB)";
        continue;
    }

    // 확장자 검증
    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    if (!in_array($ext, $allowedExts, true)) {
        $errors[] = "{$name}: 허용되지 않는 파일 형식";
        continue;
    }

    // 저장 경로: {orderUid}/{파일명} — uid는 세션 또는 UUID 생성
    $orderUid = $_SESSION['upload_uid'] ?? bin2hex(random_bytes(8));
    $_SESSION['upload_uid'] = $orderUid;

    $safeDir  = $uploadDir . $orderUid . '/';
    if (!is_dir($safeDir)) mkdir($safeDir, 0755, true);

    // 파일명 sanitize: 영숫자/한글/하이픈/점만 허용
    $safeName = preg_replace('/[^a-zA-Z0-9가-힣\-_.]/', '_', $name);
    $savePath = $safeDir . $safeName;

    if (move_uploaded_file($tmp, $savePath)) {
        $uploaded[] = [
            'name' => $name,
            'url'  => $uploadUrl . $orderUid . '/' . $safeName,
        ];
    } else {
        $errors[] = "{$name}: 저장 실패";
    }
}

echo json_encode([
    'success' => empty($errors),
    'files'   => $uploaded,
    'errors'  => $errors,
], JSON_UNESCAPED_UNICODE);
```

### AJAX 파일 업로드 + 장바구니 담기 (`assets/app.js` 추가)

```javascript
/**
 * 파일 업로드 + 장바구니 담기 (Step 5 버튼 클릭)
 * 1. 파일 → POST /api/upload.php (multipart)
 * 2. 견적 → POST /api/quote.php (JSON)
 * 3. 장바구니 → POST /api/cart.php (JSON)
 * 4. 완료 → /cart.php 이동
 */
async function submitWithFiles() {
    const btn = document.getElementById('addToCartBtn');
    btn.disabled = true;
    btn.textContent = '처리 중...';

    try {
        // 1. 파일 업로드
        const fileInput = document.getElementById('fileInput');
        let fileData = [];

        if (fileInput && fileInput.files.length > 0) {
            const formData = new FormData();
            Array.from(fileInput.files).forEach(f => formData.append('files[]', f));

            const uploadRes = await fetch('/api/upload.php', {
                method: 'POST',
                body: formData,
            });
            const uploadResult = await uploadRes.json();
            fileData = uploadResult.files || [];
        }

        // 2. 현재 cfg를 세션에서 가져와 견적 재계산
        const cfgRes = await fetch('/api/configure/current.php');
        const { cfg } = await cfgRes.json();

        const quoteRes = await fetch('/api/quote.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cfg),
        });
        const quote = await quoteRes.json();

        // 3. 장바구니 추가
        const cartRes = await fetch('/api/cart.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'add',
                item: {
                    id: crypto.randomUUID(),
                    cfg,
                    quote,
                    files: fileData,
                    isCustom: false,
                },
            }),
        });
        const cartResult = await cartRes.json();

        if (cartResult.success) {
            window.location.href = '/cart.php';
        } else {
            throw new Error(cartResult.error || '장바구니 추가 실패');
        }
    } catch (e) {
        alert('오류: ' + e.message);
        btn.disabled = false;
        btn.textContent = '🛒 장바구니 담기';
    }
}

// 파일 목록 UI 업데이트
function updateFileList(files) {
    const el = document.getElementById('fileList');
    if (!el) return;

    const icons = { pdf: '📕', jpg: '🖼️', jpeg: '🖼️', png: '🖼️', ai: '🎨', eps: '🎨', indd: '📐' };
    el.innerHTML = Array.from(files).map((f, i) => {
        const ext = f.name.split('.').pop()?.toLowerCase();
        const icon = icons[ext] || '📄';
        const size = (f.size / 1024 / 1024).toFixed(1);
        return `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:#f9fafb;border-radius:8px;margin-bottom:8px;">
                <div style="display:flex;align-items:center;gap:12px;">
                    <span style="font-size:24px;">${icon}</span>
                    <div>
                        <div style="font-weight:500;font-size:14px;">${f.name}</div>
                        <div style="font-size:12px;color:#9ca3af;">${size} MB</div>
                    </div>
                </div>
            </div>`;
    }).join('');
}

// 드래그앤드롭 핸들러
function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.style.borderColor = '#7CB342';
    e.currentTarget.style.background  = '#f0f7e6';
}
function handleDragLeave(e) {
    e.currentTarget.style.borderColor = '#d1d5db';
    e.currentTarget.style.background  = '';
}
function handleDrop(e) {
    e.preventDefault();
    handleDragLeave(e);
    const dt = e.dataTransfer;
    if (dt?.files.length) {
        document.getElementById('fileInput').files = dt.files;  // 불가한 브라우저 대비
        updateFileList(dt.files);
    }
}
```

---

## 6. Cart 컴포넌트 — 세션 기반 장바구니

### `includes/CartManager.php`

```php
<?php
// includes/CartManager.php — PHP 세션 기반 장바구니 관리
// React Context의 cart 상태 + addToCart/removeCart/updateCartItem 대응

class CartManager
{
    private const SESSION_KEY = 'bookmoa_cart';

    /**
     * 현재 세션에서 장바구니 배열을 반환한다.
     * @return array 장바구니 아이템 배열
     */
    public static function getCart(): array
    {
        return $_SESSION[self::SESSION_KEY] ?? [];
    }

    /**
     * 장바구니에 아이템을 추가한다.
     * 아이템 구조: { id, cfg, quote, files, isCustom }
     * @param array $item 추가할 장바구니 항목
     */
    public static function addItem(array $item): void
    {
        $cart = self::getCart();
        // id 중복 방지
        if (!empty($item['id'])) {
            $cart = array_values(array_filter($cart, fn($i) => $i['id'] !== $item['id']));
        }
        $cart[] = $item;
        $_SESSION[self::SESSION_KEY] = $cart;
    }

    /**
     * 장바구니에서 아이템을 제거한다.
     * @param string $id 제거할 아이템 ID
     */
    public static function removeItem(string $id): void
    {
        $cart = self::getCart();
        $_SESSION[self::SESSION_KEY] = array_values(
            array_filter($cart, fn($i) => $i['id'] !== $id)
        );
    }

    /**
     * 장바구니 아이템의 수량을 변경하고 견적을 재계산한다.
     * React updateQty()에 대응 — 일반/커스텀 분기 처리.
     *
     * @param string $id     아이템 ID
     * @param int    $newQty 새 수량
     * @param array  $customProducts 커스텀 상품 목록 (DB 또는 설정에서 조회)
     */
    public static function updateQuantity(string $id, int $newQty, array $customProducts = []): bool
    {
        $cart = self::getCart();
        foreach ($cart as &$item) {
            if ($item['id'] !== $id) continue;

            $item['cfg']['quantity'] = max(1, $newQty);

            if (!empty($item['isCustom'])) {
                // 커스텀 상품 견적 재계산
                $prod = array_values(array_filter($customProducts, fn($p) => $p['id'] === $item['cfg']['productId']))[0] ?? null;
                $item['quote'] = $prod
                    ? BookmoaPricing::calcCustomQuote($prod, $item['cfg']['selections'], $newQty)
                    : $item['quote'];
            } else {
                // 일반 견적 재계산
                $item['cfg']['quantity'] = $newQty;
                $item['quote'] = BookmoaPricing::calcQuote($item['cfg']);
            }
            $_SESSION[self::SESSION_KEY] = $cart;
            return true;
        }
        return false;
    }

    /**
     * 장바구니를 비운다 (주문 완료 후 호출).
     */
    public static function clear(): void
    {
        $_SESSION[self::SESSION_KEY] = [];
    }

    /**
     * 장바구니 총액을 계산한다.
     * @return int 전체 합계 (부가세 포함)
     */
    public static function total(): int
    {
        return (int)array_sum(array_map(fn($i) => $i['quote']['total'] ?? 0, self::getCart()));
    }
}
```

### `api/cart.php` — 장바구니 CRUD API

```php
<?php
// api/cart.php — 장바구니 CRUD JSON API
// GET: 현재 장바구니 반환
// POST action=add:    아이템 추가
// POST action=remove: 아이템 제거
// POST action=update: 수량 변경 (재견적 포함)

require_once __DIR__ . '/../includes/Session.php';
require_once __DIR__ . '/../includes/CartManager.php';
require_once __DIR__ . '/../includes/BookmoaPricing.php';

header('Content-Type: application/json; charset=UTF-8');
Session::start();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    echo json_encode([
        'cart'  => CartManager::getCart(),
        'total' => CartManager::total(),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $action = $body['action'] ?? '';

    switch ($action) {
        case 'add':
            // 아이템 유효성 기본 검증
            $item = $body['item'] ?? null;
            if (!$item || empty($item['cfg']) || empty($item['quote'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid item']);
                exit;
            }
            CartManager::addItem($item);
            echo json_encode(['success' => true, 'cart' => CartManager::getCart()], JSON_UNESCAPED_UNICODE);
            break;

        case 'remove':
            $id = $body['id'] ?? '';
            if (!$id) { http_response_code(400); echo json_encode(['error' => 'Missing id']); exit; }
            CartManager::removeItem($id);
            echo json_encode(['success' => true, 'cart' => CartManager::getCart()], JSON_UNESCAPED_UNICODE);
            break;

        case 'update':
            // 수량 변경 + 재견적
            $id  = $body['id']  ?? '';
            $qty = (int)($body['quantity'] ?? 1);
            if (!$id) { http_response_code(400); echo json_encode(['error' => 'Missing id']); exit; }

            CartManager::updateQuantity($id, $qty);
            echo json_encode([
                'success' => true,
                'cart'    => CartManager::getCart(),
                'total'   => CartManager::total(),
            ], JSON_UNESCAPED_UNICODE);
            break;

        default:
            http_response_code(400);
            echo json_encode(['error' => "Unknown action: {$action}"]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
```

### `cart.php` — 장바구니 페이지

```php
<?php
// cart.php — 장바구니 화면 (React Cart 컴포넌트 대응)

require_once __DIR__ . '/includes/Session.php';
require_once __DIR__ . '/includes/CartManager.php';
require_once __DIR__ . '/includes/layout.php';

Session::start();

$cart  = CartManager::getCart();
$total = CartManager::total();

renderHeader('장바구니 (' . count($cart) . ')', '/', '홈');

if (empty($cart)):
?>
<div style="text-align:center; padding:80px 0;">
    <div style="font-size:64px; margin-bottom:16px;">🛒</div>
    <h2 style="font-size:24px; font-weight:700; margin-bottom:8px;">장바구니가 비어있습니다</h2>
    <div style="display:flex; gap:12px; justify-content:center; margin-top:16px;">
        <a href="/configure.php" style="padding:12px 24px; border-radius:12px; font-weight:700; color:#fff; background:#7CB342; text-decoration:none;">도서 견적</a>
        <a href="/products.php" style="padding:12px 24px; border-radius:12px; font-weight:700; border:2px solid #e5e7eb; text-decoration:none; color:#1f2937;">상품 둘러보기</a>
    </div>
</div>
<?php else: ?>

<div style="display:grid; grid-template-columns:1fr 300px; gap:24px;">
    <!-- 아이템 목록 -->
    <div>
        <?php foreach ($cart as $i => $item):
            $cfg     = $item['cfg'];
            $quote   = $item['quote'];
            $isCustom = !empty($item['isCustom']);
            $title   = $isCustom ? ($cfg['productName'] ?? '커스텀 상품') : '인쇄물';
            $sub     = $isCustom
                ? implode(' / ', array_values($cfg['selLabels'] ?? []))
                : ($cfg['format'] . '/' . $cfg['printType'] . '/' . $cfg['innerPaper'] . '/' . $cfg['binding']);
        ?>
        <div style="background:#fff; border-radius:12px; padding:20px; margin-bottom:12px; box-shadow:0 1px 3px rgba(0,0,0,.08);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                <div>
                    <h3 style="font-weight:700;">
                        <?php if ($isCustom): ?>
                        <span style="font-size:11px; background:#dbeafe; color:#1d4ed8; padding:2px 6px; border-radius:4px; margin-right:6px;">커스텀</span>
                        <?php endif; ?>
                        <?= htmlspecialchars($title) ?> #<?= $i + 1 ?>
                    </h3>
                    <p style="font-size:12px; color:#9ca3af; margin-top:2px;"><?= htmlspecialchars($sub) ?></p>
                </div>
                <!-- 삭제 버튼 (AJAX) -->
                <button onclick="removeCartItem('<?= htmlspecialchars($item['id']) ?>')"
                        style="color:#d1d5db; background:none; border:none; cursor:pointer; font-size:18px;">✕</button>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; font-size:14px;">
                <?php if (!$isCustom): ?>
                <div>
                    <div style="color:#9ca3af; font-size:12px;">페이지</div>
                    <div style="font-weight:700;"><?= (int)$cfg['pages'] ?>p</div>
                </div>
                <?php endif; ?>
                <div>
                    <div style="color:#9ca3af; font-size:12px;">부수</div>
                    <!-- 수량 변경 인풋 (AJAX 재견적) -->
                    <input type="number" value="<?= (int)$cfg['quantity'] ?>" min="1"
                           onchange="updateCartQty('<?= htmlspecialchars($item['id']) ?>', this.value)"
                           style="width:80px; height:32px; padding:0 8px; border:2px solid #e5e7eb; border-radius:6px; font-weight:700; font-size:14px;">
                </div>
                <div style="text-align:right;">
                    <div style="color:#9ca3af; font-size:12px;">금액</div>
                    <div id="item-total-<?= htmlspecialchars($item['id']) ?>"
                         style="font-weight:700; font-size:18px; color:#7CB342;">
                        ₩<?= number_format($quote['total']) ?>
                    </div>
                    <div style="font-size:11px; color:#9ca3af;">단가 ₩<?= number_format($quote['unitPrice']) ?></div>
                </div>
            </div>
        </div>
        <?php endforeach; ?>
    </div>

    <!-- 주문 요약 사이드바 -->
    <div>
        <div style="background:#fff; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,.08); position:sticky; top:80px;">
            <h3 style="font-weight:700; font-size:18px; margin-bottom:16px;">주문 요약</h3>
            <?php foreach ($cart as $i => $item): ?>
            <div style="display:flex; justify-content:space-between; font-size:14px; padding:4px 0;">
                <span style="color:#6b7280; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:160px;">
                    #<?= $i + 1 ?> <?= htmlspecialchars($item['isCustom'] ? $item['cfg']['productName'] : $item['cfg']['format']) ?>
                </span>
                <span style="font-weight:500; flex-shrink:0;">₩<?= number_format($item['quote']['total']) ?></span>
            </div>
            <?php endforeach; ?>
            <div style="border-top:1px solid #e5e7eb; margin-top:12px; padding-top:16px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:20px;">
                    <span style="font-weight:700; font-size:18px;">합계</span>
                    <span id="cartTotal" style="font-weight:900; font-size:24px; color:#7CB342;">₩<?= number_format($total) ?></span>
                </div>
                <a href="/checkout.php"
                   style="display:block; width:100%; padding:14px; border-radius:12px; font-weight:700; color:#fff; background:#7CB342; text-align:center; text-decoration:none; font-size:16px; box-sizing:border-box;">
                    결제하기
                </a>
            </div>
        </div>
    </div>
</div>

<script>
// 아이템 삭제 (AJAX)
async function removeCartItem(id) {
    const res = await fetch('/api/cart.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', id }),
    });
    if (res.ok) location.reload();
}

// 수량 변경 + 재견적 (AJAX)
let qtyTimer;
async function updateCartQty(id, qty) {
    clearTimeout(qtyTimer);
    qtyTimer = setTimeout(async () => {
        const res = await fetch('/api/cart.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update', id, quantity: parseInt(qty) }),
        });
        const data = await res.json();
        if (data.success) {
            // 해당 아이템 금액 업데이트
            const item = (data.cart || []).find(i => i.id === id);
            if (item) {
                const el = document.getElementById('item-total-' + id);
                if (el) el.textContent = '₩' + item.quote.total.toLocaleString('ko-KR');
            }
            // 총액 업데이트
            const totalEl = document.getElementById('cartTotal');
            if (totalEl && data.total != null) {
                totalEl.textContent = '₩' + data.total.toLocaleString('ko-KR');
            }
        }
    }, 500);
}
</script>
<?php endif; ?>

<?php renderFooter(); ?>
```

---

## 7. Checkout 컴포넌트 — 주문 생성

### 원본 React `submit()` 로직 (`src/App.jsx:871`)

```javascript
// 주문 구조
const order = {
    id:       "ORD-2026-0001",          // 연도 + 4자리 랜덤
    date:     now(),                     // timestamp ms
    status:   0,                         // 0=접수 ~ 6=완료
    items:    cart.map(c => ({           // 장바구니 스냅샷
        cfg:     { ...c.cfg },
        quote:   c.quote,
        isCustom: !!c.isCustom
    })),
    total:    total,                     // 전체 합계
    customer: { name, phone, email, addr, detail },
    payment:  pay,                       // "card"|"bank"|"vbank"|"phone"
    history:  [{ status:0, date, note:"주문 접수" }]
};
```

### `checkout.php` — 결제 입력 + 주문 제출

```php
<?php
// checkout.php — 배송 정보 입력 + 주문 생성 (React Checkout 컴포넌트 대응)

require_once __DIR__ . '/includes/Session.php';
require_once __DIR__ . '/includes/CartManager.php';
require_once __DIR__ . '/includes/OrderController.php';
require_once __DIR__ . '/includes/layout.php';

Session::start();

$cart = CartManager::getCart();

// 장바구니 비었으면 리다이렉트
if (empty($cart)) {
    header('Location: /cart.php');
    exit;
}

$total  = CartManager::total();
$errors = [];

// POST: 주문 제출
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $form = [
        'name'   => trim($_POST['name']   ?? ''),
        'phone'  => trim($_POST['phone']  ?? ''),
        'email'  => trim($_POST['email']  ?? ''),
        'addr'   => trim($_POST['addr']   ?? ''),
        'detail' => trim($_POST['detail'] ?? ''),
    ];
    $payment = $_POST['payment'] ?? 'card';

    // 유효성 검사
    if (empty($form['name']))  $errors['name']  = true;
    if (empty($form['phone'])) $errors['phone'] = true;
    if (empty($form['addr']))  $errors['addr']  = true;

    if (empty($errors)) {
        // OrderController로 주문 생성
        $orderId = OrderController::create($cart, $total, $form, $payment);

        // 장바구니 비우기
        CartManager::clear();

        // 주문 완료 페이지로 이동
        header("Location: /order-done.php?id={$orderId}");
        exit;
    }
}

$form    = $form    ?? ['name'=>'','phone'=>'','email'=>'','addr'=>'','detail'=>''];
$payment = $payment ?? 'card';

renderHeader('결제', '/cart.php', '장바구니');
?>

<div style="max-width:720px; margin:0 auto;">
    <form method="POST" class="space-y-section">

        <!-- 배송 정보 -->
        <div style="background:#fff; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,.08); margin-bottom:20px;">
            <h3 style="font-weight:700; margin-bottom:16px;">배송 정보</h3>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <?php
                $fields = [
                    ['name',   '이름 *',    false],
                    ['phone',  '연락처 *',  false],
                    ['email',  '이메일',    true],
                    ['addr',   '주소 *',    true],
                    ['detail', '상세주소',  true],
                ];
                foreach ($fields as [$key, $placeholder, $fullWidth]):
                    $hasError = !empty($errors[$key]);
                    $colStyle = $fullWidth ? 'grid-column:1/-1;' : '';
                ?>
                <input name="<?= $key ?>" placeholder="<?= $placeholder ?>"
                       value="<?= htmlspecialchars($form[$key] ?? '') ?>"
                       style="<?= $colStyle ?> height:44px; padding:0 16px; border:2px solid <?= $hasError ? '#f87171' : '#e5e7eb' ?>;
                              border-radius:12px; font-size:14px; box-sizing:border-box;
                              font-family:'Noto Sans KR',sans-serif;">
                <?php endforeach; ?>
            </div>
        </div>

        <!-- 결제 수단 -->
        <div style="background:#fff; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,.08); margin-bottom:20px;">
            <h3 style="font-weight:700; margin-bottom:16px;">결제 수단</h3>
            <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px;">
                <?php foreach ([
                    ['card',  '신용카드', '💳'],
                    ['bank',  '계좌이체', '🏦'],
                    ['vbank', '가상계좌', '📋'],
                    ['phone', '휴대폰',   '📱'],
                ] as [$id, $label, $icon]): ?>
                <label style="cursor:pointer; text-align:center;">
                    <input type="radio" name="payment" value="<?= $id ?>" <?= $payment === $id ? 'checked' : '' ?>
                           style="display:none;" onchange="updatePayStyle()">
                    <div class="pay-btn <?= $payment === $id ? 'pay-active' : '' ?>" id="pay-<?= $id ?>"
                         onclick="document.querySelector('[name=payment][value=<?= $id ?>]').checked=true; updatePayStyle()">
                        <div style="font-size:24px; margin-bottom:4px;"><?= $icon ?></div>
                        <div style="font-size:12px; font-weight:700;"><?= $label ?></div>
                    </div>
                </label>
                <?php endforeach; ?>
            </div>
        </div>

        <!-- 총 결제 + 버튼 -->
        <div style="background:#fff; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,.08);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <span style="font-size:18px; font-weight:700;">총 결제</span>
                <span style="font-size:28px; font-weight:900; color:#7CB342;">₩<?= number_format($total) ?></span>
            </div>
            <button type="submit"
                    style="width:100%; padding:14px; border-radius:12px; font-weight:700; font-size:16px; color:#fff; background:#7CB342; border:none; cursor:pointer;">
                결제 완료
            </button>
        </div>
    </form>
</div>

<style>
.pay-btn {
    padding: 12px 8px; border-radius: 12px; border: 2px solid #e5e7eb;
    cursor: pointer; transition: all .15s;
}
.pay-active { border-color: #7CB342; background: #f0f7e6; }
</style>
<script>
function updatePayStyle() {
    document.querySelectorAll('.pay-btn').forEach(btn => btn.classList.remove('pay-active'));
    const checked = document.querySelector('[name=payment]:checked');
    if (checked) document.getElementById('pay-' + checked.value)?.classList.add('pay-active');
}
</script>

<?php renderFooter(); ?>
```

---

## 8. OrderController.php 전체 구현

```php
<?php
// includes/OrderController.php — 주문 생성/조회/상태 변경
// MariaDB orders 테이블 기반 (migration-supabase-to-php-mariadb.md 스키마 참조)

require_once __DIR__ . '/Database.php';

class OrderController
{
    /**
     * 주문을 생성하고 주문 ID를 반환한다.
     *
     * 주문 구조 (React order 객체와 1:1 대응):
     *   - id:       "ORD-{연도}-{4자리난수}"
     *   - date:     현재 Unix 타임스탬프(ms)
     *   - status:   0 (접수)
     *   - items:    장바구니 스냅샷 JSON
     *   - total:    전체 합계 (부가세 포함)
     *   - customer: 배송 정보 JSON
     *   - payment:  결제 수단 코드
     *   - history:  상태 이력 JSON
     *
     * @param array  $cart     CartManager::getCart() 반환값
     * @param int    $total    전체 합계
     * @param array  $customer 고객 배송 정보 {name, phone, email, addr, detail}
     * @param string $payment  결제 수단 코드 (card|bank|vbank|phone)
     * @return string 생성된 주문 ID
     */
    public static function create(array $cart, int $total, array $customer, string $payment): string
    {
        $db = Database::get();

        // 주문 ID 생성: ORD-{연도}-{4자리 0패딩 난수}
        $orderId = 'ORD-' . date('Y') . '-' . str_pad(mt_rand(1, 9999), 4, '0', STR_PAD_LEFT);

        // 현재 시각 (React now() 대응 — ms 타임스탬프)
        $nowMs = (int)(microtime(true) * 1000);

        // 장바구니 아이템을 주문 스냅샷으로 변환
        $items = array_map(fn($item) => [
            'cfg'      => $item['cfg'],
            'quote'    => $item['quote'],
            'isCustom' => !empty($item['isCustom']),
        ], $cart);

        // 초기 상태 이력
        $history = [
            ['status' => 0, 'date' => $nowMs, 'note' => '주문 접수'],
        ];

        // DB 저장
        $stmt = $db->prepare(
            'INSERT INTO orders (id, date_ms, status, items_json, total, customer_json, payment, history_json)
             VALUES (?, ?, 0, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $orderId,
            $nowMs,
            json_encode($items,    JSON_UNESCAPED_UNICODE),
            $total,
            json_encode($customer, JSON_UNESCAPED_UNICODE),
            $payment,
            json_encode($history,  JSON_UNESCAPED_UNICODE),
        ]);

        return $orderId;
    }

    /**
     * 주문 목록을 조회한다.
     *
     * @param string|null $customerId  고객 식별자 (비로그인 시 null → 세션 기반)
     * @param int         $limit       최대 조회 건수
     * @return array 주문 목록 (최신순)
     */
    public static function list(?string $customerId = null, int $limit = 50): array
    {
        $db = Database::get();

        if ($customerId) {
            // 로그인 사용자: customer_id로 조회
            $stmt = $db->prepare(
                'SELECT * FROM orders WHERE customer_id = ? ORDER BY date_ms DESC LIMIT ?'
            );
            $stmt->execute([$customerId, $limit]);
        } else {
            // 비로그인: 세션 주문 ID 목록으로 조회
            $sessionOrderIds = $_SESSION['order_ids'] ?? [];
            if (empty($sessionOrderIds)) return [];

            $placeholders = implode(',', array_fill(0, count($sessionOrderIds), '?'));
            $stmt = $db->prepare(
                "SELECT * FROM orders WHERE id IN ({$placeholders}) ORDER BY date_ms DESC LIMIT ?"
            );
            $stmt->execute([...$sessionOrderIds, $limit]);
        }

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // JSON 컬럼 디코딩
        return array_map(fn($row) => [
            'id'       => $row['id'],
            'date'     => (int)$row['date_ms'],
            'status'   => (int)$row['status'],
            'items'    => json_decode($row['items_json'],    true),
            'total'    => (int)$row['total'],
            'customer' => json_decode($row['customer_json'], true),
            'payment'  => $row['payment'],
            'history'  => json_decode($row['history_json'],  true),
        ], $rows);
    }

    /**
     * 주문 상태를 변경한다 (관리자 전용).
     *
     * @param string $orderId 주문 ID
     * @param int    $status  새 상태 (0~6)
     * @param string $note    상태 변경 메모
     * @return bool 성공 여부
     */
    public static function updateStatus(string $orderId, int $status, string $note = ''): bool
    {
        $db = Database::get();

        // 기존 이력 조회
        $stmt = $db->prepare('SELECT history_json FROM orders WHERE id = ?');
        $stmt->execute([$orderId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) return false;

        $history = json_decode($row['history_json'], true) ?? [];
        $history[] = [
            'status' => $status,
            'date'   => (int)(microtime(true) * 1000),
            'note'   => $note ?: self::statusLabel($status),
        ];

        $stmt = $db->prepare(
            'UPDATE orders SET status = ?, history_json = ? WHERE id = ?'
        );
        $stmt->execute([$status, json_encode($history, JSON_UNESCAPED_UNICODE), $orderId]);
        return $stmt->rowCount() > 0;
    }

    /**
     * 단일 주문을 조회한다.
     * @param string $orderId 주문 ID
     * @return array|null 주문 데이터 또는 null
     */
    public static function find(string $orderId): ?array
    {
        $db = Database::get();
        $stmt = $db->prepare('SELECT * FROM orders WHERE id = ?');
        $stmt->execute([$orderId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) return null;

        return [
            'id'       => $row['id'],
            'date'     => (int)$row['date_ms'],
            'status'   => (int)$row['status'],
            'items'    => json_decode($row['items_json'],    true),
            'total'    => (int)$row['total'],
            'customer' => json_decode($row['customer_json'], true),
            'payment'  => $row['payment'],
            'history'  => json_decode($row['history_json'],  true),
        ];
    }

    /** 상태 코드 → 레이블 변환 */
    private static function statusLabel(int $status): string
    {
        return match($status) {
            0 => '주문 접수',
            1 => '입금 확인',
            2 => '제작 준비',
            3 => '인쇄 중',
            4 => '제본/가공 중',
            5 => '배송 중',
            6 => '배송 완료',
            default => '상태 변경',
        };
    }
}
```

### `api/orders.php` — 주문 REST API

```php
<?php
// api/orders.php — 주문 생성/조회 JSON API

require_once __DIR__ . '/../includes/Session.php';
require_once __DIR__ . '/../includes/CartManager.php';
require_once __DIR__ . '/../includes/OrderController.php';

header('Content-Type: application/json; charset=UTF-8');
Session::start();

$method = $_SERVER['REQUEST_METHOD'];
$path   = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// POST /api/orders — 주문 생성
if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?: $_POST;

    // 필수 필드 검증
    if (empty($body['customer']['name']) || empty($body['customer']['phone']) || empty($body['customer']['addr'])) {
        http_response_code(400);
        echo json_encode(['error' => '배송 정보 필수 항목 누락']);
        exit;
    }

    // 장바구니에서 주문 데이터 구성 (클라이언트에서 cart를 직접 전달하는 경우)
    $cart    = $body['cart']    ?? CartManager::getCart();
    $total   = $body['total']   ?? CartManager::total();
    $payment = $body['payment'] ?? 'card';

    if (empty($cart)) {
        http_response_code(400);
        echo json_encode(['error' => '장바구니가 비어있습니다']);
        exit;
    }

    // 주문 생성
    $orderId = OrderController::create($cart, (int)$total, $body['customer'], $payment);

    // 세션에 주문 ID 저장 (비로그인 사용자 조회용)
    $_SESSION['order_ids']   = array_merge($_SESSION['order_ids'] ?? [], [$orderId]);
    $_SESSION['last_order']  = $orderId;

    // 장바구니 비우기 (API 호출 시)
    if (!empty($body['clearCart'])) {
        CartManager::clear();
    }

    echo json_encode([
        'success' => true,
        'orderId' => $orderId,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// GET /api/orders — 주문 목록 조회
if ($method === 'GET') {
    $orders = OrderController::list();
    echo json_encode(['orders' => $orders], JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
```

---

## 9. 커스텀 상품 (ProdConfigure) 포팅

### 원본 React 구조 (`src/App.jsx:1242`)

- `customProducts` — DB/설정에서 로드된 상품 목록 (`{id, name, icon, desc, active, qtyTiers[], optGroups[{id,name,choices[{id,label,priceAdj}]}]}`)
- `calcCustomQuote(prod, selections, qty)` — qtyTiers에서 basePrice + optGroups priceAdj 합산
- `handleAdd` — 위와 동일한 파일 업로드 + isCustom:true 플래그 추가

### `products/configure.php`

```php
<?php
// products/configure.php — 커스텀 상품 구성 화면
// React ProdConfigure 컴포넌트 대응

require_once __DIR__ . '/../includes/Session.php';
require_once __DIR__ . '/../includes/BookmoaPricing.php';
require_once __DIR__ . '/../includes/CartManager.php';
require_once __DIR__ . '/../includes/Database.php';
require_once __DIR__ . '/../includes/layout.php';

Session::start();

$productId = $_GET['id'] ?? '';
if (!$productId) {
    header('Location: /products.php');
    exit;
}

// DB에서 커스텀 상품 조회
$db   = Database::get();
$stmt = $db->prepare("SELECT * FROM custom_products WHERE id = ? AND active = 1");
$stmt->execute([$productId]);
$row  = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$row) {
    renderHeader('상품 없음');
    echo '<div style="text-align:center;padding:80px 0;"><h2>상품을 찾을 수 없습니다</h2></div>';
    renderFooter();
    exit;
}

// JSON 컬럼 디코딩
$prod = [
    'id'        => $row['id'],
    'name'      => $row['name'],
    'icon'      => $row['icon'] ?? '📦',
    'desc'      => $row['description'] ?? '',
    'qtyTiers'  => json_decode($row['qty_tiers_json'],  true) ?? [],
    'optGroups' => json_decode($row['opt_groups_json'], true) ?? [],
];

// POST: 장바구니 담기
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $qty        = max(1, (int)($_POST['quantity'] ?? 1));
    $selections = [];
    $selLabels  = [];

    // 옵션 선택 수집 + 레이블 구성 (React cfgSummary.selLabels 대응)
    foreach ($prod['optGroups'] as $group) {
        $selectedId = $_POST['opt_' . $group['id']] ?? ($group['choices'][0]['id'] ?? null);
        if ($selectedId) {
            $selections[$group['id']] = $selectedId;
            $choice = array_values(array_filter($group['choices'], fn($c) => $c['id'] === $selectedId))[0] ?? null;
            if ($choice) {
                $selLabels[$group['name']] = $choice['label'];
            }
        }
    }

    // 견적 계산
    $quote = BookmoaPricing::calcCustomQuote($prod, $selections, $qty);

    // 파일 업로드는 AJAX로 처리 후 /api/cart.php add 호출
    // (동기 POST에서는 파일 없이 장바구니 추가)
    $cfgSummary = [
        'productId'   => $prod['id'],
        'productName' => $prod['name'],
        'quantity'    => $qty,
        'selections'  => $selections,
        'selLabels'   => $selLabels,
        // 일반 견적 호환 필드 (호환성 유지)
        'format'      => $prod['name'],
        'printType'   => implode('/', array_slice(array_values($selLabels), 0, 2)),
        'binding'     => '-', 'pages' => '-', 'innerPaper' => '-',
        'innerSide'   => '-', 'coverPaper' => '-', 'coverSide' => '-',
        'coating'     => '-', 'endpaper'   => '-', 'postProcessing' => [],
    ];

    CartManager::addItem([
        'id'       => bin2hex(random_bytes(8)),
        'cfg'      => $cfgSummary,
        'quote'    => $quote,
        'files'    => [],
        'isCustom' => true,
    ]);

    header('Location: /cart.php');
    exit;
}

renderHeader($prod['icon'] . ' ' . $prod['name'], '/products.php', '상품목록');
?>

<div style="display:grid; grid-template-columns:1fr 300px; gap:24px; max-width:900px; margin:0 auto;">
    <!-- 상품 옵션 구성 -->
    <div style="background:#fff; border-radius:12px; padding:24px; box-shadow:0 1px 3px rgba(0,0,0,.08);">
        <h2 style="font-weight:900; font-size:20px; margin-bottom:4px;"><?= htmlspecialchars($prod['name']) ?></h2>
        <p style="color:#9ca3af; font-size:14px; margin-bottom:24px;"><?= htmlspecialchars($prod['desc']) ?></p>

        <form method="POST" id="prodConfigForm">
            <?php foreach ($prod['optGroups'] as $group): ?>
            <div style="margin-bottom:20px;">
                <label style="font-weight:700; font-size:14px; display:block; margin-bottom:10px;">
                    <?= htmlspecialchars($group['name']) ?>
                </label>
                <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px;">
                    <?php foreach ($group['choices'] as $choice): ?>
                    <label style="cursor:pointer;">
                        <input type="radio" name="opt_<?= htmlspecialchars($group['id']) ?>"
                               value="<?= htmlspecialchars($choice['id']) ?>"
                               <?= ($group['choices'][0]['id'] === $choice['id']) ? 'checked' : '' ?>
                               style="display:none;" onchange="updateCustomQuote()">
                        <div class="chip" style="position:relative;"
                             onclick="this.previousElementSibling.checked=true; this.previousElementSibling.dispatchEvent(new Event('change'))">
                            <div style="font-weight:500;"><?= htmlspecialchars($choice['label']) ?></div>
                            <?php if ($choice['priceAdj'] != 0): ?>
                            <div style="font-size:11px; margin-top:2px; color:<?= $choice['priceAdj'] > 0 ? '#7CB342' : '#10b981' ?>;">
                                <?= $choice['priceAdj'] > 0 ? '+' : '' ?>₩<?= number_format($choice['priceAdj']) ?>
                            </div>
                            <?php endif; ?>
                        </div>
                    </label>
                    <?php endforeach; ?>
                </div>
            </div>
            <?php endforeach; ?>

            <!-- 수량 입력 -->
            <div style="margin-bottom:20px;">
                <label style="font-weight:700; font-size:14px; display:block; margin-bottom:8px;">수량 (부)</label>
                <input type="number" name="quantity" id="prodQty" value="1" min="1"
                       onchange="updateCustomQuote()"
                       style="width:120px; height:44px; padding:0 16px; border:2px solid #e5e7eb; border-radius:8px; font-size:14px; box-sizing:border-box;">
            </div>

            <!-- 수량별 기준가 안내 -->
            <?php if (count($prod['qtyTiers']) > 1): ?>
            <div style="background:#f9fafb; border-radius:8px; padding:12px; font-size:12px; color:#6b7280; margin-bottom:20px;">
                <span style="font-weight:700; color:#1f2937;">수량별 기본가:</span>
                <?php foreach ($prod['qtyTiers'] as $tier): ?>
                <span style="margin-left:8px;"><?= $tier['minQty'] ?>부~ ₩<?= number_format($tier['basePrice']) ?></span>
                <?php endforeach; ?>
            </div>
            <?php endif; ?>

            <button type="submit" style="width:100%; padding:14px; border-radius:12px; font-weight:700; font-size:16px; color:#fff; background:#7CB342; border:none; cursor:pointer;">
                🛒 장바구니 담기
            </button>
        </form>
    </div>

    <!-- 실시간 견적 사이드바 -->
    <div>
        <div style="background:#fff; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,.08); position:sticky; top:80px;">
            <h3 style="font-weight:700; font-size:16px; margin-bottom:16px;">견적 미리보기</h3>
            <div id="customQuoteSummary">
                <div style="font-size:14px; color:#9ca3af; text-align:center; padding:20px;">계산 중...</div>
            </div>
        </div>
    </div>
</div>

<script>
// 커스텀 상품 AJAX 견적 계산
async function updateCustomQuote() {
    const form = document.getElementById('prodConfigForm');
    const data = new FormData(form);
    const selections = {};

    <?php foreach ($prod['optGroups'] as $group): ?>
    selections['<?= $group['id'] ?>'] = data.get('opt_<?= $group['id'] ?>') || '';
    <?php endforeach; ?>

    const qty = parseInt(data.get('quantity')) || 1;

    try {
        const res = await fetch('/api/quote.php?type=custom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'custom',
                productId: '<?= htmlspecialchars($prod['id']) ?>',
                selections,
                quantity: qty,
            }),
        });
        const quote = await res.json();
        renderCustomQuote(quote, qty);
    } catch (e) {
        console.error(e);
    }
}

function renderCustomQuote(quote, qty) {
    const el = document.getElementById('customQuoteSummary');
    const fmt = n => n.toLocaleString('ko-KR');
    el.innerHTML = `
        <div style="border-top:1px solid #e5e7eb; padding-top:12px; margin-top:8px;">
            <div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;">
                <span style="color:#6b7280;">기본가</span>
                <span style="font-weight:600;">₩${fmt(quote.basePrice || 0)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;">
                <span style="color:#6b7280;">옵션 추가</span>
                <span style="font-weight:600;">₩${fmt(quote.optTotal || 0)}</span>
            </div>
            <div style="border-top:2px solid #1f2937;margin-top:12px;padding-top:12px;">
                <div style="display:flex;justify-content:space-between;">
                    <span style="font-size:16px;font-weight:900;">합계</span>
                    <span style="font-size:20px;font-weight:900;color:#7CB342;">₩${fmt(quote.total)}</span>
                </div>
                <div style="font-size:11px;color:#9ca3af;text-align:right;margin-top:4px;">
                    × ${qty}부 / 부가세 포함
                </div>
            </div>
        </div>`;
}

// 초기 견적
document.addEventListener('DOMContentLoaded', updateCustomQuote);
</script>

<?php renderFooter(); ?>
```

### `api/quote.php` — 커스텀 상품 견적 지원 추가

```php
// api/quote.php의 커스텀 상품 분기 처리 추가

// POST body에 type=custom이면 calcCustomQuote 호출
if (($body['type'] ?? '') === 'custom') {
    $productId  = $body['productId'] ?? '';
    $selections = $body['selections'] ?? [];
    $qty        = max(1, (int)($body['quantity'] ?? 1));

    // DB에서 상품 조회
    $db   = Database::get();
    $stmt = $db->prepare("SELECT * FROM custom_products WHERE id = ?");
    $stmt->execute([$productId]);
    $row  = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        http_response_code(404);
        echo json_encode(['error' => '상품을 찾을 수 없습니다']);
        exit;
    }

    $prod  = [
        'qtyTiers'  => json_decode($row['qty_tiers_json'],  true) ?? [],
        'optGroups' => json_decode($row['opt_groups_json'], true) ?? [],
    ];
    $quote = BookmoaPricing::calcCustomQuote($prod, $selections, $qty);

    echo json_encode($quote, JSON_UNESCAPED_UNICODE);
    exit;
}
```

---

## 10. 주문 확인서 출력

### `order-done.php` — 주문 완료 + 확인서

```php
<?php
// order-done.php — 주문 완료 화면 (React OrderDone + ReceiptModal 통합)

require_once __DIR__ . '/includes/Session.php';
require_once __DIR__ . '/includes/OrderController.php';
require_once __DIR__ . '/includes/layout.php';

Session::start();

$orderId = $_GET['id'] ?? $_SESSION['last_order'] ?? '';
$order   = $orderId ? OrderController::find($orderId) : null;

renderHeader('주문 완료');
?>

<?php if (!$order): ?>
<div style="text-align:center; padding:80px 0;">
    <div style="font-size:64px; margin-bottom:16px;">❓</div>
    <h2 style="font-size:20px; font-weight:700;">주문 정보를 찾을 수 없습니다</h2>
    <a href="/" style="display:inline-block; margin-top:16px; padding:12px 24px; border-radius:12px; background:#7CB342; color:#fff; text-decoration:none; font-weight:700;">홈으로</a>
</div>
<?php else: ?>
<div style="display:flex; align-items:center; justify-content:center; min-height:60vh;">
    <div style="text-align:center; background:#fff; border-radius:16px; box-shadow:0 4px 24px rgba(0,0,0,.1); padding:48px; max-width:480px; width:100%;">
        <div style="font-size:64px; margin-bottom:20px;">🎉</div>
        <h2 style="font-size:24px; font-weight:900; margin-bottom:8px;">주문 완료!</h2>
        <p style="color:#6b7280; margin-bottom:4px;">주문번호: <strong><?= htmlspecialchars($order['id']) ?></strong></p>
        <p style="color:#9ca3af; font-size:13px; margin-bottom:28px;">'내 주문'에서 진행 상황 확인</p>

        <div style="display:flex; gap:12px; justify-content:center;">
            <a href="/orders.php" style="flex:1; padding:10px; border-radius:12px; font-weight:700; border:2px solid #e5e7eb; text-decoration:none; color:#1f2937; text-align:center;">주문 확인</a>
            <a href="/" style="flex:1; padding:10px; border-radius:12px; font-weight:700; background:#7CB342; color:#fff; text-decoration:none; text-align:center;">홈으로</a>
        </div>

        <!-- 주문 확인서 인라인 출력 -->
        <div style="margin-top:32px; border-top:1px solid #e5e7eb; padding-top:24px; text-align:left;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <h3 style="font-weight:700;">주문 확인서</h3>
                <button onclick="window.print()"
                        style="padding:6px 12px; border-radius:8px; background:#7CB342; color:#fff; border:none; cursor:pointer; font-size:12px; font-weight:700;">
                    🖨️ 인쇄
                </button>
            </div>

            <table style="width:100%; font-size:13px; border-collapse:collapse;">
                <?php foreach ([
                    ['주문번호', $order['id']],
                    ['주문일',   date('Y년 m월 d일', intdiv($order['date'], 1000))],
                    ['고객명',   $order['customer']['name'] ?? '-'],
                    ['연락처',   $order['customer']['phone'] ?? '-'],
                    ['배송지',   ($order['customer']['addr'] ?? '') . ' ' . ($order['customer']['detail'] ?? '')],
                    ['결제수단', ['card'=>'신용카드','bank'=>'계좌이체','vbank'=>'가상계좌','phone'=>'휴대폰결제'][$order['payment']] ?? $order['payment']],
                ] as [$k, $v]): ?>
                <tr style="border-bottom:1px solid #f3f4f6;">
                    <td style="padding:6px 0; color:#9ca3af; width:80px;"><?= $k ?></td>
                    <td style="padding:6px 0; font-weight:500;"><?= htmlspecialchars($v) ?></td>
                </tr>
                <?php endforeach; ?>
            </table>

            <div style="margin-top:16px;">
                <h4 style="font-weight:700; font-size:13px; margin-bottom:8px;">주문 상품</h4>
                <?php foreach (($order['items'] ?? []) as $i => $item):
                    $isCust = !empty($item['isCustom']) || !empty($item['cfg']['productId']);
                    $spec   = $isCust
                        ? ($item['cfg']['productName'] ?? '커스텀')
                        : ($item['cfg']['format'] . '/' . $item['cfg']['innerPaper'] . '/' . $item['cfg']['binding'] . ' ' . $item['cfg']['pages'] . 'p');
                ?>
                <div style="display:flex; justify-content:space-between; font-size:12px; padding:4px 0; border-bottom:1px solid #f9fafb;">
                    <span style="color:#6b7280;">#<?= $i+1 ?> <?= htmlspecialchars($spec) ?> × <?= $item['cfg']['quantity'] ?>부</span>
                    <span style="font-weight:600;">₩<?= number_format($item['quote']['total']) ?></span>
                </div>
                <?php endforeach; ?>
                <div style="display:flex; justify-content:space-between; margin-top:12px; padding-top:12px; border-top:2px solid #1f2937;">
                    <span style="font-weight:900;">합계</span>
                    <span style="font-weight:900; font-size:18px; color:#7CB342;">₩<?= number_format($order['total']) ?></span>
                </div>
            </div>
        </div>
    </div>
</div>
<?php endif; ?>

<style>
@media print {
    header, footer, a, button { display: none !important; }
    body { background: white !important; }
}
</style>

<?php renderFooter(); ?>
```

---

## 11. 라우터 설정

### Apache `.htaccess`

```apache
# public/.htaccess

RewriteEngine On
RewriteBase /

# API 경로는 그대로 통과
RewriteRule ^api/ - [L]

# uploads 정적 파일 통과
RewriteRule ^uploads/ - [L]

# PHP 파일 직접 접근 허용
RewriteCond %{REQUEST_FILENAME} -f
RewriteRule \.(php|css|js|png|jpg|ico|svg|woff2?)$ - [L]

# 기타 → index.php (필요 시)
# RewriteRule ^ index.php [QSA,L]
```

### Nginx 설정 예시

```nginx
server {
    listen 80;
    server_name bookmoa.example.com;
    root /var/www/bookmoa/public;
    index configure.php index.php;

    # PHP-FPM
    location ~ \.php$ {
        fastcgi_pass unix:/run/php/php8.1-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }

    # 업로드 파일 정적 서빙
    location /uploads/ {
        alias /var/www/bookmoa/uploads/;
        expires 7d;
    }

    # API
    location /api/ {
        try_files $uri $uri/ =404;
    }

    # 보안: includes 디렉토리 직접 접근 차단
    location ~ ^/includes/ {
        deny all;
    }
}
```

---

## 12. 세션/상태 관리 전략

### `includes/Session.php`

```php
<?php
// includes/Session.php — 세션 초기화 헬퍼

class Session
{
    /**
     * 세션을 안전하게 시작한다.
     * - 이미 시작된 경우 중복 호출 방지
     * - 쿠키 보안 옵션 설정 (HttpOnly, SameSite=Lax)
     */
    public static function start(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) return;

        // 보안 쿠키 설정
        session_set_cookie_params([
            'lifetime' => 86400 * 7,     // 7일
            'path'     => '/',
            'secure'   => isset($_SERVER['HTTPS']),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);

        session_start();

        // 세션 고정 공격 방어: 일정 시간마다 ID 재생성
        if (!isset($_SESSION['_created'])) {
            $_SESSION['_created'] = time();
        } elseif (time() - $_SESSION['_created'] > 1800) {
            // 30분마다 세션 ID 재생성
            session_regenerate_id(true);
            $_SESSION['_created'] = time();
        }
    }
}
```

### `includes/Database.php`

```php
<?php
// includes/Database.php — PDO MariaDB 싱글톤 연결

class Database
{
    private static ?PDO $instance = null;

    /**
     * PDO 인스턴스를 반환한다 (싱글톤).
     * 환경변수 DB_HOST, DB_NAME, DB_USER, DB_PASS 사용.
     */
    public static function get(): PDO
    {
        if (self::$instance === null) {
            $dsn = sprintf(
                'mysql:host=%s;dbname=%s;charset=utf8mb4',
                getenv('DB_HOST') ?: 'localhost',
                getenv('DB_NAME') ?: 'bookmoa'
            );
            self::$instance = new PDO($dsn,
                getenv('DB_USER') ?: 'bookmoa_user',
                getenv('DB_PASS') ?: '',
                [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                ]
            );
        }
        return self::$instance;
    }
}
```

### MariaDB `orders` 테이블 DDL

```sql
-- orders 테이블 (React order 객체 구조 반영)
CREATE TABLE IF NOT EXISTS orders (
    id            VARCHAR(20)    PRIMARY KEY,          -- ORD-2026-0001
    date_ms       BIGINT         NOT NULL,             -- Unix ms (React now())
    status        TINYINT        NOT NULL DEFAULT 0,   -- 0~6
    items_json    MEDIUMTEXT     NOT NULL,             -- cart 스냅샷 JSON
    total         INT            NOT NULL,             -- 전체 합계 (부가세 포함)
    customer_json TEXT           NOT NULL,             -- {name,phone,email,addr,detail}
    payment       VARCHAR(10)    NOT NULL DEFAULT 'card', -- card|bank|vbank|phone
    history_json  TEXT           NOT NULL,             -- [{status,date,note}]
    customer_id   VARCHAR(100)   NULL,                 -- 로그인 사용자 ID (옵션)
    created_at    TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_customer_id (customer_id),
    INDEX idx_status      (status),
    INDEX idx_date_ms     (date_ms)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 커스텀 상품 테이블
CREATE TABLE IF NOT EXISTS custom_products (
    id              VARCHAR(32)  PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    icon            VARCHAR(10)  DEFAULT '📦',
    description     TEXT,
    active          TINYINT(1)   DEFAULT 1,
    qty_tiers_json  TEXT         NOT NULL DEFAULT '[]',  -- [{minQty,basePrice}]
    opt_groups_json MEDIUMTEXT   NOT NULL DEFAULT '[]',  -- [{id,name,choices:[{id,label,priceAdj}]}]
    sort_order      INT          DEFAULT 0,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 13. 검증 체크리스트

### 기능 동등성 검증

| 기능 | React SPA | PHP MPA | 검증 방법 |
|------|-----------|---------|-----------|
| 6단계 견적 구성 | useState step | GET `?step=N` + SESSION | 각 단계 POST → 세션 값 확인 |
| 실시간 견적 계산 | useMemo calcQuote | AJAX `/api/quote.php` | A4/모조80/양면/2001p/10부 → 723,899원 |
| 내지 2단계 선택 | PAPER_TYPES/MAP | JS selectPaperType() | 종류 선택 → 평량 목록 갱신 확인 |
| 파일 업로드 | Supabase Storage | PHP multipart + `/uploads/` | 100MB 파일 업로드 + URL 저장 |
| 장바구니 CRUD | Context cart | PHP Session + CartManager | add/remove/updateQty 각 동작 |
| 수량 변경 재견적 | updateQty() | AJAX `/api/cart.php?action=update` | 수량 변경 → 금액 실시간 갱신 |
| 주문 생성 | addOrder() + localStorage | OrderController::create() + MariaDB | 주문 ID 발급 + DB 저장 확인 |
| 커스텀 상품 견적 | calcCustomQuote() | `/api/quote.php?type=custom` | qtyTiers + optGroups 계산 검증 |
| 견적서 인쇄 | window.print() | window.print() | @media print CSS 동작 확인 |
| 주문 확인서 | ReceiptModal | order-done.php 인라인 | 주문 완료 후 인쇄 가능 여부 |

### 견적 계산 검증 케이스 (동일 기대값)

```
입력: A4 / IX-Eco / 2001p / 10부 / 모조80 / 양면 / 아트지250 / 단면 / 유광코팅 / 무선 / 없음

기대 결과:
  - 인쇄비:    50,025원   (전체카운터 20010 → c=20000, 25원/p × 2001p)
  - 내지비:    12,406.2원 (모조80 국8절=12.4 ÷2 × 2001p)
  - 면지비:    0원
  - 표지지비:  77.735원   (아트지250 국4절)
  - 표지인쇄:  200원      (단면)
  - 코팅:      100원      (국4절 유광코팅)
  - 제본:      3,000원    (무선, 10부)
  - 1부단가:   65,808.935원
  - 공급가액:  658,090원  (×10부, 올림)
  - 부가세:    65,809원
  - 합계:      723,899원  ✅
```

### 보안 체크리스트

- [ ] 파일 업로드 확장자 화이트리스트 검증 (`api/upload.php`)
- [ ] 파일명 sanitize (특수문자 제거)
- [ ] 업로드 디렉토리에 PHP 실행 비활성화 (`uploads/.htaccess`: `php_flag engine off`)
- [ ] PDO Prepared Statement 사용 (SQL Injection 방지)
- [ ] `htmlspecialchars()` 출력 이스케이프 (XSS 방지)
- [ ] 세션 고정 공격 방어 (30분마다 ID 재생성)
- [ ] CSRF 토큰 (주문 제출 폼)
- [ ] `/includes/` 직접 접근 차단 (.htaccess / Nginx)
- [ ] 파일 크기 제한 (`php.ini`: `upload_max_filesize = 100M`, `post_max_size = 110M`)

### 환경변수 설정

```ini
# .env (또는 서버 환경변수)
DB_HOST=localhost
DB_NAME=bookmoa
DB_USER=bookmoa_user
DB_PASS=your_secure_password

# 업로드 설정 (php.ini 또는 .htaccess)
; upload_max_filesize = 100M
; post_max_size = 110M
; max_execution_time = 120
```
