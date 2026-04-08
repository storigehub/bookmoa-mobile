-- BookMoa MariaDB Seed Template
-- 대상 스키마: docs2/mariadb_이관_스키마.sql
-- 목적: 운영 초기값(설정/가격타입/기초 단가)을 빠르게 적재하기 위한 템플릿

SET NAMES utf8mb4;
USE bookmoa;

START TRANSACTION;

-- =========================================================
-- 1) 관리자 계정 샘플
-- =========================================================
-- 운영 반영 전 반드시 비밀번호 해시 재생성 권장
-- PHP: password_hash('Bookmoa1234!', PASSWORD_DEFAULT)

INSERT INTO admin_users (email, password_hash, name, role, is_active)
VALUES
  ('admin@bookmoa.com', '$2y$10$replace_with_real_hash_generated_in_php', '북모아 관리자', 'admin', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  role = VALUES(role),
  is_active = VALUES(is_active);

-- =========================================================
-- 2) 기본 설정
-- =========================================================

INSERT INTO settings (
  id, biz_name, ceo, biz_no, tel, fax, email, addr,
  tax_rate, delivery_fee, delivery_days, memo, use_inner_paper_cost
)
VALUES (
  1,
  '(주)북모아',
  '김동명',
  '508-81-40669',
  '1644-1814',
  '02-2260-9090',
  'book@bookmoa.com',
  '서울특별시 성동구 성수동2가 315-61 성수역 SK V1 Tower 706호',
  10.00,
  0,
  '3~5',
  '',
  1
)
ON DUPLICATE KEY UPDATE
  biz_name = VALUES(biz_name),
  ceo = VALUES(ceo),
  biz_no = VALUES(biz_no),
  tel = VALUES(tel),
  fax = VALUES(fax),
  email = VALUES(email),
  addr = VALUES(addr),
  tax_rate = VALUES(tax_rate),
  delivery_fee = VALUES(delivery_fee),
  delivery_days = VALUES(delivery_days),
  memo = VALUES(memo),
  use_inner_paper_cost = VALUES(use_inner_paper_cost);

-- =========================================================
-- 3) 가격 프로파일/타입 기초 데이터
-- =========================================================

INSERT INTO pricing_profiles (id, name, is_active)
VALUES (1, '기본 가격표', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  is_active = VALUES(is_active);

-- print types
INSERT INTO pricing_print_types (profile_id, print_type, sort_order) VALUES
  (1, 'IX-Eco', 1),
  (1, 'IX-Sta', 2),
  (1, 'IX-Pre', 3),
  (1, 'FX-4도', 4),
  (1, 'FX-2도', 5),
  (1, 'FX-1도', 6),
  (1, 'TO-4도', 7),
  (1, 'TO-1도', 8)
ON DUPLICATE KEY UPDATE
  sort_order = VALUES(sort_order);

-- binding types
INSERT INTO pricing_binding_types (profile_id, binding_type, sort_order) VALUES
  (1, '무선', 1),
  (1, '무선날개', 2),
  (1, '중철', 3),
  (1, '스프링(PP제외)', 4),
  (1, '스프링(PP포함)', 5),
  (1, '양장', 6)
ON DUPLICATE KEY UPDATE
  sort_order = VALUES(sort_order);

-- sideRate (legacy fallback)
INSERT INTO pricing_side_rate (profile_id, side_name, unit_price) VALUES
  (1, '단면', 12.4),
  (1, '양면', 6.2)
ON DUPLICATE KEY UPDATE
  unit_price = VALUES(unit_price);

-- cover print rate
INSERT INTO pricing_cover_print_rate (profile_id, side_name, unit_price) VALUES
  (1, '단면', 200),
  (1, '양면', 400)
ON DUPLICATE KEY UPDATE
  unit_price = VALUES(unit_price);

-- post process base
INSERT INTO pricing_postproc (profile_id, proc_name, unit_price) VALUES
  (1, '재단', 500),
  (1, '접지', 300),
  (1, '귀돌이', 400),
  (1, '금박', 2000),
  (1, '은박', 2000)
ON DUPLICATE KEY UPDATE
  unit_price = VALUES(unit_price);

-- =========================================================
-- 4) print/binding/coating/endpaper 샘플
--    (전체 데이터는 마이그레이션 스크립트로 적재 권장)
-- =========================================================

