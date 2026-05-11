import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'
import PaymentView from '../PaymentView.vue'
import PaymentMethodSelector from '@/components/payment/PaymentMethodSelector.vue'
import { PAYMENT_RECOVERY_STORAGE_KEY } from '@/components/payment/paymentFlow'

const routeState = vi.hoisted(() => ({
  path: '/purchase',
  query: {} as Record<string, unknown>,
}))

const routerReplace = vi.hoisted(() => vi.fn())
const routerPush = vi.hoisted(() => vi.fn())
const routerResolve = vi.hoisted(() => vi.fn(() => ({ href: '/payment/stripe?mock=1' })))
const createOrder = vi.hoisted(() => vi.fn())
const refreshUser = vi.hoisted(() => vi.fn())
const fetchActiveSubscriptions = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const showError = vi.hoisted(() => vi.fn())
const showInfo = vi.hoisted(() => vi.fn())
const showWarning = vi.hoisted(() => vi.fn())
const getCheckoutInfo = vi.hoisted(() => vi.fn())
const getMyOrders = vi.hoisted(() => vi.fn())
const cancelOrder = vi.hoisted(() => vi.fn())
const bridgeInvoke = vi.hoisted(() => vi.fn())
const authUser = vi.hoisted(() => ({
  value: {
    id: 42,
    username: 'demo-user',
    email: 'demo-user@example.com',
    balance: 0,
  },
}))
const appSettings = vi.hoisted(() => ({
  publicSettingsLoaded: true,
  cachedPublicSettings: {
    payment_enabled: true,
    purchase_subscription_enabled: false,
    purchase_subscription_url: '',
  } as Record<string, unknown>,
  fetchPublicSettings: vi.fn(),
}))

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
  return {
    ...actual,
    useRoute: () => routeState,
    useRouter: () => ({
      replace: routerReplace,
      push: routerPush,
      resolve: routerResolve,
    }),
  }
})
vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, unknown>) => {
        if (!params || Object.keys(params).length === 0) return key
        return `${key} ${Object.values(params).join(' ')}`
      },
      locale: { value: 'zh-CN' },
    }),
  }
})

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: authUser.value,
    token: 'token-abc',
    refreshUser,
  }),
}))

vi.mock('@/stores/payment', () => ({
  usePaymentStore: () => ({
    createOrder,
  }),
}))

vi.mock('@/stores/subscriptions', () => ({
  useSubscriptionStore: () => ({
    activeSubscriptions: [],
    fetchActiveSubscriptions,
  }),
}))

vi.mock('@/stores', () => ({
  useAppStore: () => ({
    publicSettingsLoaded: appSettings.publicSettingsLoaded,
    cachedPublicSettings: appSettings.cachedPublicSettings,
    fetchPublicSettings: appSettings.fetchPublicSettings,
    showError,
    showInfo,
    showWarning,
  }),
}))

vi.mock('@/api/payment', () => ({
  paymentAPI: {
    getCheckoutInfo,
    getMyOrders,
    cancelOrder,
  },
}))

vi.mock('@/utils/device', () => ({
  isMobileDevice: () => true,
}))

function checkoutInfoFixture() {
  return {
    data: {
      methods: {
        wxpay: {
          daily_limit: 0,
          daily_used: 0,
          daily_remaining: 0,
          single_min: 0,
          single_max: 0,
          fee_rate: 0,
          available: true,
        },
      },
      global_min: 0,
      global_max: 0,
      plans: [],
      balance_disabled: false,
      balance_recharge_multiplier: 1,
      recharge_fee_rate: 0,
      pending_orders: 0,
      max_pending_orders: 3,
      help_text: '',
      help_image_url: '',
      stripe_publishable_key: '',
    },
  }
}

function checkoutInfoWithoutMethodsFixture() {
  return {
    data: {
      ...checkoutInfoFixture().data,
      methods: {},
    },
  }
}

function checkoutInfoWithAlipayFixture() {
  return {
    data: {
      ...checkoutInfoFixture().data,
      methods: {
        alipay: {
          daily_limit: 0,
          daily_used: 0,
          daily_remaining: 0,
          single_min: 0,
          single_max: 0,
          fee_rate: 0,
          available: true,
        },
      },
    },
  }
}

