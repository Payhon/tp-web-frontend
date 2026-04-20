<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { fetchPublicAppInfo, type PublicAppInfo } from '@/service/api/app-manage'
import {
  getNestedName,
  getNestedUrl,
  isAndroidUserAgent,
  isIOSUserAgent,
  normalizePublicLang,
  toPublicFileUrl
} from '../shared'

defineOptions({ name: 'PublicAppDownloadPage' })

type FeatureItem = {
  title: string
  description: string
}

const route = useRoute()
const DEFAULT_PUBLIC_APP_ID = '__UNI__40EADE1'
const loading = ref(false)
const errorMessage = ref('')
const appInfo = ref<PublicAppInfo | null>(null)

const appid = computed(() => {
  const value = route.query.appid
  const resolved = typeof value === 'string' ? value.trim() : ''
  return resolved || DEFAULT_PUBLIC_APP_ID
})
const lang = computed(() => normalizePublicLang(route.query.lang))
const userAgent = navigator.userAgent || ''
const isIOS = computed(() => isIOSUserAgent(userAgent))
const isAndroid = computed(() => isAndroidUserAgent(userAgent))

const androidUrl = computed(() => toPublicFileUrl(getNestedUrl(appInfo.value?.app_android)))
const iosUrl = computed(() => getNestedUrl(appInfo.value?.app_ios))
const harmonyUrl = computed(() => toPublicFileUrl(getNestedUrl(appInfo.value?.app_harmony)))
const webUrl = computed(() => getNestedUrl(appInfo.value?.h5))
const iconUrl = computed(() => toPublicFileUrl(appInfo.value?.icon_url || ''))
const screenshots = computed(() => (appInfo.value?.screenshot || []).map(item => toPublicFileUrl(item)).filter(Boolean))
const previewArtwork = computed(() => screenshots.value[0] || iconUrl.value)
const heroText = computed(() => appInfo.value?.introduction || appInfo.value?.description || '')
const descriptionText = computed(() => appInfo.value?.description || '')
const introductionText = computed(() => appInfo.value?.introduction || '')
const localizedBrandName = computed(() => (lang.value === 'en-US' ? 'FUJIA BMS' : '富嘉 BMS'))

function resolveLocalizedAppName(name?: string | null) {
  const resolved = typeof name === 'string' ? name.trim() : ''
  if (!resolved) return localizedBrandName.value
  if (/^fjia\s*bms$/i.test(resolved) || /^fjbms(?:\s+app)?$/i.test(resolved)) {
    return localizedBrandName.value
  }
  return resolved
}

const appDisplayName = computed(() => resolveLocalizedAppName(appInfo.value?.name || dictionary.value.titleFallback))

const privacyUrl = computed(() => {
  const params = new URLSearchParams()
  if (appid.value) params.set('appid', appid.value)
  params.set('lang', lang.value)
  return `/public/app/privacy?${params.toString()}`
})

const userPolicyUrl = computed(() => {
  const params = new URLSearchParams()
  if (appid.value) params.set('appid', appid.value)
  params.set('lang', lang.value)
  return `/public/app/user-policy?${params.toString()}`
})

