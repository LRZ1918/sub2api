import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'
import { buildVisibleUserNavItems } from '../userNavItems'

const componentPath = resolve(dirname(fileURLToPath(import.meta.url)), '../AppSidebar.vue')
const componentSource = readFileSync(componentPath, 'utf8')
const stylePath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../style.css')
const styleSource = readFileSync(stylePath, 'utf8')

describe('AppSidebar custom SVG styles', () => {
  it('does not override uploaded SVG fill or stroke colors', () => {
    expect(componentSource).toContain('.sidebar-svg-icon {')
    expect(componentSource).toContain('color: currentColor;')
    expect(componentSource).toContain('display: block;')
    expect(componentSource).not.toContain('stroke: currentColor;')
    expect(componentSource).not.toContain('fill: none;')
  })
})

describe('AppSidebar header styles', () => {
  it('does not clip the version badge dropdown', () => {
    const sidebarHeaderBlockMatch = styleSource.match(/\.sidebar-header\s*\{[\s\S]*?\n {2}\}/)
    const sidebarBrandBlockMatch = componentSource.match(/\.sidebar-brand\s*\{[\s\S]*?\n\}/)

    expect(sidebarHeaderBlockMatch).not.toBeNull()
    expect(sidebarBrandBlockMatch).not.toBeNull()
    expect(sidebarHeaderBlockMatch?.[0]).not.toContain('@apply overflow-hidden;')
    expect(sidebarBrandBlockMatch?.[0]).not.toContain('overflow: hidden;')
  })
})

describe('AppSidebar purchase entry feature flags', () => {
  it('shows purchase through payment or external subscription while keeping orders payment-only', () => {
    expect(buildVisibleUserNavItems({
      payment_enabled: false,
      purchase_subscription_enabled: true,
      custom_menu_items: [],
    }).map((item) => item.path)).toContain('/purchase')

    expect(buildVisibleUserNavItems({
      payment_enabled: false,
      purchase_subscription_enabled: true,
      custom_menu_items: [],
    }).map((item) => item.path)).not.toContain('/orders')
  })
})

describe('AppSidebar native user portal menu', () => {
  it('shows the full native user portal when enhanced features are enabled', () => {
    const items = buildVisibleUserNavItems({
      payment_enabled: true,
      purchase_subscription_enabled: false,
      available_channels_enabled: true,
      channel_monitor_enabled: true,
      affiliate_enabled: true,
      custom_menu_items: [],
    })

    expect(items.map((item) => item.path)).toEqual([
      '/dashboard',
      '/keys',
      '/usage',
      '/subscriptions',
      '/purchase',
      '/redeem',
      '/profile',
      '/custom/model-square',
      '/available-channels',
      '/monitor',
      '/orders',
      '/affiliate',
    ])
  })

  it('does not duplicate the built-in model square when custom menus include the same id', () => {
    const items = buildVisibleUserNavItems({
      payment_enabled: true,
      available_channels_enabled: true,
      custom_menu_items: [
        { id: 'model-square', label: '模型广场', visibility: 'user', sort_order: 1 },
        { id: 'guide', label: '使用指南', visibility: 'user', sort_order: 2 },
      ],
    })

    expect(items.filter((item) => item.path === '/custom/model-square')).toHaveLength(1)
    expect(items.map((item) => item.path)).toContain('/custom/guide')
  })
})
