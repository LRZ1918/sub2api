import { describe, expect, it, vi } from 'vitest'
import { canAccessPurchaseEntry, ensurePublicSettingsForGuard } from '../guard-utils'

describe('route guard utilities', () => {
  it('allows purchase entry when the external purchase page is enabled without native payment', () => {
    expect(
      canAccessPurchaseEntry({
        payment_enabled: false,
        purchase_subscription_enabled: true,
      }),
    ).toBe(true)
  })

  it('allows purchase route while public settings are still hydrating', () => {
    expect(canAccessPurchaseEntry(null)).toBe(true)
    expect(canAccessPurchaseEntry(undefined)).toBe(true)
  })

  it('blocks purchase entry only after both purchase options are explicitly disabled', () => {
    expect(
      canAccessPurchaseEntry({
        payment_enabled: false,
        purchase_subscription_enabled: false,
      }),
    ).toBe(false)
  })

  it('loads injected public settings before guarded feature checks', () => {
    const initFromInjectedConfig = vi.fn()
    ensurePublicSettingsForGuard({
      publicSettingsLoaded: false,
      initFromInjectedConfig,
    })

    expect(initFromInjectedConfig).toHaveBeenCalledTimes(1)
  })

  it('does not reload injected public settings after they are already loaded', () => {
    const initFromInjectedConfig = vi.fn()
    ensurePublicSettingsForGuard({
      publicSettingsLoaded: true,
      initFromInjectedConfig,
    })

    expect(initFromInjectedConfig).not.toHaveBeenCalled()
  })
})
