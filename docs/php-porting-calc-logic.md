# 견적 계산 로직 PHP 포팅 가이드

> 북모아 Printable — 계산 엔진 PHP 8.1 변환  
> 작성일: 2026-04-08  
> 원본 소스: `src/App.jsx` (calcQuote, calcCustomQuote, recalcPaper, DEF_PRICING)

---

## 1. 전체 구조 요약

```
JavaScript (App.jsx)          PHP (BookmoaPricing.php)
─────────────────────         ─────────────────────────
DEF_PRICING (const)      →    BookmoaPricing::DEFAULT_PRICING (static array)
lookupLE(val, rows, key) →    BookmoaPricing::lookupLE(val, rows, key)
calcQuote(cfg, pricing)  →    BookmoaPricing::calcQuote(cfg, pricing, options)
calcCustomQuote(prod,..) →    BookmoaPricing::calcCustomQuote(prod, selections, qty)
recalcPaper(paper)       →    BookmoaPricing::recalcPaper(paper)
```

---

## 2. 가격 데이터 PHP 배열 변환 (`BookmoaPricing.php`)

```php
<?php
/**
 * BookmoaPricing — 북모아 디지털 인쇄 견적 계산 엔진
 *
 * 원본: src/App.jsx DEF_PRICING + calcQuote + calcCustomQuote + recalcPaper
 * PHP 8.1 기준, 외부 의존성 없음
 *
 * 검증 케이스 (엑셀 2026NEW견적작업중.xlsx 기준):
 *   format=A4, printType=IX-Eco, pages=2001, quantity=10,
 *   innerPaper=모조80, innerSide=양면,
 *   coverPaper=아트지250, coverSide=단면,
 *   coating=유광코팅, binding=무선, endpaper=없음
 *   → 1부단가: 65,808.935원 ✅
 */
class BookmoaPricing
{
    // ─────────────────────────────────────────────────
    // 판형 정의
    //   innerSize : 내지 1장 단위 절수 (innerPapers 조회 키)
    //   coverSize : 기본 표지 절수 (무선날개/양장+A5~A4는 calcQuote에서 3절로 오버라이드)
    //   desc      : 실제 치수 (mm)
    // ─────────────────────────────────────────────────
    public const FORMAT_MAP = [
        'B6' => ['innerSize' => '32절',   'coverSize' => '국4절', 'desc' => '128×182mm'],
        'A5' => ['innerSize' => '국16절', 'coverSize' => '국4절', 'desc' => '148×210mm'],
        'B5' => ['innerSize' => '16절',   'coverSize' => '국4절', 'desc' => '182×257mm'],
        'A4' => ['innerSize' => '국8절',  'coverSize' => '국4절', 'desc' => '210×297mm'],
    ];

    // ─────────────────────────────────────────────────
    // 인쇄 방식 목록 (인덱스가 printTable.v[] 인덱스와 1:1 대응)
    // ─────────────────────────────────────────────────
    public const PRINT_TYPES = [
        'IX-Eco', 'IX-Sta', 'IX-Pre', 'FX-4도', 'FX-2도', 'FX-1도', 'TO-4도', 'TO-1도'
    ];

    // ─────────────────────────────────────────────────
    // 인쇄 단가 테이블
    //   c : 전체카운터(pages × quantity) 기준 구간 하한값
    //   v : 인쇄방식별 원/p 단가 (null = 해당 구간 미지원)
    // ─────────────────────────────────────────────────
    public const PRINT_TABLE = [
        ['c' =>      0, 'v' => [200, 200, 300, null, null, null, 200,  50]],
        ['c' =>    500, 'v' => [150, 150, 250, null, null, null, 150,  30]],
        ['c' =>   1000, 'v' => [100, 100, 150, null, null, null, 100,  25]],
        ['c' =>   2000, 'v' => [ 50,  50, 100,   50,   30,   17,  70,  20]],
        ['c' =>   3000, 'v' => [ 45,  50,  90,   45,   27,   16,  45,  19]],
        ['c' =>   5000, 'v' => [ 40,  45,  80,   40,   24,   15,  40,  18]],
        ['c' =>   8000, 'v' => [ 35,  40,  70,   35,   21,   14,  40,  17]],
        ['c' =>  10000, 'v' => [ 30,  35,  60,   30,   18,   13,  40,  16]],
        ['c' =>  20000, 'v' => [ 25,  30,  50,   25,   15,   12,  40,  15]],
        ['c' =>  30000, 'v' => [ 20,  25,  40,   20,   12,   11,  40,  14]],
        ['c' =>  50000, 'v' => [ 15,  20,  30,   15,    9,   10,  40,  13]],
        ['c' =>  80000, 'v' => [ 15,  20,  25,   15,    9,    9,  40,  12]],
        ['c' => 100000, 'v' => [ 15,  20,  25,   15,    9,    9,  40,  11]],
    ];

    // 단/양면 고정 단가 (useInnerPaperCost=false 시 사용, 참고용)
    public const SIDE_RATE = ['단면' => 12.4, '양면' => 6.2];

    // 표지 인쇄비 (단면/양면 고정)
    public const COVER_PRINT_RATE = ['단면' => 200, '양면' => 400];

    // ─────────────────────────────────────────────────
    // 내지 종이 단가표 (45종 × 9절수)
    //   46판/국판 : 전지(1000매) 기준가 (원)
    //   나머지   : 1장당 단가 (원) — recalcPaper() 공식으로 자동 계산
    // ─────────────────────────────────────────────────
    public const INNER_PAPERS = [
        '모조80'          => ['46판'=>71400, '3절'=>47.6,     '8절'=>17.85,   '16절'=>8.925,  '32절'=>6.2,    '국판'=>49600, '국4절'=>24.8,   '국8절'=>12.4,   '국16절'=>6.2   ],
        '모조100'         => ['46판'=>88470, '3절'=>58.98,    '8절'=>22.118,  '16절'=>11.059, '32절'=>7.683,  '국판'=>61460, '국4절'=>30.73,  '국8절'=>15.365, '국16절'=>7.683 ],
        '모조120'         => ['46판'=>106160,'3절'=>70.773,   '8절'=>26.54,   '16절'=>13.27,  '32절'=>9.219,  '국판'=>73750, '국4절'=>36.875, '국8절'=>18.438, '국16절'=>9.219 ],
        '모조150'         => ['46판'=>132700,'3절'=>88.467,   '8절'=>33.175,  '16절'=>16.588, '32절'=>11.523, '국판'=>92180, '국4절'=>46.09,  '국8절'=>23.045, '국16절'=>11.523],
        '모조180'         => ['46판'=>159240,'3절'=>106.16,   '8절'=>39.81,   '16절'=>19.905, '32절'=>13.828, '국판'=>110620,'국4절'=>55.31,  '국8절'=>27.655, '국16절'=>13.828],
        '모조220'         => ['46판'=>203370,'3절'=>135.58,   '8절'=>50.843,  '16절'=>25.421, '32절'=>17.659, '국판'=>141270,'국4절'=>70.635, '국8절'=>35.318, '국16절'=>17.659],
        '모조260'         => ['46판'=>240340,'3절'=>160.227,  '8절'=>60.085,  '16절'=>30.043, '32절'=>20.87,  '국판'=>166960,'국4절'=>83.48,  '국8절'=>41.74,  '국16절'=>20.87 ],
        '미색모조80'      => ['46판'=>73540, '3절'=>49.027,   '8절'=>18.385,  '16절'=>9.193,  '32절'=>6.386,  '국판'=>51090, '국4절'=>25.545, '국8절'=>12.773, '국16절'=>6.386 ],
        '미색모조100'     => ['46판'=>91130, '3절'=>60.753,   '8절'=>22.783,  '16절'=>11.391, '32절'=>7.913,  '국판'=>63300, '국4절'=>31.65,  '국8절'=>15.825, '국16절'=>7.913 ],
        '뉴플러스(백색)80'  => ['46판'=>73550, '3절'=>49.033, '8절'=>18.388,  '16절'=>9.194,  '32절'=>6.386,  '국판'=>51090, '국4절'=>25.545, '국8절'=>12.773, '국16절'=>6.386 ],
        '뉴플러스(백색)100' => ['46판'=>91140, '3절'=>60.76,  '8절'=>22.785,  '16절'=>11.393, '32절'=>7.913,  '국판'=>63300, '국4절'=>31.65,  '국8절'=>15.825, '국16절'=>7.913 ],
        '뉴플러스(미색)80'  => ['46판'=>75760, '3절'=>50.507, '8절'=>18.94,   '16절'=>9.47,   '32절'=>6.578,  '국판'=>52620, '국4절'=>26.31,  '국8절'=>13.155, '국16절'=>6.578 ],
        '뉴플러스(미색)100' => ['46판'=>93870, '3절'=>62.58,  '8절'=>23.468,  '16절'=>11.734, '32절'=>8.15,   '국판'=>65200, '국4절'=>32.6,   '국8절'=>16.3,   '국16절'=>8.15  ],
        '아트지80'        => ['46판'=>87140, '3절'=>58.093,   '8절'=>21.785,  '16절'=>10.893, '32절'=>7.566,  '국판'=>60530, '국4절'=>30.265, '국8절'=>15.133, '국16절'=>7.566 ],
        '아트지100'       => ['46판'=>88000, '3절'=>58.667,   '8절'=>22.0,    '16절'=>11.0,   '32절'=>7.641,  '국판'=>61130, '국4절'=>30.565, '국8절'=>15.283, '국16절'=>7.641 ],
        '아트지120'       => ['46판'=>105590,'3절'=>70.393,   '8절'=>26.398,  '16절'=>13.199, '32절'=>9.169,  '국판'=>73350, '국4절'=>36.675, '국8절'=>18.338, '국16절'=>9.169 ],
        '아트지150'       => ['46판'=>134290,'3절'=>89.527,   '8절'=>33.573,  '16절'=>16.786, '32절'=>11.66,  '국판'=>93280, '국4절'=>46.64,  '국8절'=>23.32,  '국16절'=>11.66 ],
        '아트지180'       => ['46판'=>161150,'3절'=>107.433,  '8절'=>40.288,  '16절'=>20.144, '32절'=>13.993, '국판'=>111940,'국4절'=>55.97,  '국8절'=>27.985, '국16절'=>13.993],
        '아트지200'       => ['46판'=>179050,'3절'=>119.367,  '8절'=>44.763,  '16절'=>22.381, '32절'=>15.548, '국판'=>124380,'국4절'=>62.19,  '국8절'=>31.095, '국16절'=>15.548],
        '아트지250'       => ['46판'=>223810,'3절'=>149.207,  '8절'=>55.953,  '16절'=>27.976, '32절'=>19.434, '국판'=>155470,'국4절'=>77.735, '국8절'=>38.868, '국16절'=>19.434],
        '아트지300'       => ['46판'=>268580,'3절'=>179.053,  '8절'=>67.145,  '16절'=>33.573, '32절'=>23.321, '국판'=>186570,'국4절'=>93.285, '국8절'=>46.643, '국16절'=>23.321],
        '스노우지80'      => ['46판'=>87140, '3절'=>58.093,   '8절'=>21.785,  '16절'=>10.893, '32절'=>7.566,  '국판'=>60530, '국4절'=>30.265, '국8절'=>15.133, '국16절'=>7.566 ],
        '스노우지100'     => ['46판'=>88000, '3절'=>58.667,   '8절'=>22.0,    '16절'=>11.0,   '32절'=>7.641,  '국판'=>61130, '국4절'=>30.565, '국8절'=>15.283, '국16절'=>7.641 ],
        '스노우지120'     => ['46판'=>105590,'3절'=>70.393,   '8절'=>26.398,  '16절'=>13.199, '32절'=>9.169,  '국판'=>73350, '국4절'=>36.675, '국8절'=>18.338, '국16절'=>9.169 ],
        '스노우지150'     => ['46판'=>134290,'3절'=>89.527,   '8절'=>33.573,  '16절'=>16.786, '32절'=>11.66,  '국판'=>93280, '국4절'=>46.64,  '국8절'=>23.32,  '국16절'=>11.66 ],
        '스노우지180'     => ['46판'=>161150,'3절'=>107.433,  '8절'=>40.288,  '16절'=>20.144, '32절'=>13.993, '국판'=>111940,'국4절'=>55.97,  '국8절'=>27.985, '국16절'=>13.993],
        '스노우지200'     => ['46판'=>179050,'3절'=>119.367,  '8절'=>44.763,  '16절'=>22.381, '32절'=>15.548, '국판'=>124380,'국4절'=>62.19,  '국8절'=>31.095, '국16절'=>15.548],
        '스노우지250'     => ['46판'=>223810,'3절'=>149.207,  '8절'=>55.953,  '16절'=>27.976, '32절'=>19.434, '국판'=>155470,'국4절'=>77.735, '국8절'=>38.868, '국16절'=>19.434],
        '스노우지300'     => ['46판'=>268580,'3절'=>179.053,  '8절'=>67.145,  '16절'=>33.573, '32절'=>23.321, '국판'=>186570,'국4절'=>93.285, '국8절'=>46.643, '국16절'=>23.321],
        '아르떼(UW)90'   => ['46판'=>142170,'3절'=>94.78,    '8절'=>35.543,  '16절'=>17.771, '32절'=>12.345, '국판'=>98760, '국4절'=>49.38,  '국8절'=>24.69,  '국16절'=>12.345],
        '아르떼(UW)105'  => ['46판'=>165870,'3절'=>110.58,   '8절'=>41.468,  '16절'=>20.734, '32절'=>14.404, '국판'=>115230,'국4절'=>57.615, '국8절'=>28.808, '국16절'=>14.404],
        '아르떼(UW)130'  => ['46판'=>205360,'3절'=>136.907,  '8절'=>51.34,   '16절'=>25.67,  '32절'=>17.831, '국판'=>142650,'국4절'=>71.325, '국8절'=>35.663, '국16절'=>17.831],
        '아르떼(UW)160'  => ['46판'=>252760,'3절'=>168.507,  '8절'=>63.19,   '16절'=>31.595, '32절'=>21.948, '국판'=>175580,'국4절'=>87.79,  '국8절'=>43.895, '국16절'=>21.948],
        '아르떼(UW)190'  => ['46판'=>300140,'3절'=>200.093,  '8절'=>75.035,  '16절'=>37.518, '32절'=>26.063, '국판'=>208500,'국4절'=>104.25, '국8절'=>52.125, '국16절'=>26.063],
        '아르떼(UW)210'  => ['46판'=>331740,'3절'=>221.16,   '8절'=>82.935,  '16절'=>41.468, '32절'=>28.805, '국판'=>230440,'국4절'=>115.22, '국8절'=>57.61,  '국16절'=>28.805],
        '아르떼(UW)230'  => ['46판'=>363330,'3절'=>242.22,   '8절'=>90.833,  '16절'=>45.416, '32절'=>31.549, '국판'=>252390,'국4절'=>126.195,'국8절'=>63.098, '국16절'=>31.549],
        '아르떼(UW)310'  => ['46판'=>489710,'3절'=>326.473,  '8절'=>122.428, '16절'=>61.214, '32절'=>42.523, '국판'=>340180,'국4절'=>170.09, '국8절'=>85.045, '국16절'=>42.523],
        '아르떼(NW)90'   => ['46판'=>142170,'3절'=>94.78,    '8절'=>35.543,  '16절'=>17.771, '32절'=>12.345, '국판'=>98760, '국4절'=>49.38,  '국8절'=>24.69,  '국16절'=>12.345],
        '아르떼(NW)105'  => ['46판'=>165870,'3절'=>110.58,   '8절'=>41.468,  '16절'=>20.734, '32절'=>14.404, '국판'=>115230,'국4절'=>57.615, '국8절'=>28.808, '국16절'=>14.404],
        '아르떼(NW)130'  => ['46판'=>205360,'3절'=>136.907,  '8절'=>51.34,   '16절'=>25.67,  '32절'=>17.831, '국판'=>142650,'국4절'=>71.325, '국8절'=>35.663, '국16절'=>17.831],
        '아르떼(NW)160'  => ['46판'=>252760,'3절'=>168.507,  '8절'=>63.19,   '16절'=>31.595, '32절'=>21.948, '국판'=>175580,'국4절'=>87.79,  '국8절'=>43.895, '국16절'=>21.948],
        '아르떼(NW)190'  => ['46판'=>300140,'3절'=>200.093,  '8절'=>75.035,  '16절'=>37.518, '32절'=>26.063, '국판'=>208500,'국4절'=>104.25, '국8절'=>52.125, '국16절'=>26.063],
        '아르떼(NW)210'  => ['46판'=>331740,'3절'=>221.16,   '8절'=>82.935,  '16절'=>41.468, '32절'=>28.805, '국판'=>230440,'국4절'=>115.22, '국8절'=>57.61,  '국16절'=>28.805],
        '아르떼(NW)230'  => ['46판'=>363330,'3절'=>242.22,   '8절'=>90.833,  '16절'=>45.416, '32절'=>31.549, '국판'=>252390,'국4절'=>126.195,'국8절'=>63.098, '국16절'=>31.549],
        '아르떼(NW)310'  => ['46판'=>489710,'3절'=>326.473,  '8절'=>122.428, '16절'=>61.214, '32절'=>42.523, '국판'=>340180,'국4절'=>170.09, '국8절'=>85.045, '국16절'=>42.523],
    ];

    // ─────────────────────────────────────────────────
    // 표지 종이 단가 (절수별, 표지전용 고급지만 포함)
    // ─────────────────────────────────────────────────
    public const COVER_PAPERS = [
        '아트지250'    => ['국4절' =>  77.735, '3절' => 149.207],
        '아트지300'    => ['국4절' =>  93.285, '3절' => 179.053],
        '스노우지250'  => ['국4절' =>  77.735, '3절' => 149.207],
        '스노우지300'  => ['국4절' =>  93.285, '3절' => 179.053],
        '아르떼(UW)190'=> ['국4절' => 104.25,  '3절' => 200.093],
        '아르떼(UW)210'=> ['국4절' => 115.22,  '3절' => 221.16 ],
        '아르떼(UW)230'=> ['국4절' => 126.195, '3절' => 242.22 ],
        '아르떼(UW)310'=> ['국4절' => 170.09,  '3절' => 326.473],
        '아르떼(NW)190'=> ['국4절' => 104.25,  '3절' => 200.093],
        '아르떼(NW)210'=> ['국4절' => 115.22,  '3절' => 221.16 ],
        '아르떼(NW)230'=> ['국4절' => 126.195, '3절' => 242.22 ],
        '아르떼(NW)310'=> ['국4절' => 170.09,  '3절' => 326.473],
    ];

    // ─────────────────────────────────────────────────
    // 코팅 단가 (표지 절수 기준으로 인덱싱)
    //   국4절 커버: 유광100/무광200
    //   3절 커버 : 유광150/무광250
    // ─────────────────────────────────────────────────
    public const COATING_TABLE = [
        '국4절' => ['없음' => 0, '유광코팅' => 100, '무광코팅' => 200],
        '3절'   => ['없음' => 0, '유광코팅' => 150, '무광코팅' => 250],
    ];

    // ─────────────────────────────────────────────────
    // 제본 방식 목록 (인덱스가 bindingTable.v[] 인덱스와 1:1 대응)
    // ─────────────────────────────────────────────────
    public const BINDING_TYPES = [
        '무선', '무선날개', '중철', '스프링(PP제외)', '스프링(PP포함)', '양장'
    ];

    // ─────────────────────────────────────────────────
    // 제본 단가 테이블 (계단식)
    //   q : 부수 기준 구간 하한값
    //   v : 제본방식별 1부당 단가 (원)
    // ─────────────────────────────────────────────────
    public const BINDING_TABLE = [
        ['q' =>   0, 'v' => [3000, 3600, 1000, 3000, 3300, 6000]],
        ['q' =>  12, 'v' => [1800, 2400,  800, 1800, 2100, 6000]],
        ['q' =>  32, 'v' => [1500, 2100,  800, 1500, 1800, 6000]],
        ['q' =>  52, 'v' => [1200, 1800,  600, 1200, 1500, 6000]],
        ['q' =>  82, 'v' => [ 800, 1400,  500,  800, 1100, 6000]],
        ['q' => 122, 'v' => [ 750, 1350,  500,  750, 1050, 6000]],
        ['q' => 152, 'v' => [ 750, 1350,  400,  750, 1050, 6000]],
        ['q' => 201, 'v' => [ 700, 1300,  400,  700, 1000, 6000]],
        ['q' => 252, 'v' => [ 700, 1300,  320,  700, 1000, 6000]],
        ['q' => 301, 'v' => [ 650, 1250,  320,  650,  950, 6000]],
        ['q' => 501, 'v' => [ 600, 1200,  270,  600,  900, 6000]],
        ['q' => 952, 'v' => [ 600, 1200,  200,  600,  900, 6000]],
    ];

    // 면지 단가 (판형별, 없음=0)
    public const ENDPAPERS = [
        '없음'     => ['B6' =>    0, 'A5' =>    0, 'B5' =>    0, 'A4' =>    0],
        'A.연보라' => ['B6' => 114.37,'A5' => 114.37,'B5' => 228.74,'A4' => 228.74],
        'A.라벤더' => ['B6' => 114.37,'A5' => 114.37,'B5' => 228.74,'A4' => 228.74],
        'A.크림'   => ['B6' => 114.37,'A5' => 114.37,'B5' => 228.74,'A4' => 228.74],
        'B.황매화' => ['B6' => 122.97,'A5' => 122.97,'B5' => 245.94,'A4' => 245.94],
        'D.연군청' => ['B6' => 151.56,'A5' => 151.56,'B5' => 303.13,'A4' => 303.13],
    ];

    // 후가공 단가 (선택 항목별)
    public const POST_PROC = [
        '재단' => 500, '접지' => 300, '귀돌이' => 400, '금박' => 2000, '은박' => 2000,
    ];


    // ═══════════════════════════════════════════════════
    // lookupLE — 계단식 테이블에서 val 이하 최대 구간 row 반환
    //
    // JavaScript 원본:
    //   function lookupLE(val,rows,key){
    //     let r=rows[0];
    //     for(const row of rows){if(row[key]<=val)r=row;else break;}
    //     return r;
    //   }
    //
    // @param float  $val  비교 기준값
    // @param array  $rows 테이블 배열 (각 요소에 $key 포함)
    // @param string $key  비교할 필드명 ('c' 또는 'q')
    // @return array       조건 만족하는 마지막 row
    // ═══════════════════════════════════════════════════
    public static function lookupLE(float $val, array $rows, string $key): array
    {
        $result = $rows[0];
        foreach ($rows as $row) {
            if ($row[$key] <= $val) {
                $result = $row;
            } else {
                break; // 정렬된 오름차순 배열 가정 — 초과 시 즉시 종료
            }
        }
        return $result;
    }


    // ═══════════════════════════════════════════════════
    // calcQuote — 일반 책자 견적 계산 (핵심 엔진)
    //
    // @param array $cfg     견적 사양
    //   - format         : string  판형 (B6/A5/B5/A4)
    //   - pages          : int     페이지 수
    //   - quantity       : int     부수
    //   - printType      : string  인쇄 방식
    //   - innerPaper     : string  내지 종이명
    //   - innerSide      : string  내지 인쇄면 (단면/양면)
    //   - coverPaper     : string  표지 종이명
    //   - coverSide      : string  표지 인쇄면 (단면/양면)
    //   - coating        : string  코팅 (없음/유광코팅/무광코팅)
    //   - binding        : string  제본 방식
    //   - endpaper       : string  면지 종류
    //   - postProcessing : array   후가공 목록
    // @param array $pricing   가격 테이블 (기본값: DEFAULT_PRICING 상수들)
    // @param array $options
    //   - useInnerPaperCost : bool  true=innerPapers 기반(기본), false=sideRate 고정
    //
    // @return array {
    //   unitPrice : int    1부 단가 (원, 반올림)
    //   subtotal  : int    공급가액 = unitPrice × quantity
    //   vat       : int    부가세 = subtotal × 10%
    //   total     : int    합계 = subtotal + vat
    //   quantity  : int    부수
    //   lines     : array  항목별 세부 내역 (견적서 출력용)
    // }
    // ═══════════════════════════════════════════════════
    public static function calcQuote(array $cfg, array $pricing = [], array $options = []): array
    {
        // 가격 테이블 병합 (인자 없으면 상수 기본값 사용)
        $p = array_merge([
            'formatMap'      => self::FORMAT_MAP,
            'printTypes'     => self::PRINT_TYPES,
            'printTable'     => self::PRINT_TABLE,
            'sideRate'       => self::SIDE_RATE,
            'coverPrintRate' => self::COVER_PRINT_RATE,
            'innerPapers'    => self::INNER_PAPERS,
            'coverPapers'    => self::COVER_PAPERS,
            'coatingTable'   => self::COATING_TABLE,
            'bindingTypes'   => self::BINDING_TYPES,
            'bindingTable'   => self::BINDING_TABLE,
            'endpapers'      => self::ENDPAPERS,
            'postProc'       => self::POST_PROC,
        ], $pricing);

        $useInnerPaperCost = $options['useInnerPaperCost'] ?? true;

        $format         = $cfg['format']         ?? 'A4';
        $pages          = (int)($cfg['pages']    ?? 100);
        $quantity       = (int)($cfg['quantity'] ?? 1);
        $printType      = $cfg['printType']      ?? 'FX-4도';
        $innerPaper     = $cfg['innerPaper']     ?? '모조80';
        $innerSide      = $cfg['innerSide']      ?? '양면';
        $coverPaper     = $cfg['coverPaper']     ?? '아트지250';
        $coverSide      = $cfg['coverSide']      ?? '단면';
        $coating        = $cfg['coating']        ?? '없음';
        $binding        = $cfg['binding']        ?? '무선';
        $endpaper       = $cfg['endpaper']       ?? '없음';
        $postProcessing = $cfg['postProcessing'] ?? [];

        $lines = [];

        // ── 1. 인쇄비 ─────────────────────────────────────────────
        // printTable은 '전체카운터'(pages × quantity) 기준으로 구간 조회
        // 예: 2001p × 10부 = 20010 → c=20000 구간 → IX-Eco 25원/p
        $ptIdx  = array_search($printType, $p['printTypes'], true);
        $pRow   = self::lookupLE($pages * $quantity, $p['printTable'], 'c');
        $pu     = ($ptIdx !== false && isset($pRow['v'][$ptIdx])) ? (float)$pRow['v'][$ptIdx] : 0.0;
        $lines[] = [
            'key'   => 'print',
            'label' => '인쇄비',
            'unit'  => $pu,
            'qty'   => $pages,
            'total' => $pu * $pages,
            'desc'  => $printType . ' × ' . $pages . 'p',
        ];

        // ── 2. 내지 종이비 ────────────────────────────────────────
        // useInnerPaperCost=true : innerPapers[종이][절수] 직접 조회
        //   절수: B6=32절, A5=국16절, B5=16절, A4=국8절
        //   양면 → 1장에 2페이지 → 장 단가 ÷ 2
        // useInnerPaperCost=false: sideRate 고정값 (단면12.4/양면6.2)
        $innerSize = $p['formatMap'][$format]['innerSize'] ?? '국8절';
        $leafCost  = $p['innerPapers'][$innerPaper][$innerSize] ?? 0.0;

        if ($useInnerPaperCost) {
            $sr        = ($innerSide === '양면') ? $leafCost / 2.0 : $leafCost;
            $innerDesc = $innerSide . ' ' . $innerSize . ' ' . number_format($sr, 3) . '원/p';
        } else {
            $sr        = $p['sideRate'][$innerSide] ?? 6.2;
            $innerDesc = $innerSide . ' sideRate ' . number_format($sr, 3) . '원/p';
        }

        $lines[] = [
            'key'   => 'inner',
            'label' => '내지(' . $innerPaper . ')',
            'unit'  => $sr,
            'qty'   => $pages,
            'total' => $sr * $pages,
            'desc'  => $innerDesc,
        ];

        // ── 3. 면지비 ─────────────────────────────────────────────
        $ep      = $p['endpapers'][$endpaper][$format] ?? 0.0;
        $lines[] = ['key' => 'endpaper', 'label' => '면지',  'unit' => $ep, 'qty' => 1, 'total' => $ep,  'desc' => $endpaper];

        // ── 4. 표지 절수 결정 ─────────────────────────────────────
        // 무선날개/양장 + A5/B5/A4 → 3절  (B6은 항상 국4절)
        $useThreeJul = in_array($binding, ['무선날개', '양장'], true)
                    && in_array($format,  ['A5', 'B5', 'A4'], true);
        $cs = $useThreeJul ? '3절' : ($p['formatMap'][$format]['coverSize'] ?? '국4절');

        // ── 5. 표지 종이비 ────────────────────────────────────────
        $cu      = $p['coverPapers'][$coverPaper][$cs] ?? 0.0;
        $lines[] = ['key' => 'cover', 'label' => '표지(' . $coverPaper . ')', 'unit' => $cu, 'qty' => 1, 'total' => $cu, 'desc' => $cs];

        // ── 6. 표지 인쇄비 ────────────────────────────────────────
        $cp      = $p['coverPrintRate'][$coverSide] ?? 200;
        $lines[] = ['key' => 'coverPrint', 'label' => '표지인쇄', 'unit' => $cp, 'qty' => 1, 'total' => $cp, 'desc' => $coverSide];

        // ── 7. 코팅비 ─────────────────────────────────────────────
        // 국4절 커버: 유광100/무광200, 3절 커버: 유광150/무광250
        $co      = $p['coatingTable'][$cs][$coating] ?? 0;
        $lines[] = ['key' => 'coating', 'label' => '코팅', 'unit' => $co, 'qty' => 1, 'total' => $co, 'desc' => $coating];

        // ── 8. 제본비 ─────────────────────────────────────────────
        // bindingTable은 부수(quantity) 기준 구간 조회
        $bIdx    = array_search($binding, $p['bindingTypes'], true);
        $bRow    = self::lookupLE($quantity, $p['bindingTable'], 'q');
        $bc      = ($bIdx !== false && isset($bRow['v'][$bIdx])) ? (int)$bRow['v'][$bIdx] : 0;
        $lines[] = ['key' => 'binding', 'label' => '제본', 'unit' => $bc, 'qty' => 1, 'total' => $bc, 'desc' => $binding];

        // ── 9. 후가공비 ───────────────────────────────────────────
        $pp = 0.0;
        foreach ($postProcessing as $x) {
            $pp += $p['postProc'][$x] ?? 0;
        }
        if ($pp > 0) {
            $lines[] = ['key' => 'pp', 'label' => '후가공', 'unit' => $pp, 'qty' => 1, 'total' => $pp, 'desc' => implode(',', $postProcessing)];
        }

        // ── 최종 계산 ─────────────────────────────────────────────
        $unitPriceRaw = array_sum(array_column($lines, 'total'));
        $unitPrice    = (int)round($unitPriceRaw);
        $subtotal     = $unitPrice * $quantity;           // 공급가액
        $vat          = (int)round($subtotal * 0.1);      // 부가세 10%
        $total        = $subtotal + $vat;

        return [
            'unitPrice' => $unitPrice,
            'subtotal'  => $subtotal,
            'vat'       => $vat,
            'total'     => $total,
            'quantity'  => $quantity,
            'lines'     => $lines,
        ];
    }


    // ═══════════════════════════════════════════════════
    // calcCustomQuote — 커스텀 상품 견적 계산
    //
    // @param array $prod       커스텀 상품 정의
    //   - id        : string
    //   - name      : string
    //   - qtyTiers  : array  [{minQty, basePrice}, ...] 수량 구간별 기본가
    //   - optGroups : array  [{id, name, choices: [{id, label, priceAdj}, ...]}, ...]
    // @param array $selections 선택된 옵션 {groupId => choiceId}
    // @param int   $quantity   주문 수량
    //
    // @return array {unitPrice, subtotal, vat, total, quantity, lines}
    // ═══════════════════════════════════════════════════
    public static function calcCustomQuote(array $prod, array $selections, int $quantity): array
    {
        if (empty($prod)) {
            return ['unitPrice' => 0, 'subtotal' => 0, 'vat' => 0, 'total' => 0, 'lines' => [], 'quantity' => 0];
        }

        $lines = [];

        // 수량 구간(qtyTiers) 에서 현재 quantity에 맞는 기본가 결정
        // minQty 오름차순 정렬 후, quantity >= minQty인 마지막 구간 적용
        $base  = 0;
        $tiers = $prod['qtyTiers'] ?? [];
        usort($tiers, fn($a, $b) => $a['minQty'] <=> $b['minQty']);
        foreach ($tiers as $tier) {
            if ($quantity >= $tier['minQty']) {
                $base = (float)$tier['basePrice'];
            }
        }
        $lines[] = ['key' => 'base', 'label' => '기본가', 'unit' => $base, 'qty' => 1, 'total' => $base, 'desc' => $quantity . '부 구간'];

        // 옵션 그룹별 priceAdj 적용 (>0 추가금, <0 할인, =0 포함)
        foreach ($prod['optGroups'] ?? [] as $group) {
            $selId = $selections[$group['id']] ?? null;
            if (!$selId) continue;

            $choice = null;
            foreach ($group['choices'] as $c) {
                if ($c['id'] === $selId) { $choice = $c; break; }
            }
            if (!$choice) continue;

            $adj = (float)($choice['priceAdj'] ?? 0);
            $lines[] = [
                'key'   => 'opt_' . $group['id'],
                'label' => $group['name'] . ': ' . $choice['label'],
                'unit'  => $adj,
                'qty'   => 1,
                'total' => $adj,
                'desc'  => $adj === 0.0 ? '포함' : ($adj > 0 ? '+₩' . number_format($adj) : '-₩' . number_format(abs($adj))),
            ];
        }

        $unitPriceRaw = max(0.0, array_sum(array_column($lines, 'total')));
        $unitPrice    = (int)round($unitPriceRaw);
        $subtotal     = $unitPrice * $quantity;
        $vat          = (int)round($subtotal * 0.1);

        return [
            'unitPrice' => $unitPrice,
            'subtotal'  => $subtotal,
            'vat'       => $vat,
            'total'     => $subtotal + $vat,
            'quantity'  => $quantity,
            'lines'     => $lines,
        ];
    }


    // ═══════════════════════════════════════════════════
    // recalcPaper — 46판/국판 기준가로 나머지 절수 자동 계산
    //
    // 환산식 (엑셀 원본 동일):
    //   46판 계열: 3절=÷1500, 8절=÷4000, 16절=÷8000
    //   국판 계열: 국4절=÷2000, 국8절=÷4000, 국16절=÷8000
    //   32절 = 국판÷8000 (= 국16절)
    //
    // @param array $paper  ['46판' => 71400, '국판' => 49600, ...]
    // @return array  전체 절수 채워진 배열
    // ═══════════════════════════════════════════════════
    public static function recalcPaper(array $paper): array
    {
        $p46 = (float)($paper['46판'] ?? 0);
        $guk = (float)($paper['국판'] ?? 0);

        return array_merge($paper, [
            '46판'  => $p46,
            '3절'   => $p46 / 1500,
            '8절'   => $p46 / 4000,
            '16절'  => $p46 / 8000,
            '32절'  => $guk / 8000,   // = 국16절
            '국판'  => $guk,
            '국4절' => $guk / 2000,
            '국8절' => $guk / 4000,
            '국16절'=> $guk / 8000,
        ]);
    }
}
```

