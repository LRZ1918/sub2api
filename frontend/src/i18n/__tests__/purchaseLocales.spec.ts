import { describe, expect, it } from 'vitest'
import zh from '../locales/zh'

describe('purchase locale copy', () => {
  it('uses the configured owner shop title in the default external shop instructions', () => {
    expect(zh.purchase.externalShopDefaultHint).toContain('我的小铺(o´ω`o)ﾉ')
  })
})
