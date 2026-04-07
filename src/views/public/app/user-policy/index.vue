<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { fetchPublicContentPage, type ContentKey } from '@/service/api/app-manage'
import { normalizePublicLang } from '../shared'

defineOptions({ name: 'PublicAppUserPolicyPage' })

const route = useRoute()
const loading = ref(false)
const errorMessage = ref('')
const pageTitle = ref('')
const contentHtml = ref('')

const contentKey: ContentKey = 'user_policy'
const lang = computed(() => normalizePublicLang(route.query.lang))
const appid = computed(() => {
  const value = route.query.appid
  return typeof value === 'string' ? value.trim() : ''
})

const dictionary = computed(() =>
  lang.value === 'en-US'
    ? {
        fallbackTitle: 'User Policy',
        empty: 'No published content is available yet.',
        error: 'Failed to load the user policy.'
      }
    : {
        fallbackTitle: '用户政策',
        empty: '暂未发布内容',
        error: '加载用户政策失败'
      }
)

async function loadPage() {
  loading.value = true
  errorMessage.value = ''
  try {
    const response: any = await fetchPublicContentPage(contentKey, {
      appid: appid.value || undefined,
      lang: lang.value
    })
    const data = response?.data || response
    pageTitle.value = data?.title || dictionary.value.fallbackTitle
    contentHtml.value = data?.content_html || ''
    document.title = pageTitle.value
  } catch (error: any) {
    pageTitle.value = dictionary.value.fallbackTitle
    contentHtml.value = ''
    errorMessage.value = error?.message || dictionary.value.error
    document.title = pageTitle.value
  } finally {
    loading.value = false
  }
}

watch(() => route.fullPath, loadPage, { immediate: true })
</script>

<template>
  <main class="public-page">
    <section class="public-card">
      <header class="public-card__header">
        <p class="public-card__eyebrow">FJBMS</p>
        <h1 class="public-card__title">{{ pageTitle || dictionary.fallbackTitle }}</h1>
      </header>

      <div v-if="loading" class="public-card__status">{{ lang === 'en-US' ? 'Loading...' : '加载中...' }}</div>
      <div v-else-if="errorMessage" class="public-card__status public-card__status--error">{{ errorMessage }}</div>
      <article v-else-if="contentHtml" class="public-card__content" v-html="contentHtml"></article>
      <div v-else class="public-card__status">{{ dictionary.empty }}</div>
    </section>
  </main>
</template>

<style scoped>
.public-page {
  min-height: 100vh;
  padding: 24px 16px 40px;
  background:
    radial-gradient(circle at top right, rgba(10, 125, 104, 0.16), transparent 30%),
    linear-gradient(180deg, #eef8f6 0%, #fbfcfd 100%);
  color: #1f2937;
}

.public-card {
  max-width: 860px;
  margin: 0 auto;
  padding: 28px 20px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08);
}

.public-card__header {
  margin-bottom: 20px;
}

.public-card__eyebrow {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #0f766e;
}

.public-card__title {
  margin: 0;
  font-size: 28px;
  line-height: 1.2;
}

.public-card__status {
  padding: 24px 0;
  color: #64748b;
}

.public-card__status--error {
  color: #c2410c;
}

:deep(.public-card__content img) {
  max-width: 100%;
  height: auto;
}

:deep(.public-card__content table) {
  width: 100%;
  border-collapse: collapse;
}

:deep(.public-card__content th),
:deep(.public-card__content td) {
  border: 1px solid #e5e7eb;
  padding: 8px 10px;
}

:deep(.public-card__content p),
:deep(.public-card__content li) {
  line-height: 1.75;
}
</style>

