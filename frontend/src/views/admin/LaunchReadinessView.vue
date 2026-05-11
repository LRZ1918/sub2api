<template>
  <AppLayout>
    <div class="space-y-6 pb-12">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div class="max-w-3xl">
          <p class="text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400">
            {{ t('admin.launchReadiness.eyebrow') }}
          </p>
          <h1 class="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {{ t('admin.launchReadiness.title') }}
          </h1>
          <p class="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
            {{ t('admin.launchReadiness.description') }}
          </p>
        </div>

        <button
          type="button"
          class="btn btn-secondary inline-flex items-center justify-center gap-2 self-start"
          :disabled="refreshing"
          @click="fetchReport"
        >
          <Icon name="refresh" size="sm" :class="refreshing ? 'animate-spin' : ''" />
          <span>{{ t('common.refresh') }}</span>
        </button>
      </div>

      <div v-if="loading && !report" class="flex items-center justify-center py-16">
        <LoadingSpinner />
      </div>

      <div
        v-else-if="loadError && !report"
        class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-300"
      >
        {{ loadError }}
      </div>

      <template v-else-if="report">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div class="card p-5">
            <div class="flex items-center gap-3">
              <div :class="['rounded-lg p-2', overallTone.iconWrap]">
                <Icon :name="overallTone.icon" size="lg" :class="overallTone.iconColor" :stroke-width="2" />
              </div>
              <div class="min-w-0">
                <p class="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {{ t('admin.launchReadiness.overallStatus') }}
                </p>
                <p :class="['mt-1 text-lg font-semibold', overallTone.textColor]">
                  {{ t(overallTone.labelKey) }}
                </p>
              </div>
            </div>
          </div>

          <div class="card p-5">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400">
              {{ t('admin.launchReadiness.completedChecks') }}
            </p>
            <div class="mt-3 flex items-end justify-between gap-4">
              <p class="text-2xl font-bold text-gray-900 dark:text-white">
                {{ report.completed }}/{{ report.total }}
              </p>
              <p class="text-sm font-semibold text-primary-600 dark:text-primary-400">
                {{ completionPercent }}%
              </p>
            </div>
            <div class="mt-3 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-dark-700">
              <div class="h-full rounded-full bg-primary-500 transition-all" :style="{ width: `${completionPercent}%` }"></div>
            </div>
          </div>

          <div class="card p-5">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400">
              {{ t('admin.launchReadiness.generatedAt') }}
            </p>
            <p class="mt-3 text-base font-semibold text-gray-900 dark:text-white">
              {{ formatDateTime(report.generated_at) }}
            </p>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('admin.launchReadiness.generatedHint') }}
            </p>
          </div>
        </div>

        <div
          v-if="recommendedNextStep"
          data-testid="launch-next-step"
          class="card border-l-4 border-primary-500 p-5"
        >
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div class="min-w-0">
              <p class="text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400">
                {{ t('admin.launchReadiness.nextStep.title') }}
              </p>
              <h2 class="mt-2 text-base font-semibold text-gray-900 dark:text-white">
                {{ recommendedNextStep.title }}
              </h2>
              <p class="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-400">
                {{ recommendedNextStep.description }}
              </p>
              <p
                v-if="recommendedNextStep.value"
                class="mt-2 inline-flex rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-dark-700 dark:text-gray-300"
              >
                {{ recommendedNextStep.value }}
              </p>
            </div>
            <button
              v-if="recommendedNextStep.action_path && recommendedNextStep.action_label"
              type="button"
              class="btn btn-primary inline-flex shrink-0 items-center justify-center gap-2 self-start"
              @click="openAction(recommendedNextStep.action_path)"
            >
              <span>{{ recommendedNextStep.action_label }}</span>
              <Icon name="arrowRight" size="xs" :stroke-width="2" />
            </button>
          </div>
        </div>

        <div
          v-if="actionQueue.length > 0"
          data-testid="launch-action-queue"
          class="card p-5"
        >
          <div class="flex flex-col gap-1">
            <p class="text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400">
              {{ t('admin.launchReadiness.actionQueue.title') }}
            </p>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ t('admin.launchReadiness.actionQueue.description') }}
            </p>
          </div>

          <ol class="mt-4 divide-y divide-gray-100 dark:divide-dark-700">
            <li
              v-for="(item, index) in actionQueue"
              :key="`${item.sectionId}:${item.id}`"
              class="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 lg:flex-row lg:items-start lg:justify-between"
            >
              <div class="flex min-w-0 gap-3">
                <span class="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600 dark:bg-dark-700 dark:text-gray-300">
                  {{ index + 1 }}
                </span>
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <span :class="['inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', statusTone(item.status).badge]">
                      <Icon :name="statusTone(item.status).icon" size="xs" :stroke-width="2" />
                      {{ t(statusTone(item.status).labelKey) }}
                    </span>
                    <span class="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {{ item.sectionTitle }}
                    </span>
                  </div>
                  <h3 class="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                    {{ item.title }}
                  </h3>
                  <p class="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-400">
                    {{ item.description }}
                  </p>
                  <p
                    v-if="item.value"
                    class="mt-2 inline-flex rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-dark-700 dark:text-gray-300"
                  >
                    {{ item.value }}
                  </p>
                </div>
              </div>

              <button
                v-if="item.action_path && item.action_label"
                type="button"
                class="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-primary-300 hover:text-primary-700 dark:border-dark-600 dark:bg-dark-800 dark:text-gray-300 dark:hover:border-primary-500 dark:hover:text-primary-300"
                @click="openAction(item.action_path)"
              >
                <span>{{ item.action_label }}</span>
                <Icon name="arrowRight" size="xs" :stroke-width="2" />
              </button>
            </li>
          </ol>
        </div>

        <div
          v-if="loadError"
          class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-200"
        >
          {{ loadError }}
        </div>

        <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <section v-for="section in report.sections" :key="section.id" class="card overflow-hidden">
            <div class="border-b border-gray-100 p-5 dark:border-dark-700">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 class="text-base font-semibold text-gray-900 dark:text-white">
                    {{ section.title }}
                  </h2>
                  <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {{ section.completed }}/{{ section.total }} {{ t('admin.launchReadiness.sectionComplete') }}
                  </p>
                </div>
                <span :class="['inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', statusTone(section.status).badge]">
                  <Icon :name="statusTone(section.status).icon" size="xs" :stroke-width="2" />
                  {{ t(statusTone(section.status).labelKey) }}
                </span>
              </div>
            </div>

            <ul class="divide-y divide-gray-100 dark:divide-dark-700">
              <li v-for="check in section.checks" :key="check.id" class="p-5">
                <div class="flex gap-4">
                  <div :class="['mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full', statusTone(check.status).iconWrap]">
                    <Icon :name="statusTone(check.status).icon" size="sm" :class="statusTone(check.status).iconColor" :stroke-width="2" />
                  </div>

                  <div class="min-w-0 flex-1 space-y-3">
                    <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div class="min-w-0">
                        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
                          {{ check.title }}
                        </h3>
                        <p class="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-400">
                          {{ check.description }}
                        </p>
                      </div>
                      <span
                        v-if="check.value"
                        class="inline-flex shrink-0 items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-dark-700 dark:text-gray-300"
                      >
                        {{ check.value }}
                      </span>
                    </div>

                    <div v-if="check.action_path && check.action_label" class="flex justify-start">
                      <button
                        type="button"
                        class="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-primary-300 hover:text-primary-700 dark:border-dark-600 dark:bg-dark-800 dark:text-gray-300 dark:hover:border-primary-500 dark:hover:text-primary-300"
                        @click="openAction(check.action_path)"
                      >
                        <span>{{ check.action_label }}</span>
                        <Icon name="arrowRight" size="xs" :stroke-width="2" />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            </ul>
          </section>
        </div>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AppLayout from '@/components/layout/AppLayout.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import Icon from '@/components/icons/Icon.vue'
