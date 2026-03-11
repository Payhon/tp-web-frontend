<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { debounce } from 'lodash'
import { router } from '@/router'
import { useWebsocketUtil } from '@/utils/websocketUtil'
import { fetchHomeData } from '@/service/api'
import { getBmsHomeSummary } from '@/service/api/bms'
import type { BmsHomeSummaryQuery, BmsHomeSummaryResp } from '@/service/api/bms'
import { useAuthStore } from '@/store/modules/auth'
import type { ICardRender, ICardView } from '@/components/panel/card'
import { localStg } from '@/utils/storage'
import { $t } from '@/locales'
import InstitutionHome from './components/institution-home.vue'
import EndUserHome from './components/end-user-home.vue'

const authStore = useAuthStore()

const layoutFetched = ref(false)
const layout = ref<ICardView[]>([])
const theme = ref('')
const isError = ref<boolean>(false)
const active = ref<boolean>(true)
const token = localStg.get('token')
const cr = ref<ICardRender>()
const { updateComponentsData, closeAllSockets } = useWebsocketUtil(cr, token as string)

const roleHomeLoading = ref(false)
const roleHomeError = ref(false)
const roleHomeSummary = ref<BmsHomeSummaryResp | null>(null)
const adminRoleHomeLoading = ref(false)
const adminRoleHomeError = ref(false)
const adminRoleHomeSummary = ref<BmsHomeSummaryResp | null>(null)

const isAdminHome = computed(() =>
  ['SYS_ADMIN', 'TENANT_ADMIN'].includes((authStore.userInfo.authority as string) || '')
)

type AdminViewAs = 'TENANT' | 'PACK_FACTORY' | 'DEALER' | 'STORE' | 'APP_USER'
const adminViewTab = ref<AdminViewAs>('TENANT')

const isAdminTenantView = computed(() => isAdminHome.value && adminViewTab.value === 'TENANT')
const isRoleHomeView = computed(() => !isAdminHome.value || !isAdminTenantView.value)

const currentUserName = computed(() => {
  return (
    (authStore.userInfo.name as string) ||
    (authStore.userInfo.userName as string) ||
    (authStore.userInfo.email as string) ||
    '用户'
  )
})

const roleHomeState = computed(() => {
  if (!isAdminHome.value) {
    return {
      loading: roleHomeLoading.value,
      error: roleHomeError.value,
      summary: roleHomeSummary.value
    }
  }
  return {
    loading: adminRoleHomeLoading.value,
    error: adminRoleHomeError.value,
    summary: adminRoleHomeSummary.value
  }
})

const orgTypeLabel = computed(() => {
  const orgType = roleHomeState.value.summary?.org_type || ''
  const map: Record<string, string> = {
    BMS_FACTORY: 'BMS厂家',
    PACK_FACTORY: 'PACK厂家',
    DEALER: '经销商',
    STORE: '门店'
  }
  return map[orgType] || '机构'
})

const authorityLabel = computed(() => {
  const authority = String(authStore.userInfo.authority || '')
  const map: Record<string, string> = {
    SYS_ADMIN: '平台管理员',
    TENANT_ADMIN: '租户管理员',
    TENANT_USER: '租户用户'
  }
  return map[authority] || authority || '用户'
})

const currentOrgName = computed(() => {
  return (
    String(authStore.userInfo.organization || '').trim() ||
    String(authStore.userInfo.org_name || '').trim() ||
    String(authStore.userInfo.orgName || '').trim() ||
    '未设置机构'
  )
})

const adminTabOptions: Array<{ value: AdminViewAs; label: string }> = [
  { value: 'TENANT', label: '租户管理员' },
  { value: 'PACK_FACTORY', label: 'PACK 厂家' },
  { value: 'DEALER', label: '经销商' },
  { value: 'STORE', label: '门店' },
  { value: 'APP_USER', label: '终端用户' }
]

const adminViewLabel = computed(() => {
  const option = adminTabOptions.find(item => item.value === adminViewTab.value)
  return option?.label || '租户管理员'
})

const getLayout = async () => {
  const { data, error } = await fetchHomeData({})

  isError.value = (error || !(data && data.config)) as boolean

  if (!isError.value && data) {
    const configJson = JSON.parse(data.config)
    if (Array.isArray(configJson)) {
      updateConfigData(configJson)
      layout.value = [...configJson, ...layout.value]
      layoutFetched.value = true
    } else if (typeof configJson === 'object') {
      if (configJson.layout) {
        updateConfigData(configJson.layout)
        layout.value = configJson.layout
        layoutFetched.value = true
      }
      if (configJson.theme) {
        theme.value = configJson.theme
      }
    }
  }
}

const fetchRoleHomeSummary = async (params?: BmsHomeSummaryQuery, asAdminPreview = false) => {
  const loadingRef = asAdminPreview ? adminRoleHomeLoading : roleHomeLoading
  const errorRef = asAdminPreview ? adminRoleHomeError : roleHomeError
  const summaryRef = asAdminPreview ? adminRoleHomeSummary : roleHomeSummary

  loadingRef.value = true
  errorRef.value = false
  try {
    const { data, error } = await getBmsHomeSummary(params)
    errorRef.value = Boolean(error || !data)
    summaryRef.value = data || null
  } catch {
    errorRef.value = true
    summaryRef.value = null
  } finally {
    loadingRef.value = false
  }
}

