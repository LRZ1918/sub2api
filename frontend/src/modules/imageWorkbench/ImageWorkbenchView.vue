<template>
  <AppLayout>
    <div class="image-workbench-page">
      <section v-if="featureDisabled" class="state-panel">
        <div class="state-icon" aria-hidden="true"></div>
        <h1>{{ t('imageWorkbench.disabledTitle') }}</h1>
        <p>{{ t('imageWorkbench.disabledDesc') }}</p>
      </section>

      <section v-else class="workbench-shell" data-testid="image-workbench-studio">
        <header class="workbench-header" data-testid="image-workbench-hero">
          <div class="hero-copy">
            <div class="hero-icon" aria-hidden="true">
              <Icon name="sparkles" size="md" />
            </div>
            <div>
              <h1>{{ t('imageWorkbench.title') }}</h1>
              <p>{{ t('imageWorkbench.description') }}</p>
              <div class="hero-meta">
                <span class="gateway-label">{{ t('imageWorkbench.gatewayLabel') }}</span>
                <span class="gateway-pill" data-testid="image-workbench-gateway">{{ apiBaseUrl }}</span>
                <span class="module-badge">{{ t('imageWorkbench.nativeBadge') }}</span>
                <span class="module-badge module-badge-strong">{{ t('imageWorkbench.realKeyBillingHint') }}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            class="btn btn-secondary btn-icon"
            :disabled="loading"
            :aria-label="t('imageWorkbench.refresh')"
            @click="loadOptions(true)"
          >
            <Icon name="refresh" size="sm" :class="{ 'spin': loading }" />
            {{ t('imageWorkbench.refresh') }}
          </button>
        </header>

        <div v-if="loading && !options" class="state-panel">
          <h2>{{ t('common.loading') }}</h2>
        </div>

        <div v-else-if="loadError" class="state-panel">
          <h2>{{ t('imageWorkbench.loadFailedTitle') }}</h2>
          <p>{{ loadError }}</p>
          <button type="button" class="btn btn-primary" @click="loadOptions(true)">
            {{ t('imageWorkbench.retry') }}
          </button>
        </div>

        <div v-else-if="options && options.api_keys.length === 0" class="state-panel">
          <h2>{{ t('imageWorkbench.noKeysTitle') }}</h2>
          <p>{{ t('imageWorkbench.noKeysDesc') }}</p>
        </div>

        <div v-else-if="options && options.models.length === 0" class="state-panel">
          <h2>{{ t('imageWorkbench.noModelsTitle') }}</h2>
          <p>{{ t('imageWorkbench.noModelsDesc') }}</p>
        </div>

        <div v-else-if="options" class="workbench-grid">
          <aside class="left-column">
            <section class="panel" data-testid="image-workbench-panel">
              <h2>{{ t('imageWorkbench.chooseKey') }}</h2>
              <label class="field-label" for="image-key">{{ t('imageWorkbench.apiKey') }}</label>
              <select id="image-key" v-model.number="selectedKeyID" data-testid="image-workbench-key-select" class="input">
                <option v-for="key in options.api_keys" :key="key.id" :value="key.id">
                  {{ key.name }} · {{ key.masked_key }}
                </option>
              </select>
              <div v-if="selectedKey" class="key-summary">
                <div class="key-summary-top">
                  <span class="group-badge">
                    <Icon name="badge" size="xs" />
                    {{ selectedKey.group_name || t('imageWorkbench.unknownGroup') }}
                  </span>
                  <span class="status-badge">{{ t('imageWorkbench.imageEnabled') }}</span>
                </div>
                <dl class="key-facts">
                  <div>
                    <dt>{{ t('imageWorkbench.apiKey') }}</dt>
                    <dd>{{ selectedKey.masked_key }}</dd>
                  </div>
                  <div>
                    <dt>{{ t('imageWorkbench.quotaRemaining') }}</dt>
                    <dd>{{ formatQuota(selectedKey.quota_remaining) }}</dd>
                  </div>
                </dl>
              </div>
            </section>

            <section class="panel" data-testid="image-workbench-panel">
              <h2>{{ t('imageWorkbench.model') }}</h2>
              <select v-model="form.model" class="input">
                <option v-for="model in availableModelsForSelectedKey" :key="model.name" :value="model.name">
                  {{ model.label || model.name }}
                </option>
              </select>
              <div v-if="selectedModel" class="model-chip">
                {{ selectedModel.name }}
              </div>
            </section>

            <section class="panel" data-testid="image-workbench-panel">
              <h2>{{ t('imageWorkbench.references') }}</h2>
              <label class="upload-box">
                <input type="file" accept="image/png,image/jpeg,image/webp" multiple @change="onImagesChange" />
                <Icon name="upload" size="lg" />
                <span>{{ t('imageWorkbench.uploadImages') }}</span>
                <small>{{ t('imageWorkbench.uploadImagesHint') }}</small>
              </label>
              <label class="upload-box">
                <input type="file" accept="image/png,image/jpeg,image/webp" @change="onMaskChange" />
                <Icon name="edit" size="lg" />
                <span>{{ t('imageWorkbench.uploadMask') }}</span>
                <small>{{ t('imageWorkbench.uploadMaskHint') }}</small>
              </label>
              <div v-if="referenceImages.length || maskFile" class="file-list">
                <span v-for="file in referenceImages" :key="file.name">{{ file.name }}</span>
                <span v-if="maskFile">{{ t('imageWorkbench.mask') }}: {{ maskFile.name }}</span>
              </div>
            </section>
          </aside>

          <main class="right-column">
            <form class="panel prompt-panel" data-testid="image-workbench-generate" @submit.prevent="submit">
              <span class="sr-only" data-testid="image-workbench-panel">{{ t('imageWorkbench.promptAndParams') }}</span>
              <div class="panel-heading">
                <div>
                  <h2>{{ t('imageWorkbench.promptAndParams') }}</h2>
                  <p>{{ mode === 'edit' ? t('imageWorkbench.editHint') : t('imageWorkbench.generateHint') }}</p>
                </div>
                <div class="segmented">
                  <button type="button" :class="{ active: mode === 'generate' }" @click="mode = 'generate'">
                    {{ t('imageWorkbench.generateMode') }}
                  </button>
                  <button type="button" :class="{ active: mode === 'edit' }" @click="mode = 'edit'">
                    {{ t('imageWorkbench.editMode') }}
                  </button>
                </div>
              </div>

              <label class="field-label" for="image-prompt">{{ t('imageWorkbench.prompt') }}</label>
              <textarea
                id="image-prompt"
                v-model="form.prompt"
                data-testid="image-workbench-prompt"
                class="textarea"
                :placeholder="t('imageWorkbench.promptPlaceholder')"
              />

              <div class="param-grid">
                <label>
                  <span>{{ t('imageWorkbench.size') }}</span>
                  <select v-model="form.size" class="input">
                    <option v-for="item in options.defaults.sizes" :key="item" :value="item">{{ item }}</option>
                  </select>
                </label>
                <label>
                  <span>{{ t('imageWorkbench.count') }}</span>
                  <select v-model.number="form.count" class="input">
                    <option v-for="item in [1, 2, 3, 4]" :key="item" :value="item">{{ item }}</option>
                  </select>
                </label>
                <label>
                  <span>{{ t('imageWorkbench.quality') }}</span>
                  <select v-model="form.quality" class="input">
                    <option v-for="item in options.defaults.qualities" :key="item" :value="item">{{ item }}</option>
                  </select>
                </label>
                <label>
                  <span>{{ t('imageWorkbench.format') }}</span>
                  <select v-model="form.format" class="input">
                    <option v-for="item in options.defaults.formats" :key="item" :value="item">{{ item }}</option>
                  </select>
                </label>
                <label>
                  <span>{{ t('imageWorkbench.background') }}</span>
                  <select v-model="form.background" class="input">
                    <option v-for="item in options.defaults.backgrounds" :key="item" :value="item">{{ item }}</option>
                  </select>
                </label>
                <label>
                  <span>{{ t('imageWorkbench.style') }}</span>
                  <select v-model="form.style" class="input">
                    <option v-for="item in options.defaults.styles" :key="item" :value="item">{{ item }}</option>
                  </select>
                </label>
              </div>

              <div class="actions">
                <button type="submit" class="btn btn-primary" :disabled="submitting || !canSubmit">
                  <Icon name="sparkles" size="sm" />
                  {{ submitting ? t('imageWorkbench.generating') : t('imageWorkbench.start') }}
                </button>
                <button type="button" class="btn btn-secondary" @click="clearResults">
                  {{ t('imageWorkbench.clear') }}
                </button>
              </div>
            </form>

            <section class="panel result-panel" data-testid="image-workbench-panel">
              <div class="panel-heading">
                <div>
                  <h2>{{ t('imageWorkbench.preview') }}</h2>
                  <p>{{ t('imageWorkbench.previewDesc') }}</p>
                </div>
              </div>
              <div v-if="results.length === 0" class="empty-result">
                <Icon name="inbox" size="xl" />
                <strong>{{ t('imageWorkbench.emptyResultTitle') }}</strong>
                <span>{{ t('imageWorkbench.emptyResult') }}</span>
              </div>
              <div v-else class="result-grid">
                <figure v-for="(item, index) in results" :key="item.src + index" class="result-item">
                  <img :src="item.src" :alt="item.revisedPrompt || form.prompt" />
                  <figcaption>
                    <span>{{ item.kind.toUpperCase() }}</span>
                    <button type="button" class="link-button" @click="downloadResult(item, index)">
                      {{ t('imageWorkbench.download') }}
                    </button>
                    <button type="button" class="link-button" @click="sendToEdit(item)">
                      {{ t('imageWorkbench.sendToEdit') }}
                    </button>
                  </figcaption>
                </figure>
              </div>
            </section>

            <section class="panel" v-if="recentRecords.length" data-testid="image-workbench-panel">
              <h2>{{ t('imageWorkbench.recent') }}</h2>
              <div class="recent-list">
                <button v-for="record in recentRecords" :key="record.id" type="button" @click="restoreRecord(record)">
                  <strong>{{ record.model }}</strong>
                  <span>{{ record.prompt }}</span>
                </button>
              </div>
            </section>
          </main>
        </div>
      </section>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import { useAppStore } from '@/stores/app'
