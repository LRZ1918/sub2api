import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import ChannelStatusView from '../ChannelStatusView.vue'

const listChannelMonitorViews = vi.hoisted(() => vi.fn())
const fetchChannelMonitorDetail = vi.hoisted(() => vi.fn())
const appStore = vi.hoisted(() => ({
  cachedPublicSettings: {
    channel_monitor_enabled: false,
  } as Record<string, unknown> | null,
  showError: vi.fn(),
}))

vi.mock('@/api/channelMonitor', () => ({
  list: listChannelMonitorViews,
  status: fetchChannelMonitorDetail,
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

function mountView() {
  return mount(ChannelStatusView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        MonitorHero: { template: '<section data-testid="monitor-hero" />' },
        MonitorCardGrid: { template: '<section data-testid="monitor-card-grid" />' },
        MonitorDetailDialog: true,
        Icon: true,
      },
    },
  })
}

describe('ChannelStatusView feature gate', () => {
  beforeEach(() => {
    appStore.cachedPublicSettings = {
      channel_monitor_enabled: false,
    }
    appStore.showError.mockReset()
    listChannelMonitorViews.mockReset().mockResolvedValue({ items: [] })
    fetchChannelMonitorDetail.mockReset().mockResolvedValue({})
  })

  it('shows a clear disabled state instead of loading monitor data', async () => {
    const wrapper = mountView()

    await flushPromises()

    expect(wrapper.text()).toContain('channelStatus.disabledTitle')
    expect(wrapper.text()).toContain('channelStatus.disabledDesc')
    expect(wrapper.find('[data-testid="monitor-hero"]').exists()).toBe(false)
    expect(listChannelMonitorViews).not.toHaveBeenCalled()
  })
})
