import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ImageWorkbenchView from '../ImageWorkbenchView.vue'

const getOptions = vi.hoisted(() => vi.fn())
const generateImage = vi.hoisted(() => vi.fn())
const editImage = vi.hoisted(() => vi.fn())
const routeQuery = vi.hoisted(() => ({ key_id: '2' }) as Record<string, unknown>)
const appStore = vi.hoisted(() => ({
  cachedPublicSettings: {
    image_workbench_enabled: true,
    api_base_url: 'https://wawazz.xyz/v1',
  } as Record<string, unknown> | null,
  fetchPublicSettings: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}))

vi.mock('../api', () => ({
  imageWorkbenchAPI: { getOptions, generateImage, editImage },
  getOptions,
  generateImage,
  editImage,
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => appStore,
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: routeQuery }),
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

const optionsPayload = {
  api_keys: [
    {
      id: 1,
      name: '默认 Key',
      masked_key: 'sk-...1111',
      group_name: '普通组',
      group_platform: 'openai',
      quota_remaining: -1,
    },
    {
      id: 2,
      name: '图片 Key',
      masked_key: 'sk-...2222',
      group_name: '图片组',
      group_platform: 'openai',
      quota_remaining: 10,
    },
  ],
  models: [
    {
      name: 'gpt-image-2',
      platform: 'openai',
      pricing: { billing_mode: 'image', per_request_price: 0.02, intervals: [] },
      group_ids: [7],
      available_key_ids: [1, 2],
    },
  ],
  defaults: {
    model: 'gpt-image-2',
    size: '1024x1024',
    quality: 'auto',
    format: 'png',
    count: 1,
    background: 'auto',
    style: 'vivid',
    sizes: ['1024x1024'],
    qualities: ['auto', 'high'],
    formats: ['png', 'webp'],
    backgrounds: ['auto', 'transparent'],
    styles: ['vivid', 'natural'],
  },
}

function mountView() {
  return mount(ImageWorkbenchView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        Icon: true,
      },
    },
  })
}

describe('ImageWorkbenchView', () => {
  beforeEach(() => {
    appStore.cachedPublicSettings = {
      image_workbench_enabled: true,
      api_base_url: 'https://wawazz.xyz/v1',
    }
    appStore.fetchPublicSettings.mockReset().mockResolvedValue(appStore.cachedPublicSettings)
    appStore.showError.mockReset()
    appStore.showSuccess.mockReset()
    routeQuery.key_id = '2'
    getOptions.mockReset().mockResolvedValue(optionsPayload)
    generateImage.mockReset().mockResolvedValue({
      data: [
        { url: 'https://example.test/result.png' },
        { b64_json: 'aW1hZ2U=' },
      ],
    })
    editImage.mockReset()
  })

  it('shows a disabled state without loading options when the feature is off', async () => {
    appStore.cachedPublicSettings = { image_workbench_enabled: false }
    appStore.fetchPublicSettings.mockResolvedValue(appStore.cachedPublicSettings)

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('imageWorkbench.disabledTitle')
    expect(getOptions).not.toHaveBeenCalled()
  })

  it('loads options and preselects key_id from query', async () => {
    const wrapper = mountView()
    await flushPromises()

    const select = wrapper.get('[data-testid="image-workbench-key-select"]')
    expect((select.element as HTMLSelectElement).value).toBe('2')
    expect(wrapper.text()).toContain('gpt-image-2')
    expect(wrapper.text()).not.toContain('sk-real-secret')
  })

  it('renders a standalone studio layout with project gateway and real-key billing guidance', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-testid="image-workbench-studio"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="image-workbench-hero"]').text()).toContain('https://wawazz.xyz/v1')
    expect(wrapper.text()).toContain('imageWorkbench.realKeyBillingHint')
    expect(wrapper.findAll('[data-testid="image-workbench-panel"]').length).toBeGreaterThanOrEqual(5)
  })

  it('submits generation with api_key_id only and previews url/base64 results', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-testid="image-workbench-prompt"]').setValue('高级商业摄影风格的橙色宇航员')
    await wrapper.get('[data-testid="image-workbench-generate"]').trigger('submit')
    await flushPromises()

    expect(generateImage).toHaveBeenCalledTimes(1)
    const payload = generateImage.mock.calls[0][0]
    expect(payload.api_key_id).toBe(2)
    expect(payload.prompt).toContain('橙色宇航员')
    expect(payload).not.toHaveProperty('key')
    expect(payload).not.toHaveProperty('api_key')
    expect(payload).not.toHaveProperty('base_url')
    expect(wrapper.find('img[src="https://example.test/result.png"]').exists()).toBe(true)
    expect(wrapper.find('img[src="data:image/png;base64,aW1hZ2U="]').exists()).toBe(true)
    expect(wrapper.text()).toContain('imageWorkbench.download')
  })

  it('shows clear empty states for missing keys and missing models', async () => {
    getOptions.mockResolvedValueOnce({ ...optionsPayload, api_keys: [] })
    let wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('imageWorkbench.noKeysTitle')

    getOptions.mockResolvedValueOnce({ ...optionsPayload, models: [] })
    wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('imageWorkbench.noModelsTitle')
  })
})
