export type UserNavItemKey =
  | 'dashboard'
  | 'keys'
  | 'usage'
  | 'subscriptions'
  | 'purchase'
  | 'redeem'
  | 'profile'
  | 'modelSquare'
  | 'availableChannels'
  | 'channelStatus'
  | 'orders'
  | 'affiliate'
  | 'custom'

export interface UserNavSettings {
  payment_enabled?: boolean
  purchase_subscription_enabled?: boolean
  available_channels_enabled?: boolean
  channel_monitor_enabled?: boolean
  affiliate_enabled?: boolean
  custom_menu_items?: CustomUserMenuItem[]
}

export interface CustomUserMenuItem {
  id: string
  label: string
  icon_svg?: string
  visibility?: 'user' | 'admin' | string
  sort_order?: number
}

export interface VisibleUserNavItem {
  key: UserNavItemKey
  path: string
  hideInSimpleMode?: boolean
  label?: string
  iconSvg?: string
}

export interface BuildVisibleUserNavItemsOptions {
  withDashboard?: boolean
  simpleMode?: boolean
}

function enabled(value: boolean | undefined, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function buildVisibleUserNavItems(
  settings: UserNavSettings | null | undefined,
  options: BuildVisibleUserNavItemsOptions = {},
): VisibleUserNavItem[] {
  const withDashboard = options.withDashboard !== false
  const simpleMode = options.simpleMode === true
  const paymentEnabled = enabled(settings?.payment_enabled, true)
  const externalPurchaseEnabled = enabled(settings?.purchase_subscription_enabled, false)
  const availableChannelsEnabled = enabled(settings?.available_channels_enabled, false)
  const channelMonitorEnabled = enabled(settings?.channel_monitor_enabled, true)
  const affiliateEnabled = enabled(settings?.affiliate_enabled, false)
  const showPurchase = paymentEnabled || externalPurchaseEnabled

  const items: VisibleUserNavItem[] = []
  if (withDashboard) items.push({ key: 'dashboard', path: '/dashboard' })
  items.push(
    { key: 'keys', path: '/keys' },
    { key: 'usage', path: '/usage', hideInSimpleMode: true },
    { key: 'subscriptions', path: '/subscriptions', hideInSimpleMode: true },
  )
  if (showPurchase) items.push({ key: 'purchase', path: '/purchase', hideInSimpleMode: true })
  items.push(
    { key: 'redeem', path: '/redeem', hideInSimpleMode: true },
    { key: 'profile', path: '/profile' },
  )
  if (availableChannelsEnabled) {
    items.push({ key: 'modelSquare', path: '/custom/model-square', hideInSimpleMode: true })
  }
  if (availableChannelsEnabled) {
    items.push({ key: 'availableChannels', path: '/available-channels', hideInSimpleMode: true })
  }
  if (channelMonitorEnabled) items.push({ key: 'channelStatus', path: '/monitor' })
  if (paymentEnabled) items.push({ key: 'orders', path: '/orders', hideInSimpleMode: true })
  if (affiliateEnabled) items.push({ key: 'affiliate', path: '/affiliate', hideInSimpleMode: true })

  const customItems = (settings?.custom_menu_items ?? [])
    .filter((item) => item.visibility === 'user' && item.id !== 'model-square')
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((item): VisibleUserNavItem => ({
      key: 'custom',
      path: `/custom/${item.id}`,
      label: item.label,
      iconSvg: item.icon_svg,
    }))

  const visible = [...items, ...customItems]
  return simpleMode ? visible.filter((item) => !item.hideInSimpleMode) : visible
}