function checkoutInfoWithPlansFixture() {
  return {
    data: {
      ...checkoutInfoFixture().data,
      plans: [
        {
          id: 7,
          group_id: 3,
          name: 'Starter',
          description: '',
          price: 128,
          original_price: 0,
          validity_days: 30,
          validity_unit: 'day',
          rate_multiplier: 1,
          daily_limit_usd: null,
          weekly_limit_usd: null,
          monthly_limit_usd: null,
          features: [],
          group_platform: 'openai',
          sort_order: 1,
          for_sale: true,
          group_name: 'OpenAI',
        },
      ],
    },
  }
}

function jsapiOrderFixture(resumeToken: string) {
  return {
    order_id: 123,
    amount: 88,
    pay_amount: 88,
    fee_rate: 0,
    expires_at: '2099-01-01T00:10:00.000Z',
    payment_type: 'wxpay',
    out_trade_no: 'sub2_jsapi_123',
    result_type: 'jsapi_ready' as const,
    resume_token: resumeToken,
    jsapi: {
      appId: 'wx123',
      timeStamp: '1712345678',
      nonceStr: 'nonce',
      package: 'prepay_id=wx123',
      signType: 'RSA',
      paySign: 'signed',
    },
  }
}

function oauthOrderFixture() {
  return {
    order_id: 456,
    amount: 128,
    pay_amount: 128,
    fee_rate: 0,
    expires_at: '2099-01-01T00:10:00.000Z',
    payment_type: 'wxpay',
    result_type: 'oauth_required' as const,
    oauth: {
      authorize_url: '/api/v1/auth/oauth/wechat/payment/start?payment_type=wxpay&redirect=%2Fpurchase%3Ffrom%3Dwechat',
      appid: 'wx123',
      scope: 'snsapi_base',
      redirect_url: '/auth/wechat/payment/callback',
    },
  }
}

function setPublicSettings(overrides: Record<string, unknown> = {}) {
  appSettings.publicSettingsLoaded = true
  appSettings.cachedPublicSettings = {
    payment_enabled: true,
    purchase_subscription_enabled: false,
    purchase_subscription_url: '',
    ...overrides,
  }
  appSettings.fetchPublicSettings.mockResolvedValue(appSettings.cachedPublicSettings)
}

function resetPaymentViewMocks(query: Record<string, unknown> = {}) {
  routeState.path = '/purchase'
  routeState.query = query
    routerReplace.mockReset().mockResolvedValue(undefined)
    routerPush.mockReset().mockResolvedValue(undefined)
    routerResolve.mockClear()
    createOrder.mockReset()
    refreshUser.mockReset()
    fetchActiveSubscriptions.mockReset().mockResolvedValue(undefined)
    showError.mockReset()
    showInfo.mockReset()
    showWarning.mockReset()
    getCheckoutInfo.mockReset().mockResolvedValue(checkoutInfoFixture())
    getMyOrders.mockReset().mockResolvedValue({
      data: {
        items: [],
        total: 0,
        page: 1,
        page_size: 20,
        pages: 0,
      },
    })
    cancelOrder.mockReset().mockResolvedValue({})
    authUser.value = {
      id: 42,
      username: 'demo-user',
      email: 'demo-user@example.com',
      balance: 0,
    }
    appSettings.fetchPublicSettings.mockReset()
    setPublicSettings()
    bridgeInvoke.mockReset()
    window.localStorage.clear()
    ;(window as Window & { WeixinJSBridge?: { invoke: typeof bridgeInvoke } }).WeixinJSBridge = {
      invoke: bridgeInvoke,
    }
}

function mountPaymentView() {
  return shallowMount(PaymentView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        Teleport: true,
        Transition: false,
      },
    },
  })
}