const dictionary = computed(() => {
  if (lang.value === 'en-US') {
    return {
      titleFallback: 'FUJIA BMS',
      subtitle: 'Battery management and field diagnostics for professional teams.',
      category: 'Utilities',
      primaryLabel: 'Get',
      openStore: 'Open App Store',
      downloadAndroid: 'Download Android APK',
      downloadHarmony: getNestedName(appInfo.value?.app_harmony) || 'Harmony Package',
      openWeb: 'Open Web Entry',
      noAppId: 'Missing appid query parameter.',
      unavailable: 'No download entry is currently available.',
      screenshots: 'Preview',
      appDescription: 'Description',
      appIntroduction: 'What This App Does',
      channels: 'Available Platforms',
      legal: 'Information',
      device: 'Best Match',
      languages: 'Policy Support',
      channelCount: 'Configured Channels',
      available: 'Available now',
      privacy: 'Privacy Policy',
      userPolicy: 'User Agreement',
      moreWays: 'More ways to get the app',
      builtFor: 'Built for operations teams',
      galleryHint: 'Swipe through the actual product screens.',
      ctaHint: 'Choose the channel that fits your device today.',
      stickyTitle: 'Install FUJIA BMS',
      stickySubtitle: 'Open the best channel for your current device.'
    }
  }

  return {
    titleFallback: '富嘉 BMS',
    subtitle: '面向电池运维与现场调试团队的专业 BMS 管理工具。',
    category: '工具',
    primaryLabel: '获取',
    openStore: '前往 App Store',
    downloadAndroid: '下载 Android APK',
    downloadHarmony: getNestedName(appInfo.value?.app_harmony) || 'Harmony 安装包',
    openWeb: '打开 H5 入口',
    noAppId: '缺少 appid 参数',
    unavailable: '当前没有可用下载入口',
    screenshots: '应用预览',
    appDescription: '应用简介',
    appIntroduction: '应用能力',
    channels: '可用平台',
    legal: '信息与协议',
    device: '当前设备匹配',
    languages: '协议语言',
    channelCount: '已配置渠道',
    available: '可立即使用',
    privacy: '隐私政策',
    userPolicy: '用户协议',
    moreWays: '更多获取方式',
    builtFor: '为现场运维场景打造',
    galleryHint: '左右滑动查看真实应用截图。',
    ctaHint: '根据你的设备环境选择最合适的安装方式。',
    stickyTitle: '立即获取 富嘉 BMS',
    stickySubtitle: '下载按钮会按当前设备优先展示。'
  }
})

const primaryAction = computed(() => {
  if (isIOS.value && iosUrl.value) {
    return { label: dictionary.value.openStore, href: iosUrl.value }
  }
  if (isAndroid.value && androidUrl.value) {
    return { label: dictionary.value.downloadAndroid, href: androidUrl.value }
  }
  if (androidUrl.value) {
    return { label: dictionary.value.downloadAndroid, href: androidUrl.value }
  }
  if (iosUrl.value) {
    return { label: dictionary.value.openStore, href: iosUrl.value }
  }
  if (harmonyUrl.value) {
    return { label: dictionary.value.downloadHarmony, href: harmonyUrl.value }
  }
  if (webUrl.value) {
    return { label: dictionary.value.openWeb, href: webUrl.value }
  }
  return null
})

const secondaryActions = computed(() => {
  const actions: Array<{ key: string; label: string; href: string }> = []
  if ((!primaryAction.value || primaryAction.value.href !== androidUrl.value) && androidUrl.value) {
    actions.push({ key: 'android', label: dictionary.value.downloadAndroid, href: androidUrl.value })
  }
  if ((!primaryAction.value || primaryAction.value.href !== iosUrl.value) && iosUrl.value) {
    actions.push({ key: 'ios', label: dictionary.value.openStore, href: iosUrl.value })
  }
  if ((!primaryAction.value || primaryAction.value.href !== harmonyUrl.value) && harmonyUrl.value) {
    actions.push({ key: 'harmony', label: dictionary.value.downloadHarmony, href: harmonyUrl.value })
  }
  if ((!primaryAction.value || primaryAction.value.href !== webUrl.value) && webUrl.value) {
    actions.push({ key: 'web', label: dictionary.value.openWeb, href: webUrl.value })
  }
  return actions
})

const channelCards = computed(() =>
  [
    {
      key: 'android',
      label: dictionary.value.downloadAndroid,
      hint: 'Android',
      href: androidUrl.value
    },
    {
      key: 'ios',
      label: dictionary.value.openStore,
      hint: 'iPhone / iPad',
      href: iosUrl.value
    },
    {
      key: 'harmony',
      label: dictionary.value.downloadHarmony,
      hint: 'HarmonyOS',
      href: harmonyUrl.value
    },
    {
      key: 'web',
      label: dictionary.value.openWeb,
      hint: 'Browser',
      href: webUrl.value
    }
  ].filter(item => Boolean(item.href))
)

