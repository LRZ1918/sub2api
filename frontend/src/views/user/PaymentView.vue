<template>
  <AppLayout>
    <div v-if="loading" class="mx-auto max-w-4xl space-y-6">
      <div class="flex items-center justify-center py-20">
        <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
      </div>
    </div>
    <div v-else-if="externalPurchaseActive" class="purchase-page-layout">
      <div v-if="externalPurchaseUrl" class="purchase-embed-shell">
        <a
          class="purchase-open-link"
          :href="externalPurchaseUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ t('purchase.openInNewTab') }}
        </a>
        <iframe
          class="purchase-embed-frame"
          :src="externalPurchaseUrl"
          :title="t('purchase.title')"
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
        ></iframe>
      </div>
      <div v-else class="card purchase-empty-state">
        <Icon name="link" size="xl" class="mx-auto mb-3 text-gray-300 dark:text-dark-600" />
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('purchase.notConfiguredTitle') }}</h2>
        <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">{{ t('purchase.notConfiguredDesc') }}</p>
      </div>
    </div>
    <div v-else-if="purchaseDisabled" class="mx-auto max-w-4xl">
      <div class="card purchase-empty-state">
        <Icon name="creditCard" size="xl" class="mx-auto mb-3 text-gray-300 dark:text-dark-600" />
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('purchase.notEnabledTitle') }}</h2>
        <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">{{ t('purchase.notEnabledDesc') }}</p>
      </div>
    </div>
    <div v-else class="purchase-native mx-auto max-w-5xl space-y-6">
        <div class="purchase-hero rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-dark-700 dark:bg-dark-900">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-primary-600 dark:text-primary-400">{{ t('purchase.securePaymentTitle') }}</p>
              <h1 class="mt-2 text-2xl font-bold tracking-normal text-gray-950 dark:text-white">{{ t('purchase.heroTitle') }}</h1>
              <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">{{ t('purchase.heroDescription') }}</p>
            </div>
            <div class="flex shrink-0 gap-2">
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-dark-700 dark:text-gray-200 dark:hover:bg-dark-800"
                @click="refreshCheckoutInfo"
              >
                {{ t('purchase.refresh') }}
              </button>
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-dark-700 dark:text-gray-200 dark:hover:bg-dark-800"
                @click="openOrders"
              >
                {{ t('purchase.myOrders') }}
              </button>
            </div>
          </div>
        </div>
        <div v-if="purchaseOrdersVisible" class="card p-5" data-testid="purchase-orders-panel">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('purchase.ordersPanelTitle') }}</h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('purchase.ordersPanelSubtitle') }}</p>
            </div>
            <div class="flex shrink-0 gap-2">
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-dark-700 dark:text-gray-200 dark:hover:bg-dark-800"
                :disabled="purchaseOrdersLoading"
                @click="loadPurchaseOrders"
              >
                {{ t('purchase.refresh') }}
              </button>
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-dark-700 dark:text-gray-200 dark:hover:bg-dark-800"
                @click="openFullOrdersPage"
              >
                {{ t('purchase.ordersPanelOpenFull') }}
              </button>
            </div>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <button
              v-for="filter in purchaseOrderFilterOptions"
              :key="filter.value || 'all'"
              type="button"
              class="rounded-lg border px-3 py-1.5 text-xs font-semibold transition"
              :class="purchaseOrdersStatus === filter.value
                ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300'
                : 'border-gray-200 bg-white text-gray-600 hover:border-primary-300 dark:border-dark-700 dark:bg-dark-900 dark:text-gray-300'"
              @click="changePurchaseOrdersFilter(filter.value)"
            >
              {{ filter.label }}
            </button>
          </div>
          <div v-if="purchaseOrdersLoading" class="flex items-center justify-center py-8">
            <div class="h-6 w-6 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
          </div>
          <div v-else-if="purchaseOrders.length === 0" class="mt-4 rounded-xl border border-dashed border-gray-200 p-6 text-center dark:border-dark-700">
            <Icon name="clipboard" size="lg" class="mx-auto mb-2 text-gray-300 dark:text-dark-600" />
            <p class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('purchase.ordersPanelEmpty') }}</p>
          </div>
          <div v-else class="mt-4 space-y-2">
            <div
              v-for="order in purchaseOrders"
              :key="order.id"
              class="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 dark:border-dark-700 sm:flex-row sm:items-center sm:justify-between"
            >
              <div class="min-w-0">
                <p class="font-mono text-sm font-semibold text-gray-900 dark:text-white">#{{ order.id }}</p>
                <p class="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">{{ order.out_trade_no }}</p>
              </div>
              <div class="flex flex-wrap items-center gap-3 text-sm">
                <span class="font-semibold text-gray-900 dark:text-white">{{ formatOrderPayAmount(order) }}</span>
                <span class="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-dark-800 dark:text-gray-300">
                  {{ t('payment.status.' + order.status.toLowerCase(), order.status) }}
                </span>
                <span class="text-xs text-gray-500 dark:text-gray-400">{{ formatOrderDate(order.created_at) }}</span>
                <button
                  v-if="order.status === 'PENDING'"
                  type="button"
                  class="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-amber-300 dark:hover:bg-amber-500/10"
                  :disabled="purchaseOrdersActionLoading === order.id"
                  @click="cancelPurchaseOrder(order)"
                >
                  {{ t('payment.orders.cancel') }}
                </button>
              </div>
            </div>
          </div>
        </div>
        <!-- Tab Switcher (hide during payment and subscription confirm) -->
        <div v-if="tabs.length > 1 && paymentPhase === 'select' && !selectedPlan" class="flex space-x-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-800">
          <button v-for="tab in tabs" :key="tab.key"
            class="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all"
            :class="activeTab === tab.key ? 'bg-white text-gray-900 shadow dark:bg-dark-700 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'"
            @click="activeTab = tab.key">{{ tab.label }}</button>
        </div>
        <!-- Payment in progress (shared by recharge and subscription) -->
        <template v-if="paymentPhase === 'paying'">
          <PaymentStatusPanel
            :order-id="paymentState.orderId"
            :qr-code="paymentState.qrCode"
            :expires-at="paymentState.expiresAt"
            :payment-type="paymentState.paymentType"
            :pay-url="paymentState.payUrl"
            :order-type="paymentState.orderType"
            @done="onPaymentDone"
            @success="onPaymentSuccess"
            @settled="onPaymentSettled"
          />
        </template>
        <!-- Tab content (select phase) -->
        <template v-else>
          <!-- Top-up Tab -->
          <template v-if="activeTab === 'recharge'">
            <div class="grid grid-cols-1 gap-4 md:grid-cols-[1.35fr_1fr]">
              <div class="card p-5">
                <p class="text-base font-semibold text-gray-900 dark:text-white">{{ t('purchase.rechargeModeTitle') }}</p>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('purchase.rechargeModeSubtitle') }}</p>
                <div class="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  <p>{{ t('purchase.rechargeRate') }}</p>
                  <p>{{ t('purchase.universalBalance') }}</p>
                </div>
              </div>
              <div class="card p-5">
                <p class="text-xs font-medium text-gray-400 dark:text-gray-500">{{ t('payment.rechargeAccount') }}</p>
                <p class="mt-1 break-all text-base font-semibold text-gray-900 dark:text-white">{{ rechargeAccountLabel }}</p>
                <p class="mt-1 text-sm font-medium text-green-600 dark:text-green-400">{{ t('payment.currentBalance') }}: {{ user?.balance?.toFixed(2) || '0.00' }}</p>
              </div>
            </div>
            <div class="card p-6">
              <p class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{{ t('purchase.rechargeAmount') }}</p>
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                <button
                  v-for="quickAmount in quickAmounts"
                  :key="quickAmount"
                  type="button"
                  class="rounded-xl border px-4 py-3 text-sm font-semibold transition"
                  :class="amount === quickAmount ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300' : 'border-gray-200 bg-white text-gray-700 hover:border-primary-300 dark:border-dark-600 dark:bg-dark-800 dark:text-gray-200'"
                  @click="setQuickAmount(quickAmount)"
                >
                  ¥{{ quickAmount }}
                </button>
              </div>
              <label class="mt-4 block text-sm font-medium text-gray-700 dark:text-gray-300" for="purchase-custom-amount">{{ t('purchase.customAmount') }}</label>
              <input
                id="purchase-custom-amount"
                v-model.number="amount"
                type="number"
                inputmode="decimal"
                class="input mt-2"
                :min="globalMinAmount || 1"
                :max="globalMaxAmount || 1000"
                placeholder="1 - 1000"
              />
              <p v-if="amountError" class="mt-2 text-xs text-amber-600 dark:text-amber-300">{{ amountError }}</p>
            </div>
            <div v-if="enabledMethods.length >= 1" class="card p-6">
              <PaymentMethodSelector
                :methods="methodOptions"
                :selected="selectedMethod"
                @select="selectedMethod = $event"
              />
            </div>
            <div v-else class="card p-6">
              <p class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{{ t('payment.paymentMethod') }}</p>
              <div class="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled
                  data-testid="fallback-payment-method-alipay"
                  class="flex h-[60px] cursor-not-allowed items-center justify-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 text-gray-500 opacity-75 dark:border-dark-700 dark:bg-dark-800/50 dark:text-gray-400"
                >
                  <span class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#02A9F1] text-base font-bold text-white">支</span>
                  <span class="flex flex-col items-start leading-tight">
                    <span class="text-base font-semibold">{{ t('payment.methods.alipay') }}</span>
                    <span class="text-[11px]">{{ t('purchase.alipayPendingConfig') }}</span>
                  </span>
                </button>
                <button
                  type="button"
                  disabled
                  data-testid="fallback-payment-method-paypal"
                  class="flex h-[60px] cursor-not-allowed items-center justify-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 text-gray-500 opacity-75 dark:border-dark-700 dark:bg-dark-800/50 dark:text-gray-400"
                >
                  <span class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#003087] text-xs font-bold text-white">PP</span>
                  <span class="flex flex-col items-start leading-tight">
                    <span class="text-base font-semibold">{{ t('purchase.paypalLabel') }}</span>
                    <span class="text-[11px]">{{ t('purchase.paypalNotSupported') }}</span>
                  </span>
                </button>
              </div>
              <div class="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-center dark:border-amber-500/30 dark:bg-amber-500/10">
                <Icon name="creditCard" size="lg" class="mx-auto mb-3 text-amber-500 dark:text-amber-300" />
                <p class="text-sm font-semibold text-gray-900 dark:text-white">
                  {{ t('purchase.paymentMethodsNotConfiguredTitle') }}
                </p>
                <p class="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-600 dark:text-gray-300">
                  {{ t('purchase.paymentMethodsNotConfiguredDesc') }}
                </p>
              </div>
            </div>
            <div v-if="validAmount > 0" class="card p-6">
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-500 dark:text-gray-400">{{ t('payment.paymentAmount') }}</span>
                  <span class="text-gray-900 dark:text-white">¥{{ validAmount.toFixed(2) }}</span>
                </div>
                <div v-if="feeRate > 0" class="flex justify-between">
                  <span class="text-gray-500 dark:text-gray-400">{{ t('payment.fee') }} ({{ feeRate }}%)</span>
                  <span class="text-gray-900 dark:text-white">¥{{ feeAmount.toFixed(2) }}</span>
                </div>
                <div v-if="feeRate > 0" class="flex justify-between border-t border-gray-200 pt-2 dark:border-dark-600">
                  <span class="font-medium text-gray-700 dark:text-gray-300">{{ t('payment.actualPay') }}</span>
                  <span class="text-lg font-bold text-primary-600 dark:text-primary-400">¥{{ totalAmount.toFixed(2) }}</span>
                </div>
                <div v-if="balanceRechargeMultiplier !== 1" class="flex justify-between" :class="{ 'border-t border-gray-200 pt-2 dark:border-dark-600': feeRate <= 0 }">
                  <span class="text-gray-500 dark:text-gray-400">{{ t('payment.creditedBalance') }}</span>
                  <span class="text-gray-900 dark:text-white">${{ creditedAmount.toFixed(2) }}</span>
                </div>
                <p v-if="balanceRechargeMultiplier !== 1" class="border-t border-gray-200 pt-2 text-xs text-gray-500 dark:border-dark-600 dark:text-gray-400">
                  {{ t('payment.rechargeRatePreview', { usd: balanceRechargeMultiplier.toFixed(2) }) }}
                </p>
              </div>
            </div>
            <div
              v-if="pendingOrdersBlocked"
              class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
            >
              {{ t('purchase.pendingOrdersBlocked', { count: pendingOrders, max: maxPendingOrders }) }}
            </div>
            <button :class="['btn w-full py-3 text-base font-medium', paymentButtonClass]" :disabled="!canSubmit || submitting" @click="handleSubmitRecharge">
              <span v-if="submitting" class="flex items-center justify-center gap-2">
                <span class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                {{ t('common.processing') }}
              </span>
              <span v-else>{{ rechargeSubmitLabel }}</span>
            </button>
            <div class="card p-5">
              <p class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{{ t('purchase.flowTitle') }}</p>
              <div class="grid grid-cols-2 gap-3 text-sm text-gray-600 dark:text-gray-300 sm:grid-cols-4">
                <div
                  v-for="step in purchaseFlowSteps"
                  :key="step.key"
                  data-testid="purchase-flow-step"
                  class="flex flex-col items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-4 text-center dark:border-dark-700 dark:bg-dark-800"
                >
                  <span class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    <Icon :name="step.icon" size="sm" />
                  </span>
                  <span class="font-medium">{{ t(step.labelKey) }}</span>
                </div>
              </div>
            </div>
          </template>
          <!-- Subscribe Tab -->
          <template v-else-if="activeTab === 'subscription'">
            <!-- Subscription confirm (inline, replaces plan list) -->
            <template v-if="selectedPlan">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  class="inline-flex w-fit items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-dark-700 dark:text-gray-200 dark:hover:bg-dark-800"
                  @click="selectedPlan = null"
                >
                  {{ t('purchase.backToPlans') }}
                </button>
                <h2 class="text-xl font-bold text-gray-950 dark:text-white">{{ t('purchase.confirmOrder') }}</h2>
              </div>
              <div class="card p-5">
                <!-- Header: platform badge + plan name -->
                <div class="mb-3 flex flex-wrap items-center gap-2">
                  <span :class="['rounded-md border px-2 py-0.5 text-xs font-medium', planBadgeClass]">
                    {{ platformLabel(selectedPlan.group_platform || '') }}
                  </span>
                  <h3 class="text-lg font-bold text-gray-900 dark:text-white">{{ selectedPlan.name }}</h3>
                </div>
                <div v-if="selectedPlanTags.length > 0" class="mb-3 flex flex-wrap gap-2">
                  <span
                    v-for="tag in selectedPlanTags"
                    :key="tag"
                    class="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-dark-800 dark:text-gray-300"
                  >
                    {{ tag }}
                  </span>
                </div>
                <!-- Price -->
                <div class="flex items-baseline gap-2">
                  <span v-if="selectedPlan.original_price" class="text-sm text-gray-400 line-through dark:text-gray-500">
                    ¥{{ selectedPlan.original_price }}
                  </span>
                  <span :class="['text-3xl font-bold', planTextClass]">¥{{ selectedPlan.price }}</span>
                  <span class="text-sm text-gray-500 dark:text-gray-400">/ {{ planValiditySuffix }}</span>
                </div>
                <p v-if="selectedPlanPrimaryFeature" class="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                  {{ selectedPlanPrimaryFeature }}
                </p>
                <div class="mt-3 grid grid-cols-2 gap-3">
                  <div v-for="metric in selectedPlanMetrics" :key="metric.label">
                    <span class="text-xs text-gray-400 dark:text-gray-500">{{ metric.label }}</span>
                    <div class="text-lg font-semibold text-gray-800 dark:text-gray-200">{{ metric.value }}</div>
                  </div>
                </div>
              </div>
              <div v-if="enabledMethods.length >= 1" class="card p-6">
                <p class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{{ t('payment.paymentMethod') }}</p>
                <PaymentMethodSelector
                  :methods="subMethodOptions"
                  :selected="selectedMethod"
                  @select="selectedMethod = $event"
                />
              </div>
              <div v-else class="card p-6">
                <p class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{{ t('payment.paymentMethod') }}</p>
                <div class="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled
                    class="flex h-[60px] cursor-not-allowed items-center justify-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 text-gray-500 opacity-75 dark:border-dark-700 dark:bg-dark-800/50 dark:text-gray-400"
                  >
                    <span class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#02A9F1] text-base font-bold text-white">支</span>
                    <span class="flex flex-col items-start leading-tight">
                      <span class="text-base font-semibold">{{ t('payment.methods.alipay') }}</span>
                      <span class="text-[11px]">{{ t('purchase.alipayPendingConfig') }}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled
                    class="flex h-[60px] cursor-not-allowed items-center justify-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 text-gray-500 opacity-75 dark:border-dark-700 dark:bg-dark-800/50 dark:text-gray-400"
                  >
                    <span class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#003087] text-xs font-bold text-white">PP</span>
                    <span class="flex flex-col items-start leading-tight">
                      <span class="text-base font-semibold">{{ t('purchase.paypalLabel') }}</span>
                      <span class="text-[11px]">{{ t('purchase.paypalNotSupported') }}</span>
                    </span>
                  </button>
                </div>
                <div class="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-center dark:border-amber-500/30 dark:bg-amber-500/10">
                  <Icon name="creditCard" size="lg" class="mx-auto mb-3 text-amber-500 dark:text-amber-300" />
                  <p class="text-sm font-semibold text-gray-900 dark:text-white">
                    {{ t('purchase.paymentMethodsNotConfiguredTitle') }}
                  </p>
                  <p class="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-600 dark:text-gray-300">
                    {{ t('purchase.paymentMethodsNotConfiguredDesc') }}
                  </p>
                </div>
              </div>
              <div v-if="selectedPlan.price > 0" class="card p-6">
                <div class="space-y-2 text-sm">
                  <div v-if="feeRate > 0" class="flex justify-between">
                    <span class="text-gray-500 dark:text-gray-400">{{ t('payment.amountLabel') }}</span>
                    <span class="text-gray-900 dark:text-white">¥{{ selectedPlan.price.toFixed(2) }}</span>
                  </div>
                  <div v-if="feeRate > 0" class="flex justify-between">
                    <span class="text-gray-500 dark:text-gray-400">{{ t('payment.fee') }} ({{ feeRate }}%)</span>
                    <span class="text-gray-900 dark:text-white">¥{{ subFeeAmount.toFixed(2) }}</span>
                  </div>
                  <div class="flex justify-between border-t border-gray-200 pt-2 dark:border-dark-600">
                    <span class="font-medium text-gray-700 dark:text-gray-300">{{ t('purchase.payableAmount') }}</span>
                    <span class="text-lg font-bold text-primary-600 dark:text-primary-400">¥{{ subTotalAmount.toFixed(2) }}</span>
                  </div>
                </div>
              </div>
              <div
                v-if="pendingOrdersBlocked"
                class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
              >
                {{ t('purchase.pendingOrdersBlocked', { count: pendingOrders, max: maxPendingOrders }) }}
              </div>
              <button :class="['btn w-full py-3 text-base font-medium', paymentButtonClass]" :disabled="!canSubmitSubscription || submitting" @click="confirmSubscribe">
                <span v-if="submitting" class="flex items-center justify-center gap-2">
                  <span class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                  {{ t('common.processing') }}
                </span>
                <span v-else>{{ subscriptionSubmitLabel }}</span>
              </button>
            </template>
            <!-- Plan list -->
            <template v-else>
              <div v-if="checkout.plans.length === 0" class="card py-16 text-center">
                <Icon name="gift" size="xl" class="mx-auto mb-3 text-gray-300 dark:text-dark-600" />
                <p class="text-gray-500 dark:text-gray-400">{{ t('payment.noPlans') }}</p>
              </div>
              <div v-else :class="planGridClass">
                <SubscriptionPlanCard v-for="plan in checkout.plans" :key="plan.id" :plan="plan" :active-subscriptions="activeSubscriptions" @select="selectPlan" />
              </div>
              <!-- Active subscriptions (compact, below plan list) -->
              <div v-if="activeSubscriptions.length > 0">
                <p class="mb-2 text-xs font-medium text-gray-400 dark:text-gray-500">{{ t('payment.activeSubscription') }}</p>
                <div class="space-y-2">
                  <div v-for="sub in activeSubscriptions" :key="sub.id"
                    class="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-3 py-2 dark:border-dark-700 dark:bg-dark-800">
                    <div :class="['h-6 w-1 shrink-0 rounded-full', platformAccentBarClass(sub.group?.platform || '')]" />
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-1.5">
                        <span class="truncate text-xs font-semibold text-gray-900 dark:text-white">{{ sub.group?.name || t('payment.groupFallback', { id: sub.group_id }) }}</span>
                        <span :class="['shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium', platformBadgeLightClass(sub.group?.platform || '')]">{{ platformLabel(sub.group?.platform || '') }}</span>
                      </div>
                      <div class="flex flex-wrap gap-x-3 text-[11px] text-gray-400 dark:text-gray-500">
                        <span>{{ t('payment.planCard.rate') }}: ×{{ sub.group?.rate_multiplier ?? 1 }}</span>
                        <span v-if="sub.group?.daily_limit_usd == null && sub.group?.weekly_limit_usd == null && sub.group?.monthly_limit_usd == null">{{ t('payment.planCard.quota') }}: {{ t('payment.planCard.unlimited') }}</span>
                        <span v-if="sub.expires_at">{{ t('userSubscriptions.daysRemaining', { days: getDaysRemaining(sub.expires_at) }) }}</span>
                        <span v-else>{{ t('userSubscriptions.noExpiration') }}</span>
                      </div>
                    </div>
                    <span class="badge badge-success shrink-0 text-[10px]">{{ t('userSubscriptions.status.active') }}</span>
                  </div>
                </div>
              </div>
              <div class="card p-5">
                <p class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{{ t('purchase.flowTitle') }}</p>
                <div class="grid grid-cols-2 gap-3 text-sm text-gray-600 dark:text-gray-300 sm:grid-cols-4">
                  <div
                    v-for="step in purchaseFlowSteps"
                    :key="step.key"
                    data-testid="purchase-flow-step"
                    class="flex flex-col items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-4 text-center dark:border-dark-700 dark:bg-dark-800"
                  >
                    <span class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      <Icon :name="step.icon" size="sm" />
                    </span>
                    <span class="font-medium">{{ t(step.labelKey) }}</span>
                  </div>
                </div>
              </div>
            </template>
          </template>
        </template>
        <div v-if="(checkout.help_text || checkout.help_image_url) && paymentPhase === 'select' && !selectedPlan" class="card p-4">
          <div class="flex flex-col items-center gap-3">
            <img v-if="checkout.help_image_url" :src="checkout.help_image_url" alt=""
              class="h-40 max-w-full cursor-pointer rounded-lg object-contain transition-opacity hover:opacity-80"
              @click="previewImage = checkout.help_image_url" />
            <p v-if="checkout.help_text" class="text-center text-sm text-gray-500 dark:text-gray-400">{{ checkout.help_text }}</p>
          </div>
        </div>
    </div>
    <!-- Renewal Plan Selection Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showRenewalModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" @click.self="closeRenewalModal">
          <div class="relative w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-dark-700 dark:bg-dark-900">
            <!-- Close button -->
            <button class="absolute right-4 top-4 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-dark-700 dark:hover:text-gray-200" @click="closeRenewalModal">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">{{ t('payment.selectPlan') }}</h3>
            <div class="space-y-4">
              <SubscriptionPlanCard v-for="plan in renewalPlans" :key="plan.id" :plan="plan" :active-subscriptions="activeSubscriptions" @select="selectPlanFromModal" />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
    <!-- Image Preview Overlay -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="previewImage" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm" @click="previewImage = ''">
          <img :src="previewImage" alt="" class="max-h-[85vh] max-w-[90vw] rounded-xl object-contain shadow-2xl" />
        </div>
      </Transition>
    </Teleport>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePaymentStore } from '@/stores/payment'