import {
  imageWorkbenchAPI,
  type ImageResultItem,
  type ImageWorkbenchKeyOption,
  type ImageWorkbenchModelOption,
  type ImageWorkbenchOptions,
  type ImageWorkbenchResult,
} from './api'

interface PreviewResult {
  src: string
  kind: 'url' | 'base64'
  revisedPrompt?: string
}

interface RecentRecord {
  id: string
  model: string
  prompt: string
  createdAt: number
  results: PreviewResult[]
}

const RECENT_KEY = 'sub2api:image-workbench:recent'

const { t } = useI18n()
const route = useRoute()
const appStore = useAppStore()

const loading = ref(false)
const submitting = ref(false)
const options = ref<ImageWorkbenchOptions | null>(null)
const loadError = ref('')
const selectedKeyID = ref<number | null>(null)
const mode = ref<'generate' | 'edit'>('generate')
const backendDisabled = ref(false)
const referenceImages = ref<File[]>([])
const maskFile = ref<File | null>(null)
const results = ref<PreviewResult[]>([])
const recentRecords = ref<RecentRecord[]>([])

const form = reactive({
  model: '',
  prompt: '',
  size: '1024x1024',
  count: 1,
  quality: 'auto',
  format: 'png',
  background: 'auto',
  style: 'vivid',
})

