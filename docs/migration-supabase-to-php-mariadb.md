# Supabase → PHP + MariaDB 마이그레이션 가이드

> 북모아 Printable 시스템 기준  
> 작성일: 2026-04-08  
> 현재 스택: React SPA + Supabase(DB/Auth/Storage) + Vercel  
> 목표 스택: React SPA + PHP REST API + MariaDB + 기존 파일서버

---

## 1. 현재 시스템 구조 파악

### 1-1. Supabase 사용 현황

| 서비스 | 용도 | 마이그레이션 대상 |
|--------|------|-----------------|
| **Database** | `app_config` 테이블 (KV 스토어) — 장바구니·주문·설정 등 8개 키 저장 | MariaDB 테이블로 전환 |
| **Auth** | 관리자 이메일/비밀번호 로그인 (`admin@bookmoa.com`) | PHP 세션 또는 JWT로 전환 |
| **Storage** | `order-files` 버킷 — 인쇄파일 업로드 (100MB/파일) | PHP 파일 업로드 + 서버 디렉터리로 전환 |

### 1-2. 현재 스토리지 키 목록 (`app_config` 테이블)

```
p4-cart     : 장바구니 항목 배열 (JSON Array)
p4-orders   : 주문 목록 배열 (JSON Array)
p4-pricing  : 관리자 수정 가격 테이블 (JSON Object, 45종×9규격)
p4-notifs   : 알림 목록 배열 (JSON Array)
p4-phist    : 가격 변경 이력 배열 (JSON Array)
p4-saved    : 저장된 견적 사양 배열 (JSON Array)
p4-settings : 사업자 정보/앱 설정 (JSON Object)
p4-cprods   : 커스텀 상품 목록 (JSON Array)
```

### 1-3. 프론트엔드의 DB 호출 구조

```
src/lib/supabase.js   ← Supabase 클라이언트 초기화
src/lib/storage.js    ← sLoad/sSave 추상화 레이어 (localStorage ↔ Supabase 자동 선택)
src/App.jsx           ← sLoad/sSave 호출, supabase.auth, supabase.storage 직접 호출
```

---

## 2. 마이그레이션 전략 선택

### 방법 A: KV 구조 유지 (권장 — 최소 변경)

기존 `app_config(key, value JSONB)` 구조를 MariaDB에 동일하게 유지.  
프론트엔드 `storage.js`만 교체하면 `App.jsx` 수정 최소화.

**장점:** 프론트엔드 로직 변경 거의 없음, 단계적 전환 가능  
**단점:** JSON 컬럼 사용으로 MariaDB에서 쿼리/인덱스 제한

### 방법 B: 정규화 테이블로 전환 (권장 — 장기 운영)

주문·상품·설정을 각각 독립 테이블로 분리.  
PHP 백엔드 API를 RESTful하게 설계.

**장점:** 집계/검색/보고서 쿼리 용이, 데이터 무결성 보장  
**단점:** 프론트엔드 API 호출 방식 전면 수정 필요

> **이 문서는 방법 B(정규화) 기준으로 작성**하되, 방법 A 호환 레이어도 함께 제공합니다.

---

## 3. MariaDB 스키마 설계

### 3-1. DDL 전체

```sql
-- ─────────────────────────────────────────────────────
-- 북모아 Printable — MariaDB 스키마
-- MariaDB 10.5+ 권장 (JSON 함수 지원)
-- ─────────────────────────────────────────────────────

CREATE DATABASE IF NOT EXISTS bookmoa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bookmoa;

-- ── 방법 A 호환용 KV 스토어 (기존 Supabase app_config 1:1 대응) ──
CREATE TABLE IF NOT EXISTS app_config (
  `key`        VARCHAR(64)  NOT NULL PRIMARY KEY,
  `value`      LONGTEXT     NOT NULL DEFAULT '{}',   -- JSON 문자열
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                            ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_updated (`updated_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 방법 B: 정규화 테이블 ──