describe('PaymentView purchase entry modes', () => {
  beforeEach(() => resetPaymentViewMocks())

  it('uses native checkout first when payment is enabled even with an external subscription URL', async () => {
    setPublicSettings({
      payment_enabled: true,
      purchase_subscription_enabled: true,
      purchase_subscription_url: 'https://pay.example.com/checkout',
    })

    const wrapper = mountPaymentView()
    await flushPromises()

    expect(getCheckoutInfo).toHaveBeenCalledTimes(1)
    expect(wrapper.find('iframe').exists()).toBe(false)
  })

  it('renders native checkout controls instead of hiding them in an inert template element', async () => {
    getCheckoutInfo.mockResolvedValue(checkoutInfoWithPlansFixture())

    const wrapper = mountPaymentView()
    await flushPromises()

    expect(wrapper.find('template').exists()).toBe(false)
    expect(wrapper.text()).toContain('payment.tabTopUp')
    expect(wrapper.text()).toContain('payment.tabSubscribe')
  })

  it('renders the reference-style native purchase shell and opens orders inline', async () => {
    const wrapper = mountPaymentView()
    await flushPromises()

    expect(wrapper.text()).toContain('purchase.securePaymentTitle')
    expect(wrapper.text()).toContain('purchase.heroTitle')
    expect(wrapper.text()).toContain('purchase.myOrders')
    expect(wrapper.text()).toContain('purchase.refresh')
    expect(wrapper.text()).toContain('purchase.rechargeModeTitle')
    expect(wrapper.text()).toContain('purchase.flowTitle')
    expect(wrapper.text()).toContain('¥10')
    expect(wrapper.text()).toContain('¥1000')
    expect(wrapper.text()).toContain('¥2000')

    const ordersButton = wrapper.findAll('button').find(button => button.text() === 'purchase.myOrders')
    expect(ordersButton).toBeTruthy()
    await ordersButton!.trigger('click')
    await flushPromises()

    expect(routerPush).not.toHaveBeenCalledWith('/orders')
    expect(getMyOrders).toHaveBeenCalledWith({ page: 1, page_size: 20 })
    expect(wrapper.text()).toContain('purchase.ordersPanelTitle')
    expect(wrapper.text()).toContain('purchase.ordersPanelEmpty')
  })

  it('filters purchase-page orders by status inside the inline panel', async () => {
    const wrapper = mountPaymentView()
    await flushPromises()

    const ordersButton = wrapper.findAll('button').find(button => button.text() === 'purchase.myOrders')
    await ordersButton!.trigger('click')
    await flushPromises()

    const expectedFilterLabels = [
      'common.all',
      'payment.status.pending',
      'payment.status.completed',
      'payment.status.failed',
      'payment.status.refund_requested',
      'payment.status.refunding',
      'payment.status.partially_refunded',
      'payment.status.refunded',
      'payment.status.refund_failed',
      'payment.status.cancelled',
      'payment.status.expired',
    ]
    for (const label of expectedFilterLabels) {
      expect(wrapper.findAll('button').some(button => button.text() === label)).toBe(true)
    }

    const pendingFilter = wrapper.findAll('button').find(button => button.text() === 'payment.status.pending')
    expect(pendingFilter).toBeTruthy()
    await pendingFilter!.trigger('click')
    await flushPromises()

    expect(getMyOrders).toHaveBeenLastCalledWith({ page: 1, page_size: 20, status: 'PENDING' })

    const cancelledFilter = wrapper.findAll('button').find(button => button.text() === 'payment.status.cancelled')
    expect(cancelledFilter).toBeTruthy()
    await cancelledFilter!.trigger('click')
    await flushPromises()

    expect(getMyOrders).toHaveBeenLastCalledWith({ page: 1, page_size: 20, status: 'CANCELLED' })
  })

  it('cancels a pending order directly from the purchase page order panel', async () => {
    getMyOrders.mockResolvedValue({
      data: {
        items: [
          {
            id: 901,
            user_id: 42,
            amount: 10,
            pay_amount: 10,
            fee_rate: 0,
            payment_type: 'alipay',
            out_trade_no: 'PENDING-901',
            status: 'PENDING',
            order_type: 'balance',
            created_at: '2026-05-10T00:00:00.000Z',
            expires_at: '2026-05-10T00:15:00.000Z',
            refund_amount: 0,
          },
        ],
        total: 1,
        page: 1,
        page_size: 20,
        pages: 1,
      },
    })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const wrapper = mountPaymentView()
    await flushPromises()

    const ordersButton = wrapper.findAll('button').find(button => button.text() === 'purchase.myOrders')
    await ordersButton!.trigger('click')
    await flushPromises()

    const cancelButton = wrapper.findAll('button').find(button => button.text() === 'payment.orders.cancel')
    expect(cancelButton).toBeTruthy()
    await cancelButton!.trigger('click')
    await flushPromises()

    expect(cancelOrder).toHaveBeenCalledWith(901)
    expect(showInfo).toHaveBeenCalledWith('common.success')
    expect(getCheckoutInfo).toHaveBeenCalledTimes(2)
    expect(getMyOrders).toHaveBeenCalledTimes(2)

    confirmSpy.mockRestore()
  })

  it('shows the user email as the recharge account when username is empty', async () => {
    authUser.value = {
      id: 42,
      username: '',
      email: 'buyer@example.com',
      balance: 0,
    }

    const wrapper = mountPaymentView()
    await flushPromises()

    expect(wrapper.text()).toContain('buyer@example.com')
  })

  it('keeps the purchase flow steps visible on the subscription tab', async () => {
    getCheckoutInfo.mockResolvedValue(checkoutInfoWithPlansFixture())

    const wrapper = mountPaymentView()
    await flushPromises()

    const subscribeTab = wrapper.findAll('button').find(button => button.text() === 'payment.tabSubscribe')
    expect(subscribeTab).toBeTruthy()
    await subscribeTab!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('purchase.flowTitle')
    expect(wrapper.text()).toContain('purchase.flowSelectPlan')
    expect(wrapper.text()).toContain('purchase.flowPay')
    expect(wrapper.text()).toContain('purchase.flowGetCode')
    expect(wrapper.text()).toContain('purchase.flowActivate')
    expect(wrapper.findAll('[data-testid="purchase-flow-step"]')).toHaveLength(4)
  })

  it('explains when native payment methods are not configured', async () => {
    getCheckoutInfo.mockResolvedValue(checkoutInfoWithoutMethodsFixture())

    const wrapper = mountPaymentView()
    await flushPromises()

    expect(wrapper.text()).toContain('purchase.rechargeAmount')
    expect(wrapper.text()).toContain('¥10')
    expect(wrapper.text()).toContain('¥1000')
    expect(wrapper.text()).toContain('¥2000')
    expect(wrapper.text()).toContain('purchase.flowTitle')
    expect(wrapper.text()).toContain('payment.paymentMethod')
    expect(wrapper.text()).toContain('payment.methods.alipay')
    expect(wrapper.text()).toContain('purchase.alipayPendingConfig')
    expect(wrapper.text()).toContain('purchase.paypalLabel')
    expect(wrapper.text()).toContain('purchase.paypalNotSupported')
    expect(wrapper.text()).toContain('purchase.paymentMethodsNotConfiguredTitle')
    expect(wrapper.text()).toContain('purchase.paymentMethodsNotConfiguredDesc')
    expect(wrapper.text()).toContain('purchase.paymentActionUnavailable')
    expect(wrapper.text()).not.toContain('purchase.rechargeNow')
    expect(wrapper.text()).not.toContain('payment.notAvailable')
  })

  it('blocks recharge when pending orders reach the configured limit like the reference page', async () => {
    getCheckoutInfo.mockResolvedValue({
      data: {
        ...checkoutInfoWithAlipayFixture().data,
        pending_orders: 3,
        max_pending_orders: 3,
      },
    })

    const wrapper = mountPaymentView()
    await flushPromises()

    expect(wrapper.text()).toContain('purchase.pendingOrdersBlocked')
    expect(wrapper.text()).toContain('3')
    expect(wrapper.find('button.btn').attributes('disabled')).toBeDefined()
  })

  it('does not advertise PayPal recharge benefits when no PayPal provider exists', async () => {
    getCheckoutInfo.mockResolvedValue(checkoutInfoFixture())

    const wrapper = mountPaymentView()
    await flushPromises()

    expect(wrapper.text()).toContain('purchase.rechargeRate')
    expect(wrapper.text()).not.toContain('purchase.paypalRate')
  })

  it('keeps PayPal visible but disabled when Alipay is the only configured native method', async () => {
    getCheckoutInfo.mockResolvedValue(checkoutInfoWithAlipayFixture())

    const wrapper = mountPaymentView()
    await flushPromises()

    const selector = wrapper.findComponent(PaymentMethodSelector)
    expect(selector.exists()).toBe(true)
    const methods = selector.props('methods') as Array<{
      type: string
      available: boolean
      labelKey?: string
      noteKey?: string
    }>
    expect(methods.map(method => method.type)).toEqual(['alipay', 'paypal'])
    expect(methods.find(method => method.type === 'paypal')).toMatchObject({
      available: false,
      labelKey: 'purchase.paypalLabel',
      noteKey: 'purchase.paypalNotSupported',
    })
  })

  it('embeds the external subscription page when native payment is disabled', async () => {
    setPublicSettings({
      payment_enabled: false,
      purchase_subscription_enabled: true,
      purchase_subscription_url: 'https://pay.example.com/checkout?plan=pro',
    })

    const wrapper = mountPaymentView()
    await flushPromises()

    expect(getCheckoutInfo).not.toHaveBeenCalled()
    const iframe = wrapper.find('iframe')
    expect(iframe.exists()).toBe(true)
    const src = iframe.attributes('src')
    expect(src).toBeTruthy()
    const url = new URL(src!)
    expect(`${url.origin}${url.pathname}`).toBe('https://pay.example.com/checkout')
    expect(url.searchParams.get('plan')).toBe('pro')
    expect(url.searchParams.get('user_id')).toBe('42')
    expect(url.searchParams.get('token')).toBe('token-abc')
    expect(url.searchParams.get('theme')).toBe('light')
    expect(url.searchParams.get('lang')).toBe('zh-CN')
    expect(url.searchParams.get('ui_mode')).toBe('embedded')
  })

  it('shows a disabled state when neither native payment nor external subscription is enabled', async () => {
    setPublicSettings({
      payment_enabled: false,
      purchase_subscription_enabled: false,
      purchase_subscription_url: '',
    })

    const wrapper = mountPaymentView()
    await flushPromises()

    expect(getCheckoutInfo).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('purchase.notEnabledTitle')
    expect(wrapper.find('iframe').exists()).toBe(false)
  })
})