import { adminAPI, type LaunchReadinessOverallStatus, type LaunchReadinessReport, type LaunchReadinessStatus } from '@/api/admin'
import { useAppStore } from '@/stores/app'

const { t } = useI18n()
const router = useRouter()
const appStore = useAppStore()

const report = ref<LaunchReadinessReport | null>(null)
const loading = ref(false)
const refreshing = ref(false)
const loadError = ref('')

const completionPercent = computed(() => {
  if (!report.value || report.value.total === 0) {
    return 0
  }
  return Math.round((report.value.completed / report.value.total) * 100)
})

const overallTone = computed(() => overallStatusTone(report.value?.overall_status ?? 'blocked'))

const recommendedNextStep = computed(() => {
  if (!report.value) return null
  return findFirstCheckByStatus('fail') ?? findFirstCheckByStatus('warn')
})

const actionQueue = computed(() => {
  if (!report.value) return []
  const priority: Record<LaunchReadinessStatus, number> = {
    fail: 0,
    warn: 1,
    pass: 2
  }

  return report.value.sections
    .flatMap((section, sectionIndex) =>
      section.checks.map((check, checkIndex) => ({
        ...check,
        sectionId: section.id,
        sectionTitle: section.title,
        sectionIndex,
        checkIndex
      }))
    )
    .filter((check) => check.status !== 'pass')
    .sort((a, b) =>
      priority[a.status] - priority[b.status]
      || a.sectionIndex - b.sectionIndex
      || a.checkIndex - b.checkIndex
    )
    .slice(0, 5)
})

