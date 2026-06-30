import { describe, expect, it } from 'vitest'
import { getAdminSteps, getUserSteps } from '../steps'

const t = (key: string) => key

function selectorsOf(steps: Array<{ element?: unknown }>): string[] {
  return steps
    .map((step) => step.element)
    .filter((element): element is string => typeof element === 'string')
}

describe('Guide steps', () => {
  it('keeps the existing admin onboarding flow intact', () => {
    const selectors = selectorsOf(getAdminSteps(t))

    expect(selectors).toContain('#sidebar-group-manage')
    expect(selectors).toContain('#sidebar-channel-manage')
    expect(selectors).toContain('[data-tour="sidebar-my-keys"]')
  })

  it('builds a full user onboarding flow when user portal features are enabled', () => {
    const steps = getUserSteps(t, {
      settings: {
        payment_enabled: true,
        purchase_subscription_enabled: false,
        available_channels_enabled: true,
        custom_endpoints: [{ name: '默认线路', endpoint: 'https://api.example.com', description: '' }],
        api_base_url: 'https://api.example.com',
      },
    })
    const selectors = selectorsOf(steps)

    expect(selectors).toContain('[data-tour="sidebar-dashboard"]')
    expect(selectors).toContain('[data-tour="sidebar-purchase"]')
    expect(selectors).toContain('[data-tour="sidebar-model-square"]')
    expect(selectors).toContain('[data-tour="sidebar-my-keys"]')
    expect(selectors).toContain('[data-tour="keys-endpoints"]')
    expect(selectors).toContain('[data-tour="keys-create-btn"]')
    expect(selectors).toContain('[data-tour="key-form-name"]')
    expect(selectors).toContain('[data-tour="key-form-group"]')
    expect(selectors).toContain('[data-tour="key-form-submit"]')
    expect(selectors).toContain('[data-tour="sidebar-usage"]')
    expect(selectors).toContain('[data-tour="sidebar-subscriptions"]')
    expect(selectors).toContain('[data-tour="sidebar-orders"]')
    expect(selectors).toContain('[data-tour="sidebar-profile"]')
    expect(selectors).toContain('[data-tour="header-user-menu"]')
  })

  it('skips user onboarding steps for disabled or unavailable user portal features', () => {
    const steps = getUserSteps(t, {
      settings: {
        payment_enabled: false,
        purchase_subscription_enabled: false,
        available_channels_enabled: false,
        custom_endpoints: [],
        api_base_url: '',
      },
    })
    const selectors = selectorsOf(steps)

    expect(selectors).not.toContain('[data-tour="sidebar-purchase"]')
    expect(selectors).not.toContain('[data-tour="sidebar-model-square"]')
    expect(selectors).not.toContain('[data-tour="keys-endpoints"]')
    expect(selectors).not.toContain('[data-tour="sidebar-orders"]')
    expect(selectors).toContain('[data-tour="sidebar-my-keys"]')
    expect(selectors).toContain('[data-tour="sidebar-usage"]')
  })
})
