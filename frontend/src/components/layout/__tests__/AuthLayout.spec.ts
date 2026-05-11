import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AuthLayout from '../AuthLayout.vue'

const appStore = vi.hoisted(() => ({
  siteName: 'Sub2API',
  siteLogo: '',
  publicSettingsLoaded: true,
  cachedPublicSettings: {
    site_subtitle: '',
  } as Record<string, unknown>,
  fetchPublicSettings: vi.fn(),
}))

vi.mock('@/stores', () => ({
  useAppStore: () => appStore,
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => {
        if (key === 'admin.settings.site.siteSubtitlePlaceholder') return '订阅转 API 转换平台'
        if (key === 'home.footer.allRightsReserved') return '保留所有权利。'
        return key
      },
    }),
  }
})

describe('AuthLayout', () => {
  beforeEach(() => {
    appStore.siteName = 'Sub2API'
    appStore.siteLogo = ''
    appStore.publicSettingsLoaded = true
    appStore.cachedPublicSettings = { site_subtitle: '' }
    appStore.fetchPublicSettings.mockReset()
  })

  it('uses localized fallback copy instead of hard-coded English', () => {
    const wrapper = mount(AuthLayout, {
      slots: {
        default: '<div>登录表单</div>',
      },
    })

    expect(wrapper.text()).toContain('订阅转 API 转换平台')
    expect(wrapper.text()).toContain('保留所有权利。')
    expect(wrapper.text()).not.toContain('Subscription to API Conversion Platform')
    expect(wrapper.text()).not.toContain('All rights reserved')
  })
})