import { useSubscriptionStore } from '@/stores/subscriptions'
import { useAppStore } from '@/stores'
import { paymentAPI } from '@/api/payment'
import { extractApiErrorMessage, extractI18nErrorMessage } from '@/utils/apiError'
import { isMobileDevice } from '@/utils/device'
import type { SubscriptionPlan, CheckoutInfoResponse, CreateOrderResult, OrderType, PaymentOrder } from '@/types/payment'
import AppLayout from '@/components/layout/AppLayout.vue'
import PaymentMethodSelector from '@/components/payment/PaymentMethodSelector.vue'
import { METHOD_ORDER, getPaymentPopupFeatures } from '@/components/payment/providerConfig'
import {
  PAYMENT_RECOVERY_STORAGE_KEY,
  buildCreateOrderPayload,
  clearPaymentRecoverySnapshot,
  decidePaymentLaunch,
  getVisibleMethods,
  normalizeVisibleMethod,
  readPaymentRecoverySnapshot,
  type PaymentRecoverySnapshot,
  writePaymentRecoverySnapshot,
} from '@/components/payment/paymentFlow'
import { platformAccentBarClass, platformBadgeLightClass, platformBadgeClass, platformTextClass, platformLabel } from '@/utils/platformColors'
import { buildEmbeddedUrl, detectTheme } from '@/utils/embedded-url'
import SubscriptionPlanCard from '@/components/payment/SubscriptionPlanCard.vue'
import PaymentStatusPanel from '@/components/payment/PaymentStatusPanel.vue'
import Icon from '@/components/icons/Icon.vue'
import type { PaymentMethodOption } from '@/components/payment/PaymentMethodSelector.vue'
import { buildPaymentErrorToastMessage, describePaymentScenarioError } from './paymentUx'
import { hasWechatResumeQuery, parseWechatResumeRoute, stripWechatResumeQuery } from './paymentWechatResume'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const paymentStore = usePaymentStore()
const subscriptionStore = useSubscriptionStore()
const appStore = useAppStore()

