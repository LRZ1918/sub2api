import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import LaunchReadinessView from '../LaunchReadinessView.vue'

const { getLaunchReadiness, routerPush, showError } = vi.hoisted(() => ({
  getLaunchReadiness: vi.fn(),
  routerPush: vi.fn(),
  showError: vi.fn()
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    launchReadiness: {
      getLaunchReadiness
    }
  }
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    showError
  })
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: routerPush
  })
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key
    })
  }
})

describe('admin LaunchReadinessView', () => {
  beforeEach(() => {
    getLaunchReadiness.mockReset()
    routerPush.mockReset()
    showError.mockReset()
  })

  it('loads readiness report and opens action targets from failing checks', async () => {
    getLaunchReadiness.mockResolvedValue({
      overall_status: 'blocked',
      completed: 2,
      total: 4,
      generated_at: '2026-05-07T12:00:00Z',
      sections: [
        {
          id: 'gateway',
          title: 'Claude/Codex 网关',
          status: 'fail',
          completed: 1,
          total: 2,
          checks: [
            {
              id: 'upstream_accounts',
              title: '上游账号池',
              description: '至少导入一个 Claude/Codex 可用账号。',
              status: 'fail',
              value: '0/0 活跃',
              action_label: '去账号管理',
              action_path: '/admin/accounts'
            },
            {
              id: 'groups',
              title: '分组策略',
              description: '至少保留一个活跃分组。',
              status: 'pass',
              value: '1/1 活跃'
            }
          ]
        }
      ]
    })

    const wrapper = mount(LaunchReadinessView, {
      global: {
        stubs: {
          AppLayout: { template: '<div><slot /></div>' },
          LoadingSpinner: true,
          Icon: true
        }
      }
    })

    await flushPromises()

    expect(getLaunchReadiness).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Claude/Codex 网关')
    expect(wrapper.text()).toContain('上游账号池')
    expect(wrapper.text()).toContain('0/0 活跃')

    const actionButton = wrapper.findAll('button').find((button) => button.text().includes('去账号管理'))
    expect(actionButton).toBeTruthy()

    await actionButton?.trigger('click')

    expect(routerPush).toHaveBeenCalledWith('/admin/accounts')
  })
})