function findFirstCheckByStatus(status: LaunchReadinessStatus) {
  if (!report.value) return null
  for (const section of report.value.sections) {
    const found = section.checks.find((check) => check.status === status)
    if (found) return found
  }
  return null
}

async function fetchReport(): Promise<void> {
  const firstLoad = !report.value
  loadError.value = ''
  loading.value = firstLoad
  refreshing.value = !firstLoad

  try {
    report.value = await adminAPI.launchReadiness.getLaunchReadiness()
  } catch (error) {
    const message = error instanceof Error ? error.message : t('admin.launchReadiness.failedToLoad')
    loadError.value = message
    appStore.showError(message)
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function openAction(path: string): void {
  router.push(path)
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value || t('common.none')
  }
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function statusTone(status: LaunchReadinessStatus) {
  switch (status) {
    case 'pass':
      return {
        labelKey: 'admin.launchReadiness.status.pass',
        icon: 'checkCircle' as const,
        badge: 'bg-green-50 text-green-700 dark:bg-green-900/25 dark:text-green-300',
        iconWrap: 'bg-green-50 dark:bg-green-900/25',
        iconColor: 'text-green-600 dark:text-green-300'
      }
    case 'warn':
      return {
        labelKey: 'admin.launchReadiness.status.warn',
        icon: 'exclamationTriangle' as const,
        badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300',
        iconWrap: 'bg-amber-50 dark:bg-amber-900/25',
        iconColor: 'text-amber-600 dark:text-amber-300'
      }
    default:
      return {
        labelKey: 'admin.launchReadiness.status.fail',
        icon: 'xCircle' as const,
        badge: 'bg-red-50 text-red-700 dark:bg-red-900/25 dark:text-red-300',
        iconWrap: 'bg-red-50 dark:bg-red-900/25',
        iconColor: 'text-red-600 dark:text-red-300'
      }
  }
}

function overallStatusTone(status: LaunchReadinessOverallStatus) {
  switch (status) {
    case 'launch_ready':
      return {
        labelKey: 'admin.launchReadiness.overall.launchReady',
        icon: 'badge' as const,
        iconWrap: 'bg-green-50 dark:bg-green-900/25',
        iconColor: 'text-green-600 dark:text-green-300',
        textColor: 'text-green-700 dark:text-green-300'
      }
    case 'internal_test_ready':
      return {
        labelKey: 'admin.launchReadiness.overall.internalTestReady',
        icon: 'exclamationTriangle' as const,
        iconWrap: 'bg-amber-50 dark:bg-amber-900/25',
        iconColor: 'text-amber-600 dark:text-amber-300',
        textColor: 'text-amber-700 dark:text-amber-300'
      }
    default:
      return {
        labelKey: 'admin.launchReadiness.overall.blocked',
        icon: 'shield' as const,
        iconWrap: 'bg-red-50 dark:bg-red-900/25',
        iconColor: 'text-red-600 dark:text-red-300',
        textColor: 'text-red-700 dark:text-red-300'
      }
  }
}

onMounted(() => {
  fetchReport()
})
</script>
