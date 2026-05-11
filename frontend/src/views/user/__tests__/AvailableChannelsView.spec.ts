import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AvailableChannelsView from '../AvailableChannelsView.vue'

const getAvailable = vi.hoisted(() => vi.fn())
const getUserGroupRates = vi.hoisted(() => vi.fn())
const appStore = vi.hoisted(() => ({
  cachedPublicSettings: {
    available_channels_enabled: false,
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
      t: (key: string) => key,
    }),
  }
})

function mountView(options: { stubTable?: boolean } = {}) {
  const stubTable = options.stubTable ?? true
  return mount(AvailableChannelsView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        TablePageLayout: {
          template: '<div><slot name="filters" /><slot name="table" /><slot /></div>',
        },
        ...(stubTable
          ? {
              AvailableChannelsTable: { template: '<div data-testid="available-channels-table" />' },
            }
          : {}),
        Icon: true,
      },
    },
  })
}

describe('AvailableChannelsView feature gate', () => {
  beforeEach(() => {
    appStore.cachedPublicSettings = {
      available_channels_enabled: false,
    }
    appStore.fetchPublicSettings.mockReset().mockResolvedValue(appStore.cachedPublicSettings)
    appStore.showError.mockReset()
    getAvailable.mockReset().mockResolvedValue([])
    getUserGroupRates.mockReset().mockResolvedValue({})
  })

  it('shows a clear disabled state instead of loading channel data', async () => {
    const wrapper = mountView()

    await flushPromises()

    expect(wrapper.text()).toContain('availableChannels.disabledTitle')
    expect(wrapper.text()).toContain('availableChannels.disabledDesc')
    expect(wrapper.find('[data-testid="available-channels-table"]').exists()).toBe(false)
    expect(getAvailable).not.toHaveBeenCalled()
  })

  it('shows a setup-oriented empty state when enabled but no channels are configured', async () => {
    appStore.cachedPublicSettings = {
      available_channels_enabled: true,
    }
    appStore.fetchPublicSettings.mockResolvedValue(appStore.cachedPublicSettings)
    getAvailable.mockResolvedValueOnce([])

    const wrapper = mountView({ stubTable: false })

    await flushPromises()

    expect(getAvailable).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('availableChannels.empty')
    expect(wrapper.text()).toContain('availableChannels.emptyDesc')
  })
})
