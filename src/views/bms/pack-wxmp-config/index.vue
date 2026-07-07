<script setup lang="ts">
import { computed } from 'vue'
import { NAlert, NCard } from 'naive-ui'
import { useAuthStore } from '@/store/modules/auth'
import { bt } from '@/views/bms/_shared/i18n'
import PackWxmpConfigPanel from '@/views/bms/_shared/components/pack-wxmp-config-panel.vue'

const authStore = useAuthStore()

const orgID = computed(() => String((authStore.userInfo as any)?.org_id || '').trim())
const orgType = computed(() =>
  String((authStore.userInfo as any)?.org_type || '')
    .trim()
    .toUpperCase()
)
const isPackFactory = computed(() => orgType.value === 'PACK_FACTORY')
</script>

<template>
  <div class="h-full overflow-auto">
    <NCard :bordered="false" size="small" :title="bt('packWxmpSelfConfig.title')">
      <NAlert v-if="!isPackFactory" type="warning">
        {{ bt('packWxmpSelfConfig.packOnly') }}
      </NAlert>
      <NAlert v-else-if="!orgID" type="warning">
        {{ bt('packWxmpSelfConfig.missingOrg') }}
      </NAlert>
      <PackWxmpConfigPanel v-else :org-id="orgID" />
    </NCard>
  </div>
</template>