const availableChannelCount = computed(() => channelCards.value.length)

const heroStats = computed(() => [
  {
    key: 'device',
    label: dictionary.value.device,
    value: isIOS.value ? 'iOS' : isAndroid.value ? 'Android' : 'All Devices'
  },
  {
    key: 'channels',
    label: dictionary.value.channelCount,
    value: String(availableChannelCount.value).padStart(2, '0')
  },
  {
    key: 'languages',
    label: dictionary.value.languages,
    value: lang.value === 'en-US' ? 'EN / ZH' : '中 / EN'
  }
])

const featureHighlights = computed<FeatureItem[]>(() => {
  if (lang.value === 'en-US') {
    return [
      {
        title: 'Real-time battery status',
        description: 'Track pack health, voltage, current, and core indicators from a single operational view.'
      },
      {
        title: 'Cell-level diagnostics',
        description: 'Review detailed battery behavior quickly during inspection, tuning, and after-sales support.'
      },
      {
        title: 'Protection configuration',
        description: 'Adjust thresholds and parameters with a workflow designed for engineering and field teams.'
      },
      {
        title: 'Multi-device collaboration',
        description:
          'Switch between multiple BMS assets smoothly while keeping public policy and download access clear.'
      }
    ]
  }

  return [
    {
      title: '实时状态总览',
      description: '在一个界面内查看电池包核心运行指标，适合安装调试、巡检与售后诊断。'
    },
    {
      title: '电芯级分析',
      description: '快速定位单体差异与关键波动，减少现场排查时的切换和判断成本。'
    },
    {
      title: '保护参数配置',
      description: '面向工程与运维场景设计参数配置流程，便于完成阈值校验和策略调整。'
    },
    {
      title: '多设备管理',
      description: '在同一入口下切换多个 BMS 资产，并保持下载、协议和公开信息的一致性。'
    }
  ]
})

async function loadAppInfo() {
  loading.value = true
  errorMessage.value = ''
  try {
    const response: any = await fetchPublicAppInfo({ appid: appid.value })
    const data = response?.data || response
    appInfo.value = data || null
    document.title = resolveLocalizedAppName(data?.name || dictionary.value.titleFallback)
  } catch (error: any) {
    appInfo.value = null
    errorMessage.value = error?.message || dictionary.value.unavailable
    document.title = resolveLocalizedAppName(dictionary.value.titleFallback)
  } finally {
    loading.value = false
  }
}

watch(() => route.fullPath, loadAppInfo, { immediate: true })
</script>

