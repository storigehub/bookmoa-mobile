-- BookMoa MariaDB Migration Schema
-- 목적: Supabase(app_config 중심) -> MariaDB 정규 스키마 전환
-- 권장 버전: MariaDB 10.6+

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS bookmoa
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE bookmoa;

-- =========================================================
-- 1) 관리자 인증/세션
-- =========================================================

CREATE TABLE IF NOT EXISTS admin_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL DEFAULT '관리자',
  role VARCHAR(30) NOT NULL DEFAULT 'admin',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_users_email (email),
  KEY idx_admin_users_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_user_id BIGINT UNSIGNED NOT NULL,
  session_token CHAR(64) NOT NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_sessions_token (session_token),
  KEY idx_admin_sessions_admin_user (admin_user_id),
  KEY idx_admin_sessions_expires_at (expires_at),
  CONSTRAINT fk_admin_sessions_admin_user
    FOREIGN KEY (admin_user_id) REFERENCES admin_users(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 2) 설정/가격 프로파일
-- =========================================================

CREATE TABLE IF NOT EXISTS settings (
  id TINYINT UNSIGNED NOT NULL DEFAULT 1,
  biz_name VARCHAR(191) NOT NULL,
  ceo VARCHAR(100) NOT NULL,
  biz_no VARCHAR(30) NOT NULL,
  tel VARCHAR(40) NOT NULL,
  fax VARCHAR(40) NULL,
  email VARCHAR(191) NULL,
  addr VARCHAR(255) NULL,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  delivery_fee INT NOT NULL DEFAULT 0,
  delivery_days VARCHAR(30) NULL DEFAULT '3~5',
  memo TEXT NULL,
  use_inner_paper_cost TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO settings (
  id, biz_name, ceo, biz_no, tel, fax, email, addr, tax_rate, delivery_fee, delivery_days, memo, use_inner_paper_cost
)
VALUES (
  1, '(주)북모아', '김동명', '508-81-40669', '1644-1814', '02-2260-9090', 'book@bookmoa.com',
  '서울특별시 성동구 성수동2가 315-61 성수역 SK V1 Tower 706호', 10.00, 0, '3~5', '', 1
)
ON DUPLICATE KEY UPDATE id = VALUES(id);

CREATE TABLE IF NOT EXISTS pricing_profiles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL DEFAULT '기본 가격표',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pricing_profiles_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO pricing_profiles (id, name, is_active)
VALUES (1, '기본 가격표', 1)
ON DUPLICATE KEY UPDATE id = VALUES(id);

CREATE TABLE IF NOT EXISTS pricing_print_types (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_id BIGINT UNSIGNED NOT NULL,
  print_type VARCHAR(50) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pricing_print_types_profile_type (profile_id, print_type),
  KEY idx_pricing_print_types_profile_order (profile_id, sort_order),
  CONSTRAINT fk_pricing_print_types_profile
    FOREIGN KEY (profile_id) REFERENCES pricing_profiles(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pricing_print_table (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_id BIGINT UNSIGNED NOT NULL,
  counter_c INT NOT NULL,
  print_type VARCHAR(50) NOT NULL,
  unit_price DECIMAL(12,4) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pricing_print_table (profile_id, counter_c, print_type),
  KEY idx_pricing_print_table_lookup (profile_id, counter_c),
  CONSTRAINT fk_pricing_print_table_profile
    FOREIGN KEY (profile_id) REFERENCES pricing_profiles(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pricing_side_rate (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_id BIGINT UNSIGNED NOT NULL,
  side_name VARCHAR(20) NOT NULL, -- 단면/양면
  unit_price DECIMAL(12,4) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pricing_side_rate (profile_id, side_name),
  CONSTRAINT fk_pricing_side_rate_profile
    FOREIGN KEY (profile_id) REFERENCES pricing_profiles(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pricing_cover_print_rate (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_id BIGINT UNSIGNED NOT NULL,
  side_name VARCHAR(20) NOT NULL, -- 단면/양면
  unit_price DECIMAL(12,4) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pricing_cover_print_rate (profile_id, side_name),
  CONSTRAINT fk_pricing_cover_print_rate_profile
    FOREIGN KEY (profile_id) REFERENCES pricing_profiles(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pricing_inner_papers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_id BIGINT UNSIGNED NOT NULL,
  paper_name VARCHAR(120) NOT NULL,
  size_code VARCHAR(20) NOT NULL, -- 46판, 3절, 8절, 16절, 32절, 국판, 국4절, 국8절, 국16절
  unit_price DECIMAL(12,4) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pricing_inner_papers (profile_id, paper_name, size_code),
  KEY idx_pricing_inner_papers_lookup (profile_id, paper_name),
  CONSTRAINT fk_pricing_inner_papers_profile
    FOREIGN KEY (profile_id) REFERENCES pricing_profiles(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pricing_cover_papers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_id BIGINT UNSIGNED NOT NULL,
  paper_name VARCHAR(120) NOT NULL,
  size_code VARCHAR(20) NOT NULL, -- 국4절, 3절
  unit_price DECIMAL(12,4) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pricing_cover_papers (profile_id, paper_name, size_code),
  KEY idx_pricing_cover_papers_lookup (profile_id, paper_name),
  CONSTRAINT fk_pricing_cover_papers_profile
    FOREIGN KEY (profile_id) REFERENCES pricing_profiles(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pricing_coating_table (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_id BIGINT UNSIGNED NOT NULL,
  cover_size VARCHAR(20) NOT NULL, -- 국4절, 3절, (필요 시 B6/A5/B5/A4 호환 데이터도 허용)
  coating_type VARCHAR(30) NOT NULL, -- 없음/유광코팅/무광코팅
  unit_price DECIMAL(12,4) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pricing_coating_table (profile_id, cover_size, coating_type),
  KEY idx_pricing_coating_lookup (profile_id, cover_size),
  CONSTRAINT fk_pricing_coating_table_profile
    FOREIGN KEY (profile_id) REFERENCES pricing_profiles(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pricing_binding_types (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_id BIGINT UNSIGNED NOT NULL,
  binding_type VARCHAR(50) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pricing_binding_types (profile_id, binding_type),
  KEY idx_pricing_binding_types_profile_order (profile_id, sort_order),
  CONSTRAINT fk_pricing_binding_types_profile
    FOREIGN KEY (profile_id) REFERENCES pricing_profiles(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pricing_binding_table (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_id BIGINT UNSIGNED NOT NULL,
  qty_q INT NOT NULL,
  binding_type VARCHAR(50) NOT NULL,
  unit_price DECIMAL(12,4) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pricing_binding_table (profile_id, qty_q, binding_type),
  KEY idx_pricing_binding_lookup (profile_id, qty_q),
  CONSTRAINT fk_pricing_binding_table_profile
    FOREIGN KEY (profile_id) REFERENCES pricing_profiles(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pricing_endpapers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_id BIGINT UNSIGNED NOT NULL,
  endpaper_name VARCHAR(50) NOT NULL,
  format_code VARCHAR(20) NOT NULL, -- B6/A5/B5/A4
  unit_price DECIMAL(12,4) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pricing_endpapers (profile_id, endpaper_name, format_code),
  KEY idx_pricing_endpapers_lookup (profile_id, endpaper_name),
  CONSTRAINT fk_pricing_endpapers_profile
    FOREIGN KEY (profile_id) REFERENCES pricing_profiles(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pricing_postproc (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_id BIGINT UNSIGNED NOT NULL,
  proc_name VARCHAR(50) NOT NULL,
  unit_price DECIMAL(12,4) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pricing_postproc (profile_id, proc_name),
  CONSTRAINT fk_pricing_postproc_profile
    FOREIGN KEY (profile_id) REFERENCES pricing_profiles(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 3) 커스텀 상품
-- =========================================================

CREATE TABLE IF NOT EXISTS custom_products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_uid VARCHAR(50) NOT NULL, -- 기존 문자열 id 호환
  name VARCHAR(120) NOT NULL,
  icon VARCHAR(20) NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_custom_products_uid (product_uid),
  KEY idx_custom_products_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS custom_option_groups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  group_uid VARCHAR(50) NOT NULL,
  group_name VARCHAR(120) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_custom_option_groups_uid (product_id, group_uid),
  KEY idx_custom_option_groups_product (product_id, sort_order),
  CONSTRAINT fk_custom_option_groups_product
    FOREIGN KEY (product_id) REFERENCES custom_products(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS custom_options (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  option_group_id BIGINT UNSIGNED NOT NULL,
  option_uid VARCHAR(50) NOT NULL,
  option_label VARCHAR(120) NOT NULL,
  price_adj DECIMAL(12,4) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_custom_options_uid (option_group_id, option_uid),
  KEY idx_custom_options_group (option_group_id, sort_order),
  CONSTRAINT fk_custom_options_group
    FOREIGN KEY (option_group_id) REFERENCES custom_option_groups(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS custom_qty_tiers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  min_qty INT NOT NULL,
  base_price DECIMAL(12,4) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_custom_qty_tiers (product_id, min_qty),
  KEY idx_custom_qty_tiers_product_qty (product_id, min_qty),
  CONSTRAINT fk_custom_qty_tiers_product
    FOREIGN KEY (product_id) REFERENCES custom_products(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 4) 주문/장바구니/저장사양
-- =========================================================

CREATE TABLE IF NOT EXISTS carts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cart_uid VARCHAR(50) NOT NULL,
  customer_key VARCHAR(120) NOT NULL, -- 비로그인 사용자 구분키(세션/디바이스)
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_carts_uid (cart_uid),
  KEY idx_carts_customer (customer_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cart_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cart_id BIGINT UNSIGNED NOT NULL,
  item_uid VARCHAR(50) NOT NULL,
  is_custom TINYINT(1) NOT NULL DEFAULT 0,
  cfg_json JSON NOT NULL,
  quote_json JSON NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cart_items_uid (cart_id, item_uid),
  KEY idx_cart_items_cart (cart_id),
  CONSTRAINT fk_cart_items_cart
    FOREIGN KEY (cart_id) REFERENCES carts(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cart_item_files (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cart_item_id BIGINT UNSIGNED NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_url VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_cart_item_files_item (cart_item_id),
  CONSTRAINT fk_cart_item_files_item
    FOREIGN KEY (cart_item_id) REFERENCES cart_items(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_no VARCHAR(40) NOT NULL, -- ORD-YYYY-XXXX
  status TINYINT UNSIGNED NOT NULL DEFAULT 0,
  total_amount INT NOT NULL DEFAULT 0,
  payment_method VARCHAR(30) NULL,
  customer_name VARCHAR(100) NULL,
  customer_phone VARCHAR(40) NULL,
  customer_email VARCHAR(191) NULL,
  customer_addr VARCHAR(255) NULL,
  customer_addr_detail VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_order_no (order_no),
  KEY idx_orders_status_created (status, created_at),
  KEY idx_orders_customer_name (customer_name),
  KEY idx_orders_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  item_no INT NOT NULL DEFAULT 1,
  is_custom TINYINT(1) NOT NULL DEFAULT 0,
  product_name VARCHAR(120) NULL,
  quantity INT NOT NULL DEFAULT 1,
  line_total INT NOT NULL DEFAULT 0,
  cfg_json JSON NOT NULL,
  quote_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_order_items_order_item_no (order_id, item_no),
  KEY idx_order_items_order (order_id),
  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_files (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_item_id BIGINT UNSIGNED NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_url VARCHAR(500) NULL,
  file_size BIGINT NULL,
  mime_type VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_files_order_item (order_item_id),
  CONSTRAINT fk_order_files_order_item
    FOREIGN KEY (order_item_id) REFERENCES order_items(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  status TINYINT UNSIGNED NOT NULL,
  note VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100) NULL,
  PRIMARY KEY (id),
  KEY idx_order_history_order_created (order_id, created_at),
  CONSTRAINT fk_order_history_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saved_configs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  config_uid VARCHAR(50) NOT NULL,
  customer_key VARCHAR(120) NOT NULL,
  config_name VARCHAR(120) NOT NULL,
  cfg_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_saved_configs_uid (config_uid),
  KEY idx_saved_configs_customer_created (customer_key, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 5) 알림/가격이력/마이그레이션 로그
-- =========================================================

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  icon VARCHAR(10) NULL,
  title VARCHAR(120) NOT NULL,
  body VARCHAR(255) NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_read_created (is_read, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS price_histories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tab_name VARCHAR(50) NOT NULL,
  changed_by VARCHAR(100) NULL,
  note VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_price_histories_created (created_at),
  KEY idx_price_histories_tab (tab_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS migration_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  stage_name VARCHAR(120) NOT NULL,
  source_key VARCHAR(120) NULL, -- 예: p4-orders
  total_count INT NULL,
  success_count INT NULL,
  fail_count INT NULL,
  message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_migration_logs_stage_created (stage_name, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 6) 조회 성능 보조 인덱스
-- =========================================================

CREATE INDEX idx_order_items_created ON order_items(created_at);
CREATE INDEX idx_order_history_status ON order_history(status);

SET FOREIGN_KEY_CHECKS = 1;

-- 끝.