const featureDisabled = computed(() =>
  backendDisabled.value || appStore.cachedPublicSettings?.image_workbench_enabled === false,
)
const apiBaseUrl = computed(() => appStore.cachedPublicSettings?.api_base_url || '/v1')
const selectedKey = computed<ImageWorkbenchKeyOption | null>(() =>
  options.value?.api_keys.find((key) => key.id === selectedKeyID.value) ?? null,
)
const availableModelsForSelectedKey = computed<ImageWorkbenchModelOption[]>(() => {
  if (!options.value) return []
  if (!selectedKeyID.value) return options.value.models
  return options.value.models.filter((model) => {
    const ids = model.available_key_ids
    return !ids || ids.length === 0 || ids.includes(selectedKeyID.value as number)
  })
})
const selectedModel = computed<ImageWorkbenchModelOption | null>(() =>
  availableModelsForSelectedKey.value.find((model) => model.name === form.model) ?? null,
)
const canSubmit = computed(() => Boolean(selectedKeyID.value && form.model && form.prompt.trim()))

onMounted(async () => {
  recentRecords.value = loadRecentRecords()
  const settings = await appStore.fetchPublicSettings()
  if (settings?.image_workbench_enabled === false) return
  await loadOptions()
})

async function loadOptions(force = false): Promise<void> {
  if (featureDisabled.value && !force) return
  loading.value = true
  loadError.value = ''
  try {
    const data = await imageWorkbenchAPI.getOptions()
    options.value = data
    applyDefaults(data)
  } catch (error) {
    const message = (error as { message?: string })?.message || t('imageWorkbench.loadFailedDesc')
    loadError.value = message
    if ((error as { status?: number })?.status === 403) {
      backendDisabled.value = true
    }
  } finally {
    loading.value = false
  }
}