<template>
  <main class="appstore-page">
    <div class="appstore-page__ambient appstore-page__ambient--left"></div>
    <div class="appstore-page__ambient appstore-page__ambient--right"></div>

    <div class="appstore-shell">
      <section class="app-header glass-card">
        <div class="app-header__main">
          <div class="app-header__icon-wrap">
            <img v-if="iconUrl" class="app-header__icon" :src="iconUrl" :alt="appDisplayName" />
          </div>

          <div class="app-header__body">
            <p class="app-header__category">{{ dictionary.category }}</p>
            <h1 class="app-header__title">{{ appDisplayName }}</h1>
            <p class="app-header__subtitle">{{ heroText || dictionary.subtitle }}</p>

            <div class="app-header__badges">
              <span class="app-badge">{{ isIOS ? 'iOS' : isAndroid ? 'Android' : 'Web/Desktop' }}</span>
            </div>
          </div>
        </div>

        <div class="app-header__actions">
          <div v-if="loading" class="status-text">{{ lang === 'en-US' ? 'Loading...' : '加载中...' }}</div>
          <div v-else-if="errorMessage" class="status-text status-text--error">{{ errorMessage }}</div>
          <template v-else>
            <a v-if="primaryAction" class="primary-button" :href="primaryAction.href" target="_blank" rel="noreferrer">
              {{ dictionary.primaryLabel }}
            </a>
            <div class="action-hint">{{ dictionary.ctaHint }}</div>
          </template>
        </div>
      </section>

      <section class="hero-stage">
        <div class="hero-story glass-card">
          <p class="hero-story__eyebrow">{{ dictionary.builtFor }}</p>
          <h2 class="hero-story__title">{{ descriptionText || dictionary.subtitle }}</h2>
          <p class="hero-story__body">{{ introductionText || heroText || dictionary.subtitle }}</p>

          <div class="hero-stats">
            <article v-for="stat in heroStats" :key="stat.key" class="hero-stat">
              <strong>{{ stat.value }}</strong>
              <span>{{ stat.label }}</span>
            </article>
          </div>

          <div v-if="secondaryActions.length" class="hero-story__more">
            <span class="hero-story__more-label">{{ dictionary.moreWays }}</span>
            <div class="hero-story__chips">
              <a
                v-for="action in secondaryActions"
                :key="action.key"
                class="secondary-chip"
                :href="action.href"
                target="_blank"
                rel="noreferrer"
              >
                {{ action.label }}
              </a>
            </div>
          </div>
        </div>

        <div class="device-showcase">
          <div class="device-showcase__halo"></div>
          <div class="device-frame">
            <img v-if="previewArtwork" class="device-frame__image" :src="previewArtwork" :alt="appDisplayName" />
          </div>
        </div>
      </section>

      <section v-if="screenshots.length" class="content-section">
        <div class="section-heading">
          <div>
            <h3>{{ dictionary.screenshots }}</h3>
            <p>{{ dictionary.galleryHint }}</p>
          </div>
        </div>

        <div class="screenshots-track">
          <article v-for="(src, index) in screenshots" :key="src" class="screenshot-card">
            <div class="screenshot-card__device">
              <img class="screenshot-card__image" :src="src" :alt="`${appDisplayName} screenshot ${index + 1}`" />
            </div>
            <span class="screenshot-card__index">{{ String(index + 1).padStart(2, '0') }}</span>
          </article>
        </div>
      </section>

      <section class="content-section content-section--split">
        <article class="glass-card section-copy">
          <h3>{{ dictionary.appIntroduction }}</h3>
          <p>{{ introductionText || heroText || dictionary.subtitle }}</p>
          <p v-if="descriptionText">{{ descriptionText }}</p>
        </article>

        <div class="feature-grid">
          <article v-for="feature in featureHighlights" :key="feature.title" class="glass-card feature-card">
            <h4>{{ feature.title }}</h4>
            <p>{{ feature.description }}</p>
          </article>
        </div>
      </section>

      <section v-if="channelCards.length" class="content-section">
        <div class="section-heading">
          <div>
            <h3>{{ dictionary.channels }}</h3>
            <p>{{ dictionary.ctaHint }}</p>
          </div>
        </div>

        <div class="channel-grid">
          <a
            v-for="card in channelCards"
            :key="card.key"
            class="glass-card channel-card"
            :href="card.href"
            target="_blank"
            rel="noreferrer"
          >
            <div class="channel-card__top">
              <span class="channel-card__hint">{{ card.hint }}</span>
              <span class="channel-card__status">{{ dictionary.available }}</span>
            </div>
            <strong>{{ card.label }}</strong>
          </a>
        </div>
      </section>

      <section class="content-section">
        <div class="section-heading">
          <div>
            <h3>{{ dictionary.legal }}</h3>
            <p>{{ lang === 'en-US' ? 'Public pages available without login.' : '公开页面可直接访问，无需登录。' }}</p>
          </div>
        </div>

        <div class="legal-grid">
          <a class="glass-card legal-card" :href="privacyUrl" target="_blank" rel="noreferrer">
            <span class="legal-card__label">{{ dictionary.privacy }}</span>
            <strong>
              {{ lang === 'en-US' ? 'Review privacy practices and permissions.' : '查看隐私说明与权限使用范围。' }}
            </strong>
          </a>
          <a class="glass-card legal-card" :href="userPolicyUrl" target="_blank" rel="noreferrer">
            <span class="legal-card__label">{{ dictionary.userPolicy }}</span>
            <strong>
              {{ lang === 'en-US' ? 'Read service terms before installation.' : '安装前查看服务条款与责任说明。' }}
            </strong>
          </a>
        </div>
      </section>
    </div>

    <div v-if="primaryAction && !loading && !errorMessage" class="sticky-cta">
      <div class="sticky-cta__copy">
        <strong>{{ dictionary.stickyTitle }}</strong>
        <span>{{ dictionary.stickySubtitle }}</span>
      </div>
      <a class="sticky-cta__button" :href="primaryAction.href" target="_blank" rel="noreferrer">
        {{ dictionary.primaryLabel }}
      </a>
    </div>
  </main>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&display=swap');

