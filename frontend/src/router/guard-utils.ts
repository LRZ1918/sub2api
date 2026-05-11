import type { PublicSettings } from '@/types'

export type PublicSettingsGuardStore = {
  publicSettingsLoaded: boolean
  initFromInjectedConfig: () => boolean
}

export function ensurePublicSettingsForGuard(appStore: PublicSettingsGuardStore): void {
  if (!appStore.publicSettingsLoaded) {
    appStore.initFromInjectedConfig()
  }
}

export function canAccessPurchaseEntry(
  publicSettings: Pick<PublicSettings, 'payment_enabled' | 'purchase_subscription_enabled'> | null | undefined,
): boolean {
  if (!publicSettings) {
    return true
  }
  return publicSettings?.payment_enabled === true || publicSettings?.purchase_subscription_enabled === true
}
