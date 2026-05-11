import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import PlanEditDialog from '../PlanEditDialog.vue'
import en from '@/i18n/locales/en'
import zh from '@/i18n/locales/zh'
import type { AdminGroup } from '@/types'
import type { SubscriptionPlan } from '@/types/payment'

const updatePlan = vi.hoisted(() => vi.fn().mockResolvedValue({}))
const createPlan = vi.hoisted(() => vi.fn().mockResolvedValue({}))
const showError = vi.hoisted(() => vi.fn())
const showSuccess = vi.hoisted(() => vi.fn())

vi.mock('@/api/admin/payment', () => ({
  adminPaymentAPI: {
    updatePlan,
    createPlan,
  },
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    showError,
    showSuccess,
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

const group: AdminGroup = {
  id: 42,
  name: '参考套餐',
  description: '',
  platform: 'openai',
  rate_multiplier: 0.1,
  is_exclusive: false,
  status: 'active',
  subscription_type: 'subscription',
  daily_limit_usd: 0,
  weekly_limit_usd: 0,
  monthly_limit_usd: 120,
  allow_image_generation: false,
  image_rate_independent: false,
  image_rate_multiplier: 1,
  image_price_1k: null,
  image_price_2k: null,
  image_price_4k: null,
  claude_code_only: false,
  fallback_group_id: null,
  fallback_group_id_on_invalid_request: null,
  require_oauth_only: false,
  require_privacy_set: false,
  model_routing: null,
  model_routing_enabled: false,
  mcp_xml_inject: false,
  sort_order: 0,
  created_at: '2026-05-09T00:00:00Z',
  updated_at: '2026-05-09T00:00:00Z',
}

const plan: SubscriptionPlan = {
  id: 7,
  group_id: 42,
  group_platform: 'openai',
  group_name: '参考套餐',
  rate_multiplier: 0.1,
  daily_limit_usd: 0,
  weekly_limit_usd: 0,
  monthly_limit_usd: 120,
  supported_model_scopes: ['gpt-5.4'],
  name: '10元包月现已支持5.5',
  description: '参考套餐',
  price: 10,
  original_price: 0,
  validity_days: 1,
  validity_unit: 'month',
  product_name: '/v1/messages\ngpt-5.4',
  features: ['极度的灵活性', '并发上限：5'],
  for_sale: true,
  sort_order: 10,
}

function mountDialog() {
  return mount(PlanEditDialog, {
    props: {
      show: true,
      plan,
      groups: [group],
    },
    global: {
      stubs: {
        BaseDialog: {
          template: '<div><slot /><slot name="footer" /></div>',
        },
        Select: {
          props: ['modelValue', 'options', 'placeholder'],
          template: '<select :value="modelValue"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>',
        },
        Icon: true,
        GroupBadge: true,
      },
    },
  })
}

describe('PlanEditDialog', () => {
  it('labels plan price fields as RMB amounts for administrators', () => {
    expect(zh.payment.admin.price).toBe('套餐价格（人民币）')
    expect(zh.payment.admin.originalPrice).toBe('原价（人民币）')
    expect(en.payment.admin.price).toBe('Plan Price (CNY)')
    expect(en.payment.admin.originalPrice).toBe('Original Price (CNY)')
  })

  it('saves product tags used by the reference-style subscription card', async () => {
    const wrapper = mountDialog()

    const input = wrapper.get('[data-testid="plan-product-name-input"]')
    await input.setValue('/v1/messages\ngpt-5.4\ngpt-5.5')
    await wrapper.get('form').trigger('submit')

    expect(updatePlan).toHaveBeenCalledWith(7, expect.objectContaining({
      product_name: '/v1/messages\ngpt-5.4\ngpt-5.5',
    }))
  })
})
