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
