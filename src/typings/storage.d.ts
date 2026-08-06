/** The storage namespace */
declare namespace StorageType {
  interface Session {
    /** The theme color */
    themeColor: string
    /** BMS battery list's last applied search state in the current login session */
    bmsBatteryListSearchState: {
      version: 1
      form: {
        search_field:
          | 'device_number'
          | 'batch_number'
          | 'battery_model_name'
          | 'product_spec'
          | 'ble_mac'
          | 'identity_ble_mac'
          | 'comm_chip_id'
        search_value: string
        device_number: string
        battery_model_id: string | null
        cell_brand_seq_no: number | null
        battery_model_seq_no: number | null
        owner_org_type: string | null
        owner_org_id: string | null
        is_online: number | null
        activation_status: string | null
        production_range: [number, number] | null
        warranty_status: string | null
      }
      apiParams: Record<string, string | number | undefined>
      showAdvancedSearch: boolean
      page: number
      pageSize: number
    }
    // /**
    //  * the theme settings
    //  */
    // themeSettings: App.Theme.ThemeSetting;
  }

  interface Local {
    /** The i18n language */
    lang: App.I18n.LangType
    /** The token */
    token: string
    /** The refresh token */
    refreshToken: string
    /** The expires in time */
    token_expires_in: string
    /** The user info */
    userInfo: Api.Auth.UserInfo
    /** The theme color */
    themeColor: string
    /** The theme settings */
    themeSettings: App.Theme.ThemeSetting
    /**
     * The override theme flags
     *
     * The value is the build time of the project
     */
    overrideThemeFlag: string
    /** The global tabs */
    globalTabs: App.Global.Tab[]
    /** loading logo */
    logoLoading: string
    /** cached system name for pre-mount loading screen */
    systemName: string
  }
}