-- print table sample (counter c 기준)
INSERT INTO pricing_print_table (profile_id, counter_c, print_type, unit_price) VALUES
  (1, 0, 'IX-Eco', 200),
  (1, 500, 'IX-Eco', 150),
  (1, 1000, 'IX-Eco', 100),
  (1, 2000, 'IX-Eco', 50),
  (1, 0, 'TO-1도', 50),
  (1, 500, 'TO-1도', 30),
  (1, 1000, 'TO-1도', 25),
  (1, 2000, 'TO-1도', 20)
ON DUPLICATE KEY UPDATE
  unit_price = VALUES(unit_price);

-- binding table sample
INSERT INTO pricing_binding_table (profile_id, qty_q, binding_type, unit_price) VALUES
  (1, 0, '무선', 3000),
  (1, 12, '무선', 1800),
  (1, 32, '무선', 1500),
  (1, 52, '무선', 1200),
  (1, 0, '양장', 6000),
  (1, 12, '양장', 6000)
ON DUPLICATE KEY UPDATE
  unit_price = VALUES(unit_price);

-- coating table sample
INSERT INTO pricing_coating_table (profile_id, cover_size, coating_type, unit_price) VALUES
  (1, '국4절', '없음', 0),
  (1, '국4절', '유광코팅', 100),
  (1, '국4절', '무광코팅', 200),
  (1, '3절', '없음', 0),
  (1, '3절', '유광코팅', 150),
  (1, '3절', '무광코팅', 250)
ON DUPLICATE KEY UPDATE
  unit_price = VALUES(unit_price);

-- endpaper sample
INSERT INTO pricing_endpapers (profile_id, endpaper_name, format_code, unit_price) VALUES
  (1, '없음', 'B6', 0),
  (1, '없음', 'A5', 0),
  (1, '없음', 'B5', 0),
  (1, '없음', 'A4', 0),
  (1, 'A.연보라', 'A5', 114.37),
  (1, 'A.연보라', 'B5', 228.74)
ON DUPLICATE KEY UPDATE
  unit_price = VALUES(unit_price);

-- =========================================================
-- 5) inner/cover paper 템플릿(예시)
-- =========================================================

-- inner paper sample: 모조80
INSERT INTO pricing_inner_papers (profile_id, paper_name, size_code, unit_price) VALUES
  (1, '모조80', '46판', 71400),
  (1, '모조80', '3절', 47.6),
  (1, '모조80', '8절', 17.85),
  (1, '모조80', '16절', 8.925),
  (1, '모조80', '32절', 6.2),
  (1, '모조80', '국판', 49600),
  (1, '모조80', '국4절', 24.8),
  (1, '모조80', '국8절', 12.4),
  (1, '모조80', '국16절', 6.2)
ON DUPLICATE KEY UPDATE
  unit_price = VALUES(unit_price);

-- cover paper sample
INSERT INTO pricing_cover_papers (profile_id, paper_name, size_code, unit_price) VALUES
  (1, '아트지250', '국4절', 77.735),
  (1, '아트지250', '3절', 149.207),
  (1, '아트지300', '국4절', 93.285),
  (1, '아트지300', '3절', 179.053)
ON DUPLICATE KEY UPDATE
  unit_price = VALUES(unit_price);

-- =========================================================
-- 6) 마이그레이션 참고 메모
-- =========================================================
INSERT INTO migration_logs (stage_name, source_key, total_count, success_count, fail_count, message)
VALUES
  ('seed', 'initial', NULL, NULL, NULL, '초기 템플릿 데이터 적재 완료')
ON DUPLICATE KEY UPDATE
  message = VALUES(message);

COMMIT;

-- ---------------------------------------------------------
-- [중요] 전체 가격표 적재 방법
-- ---------------------------------------------------------
-- 1) 기존 p4-pricing JSON 추출
-- 2) ETL 스크립트(PHP/Node)로 아래 테이블에 bulk upsert
--    - pricing_print_table
--    - pricing_binding_table
--    - pricing_inner_papers
--    - pricing_cover_papers
--    - pricing_coating_table
--    - pricing_endpapers
--    - pricing_postproc
-- 3) 적재 후 검증:
--    - row count
--    - 랜덤 샘플 단가 대조
--    - calcQuote 결과 대조(원 단위 일치)