describe('PaymentView WeChat JSAPI flow', () => {
  beforeEach(() => {
    resetPaymentViewMocks({
      wechat_resume: '1',
      wechat_resume_token: 'resume-token-123',
    })
  })

  it('resets payment state and redirects to /payment/result after JSAPI reports success', async () => {
    createOrder.mockResolvedValue(jsapiOrderFixture('resume-token-123'))
    bridgeInvoke.mockImplementation((_action, _payload, callback) => {
      callback({ err_msg: 'get_brand_wcpay_request:ok' })
    })

    shallowMount(PaymentView, {
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
        },
      },
    })
    await flushPromises()
    await flushPromises()

    expect(routerReplace).toHaveBeenCalledWith({ path: '/purchase', query: {} })
    expect(routerPush).toHaveBeenCalledWith({
      path: '/payment/result',
      query: {
        order_id: '123',
        out_trade_no: 'sub2_jsapi_123',
        resume_token: 'resume-token-123',
      },
    })
    expect(window.localStorage.getItem(PAYMENT_RECOVERY_STORAGE_KEY)).toBeNull()
  })

  it('resets payment state when JSAPI reports cancellation', async () => {
    createOrder.mockResolvedValue(jsapiOrderFixture('resume-token-cancel'))
    bridgeInvoke.mockImplementation((_action, _payload, callback) => {
      callback({ err_msg: 'get_brand_wcpay_request:cancel' })
    })

    shallowMount(PaymentView, {
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
        },
      },
    })
    await flushPromises()
    await flushPromises()

    expect(showInfo).toHaveBeenCalledWith('payment.qr.cancelled')
    expect(routerPush).not.toHaveBeenCalled()
    expect(window.localStorage.getItem(PAYMENT_RECOVERY_STORAGE_KEY)).toBeNull()
  })

  it('clears stale recovery state when JSAPI never becomes available', async () => {
    vi.useFakeTimers()
    createOrder.mockResolvedValue(jsapiOrderFixture('resume-token-missing-bridge'))
    ;(window as Window & { WeixinJSBridge?: { invoke: typeof bridgeInvoke } }).WeixinJSBridge = undefined

    const wrapper = shallowMount(PaymentView, {
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
        },
      },
    })

    await flushPromises()
    await vi.advanceTimersByTimeAsync(4000)
    await flushPromises()
    await flushPromises()

    expect(showError).toHaveBeenCalledWith(
      'payment.errors.wechatJsapiUnavailable payment.errors.wechatOpenInWeChatHint',
    )
    expect(routerPush).not.toHaveBeenCalled()
    expect(window.localStorage.getItem(PAYMENT_RECOVERY_STORAGE_KEY)).toBeNull()
    expect(wrapper.html()).not.toContain('payment-status-panel-stub')
  })

  it('clears a stale recovery snapshot before handling wechat resume callback params', async () => {
    createOrder.mockRejectedValueOnce(new Error('resume failed'))
    window.localStorage.setItem(PAYMENT_RECOVERY_STORAGE_KEY, JSON.stringify({
      orderId: 999,
      amount: 66,
      qrCode: 'stale-qr',
      expiresAt: '2099-01-01T00:10:00.000Z',
      paymentType: 'alipay',
      payUrl: 'https://pay.example.com/stale',
      outTradeNo: 'stale-out-trade-no',
      clientSecret: '',
      intentId: '',
      currency: '',
      countryCode: '',
      paymentEnv: '',
      payAmount: 66,
      orderType: 'balance',
      paymentMode: 'popup',
      resumeToken: '',
      createdAt: Date.UTC(2099, 0, 1, 0, 0, 0),
    }))

    shallowMount(PaymentView, {
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
        },
      },
    })
    await flushPromises()
    await flushPromises()

    expect(createOrder).toHaveBeenCalledWith(expect.objectContaining({
      wechat_resume_token: 'resume-token-123',
    }))
    expect(window.localStorage.getItem(PAYMENT_RECOVERY_STORAGE_KEY)).toBeNull()
  })

  it('keeps subscription resume context for token-only WeChat callbacks', async () => {
    routeState.query = {
      wechat_resume: '1',
      wechat_resume_token: 'resume-subscription-7',
      payment_type: 'wxpay_direct',
      order_type: 'subscription',
      plan_id: '7',
    }
    getCheckoutInfo.mockResolvedValue(checkoutInfoWithPlansFixture())
    createOrder.mockResolvedValue(oauthOrderFixture())

    const originalLocation = window.location
    const locationState = {
      href: 'http://localhost/purchase',
      origin: 'http://localhost',
    }
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: locationState,
    })

    shallowMount(PaymentView, {
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
        },
      },
    })
    await flushPromises()
    await flushPromises()

    expect(routerReplace).toHaveBeenCalledWith({ path: '/purchase', query: {} })
    expect(createOrder).toHaveBeenCalledWith(expect.objectContaining({
      payment_type: 'wxpay',
      order_type: 'subscription',
      plan_id: 7,
      wechat_resume_token: 'resume-subscription-7',
    }))
    expect(locationState.href).toContain('/api/v1/auth/oauth/wechat/payment/start?')
    expect(new URL(locationState.href, 'http://localhost').searchParams.get('redirect')).toBe(
      '/purchase?from=wechat&payment_type=wxpay&order_type=subscription&plan_id=7',
    )

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
  })

  it('falls back to QR flow when mobile WeChat payment is unavailable', async () => {
    routeState.query = {
      wechat_resume: '1',
      wechat_resume_token: 'resume-token-h5',
      payment_type: 'wxpay_direct',
    }
    createOrder
      .mockRejectedValueOnce({ reason: 'WECHAT_H5_NOT_AUTHORIZED' })
      .mockResolvedValueOnce({
        order_id: 778,
        amount: 88,
        pay_amount: 88,
        fee_rate: 0,
        expires_at: '2099-01-01T00:10:00.000Z',
        payment_type: 'wxpay',
        qr_code: 'weixin://wxpay/bizpayurl?pr=fallback-native',
        out_trade_no: 'sub2_qr_778',
      })

    shallowMount(PaymentView, {
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
        },
      },
    })
    await flushPromises()
    await flushPromises()

    expect(createOrder).toHaveBeenNthCalledWith(1, expect.objectContaining({
      payment_type: 'wxpay',
      is_mobile: true,
      wechat_resume_token: 'resume-token-h5',
    }))
    expect(createOrder).toHaveBeenNthCalledWith(2, expect.objectContaining({
      payment_type: 'wxpay',
      is_mobile: false,
      payment_source: 'hosted_redirect',
    }))
    expect(showWarning).toHaveBeenCalledWith('payment.errors.mobilePaymentFallbackToQr')
    expect(showError).not.toHaveBeenCalled()
    expect(window.localStorage.getItem(PAYMENT_RECOVERY_STORAGE_KEY)).toContain('weixin://wxpay/bizpayurl?pr=fallback-native')
  })
})
