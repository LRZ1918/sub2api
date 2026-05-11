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

  it('shows the first blocking check as the recommended next step', async () => {
    getLaunchReadiness.mockResolvedValue({
      overall_status: 'blocked',
      completed: 1,
      total: 3,
      generated_at: '2026-05-09T12:00:00Z',
      sections: [
        {
          id: 'deployment',
          title: '公网入口与部署',
          status: 'fail',
          completed: 1,
          total: 2,
          checks: [
            {
              id: 'runtime_health',
              title: '后台运行状态',
              description: '应用进程可用。',
              status: 'pass',
              value: 'handler:ok'
            },
            {
              id: 'https_frontend_url',
              title: '公网 HTTPS 地址',
              description: '生产环境需要配置 HTTPS 域名。',
              status: 'fail',
              value: '未配置',
              action_label: '去系统设置',
              action_path: '/admin/settings'
            }
          ]
        },
        {
          id: 'gateway',
          title: 'Claude/Codex 网关',
          status: 'fail',
          completed: 0,
          total: 1,
          checks: [
            {
              id: 'upstream_accounts',
              title: '上游账号池',
              description: '至少导入一个可用账号。',
              status: 'fail',
              value: '0/0 活跃',
              action_label: '去账号管理',
              action_path: '/admin/accounts'
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

    const nextStep = wrapper.get('[data-testid="launch-next-step"]')
    expect(nextStep.text()).toContain('admin.launchReadiness.nextStep.title')
    expect(nextStep.text()).toContain('公网 HTTPS 地址')
    expect(nextStep.text()).toContain('未配置')
    expect(nextStep.text()).not.toContain('上游账号池')

    const actionButton = nextStep.findAll('button').find((button) => button.text().includes('去系统设置'))
    expect(actionButton).toBeTruthy()

    await actionButton?.trigger('click')

    expect(routerPush).toHaveBeenCalledWith('/admin/settings')
  })

  it('shows an action queue ordered by blocking checks before warnings', async () => {
    getLaunchReadiness.mockResolvedValue({
      overall_status: 'blocked',
      completed: 1,
      total: 5,
      generated_at: '2026-05-09T12:00:00Z',
      sections: [
        {
          id: 'deployment',
          title: '公网入口与部署',
          status: 'fail',
          completed: 1,
          total: 3,
          checks: [
            {
              id: 'runtime_health',
              title: '后台运行状态',
              description: '应用进程可用。',
              status: 'pass',
              value: 'handler:ok'
            },
            {
              id: 'https_frontend_url',
              title: '公网 HTTPS 地址',
              description: '生产环境需要配置 HTTPS 域名。',
              status: 'fail',
              value: '未配置',
              action_label: '去系统设置',
              action_path: '/admin/settings'
            },
            {
              id: 'trusted_proxies',
              title: '可信反代来源',
              description: '生产环境应限制可信代理来源。',
              status: 'warn',
              value: '未限制',
              action_label: '查看部署文档',
              action_path: '/admin/ops'
            }
          ]
        },
        {
          id: 'gateway',
          title: 'Claude/Codex 网关',
          status: 'fail',
          completed: 0,
          total: 2,
          checks: [
            {
              id: 'upstream_accounts',
              title: '上游账号池',
              description: '至少导入一个可用账号。',
              status: 'fail',
              value: '0/0 活跃',
              action_label: '去账号管理',
              action_path: '/admin/accounts'
            },
            {
              id: 'channel_pricing',
              title: '模型计价',
              description: '需要配置模型价格。',
              status: 'warn',
              value: '0 条',
              action_label: '去渠道管理',
              action_path: '/admin/channels'
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

    const queue = wrapper.get('[data-testid="launch-action-queue"]')
    const queueText = queue.text()
    expect(queueText).toContain('admin.launchReadiness.actionQueue.title')
    expect(queueText).toContain('admin.launchReadiness.actionQueue.description')
    expect(queueText).toContain('公网 HTTPS 地址')
    expect(queueText).toContain('上游账号池')
    expect(queueText).toContain('可信反代来源')
    expect(queueText).not.toContain('后台运行状态')
    expect(queueText.indexOf('公网 HTTPS 地址')).toBeLessThan(queueText.indexOf('上游账号池'))
    expect(queueText.indexOf('上游账号池')).toBeLessThan(queueText.indexOf('可信反代来源'))

    const accountsButton = queue.findAll('button').find((button) => button.text().includes('去账号管理'))
    expect(accountsButton).toBeTruthy()
    await accountsButton?.trigger('click')

    expect(routerPush).toHaveBeenCalledWith('/admin/accounts')
  })
})
