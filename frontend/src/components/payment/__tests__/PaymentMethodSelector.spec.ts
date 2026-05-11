import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import PaymentMethodSelector from '../PaymentMethodSelector.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  }
})

describe('PaymentMethodSelector', () => {
  it('renders disabled reference-only PayPal method with a clear unavailable note', () => {
    const wrapper = mount(PaymentMethodSelector, {
      props: {
        selected: 'alipay',
        methods: [
          { type: 'alipay', fee_rate: 0, available: true },
          {
            type: 'paypal',
            fee_rate: 0,
            available: false,
            labelKey: 'purchase.paypalLabel',
            noteKey: 'purchase.paypalNotSupported',
          },
        ],
      },
    })

    expect(wrapper.text()).toContain('purchase.paypalLabel')
    expect(wrapper.text()).toContain('purchase.paypalNotSupported')
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(2)
    expect(buttons[1].attributes('disabled')).toBeDefined()
  })
})
