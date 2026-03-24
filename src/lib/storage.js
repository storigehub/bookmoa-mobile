/**
 * Storage Layer — localStorage 기반 (Supabase 확장 대비)
 * 
 * 아티팩트의 window.storage API를 대체합니다.
 * Stage 1: localStorage (현재)
 * Stage 2: Supabase DB (환경변수 설정 시 자동 전환)
 */
import { supabase, isSupabaseEnabled } from './supabase'

// ─── localStorage 구현 ───
function localLoad(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function localSave(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.error('localStorage save error:', e)
  }
}

// ─── Supabase 구현 (Stage 2) ───
async function supaLoad(key, fallback) {
  if (!supabase) return localLoad(key, fallback)
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', key)
      .single()
    if (error || !data) return localLoad(key, fallback)
    return data.value ?? fallback
  } catch {
    return localLoad(key, fallback)
  }
}

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

// ─── 공개 API (자동 선택) ───
export async function sLoad(key, fallback) {
  return isSupabaseEnabled() ? supaLoad(key, fallback) : localLoad(key, fallback)
}

export async function sSave(key, value) {
  return isSupabaseEnabled() ? supaSave(key, value) : localSave(key, value)
}
