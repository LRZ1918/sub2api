import type { CreateChannelRequest } from '@/api/admin/channels'
import type { AdminGroup } from '@/types'

export const REFERENCE_CHANNEL_PRESET_NAME = '参考站 Claude/Codex 网关渠道'

type ReferenceChannelPresetPayload = CreateChannelRequest & {
  status: 'active'
  group_ids: number[]
}

function supportsReferenceCodexModel(group: AdminGroup): boolean {
  const scopes = group.supported_model_scopes || []
  if (scopes.some(scope => scope === 'gpt-5.4' || scope === 'gpt-5.5')) {
    return true
  }
  return /参考套餐|gpt-5\.4|5\.5|codex/i.test(group.name)
}

export function selectReferenceChannelGroups(groups: AdminGroup[]): AdminGroup[] {
  return groups
    .filter(group => group.status === 'active')
    .filter(group => group.platform === 'openai')
    .filter(supportsReferenceCodexModel)
}

export function buildReferenceChannelPresetPayload(groups: AdminGroup[]): ReferenceChannelPresetPayload {
  const selectedGroups = selectReferenceChannelGroups(groups)

  return {
    name: REFERENCE_CHANNEL_PRESET_NAME,
    description: '参考 free.codesonline.dev/purchase 的 Codex/gpt-5.4 渠道预设。请上线前按真实上游成本调整价格和模型映射。',
    status: 'active',
    group_ids: selectedGroups.map(group => group.id),
    billing_model_source: 'channel_mapped',
    restrict_models: false,
    model_mapping: {
      openai: {
        'gpt-5.4': 'gpt-5.4',
        'gpt-5.5': 'gpt-5.4',
        'gpt5.5': 'gpt-5.4',
      },
    },
    model_pricing: [
      {
        platform: 'openai',
        models: ['gpt-5.4', 'gpt-5.5', 'gpt5.5'],
        billing_mode: 'token',
        input_price: 0.000005,
        output_price: 0.00003,
        cache_write_price: null,
        cache_read_price: 0.0000005,
        image_output_price: null,
        per_request_price: null,
        intervals: [],
      },
    ],
    features_config: {
      reference_preset: 'free.codesonline.dev/purchase',
    },
    apply_pricing_to_account_stats: true,
    account_stats_pricing_rules: [],
  }
}
