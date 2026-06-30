import { describe, expect, it, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import AppHeader from '../AppHeader.vue'

const replayGuide = vi.hoisted(() => vi.fn())
const authState = vi.hoisted(() => ({
  user: {
    id: 42,
    username: 'demo',
    email: 'demo@example.com',
    role: 'user',
    balance: 12.5,
  },
  isSimpleMode: false,
  isAdmin: false,
  logout: vi.fn(),
}))

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
  return {
    ...actual,
    useRoute: () => ({
      name: 'Dashboard',
      path: '/dashboard',
      params: {},
      meta: {},
    }),
    useRouter: () => ({ push: vi.fn() }),
  }
})

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

vi.mock('@/stores', () => ({
  useAppStore: () => ({
    contactInfo: '',
    docUrl: '',
    cachedPublicSettings: { custom_menu_items: [] },
    toggleMobileSidebar: vi.fn(),
  }),
  useAuthStore: () => authState,
  useOnboardingStore: () => ({
    replay: replayGuide,
  }),
}))

vi.mock('@/stores/adminSettings', () => ({
  useAdminSettingsStore: () => ({
    customMenuItems: [],
  }),
}))

describe('AppHeader onboarding entry', () => {
  it('shows replay guide entry for regular users in standard mode', async () => {
    const wrapper = shallowMount(AppHeader, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          LocaleSwitcher: true,
          SubscriptionProgressMini: true,
          AnnouncementBell: true,
          Icon: true,
        },
      },
    })

    await wrapper.get('[aria-label="User Menu"]').trigger('click')

    expect(wrapper.text()).toContain('onboarding.restartTour')
  })
})
