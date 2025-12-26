import type { ElegantRoute } from '@elegant-router/types'
import type { ElegantConstRoute } from '@elegant-router/vue'
import { getRouteName } from '@/router/elegant/transform'

/**
 * 递归处理数据
 *
 * @param treeNode
 * @param depth
 */
function processTree(treeNode: Api.Route.MenuRoute): void {
  // 处理当前节点
  treeNode.authority = treeNode.authority ? JSON.parse(treeNode.authority) : []
  // 递归处理子节点
  if (treeNode.children) {
    for (const childNode of treeNode.children) {
      processTree(childNode)
    }
  }
}

export function adapterOfFetchRouterList(data: Api.Route.Data): Api.Route.MenuRoute[] {
  if (!data?.list) return []
  return data.list.map(item => {
    processTree(item)
    return item
  })
}

const LAYOUT_PREFIX = 'layout.'
const VIEW_PREFIX = 'view.'
const FIRST_LEVEL_ROUTE_COMPONENT_SPLIT = '$'

function transformLayoutAndPageToComponent(layout: string, page: any) {
  const hasLayout = Boolean(layout)
  const hasPage = Boolean(page)

  if (hasLayout && hasPage) {
    return `${LAYOUT_PREFIX}${layout}${FIRST_LEVEL_ROUTE_COMPONENT_SPLIT}${VIEW_PREFIX}${page}`
  }

  if (hasLayout) {
    return `${LAYOUT_PREFIX}${layout}`
  }

  if (hasPage) {
    return `${VIEW_PREFIX}${page}`
  }

  return ''
}

function parseRouteLocation(input: unknown): { path: string; query: Record<string, string> } {
  const raw = String(input ?? '').trim()

  if (!raw) return { path: '', query: {} }

  const hashIndex = raw.indexOf('#')
  const withoutHash = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw

  const queryIndex = withoutHash.indexOf('?')
  const rawPath = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash
  const queryString = queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : ''

  const withLeadingSlash = rawPath.startsWith('/') ? rawPath : `/${rawPath}`

  // keep root '/', otherwise strip trailing slashes
  const path = withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, '') : withLeadingSlash

  const query: Record<string, string> = {}
  if (queryString) {
    const params = new URLSearchParams(queryString)
    params.forEach((value, key) => {
      if (!key || key in query) return
      query[key] = value
    })
  }

  return { path, query }
}

function normalizeLegacyMenuRouteLocation(elementCode: string, original: unknown): unknown {
  const trimmedCode = String(elementCode ?? '').trim()

  const legacyMap: Record<string, string> = {
    // backend/sql/20.sql inserted these legacy element_code + param1 combos
    // that don't match existing view keys/routes in the frontend
    bms_org_management: '/bms/org',
    bms_pack_factory: '/bms/org/pack-factory',
    bms_dealer: '/bms/org/dealer',
    bms_store: '/bms/org/store'
  }

  return legacyMap[trimmedCode] ?? original
}

/** 递归处理数据 */
function replaceKeys(data: ElegantConstRoute[]): ElegantRoute[] {
  return data.map((item: any): ElegantRoute => {
    // if (!item.parent_id) {
    //   if (!item.route_path.includes('$')) {
    //     if (item.route_path === 'layout.base') {
    //       item.route_path += '$home';
    //     } else {
    //       item.route_path = `layout.base$${item.route_path}`;
    //     }
    //   }
    // }
    // if (item.route_path === 'layout.base' && item.children.length === 0) {
    //   item.route_path += '$home';
    // }
    const normalizedLocation = normalizeLegacyMenuRouteLocation(item.element_code, item.param1)
    const { path: routePath, query: routeQuery } = parseRouteLocation(normalizedLocation)
    const name = item.element_code.trim().replace(/\s/g, '_')
    const homeRoutePath = routePath ? getRouteName(routePath as any) : null
    let component = ''

    // Prefer routeMap mapping; fall back to element_code when backend route path is not normalized.
    const pageKey = homeRoutePath || name

    if (item.parent_id === '0') {
      // 根级路由：使用 base 布局，只有 element_type=3 (页面) 时才有页面组件
      component = transformLayoutAndPageToComponent('base', item.element_type === 3 ? pageKey : '')
    } else {
      // 非根级路由：
      // - element_type=1 或 2 (菜单/文件夹)：不需要页面组件，只需要布局或为空
      // - element_type=3 (页面)：需要页面组件
      if (item.element_type === 3) {
        // 页面类型：使用页面组件
        component = transformLayoutAndPageToComponent('', pageKey)
      } else if (item.element_type === 2) {
        // 文件夹类型：不需要组件（由子路由提供内容）
        component = ''
      } else {
        // 其他类型（如 element_type=1）：使用布局
        component = transformLayoutAndPageToComponent('base', '')
      }
    }
    const route: Partial<ElegantRoute> = {
      // id: item.id,
      // parentId: item.parent_id,
      name,
      // elementType: item.element_type,
      path: routePath || '/',
      // component: item.route_path.trim().replace(/\s/g, '_'),
      // remark: item.remark,
      ...(component && { component }),
      meta: {
        title: item.description,
        i18nKey: item.multilingual,
        requiresAuth: true,
        // permissions: JSON.parse(item.authority),
        // roles: JSON.parse(item.authority),
        permissions: [],
        roles: [],
        icon: item.param2,
        order: item.orders,
        hideInMenu: item.param3 === '1',
        remark: item.remark || '',
        ...(Object.keys(routeQuery).length ? { query: routeQuery } : {})
      },
      children: item.children?.length ? replaceKeys(item.children) : []
    }
    return route as unknown as ElegantRoute
  })
}

export function adapterOfFetchUserRouterList(data: ElegantConstRoute[]): ElegantConstRoute[] {
  if (!data.length) return []
  return replaceKeys(data).map((item: ElegantConstRoute): ElegantConstRoute => {
    if (!item.children || !item.children.length) {
      if (!item.meta) return item
      item.meta.singleLayout = 'base'
    }
    return item
  })
}
