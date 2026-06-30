import { describe, expect, it } from 'vitest'
import {
  OPENAI_CC_SWITCH_CODEX_MODEL,
  buildCcSwitchImportDeeplink,
  normalizeCcSwitchEndpoint
} from '@/utils/ccswitchImport'
import type { GroupPlatform } from '@/types'

function paramsFromDeeplink(deeplink: string): URLSearchParams {
  const query = deeplink.split('?')[1] || ''
  return new URLSearchParams(query)
}

describe('ccswitchImport utils', () => {
  const baseInput = {
    baseUrl: 'https://api.example.com',
    providerName: 'Sub2API',
    apiKey: 'sk-test',
    usageScript: 'return true'
  }

  it('adds the Codex model parameter for OpenAI imports', () => {
    const params = paramsFromDeeplink(
      buildCcSwitchImportDeeplink({
        ...baseInput,
        platform: 'openai',
        clientType: 'claude'
      })
    )

    expect(params.get('resource')).toBe('provider')
    expect(params.get('app')).toBe('codex')
    expect(params.get('endpoint')).toBe(baseInput.baseUrl)
    expect(params.get('model')).toBe(OPENAI_CC_SWITCH_CODEX_MODEL)
    expect(atob(params.get('usageScript') || '')).toBe(baseInput.usageScript)
  })

  it.each([
    { platform: 'anthropic' as GroupPlatform, clientType: 'claude' as const, app: 'claude' },
    { platform: 'gemini' as GroupPlatform, clientType: 'gemini' as const, app: 'gemini' }
  ])('does not add a model parameter for $platform imports', ({ platform, clientType, app }) => {
    const params = paramsFromDeeplink(
      buildCcSwitchImportDeeplink({
        ...baseInput,
        platform,
        clientType
      })
    )

    expect(params.get('app')).toBe(app)
    expect(params.get('endpoint')).toBe(baseInput.baseUrl)
    expect(params.has('model')).toBe(false)
  })

  it('keeps Antigravity imports on the selected client endpoint without a model parameter', () => {
    const params = paramsFromDeeplink(
      buildCcSwitchImportDeeplink({
        ...baseInput,
        platform: 'antigravity',
        clientType: 'gemini'
      })
    )

    expect(params.get('app')).toBe('gemini')
    expect(params.get('endpoint')).toBe(`${baseInput.baseUrl}/antigravity`)
    expect(params.has('model')).toBe(false)
  })

  it('removes trailing v1 from CC-Switch provider endpoints because clients append API paths', () => {
    expect(normalizeCcSwitchEndpoint('https://wawazz.xyz/v1')).toBe('https://wawazz.xyz')
    expect(normalizeCcSwitchEndpoint('https://wawazz.xyz/v1/')).toBe('https://wawazz.xyz')
    expect(normalizeCcSwitchEndpoint('https://api.example.com')).toBe('https://api.example.com')
  })

  it('imports OpenAI providers with a root endpoint when the public API URL already includes /v1', () => {
    const params = paramsFromDeeplink(
      buildCcSwitchImportDeeplink({
        ...baseInput,
        baseUrl: 'https://wawazz.xyz/v1',
        usageScript: 'fetch("{{baseUrl}}/v1/usage")',
        platform: 'openai',
        clientType: 'claude'
      })
    )

    expect(params.get('endpoint')).toBe('https://wawazz.xyz')
    expect(params.get('homepage')).toBe('https://wawazz.xyz')
    expect(atob(params.get('usageScript') || '')).toBe('fetch("{{baseUrl}}/v1/usage")')
  })
})