.appstore-page {
  --page-bg: #ecfeff;
  --surface: rgba(255, 255, 255, 0.74);
  --surface-strong: rgba(255, 255, 255, 0.92);
  --surface-border: rgba(255, 255, 255, 0.68);
  --text-primary: #164e63;
  --text-secondary: #4b6b78;
  --text-muted: #6c8c97;
  --brand: #0891b2;
  --brand-soft: rgba(34, 211, 238, 0.18);
  --cta: #059669;
  --cta-dark: #047857;
  --shadow-xl: 0 28px 80px rgba(8, 59, 76, 0.14);
  --shadow-lg: 0 18px 42px rgba(8, 59, 76, 0.1);
  position: relative;
  min-height: 100vh;
  padding: 20px 16px 112px;
  overflow: hidden;
  background:
    radial-gradient(circle at top left, rgba(34, 211, 238, 0.26), transparent 24%),
    radial-gradient(circle at 85% 16%, rgba(8, 145, 178, 0.18), transparent 18%),
    linear-gradient(180deg, #f4feff 0%, var(--page-bg) 48%, #f7fbff 100%);
  color: var(--text-primary);
  font-family: 'DM Sans', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
}

.appstore-page__ambient {
  position: absolute;
  z-index: 0;
  width: 320px;
  height: 320px;
  border-radius: 50%;
  filter: blur(28px);
  opacity: 0.5;
  pointer-events: none;
}

.appstore-page__ambient--left {
  top: -86px;
  left: -96px;
  background: rgba(34, 211, 238, 0.34);
}

.appstore-page__ambient--right {
  right: -110px;
  top: 260px;
  background: rgba(8, 145, 178, 0.2);
}

.appstore-shell {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 20px;
  max-width: 1100px;
  margin: 0 auto;
}

.glass-card {
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  background: linear-gradient(180deg, var(--surface-strong), var(--surface));
  border: 1px solid var(--surface-border);
  box-shadow: var(--shadow-lg);
}

.app-header {
  display: grid;
  gap: 20px;
  padding: 20px;
  border-radius: 32px;
}

.app-header__main {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 16px;
  align-items: center;
}

.app-header__icon-wrap {
  position: relative;
  width: 96px;
  height: 96px;
  border-radius: 28px;
  padding: 8px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.52));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.app-header__icon {
  width: 100%;
  height: 100%;
  border-radius: 22px;
  object-fit: cover;
  display: block;
  box-shadow: 0 14px 32px rgba(8, 145, 178, 0.2);
}

.app-header__category {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--brand);
}

.app-header__title {
  margin: 0;
  font-size: 32px;
  line-height: 1.04;
  font-weight: 800;
  letter-spacing: -0.04em;
}

