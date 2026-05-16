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
    features: string
    concurrency: number
    sort_order: number
  }
}

export const referencePurchasePresets: ReferencePurchasePreset[] = [
  {
    group: { name: '15元120刀月卡', rate_multiplier: 0.125, daily_limit_usd: 0, weekly_limit_usd: 0, monthly_limit_usd: 120 },
    plan: {
      name: '15元120刀月卡',
      description: '极度的灵活性',
      price: 15,
      validity_days: 1,
      validity_unit: 'month',
      product_name: '',
      features: '',
      concurrency: 5,
      sort_order: 10,
    },
  },
  {
    group: { name: '150元1300刀月卡', rate_multiplier: 0.115, daily_limit_usd: 300, weekly_limit_usd: 0, monthly_limit_usd: 1300 },
    plan: {
      name: '150元1300刀月卡',
      description: '',
      price: 150,
      validity_days: 1,
      validity_unit: 'month',
      product_name: '',
      features: '',
      concurrency: 30,
      sort_order: 20,
    },
  },
  {
    group: { name: '15元120刀日卡', rate_multiplier: 0.125, daily_limit_usd: 120, weekly_limit_usd: 0, monthly_limit_usd: 0 },
    plan: {
      name: '15元120刀日卡',
      description: '',
      price: 15,
      validity_days: 1,
      validity_unit: 'day',
      product_name: '',
      features: '',
      concurrency: 10,
      sort_order: 30,
    },
  },
  {
    group: { name: '90元900刀周卡', rate_multiplier: 0.1, daily_limit_usd: 300, weekly_limit_usd: 900, monthly_limit_usd: 0 },
    plan: {
      name: '90元900刀周卡',
      description: '',
      price: 90,
      validity_days: 1,
      validity_unit: 'week',
      product_name: '',
      features: '',
      concurrency: 30,
      sort_order: 40,
    },
  },
  {
    group: { name: '300元3000刀月卡', rate_multiplier: 0.1, daily_limit_usd: 300, weekly_limit_usd: 0, monthly_limit_usd: 3000 },
    plan: {
      name: '300元3000刀月卡',
      description: '',
      price: 300,
      validity_days: 1,
      validity_unit: 'month',
      product_name: '',
      features: '',
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
    supported_model_scopes: ['gpt-5.5'],
    allow_messages_dispatch: true,
    default_mapped_model: 'gpt-5.5',
  }
}

export function buildReferencePlanPayload(preset: ReferencePurchasePreset, groupId: number): Record<string, unknown> {
  return {
    group_id: groupId,
    name: preset.plan.name,
    description: preset.plan.description,
    price: preset.plan.price,
    original_price: null,
    validity_days: preset.plan.validity_days,
    validity_unit: preset.plan.validity_unit,
    product_name: preset.plan.product_name,
    features: preset.plan.features,
    for_sale: true,
    sort_order: preset.plan.sort_order,
  }
}