---

## 3. API 엔드포인트 — 견적 계산 (`/api/quote`)

```php
<?php
// controllers/QuoteController.php
require_once __DIR__ . '/../BookmoaPricing.php';

class QuoteController
{
    /**
     * POST /api/quote
     *
     * Body (JSON):
     * {
     *   "cfg": {
     *     "format": "A4", "pages": 100, "quantity": 1,
     *     "printType": "FX-4도", "innerPaper": "모조80", "innerSide": "양면",
     *     "coverPaper": "아트지250", "coverSide": "단면",
     *     "coating": "무광코팅", "binding": "무선",
     *     "endpaper": "없음", "postProcessing": []
     *   },
     *   "options": { "useInnerPaperCost": true }
     * }
     *
     * Response (JSON):
     * {
     *   "data": {
     *     "unitPrice": 12345, "subtotal": 12345, "vat": 1235, "total": 13580,
     *     "quantity": 1,
     *     "lines": [
     *       {"key":"print","label":"인쇄비","unit":50,"qty":100,"total":5000,"desc":"FX-4도 × 100p"},
     *       ...
     *     ]
     *   },
     *   "error": null
     * }
     */
    public static function calculate(): void
    {
        $body    = json_decode(file_get_contents('php://input'), true) ?? [];
        $cfg     = $body['cfg']     ?? [];
        $options = $body['options'] ?? [];

        // DB에서 커스텀 가격 테이블 로드 (없으면 기본값)
        $pricing = self::loadPricing();

        $result = BookmoaPricing::calcQuote($cfg, $pricing, $options);

        echo json_encode(['data' => $result, 'error' => null]);
    }

    /**
     * POST /api/quote/custom
     * 커스텀 상품 견적 계산
     *
     * Body: { "productId": "...", "selections": {...}, "quantity": 5 }
     */
    public static function calculateCustom(): void
    {
        $body       = json_decode(file_get_contents('php://input'), true) ?? [];
        $productId  = $body['productId']  ?? '';
        $selections = $body['selections'] ?? [];
        $quantity   = (int)($body['quantity'] ?? 1);

        // DB에서 커스텀 상품 로드
        $pdo  = getDB();
        $stmt = $pdo->prepare('SELECT * FROM custom_products WHERE id = ? AND active = 1');
        $stmt->execute([$productId]);
        $row  = $stmt->fetch();

        if (!$row) {
            http_response_code(404);
            echo json_encode(['error' => '상품을 찾을 수 없습니다.']);
            return;
        }

        $prod = [
            'id'        => $row['id'],
            'name'      => $row['name'],
            'qtyTiers'  => json_decode($row['qty_tiers'],  true) ?? [],
            'optGroups' => json_decode($row['opt_groups'], true) ?? [],
        ];

        $result = BookmoaPricing::calcCustomQuote($prod, $selections, $quantity);
        echo json_encode(['data' => $result, 'error' => null]);
    }

    // ── 내부 헬퍼: DB에서 가격 테이블 로드 ──
    private static function loadPricing(): array
    {
        try {
            $pdo  = getDB();
            $stmt = $pdo->query('SELECT data FROM pricing ORDER BY id DESC LIMIT 1');
            $row  = $stmt->fetch();
            if ($row) {
                return json_decode($row['data'], true) ?? [];
            }
        } catch (\Exception $e) {
            // DB 오류 시 기본값 사용
        }
        return []; // 빈 배열 → calcQuote에서 상수 기본값 병합
    }
}
```

