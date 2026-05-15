import type { UiLanguage } from './types'
import { uiEn } from './ui/en'
import { uiZh } from './ui/zh'

export function getUiDict(language: UiLanguage) {
  return language === 'zh' ? uiZh : uiEn
}

export function detectDefaultUiLanguage(): UiLanguage {
  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('zh')) return 'zh'
  return 'en'
}
