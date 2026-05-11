<template>
  <div
    class="group flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-lg dark:border-dark-700 dark:bg-dark-900"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <span :class="['inline-flex rounded-full px-2 py-0.5 text-xs font-semibold', badgeLightClass]">
          {{ pLabel }}
        </span>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <h3 class="text-lg font-bold leading-snug text-gray-950 dark:text-white">
            {{ plan.name }}
          </h3>
          <span
            data-testid="plan-validity-badge"
            class="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:bg-dark-800 dark:text-gray-300"
          >
            {{ validityLabel }}
          </span>
        </div>
      </div>
    </div>

    <div v-if="productTags.length > 0" class="mt-3 flex flex-wrap gap-2">
      <span
        v-for="tag in productTags"
        :key="tag"
        class="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-dark-800 dark:text-gray-300"
      >
        {{ tag }}
      </span>
    </div>

    <div class="mt-4 flex items-end gap-1">
      <span class="pb-1 text-lg font-semibold text-gray-500 dark:text-gray-400">¥</span>
      <span class="text-4xl font-extrabold leading-none text-gray-950 dark:text-white">{{ priceText }}</span>
      <span class="pb-1 text-sm text-gray-500 dark:text-gray-400">/{{ validityLabel }}</span>
    </div>

    <p v-if="primaryFeature" class="mt-4 text-sm text-gray-600 dark:text-gray-300">
      {{ primaryFeature }}
    </p>

    <div class="mt-5 grid grid-cols-2 gap-3 text-sm">
      <div
        v-for="metric in metrics"
        :key="metric.label"
        class="rounded-xl bg-gray-50 p-3 dark:bg-dark-800"
      >
        <p class="text-xs text-gray-500 dark:text-gray-400">{{ metric.label }}</p>
        <p class="mt-1 font-semibold text-gray-950 dark:text-white">{{ metric.value }}</p>
      </div>
    </div>

    <div class="flex-1" />

    <button
      type="button"
      :class="['mt-5 w-full rounded-xl py-3 text-sm font-semibold transition active:scale-[0.98]', btnClass]"
      @click="emit('select', plan)"
    >
      {{ isRenewal ? t('payment.subscribeNow') : t('payment.subscribeNow') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SubscriptionPlan } from '@/types/payment'
import type { UserSubscription } from '@/types'
import {
  platformBadgeLightClass,
  platformButtonClass,
  platformLabel,
} from '@/utils/platformColors'

const props = defineProps<{ plan: SubscriptionPlan; activeSubscriptions?: UserSubscription[] }>()
const emit = defineEmits<{ select: [plan: SubscriptionPlan] }>()
const { t } = useI18n()

const platform = computed(() => props.plan.group_platform || '')
const isRenewal = computed(() =>
  props.activeSubscriptions?.some(s => s.group_id === props.plan.group_id && s.status === 'active') ?? false
)
const badgeLightClass = computed(() => platformBadgeLightClass(platform.value))
const btnClass = computed(() => platformButtonClass(platform.value))
const pLabel = computed(() => platformLabel(platform.value))

function formatNumber(value: number | null | undefined, maxFractionDigits = 4): string {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric)) return '0'
  return numeric.toLocaleString('en-US', {
    maximumFractionDigits: maxFractionDigits,
    minimumFractionDigits: 0,
    useGrouping: false,
  })
}

function normalizeUnit(unit: string | undefined): string {
  const value = unit || 'day'
  if (value === 'months') return 'month'
  if (value === 'weeks') return 'week'
  if (value === 'days') return 'day'
  if (value === 'years') return 'year'
  return value
}

function formatValidity(plan: SubscriptionPlan): string {
  const days = plan.validity_days || 1
  const unit = normalizeUnit(plan.validity_unit)
  if (unit === 'month') return `${days}${t('payment.monthUnit')}`
  if (unit === 'week') return `${days}${t('payment.weekUnit')}`
  if (unit === 'year') return `${days}${t('payment.yearUnit')}`
  return `${days}${t('payment.dayUnit')}`
}

function splitTextList(value: string | undefined): string[] {
  return (value || '')
    .split(/[\n,，]/)
    .map(item => item.trim())
    .filter(Boolean)
}

function parseConcurrency(features: string[]): string {
  for (const feature of features) {
    const match = feature.match(/并发上限\s*[:：]\s*(\d+)/)
    if (match) return match[1]
  }
  return ''
}

const productTags = computed(() => {
  const productTags = splitTextList(props.plan.product_name)
  if (productTags.length > 0) return productTags
  return (props.plan.supported_model_scopes || []).map(scope => scope.trim()).filter(Boolean)
})

const displayFeatures = computed(() =>
  (props.plan.features || []).filter(feature => !/并发上限\s*[:：]/.test(feature))
)

const primaryFeature = computed(() => displayFeatures.value[0] || props.plan.description || '')
const priceText = computed(() => formatNumber(props.plan.price, 2))
const validityLabel = computed(() => formatValidity(props.plan))
const systemRate = computed(() => `${formatNumber(props.plan.rate_multiplier ?? 1)}x`)
const quotaBase = computed(() => {
  const values = [
    props.plan.daily_limit_usd,
    props.plan.weekly_limit_usd,
    props.plan.monthly_limit_usd,
  ].filter((value): value is number => typeof value === 'number' && value > 0)
  return values.length > 0 ? Math.max(...values) : 0
})
const packageRate = computed(() => quotaBase.value > 0 ? `${formatNumber(props.plan.price / quotaBase.value)}x` : '-')
const concurrency = computed(() => parseConcurrency(props.plan.features || []))

const metrics = computed(() => {
  const rows = [
    { label: t('payment.planCard.systemRate'), value: systemRate.value },
    { label: t('payment.planCard.packageRate'), value: packageRate.value },
  ]
  if (concurrency.value) {
    rows.push({ label: t('payment.planCard.concurrency'), value: concurrency.value })
  }
  rows.push(
    { label: t('payment.planCard.dailyLimit'), value: `$${formatNumber(props.plan.daily_limit_usd ?? 0, 2)}` },
    { label: t('payment.planCard.weeklyLimit'), value: `$${formatNumber(props.plan.weekly_limit_usd ?? 0, 2)}` },
    { label: t('payment.planCard.monthlyLimit'), value: `$${formatNumber(props.plan.monthly_limit_usd ?? 0, 2)}` },
  )
  return rows
})
</script>
