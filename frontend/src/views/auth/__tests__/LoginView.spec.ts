import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginView from '@/views/auth/LoginView.vue'

const {
  pushMock,
  showErrorMock,
  showSuccessMock,
  showWarningMock,
  loginMock,
  login2FAMock,
  getPublicSettingsMock,
  isWeChatWebOAuthEnabledMock,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  showErrorMock: vi.fn(),
  showSuccessMock: vi.fn(),
  showWarningMock: vi.fn(),
  loginMock: vi.fn(),
  login2FAMock: vi.fn(),
  getPublicSettingsMock: vi.fn(),
  isWeChatWebOAuthEnabledMock: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: pushMock,
    currentRoute: {
      value: {
        query: {},
      },
    },
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

vi.mock('@/stores', () => ({
  useAuthStore: () => ({
    login: (...args: any[]) => loginMock(...args),
    login2FA: (...args: any[]) => login2FAMock(...args),
  }),
  useAppStore: () => ({
    showError: (...args: any[]) => showErrorMock(...args),
    showSuccess: (...args: any[]) => showSuccessMock(...args),
    showWarning: (...args: any[]) => showWarningMock(...args),
  }),
}))

vi.mock('@/api/auth', async () => {
  const actual = await vi.importActual<typeof import('@/api/auth')>('@/api/auth')
  return {
    ...actual,
    getPublicSettings: (...args: any[]) => getPublicSettingsMock(...args),
    isWeChatWebOAuthEnabled: (...args: any[]) => isWeChatWebOAuthEnabledMock(...args),
    isTotp2FARequired: () => false,
  }
})

function publicSettings(overrides: Record<string, unknown> = {}) {
  return {
    turnstile_enabled: false,
    turnstile_site_key: '',
    linuxdo_oauth_enabled: false,
    wechat_oauth_enabled: false,
    wechat_oauth_open_enabled: false,
    wechat_oauth_mp_enabled: false,
    wechat_oauth_mobile_enabled: false,
    backend_mode_enabled: false,
    oidc_oauth_enabled: false,
    oidc_oauth_provider_name: 'OIDC',
    github_oauth_enabled: false,
    google_oauth_enabled: false,
    password_reset_enabled: false,
    login_agreement_enabled: false,
    login_agreement_mode: 'modal',
    login_agreement_updated_at: '',
    login_agreement_revision: '',
    login_agreement_documents: [],
    ...overrides,
  }
}

function mountLoginView() {
  return mount(LoginView, {
    global: {
      stubs: {
        AuthLayout: { template: '<div><slot /><slot name="footer" /></div>' },
        Icon: true,
        TurnstileWidget: true,
        LoginAgreementPrompt: true,
        EmailOAuthButtons: true,
        LinuxDoOAuthSection: true,
        WechatOAuthSection: true,
        OidcOAuthSection: true,
        TotpLoginModal: true,
        RouterLink: {
          props: ['to'],
          template: '<a :href="to"><slot /></a>',
        },
      },
    },
  })
}

describe('LoginView', () => {
  beforeEach(() => {
    pushMock.mockReset()
    showErrorMock.mockReset()
    showSuccessMock.mockReset()
    showWarningMock.mockReset()
    loginMock.mockReset()
    login2FAMock.mockReset()
    getPublicSettingsMock.mockReset()
    isWeChatWebOAuthEnabledMock.mockReset()
    sessionStorage.clear()
    localStorage.clear()

    isWeChatWebOAuthEnabledMock.mockReturnValue(false)
    loginMock.mockResolvedValue({ user: { id: 2, role: 'user' } })
  })

  it('显示跳转到注册页的入口', async () => {
    getPublicSettingsMock.mockResolvedValue(publicSettings())

    const wrapper = mountLoginView()
    await flushPromises()

    const registerLink = wrapper.get('a[href="/register"]')
    expect(registerLink.text()).toContain('auth.signUp')
    expect(wrapper.text()).toContain('auth.dontHaveAccount')
  })

  it('后端模式隐藏用户端注册入口', async () => {
    getPublicSettingsMock.mockResolvedValue(
      publicSettings({
        backend_mode_enabled: true,
      })
    )

    const wrapper = mountLoginView()
    await flushPromises()

    expect(wrapper.find('a[href="/register"]').exists()).toBe(false)
  })
})