const user = computed(() => authStore.user)
const rechargeAccountLabel = computed(() => {
  const account = user.value
  return account?.username?.trim() || account?.email?.trim() || ''
})
const activeSubscriptions = computed(() => subscriptionStore.activeSubscriptions)
const currentTheme = ref<'light' | 'dark'>(detectTheme())
const nativePaymentEnabled = computed(() => appStore.cachedPublicSettings?.payment_enabled === true)
const externalPurchaseEnabled = computed(() => appStore.cachedPublicSettings?.purchase_subscription_enabled === true)
const externalPurchaseRawUrl = computed(() => appStore.cachedPublicSettings?.purchase_subscription_url?.trim() || '')
const externalPurchaseActive = computed(() => !nativePaymentEnabled.value && externalPurchaseEnabled.value)
const purchaseDisabled = computed(() => !nativePaymentEnabled.value && !externalPurchaseEnabled.value)
const externalPurchaseUrl = computed(() => {
  if (!externalPurchaseRawUrl.value) return ''
  return buildEmbeddedUrl(
    externalPurchaseRawUrl.value,
    user.value?.id,
    authStore.token,
    currentTheme.value,
    String(locale.value || ''),
  )
})

function getDaysRemaining(expiresAt: string): number {
  const diff = new Date(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

const loading = ref(true)
const submitting = ref(false)
const errorMessage = ref('')
const errorHintMessage = ref('')
const activeTab = ref<'recharge' | 'subscription'>('recharge')
const amount = ref<number | null>(null)
const selectedMethod = ref('')
const selectedPlan = ref<SubscriptionPlan | null>(null)
const previewImage = ref('')
const purchaseOrdersVisible = ref(false)
const purchaseOrdersLoading = ref(false)
const purchaseOrdersActionLoading = ref<number | null>(null)
const purchaseOrdersStatus = ref('')
const purchaseOrders = ref<PaymentOrder[]>([])
const quickAmounts = [10, 20, 50, 100, 200, 500, 1000, 2000]
const purchaseFlowSteps: {
  key: string
  icon: 'clipboard' | 'creditCard' | 'key' | 'bolt'
  labelKey: string
}[] = [
  { key: 'select', icon: 'clipboard', labelKey: 'purchase.flowSelectPlan' },
  { key: 'pay', icon: 'creditCard', labelKey: 'purchase.flowPay' },
  { key: 'code', icon: 'key', labelKey: 'purchase.flowGetCode' },
  { key: 'activate', icon: 'bolt', labelKey: 'purchase.flowActivate' },
]

const paymentPhase = ref<'select' | 'paying'>('select')

interface CreateOrderOptions {
  openid?: string
  wechatResumeToken?: string
  paymentType?: string
  isResume?: boolean
  mobileQrFallbackAttempted?: boolean
}

interface WeixinJSBridgeLike {
  invoke(
    action: string,
    payload: Record<string, unknown>,
    callback: (result: Record<string, unknown>) => void,
  ): void
}

function emptyPaymentState(): PaymentRecoverySnapshot {
  return {
    orderId: 0,
    amount: 0,
    qrCode: '',
    expiresAt: '',
    paymentType: '',
    payUrl: '',
    outTradeNo: '',
    clientSecret: '',
    intentId: '',
    currency: '',
    countryCode: '',
    paymentEnv: '',
    payAmount: 0,
    orderType: '',
    paymentMode: '',
    resumeToken: '',
    createdAt: 0,
  }
}

function getWeixinJSBridge(): WeixinJSBridgeLike | undefined {
  return (window as Window & { WeixinJSBridge?: WeixinJSBridgeLike }).WeixinJSBridge
}

function waitForWeixinJSBridge(timeoutMs = 4000): Promise<WeixinJSBridgeLike | null> {
  const existing = getWeixinJSBridge()
  if (existing) return Promise.resolve(existing)

  return new Promise((resolve) => {
    let settled = false
    const finish = (bridge: WeixinJSBridgeLike | null) => {
      if (settled) return
      settled = true
      document.removeEventListener('WeixinJSBridgeReady', handleReady)
      document.removeEventListener('onWeixinJSBridgeReady', handleReady)
      window.clearTimeout(timer)
      resolve(bridge)
    }
    const handleReady = () => finish(getWeixinJSBridge() ?? null)
    const timer = window.setTimeout(() => finish(getWeixinJSBridge() ?? null), timeoutMs)
    document.addEventListener('WeixinJSBridgeReady', handleReady, false)
    document.addEventListener('onWeixinJSBridgeReady', handleReady, false)
  })
}

async function invokeWechatJsapiPayment(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const bridge = await waitForWeixinJSBridge()
  if (!bridge) {
    throw new Error('WECHAT_JSAPI_UNAVAILABLE')
  }
  return new Promise((resolve) => {
    bridge.invoke('getBrandWCPayRequest', payload, (result) => resolve(result || {}))
  })
}

const paymentState = ref<PaymentRecoverySnapshot>(emptyPaymentState())

function persistRecoverySnapshot(snapshot: PaymentRecoverySnapshot) {
  if (typeof window === 'undefined' || !snapshot.orderId) return
  writePaymentRecoverySnapshot(window.localStorage, snapshot, PAYMENT_RECOVERY_STORAGE_KEY)
}

function removeRecoverySnapshot() {
  if (typeof window === 'undefined') return
  clearPaymentRecoverySnapshot(window.localStorage, PAYMENT_RECOVERY_STORAGE_KEY)
}

function resetPayment() {
  paymentPhase.value = 'select'
  paymentState.value = emptyPaymentState()
  removeRecoverySnapshot()
}

async function redirectToPaymentResult(state: PaymentRecoverySnapshot): Promise<void> {
  const query: Record<string, string | undefined> = {}
  if (state.orderId > 0) {
    query.order_id = String(state.orderId)
  }
  if (state.outTradeNo) {
    query.out_trade_no = state.outTradeNo
  }
  if (state.resumeToken) {
    query.resume_token = state.resumeToken
  }
  await router.push({
    path: '/payment/result',
    query,
  })
}

function buildWechatOAuthAuthorizeUrl(
  authorizeUrl: string,
  context: { paymentType: string; orderType: OrderType; planId?: number; orderAmount: number },
): string {
  const normalizedUrl = authorizeUrl.trim()
  if (!normalizedUrl || typeof window === 'undefined') {
    return normalizedUrl
  }

  try {
    const targetUrl = new URL(normalizedUrl, window.location.origin)
    const redirectPath = targetUrl.searchParams.get('redirect') || '/purchase'
    const redirectUrl = new URL(redirectPath, window.location.origin)
    const paymentType = normalizeVisibleMethod(context.paymentType) || context.paymentType.trim() || 'wxpay'

    redirectUrl.searchParams.set('payment_type', paymentType)
    redirectUrl.searchParams.set('order_type', context.orderType)

    if (context.planId) {
      redirectUrl.searchParams.set('plan_id', String(context.planId))
    } else {
      redirectUrl.searchParams.delete('plan_id')
    }

    if (context.orderAmount > 0) {
      redirectUrl.searchParams.set('amount', String(context.orderAmount))
    } else {
      redirectUrl.searchParams.delete('amount')
    }

    targetUrl.searchParams.set('redirect', `${redirectUrl.pathname}${redirectUrl.search}`)
    return targetUrl.toString()
  } catch {
    return normalizedUrl
  }
}

function onPaymentDone() {
  const wasSubscription = paymentState.value.orderType === 'subscription'
  resetPayment()
  selectedPlan.value = null
  if (purchaseOrdersVisible.value) {
    loadPurchaseOrders().catch(() => {})
  }
  if (wasSubscription) {
    subscriptionStore.fetchActiveSubscriptions(true).catch(() => {})
  }
}

function onPaymentSuccess() {
  removeRecoverySnapshot()
  authStore.refreshUser()
  if (paymentState.value.orderType === 'subscription') {
    subscriptionStore.fetchActiveSubscriptions(true).catch(() => {})
  }
}

function onPaymentSettled() {
  removeRecoverySnapshot()
}

// All checkout data from single API call
const checkout = ref<CheckoutInfoResponse>({
  methods: {}, global_min: 0, global_max: 0,
  plans: [], balance_disabled: false, balance_recharge_multiplier: 1, recharge_fee_rate: 0, pending_orders: 0, max_pending_orders: 3, help_text: '', help_image_url: '', stripe_publishable_key: '',
})

const purchaseOrderFilterOptions = computed(() => [
  { value: '', label: t('common.all') },
  { value: 'PENDING', label: t('payment.status.pending') },
  { value: 'COMPLETED', label: t('payment.status.completed') },
  { value: 'FAILED', label: t('payment.status.failed') },
  { value: 'REFUND_REQUESTED', label: t('payment.status.refund_requested') },
  { value: 'REFUNDING', label: t('payment.status.refunding') },
  { value: 'PARTIALLY_REFUNDED', label: t('payment.status.partially_refunded') },
  { value: 'REFUNDED', label: t('payment.status.refunded') },
  { value: 'REFUND_FAILED', label: t('payment.status.refund_failed') },
  { value: 'CANCELLED', label: t('payment.status.cancelled') },
  { value: 'EXPIRED', label: t('payment.status.expired') },
])

function setQuickAmount(value: number) {
  amount.value = value
}

async function loadPurchaseOrders() {
  purchaseOrdersLoading.value = true
  try {
    const params: { page: number; page_size: number; status?: string } = { page: 1, page_size: 20 }
    if (purchaseOrdersStatus.value) {
      params.status = purchaseOrdersStatus.value
    }
    const res = await paymentAPI.getMyOrders(params)
    purchaseOrders.value = res.data.items || []
  } catch (err: unknown) {
    appStore.showError(extractI18nErrorMessage(err, t, 'payment.errors', t('common.error')))
  } finally {
    purchaseOrdersLoading.value = false
  }
}

async function changePurchaseOrdersFilter(status: string) {
  purchaseOrdersStatus.value = status
  await loadPurchaseOrders()
}

async function openOrders() {
  purchaseOrdersVisible.value = !purchaseOrdersVisible.value
  if (purchaseOrdersVisible.value) {
    await loadPurchaseOrders()
  }
}

function openFullOrdersPage() {
  router.push('/orders')
}

async function cancelPurchaseOrder(order: PaymentOrder) {
  if (order.status !== 'PENDING') return
  if (typeof window !== 'undefined' && !window.confirm(t('payment.confirmCancel'))) return

  purchaseOrdersActionLoading.value = order.id
  try {
    await paymentAPI.cancelOrder(order.id)
    appStore.showInfo(t('common.success'))
    await loadCheckoutInfo()
    await loadPurchaseOrders()
  } catch (err: unknown) {
    appStore.showError(extractI18nErrorMessage(err, t, 'payment.errors', t('common.error')))
  } finally {
    purchaseOrdersActionLoading.value = null
  }
}

function formatOrderPayAmount(order: PaymentOrder) {
  return `¥${Number(order.pay_amount || order.amount || 0).toFixed(2)}`
}

function formatOrderDate(dateStr: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString()
}

function syncSelectedPaymentMethod() {
  if (!enabledMethods.value.length) {
    selectedMethod.value = ''
    return
  }
  if (selectedMethod.value && enabledMethods.value.includes(selectedMethod.value)) {
    return
  }
  const order: readonly string[] = METHOD_ORDER
  const sorted = [...enabledMethods.value].sort((a, b) => {
    const ai = order.indexOf(a)
    const bi = order.indexOf(b)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })
  selectedMethod.value = sorted[0]
}

async function loadCheckoutInfo() {
  const res = await paymentAPI.getCheckoutInfo()
  checkout.value = res.data
  syncSelectedPaymentMethod()
}

async function refreshCheckoutInfo() {
  try {
    await loadCheckoutInfo()
    appStore.showInfo(t('purchase.refreshed'))
  } catch (err: unknown) {
    appStore.showError(extractI18nErrorMessage(err, t, 'payment.errors', t('common.error')))
  }
}

const tabs = computed(() => {
  const result: { key: 'recharge' | 'subscription'; label: string }[] = []
  if (!checkout.value.balance_disabled) result.push({ key: 'recharge', label: t('payment.tabTopUp') })
  result.push({ key: 'subscription', label: t('payment.tabSubscribe') })
  return result
})

const visibleMethods = computed(() => getVisibleMethods(checkout.value.methods))
const enabledMethods = computed(() => Object.keys(visibleMethods.value))
const validAmount = computed(() => amount.value ?? 0)
const balanceRechargeMultiplier = computed(() => {
  const multiplier = checkout.value.balance_recharge_multiplier
  return multiplier > 0 ? multiplier : 1
})
const creditedAmount = computed(() => Math.round((validAmount.value * balanceRechargeMultiplier.value) * 100) / 100)
const pendingOrders = computed(() => Math.max(0, checkout.value.pending_orders ?? 0))
const maxPendingOrders = computed(() => {
  const configured = checkout.value.max_pending_orders ?? 3
  return configured > 0 ? configured : 3
})
const pendingOrdersBlocked = computed(() => pendingOrders.value >= maxPendingOrders.value)

// Adaptive grid: center single card, 2-col for 2 plans, 3-col for 3+
const planGridClass = computed(() => {
  const n = checkout.value.plans.length
  if (n <= 2) return 'grid grid-cols-1 gap-5 sm:grid-cols-2'
  return 'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3'
})

// Check if an amount fits a method's [min, max]. 0 = no limit.
function amountFitsMethod(amt: number, methodType: string): boolean {
  if (amt <= 0) return true
  const ml = visibleMethods.value[methodType]
  if (!ml) return false
  if (ml.single_min > 0 && amt < ml.single_min) return false
  if (ml.single_max > 0 && amt > ml.single_max) return false
  return true
}

// Visible methods decide the amount range shown to users.
const globalMinAmount = computed(() => {
  const limits = Object.values(visibleMethods.value)
  if (limits.length === 0) return 0
  if (limits.some(limit => limit.single_min <= 0)) return 0
  return Math.min(...limits.map(limit => limit.single_min))
})
const globalMaxAmount = computed(() => {
  const limits = Object.values(visibleMethods.value)
  if (limits.length === 0) return 0
  if (limits.some(limit => limit.single_max <= 0)) return 0
  return Math.max(...limits.map(limit => limit.single_max))
})

// Selected method's limits (for validation and error messages)
const selectedLimit = computed(() => visibleMethods.value[selectedMethod.value])

const referencePaypalMethod: PaymentMethodOption = {
  type: 'paypal',
  fee_rate: 0,
  available: false,
  labelKey: 'purchase.paypalLabel',
  noteKey: 'purchase.paypalNotSupported',
}

function withReferencePaypalMethod(methods: PaymentMethodOption[]): PaymentMethodOption[] {
  if (methods.some(method => method.type === 'paypal')) {
    return methods
  }
  return [...methods, referencePaypalMethod]
}

const methodOptions = computed<PaymentMethodOption[]>(() =>
  withReferencePaypalMethod(enabledMethods.value.map((type) => {
    const ml = visibleMethods.value[type]
    return {
      type,
      fee_rate: ml?.fee_rate ?? 0,
      available: ml?.available !== false && amountFitsMethod(validAmount.value, type),
    }
  }))
)

const feeRate = computed(() => checkout.value?.recharge_fee_rate ?? 0)
const feeAmount = computed(() =>
  feeRate.value > 0 && validAmount.value > 0
    ? Math.ceil(((validAmount.value * feeRate.value) / 100) * 100) / 100
    : 0
)
const totalAmount = computed(() =>
  feeRate.value > 0 && validAmount.value > 0
    ? Math.round((validAmount.value + feeAmount.value) * 100) / 100
    : validAmount.value
)

const amountError = computed(() => {
  if (validAmount.value <= 0) return ''
  // No method can handle this amount
  if (!enabledMethods.value.some((m) => amountFitsMethod(validAmount.value, m))) {
    return t('payment.amountNoMethod')
  }
  // Selected method can't handle this amount (but others can)
  const ml = selectedLimit.value
  if (ml) {
    if (ml.single_min > 0 && validAmount.value < ml.single_min) return t('payment.amountTooLow', { min: ml.single_min })
    if (ml.single_max > 0 && validAmount.value > ml.single_max) return t('payment.amountTooHigh', { max: ml.single_max })
  }
  return ''
})

const canSubmit = computed(() =>
  validAmount.value > 0
    && amountFitsMethod(validAmount.value, selectedMethod.value)
    && selectedLimit.value?.available !== false
    && !pendingOrdersBlocked.value
)

const rechargeSubmitLabel = computed(() => {
  if (enabledMethods.value.length === 0) return t('purchase.paymentActionUnavailable')
  if (pendingOrdersBlocked.value) return t('purchase.pendingOrdersTooMany')
  return t('purchase.rechargeNow', { amount: totalAmount.value.toFixed(2) })
})

// Subscription-specific: method options based on plan price
const subMethodOptions = computed<PaymentMethodOption[]>(() => {
  const planPrice = selectedPlan.value?.price ?? 0
  return withReferencePaypalMethod(enabledMethods.value.map((type) => {
    const ml = visibleMethods.value[type]
    return {
      type,
      fee_rate: ml?.fee_rate ?? 0,
      available: ml?.available !== false && amountFitsMethod(planPrice, type),
    }
  }))
})

const subFeeAmount = computed(() => {
  const price = selectedPlan.value?.price ?? 0
  if (feeRate.value <= 0 || price <= 0) return 0
  return Math.ceil(((price * feeRate.value) / 100) * 100) / 100
})

const subTotalAmount = computed(() => {
  const price = selectedPlan.value?.price ?? 0
  if (feeRate.value <= 0 || price <= 0) return price
  return Math.round((price + subFeeAmount.value) * 100) / 100
})

const canSubmitSubscription = computed(() =>
  selectedPlan.value !== null
    && amountFitsMethod(selectedPlan.value.price, selectedMethod.value)
    && selectedLimit.value?.available !== false
    && !pendingOrdersBlocked.value
)

const subscriptionSubmitLabel = computed(() => {
  if (enabledMethods.value.length === 0) return t('purchase.paymentActionUnavailable')
  if (pendingOrdersBlocked.value) return t('purchase.pendingOrdersTooMany')
  return t('purchase.buyNow')
})

// Auto-switch to first available method when current selection can't handle the amount
watch(() => [validAmount.value, selectedMethod.value] as const, ([amt, method]) => {
  if (amt <= 0 || amountFitsMethod(amt, method)) return
  const available = enabledMethods.value.find((m) => amountFitsMethod(amt, m))
  if (available) selectedMethod.value = available
})

// Payment button class: follows selected payment method color
const paymentButtonClass = computed(() => {
  const m = selectedMethod.value
  if (!m) return 'btn-primary'
  if (m.includes('alipay')) return 'btn-alipay'
  if (m.includes('wxpay')) return 'btn-wxpay'
  if (m === 'stripe') return 'btn-stripe'
  return 'btn-primary'
})

// Subscription confirm: platform accent colors (clean card, no gradient)
const planBadgeClass = computed(() => platformBadgeClass(selectedPlan.value?.group_platform || ''))
const planTextClass = computed(() => platformTextClass(selectedPlan.value?.group_platform || ''))

// Renewal modal state
const showRenewalModal = ref(false)
const renewGroupId = ref<number | null>(null)
const renewalPlans = computed(() => {
  if (renewGroupId.value == null) return []
  return checkout.value.plans.filter(p => p.group_id === renewGroupId.value)
})

const planValiditySuffix = computed(() => {
  if (!selectedPlan.value) return ''
  const count = selectedPlan.value.validity_days || 1
  const u = selectedPlan.value.validity_unit || 'day'
  if (u === 'month' || u === 'months') return `${count}${t('payment.monthUnit')}`
  if (u === 'week' || u === 'weeks') return `${count}${t('payment.weekUnit')}`
  if (u === 'year' || u === 'years') return `${count}${t('payment.yearUnit')}`
  return `${count}${t('payment.dayUnit')}`
})

const selectedPlanTags = computed(() => {
  const raw = selectedPlan.value?.product_name || ''
  if (!raw) return []
  return raw
    .split(/[\n,，]/)
    .map(item => item.trim())
    .filter(Boolean)
})

function formatPlanMetric(value: number | null | undefined, maxFractionDigits = 4): string {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric)) return '0'
  return numeric.toLocaleString('en-US', {
    maximumFractionDigits: maxFractionDigits,
    minimumFractionDigits: 0,
    useGrouping: false,
  })
}