function applyDefaults(data: ImageWorkbenchOptions): void {
  const queryKey = Number(route.query.api_key_id ?? route.query.key_id)
  const preferredKey = data.api_keys.find((key) => key.id === queryKey) ?? data.api_keys[0]
  selectedKeyID.value = preferredKey?.id ?? null
  form.model = chooseDefaultModelForSelectedKey(data)
  form.size = data.defaults.size || data.defaults.sizes[0] || '1024x1024'
  form.quality = data.defaults.quality || data.defaults.qualities[0] || 'auto'
  form.format = data.defaults.format || data.defaults.formats[0] || 'png'
  form.count = data.defaults.count || 1
  form.background = data.defaults.background || data.defaults.backgrounds[0] || 'auto'
  form.style = data.defaults.style || data.defaults.styles[0] || 'vivid'
}

watch(selectedKeyID, () => {
  if (!availableModelsForSelectedKey.value.some((model) => model.name === form.model)) {
    form.model = availableModelsForSelectedKey.value[0]?.name || ''
  }
})

function chooseDefaultModelForSelectedKey(data: ImageWorkbenchOptions): string {
  const models = selectedKeyID.value
    ? data.models.filter((model) => {
        const ids = model.available_key_ids
        return !ids || ids.length === 0 || ids.includes(selectedKeyID.value as number)
      })
    : data.models
  return models.find((model) => model.name === data.defaults.model)?.name || models[0]?.name || ''
}

async function submit(): Promise<void> {
  if (!canSubmit.value || !selectedKeyID.value) return
  submitting.value = true
  try {
    const result = mode.value === 'edit'
      ? await submitEdit(selectedKeyID.value)
      : await imageWorkbenchAPI.generateImage({
          api_key_id: selectedKeyID.value,
          model: form.model,
          prompt: form.prompt.trim(),
          size: form.size,
          n: form.count,
          quality: form.quality,
          response_format: 'b64_json',
          output_format: form.format,
          background: form.background,
          style: form.style,
        })
    results.value = normalizeResults(result)
    persistRecentRecord()
    appStore.showSuccess(t('imageWorkbench.success'))
  } catch (error) {
    appStore.showError((error as { message?: string })?.message || t('imageWorkbench.failed'))
  } finally {
    submitting.value = false
  }
}

async function submitEdit(apiKeyID: number): Promise<ImageWorkbenchResult> {
  const data = new FormData()
  data.append('api_key_id', String(apiKeyID))
  data.append('model', form.model)
  data.append('prompt', form.prompt.trim())
  data.append('size', form.size)
  data.append('n', String(form.count))
  data.append('quality', form.quality)
  data.append('output_format', form.format)
  data.append('background', form.background)
  referenceImages.value.forEach((file) => data.append('image', file))
  if (maskFile.value) data.append('mask', maskFile.value)
  return imageWorkbenchAPI.editImage(data)
}

