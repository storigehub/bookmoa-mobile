/**
 * Supabase 클라이언트 초기화
 *
 * 환경변수(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)가 모두 설정된 경우에만
 * Supabase 클라이언트를 생성합니다. 미설정 시 null을 반환하여
 * 앱이 localStorage 전용 모드로 동작합니다.
 *
 * Supabase 프로젝트: bookmoa (ap-northeast-1 / ctzfhlqkvkuvpioiincm)
 * 사용 서비스:
 *   - Auth    : 관리자 이메일/비밀번호 로그인 (admin@bookmoa.com)
 *   - Database: app_config 테이블 (KV 스토어, RLS 활성화)
 *   - Storage : order-files 버킷 (인쇄파일 업로드, 공개 접근)
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// 두 환경변수가 모두 존재할 때만 클라이언트 생성, 아니면 null
export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null

// 스토리지 레이어에서 Supabase 활성화 여부 판단에 사용
export const isSupabaseEnabled = () => !!supabase
