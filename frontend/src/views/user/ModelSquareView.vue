<template>
  <AppLayout>
    <div v-if="modelSquareDisabled" class="mx-auto max-w-3xl">
      <div class="card px-6 py-16 text-center">
        <div
          class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-dark-800 dark:text-dark-300"
        >
          <Icon name="infoCircle" size="lg" />
        </div>
        <h2 class="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('modelSquare.disabledTitle') }}
        </h2>
        <p class="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-500 dark:text-dark-400">
          {{ t('modelSquare.disabledDesc') }}
        </p>
      </div>
    </div>

    <div v-else class="mx-auto max-w-6xl space-y-5">
      <section class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-dark-700 dark:bg-dark-900">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p class="text-lg font-semibold text-primary-600 dark:text-primary-400">✧</p>
            <h1 class="mt-1 text-2xl font-bold tracking-normal text-gray-950 dark:text-white">
              {{ t('modelSquare.title') }}
            </h1>
            <p class="mt-2 text-sm text-gray-500 dark:text-dark-400">
              {{ t('modelSquare.description') }}
            </p>
          </div>
          <button class="btn btn-secondary" :disabled="loading" @click="loadModels">
            <Icon name="refresh" size="sm" :class="loading ? 'animate-spin' : ''" />
            {{ t('common.refresh') }}
          </button>
        </div>

        <div class="mt-5 grid gap-3 md:grid-cols-[minmax(0,180px)_minmax(0,180px)_1fr_auto]">
          <label class="block text-sm">
            <span class="mb-1 block text-xs font-medium text-gray-500 dark:text-dark-400">
              {{ t('modelSquare.providerFilter') }}
            </span>
            <select v-model="providerFilter" class="input">
              <option value="all">{{ t('modelSquare.allProviders') }}</option>
              <option v-for="provider in providerOptions" :key="provider" :value="provider">
                {{ provider }}
              </option>
            </select>
          </label>

          <label class="block text-sm">
            <span class="mb-1 block text-xs font-medium text-gray-500 dark:text-dark-400">
              {{ t('modelSquare.typeFilter') }}
            </span>
            <select v-model="typeFilter" class="input">
              <option value="all">{{ t('modelSquare.allTypes') }}</option>
              <option v-for="type in typeOptions" :key="type" :value="type">
                {{ billingModeLabel(type) }}
              </option>
            </select>
          </label>

          <label class="block text-sm">
            <span class="mb-1 block text-xs font-medium text-gray-500 dark:text-dark-400">
              {{ t('modelSquare.modelName') }}
            </span>
            <input
              v-model="searchQuery"
              data-testid="model-square-search"
              type="text"
              class="input"
              :placeholder="t('modelSquare.searchPlaceholder')"
            />
          </label>

          <div class="flex items-end">
            <span class="inline-flex h-10 items-center rounded-md border border-gray-200 px-3 text-sm font-medium text-gray-600 dark:border-dark-700 dark:text-dark-300">
              {{ t('modelSquare.gridLabel') }} · {{ t('modelSquare.availableModelsCount', { count: filteredModels.length }) }}
            </span>
          </div>
        </div>
      </section>

      <p class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
        {{ t('modelSquare.billingNotice') }}
      </p>

      <div v-if="loading" class="card py-16 text-center">
        <Icon name="refresh" size="lg" class="inline-block animate-spin text-gray-400" />
      </div>

      <div v-else-if="filteredModels.length === 0" class="card py-16 text-center">
        <Icon name="inbox" size="xl" class="mx-auto mb-3 h-12 w-12 text-gray-400" />
        <p class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('modelSquare.empty') }}</p>
        <p class="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-500 dark:text-gray-400">
          {{ t('modelSquare.emptyDesc') }}
        </p>
      </div>

      <div v-else class="grid gap-4 lg:grid-cols-2">
        <article
          v-for="model in filteredModels"
          :key="model.id"
          class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-dark-700 dark:bg-dark-900"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span
                :class="[
                  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium uppercase',
                  platformBadgeClass(model.platform),
                ]"
              >
                <PlatformIcon :platform="model.platform as GroupPlatform" size="xs" />
                {{ model.platform }}
              </span>
              <h2 class="mt-3 break-all text-xl font-semibold text-gray-950 dark:text-white">
                {{ model.name }}
              </h2>
            </div>
            <span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
              ● {{ t('modelSquare.available') }}
            </span>
          </div>

          <div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div v-for="price in priceRows(model)" :key="price.label" class="rounded-md bg-gray-50 p-3 dark:bg-dark-800">
              <p class="text-xs text-gray-500 dark:text-dark-400">{{ price.label }}</p>
              <p class="mt-1 text-lg font-semibold text-gray-950 dark:text-white">{{ price.value }}</p>
              <p class="text-xs text-gray-400">{{ price.unit }}</p>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <span
              v-for="feature in model.features"
              :key="feature"
              class="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 dark:border-dark-700 dark:text-dark-300"
            >
              {{ feature }}
            </span>
          </div>

          <div class="mt-5">
            <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-dark-400">
              {{ t('modelSquare.availableGroupsCount', { count: model.groups.length }) }}
            </p>
            <div class="mt-2 flex flex-wrap gap-1.5">
              <GroupBadge
                v-for="group in model.groups"
                :key="group.id"
                :name="group.name"
                :platform="group.platform as GroupPlatform"
                :subscription-type="(group.subscription_type || 'standard') as SubscriptionType"
                :rate-multiplier="group.rate_multiplier"
                :user-rate-multiplier="userGroupRates[group.id] ?? null"
                always-show-rate
              />
            </div>
          </div>
        </article>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import PlatformIcon from '@/components/common/PlatformIcon.vue'