function normalizeResults(result: ImageWorkbenchResult): PreviewResult[] {
  const data = Array.isArray(result?.data) ? result.data : []
  return data
    .map((item: ImageResultItem): PreviewResult | null => {
      if (item.url) return { src: item.url, kind: 'url', revisedPrompt: item.revised_prompt }
      if (item.b64_json) return { src: `data:image/${form.format || 'png'};base64,${item.b64_json}`, kind: 'base64', revisedPrompt: item.revised_prompt }
      return null
    })
    .filter((item): item is PreviewResult => item !== null)
}

function onImagesChange(event: Event): void {
  const files = Array.from((event.target as HTMLInputElement).files ?? [])
  referenceImages.value = files
  if (files.length > 0) mode.value = 'edit'
}

function onMaskChange(event: Event): void {
  maskFile.value = ((event.target as HTMLInputElement).files ?? [])[0] ?? null
  if (maskFile.value) mode.value = 'edit'
}

function clearResults(): void {
  results.value = []
}

function downloadResult(item: PreviewResult, index: number): void {
  const link = document.createElement('a')
  link.href = item.src
  link.download = `image-workbench-${Date.now()}-${index + 1}.${form.format || 'png'}`
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

function sendToEdit(item: PreviewResult): void {
  mode.value = 'edit'
  form.prompt = item.revisedPrompt || form.prompt
}

function persistRecentRecord(): void {
  if (!results.value.length) return
  const next: RecentRecord = {
    id: `${Date.now()}`,
    model: form.model,
    prompt: form.prompt.trim(),
    createdAt: Date.now(),
    results: results.value.slice(0, 4),
  }
  recentRecords.value = [next, ...recentRecords.value].slice(0, 8)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentRecords.value))
  } catch {
    // ignore storage quota/private mode
  }
}

function loadRecentRecords(): RecentRecord[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as RecentRecord[]
    return Array.isArray(parsed) ? parsed.slice(0, 8) : []
  } catch {
    return []
  }
}

function restoreRecord(record: RecentRecord): void {
  form.model = record.model
  form.prompt = record.prompt
  results.value = record.results ?? []
}

function formatQuota(value: number): string {
  if (value < 0) return t('imageWorkbench.unlimited')
  return `$${value.toFixed(2)}`
}
</script>

<style scoped>
.image-workbench-page {
  min-height: calc(100vh - 4rem);
  background: #07111f;
  color: #e5edf7;
  margin: -1.5rem;
  padding: 1.5rem;
}

.workbench-shell {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.workbench-header,
.panel,
.state-panel {
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: #1d2a3d;
  border-radius: 8px;
}

.workbench-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.5rem;
}

.hero-copy {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  min-width: 0;
}

.hero-icon {
  display: grid;
  place-items: center;
  width: 2.8rem;
  height: 2.8rem;
  flex: 0 0 auto;
  border-radius: 8px;
  background: rgba(20, 184, 166, 0.12);
  color: #2dd4bf;
}

.workbench-header h1,
.state-panel h1 {
  margin: 0 0 0.25rem;
  font-size: 1.5rem;
  font-weight: 700;
}

.workbench-header p,
.state-panel p,
.panel-heading p {
  margin: 0;
  color: #9fb0c6;
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  margin-top: 0.75rem;
}

.gateway-label {
  color: #b9c7d8;
  font-size: 0.82rem;
}

.gateway-pill,
.model-chip,
.module-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.55rem;
  border: 1px solid rgba(45, 212, 191, 0.55);
  border-radius: 7px;
  color: #5eead4;
  font-size: 0.78rem;
}

.gateway-pill {
  color: #dbeafe;
  border-color: rgba(148, 163, 184, 0.36);
  background: rgba(15, 23, 42, 0.38);
  font-weight: 700;
}

.module-badge {
  border-color: rgba(59, 130, 246, 0.32);
  background: rgba(14, 165, 233, 0.12);
  color: #93c5fd;
}

.module-badge-strong {
  border-color: rgba(20, 184, 166, 0.35);
  background: rgba(20, 184, 166, 0.12);
  color: #7dd3fc;
}

.model-chip {
  margin-top: 0.75rem;
}

.workbench-grid {
  display: grid;
  grid-template-columns: minmax(280px, 32%) minmax(0, 1fr);
  gap: 1.5rem;
}