function parsePlanConcurrency(plan: SubscriptionPlan | null): string {
  for (const feature of plan?.features || []) {
    const match = feature.match(/并发上限\s*[:：]\s*(\d+)/)
    if (match) return match[1]
  }
  return ''
}

const selectedPlanPrimaryFeature = computed(() => {
  const plan = selectedPlan.value
  if (!plan) return ''
  const feature = (plan.features || []).find(item => !/并发上限\s*[:：]/.test(item))
  return feature || plan.description || ''
})

const selectedPlanMetrics = computed(() => {
  const plan = selectedPlan.value
  if (!plan) return []
  const quotaBase = Math.max(
    Number(plan.daily_limit_usd || 0),
    Number(plan.weekly_limit_usd || 0),
    Number(plan.monthly_limit_usd || 0),
  )
  const concurrency = parsePlanConcurrency(plan)
  const rows = [
    { label: t('payment.planCard.systemRate'), value: `${formatPlanMetric(plan.rate_multiplier ?? 1)}x` },
    { label: t('payment.planCard.packageRate'), value: quotaBase > 0 ? `${formatPlanMetric(plan.price / quotaBase)}x` : '-' },
  ]
  if (concurrency) {
    rows.push({ label: t('payment.planCard.concurrency'), value: concurrency })
  }
  rows.push(
    { label: t('payment.planCard.dailyLimit'), value: `$${formatPlanMetric(plan.daily_limit_usd ?? 0, 2)}` },
    { label: t('payment.planCard.weeklyLimit'), value: `$${formatPlanMetric(plan.weekly_limit_usd ?? 0, 2)}` },
    { label: t('payment.planCard.monthlyLimit'), value: `$${formatPlanMetric(plan.monthly_limit_usd ?? 0, 2)}` },
  )
  return rows
})

