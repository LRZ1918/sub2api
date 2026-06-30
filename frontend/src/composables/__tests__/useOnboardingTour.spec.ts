import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useOnboardingTour } from '../useOnboardingTour'

const drive = vi.hoisted(() => vi.fn())
const destroy = vi.hoisted(() => vi.fn())
const driverMock = vi.hoisted(() => vi.fn(() => ({
  drive,
  destroy,
  isActive: vi.fn(() => false),
  getActiveIndex: vi.fn(() => 0),
  getActiveElement: vi.fn(() => null),
  moveNext: vi.fn(),
  movePrevious: vi.fn(),
})))
const getAdminSteps = vi.hoisted(() => vi.fn(() => [{ popover: { title: 'admin', description: 'admin' } }]))
const getUserSteps = vi.hoisted(() => vi.fn(() => [{ popover: { title: 'user', description: 'user' } }]))
const authState = vi.hoisted(() => ({
  user: { id: 7, role: 'user' },
  isSimpleMode: false,
}))
const appState = vi.hoisted(() => ({
  publicSettingsLoaded: true,
  cachedPublicSettings: {
    payment_enabled: true,
    purchase_subscription_enabled: false,
    available_channels_enabled: true,
    api_base_url: 'https://api.example.com',
    custom_endpoints: [],
  },
  fetchPublicSettings: vi.fn().mockResolvedValue(null),
}))
const onboardingState = vi.hoisted(() => ({
  driverInstance: null as unknown,
  setControlMethods: vi.fn(),
  clearControlMethods: vi.fn(),
  getDriverInstance: vi.fn(() => onboardingState.driverInstance),
  setDriverInstance: vi.fn((driver: unknown) => {
    onboardingState.driverInstance = driver
  }),
  isDriverActive: vi.fn(() => false),
}))

vi.mock('driver.js', () => ({
  driver: driverMock,
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authState,
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => appState,
}))

vi.mock('@/stores/onboarding', () => ({
  useOnboardingStore: () => onboardingState,
}))

vi.mock('@/components/Guide/steps', () => ({
  getAdminSteps,
  getUserSteps,
}))

const Harness = defineComponent({
  setup() {
    useOnboardingTour({ storageKey: 'user_guide', autoStart: true })
    return () => h('div')
  },
})

describe('useOnboardingTour', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    drive.mockClear()
    destroy.mockClear()
    driverMock.mockClear()
    getAdminSteps.mockClear()
    getUserSteps.mockClear()
    appState.fetchPublicSettings.mockClear()
    onboardingState.driverInstance = null
    onboardingState.setControlMethods.mockClear()
    onboardingState.clearControlMethods.mockClear()
    onboardingState.getDriverInstance.mockClear()
    onboardingState.setDriverInstance.mockClear()
    onboardingState.isDriverActive.mockClear()
    authState.user = { id: 7, role: 'user' }
    authState.isSimpleMode = false
    appState.publicSettingsLoaded = true
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('auto-starts the user onboarding tour for regular users in standard mode', async () => {
    mount(Harness)

    await nextTick()
    await vi.advanceTimersByTimeAsync(1000)

    expect(getUserSteps).toHaveBeenCalledWith(expect.any(Function), {
      settings: appState.cachedPublicSettings,
      simpleMode: false,
    })
    expect(getAdminSteps).not.toHaveBeenCalled()
    expect(driverMock).toHaveBeenCalled()
    expect(drive).toHaveBeenCalledWith(0)
  })

  it('auto-starts the admin onboarding tour for administrators', async () => {
    authState.user = { id: 1, role: 'admin' }

    mount(Harness)

    await nextTick()
    await vi.advanceTimersByTimeAsync(1000)

    expect(getAdminSteps).toHaveBeenCalledWith(expect.any(Function), false)
    expect(getUserSteps).not.toHaveBeenCalled()
    expect(driverMock).toHaveBeenCalled()
    expect(drive).toHaveBeenCalledWith(0)
  })

  it('does not auto-start onboarding in simple mode', async () => {
    authState.isSimpleMode = true

    mount(Harness)

    await nextTick()
    await vi.advanceTimersByTimeAsync(1000)

    expect(getAdminSteps).not.toHaveBeenCalled()
    expect(getUserSteps).not.toHaveBeenCalled()
    expect(driverMock).not.toHaveBeenCalled()
    expect(drive).not.toHaveBeenCalled()
  })

  it('waits for public settings before building the user tour', async () => {
    appState.publicSettingsLoaded = false

    mount(Harness)

    await nextTick()
    await vi.advanceTimersByTimeAsync(1000)

    expect(appState.fetchPublicSettings).toHaveBeenCalled()
    expect(getUserSteps).toHaveBeenCalledWith(expect.any(Function), {
      settings: appState.cachedPublicSettings,
      simpleMode: false,
    })
  })
})
