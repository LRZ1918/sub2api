import { describe, expect, it } from 'vitest'
import {
  buildReferenceGroupPayload,
  buildReferencePlanPayload,
  referencePurchasePresets,
} from '../referencePurchasePresets'

describe('referencePurchasePresets', () => {
  it('defines the same five subscription plans as the reference purchase page', () => {
    expect(referencePurchasePresets.map(plan => plan.plan.name)).toEqual([
      '15元120刀月卡',
      '150元1300刀月卡',
      '15元120刀日卡',
      '90元900刀周卡',
      '300元3000刀月卡',
    ])
    expect(referencePurchasePresets.map(plan => plan.plan.price)).toEqual([15, 150, 15, 90, 300])
    expect(referencePurchasePresets.map(plan => plan.group.monthly_limit_usd ?? 0)).toEqual([120, 1300, 0, 0, 3000])
    expect(referencePurchasePresets.map(plan => plan.group.weekly_limit_usd ?? 0)).toEqual([0, 0, 0, 900, 0])
    expect(referencePurchasePresets.map(plan => plan.group.daily_limit_usd ?? 0)).toEqual([0, 300, 120, 300, 300])
    expect(referencePurchasePresets.map(plan => plan.group.name)).toEqual([
      '15元120刀月卡',
      '150元1300刀月卡',
      '15元120刀日卡',
      '90元900刀周卡',
      '300元3000刀月卡',
    ])
    expect(referencePurchasePresets.map(plan => plan.group.rate_multiplier)).toEqual([0.125, 0.115, 0.125, 0.1, 0.1])
    expect(referencePurchasePresets.map(plan => plan.plan.product_name)).toEqual(['', '', '', '', ''])
    expect(referencePurchasePresets.map(plan => plan.plan.features)).toEqual(['', '', '', '', ''])
  })

  it('builds admin group and plan payloads that can reproduce the reference cards', () => {
    const preset = referencePurchasePresets[0]

    expect(buildReferenceGroupPayload(preset)).toMatchObject({
      name: '15元120刀月卡',
      platform: 'openai',
      rate_multiplier: 0.125,
      subscription_type: 'subscription',
      monthly_limit_usd: 120,
      supported_model_scopes: ['gpt-5.5'],
      allow_messages_dispatch: true,
      default_mapped_model: 'gpt-5.5',
    })

    expect(buildReferencePlanPayload(preset, 42)).toMatchObject({
      group_id: 42,
      name: '15元120刀月卡',
      description: '极度的灵活性',
      price: 15,
      original_price: null,
      validity_days: 1,
      validity_unit: 'month',
      product_name: '',
      features: '',
      for_sale: true,
      sort_order: 10,
    })
  })
})
