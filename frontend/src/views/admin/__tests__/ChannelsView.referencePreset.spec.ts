import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ChannelsView from '../ChannelsView.vue'
import { REFERENCE_CHANNEL_PRESET_NAME } from '../referenceChannelPreset'

const { channelsList, channelsCreate, groupsGetAll, getWebSearchConfig, showError, showSuccess } = vi.hoisted(() => ({
  channelsList: vi.fn(),
  channelsCreate: vi.fn(),
  groupsGetAll: vi.fn(),
  getWebSearchConfig: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    channels: {
      list: channelsList,
      create: channelsCreate,
    },
    groups: {
      getAll: groupsGetAll,
    },
    settings: {
      getWebSearchEmulationConfig: getWebSearchConfig,
    },
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

describe('ChannelsView reference channel preset', () => {
  beforeEach(() => {
    channelsList.mockReset().mockResolvedValue({ items: [], total: 0 })
    channelsCreate.mockReset().mockResolvedValue({ id: 99 })
    groupsGetAll.mockReset().mockResolvedValue([
      {
        id: 11,
        name: '参考套餐-10元包月现已支持5.5',
        platform: 'openai',
        status: 'active',
        supported_model_scopes: ['gpt-5.4'],
      },
    ])
    getWebSearchConfig.mockReset().mockResolvedValue({ enabled: false, providers: [] })
    showError.mockReset()
    showSuccess.mockReset()
  })

  it('creates a reference channel preset from eligible OpenAI groups', async () => {
    const wrapper = mount(ChannelsView, {
      global: {
        stubs: {
          AppLayout: { template: '<div><slot /></div>' },
          TablePageLayout: {
            template: '<div><slot name="filters" /><slot name="table" /><slot name="pagination" /></div>',
          },
          DataTable: true,
          Pagination: true,
          BaseDialog: true,
          ConfirmDialog: true,
          EmptyState: true,
          Select: true,
          Icon: true,
          PlatformIcon: true,
          Toggle: true,
          PricingEntryCard: true,
        },
      },
    })
    await flushPromises()

    const button = wrapper.get('[data-testid="import-reference-channel-preset"]')
    await button.trigger('click')
    await flushPromises()

    expect(channelsCreate).toHaveBeenCalledWith(expect.objectContaining({
      name: REFERENCE_CHANNEL_PRESET_NAME,
      group_ids: [11],
      billing_model_source: 'channel_mapped',
    }))
    expect(showSuccess).toHaveBeenCalledWith('admin.channels.referencePreset.createSuccess')
  })

  it('does not create a duplicate reference channel preset hidden by the current page', async () => {
    channelsList.mockResolvedValueOnce({
      items: [],
      total: 0,
    })
    channelsList.mockResolvedValueOnce({
      items: [
        {
          id: 1,
          name: REFERENCE_CHANNEL_PRESET_NAME,
          description: '',
          status: 'active',
          group_ids: [11],
          model_pricing: [],
          created_at: '2026-05-09T00:00:00Z',
        },
      ],
      total: 1,
    })

    const wrapper = mount(ChannelsView, {
      global: {
        stubs: {
          AppLayout: { template: '<div><slot /></div>' },
          TablePageLayout: {
            template: '<div><slot name="filters" /><slot name="table" /><slot name="pagination" /></div>',
          },
          DataTable: true,
          Pagination: true,
          BaseDialog: true,
          ConfirmDialog: true,
          EmptyState: true,
          Select: true,
          Icon: true,
          PlatformIcon: true,
          Toggle: true,
          PricingEntryCard: true,
        },
      },
    })
    await flushPromises()

    await wrapper.get('[data-testid="import-reference-channel-preset"]').trigger('click')
    await flushPromises()

    expect(channelsCreate).not.toHaveBeenCalled()
    expect(showError).toHaveBeenCalledWith('admin.channels.referencePreset.alreadyExists')
  })
})