function selectPlan(plan: SubscriptionPlan) {
  selectedPlan.value = plan
  errorMessage.value = ''
}

function selectPlanFromModal(plan: SubscriptionPlan) {
  showRenewalModal.value = false
  renewGroupId.value = null
  selectedPlan.value = plan
  errorMessage.value = ''
}

function closeRenewalModal() {
  showRenewalModal.value = false
  renewGroupId.value = null
}

async function handleSubmitRecharge() {
  if (!canSubmit.value || submitting.value) return
  await createOrder(validAmount.value, 'balance')
}

async function confirmSubscribe() {
  if (!selectedPlan.value || submitting.value) return
  await createOrder(selectedPlan.value.price, 'subscription', selectedPlan.value.id)
}

async function createOrder(orderAmount: number, orderType: OrderType, planId?: number, options: CreateOrderOptions = {}) {
  submitting.value = true
  errorMessage.value = ''
  errorHintMessage.value = ''
  const requestType = normalizeVisibleMethod(options.paymentType || selectedMethod.value) || options.paymentType || selectedMethod.value
  try {
    const payload = buildCreateOrderPayload({
      amount: orderAmount,
      paymentType: requestType,
      orderType,
      planId,
      origin: typeof window !== 'undefined' ? window.location.origin : '',
      isMobile: isMobileDevice(),
      isWechatBrowser: typeof window !== 'undefined' && /MicroMessenger/i.test(window.navigator.userAgent),
    })
    if (options.openid) {
      payload.openid = options.openid
    }
    if (options.wechatResumeToken) {
      payload.wechat_resume_token = options.wechatResumeToken
    }

    const result = await paymentStore.createOrder(payload) as CreateOrderResult & { resume_token?: string }
    const openWindow = (url: string) => {
      const win = window.open(url, 'paymentPopup', getPaymentPopupFeatures())
      if (!win || win.closed) {
        window.location.href = url
      }
    }
    const visibleMethod = normalizeVisibleMethod(requestType) || requestType
    // When user clicks the dedicated Stripe button, leave method blank so the
    // landing page renders Stripe's full Payment Element (card/link/alipay/wxpay).
    const stripeMethod = visibleMethod === 'stripe'
      ? ''
      : visibleMethod === 'wxpay' ? 'wechat_pay' : 'alipay'
    const stripeRouteUrl = result.client_secret
      ? router.resolve({
        path: '/payment/stripe',
        query: {
          order_id: String(result.order_id),
          client_secret: result.client_secret,
          method: stripeMethod || undefined,
          resume_token: result.resume_token || undefined,
        },
      }).href
      : ''
    const decision = decidePaymentLaunch(result, {
      visibleMethod,
      orderType,
      isMobile: isMobileDevice(),
      isWechatBrowser: typeof window !== 'undefined' && /MicroMessenger/i.test(window.navigator.userAgent),
      stripePopupUrl: stripeRouteUrl,
      stripeRouteUrl,
    })

    if (decision.kind === 'wechat_oauth' && decision.oauth?.authorize_url) {
      window.location.href = buildWechatOAuthAuthorizeUrl(decision.oauth.authorize_url, {
        paymentType: visibleMethod,
        orderType,
        planId,
        orderAmount,
      })
      return
    }

    if (decision.kind === 'unhandled') {
      applyScenarioError({ reason: 'UNHANDLED_PAYMENT_SCENARIO' }, visibleMethod)
      return
    }

    paymentState.value = decision.paymentState
    paymentPhase.value = 'paying'
    persistRecoverySnapshot(decision.recovery)

    if (decision.kind === 'stripe_popup') {
      openWindow(decision.paymentState.payUrl)
      return
    }
    if (decision.kind === 'stripe_route') {
      window.location.href = decision.paymentState.payUrl
      return
    }
    if (decision.kind === 'wechat_jsapi' && decision.jsapi) {
      try {
        const jsapiResult = await invokeWechatJsapiPayment(decision.jsapi as Record<string, unknown>)
        const errMsg = String(jsapiResult.err_msg || '').toLowerCase()
        if (errMsg.includes('cancel')) {
          appStore.showInfo(t('payment.qr.cancelled'))
          resetPayment()
        } else if (errMsg && !errMsg.includes('ok')) {
          resetPayment()
          const fallbackApplied = await attemptMobileQrFallback(
            { reason: 'WECHAT_JSAPI_FAILED', message: errMsg },
            {
              orderAmount,
              orderType,
              planId,
              paymentType: visibleMethod,
              attempted: options.mobileQrFallbackAttempted === true,
            },
          )
          if (!fallbackApplied) {
            applyScenarioError({ reason: 'WECHAT_JSAPI_FAILED', message: errMsg }, visibleMethod)
          }
        } else {
          const resultState = { ...decision.paymentState }
          resetPayment()
          await redirectToPaymentResult(resultState)
        }
      } catch (err: unknown) {
        resetPayment()
        const fallbackApplied = await attemptMobileQrFallback(err, {
          orderAmount,
          orderType,
          planId,
          paymentType: visibleMethod,
          attempted: options.mobileQrFallbackAttempted === true,
        })
        if (!fallbackApplied) {
          throw err
        }
      }
      return
    }
    if (decision.kind === 'redirect_waiting' && decision.paymentState.payUrl) {
      if (isMobileDevice()) {
        window.location.href = decision.paymentState.payUrl
        return
      }
      openWindow(decision.paymentState.payUrl)
    }
  } catch (err: unknown) {
    const apiErr = err as Record<string, unknown>
    if (apiErr.reason === 'TOO_MANY_PENDING') {
      const metadata = apiErr.metadata as Record<string, unknown> | undefined
      errorMessage.value = t('payment.errors.tooManyPending', { max: metadata?.max || '' })
      errorHintMessage.value = ''
    } else if (apiErr.reason === 'CANCEL_RATE_LIMITED') {
      errorMessage.value = t('payment.errors.cancelRateLimited')
      errorHintMessage.value = ''
    } else if (await attemptMobileQrFallback(err, {
      orderAmount,
      orderType,
      planId,
      paymentType: requestType,
      attempted: options.mobileQrFallbackAttempted === true,
    })) {
      return
    } else {
      const handled = applyScenarioError(
        err,
        normalizeVisibleMethod(options.paymentType || selectedMethod.value) || selectedMethod.value,
      )
      if (!handled) {
        errorMessage.value = extractI18nErrorMessage(err, t, 'payment.errors', extractApiErrorMessage(err, t('payment.result.failed')))
        errorHintMessage.value = ''
      }
      if (handled) {
        return
      }
    }
    appStore.showError(buildPaymentErrorToastMessage(errorMessage.value, errorHintMessage.value))
  } finally {
    submitting.value = false
  }
}