-- 사업자/앱 설정
CREATE TABLE IF NOT EXISTS settings (
  id              INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  biz_name        VARCHAR(100) NOT NULL DEFAULT '(주)북모아',
  biz_no          VARCHAR(20)  NOT NULL DEFAULT '',
  ceo             VARCHAR(50)  NOT NULL DEFAULT '',
  tel             VARCHAR(30)  NOT NULL DEFAULT '',
  fax             VARCHAR(30)  NOT NULL DEFAULT '',
  email           VARCHAR(100) NOT NULL DEFAULT '',
  addr            TEXT,
  tax_rate        DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  delivery_fee    INT          NOT NULL DEFAULT 0,
  delivery_days   VARCHAR(20)  NOT NULL DEFAULT '3~5',
  memo            TEXT,
  use_inner_paper_cost TINYINT(1) NOT NULL DEFAULT 1,  -- 1=innerPapers 기반, 0=sideRate 고정
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                               ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 관리자 계정
CREATE TABLE IF NOT EXISTS admin_users (
  id              INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email           VARCHAR(150) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,              -- password_hash() 사용
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login      DATETIME     NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 주문
CREATE TABLE IF NOT EXISTS orders (
  id              VARCHAR(32)  NOT NULL PRIMARY KEY,  -- 'ORD-YYYY-NNNN' 형식
  status          TINYINT      NOT NULL DEFAULT 0,    -- 0=접수 ~ 6=배송완료
  customer_name   VARCHAR(100) NOT NULL DEFAULT '',
  customer_phone  VARCHAR(30)  NOT NULL DEFAULT '',
  customer_email  VARCHAR(150) NOT NULL DEFAULT '',
  customer_addr   TEXT,
  payment_method  VARCHAR(20)  NOT NULL DEFAULT 'card',
  total           INT          NOT NULL DEFAULT 0,    -- VAT 포함 합계 (원)
  history         JSON,                               -- 상태변경 이력
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                               ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status  (`status`),
  INDEX idx_created (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 주문 항목 (1주문 N항목)
CREATE TABLE IF NOT EXISTS order_items (
  id              INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id        VARCHAR(32)  NOT NULL,
  is_custom       TINYINT(1)   NOT NULL DEFAULT 0,
  cfg             JSON         NOT NULL,              -- 견적 사양 (format, pages, quantity, ...)
  quote           JSON         NOT NULL,              -- 계산된 견적 (unitPrice, subtotal, vat, total, lines)
  files           JSON,                               -- 업로드 파일 목록 [{name, url}]
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_order_id (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 업로드 파일 (Supabase Storage 대체)
CREATE TABLE IF NOT EXISTS order_files (
  id              INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_item_id   INT          NULL,
  original_name   VARCHAR(255) NOT NULL,
  saved_name      VARCHAR(255) NOT NULL,              -- 서버 저장 파일명 (uuid)
  saved_path      VARCHAR(500) NOT NULL,              -- 서버 절대경로 또는 상대경로
  public_url      VARCHAR(500) NOT NULL DEFAULT '',   -- 다운로드 URL
  file_size       BIGINT       NOT NULL DEFAULT 0,    -- bytes
  mime_type       VARCHAR(100) NOT NULL DEFAULT '',
  uploaded_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE SET NULL,
  INDEX idx_item_id (`order_item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 커스텀 상품
CREATE TABLE IF NOT EXISTS custom_products (
  id              VARCHAR(32)  NOT NULL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  icon            VARCHAR(10)  NOT NULL DEFAULT '📦',
  description     TEXT,
  active          TINYINT(1)   NOT NULL DEFAULT 1,
  opt_groups      JSON,                               -- 옵션 그룹 배열
  qty_tiers       JSON,                               -- 수량 구간별 기본가 배열
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                               ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_active (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 가격 테이블 (인쇄/용지/코팅/제본 등 전체)
CREATE TABLE IF NOT EXISTS pricing (
  id              INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  data            JSON         NOT NULL,              -- DEF_PRICING 전체 객체
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                               ON UPDATE CURRENT_TIMESTAMP,
  updated_by      VARCHAR(150) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 알림
CREATE TABLE IF NOT EXISTS notifications (
  id              INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  icon            VARCHAR(10)  NOT NULL DEFAULT '🔔',
  title           VARCHAR(200) NOT NULL,
  body            TEXT,
  is_read         TINYINT(1)   NOT NULL DEFAULT 0,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_read    (`is_read`),
  INDEX idx_created (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 저장된 견적 사양
CREATE TABLE IF NOT EXISTS saved_configs (
  id              INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,
  cfg             JSON         NOT NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 가격 변경 이력
CREATE TABLE IF NOT EXISTS price_history (
  id              INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  changed_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  changed_by      VARCHAR(150) NOT NULL DEFAULT '',
  note            TEXT,
  snapshot        JSON         NOT NULL               -- 변경 전 pricing 스냅샷
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 4. 현재 데이터 추출 (Supabase → 파일)

### 4-1. Supabase에서 JSON 내보내기

Supabase 대시보드 → Table Editor → `app_config` → **Export to CSV/JSON** 클릭  
또는 Supabase CLI 사용:

```bash
# Supabase CLI로 전체 테이블 덤프
supabase db dump --data-only -t app_config > app_config_dump.sql

# 또는 psql로 JSON 추출
psql $DATABASE_URL -c "\COPY app_config TO 'app_config.csv' CSV HEADER"
```

### 4-2. Node.js 변환 스크립트 (Supabase → MariaDB INSERT)

```js
// scripts/migrate-supabase-to-mariadb.js
// 사용: node migrate-supabase-to-mariadb.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // service_role 키 필요
);

async function exportData() {
  const { data, error } = await supabase.from('app_config').select('*');
  if (error) throw error;

  const sqls = [];
  for (const row of data) {
    const key = row.key.replace(/'/g, "''");
    const value = JSON.stringify(row.value).replace(/'/g, "''");
    const updatedAt = row.updated_at.replace('T', ' ').slice(0, 19);

    sqls.push(
      `INSERT INTO app_config (\`key\`, \`value\`, updated_at) ` +
      `VALUES ('${key}', '${value}', '${updatedAt}') ` +
      `ON DUPLICATE KEY UPDATE \`value\`=VALUES(\`value\`), updated_at=VALUES(updated_at);`
    );
  }

  fs.writeFileSync('import_app_config.sql', sqls.join('\n'));
  console.log(`✅ ${sqls.length}개 행 내보냄 → import_app_config.sql`);
}

exportData().catch(console.error);
```

```bash
node migrate-supabase-to-mariadb.js
mysql -u root -p bookmoa < import_app_config.sql
```

---

## 5. PHP REST API 설계

### 5-1. 디렉터리 구조

```
/var/www/html/bookmoa-api/
├── index.php            ← 라우터 진입점
├── config/
│   └── db.php           ← MariaDB 연결 설정
├── middleware/
│   └── auth.php         ← JWT/세션 인증 미들웨어
├── controllers/
│   ├── ConfigController.php   ← app_config KV (방법 A 호환)
│   ├── OrderController.php    ← 주문 CRUD
│   ├── SettingsController.php ← 사업자 설정
│   ├── PricingController.php  ← 가격 테이블
│   ├── ProductController.php  ← 커스텀 상품
│   ├── AuthController.php     ← 관리자 로그인/로그아웃
│   └── UploadController.php   ← 파일 업로드
└── uploads/                   ← 업로드 파일 저장 디렉터리 (권한 755)
```

### 5-2. DB 연결 (`config/db.php`)

```php
<?php
// config/db.php
define('DB_HOST', 'localhost');
define('DB_NAME', 'bookmoa');
define('DB_USER', 'bookmoa_user');
define('DB_PASS', 'your_password');
define('DB_CHARSET', 'utf8mb4');

function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = sprintf('mysql:host=%s;dbname=%s;charset=%s',
                       DB_HOST, DB_NAME, DB_CHARSET);
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}
```

### 5-3. 라우터 (`index.php`)

```php
<?php
// index.php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: https://bookmoa-mobile.vercel.app');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/middleware/auth.php';

$method = $_SERVER['REQUEST_METHOD'];
$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri    = rtrim($uri, '/');

// 라우팅 테이블
$routes = [
    'POST /api/auth/login'        => ['AuthController', 'login'],
    'POST /api/auth/logout'       => ['AuthController', 'logout'],
    'GET  /api/config'            => ['ConfigController', 'index'],   // 전체 KV 로드
    'GET  /api/config/{key}'      => ['ConfigController', 'get'],
    'PUT  /api/config/{key}'      => ['ConfigController', 'set'],     // upsert
    'GET  /api/orders'            => ['OrderController', 'index'],
    'POST /api/orders'            => ['OrderController', 'create'],
    'PUT  /api/orders/{id}'       => ['OrderController', 'update'],
    'GET  /api/settings'          => ['SettingsController', 'get'],
    'PUT  /api/settings'          => ['SettingsController', 'update'],
    'GET  /api/pricing'           => ['PricingController', 'get'],
    'PUT  /api/pricing'           => ['PricingController', 'update'],
    'GET  /api/products'          => ['ProductController', 'index'],
    'POST /api/products'          => ['ProductController', 'create'],
    'PUT  /api/products/{id}'     => ['ProductController', 'update'],
    'DELETE /api/products/{id}'   => ['ProductController', 'delete'],
    'POST /api/upload'            => ['UploadController', 'upload'],
];

// 단순 라우팅 처리 (실제 구현은 프레임워크 권장: Slim, Laravel 등)
routeRequest($method, $uri, $routes);
```

### 5-4. KV 스토어 API (`ConfigController.php`) — 방법 A 호환

```php
<?php
// controllers/ConfigController.php
class ConfigController {

    // GET /api/config/{key}
    // 프론트엔드 sLoad() 대응
    public static function get(string $key): void {
        $pdo  = getDB();
        $stmt = $pdo->prepare('SELECT `value` FROM app_config WHERE `key` = ?');
        $stmt->execute([$key]);
        $row  = $stmt->fetch();

        if (!$row) {
            // 키 없으면 null 반환 (프론트엔드에서 fallback 처리)
            echo json_encode(['data' => null, 'error' => null]);
            return;
        }

        // value는 JSON 문자열로 저장됨 → 파싱 후 반환
        echo json_encode([
            'data'  => json_decode($row['value'], true),
            'error' => null,
        ]);
    }

    // PUT /api/config/{key}
    // 프론트엔드 sSave() 대응
    public static function set(string $key): void {
        requireAuth();  // 관리자 인증 필요

        $body  = json_decode(file_get_contents('php://input'), true);
        $value = json_encode($body['value'] ?? null);

        $pdo  = getDB();
        $stmt = $pdo->prepare(
            'INSERT INTO app_config (`key`, `value`, updated_at)
             VALUES (?, ?, NOW())
             ON DUPLICATE KEY UPDATE `value`=VALUES(`value`), updated_at=NOW()'
        );
        $stmt->execute([$key, $value]);

        echo json_encode(['data' => ['key' => $key], 'error' => null]);
    }

    // GET /api/config — 전체 KV 일괄 로드 (앱 초기화용)
    public static function index(): void {
        $pdo  = getDB();
        $stmt = $pdo->query('SELECT `key`, `value` FROM app_config');
        $rows = $stmt->fetchAll();

        $result = [];
        foreach ($rows as $row) {
            $result[$row['key']] = json_decode($row['value'], true);
        }
        echo json_encode(['data' => $result, 'error' => null]);
    }
}
```

### 5-5. 관리자 인증 (`AuthController.php`)

```php
<?php
// controllers/AuthController.php
// JWT 사용 (firebase/php-jwt 패키지 권장)
// composer require firebase/php-jwt

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

define('JWT_SECRET', 'your_secret_key_change_this');
define('JWT_EXPIRE', 86400 * 7); // 7일

class AuthController {

    // POST /api/auth/login
    // body: {"email": "admin@bookmoa.com", "password": "Bookmoa1234!"}
    public static function login(): void {
        $body     = json_decode(file_get_contents('php://input'), true);
        $email    = trim($body['email'] ?? '');
        $password = $body['password'] ?? '';

        if (!$email || !$password) {
            http_response_code(400);
            echo json_encode(['error' => '이메일과 비밀번호를 입력해주세요.']);
            return;
        }

        $pdo  = getDB();
        $stmt = $pdo->prepare('SELECT id, email, password_hash FROM admin_users WHERE email = ?');
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        // password_verify: PHP의 password_hash()로 저장된 해시와 비교
        if (!$user || !password_verify($password, $user['password_hash'])) {
            http_response_code(401);
            echo json_encode(['error' => '이메일 또는 비밀번호가 올바르지 않습니다.']);
            return;
        }

        // 마지막 로그인 시간 갱신
        $pdo->prepare('UPDATE admin_users SET last_login=NOW() WHERE id=?')
            ->execute([$user['id']]);

        // JWT 발급
        $payload = [
            'iss' => 'bookmoa',
            'sub' => $user['id'],
            'email' => $user['email'],
            'exp' => time() + JWT_EXPIRE,
        ];
        $token = JWT::encode($payload, JWT_SECRET, 'HS256');

        echo json_encode([
            'data'  => ['token' => $token, 'email' => $user['email']],
            'error' => null,
        ]);
    }
}

// middleware/auth.php
function requireAuth(): void {
    $headers = getallheaders();
    $auth    = $headers['Authorization'] ?? '';

    if (!preg_match('/^Bearer\s+(.+)$/', $auth, $m)) {
        http_response_code(401);
        echo json_encode(['error' => '인증이 필요합니다.']);
        exit;
    }
    try {
        $decoded = JWT::decode($m[1], new Key(JWT_SECRET, 'HS256'));
        $GLOBALS['auth_user'] = $decoded;
    } catch (\Exception $e) {
        http_response_code(401);
        echo json_encode(['error' => '유효하지 않은 토큰입니다.']);
        exit;
    }
}
```

### 5-6. 파일 업로드 (`UploadController.php`)

```php
<?php
// controllers/UploadController.php
// Supabase Storage "order-files" 버킷 대체

define('UPLOAD_DIR',  __DIR__ . '/../uploads/order-files/');
define('UPLOAD_URL',  'https://your-domain.com/uploads/order-files/');
define('MAX_SIZE',    100 * 1024 * 1024); // 100MB

class UploadController {

    // POST /api/upload
    // multipart/form-data: file (binary), order_item_id (optional)
    public static function upload(): void {
        requireAuth();

        if (empty($_FILES['file'])) {
            http_response_code(400);
            echo json_encode(['error' => '파일이 없습니다.']);
            return;
        }

        $file     = $_FILES['file'];
        $origName = basename($file['name']);
        $size     = $file['size'];
        $tmpPath  = $file['tmp_name'];
        $mime     = mime_content_type($tmpPath);

        if ($size > MAX_SIZE) {
            http_response_code(413);
            echo json_encode(['error' => '파일 크기가 100MB를 초과합니다.']);
            return;
        }

        // 허용 확장자 검사
        $ext     = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
        $allowed = ['pdf', 'ai', 'eps', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'indd', 'psd'];
        if (!in_array($ext, $allowed, true)) {
            http_response_code(415);
            echo json_encode(['error' => '허용되지 않는 파일 형식입니다.']);
            return;
        }

        // 고유 파일명 생성 (Supabase의 uid()/{파일명} 경로와 동일 패턴)
        $uuid      = sprintf('%s/%s', uniqid('', true), $origName);
        $savedName = preg_replace('/[^a-zA-Z0-9._\-\/]/', '_', $uuid);
        $dirPath   = UPLOAD_DIR . dirname($savedName);
        $fullPath  = UPLOAD_DIR . $savedName;
        $publicUrl = UPLOAD_URL . $savedName;

        if (!is_dir($dirPath)) {
            mkdir($dirPath, 0755, true);
        }

        if (!move_uploaded_file($tmpPath, $fullPath)) {
            http_response_code(500);
            echo json_encode(['error' => '파일 저장에 실패했습니다.']);
            return;
        }

        // DB에 파일 메타데이터 저장
        $orderItemId = isset($_POST['order_item_id']) ? (int)$_POST['order_item_id'] : null;
        $pdo  = getDB();
        $stmt = $pdo->prepare(
            'INSERT INTO order_files (order_item_id, original_name, saved_name, saved_path, public_url, file_size, mime_type)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([$orderItemId, $origName, $savedName, $fullPath, $publicUrl, $size, $mime]);

        echo json_encode([
            'data'  => ['name' => $origName, 'url' => $publicUrl],
            'error' => null,
        ]);
    }
}
```

---

## 6. 프론트엔드 스토리지 레이어 교체

`src/lib/storage.js`와 `src/lib/supabase.js`를 PHP API를 호출하도록 교체합니다.

### 6-1. `src/lib/api.js` (신규 생성)

```js
// src/lib/api.js — PHP REST API 클라이언트
const API_BASE = import.meta.env.VITE_API_URL || 'https://your-domain.com/bookmoa-api';

function getToken() {
  return localStorage.getItem('bm_token') || '';
}

export function setToken(token) {
  localStorage.setItem('bm_token', token);
}

export function clearToken() {
  localStorage.removeItem('bm_token');
}

async function request(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '서버 오류');
  }
  return res.json();
}

export const api = {
  get:    (path)         => request('GET',    path),
  post:   (path, body)   => request('POST',   path, body),
  put:    (path, body)   => request('PUT',    path, body),
  delete: (path)         => request('DELETE', path),
};
```

### 6-2. `src/lib/storage.js` 교체

```js
// src/lib/storage.js — PHP API 버전
import { api } from './api.js';

const isApiEnabled = () => !!import.meta.env.VITE_API_URL;

// ── localStorage fallback ──
function localLoad(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function localSave(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (e) { console.error('localStorage save error:', e); }
}

// ── PHP API 구현 ──
async function apiLoad(key, fallback) {
  localSave(key, fallback);            // 캐시 미리 저장
  try {
    const res = await api.get(`/api/config/${encodeURIComponent(key)}`);
    if (res.data !== null && res.data !== undefined) {
      localSave(key, res.data);        // 로컬 캐시 갱신
      return res.data;
    }
    return localLoad(key, fallback);
  } catch {
    return localLoad(key, fallback);   // 네트워크 오류 → 캐시 사용
  }
}

async function apiSave(key, value) {
  localSave(key, value);               // 즉시 로컬 저장 (낙관적 업데이트)
  try {
    await api.put(`/api/config/${encodeURIComponent(key)}`, { value });
  } catch (e) {
    console.error('API save error:', e);
  }
}

// ── 공개 API ──
export async function sLoad(key, fallback) {
  return isApiEnabled() ? apiLoad(key, fallback) : localLoad(key, fallback);
}

export async function sSave(key, value) {
  return isApiEnabled() ? apiSave(key, value) : localSave(key, value);
}
```

### 6-3. `src/lib/supabase.js` 교체 (Auth 부분)

```js
// src/lib/auth.js — PHP JWT 인증 버전 (supabase.js 대체)
import { api, setToken, clearToken } from './api.js';

export const isSupabaseEnabled = () => false;  // Supabase 비활성화

// Supabase supabase.auth.signInWithPassword() 대응
export async function signIn(email, password) {
  const res = await api.post('/api/auth/login', { email, password });
  setToken(res.data.token);
  return { session: { user: { email: res.data.email }, access_token: res.data.token } };
}

// Supabase supabase.auth.signOut() 대응
export async function signOut() {
  clearToken();
  return {};
}

// Supabase supabase.auth.getSession() 대응
export async function getSession() {
  const token = localStorage.getItem('bm_token');
  if (!token) return { session: null };
  // 토큰 유효성: JWT payload의 exp 확인
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp < Date.now() / 1000) { clearToken(); return { session: null }; }
    return { session: { access_token: token, user: { email: payload.email } } };
  } catch { clearToken(); return { session: null }; }
}
```

### 6-4. `App.jsx` 수정 포인트

```diff
- import { supabase } from './lib/supabase'
+ import { signIn, signOut, getSession } from './lib/auth'

// AdminLogin.handleLogin
- const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw });
- if (error) setErr("이메일 또는 비밀번호가 올바르지 않습니다.");
- else setSession(data.session);
+ try {
+   const { session } = await signIn(email, pw);
+   setSession(session);
+ } catch (e) { setErr("이메일 또는 비밀번호가 올바르지 않습니다."); }

// App useEffect — Auth 세션 복원
- supabase.auth.getSession().then(({ data }) => setSession(data.session));
- const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
- return () => subscription.unsubscribe();
+ getSession().then(({ session }) => setSession(session));

// Configure/ProdConfigure.handleAdd — 파일 업로드
- const { error } = await supabase.storage.from('order-files').upload(path, f);
- const { data: u } = supabase.storage.from('order-files').getPublicUrl(path);
+ const formData = new FormData(); formData.append('file', f);
+ const res = await fetch(API_BASE + '/api/upload', {
+   method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: formData,
+ });
+ const { data: u } = await res.json();
+ fileData.push({ name: f.name, url: u?.url || '' });
```

---

## 7. 환경변수 설정

### 7-1. `.env` (Vercel 환경변수 대체)

```bash
# 기존 Supabase 설정 제거
# VITE_SUPABASE_URL=...
# VITE_SUPABASE_ANON_KEY=...

# PHP API 서버 URL 추가
VITE_API_URL=https://your-domain.com/bookmoa-api
```

### 7-2. PHP 서버 `.htaccess` (Apache)

```apache
# /var/www/html/bookmoa-api/.htaccess
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ index.php [QSA,L]

# 업로드 디렉터리 직접 접근 허용 (파일 다운로드용)
<Directory /var/www/html/bookmoa-api/uploads>
    Options -Indexes
    AllowOverride None
    Require all granted
</Directory>
```

---

## 8. 초기 관리자 계정 등록

```php
<?php
// scripts/create-admin.php (1회 실행 후 삭제)
require_once __DIR__ . '/../config/db.php';

$email    = 'admin@bookmoa.com';
$password = 'Bookmoa1234!';  // 변경 권장
$hash     = password_hash($password, PASSWORD_BCRYPT);

$pdo  = getDB();
$stmt = $pdo->prepare(
    'INSERT INTO admin_users (email, password_hash) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash)'
);
$stmt->execute([$email, $hash]);
echo "관리자 계정 등록 완료: $email\n";
```

```bash
php scripts/create-admin.php
```

---

## 9. 마이그레이션 체크리스트

### Phase 1 — 준비
- [ ] MariaDB 10.5+ 설치 및 스키마 생성 (섹션 3)
- [ ] PHP 8.1+ 서버 구성, Composer 설치
- [ ] `composer require firebase/php-jwt`
- [ ] 업로드 디렉터리 생성: `mkdir -p /var/www/html/bookmoa-api/uploads/order-files`
- [ ] `.htaccess` CORS/라우터 설정

### Phase 2 — 데이터 이전
- [ ] Supabase에서 `app_config` 데이터 내보내기
- [ ] 변환 스크립트 실행 → MariaDB에 import
- [ ] Supabase Storage 파일 다운로드 → 서버 `uploads/` 복사
- [ ] DB의 파일 URL 일괄 업데이트 (Supabase URL → 서버 URL)

### Phase 3 — 백엔드 개발
- [ ] PHP API 컨트롤러 전체 구현
- [ ] JWT 인증 미들웨어 구현
- [ ] 파일 업로드 컨트롤러 구현
- [ ] API 엔드포인트 테스트 (Postman/curl)

### Phase 4 — 프론트엔드 교체
- [ ] `src/lib/api.js` 생성
- [ ] `src/lib/storage.js` PHP API 버전으로 교체
- [ ] `src/lib/supabase.js` → `src/lib/auth.js` 대체
- [ ] `App.jsx` Auth/Upload 호출 부분 수정
- [ ] `.env` 환경변수 교체

### Phase 5 — 검증 및 전환
- [ ] 개발 서버에서 전체 기능 테스트
- [ ] 견적 계산 결과 비교 (기존 vs 신규)
- [ ] 파일 업로드/다운로드 동작 확인
- [ ] 관리자 로그인/로그아웃 확인
- [ ] Vercel 환경변수 업데이트 후 배포
- [ ] 기존 Supabase 프로젝트 일시 유지 (롤백 대비)
- [ ] 2주 안정 운영 후 Supabase 프로젝트 삭제

---

## 10. 주의 사항

1. **CORS**: PHP 서버에서 Vercel 도메인(`bookmoa-mobile.vercel.app`)을 명시적으로 허용해야 함
2. **HTTPS**: 파일 업로드/JWT 토큰 전송 시 반드시 HTTPS 사용
3. **JSON 컬럼**: MariaDB 10.5 미만은 `LONGTEXT`로 대체하고 PHP에서 json_decode/encode 처리
4. **세션 vs JWT**: 단일 관리자만 있으므로 JWT(Bearer)가 더 적합 (SPA와 호환성 우수)
5. **파일 URL 갱신**: 기존 주문의 `quote.files[].url`이 Supabase URL을 가리키므로, 파일 복사 후 DB UPDATE 필요