const getRoleHomeSummary = async () => {
  await fetchRoleHomeSummary()
}

const getAdminRoleHomeSummary = async (viewAs: Exclude<AdminViewAs, 'TENANT'>) => {
  await fetchRoleHomeSummary({ view_as: viewAs }, true)
}

const refreshRoleHomeSummary = async () => {
  if (isAdminHome.value && adminViewTab.value !== 'TENANT') {
    await getAdminRoleHomeSummary(adminViewTab.value)
    return
  }
  await getRoleHomeSummary()
}

watch(
  adminViewTab,
  async value => {
    if (!isAdminHome.value || value === 'TENANT') return
    await getAdminRoleHomeSummary(value)
  },
  { immediate: false }
)

watch(isAdminHome, value => {
  if (!value) return
  adminViewTab.value = 'TENANT'
})

onMounted(async () => {
  if (isAdminHome.value) {
    await getLayout()
    return
  }
  roleHomeLoading.value = true
  roleHomeError.value = false
  await getRoleHomeSummary()
})

onUnmounted(() => {
  closeAllSockets()
})

const throttledWatcher = debounce(() => {
  updateComponentsData(layout)
}, 300)

watch(
  () => layout,
  () => {
    throttledWatcher()
  },
  { deep: true }
)

function stringToUniqueNumber(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i += 1) {
    hash = hash * 31 + str.charCodeAt(i)
  }
  return hash
}

function updateConfigData(configJson: ICardView[]) {
  for (const item of configJson) {
    if (typeof item.i === 'string') {
      item.i = stringToUniqueNumber(item.i)
    }
  }
}

const breakpointChanged = (_newBreakpoint: any, newLayout: any) => {
  setTimeout(() => {
    layout.value = newLayout
  }, 300)
}
</script>

<template>
  <div class="h-full flex flex-col gap-12px">
    <NCard :bordered="false" class="rounded-8px shadow-sm">
      <NSpace align="center" :size="10" wrap>
        <span class="text-14px">当前账号：{{ currentUserName }}</span>

        <template v-if="!isAdminHome">
          <template v-if="!roleHomeState.loading && roleHomeState.summary">
            <NTag type="info">{{ roleHomeState.summary.user_kind === 'END_USER' ? '终端用户' : '机构用户' }}</NTag>
            <template v-if="roleHomeState.summary.user_kind === 'END_USER'">
              <span class="text-14px">名称：{{ currentUserName }}</span>
            </template>
            <template v-else>
              <span class="text-14px">类型：{{ orgTypeLabel }}</span>
              <span class="text-14px">机构：{{ currentOrgName }}</span>
            </template>
          </template>
        </template>
        <template v-else>
          <NTag type="warning">当前视角：{{ adminViewLabel }}</NTag>
        </template>
      </NSpace>
    </NCard>

    <NCard v-if="isAdminHome" :bordered="false" class="rounded-8px shadow-sm">
      <NTabs v-model:value="adminViewTab" type="line" animated>
        <NTabPane v-for="item in adminTabOptions" :key="item.value" :name="item.value" :tab="item.label" />
      </NTabs>
    </NCard>

    <div class="flex-1 min-h-0">
      <template v-if="isRoleHomeView">
        <div v-if="roleHomeState.loading" class="h-full flex-center">
          <NSpin size="large" />
        </div>

        <div v-else-if="roleHomeState.error" class="h-full w-full flex-center">
          <n-result status="error" title="首页数据加载失败" description="请稍后重试或联系管理员">
            <template #footer>
              <n-button type="primary" @click="refreshRoleHomeSummary">重新加载</n-button>
            </template>
          </n-result>
        </div>

        <EndUserHome
          v-else-if="roleHomeState.summary?.user_kind === 'END_USER'"
          :user-name="currentUserName"
          :battery-total="roleHomeState.summary?.end_user?.battery_total || 0"
        />

        <InstitutionHome
          v-else
          :org-type-label="orgTypeLabel"
          :summary="roleHomeState.summary?.institution"
          @refresh="refreshRoleHomeSummary"
        />
      </template>

      <template v-else>
        <div v-if="isError" class="h-full w-full flex-center">
          <n-result status="418" :title="$t('custom.home.title')" :description="$t('custom.home.description')">
            <template #footer>
              <n-button
                type="primary"
                :disabled="active"
                @click="
                  () => {
                    router.go(0)
                  }
                "
              >
                <n-countdown
                  v-if="active"
                  :duration="60000"
                  :render="props => props.seconds + 's'"
                  :active="active"
                  @finish="active = false"
                />
                {{ active ? '' : $t('custom.home.refresh') }}
              </n-button>
            </template>
          </n-result>
        </div>

        <CardRender
          v-else-if="layoutFetched"
          ref="cr"
          class="home-panel"
          :layout="layout"
          :is-preview="true"
          :col-num="12"
          :default-card-col="4"
          :row-height="85"
          :theme="theme"
          @update:layout="
            data => {
              nextTick(() => {
                layout = data
              })
            }
          "
          @breakpoint-changed="breakpointChanged"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.home-panel {
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.5) transparent;
}
</style>