interface MobileQrFallbackContext {
  orderAmount: number
  orderType: OrderType
  planId?: number
  paymentType: string
  attempted: boolean
}

function shouldFallbackToDesktopQr(err: unknown, paymentMethod: string, attempted: boolean): boolean {
  if (attempted || !isMobileDevice()) {
    return false
  }

  const normalizedMethod = normalizeVisibleMethod(paymentMethod) || paymentMethod
  const reason = typeof err === 'object' && err && 'reason' in err && typeof err.reason === 'string'
    ? err.reason
    : ''
  const message = err instanceof Error
    ? err.message
    : (typeof err === 'object' && err && 'message' in err && typeof err.message === 'string'
      ? err.message
      : '')
  const normalizedMessage = message.toLowerCase()

  if (normalizedMethod === 'wxpay') {
    return reason === 'WECHAT_H5_NOT_AUTHORIZED'
      || reason === 'WECHAT_PAYMENT_MP_NOT_CONFIGURED'
      || reason === 'WECHAT_JSAPI_FAILED'
      || reason === 'PAYMENT_GATEWAY_ERROR'
      || reason === 'UNHANDLED_PAYMENT_SCENARIO'
      || normalizedMessage.includes('weixinjsbridge is unavailable')
      || normalizedMessage.includes('wechat_jsapi_unavailable')
  }

  if (normalizedMethod === 'alipay') {
    return reason === 'PAYMENT_GATEWAY_ERROR' || reason === 'UNHANDLED_PAYMENT_SCENARIO'
  }

  return false
}

