import type { CustomRoute, ElegantConstRoute, ElegantRoute } from '@elegant-router/types'
import { generatedRoutes } from '../elegant/routes'
import { layouts, views } from '../elegant/imports'
import { transformElegantRoutesToVueRoutes } from '../elegant/transform'

export const ROOT_ROUTE: CustomRoute = {
  name: 'root',
  path: '/',
  redirect: '/home',
  meta: {
    title: 'root',
    constant: true
  }
}

const customRoutes: ElegantRoute[] = [
  ROOT_ROUTE,
  {
    name: 'not-found',
    path: '/:pathMatch(.*)*',
    component: 'layout.blank$view.404',
    meta: {
      title: 'not-found',
      constant: true
    }
  },
  {
    name: 'exception',
    path: '/exception',
    component: 'layout.base',
    meta: {
      title: 'exception',
      i18nKey: 'route.exception',
      icon: 'ant-design:exception-outlined',
      order: 7
    },
    children: [
      {
        name: 'exception_403',
        path: '/exception/403',
        component: 'view.403',
        meta: {
          title: 'exception_403',
          i18nKey: 'route.exception_403',
          icon: 'ic:baseline-block'
        }
      },
      {
        name: 'exception_404',
        path: '/exception/404',
        component: 'view.404',
        meta: {
          title: 'exception_404',
          i18nKey: 'route.exception_404',
          icon: 'ic:baseline-web-asset-off'
        }
      },
      {
        name: 'exception_500',
        path: '/exception/500',
        component: 'view.500',
        meta: {
          title: 'exception_500',
          i18nKey: 'route.exception_500',
          icon: 'ic:baseline-wifi-off'
        }
      }
    ]
  },
  {
    name: 'bms',
    path: '/bms',
    component: 'layout.base',
    meta: {
      title: 'BMS管理',
      icon: 'mdi:battery-charging-100',
      order: 10
    },
    children: [
      {
        name: 'bms_dashboard',
        path: '/bms/dashboard',
        component: 'view.bms_dashboard',
        meta: {
          title: 'BMS 看板',
          icon: 'mdi:view-dashboard'
        }
      },
      {
        name: 'bms_dealer',
        path: '/bms/dealer',
        component: 'view.bms_dealer',
        meta: {
          title: '经销商管理',
          icon: 'mdi:account-group'
        }
      },
      {
        name: 'bms_end',
        path: '/bms/end',
        meta: {
          title: '终端用户',
          icon: 'mdi:account'
        },
        children: [
          {
            name: 'bms_end_user',
            path: '/bms/end/user',
            component: 'view.bms_end_user',
            meta: {
              title: '终端用户列表',
              icon: 'mdi:account'
            }
          }
        ]
      },
      {
        name: 'bms_battery',
        path: '/bms/battery',
        meta: {
          title: '电池管理',
          icon: 'mdi:battery'
        },
        children: [
          {
            name: 'bms_battery_list',
            path: '/bms/battery/list',
            component: 'view.bms_battery_list',
            meta: {
              title: '电池列表',
              icon: 'mdi:battery'
            }
          },
          {
            name: 'bms_battery_model',
            path: '/bms/battery/model',
            component: 'view.bms_battery_model',
            meta: {
              title: '电池型号管理',
              icon: 'mdi:battery-unknown'
            }
          },
          {
            name: 'bms_battery_tag',
            path: '/bms/battery/tag',
            component: 'view.bms_battery_tag',
            meta: {
              title: '标签管理',
              icon: 'mdi:tag'
            }
          },
          {
            name: 'bms_battery_offline',
            path: '/bms/battery/offline',
            component: 'view.bms_battery_offline',
            meta: {
              title: '离线指令',
              icon: 'mdi:cloud-clock'
            },
            children: [
              {
                name: 'bms_battery_offline_cmd',
                path: '/bms/battery/offline-command',
                component: 'view.bms_battery_offline_cmd',
                meta: {
                  title: '指令列表',
                  icon: 'mdi:format-list-bulleted'
                }
              }
            ]
          },
          {
            name: 'bms_battery_ota',
            path: '/bms/battery/ota',
            component: 'view.bms_battery_ota',
            meta: {
              title: 'OTA管理',
              icon: 'mdi:progress-wrench'
            },
            children: [
              {
                name: 'bms_battery_ota_package',
                path: '/bms/battery/ota/package',
                component: 'view.bms_battery_ota_package',
                meta: {
                  title: '升级包管理',
                  icon: 'mdi:package-variant'
                }
              },
              {
                name: 'bms_battery_ota_task',
                path: '/bms/battery/ota/task',
                component: 'view.bms_battery_ota_task',
                meta: {
                  title: '升级任务管理',
                  icon: 'mdi:clipboard-list-outline'
                }
                ,
                children: [
                  {
                    name: 'bms_battery_ota_task_detail',
                    path: '/bms/battery/ota/task/detail',
                    component: 'view.bms_battery_ota_task_detail',
                    meta: {
                      title: '任务详情',
                      icon: 'mdi:file-document-outline',
                      hideInMenu: true
                    }
                  }
                ]
              }
            ]
          },
          {
            name: 'bms_battery_transfer',
            path: '/bms/battery/transfer',
            component: 'view.bms_battery_transfer',
            meta: {
              title: '设备转移记录',
              icon: 'mdi:transfer'
            }
          }
        ]
      },
      {
        name: 'bms_warranty',
        path: '/bms/warranty',
        component: 'view.bms_warranty',
        meta: {
          title: '维保中心',
          icon: 'mdi:clipboard-text'
        }
      },
      {
        name: 'bms_ops',
        path: '/bms/ops',
        meta: {
          title: '运营管理',
          icon: 'mdi:clipboard-text-outline'
        },
        children: [
          {
            name: 'bms_ops_activation',
            path: '/bms/ops/activation',
            meta: {
              title: '激活日志',
              icon: 'mdi:history'
            },
            children: [
              {
                name: 'bms_ops_activation_log',
                path: '/bms/ops/activation/log',
                component: 'view.bms_ops_activation_log',
                meta: {
                  title: '激活日志',
                  icon: 'mdi:history'
                }
              }
            ]
          },
          {
            name: 'bms_ops_operation',
            path: '/bms/ops/operation',
            meta: {
              title: '操作记录',
              icon: 'mdi:clipboard-list'
            },
            children: [
              {
                name: 'bms_ops_operation_log',
                path: '/bms/ops/operation/log',
                component: 'view.bms_ops_operation_log',
                meta: {
                  title: '操作记录',
                  icon: 'mdi:clipboard-list'
                }
              }
            ]
          }
        ]
      },
      {
        name: 'bms_system',
        path: '/bms/system',
        meta: {
          title: '系统管理',
          icon: 'mdi:cog'
        },
        children: [
          {
            name: 'bms_system_user',
            path: '/bms/system/user',
            component: 'view.bms_system_user',
            meta: {
              title: '账号管理',
              icon: 'mdi:account-cog'
            }
          },
          {
            name: 'bms_system_role',
            path: '/bms/system/role',
            component: 'view.bms_system_role',
            meta: {
              title: '角色管理',
              icon: 'mdi:account-key'
            }
          }
        ]
      }
    ]
  }
]

/** Create routes */
export function createRoutes() {
  const constantRoutes: ElegantRoute[] = []

  const authRoutes: ElegantRoute[] = []

    ;[...customRoutes, ...generatedRoutes].forEach(item => {
      if (item.meta?.constant) {
        constantRoutes.push(item)
      } else {
        authRoutes.push(item)
      }
    })

  const constantVueRoutes = transformElegantRoutesToVueRoutes(constantRoutes, layouts, views)

  return {
    constantVueRoutes,
    authRoutes
  }
}

/**
 * Get auth vue routes
 *
 * @param routes Elegant routes
 */
export function getAuthVueRoutes(routes: ElegantConstRoute[]) {
  return transformElegantRoutesToVueRoutes(routes, layouts, views)
}
