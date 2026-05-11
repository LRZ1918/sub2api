import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import RegisterView from '@/views/auth/RegisterView.vue'

const {
  pushMock,
  showSuccessMock,
  showErrorMock,
  showWarningMock,
  registerMock,
  getPublicSettingsMock,
  isWeChatWebOAuthEnabledMock,
  validatePromoCodeMock,
  validateInvitationCodeMock,
  routeQuery,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  showSuccessMock: vi.fn(),
  showErrorMock: vi.fn(),
  showWarningMock: vi.fn(),
  registerMock: vi.fn(),
  getPublicSettingsMock: vi.fn(),
  isWeChatWebOAuthEnabledMock: vi.fn(),
  validatePromoCodeMock: vi.fn(),
  validateInvitationCodeMock: vi.fn(),
  routeQuery: {} as Record<string, string | undefined>,
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  useRoute: () => ({
    query: routeQuery,
  }),
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, string | number>) => {
        if (key === 'auth.accountCreatedSuccess') {
          return `account-created:${params?.siteName ?? 'Sub2API'}`
        }
        return key
      },
      locale: { value: 'zh-CN' },
    }),
  }
})

vi.mock('@/stores', () => ({
  useAuthStore: () => ({
    register: (...args: any[]) => registerMock(...args),
  }),
  useAppStore: () => ({
    showSuccess: (...args: any[]) => showSuccessMock(...args),
    showError: (...args: any[]) => showErrorMock(...args),
    showWarning: (...args: any[]) => showWarningMock(...args),
  }),
}))

vi.mock('@/api/auth', async () => {
  const actual = await vi.importActual<typeof import('@/api/auth')>('@/api/auth')
  return {
    ...actual,
    getPublicSettings: (...args: any[]) => getPublicSettingsMock(...args),
    isWeChatWebOAuthEnabled: (...args: any[]) => isWeChatWebOAuthEnabledMock(...args),
    validatePromoCode: (...args: any[]) => validatePromoCodeMock(...args),
    validateInvitationCode: (...args: any[]) => validateInvitationCodeMock(...args),
  }
})

const EmailOAuthButtonsStub = defineComponent({
  props: {
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  setup(props) {
    return () =>
      h(
        'button',
        {
          type: 'button',
          disabled: props.disabled,
          'data-test': 'email-oauth',
        },
        'email-oauth'
      )
  },
})

function publicSettings(overrides: Record<string, unknown> = {}) {
  return {
    registration_enabled: true,
    email_verify_enabled: false,
    promo_code_enabled: false,
    invitation_code_enabled: false,
    turnstile_enabled: false,
    turnstile_site_key: '',
    site_name: 'Sub2API',
    linuxdo_oauth_enabled: false,
    wechat_oauth_enabled: false,
    wechat_oauth_open_enabled: false,
    wechat_oauth_mp_enabled: false,
    wechat_oauth_mobile_enabled: false,
    oidc_oauth_enabled: false,
    oidc_oauth_provider_name: 'OIDC',
    github_oauth_enabled: false,
    google_oauth_enabled: false,
    registration_email_suffix_whitelist: [],
    login_agreement_enabled: false,
    login_agreement_mode: 'modal',
    login_agreement_updated_at: '',
    login_agreement_revision: '',
    login_agreement_documents: [],
    ...overrides,
  }
}

function mountRegisterView() {
  return mount(RegisterView, {
    global: {
      stubs: {
        AuthLayout: { template: '<div><slot /><slot name="footer" /></div>' },
        Icon: true,
        TurnstileWidget: true,
        LoginAgreementPrompt: true,
        EmailOAuthButtons: EmailOAuthButtonsStub,
        LinuxDoOAuthSection: true,
        WechatOAuthSection: true,
        OidcOAuthSection: true,
        RouterLink: { template: '<a><slot /></a>' },
        transition: false,
      },
    },
  })
}

describe('RegisterView', () => {
  beforeEach(() => {
    pushMock.mockReset()
    showSuccessMock.mockReset()
    showErrorMock.mockReset()
    showWarningMock.mockReset()
    registerMock.mockReset()
    getPublicSettingsMock.mockReset()
    isWeChatWebOAuthEnabledMock.mockReset()
    validatePromoCodeMock.mockReset()
    validateInvitationCodeMock.mockReset()
    sessionStorage.clear()
    localStorage.clear()
    Object.keys(routeQuery).forEach((key) => delete routeQuery[key])

    isWeChatWebOAuthEnabledMock.mockReturnValue(false)
    registerMock.mockResolvedValue({ id: 2, email: 'fresh@example.com' })
  })

  it('提交开放注册表单后创建账号并进入用户仪表盘', async () => {
    getPublicSettingsMock.mockResolvedValue(publicSettings())

    const wrapper = mountRegisterView()
    await flushPromises()

    await wrapper.get('input#email').setValue('fresh@example.com')
    await wrapper.get('input#password').setValue('secret-123')
    await wrapper.get('form').trigger('submit.prevent')
    await flushPromises()

    expect(registerMock).toHaveBeenCalledWith({
      email: 'fresh@example.com',
      password: 'secret-123',
      turnstile_token: undefined,
      promo_code: undefined,
      invitation_code: undefined,
    })
    expect(showSuccessMock).toHaveBeenCalledWith('account-created:Sub2API')
    expect(pushMock).toHaveBeenCalledWith('/dashboard')
  })

  it('开启邮箱验证时先进入邮箱验证码页面并暂存注册数据', async () => {
    getPublicSettingsMock.mockResolvedValue(
      publicSettings({
        email_verify_enabled: true,
      })
    )

    const wrapper = mountRegisterView()
    await flushPromises()

    await wrapper.get('input#email').setValue('verify@example.com')
    await wrapper.get('input#password').setValue('secret-123')
    await wrapper.get('form').trigger('submit.prevent')
    await flushPromises()

    expect(registerMock).not.toHaveBeenCalled()
    expect(JSON.parse(sessionStorage.getItem('register_data') || '{}')).toMatchObject({
      email: 'verify@example.com',
      password: 'secret-123',
    })
    expect(pushMock).toHaveBeenCalledWith('/email-verify')
  })

  it('注册关闭时展示关闭提示并禁用快捷注册入口', async () => {
    getPublicSettingsMock.mockResolvedValue(
      publicSettings({
        registration_enabled: false,
        github_oauth_enabled: true,
      })
    )

    const wrapper = mountRegisterView()
    await flushPromises()

    expect(wrapper.text()).toContain('auth.registrationDisabled')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.get('[data-test="email-oauth"]').attributes('disabled')).toBeDefined()
  })

  it('按公开设置展示邀请码和优惠码注册字段', async () => {
    getPublicSettingsMock.mockResolvedValue(
      publicSettings({
        promo_code_enabled: true,
        invitation_code_enabled: true,
      })
    )

    const wrapper = mountRegisterView()
    await flushPromises()

    expect(wrapper.find('input#promo_code').exists()).toBe(true)
    expect(wrapper.find('input#invitation_code').exists()).toBe(true)
  })
})
