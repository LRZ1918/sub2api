import type { CreateGroupRequest } from '@/types'

interface ReferencePurchasePreset {
  group: {
    name: string
    rate_multiplier: number
    daily_limit_usd: number | null
    weekly_limit_usd: number | null
    monthly_limit_usd: number | null
  }
  plan: {
    name: string
    description: string
    price: number
    validity_days: number
    validity_unit: string
    product_name: string
    primary_feature?: string
    concurrency: number
    sort_order: number
  }
}

export const referencePurchasePresets: ReferencePurchasePreset[] = [
  {
    group: { name: '10元包月现已支持5.5', rate_multiplier: 0.083, daily_limit_usd: 0, weekly_limit_usd: 0, monthly_limit_usd: 120 },
    plan: {
      name: '10元包月现已支持5.5',
      description: '极度的灵活性',
      price: 10,
      validity_days: 1,
      validity_unit: 'month',
      product_name: '',
      primary_feature: '极度的灵活性',
      concurrency: 5,
      sort_order: 10,
    },
  },
  {
    group: { name: '日卡订阅1现已支持5.5', rate_multiplier: 0.083, daily_limit_usd: 120, weekly_limit_usd: 0, monthly_limit_usd: 0 },
    plan: {
      name: '日卡1现已支持5.5',
      description: '',
      price: 9.9,
      validity_days: 1,
      validity_unit: 'day',
      product_name: '',
      concurrency: 10,
      sort_order: 20,
    },
  },
  {
    group: { name: '月卡2现已支持5.5', rate_multiplier: 0.077, daily_limit_usd: 0, weekly_limit_usd: 0, monthly_limit_usd: 1300 },
    plan: {
      name: '月卡2现已支持5.5',
      description: '',
      price: 99,
      validity_days: 1,
      validity_unit: 'month',
      product_name: '',
      concurrency: 30,
      sort_order: 30,
    },
  },
  {
    group: { name: '周卡订阅现已支持5.5', rate_multiplier: 0.067, daily_limit_usd: 0, weekly_limit_usd: 900, monthly_limit_usd: 0 },
    plan: {
      name: '周卡现已支持5.5',
      description: '',
      price: 59.9,
      validity_days: 1,
      validity_unit: 'week',
      product_name: '',
      concurrency: 30,
      sort_order: 40,
    },
  },
  {
    group: { name: '月卡（200包月）现已支持5.5', rate_multiplier: 0.07, daily_limit_usd: 0, weekly_limit_usd: 0, monthly_limit_usd: 2857 },
    plan: {
      name: '200包月，现已支持5.5',
      description: '',
      price: 200,
      validity_days: 1,
      validity_unit: 'month',
      product_name: '',
      concurrency: 30,
      sort_order: 50,
    },
  },
]

export function buildReferenceGroupPayload(preset: ReferencePurchasePreset): CreateGroupRequest {
  return {
    name: preset.group.name,
    description: '按参考站购买页接口整理的套餐分组预设，可按实际上游成本继续调整。',
    platform: 'openai',
    rate_multiplier: preset.group.rate_multiplier,
    is_exclusive: false,
    subscription_type: 'subscription',
    daily_limit_usd: preset.group.daily_limit_usd,
    weekly_limit_usd: preset.group.weekly_limit_usd,
    monthly_limit_usd: preset.group.monthly_limit_usd,
    supported_model_scopes: ['gpt-5.4'],
    allow_messages_dispatch: true,
    default_mapped_model: 'gpt-5.4',
  }
}

export function buildReferencePlanPayload(preset: ReferencePurchasePreset, groupId: number): Record<string, unknown> {
  const features = [
    preset.plan.primary_feature,
    `并发上限：${preset.plan.concurrency}`,
  ].filter(Boolean).join('\n')

  return {
    group_id: groupId,
    name: preset.plan.name,
    description: preset.plan.description,
    price: preset.plan.price,
    original_price: 0,
    validity_days: preset.plan.validity_days,
    validity_unit: preset.plan.validity_unit,
    product_name: preset.plan.product_name,
    features,
    for_sale: true,
    sort_order: preset.plan.sort_order,
  }
}