async function attemptMobileQrFallback(err: unknown, context: MobileQrFallbackContext): Promise<boolean> {
  if (!shouldFallbackToDesktopQr(err, context.paymentType, context.attempted)) {
    return false
  }

  try {
    const visibleMethod = normalizeVisibleMethod(context.paymentType) || context.paymentType
    const payload = buildCreateOrderPayload({
      amount: context.orderAmount,
      paymentType: visibleMethod,
      orderType: context.orderType,
      planId: context.planId,
      origin: typeof window !== 'undefined' ? window.location.origin : '',
      isMobile: false,
      isWechatBrowser: false,
    })
    const result = await paymentStore.createOrder(payload) as CreateOrderResult & { resume_token?: string }
    const stripeMethod = visibleMethod === 'wxpay' ? 'wechat_pay' : 'alipay'
    const stripeRouteUrl = result.client_secret
      ? router.resolve({
        path: '/payment/stripe',
        query: {
          order_id: String(result.order_id),
          client_secret: result.client_secret,
          method: stripeMethod,
          resume_token: result.resume_token || undefined,
        },
      }).href
      : ''
    const decision = decidePaymentLaunch(result, {
      visibleMethod,
      orderType: context.orderType,
      isMobile: false,
      isWechatBrowser: false,
      stripePopupUrl: stripeRouteUrl,
      stripeRouteUrl,
    })

    if (decision.kind !== 'qr_waiting' || !decision.paymentState.qrCode) {
      return false
    }

    errorMessage.value = ''
    errorHintMessage.value = ''
    paymentState.value = decision.paymentState
    paymentPhase.value = 'paying'
    persistRecoverySnapshot(decision.recovery)
    appStore.showWarning(t('payment.errors.mobilePaymentFallbackToQr'))
    return true
  } catch {
    return false
  }
}