.app-header__subtitle {
  margin: 10px 0 0;
  color: var(--text-secondary);
  line-height: 1.7;
  font-size: 15px;
}

.app-header__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
}

.app-badge {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  background: rgba(8, 145, 178, 0.09);
  color: var(--brand);
  font-size: 13px;
  font-weight: 700;
}

.app-header__actions {
  display: grid;
  gap: 10px;
  align-content: start;
}

.primary-button,
.secondary-chip,
.sticky-cta__button {
  cursor: pointer;
  transition:
    transform 220ms ease,
    box-shadow 220ms ease,
    background-color 220ms ease,
    border-color 220ms ease;
}

.primary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 112px;
  min-height: 48px;
  padding: 0 22px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--cta), var(--cta-dark));
  color: #fff;
  text-decoration: none;
  font-size: 15px;
  font-weight: 800;
  box-shadow: 0 16px 30px rgba(5, 150, 105, 0.22);
}

.primary-button:hover,
.secondary-chip:hover,
.sticky-cta__button:hover,
.channel-card:hover,
.legal-card:hover,
.screenshot-card:hover {
  transform: translateY(-2px);
}

.action-hint,
.status-text {
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.6;
}

.status-text--error {
  color: #b45309;
}

.hero-stage {
  display: grid;
  gap: 20px;
}

.hero-story {
  display: grid;
  gap: 18px;
  padding: 24px 20px;
  border-radius: 32px;
}

.hero-story__eyebrow {
  margin: 0;
  color: var(--brand);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.hero-story__title {
  margin: 0;
  font-size: 28px;
  line-height: 1.12;
  letter-spacing: -0.04em;
}

.hero-story__body {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.82;
  font-size: 15px;
}

.hero-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.hero-stat {
  padding: 14px 12px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.56);
  border: 1px solid rgba(255, 255, 255, 0.55);
}

.hero-stat strong {
  display: block;
  font-size: 20px;
  line-height: 1;
  font-weight: 800;
}

.hero-stat span {
  display: block;
  margin-top: 8px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.4;
}

.hero-story__more {
  display: grid;
  gap: 12px;
}

.hero-story__more-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-secondary);
}

.hero-story__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.secondary-chip {
  display: inline-flex;
  align-items: center;
  min-height: 42px;
  padding: 0 16px;
  border-radius: 999px;
  color: var(--brand);
  text-decoration: none;
  font-size: 13px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(8, 145, 178, 0.14);
}

.device-showcase {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 360px;
}

.device-showcase__halo {
  position: absolute;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(34, 211, 238, 0.26) 0%, rgba(34, 211, 238, 0) 72%);
  filter: blur(12px);
}

.device-frame {
  position: relative;
  width: min(280px, 72vw);
  aspect-ratio: 9 / 19.5;
  padding: 14px;
  border-radius: 42px;
  background: linear-gradient(180deg, #14212a 0%, #111827 100%);
  box-shadow: var(--shadow-xl);
}

.device-frame::before {
  content: '';
  position: absolute;
  top: 14px;
  left: 50%;
  width: 34%;
  height: 18px;
  transform: translateX(-50%);
  border-radius: 0 0 18px 18px;
  background: rgba(0, 0, 0, 0.75);
  z-index: 2;
}

.device-frame__image {
  width: 100%;
  height: 100%;
  border-radius: 30px;
  object-fit: cover;
  display: block;
  background: linear-gradient(180deg, #eff6ff 0%, #e2f8fb 100%);
}

.content-section {
  display: grid;
  gap: 16px;
}

.section-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 12px;
}

.section-heading h3 {
  margin: 0;
  font-size: 26px;
  line-height: 1.08;
  letter-spacing: -0.03em;
}

.section-heading p {
  margin: 8px 0 0;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.6;
}

.screenshots-track {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(210px, 78vw);
  gap: 14px;
  overflow-x: auto;
  padding-bottom: 8px;
  scroll-snap-type: x proximity;
}

.screenshots-track::-webkit-scrollbar {
  height: 8px;
}

.screenshots-track::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(22, 78, 99, 0.18);
}

