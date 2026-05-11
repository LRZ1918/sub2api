import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import SubscriptionPlanCard from '../SubscriptionPlanCard.vue'
import type { SubscriptionPlan } from '@/types/payment'

type PlanWithProductName = SubscriptionPlan & { product_name?: string }

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  }
})

function referencePlan(overrides: Partial<PlanWithProductName> = {}): PlanWithProductName {
  return {
    id: 1,
    group_id: 10,
    group_platform: 'openai',
    group_name: 'OpenAI',
    rate_multiplier: 0.1,
    daily_limit_usd: 0,
    weekly_limit_usd: 0,
    monthly_limit_usd: 120,
    supported_model_scopes: ['claude'],
    name: '10元包月现已支持5.5',
    description: '',
    price: 10,
    original_price: 0,
    validity_days: 1,
    validity_unit: 'month',
    product_name: '/v1/messages\ngpt-5.4',
    features: ['极度的灵活性', '并发上限：5'],
    for_sale: true,
    sort_order: 1,
    ...overrides,
  }
}

describe('SubscriptionPlanCard', () => {
  it('renders reference-style subscription metrics and product tags', () => {
    const wrapper = mount(SubscriptionPlanCard, {
      props: {
        plan: referencePlan(),
        activeSubscriptions: [],
      },
    })

    const text = wrapper.text()
    expect(text).toContain('10元包月现已支持5.5')
    expect(text).toContain('/v1/messages')
    expect(text).toContain('gpt-5.4')
    expect(text).toContain('¥')
    expect(text).toContain('10')
    expect(text).toContain('payment.planCard.systemRate')
    expect(text).toContain('0.1x')
    expect(text).toContain('payment.planCard.packageRate')
    expect(text).toContain('0.0833x')
    expect(text).toContain('payment.planCard.concurrency')
    expect(text).toContain('5')
    expect(text).toContain('payment.planCard.monthlyLimit')
    expect(text).toContain('$120')
    expect(text).toContain('极度的灵活性')
    expect(text).toContain('payment.subscribeNow')
  })

  it('shows a separate validity badge next to the plan title like the reference purchase page', () => {
    const wrapper = mount(SubscriptionPlanCard, {
      props: {
        plan: referencePlan(),
        activeSubscriptions: [],
      },
    })

    const badge = wrapper.find('[data-testid="plan-validity-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('1payment.monthUnit')
  })

  it('formats quota metrics without thousands separators like the reference purchase page', () => {
    const wrapper = mount(SubscriptionPlanCard, {
      props: {
        plan: referencePlan({
          monthly_limit_usd: 1300,
          price: 99,
          features: ['并发上限：30'],
        }),
        activeSubscriptions: [],
      },
    })

    const text = wrapper.text()
    expect(text).toContain('$1300')
    expect(text).not.toContain('$1,300')
  })
})
