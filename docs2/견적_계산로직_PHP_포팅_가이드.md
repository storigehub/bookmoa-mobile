# 견적 계산로직 PHP 포팅 가이드

이 문서는 `src/App.jsx`의 `calcQuote`, `calcCustomQuote`, `lookupLE`, `recalcPaper` 로직을 PHP로 포팅할 때의 기준 구현을 설명합니다.

## 1) 포팅 대상 함수

- `lookupLE(val, rows, key)`
- `calcQuote(cfg, pricing, options)`
- `calcCustomQuote(prod, selections, quantity)`
- `recalcPaper(paper)`

## 2) PHP 서비스 구조 권장

- `app/Services/QuoteService.php`
  - `calcQuote(array $cfg, array $pricing, array $options = []): array`
  - `calcCustomQuote(array $prod, array $selections, int $quantity): array`
  - `lookupLE(float|int $val, array $rows, string $key): array`
  - `recalcPaper(array $paper): array`

## 3) 일반 견적 계산 규칙

현재 JS 로직 기준:

1. 인쇄비
   - 구간 조회: `pages * quantity` 기준으로 `printTable`에서 `c <= counter` 최대 행
   - 단가: 해당 행 `v[printTypeIndex]`
   - 금액: `unit * pages`
2. 내지비
   - 옵션 `useInnerPaperCost`가 `true`면:
     - `innerPapers[innerPaper][innerSize]` 조회
     - 양면이면 `leafCost / 2`
   - `false`면 `sideRate[innerSide]`
   - 금액: `unit * pages`
3. 면지비: `endpapers[endpaper][format]`
4. 표지비: `coverPapers[coverPaper][coverSize]`
   - `무선날개/양장 + A5/B5/A4`는 `3절`
5. 표지인쇄비: `coverPrintRate[coverSide]`
6. 코팅비: `coatingTable[coverSize][coating]`
7. 제본비: `bindingTable`의 `q <= quantity` 최대 행에서 제본 인덱스 값
8. 후가공: `postProc` 합산

최종:
- `unitPrice = round(sum(lines.total))`
- `subtotal = unitPrice * quantity`
- `vat = round(subtotal * 0.1)` (현재 고정 10%)
- `total = subtotal + vat`

## 4) PHP 예시 코드(핵심)

```php
public function calcQuote(array $cfg, array $pricing, array $options = []): array
{
    $useInnerPaperCost = ($options['useInnerPaperCost'] ?? true) !== false;
    $lines = [];

    $format = $cfg['format'];
    $pages = (int)$cfg['pages'];
    $quantity = (int)$cfg['quantity'];

    // 1) print
    $ptIdx = array_search($cfg['printType'], $pricing['printTypes'], true);
    $pRow = $this->lookupLE($pages * $quantity, $pricing['printTable'], 'c');
    $pu = ($ptIdx !== false) ? (($pRow['v'][$ptIdx] ?? 0) ?: 0) : 0;
    $lines[] = ['key' => 'print', 'unit' => $pu, 'qty' => $pages, 'total' => $pu * $pages];

    // 2) inner
    $innerSize = $pricing['formatMap'][$format]['innerSize'] ?? '국8절';
    $leafCost = $pricing['innerPapers'][$cfg['innerPaper']][$innerSize] ?? 0;
    $sr = $useInnerPaperCost
        ? (($cfg['innerSide'] === '양면') ? $leafCost / 2 : $leafCost)
        : ($pricing['sideRate'][$cfg['innerSide']] ?? 6.2);
    $lines[] = ['key' => 'inner', 'unit' => $sr, 'qty' => $pages, 'total' => $sr * $pages];

    // ... endpaper / cover / coverPrint / coating / binding / postproc

    $up = 0;
    foreach ($lines as $l) $up += $l['total'];
    $unitPrice = (int)round($up);
    $subtotal = $unitPrice * $quantity;
    $vat = (int)round($subtotal * 0.1);

    return [
        'unitPrice' => $unitPrice,
        'subtotal' => $subtotal,
        'vat' => $vat,
        'total' => $subtotal + $vat,
        'lines' => $lines,
        'quantity' => $quantity,
    ];
}
```

## 5) 커스텀 상품 계산 포팅 포인트

- `qtyTiers` 정렬 후 `quantity >= minQty` 마지막 구간의 `basePrice` 적용
- 선택 옵션별 `priceAdj` 합산
- 음수 방지: `max(0, sum)`
- 일반 견적과 동일한 `unit/subtotal/vat/total` 계산

## 6) DB 연동 방식(권장)

- 계산은 DB 트랜잭션 내부에서 **서버측 재계산** 필수
- 클라이언트 전달 quote는 참고용, 저장 전 서버 재검증
- 주문 생성 API:
  1. 입력 검증
  2. pricing/settings 로드
  3. 서버 calcQuote/calcCustomQuote 실행
  4. 재계산 결과 저장

## 7) 부동소수/반올림 주의

- JS와 결과 일치가 중요하면:
  - 금액 연산 중간값은 `float`
  - 최종 반올림 시 `round` 동일 적용
  - `number_format`은 표시 전용
- 회계 엄밀성이 필요하면 소수 대신 정수(원 단위)로 연산하도록 점진 개선

## 8) 테스트 케이스(필수)

- 일반 견적 20세트(판형/제본/코팅/부수 조합)
- 내지 옵션 ON/OFF 비교 케이스
- 커스텀 상품 옵션 가감(+/-) 케이스
- 경계값:
  - 페이지 구간 경계(예: 2000, 2001)
  - 제본 부수 경계(예: 12, 32, 52 ...)

## 9) 검증 방법

- 기존 React 계산 결과(JSON)와 PHP 계산 결과를 동일 입력으로 비교
- 허용 오차: 원 단위 0
- 불일치 시:
  1. 구간 조회 기준(`pages*quantity`) 확인
  2. coverSize 강제 규칙 확인
  3. 내지 ON/OFF 옵션 적용 여부 확인

