import { describe, expect, it } from 'vitest'
import {
  buildReferenceGroupPayload,
  buildReferencePlanPayload,
  referencePurchasePresets,
} from '../referencePurchasePresets'

describe('referencePurchasePresets', () => {
  it('defines the same five subscription plans as the reference purchase page', () => {
    expect(referencePurchasePresets.map(plan => plan.plan.name)).toEqual([
      '10元包月现已支持5.5',
      '日卡1现已支持5.5',
      '月卡2现已支持5.5',
      '周卡现已支持5.5',
      '200包月，现已支持5.5',
    ])
    expect(referencePurchasePresets.map(plan => plan.plan.price)).toEqual([10, 9.9, 99, 59.9, 200])
    expect(referencePurchasePresets.map(plan => plan.group.monthly_limit_usd ?? 0)).toEqual([120, 0, 1300, 0, 2857])
    expect(referencePurchasePresets.map(plan => plan.group.weekly_limit_usd ?? 0)).toEqual([0, 0, 0, 900, 0])
    expect(referencePurchasePresets.map(plan => plan.group.daily_limit_usd ?? 0)).toEqual([0, 120, 0, 0, 0])
    expect(referencePurchasePresets.map(plan => plan.group.name)).toEqual([
      '10元包月现已支持5.5',
      '日卡订阅1现已支持5.5',
      '月卡2现已支持5.5',
      '周卡订阅现已支持5.5',
      '月卡（200包月）现已支持5.5',
    ])
    expect(referencePurchasePresets.map(plan => plan.group.rate_multiplier)).toEqual([0.083, 0.083, 0.077, 0.067, 0.07])
  })

  it('builds admin group and plan payloads that can reproduce the reference cards', () => {
    const preset = referencePurchasePresets[0]

    expect(buildReferenceGroupPayload(preset)).toMatchObject({
      name: '10元包月现已支持5.5',
      platform: 'openai',
      rate_multiplier: 0.083,
      subscription_type: 'subscription',
      monthly_limit_usd: 120,
      supported_model_scopes: ['gpt-5.4'],
      allow_messages_dispatch: true,
      default_mapped_model: 'gpt-5.4',
    })

    expect(buildReferencePlanPayload(preset, 42)).toMatchObject({
      group_id: 42,
      name: '10元包月现已支持5.5',
      price: 10,
      validity_days: 1,
      validity_unit: 'month',
      product_name: '',
      features: '极度的灵活性\n并发上限：5',
      for_sale: true,
      sort_order: 10,
    })
  })
})