---

## 4. 검증 스크립트

```php
<?php
// scripts/verify-calc.php — 엑셀 원본과 계산 결과 대조
require_once __DIR__ . '/../BookmoaPricing.php';

$cases = [
    [
        'desc' => '엑셀 원본 (A4/모조80/양면/2001p/10부/IX-Eco/아트지250/단면/유광/무선)',
        'cfg'  => [
            'format' => 'A4', 'pages' => 2001, 'quantity' => 10,
            'printType' => 'IX-Eco', 'innerPaper' => '모조80', 'innerSide' => '양면',
            'coverPaper' => '아트지250', 'coverSide' => '단면',
            'coating' => '유광코팅', 'binding' => '무선', 'endpaper' => '없음',
            'postProcessing' => [],
        ],
        'expect' => ['unitPrice' => 65809, 'subtotal' => 658090, 'vat' => 65809, 'total' => 723899],
    ],
    [
        'desc' => 'B5/아트지150/단면/100p/5부/FX-4도/아르떼(NW)190/단면/무광코팅/무선날개',
        'cfg'  => [
            'format' => 'B5', 'pages' => 100, 'quantity' => 5,
            'printType' => 'FX-4도', 'innerPaper' => '아트지150', 'innerSide' => '단면',
            'coverPaper' => '아르떼(NW)190', 'coverSide' => '단면',
            'coating' => '무광코팅', 'binding' => '무선날개', 'endpaper' => '없음',
            'postProcessing' => [],
        ],
        'expect' => null, // 결과 확인용
    ],
];

$pass = 0; $fail = 0;
foreach ($cases as $case) {
    $result = BookmoaPricing::calcQuote($case['cfg']);
    echo "─── {$case['desc']}\n";
    echo "  unitPrice={$result['unitPrice']}  subtotal={$result['subtotal']}  vat={$result['vat']}  total={$result['total']}\n";

    foreach ($result['lines'] as $line) {
        printf("  %-15s %8.3f × %4d = %10.3f  (%s)\n",
            $line['label'], $line['unit'], $line['qty'], $line['total'], $line['desc']);
    }

    if ($case['expect']) {
        $ok = true;
        foreach ($case['expect'] as $k => $v) {
            if (abs($result[$k] - $v) > 1) {
                echo "  ❌ $k: 기대={$v}, 실제={$result[$k]}\n";
                $ok = false; $fail++;
            }
        }
        if ($ok) { echo "  ✅ 검증 통과\n"; $pass++; }
    }
    echo "\n";
}

echo "결과: {$pass} 통과 / {$fail} 실패\n";
```