import GroupBadge from '@/components/common/GroupBadge.vue'
import userChannelsAPI, {
  type UserAvailableChannel,
  type UserAvailableGroup,
  type UserSupportedModelPricing,
} from '@/api/channels'
import userGroupsAPI from '@/api/groups'
import { useAppStore } from '@/stores/app'
import type { BillingMode } from '@/constants/channel'
import type { GroupPlatform, SubscriptionType } from '@/types'
import { platformBadgeClass } from '@/utils/platformColors'
import { extractApiErrorMessage } from '@/utils/apiError'

interface ModelSquareItem {
  id: string
  name: string
  platform: string
  billingMode: BillingMode | 'unknown'
  pricing: UserSupportedModelPricing | null
  groups: UserAvailableGroup[]
  features: string[]
}

const { t } = useI18n()
const appStore = useAppStore()

const channels = ref<UserAvailableChannel[]>([])
const userGroupRates = ref<Record<number, number>>({})
const loading = ref(false)
const providerFilter = ref('all')
const typeFilter = ref('all')
const searchQuery = ref('')

const modelSquareDisabled = computed(
  () => appStore.cachedPublicSettings?.available_channels_enabled === false,
)

const modelItems = computed(() => buildModelSquareItems(channels.value))

const providerOptions = computed(() => {
  return Array.from(new Set(modelItems.value.map((item) => item.platform))).sort()
})

const typeOptions = computed(() => {
  return Array.from(new Set(modelItems.value.map((item) => item.billingMode))).sort()
})

const filteredModels = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return modelItems.value.filter((item) => {
    if (providerFilter.value !== 'all' && item.platform !== providerFilter.value) return false
    if (typeFilter.value !== 'all' && item.billingMode !== typeFilter.value) return false
    if (query && !item.name.toLowerCase().includes(query)) return false
    return true
  })
})

function buildModelSquareItems(input: UserAvailableChannel[]): ModelSquareItem[] {
  const byModel = new Map<string, ModelSquareItem>()

  for (const channel of input) {
    for (const section of channel.platforms) {
      for (const model of section.supported_models) {
        const platform = model.platform || section.platform
        const key = `${platform}:${model.name}`
        const existing = byModel.get(key)
        const groups = mergeGroups(existing?.groups ?? [], section.groups)
        const pricing = existing?.pricing ?? model.pricing
        byModel.set(key, {
          id: key,
          name: model.name,
          platform,
          billingMode: pricing?.billing_mode ?? 'unknown',
          pricing,
          groups,
          features: buildFeatureTags(platform, pricing),
        })
      }
    }
  }

  return Array.from(byModel.values()).sort((a, b) => {
    const providerCompare = a.platform.localeCompare(b.platform)
    if (providerCompare !== 0) return providerCompare
    return a.name.localeCompare(b.name)
  })
}

function mergeGroups(current: UserAvailableGroup[], next: UserAvailableGroup[]): UserAvailableGroup[] {
  const byID = new Map<number, UserAvailableGroup>()
  for (const group of current) byID.set(group.id, group)
  for (const group of next) byID.set(group.id, group)
  return Array.from(byID.values()).sort((a, b) => a.name.localeCompare(b.name))
}

function buildFeatureTags(platform: string, pricing: UserSupportedModelPricing | null): string[] {
  const tags = [platform, pricing ? billingModeLabel(pricing.billing_mode) : t('availableChannels.noPricing')]
  if (pricing?.input_price !== null || pricing?.output_price !== null) tags.push('token')
  if (pricing?.cache_read_price !== null || pricing?.cache_write_price !== null) tags.push('cache')
  if (pricing?.image_output_price !== null) tags.push('image')
  if (pricing?.per_request_price !== null) tags.push('request')
  if ((pricing?.intervals?.length ?? 0) > 0) tags.push('tiered')
  return Array.from(new Set(tags))
}

function billingModeLabel(mode: BillingMode | 'unknown'): string {
  if (mode === 'token') return t('availableChannels.pricing.billingModeToken')
  if (mode === 'per_request') return t('availableChannels.pricing.billingModePerRequest')
  if (mode === 'image') return t('availableChannels.pricing.billingModeImage')
  return t('availableChannels.noPricing')
}

function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(value)}`
}

function priceRows(model: ModelSquareItem) {
  const pricing = model.pricing
  const tokenUnit = t('modelSquare.unitPerMillionTokens')
  return [
    {
      label: t('modelSquare.inputPrice'),
      value: formatPrice(pricing?.input_price),
      unit: tokenUnit,
    },
    {
      label: t('modelSquare.outputPrice'),
      value: formatPrice(pricing?.output_price),
      unit: tokenUnit,
    },
    {
      label: t('modelSquare.cacheReadPrice'),
      value: formatPrice(pricing?.cache_read_price),
      unit: tokenUnit,
    },
    {
      label: t('modelSquare.cacheWritePrice'),
      value: formatPrice(pricing?.cache_write_price),
      unit: tokenUnit,
    },
  ]
}

async function loadModels() {
  if (modelSquareDisabled.value) return
  loading.value = true
  try {
    const [list, rates] = await Promise.all([
      userChannelsAPI.getAvailable(),
      userGroupsAPI.getUserGroupRates().catch((err: unknown) => {
        console.error('Failed to load user group rates:', err)
        return {} as Record<number, number>
      }),
    ])
    channels.value = list
    userGroupRates.value = rates
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t('common.error')))
  } finally {
    loading.value = false
  }
}

async function initializeModelSquare() {
  try {
    await appStore.fetchPublicSettings()
  } catch (err) {
    console.error('Failed to refresh public settings:', err)
  }
  if (!modelSquareDisabled.value) {
    await loadModels()
  }
}

onMounted(() => {
  void initializeModelSquare()
})
</script>