.screenshot-card {
  position: relative;
  display: grid;
  gap: 10px;
  scroll-snap-align: start;
}

.screenshot-card__device {
  padding: 10px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.74);
  box-shadow: var(--shadow-lg);
}

.screenshot-card__image {
  display: block;
  width: 100%;
  aspect-ratio: 9 / 19;
  border-radius: 22px;
  object-fit: cover;
}

.screenshot-card__index {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.content-section--split {
  gap: 18px;
}

.section-copy {
  padding: 24px 20px;
  border-radius: 28px;
}

.section-copy h3 {
  margin: 0 0 14px;
  font-size: 24px;
  line-height: 1.1;
}

.section-copy p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.86;
  font-size: 15px;
}

.section-copy p + p {
  margin-top: 14px;
}

.feature-grid {
  display: grid;
  gap: 14px;
}

.feature-card {
  padding: 18px;
  border-radius: 24px;
}

.feature-card h4 {
  margin: 0 0 10px;
  font-size: 18px;
  line-height: 1.2;
}

.feature-card p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.75;
  font-size: 14px;
}

.channel-grid,
.legal-grid {
  display: grid;
  gap: 14px;
}

.channel-card,
.legal-card {
  display: grid;
  gap: 12px;
  padding: 20px 18px;
  border-radius: 26px;
  text-decoration: none;
  color: var(--text-primary);
}

.channel-card__top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.channel-card__hint,
.legal-card__label {
  color: var(--brand);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.channel-card__status {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
}

.channel-card strong,
.legal-card strong {
  font-size: 18px;
  line-height: 1.42;
}

.sticky-cta {
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: 16px;
  z-index: 8;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  border: 1px solid rgba(255, 255, 255, 0.72);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.16);
}

.sticky-cta__copy {
  min-width: 0;
  flex: 1;
}

.sticky-cta__copy strong,
.sticky-cta__copy span {
  display: block;
}

.sticky-cta__copy strong {
  font-size: 15px;
  line-height: 1.2;
}

.sticky-cta__copy span {
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.sticky-cta__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 88px;
  min-height: 44px;
  padding: 0 18px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--brand), #22d3ee);
  color: #fff;
  text-decoration: none;
  font-size: 14px;
  font-weight: 800;
  box-shadow: 0 14px 26px rgba(8, 145, 178, 0.24);
}

.primary-button:focus-visible,
.secondary-chip:focus-visible,
.channel-card:focus-visible,
.legal-card:focus-visible,
.sticky-cta__button:focus-visible {
  outline: 3px solid rgba(8, 145, 178, 0.28);
  outline-offset: 3px;
}

@media (min-width: 768px) {
  .appstore-page {
    padding: 28px 22px 40px;
  }

  .app-header {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    padding: 24px 26px;
  }

  .hero-stage {
    grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
    align-items: center;
  }

  .content-section--split {
    grid-template-columns: minmax(0, 0.94fr) minmax(0, 1.06fr);
    align-items: start;
  }

  .feature-grid,
  .channel-grid,
  .legal-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .screenshots-track {
    grid-auto-columns: minmax(240px, 28vw);
  }

  .sticky-cta {
    display: none;
  }
}

@media (min-width: 1100px) {
  .app-header__title {
    font-size: 38px;
  }

  .hero-story {
    padding: 28px;
  }

  .hero-story__title {
    font-size: 34px;
  }

  .device-frame {
    width: 320px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .primary-button,
  .secondary-chip,
  .sticky-cta__button,
  .channel-card,
  .legal-card,
  .screenshot-card {
    transition: none;
  }
}
</style>
