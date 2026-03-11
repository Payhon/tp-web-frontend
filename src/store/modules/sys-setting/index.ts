import { defineStore } from 'pinia'
import { fetchThemeSetting } from '@/service/api/setting'
import { resolveFileUrl } from '@/utils/common/tool'
import { localStg } from '@/utils/storage'
import { createServiceConfig } from '~/env.config'

const { otherBaseURL } = createServiceConfig(import.meta.env)
const url = new URL(otherBaseURL.demo ? otherBaseURL.demo : `${window.location.origin}/api/v1`)

type SysSetting = Omit<Api.GeneralSetting.ThemeSetting, 'id'>

function toAbsoluteFileUrl(path?: string) {
  if (!path) return ''
  return resolveFileUrl(path, url.href)
}

export const useSysSettingStore = defineStore('sys-setting', {
  state: (): SysSetting => ({
    system_name: '',
    logo_background: '',
    logo_loading: '',
    logo_cache: '',
    home_background: '',
    wxmp_qrcode: '',
    app_download_qrcode: ''
  }),
  actions: {
    async initSysSetting() {
      const { error, data } = await fetchThemeSetting()
      // const { error, data } = await fetchUserRoutes(id)
      if (!error && data) {
        const list: Api.GeneralSetting.ThemeSetting[] = data.list
        if (list.length) {
          const setting: Api.GeneralSetting.ThemeSetting = list[0]
          setting.logo_background = toAbsoluteFileUrl(setting.logo_background)
          setting.logo_loading = toAbsoluteFileUrl(setting.logo_loading)
          setting.logo_cache = toAbsoluteFileUrl(setting.logo_cache)
          setting.home_background = toAbsoluteFileUrl(setting.home_background)
          setting.wxmp_qrcode = toAbsoluteFileUrl(setting.wxmp_qrcode)
          setting.app_download_qrcode = toAbsoluteFileUrl(setting.app_download_qrcode)
          localStg.set('logoLoading', setting.logo_loading)
          Object.assign(this.$state, setting)
        }
      }
    }
  }
})