function applyScenarioError(err: unknown, paymentMethod: string): boolean {
  const descriptor = describePaymentScenarioError(err, {
    paymentMethod,
    isMobile: isMobileDevice(),
    isWechatBrowser: typeof window !== 'undefined' && /MicroMessenger/i.test(window.navigator.userAgent),
  })
  if (!descriptor) {
    errorMessage.value = ''
    errorHintMessage.value = ''
    return false
  }
  errorMessage.value = t(descriptor.messageKey)
  errorHintMessage.value = descriptor.hintKey ? t(descriptor.hintKey) : ''
  appStore.showError(buildPaymentErrorToastMessage(errorMessage.value, errorHintMessage.value))
  return true
}

async function resumeWechatPaymentFromQuery() {
  const resume = parseWechatResumeRoute(route.query, checkout.value.plans, validAmount.value)
  if (!resume) {
    return
  }

  selectedMethod.value = resume.paymentType
  if (resume.orderType === 'balance' && resume.orderAmount > 0) {
    amount.value = resume.orderAmount
  }
  if (resume.orderType === 'subscription' && resume.planId) {
    selectedPlan.value = checkout.value.plans.find(plan => plan.id === resume.planId) ?? null
  }

  await router.replace({ path: route.path, query: stripWechatResumeQuery(route.query) })

  if (resume.wechatResumeToken) {
    await createOrder(0, resume.orderType, resume.planId, {
      wechatResumeToken: resume.wechatResumeToken,
      paymentType: resume.paymentType,
      isResume: true,
    })
    return
  }

  if (resume.orderAmount > 0 && resume.openid) {
    await createOrder(resume.orderAmount, resume.orderType, resume.planId, {
      openid: resume.openid,
      paymentType: resume.paymentType,
      isResume: true,
    })
  }
}

onMounted(async () => {
  try {
    if (!appStore.publicSettingsLoaded) {
      await appStore.fetchPublicSettings()
    }
    currentTheme.value = detectTheme()
    if (!nativePaymentEnabled.value) {
      return
    }

    await loadCheckoutInfo()
    if (typeof window !== 'undefined') {
      if (hasWechatResumeQuery(route.query)) {
        removeRecoverySnapshot()
      }
      const routeResumeToken = typeof route.query.resume_token === 'string'
        ? route.query.resume_token
        : typeof route.query.wechat_resume_token === 'string'
          ? route.query.wechat_resume_token
          : undefined
      const restored = readPaymentRecoverySnapshot(
        window.localStorage.getItem(PAYMENT_RECOVERY_STORAGE_KEY),
        { resumeToken: routeResumeToken },
      )
      if (restored) {
        paymentState.value = restored
        paymentPhase.value = 'paying'
        const restoredMethod = normalizeVisibleMethod(restored.paymentType)
        if (restoredMethod) {
          selectedMethod.value = restoredMethod
        }
      } else {
        removeRecoverySnapshot()
      }
    }
    await resumeWechatPaymentFromQuery()
    if (checkout.value.balance_disabled) {
      activeTab.value = 'subscription'
    }
    // Handle renewal navigation: ?tab=subscription&group=123
    if (route.query.tab === 'subscription') {
      activeTab.value = 'subscription'
      if (route.query.group) {
        const groupId = Number(route.query.group)
        const groupPlans = checkout.value.plans.filter(p => p.group_id === groupId)
        if (groupPlans.length === 1) {
          selectedPlan.value = groupPlans[0]
        } else if (groupPlans.length > 1) {
          renewGroupId.value = groupId
          showRenewalModal.value = true
        }
      }
    }
  } catch (err: unknown) { appStore.showError(extractI18nErrorMessage(err, t, 'payment.errors', t('common.error'))) }
  finally { loading.value = false }
  // Fetch active subscriptions (uses cache, non-blocking)
  subscriptionStore.fetchActiveSubscriptions().catch(() => {})
})
</script>

<style scoped>
.purchase-page-layout {
  display: flex;
  min-height: calc(100vh - 8rem);
}

.purchase-embed-shell {
  position: relative;
  min-height: 560px;
  height: min(78vh, 860px);
  width: 100%;
  overflow: hidden;
  border: 1px solid rgb(229 231 235);
  border-radius: 0.75rem;
  background: #fff;
  box-shadow: 0 12px 32px rgb(15 23 42 / 0.08);
}

.dark .purchase-embed-shell {
  border-color: rgb(55 65 81);
  background: rgb(17 24 39);
}

.purchase-embed-frame {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #fff;
}

.purchase-open-link {
  position: absolute;
  top: 0.875rem;
  right: 0.875rem;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  border: 1px solid rgb(229 231 235);
  background: rgb(255 255 255 / 0.94);
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: rgb(55 65 81);
  box-shadow: 0 8px 20px rgb(15 23 42 / 0.12);
  backdrop-filter: blur(8px);
}

.purchase-open-link:hover {
  color: rgb(37 99 235);
}

.dark .purchase-open-link {
  border-color: rgb(55 65 81);
  background: rgb(17 24 39 / 0.9);
  color: rgb(229 231 235);
}

.purchase-empty-state {
  padding: 4rem 1.5rem;
  text-align: center;
}

@media (max-width: 640px) {
  .purchase-page-layout {
    min-height: calc(100vh - 6rem);
  }

  .purchase-embed-shell {
    min-height: 640px;
    height: calc(100vh - 6rem);
    border-radius: 0;
  }
}
</style>
