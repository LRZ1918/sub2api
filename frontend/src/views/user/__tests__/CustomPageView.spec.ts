import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import CustomPageView from '../CustomPageView.vue'

const routeState = vi.hoisted(() => ({
  params: { id: 'user-guide' } as Record<string, string>,
}))

const appStore = vi.hoisted(() => ({
  publicSettingsLoaded: true,
  cachedPublicSettings: {
    custom_menu_items: [
      {
        id: 'user-guide',
        label: '使用指南',
        url: 'md:user-guide',
        visibility: 'user',
        sort_order: 1,
      },
    ],
  } as Record<string, unknown>,
  fetchPublicSettings: vi.fn(),
}))

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
  return {
    ...actual,
    useRoute: () => routeState,
  }
})

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
      locale: { value: 'zh-CN' },
    }),
  }
})

vi.mock('@/stores', () => ({
  useAppStore: () => appStore,
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 42 },
    token: 'token-abc',
    isAdmin: false,
  }),
}))

vi.mock('@/stores/adminSettings', () => ({
  useAdminSettingsStore: () => ({
    customMenuItems: [],
  }),
}))

function mountView() {
  return mount(CustomPageView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        Icon: true,
      },
    },
  })
}

describe('CustomPageView', () => {
  beforeEach(() => {
    appStore.publicSettingsLoaded = true
    appStore.fetchPublicSettings.mockReset().mockResolvedValue(appStore.cachedPublicSettings)
    routeState.params = { id: 'user-guide' }
  })

  it('uses localized markdown missing text instead of hard-coded English', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    const wrapper = mountView()

    await flushPromises()

    expect(wrapper.text()).toContain('customPage.markdownNotFound')
    expect(wrapper.text()).not.toContain('Page not found')
  })

  it('uses localized markdown load failure text instead of hard-coded English', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network failed')))

    const wrapper = mountView()

    await flushPromises()

    expect(wrapper.text()).toContain('customPage.markdownLoadFailed')
    expect(wrapper.text()).not.toContain('Failed to load page')
  })
})