```bash
php scripts/verify-calc.php
```

---

## 5. 프론트엔드 연동 — AJAX 실시간 견적 계산

현재 React에서는 `calcQuote(cfg)` 를 클라이언트에서 직접 실행하지만,  
PHP 백엔드로 이전 시 폼 변경마다 API를 호출합니다.

```js
// 견적 폼 변경 시 실시간 계산 (디바운스 300ms 적용)
let debounceTimer = null;

async function fetchQuote(cfg) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    const res = await fetch('/api/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cfg, options: { useInnerPaperCost: true } }),
    });
    const { data } = await res.json();
    renderQuoteSummary(data);   // 화면 갱신
  }, 300);
}

function renderQuoteSummary(quote) {
  document.getElementById('unit-price').textContent = '₩' + quote.unitPrice.toLocaleString('ko-KR');
  document.getElementById('subtotal').textContent   = '₩' + quote.subtotal.toLocaleString('ko-KR');
  document.getElementById('vat').textContent        = '₩' + quote.vat.toLocaleString('ko-KR');
  document.getElementById('total').textContent      = '₩' + quote.total.toLocaleString('ko-KR');

  const tbody = document.getElementById('quote-lines');
  tbody.innerHTML = quote.lines.map(l => `
    <tr>
      <td>${l.label}</td>
      <td class="text-right">${l.unit.toFixed(2)}</td>
      <td class="text-right">${l.qty}</td>
      <td class="text-right">₩${l.total.toLocaleString('ko-KR', {maximumFractionDigits:0})}</td>
    </tr>
  `).join('');
}
```
