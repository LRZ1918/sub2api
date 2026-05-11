import { describe, expect, it } from 'vitest'
import type { AdminGroup } from '@/types'
import {
  REFERENCE_CHANNEL_PRESET_NAME,
  buildReferenceChannelPresetPayload,
  selectReferenceChannelGroups,
} from '../referenceChannelPreset'

function group(overrides: Partial<AdminGroup>): AdminGroup {
  return {
    id: 1,
    name: '参考套餐-10元包月现已支持5.5',
    description: '',
    platform: 'openai',
    status: 'active',
    rate_multiplier: 0.1,
    account_count: 0,
    active_account_count: 0,
    sort_order: 0,
    is_exclusive: false,
    is_default: false,
    created_at: '2026-05-09T00:00:00Z',
    updated_at: '2026-05-09T00:00:00Z',
    supported_model_scopes: ['gpt-5.4'],
    ...overrides,
  } as AdminGroup
}

describe('referenceChannelPreset', () => {
  it('selects active OpenAI reference groups for the preset channel', () => {
    const selected = selectReferenceChannelGroups([
      group({ id: 1, name: '参考套餐-10元包月现已支持5.5' }),
      group({ id: 2, name: '普通 Claude 分组', platform: 'anthropic' }),
      group({ id: 3, name: '停用 OpenAI 分组', status: 'inactive' }),
      group({ id: 4, name: 'OpenAI gpt-5.4 内测组', supported_model_scopes: ['gpt-5.4'] }),
    ])

    expect(selected.map(item => item.id)).toEqual([1, 4])
  })

  it('builds a ready-to-save channel payload with gpt-5.4 pricing and mappings', () => {
    const payload = buildReferenceChannelPresetPayload([
      group({ id: 11 }),
      group({ id: 12, name: '月卡2现已支持5.5', supported_model_scopes: ['gpt-5.4'] }),
    ])

    expect(payload.name).toBe(REFERENCE_CHANNEL_PRESET_NAME)
    expect(payload.group_ids).toEqual([11, 12])
    expect(payload.status).toBe('active')
    expect(payload.restrict_models).toBe(false)
    expect(payload.billing_model_source).toBe('channel_mapped')
    expect(payload.model_mapping).toEqual({
      openai: {
        'gpt-5.4': 'gpt-5.4',
        'gpt-5.5': 'gpt-5.4',
        'gpt5.5': 'gpt-5.4',
      },
    })
    expect(payload.model_pricing).toEqual([
      expect.objectContaining({
        platform: 'openai',
        models: ['gpt-5.4', 'gpt-5.5', 'gpt5.5'],
        billing_mode: 'token',
        input_price: 0.000005,
        output_price: 0.00003,
        cache_read_price: 0.0000005,
      }),
    ])
  })

  it('returns an empty group list when no eligible OpenAI group exists', () => {
    const payload = buildReferenceChannelPresetPayload([
      group({ id: 20, platform: 'anthropic', name: 'Claude 分组' }),
    ])

    expect(payload.group_ids).toEqual([])
  })
})
