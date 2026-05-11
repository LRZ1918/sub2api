import { shallowMount, flushPromises } from '@vue/test-utils'
import AdminPaymentPlansView from '../AdminPaymentPlansView.vue'
import { adminPaymentAPI } from '@/api/admin/payment'
import adminAPI from '@/api/admin'

vi.mock('@/api/admin/payment', () => ({
  adminPaymentAPI: {
    getPlans: vi.fn(),
    updatePlan: vi.fn(),
    createPlan: vi.fn(),
    deletePlan: vi.fn(),
  },
}))

vi.mock('@/api/admin', () => ({
  default: {
    groups: {
      getAll: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
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

describe('AdminPaymentPlansView', () => {
  beforeEach(() => {
    vi.mocked(adminAPI.groups.getAll).mockResolvedValue([])
    vi.mocked(adminPaymentAPI.getPlans).mockResolvedValue({
      data: [
        {
          id: 1,
          group_id: 10,
          group_name: '月卡分组',
          group_platform: 'openai',
          name: '月卡',
          description: '',
          price: 9.9,
          original_price: 19.9,
          validity_days: 1,
          validity_unit: 'month',
          rate_multiplier: 0.083,
          daily_limit_usd: null,
          weekly_limit_usd: null,
          monthly_limit_usd: 120,
          features: [],
          sort_order: 1,
          for_sale: true,
        },
      ],
    } as never)
  })

  it('shows plan prices in RMB to match the user purchase flow', async () => {
    const wrapper = shallowMount(AdminPaymentPlansView, {
      global: {
        stubs: {
          AppLayout: { template: '<div><slot /></div>' },
          DataTable: {
            props: ['data'],
            template: '<div><slot v-if="data.length" name="cell-price" :value="data[0].price" :row="data[0]" /></div>',
          },
          PlanEditDialog: true,
          ConfirmDialog: true,
          Icon: true,
          GroupBadge: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('¥9.90')
    expect(wrapper.text()).toContain('¥19.90')
    expect(wrapper.text()).not.toContain('$9.90')
  })
})
