import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ModelSquareView from '../ModelSquareView.vue'

const getAvailable = vi.hoisted(() => vi.fn())
const getUserGroupRates = vi.hoisted(() => vi.fn())
const appStore = vi.hoisted(() => ({
  cachedPublicSettings: {
    available_channels_enabled: true,
  } as Record<string, unknown> | null,
  fetchPublicSettings: vi.fn(),
  showError: vi.fn(),
}))

vi.mock('@/api/channels', () => ({
  default: { getAvailable },
  userChannelsAPI: { getAvailable },
  getAvailable,
}))

vi.mock('@/api/groups', () => ({
  default: { getUserGroupRates },
  userGroupsAPI: { getUserGroupRates },
  getUserGroupRates,
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => appStore,
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, unknown>) => {
        if (key === 'modelSquare.availableGroupsCount') return `${params?.count} groups`
        return key
      },
    }),
  }
})

function mountView() {
  return mount(ModelSquareView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        Icon: true,
        PlatformIcon: true,
        GroupBadge: {
          props: ['name', 'rateMultiplier', 'userRateMultiplier'],
          template: '<span data-testid="group-badge">{{ name }} ×{{ userRateMultiplier ?? rateMultiplier }}</span>',
        },
      },
    },
  })
}

describe('ModelSquareView', () => {
  beforeEach(() => {
    appStore.cachedPublicSettings = {
      available_channels_enabled: true,
    }
    appStore.fetchPublicSettings.mockReset().mockResolvedValue(appStore.cachedPublicSettings)
    appStore.showError.mockReset()
    getUserGroupRates.mockReset().mockResolvedValue({ 1: 0.08 })
    getAvailable.mockReset().mockResolvedValue([
      {
        name: 'Primary Channel',
        description: 'Paid models',
        platforms: [
          {
            platform: 'openai',
            groups: [
              {
                id: 1,
                name: '付费组',
                platform: 'openai',
                subscription_type: 'standard',
                rate_multiplier: 0.1,
                is_exclusive: false,
              },
            ],
            supported_models: [
              {
                name: 'gpt-5.4',
                platform: 'openai',
                pricing: {
                  billing_mode: 'token',
                  input_price: 2.5,
                  output_price: 15,
                  cache_write_price: null,
                  cache_read_price: 0.25,
                  image_output_price: null,
                  per_request_price: null,
                  intervals: [],
                },
              },
            ],
          },
        ],
      },
    ])
  })

  it('renders a native model square from available channel data', async () => {
    const wrapper = mountView()

    await flushPromises()

    expect(wrapper.text()).toContain('modelSquare.title')
    expect(wrapper.text()).toContain('gpt-5.4')
    expect(wrapper.text()).toContain('$2.5')
    expect(wrapper.text()).toContain('$15')
    expect(wrapper.text()).toContain('$0.25')
    expect(wrapper.text()).toContain('1 groups')
    expect(wrapper.text()).toContain('付费组 ×0.08')
  })

  it('filters models by provider and search text', async () => {
    const wrapper = mountView()

    await flushPromises()

    await wrapper.get('[data-testid="model-square-search"]').setValue('missing')
    expect(wrapper.text()).toContain('modelSquare.empty')
    expect(wrapper.text()).not.toContain('gpt-5.4')

    await wrapper.get('[data-testid="model-square-search"]').setValue('gpt')
    expect(wrapper.text()).toContain('gpt-5.4')
  })

  it('explains the required admin setup when no models are configured', async () => {
    getAvailable.mockResolvedValue([])

    const wrapper = mountView()

    await flushPromises()

    expect(wrapper.text()).toContain('modelSquare.empty')
    expect(wrapper.text()).toContain('modelSquare.emptyDesc')
  })

  it('shows a disabled state without loading data when available channels are disabled', async () => {
    appStore.cachedPublicSettings = {
      available_channels_enabled: false,
    }
    appStore.fetchPublicSettings.mockResolvedValue(appStore.cachedPublicSettings)

    const wrapper = mountView()

    await flushPromises()

    expect(wrapper.text()).toContain('modelSquare.disabledTitle')
    expect(getAvailable).not.toHaveBeenCalled()
  })
})