.left-column,
.right-column {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.panel {
  padding: 1.25rem;
}

.panel h2,
.state-panel h2 {
  margin: 0 0 1rem;
  font-size: 1rem;
  font-weight: 700;
}

.panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.field-label,
.param-grid span {
  display: block;
  margin-bottom: 0.45rem;
  color: #cad6e5;
  font-size: 0.88rem;
  font-weight: 600;
}

.input,
.textarea {
  width: 100%;
  border: 1px solid #475569;
  border-radius: 8px;
  background: #1d2a3d;
  color: #f8fafc;
  padding: 0.7rem 0.85rem;
}

.textarea {
  min-height: 140px;
  resize: vertical;
}

.key-summary {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 8px;
  background: rgba(148, 163, 184, 0.11);
  color: #cbd5e1;
}

.key-summary-top {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem;
}

.group-badge,
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 1.65rem;
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 700;
}

.group-badge {
  background: rgba(34, 197, 94, 0.12);
  color: #86efac;
}

.status-badge {
  background: rgba(20, 184, 166, 0.12);
  color: #5eead4;
}

.key-facts {
  display: grid;
  gap: 0.55rem;
  margin: 0;
}

.key-facts div {
  display: grid;
  grid-template-columns: minmax(5rem, 1fr) auto;
  gap: 1rem;
}

.key-facts dt {
  color: #9fb0c6;
}

.key-facts dd {
  margin: 0;
  color: #f8fafc;
  font-weight: 700;
  text-align: right;
}

.param-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.segmented {
  display: inline-flex;
  padding: 0.2rem;
  border: 1px solid #475569;
  border-radius: 8px;
  background: #101827;
}

.segmented button {
  min-width: 4rem;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #9fb0c6;
  padding: 0.45rem 0.75rem;
}

.segmented button.active {
  background: #0f766e;
  color: #ecfeff;
}

.actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  border-radius: 8px;
  padding: 0.65rem 1rem;
  font-weight: 700;
}

.btn-icon {
  min-height: 2.75rem;
}

.btn-primary {
  background: #0f766e;
  color: #ecfeff;
}

.btn-secondary {
  border: 1px solid #475569;
  background: transparent;
  color: #e2e8f0;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.upload-box {
  display: grid;
  place-items: center;
  gap: 0.35rem;
  min-height: 5.5rem;
  margin-top: 0.75rem;
  border: 1px dashed #52627a;
  border-radius: 8px;
  color: #cbd5e1;
  cursor: pointer;
  transition: border-color 0.18s ease, background-color 0.18s ease;
}

.upload-box:hover {
  border-color: rgba(45, 212, 191, 0.55);
  background: rgba(20, 184, 166, 0.06);
}

.upload-box small {
  color: #8293aa;
  font-size: 0.76rem;
}

.upload-box input {
  display: none;
}

.file-list,
.recent-list {
  display: grid;
  gap: 0.5rem;
  margin-top: 1rem;
  color: #cbd5e1;
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}

.result-item {
  margin: 0;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 8px;
  background: #101827;
}

.result-item img {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
}

.result-item figcaption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.7rem;
  color: #cbd5e1;
}

.link-button {
  border: 0;
  background: transparent;
  color: #5eead4;
}

.empty-result,
.state-panel {
  display: grid;
  place-items: center;
  gap: 0.5rem;
  min-height: 12rem;
  padding: 2rem;
  text-align: center;
  color: #9fb0c6;
}

.empty-result strong {
  color: #e5edf7;
}

.state-icon {
  font-size: 1.6rem;
}

.spin {
  animation: image-workbench-spin 1s linear infinite;
}

@keyframes image-workbench-spin {
  to {
    transform: rotate(360deg);
  }
}

.recent-list button {
  display: grid;
  gap: 0.25rem;
  text-align: left;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 8px;
  background: #101827;
  color: #dbeafe;
  padding: 0.75rem;
}

@media (max-width: 960px) {
  .image-workbench-page {
    margin: -1rem;
    padding: 1rem;
  }

  .workbench-header,
  .panel-heading {
    flex-direction: column;
  }

  .workbench-grid {
    grid-template-columns: 1fr;
  }

  .param-grid {
    grid-template-columns: 1fr;
  }
}
</style>
