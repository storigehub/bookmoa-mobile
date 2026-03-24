-- ═══════════════════════════════════════════════════
-- BookMoa Printable — Supabase Schema
-- Region: ap-northeast-1 (Northeast Asia)
-- ═══════════════════════════════════════════════════

-- Stage 1: Key-Value 스토어 (즉시 사용)
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_config_updated 
  ON app_config(updated_at DESC);

-- 초기 설정 데이터
INSERT INTO app_config (key, value) VALUES (
  'p4-settings',
  '{
    "bizName": "(주)북모아",
    "ceo": "김동명",
    "bizNo": "508-81-40669",
    "tel": "1644-1814",
    "fax": "02-2260-9090",
    "email": "book@bookmoa.com",
    "addr": "서울특별시 성동구 성수동2가 315-61 성수역 SK V1 Tower 706호",
    "taxRate": 10,
    "deliveryFee": 0,
    "deliveryDays": "3~5",
    "memo": ""
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- ═══════════════════════════════════════════════════
-- Stage 2: 정규화 테이블 (향후 확장 시 주석 해제)
-- ═══════════════════════════════════════════════════

-- CREATE TABLE IF NOT EXISTS orders (
--   id TEXT PRIMARY KEY,
--   status INTEGER DEFAULT 0,
--   customer JSONB,
--   payment TEXT,
--   total INTEGER DEFAULT 0,
--   created_at TIMESTAMPTZ DEFAULT now(),
--   updated_at TIMESTAMPTZ DEFAULT now()
-- );
-- CREATE INDEX idx_orders_status ON orders(status);
-- CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- CREATE TABLE IF NOT EXISTS order_items (
--   id SERIAL PRIMARY KEY,
--   order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
--   cfg JSONB NOT NULL,
--   quote JSONB NOT NULL,
--   is_custom BOOLEAN DEFAULT false,
--   created_at TIMESTAMPTZ DEFAULT now()
-- );

-- CREATE TABLE IF NOT EXISTS custom_products (
--   id TEXT PRIMARY KEY,
--   name TEXT NOT NULL,
--   icon TEXT DEFAULT '📦',
--   description TEXT,
--   active BOOLEAN DEFAULT true,
--   opt_groups JSONB DEFAULT '[]',
--   qty_tiers JSONB DEFAULT '[]',
--   created_at TIMESTAMPTZ DEFAULT now(),
--   updated_at TIMESTAMPTZ DEFAULT now()
-- );

-- CREATE TABLE IF NOT EXISTS notifications (
--   id SERIAL PRIMARY KEY,
--   icon TEXT,
--   title TEXT NOT NULL,
--   body TEXT,
--   read BOOLEAN DEFAULT false,
--   created_at TIMESTAMPTZ DEFAULT now()
-- );
