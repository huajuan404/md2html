import { describe, expect, test } from 'vitest'
import { uiEn } from '../../i18n/ui/en'
import { uiZh } from '../../i18n/ui/zh'
import { outputEn } from '../../i18n/output/en'
import { outputZh } from '../../i18n/output/zh'

describe('i18n dictionaries', () => {
  test('UI dictionaries expose the same keys in zh and en', () => {
    expect(Object.keys(uiZh).sort()).toEqual(Object.keys(uiEn).sort())
  })

  test('output dictionaries expose the same keys in zh and en', () => {
    expect(Object.keys(outputZh).sort()).toEqual(Object.keys(outputEn).sort())
  })
})
