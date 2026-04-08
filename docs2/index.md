# docs2 문서 인덱스

PHP + MariaDB 전환 작업을 빠르게 진행하기 위한 문서 모음입니다.

## 권장 읽기 순서

1. [Supabase -> PHP + MariaDB 마이그레이션 가이드](./Supabase_to_PHP_MariaDB_마이그레이션_가이드.md)
2. [MariaDB 이관 스키마(SQL)](./mariadb_이관_스키마.sql)
3. [MariaDB 초기데이터 적재 템플릿(SQL)](./mariadb_초기데이터_적재_템플릿.sql)
4. [p4-pricing -> full upsert SQL 생성기(PHP)](./generate_full_insert_from_p4_pricing.php)
5. [견적 계산로직 PHP 포팅 가이드](./견적_계산로직_PHP_포팅_가이드.md)
6. [주문화면/견적흐름 PHP 포팅 가이드](./주문화면_견적흐름_PHP_포팅_가이드.md)

## 문서별 목적

- **마이그레이션 가이드**
  - 데이터 이관 전략, 스키마 재설계, ETL, 컷오버/롤백 절차
- **계산로직 포팅 가이드**
  - `calcQuote`/`calcCustomQuote`의 PHP 구현 기준과 검증 방법
- **주문화면 포팅 가이드**
  - 주문/견적 UI 흐름을 PHP API 또는 서버 렌더링으로 이전할 때의 설계 기준
- **MariaDB 이관 스키마(SQL)**
  - 운영용 테이블/인덱스/외래키/기본 설정 정의
- **MariaDB 초기데이터 적재 템플릿(SQL)**
  - 관리자/설정/가격타입/샘플 단가 및 ETL 연계용 초기 적재 템플릿
- **full upsert SQL 생성기(PHP)**
  - `p4-pricing` JSON 전체를 pricing 정규 테이블 INSERT SQL로 자동 생성

## 빠른 실행 체크리스트

- [ ] MariaDB 스키마 초안 작성
- [ ] PHP `QuoteService` 구현
- [ ] 기존 JS 계산 결과와 PHP 결과 비교 테스트
- [ ] 주문 생성 트랜잭션 API 구현
- [ ] 관리자 설정(`useInnerPaperCost` 포함) 연동
- [ ] 파일 업로드/다운로드 전환
- [ ] 스테이징 컷오버 리허설

