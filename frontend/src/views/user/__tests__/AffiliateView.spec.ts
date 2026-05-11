import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AffiliateView from '../AffiliateView.vue'

const getAffiliateDetail = vi.hoisted(() => vi.fn())
const transferAffiliateQuota = vi.hoisted(() => vi.fn())
const refreshUser = vi.hoisted(() => vi.fn())
const copyToClipboard = vi.hoisted(() => vi.fn())
const appStore = vi.hoisted(() => ({
  cachedPublicSettings: {
    affiliate_enabled: false,
  } as Record<string, unknown> | null,
  fetchPublicSettings: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}))

vi.mock('@/api/user', () => ({
  default: { getAffiliateDetail, transferAffiliateQuota },
  getAffiliateDetail,
  transferAffiliateQuota,
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => appStore,
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    refreshUser,
  }),
}))

vi.mock('@/composables/useClipboard', () => ({
  useClipboard: () => ({
    copyToClipboard,
  }),
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
  return mount(AffiliateView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        Icon: true,
      },
    },
  })
}

describe('AffiliateView feature gate', () => {
  beforeEach(() => {
    appStore.cachedPublicSettings = {
      affiliate_enabled: false,
    }
    appStore.fetchPublicSettings.mockReset().mockResolvedValue(appStore.cachedPublicSettings)
    appStore.showError.mockReset()
    appStore.showSuccess.mockReset()
    getAffiliateDetail.mockReset().mockResolvedValue({
      aff_code: 'AFF2026',
      aff_count: 0,
      aff_quota: 0,
      aff_history_quota: 0,
      aff_frozen_quota: 0,
      effective_rebate_rate_percent: 10,
      invitees: [],
    })
    transferAffiliateQuota.mockReset()
    refreshUser.mockReset()
    copyToClipboard.mockReset()
  })

  it('shows a clear disabled state and skips affiliate API calls when the feature is off', async () => {
    const wrapper = mountView()

    await flushPromises()

    expect(wrapper.text()).toContain('affiliate.disabledTitle')
    expect(wrapper.text()).toContain('affiliate.disabledDesc')
    expect(getAffiliateDetail).not.toHaveBeenCalled()
  })

  it('shows an unavailable state instead of a blank page when affiliate data cannot load', async () => {
    appStore.cachedPublicSettings = {
      affiliate_enabled: true,
    }
    appStore.fetchPublicSettings.mockResolvedValue(appStore.cachedPublicSettings)
    getAffiliateDetail.mockRejectedValueOnce(new Error('boom'))

    const wrapper = mountView()

    await flushPromises()

    expect(wrapper.text()).toContain('affiliate.unavailableTitle')
    expect(wrapper.text()).toContain('affiliate.unavailableDesc')
    expect(appStore.showError).toHaveBeenCalled()
  })
})
