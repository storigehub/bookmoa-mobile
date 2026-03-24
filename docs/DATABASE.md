# Supabase 데이터베이스 구조

## 권장 설정
- **Region**: ap-northeast-1 (Northeast Asia)
- **Plan**: Free tier (월 500MB DB, 2GB 대역폭)

## Stage 1: Key-Value 스토어 (현재)

```sql
CREATE TABLE app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_app_config_updated ON app_config(updated_at DESC);
```

| key | value 타입 | 설명 |
|-----|-----------|------|
| p4-cart | JSON Array | 장바구니 |
| p4-orders | JSON Array | 주문 내역 |
| p4-pricing | JSON Object | 가격 데이터 (45종×9규격) |
| p4-notifs | JSON Array | 알림 |
| p4-phist | JSON Array | 가격 변경 이력 |
| p4-saved | JSON Array | 즐겨찾기 사양 |
| p4-settings | JSON Object | 사업자 설정 |
| p4-cprods | JSON Array | 커스텀 상품 |

## Stage 2: 정규화 테이블 (확장용)

```sql
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  status INTEGER DEFAULT 0,
  customer JSONB,
  payment TEXT,
  total INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  cfg JSONB NOT NULL,
  quote JSONB NOT NULL,
  is_custom BOOLEAN DEFAULT false
);

CREATE TABLE custom_products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📦',
  description TEXT,
  active BOOLEAN DEFAULT true,
  opt_groups JSONB DEFAULT '[]',
  qty_tiers JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE pricing (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by TEXT
);

CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  icon TEXT,
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Stage 3: Auth + RLS

```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_read" ON orders FOR SELECT USING (true);
CREATE POLICY "orders_write" ON orders FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricing_read" ON pricing FOR SELECT USING (true);
CREATE POLICY "pricing_admin" ON pricing FOR ALL USING (
  EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin')
);
```
