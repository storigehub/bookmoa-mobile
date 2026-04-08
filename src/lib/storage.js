/**
 * Storage Layer — 스토리지 추상화 레이어
 *
 * Supabase 환경변수 설정 여부에 따라 자동으로 백엔드를 선택합니다:
 *   - Supabase 미설정: localStorage 전용 (오프라인/개발 환경)
 *   - Supabase 설정됨: Supabase DB 우선 + localStorage 백업
 *
 * Stage 전환 이력:
 *   Stage 1: localStorage 전용
 *   Stage 2: Supabase DB (app_config 테이블, KV 방식) + localStorage 동기 백업
 *
 * 스토리지 키 목록 (App.jsx에서 사용):
 *   p4-cart     장바구니 항목 배열
 *   p4-orders   주문 목록 배열
 *   p4-pricing  관리자 수정 가격 테이블
 *   p4-notifs   알림 목록 배열
 *   p4-phist    가격 변경 이력
 *   p4-saved    저장된 견적 사양
 *   p4-settings 사업자 정보/앱 설정
 *   p4-cprods   커스텀 상품 목록
 */
import { supabase, isSupabaseEnabled } from './supabase'

// ─── localStorage 구현 ───

/**
 * localLoad — localStorage에서 JSON 파싱하여 반환
 * 파싱 실패 또는 키 없음 시 fallback 반환
 */
function localLoad(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

/**
 * localSave — localStorage에 JSON 직렬화하여 저장
 */
function localSave(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.error('localStorage save error:', e)
  }
}

// ─── Supabase 구현 (Stage 2) ───

/**
 * supaLoad — Supabase app_config 테이블에서 값 로드
 *
 * 테이블 구조: app_config(key TEXT PK, value JSONB, updated_at TIMESTAMPTZ)
 * RLS 정책: anon read 허용 (SELECT), authenticated write 허용 (INSERT/UPDATE)
 * 실패 시 localLoad로 fallback (네트워크 오류, RLS 차단 등)
 */
async function supaLoad(key, fallback) {
  if (!supabase) return localLoad(key, fallback)
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', key)
      .single()
    if (error || !data) return localLoad(key, fallback) // DB 미스 → localStorage 확인
    return data.value ?? fallback
  } catch {
    return localLoad(key, fallback)
  }
}

/**
 * supaSave — Supabase app_config 테이블에 upsert + localStorage 백업
 *
 * - localStorage를 항상 먼저 저장 (오프라인 복원용 캐시)
 * - Supabase upsert: key 충돌 시 value/updated_at 갱신 (INSERT OR UPDATE)
 * - 실패 시 localStorage 백업이 있으므로 데이터 손실 없음
 */
async function supaSave(key, value) {
  localSave(key, value) // 항상 localStorage에도 백업
  if (!supabase) return
  try {
    await supabase
      .from('app_config')
      .upsert({ key, value, updated_at: new Date().toISOString() },
              { onConflict: 'key' })
  } catch (e) {
    console.error('Supabase save error:', e)
  }
}

// ─── 공개 API (환경변수에 따라 자동 선택) ───

/**
 * sLoad — 스토리지에서 값 로드 (자동 백엔드 선택)
 * @param {string} key      스토리지 키
 * @param {*}      fallback 키 없을 때 반환할 기본값
 */
export async function sLoad(key, fallback) {
  return isSupabaseEnabled() ? supaLoad(key, fallback) : localLoad(key, fallback)
}

/**
 * sSave — 스토리지에 값 저장 (자동 백엔드 선택)
 * @param {string} key   스토리지 키
 * @param {*}      value 저장할 값 (JSON 직렬화 가능한 타입)
 */
export async function sSave(key, value) {
  return isSupabaseEnabled() ? supaSave(key, value) : localSave(key, value)
}
