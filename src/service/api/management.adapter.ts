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

interface ResolvedMenuRouteLocation {
  canonicalRouteName: string | null
  path: string
  query: Record<string, string>
}

const LEGACY_MENU_ROUTE_MAP: Record<string, { routeName: string; routePath: string }> = {
  // 历史「场景管理」菜单 key，对应现有自动化场景管理页面
  'automation_space-management': { routeName: 'automation_scene-manage', routePath: '/automation/scene-manage' },
  // 历史「看板预览」菜单 key，兼容到当前可视化看板列表页
  'visualization_panel-preview': { routeName: 'visualization_kanban', routePath: '/visualization/kanban' },
  // FEAT-0065 初版 SQL 使用下划线菜单 code，真实 elegant-router key 由目录名生成短横线
  bms_system_version_updates: { routeName: 'bms_system_version-updates', routePath: '/bms/system/version-updates' }
}

function getOrgTypeFromQuery(query: Record<string, string>): string {
  for (const [key, value] of Object.entries(query)) {
    if (key.trim().toLowerCase() === 'org_type') {
      return String(value ?? '')
        .trim()
        .toUpperCase()
    }
  }
  return ''
}

function resolveMenuRouteLocation(elementCode: unknown, original: unknown): ResolvedMenuRouteLocation {
  const trimmedCode = String(elementCode ?? '').trim()
  const parsedOriginal = parseRouteLocation(original)

  let path = parsedOriginal.path
  let query = { ...parsedOriginal.query }
  let canonicalRouteName: string | null = null
  const orgType = getOrgTypeFromQuery(query)

  const orgShortcutMap: Record<string, { routeName: string; routePath: string }> = {
    PACK_FACTORY: { routeName: 'bms_org_pack-factory', routePath: '/bms/org/pack-factory' },
    DEALER: { routeName: 'bms_org_dealer', routePath: '/bms/org/dealer' },
    STORE: { routeName: 'bms_org_store', routePath: '/bms/org/store' }
  }

  const quickCodeMap: Record<string, { routeName: string; routePath: string }> = {
    bms_org_management: { routeName: 'bms_org', routePath: '/bms/org' },
    bms_pack_factory: { routeName: 'bms_org_pack-factory', routePath: '/bms/org/pack-factory' },
    bms_store: { routeName: 'bms_org_store', routePath: '/bms/org/store' }
  }

  // 历史菜单 key/路径 与当前路由不一致时，先做强制归一化，避免 transform 时报 view 不存在
  if (LEGACY_MENU_ROUTE_MAP[trimmedCode]) {
    path = LEGACY_MENU_ROUTE_MAP[trimmedCode].routePath
    query = {}
    canonicalRouteName = LEGACY_MENU_ROUTE_MAP[trimmedCode].routeName
  }

  if (!canonicalRouteName) {
    const legacyByPath = Object.values(LEGACY_MENU_ROUTE_MAP).find(item => item.routePath === path)
    if (legacyByPath) {
      path = legacyByPath.routePath
      query = {}
      canonicalRouteName = legacyByPath.routeName
    }
  }

  // 兼容历史快捷菜单：/bms/org/management?org_type=XXX 或 /bms/org?ORG_TYPE=XXX
  if (path === '/bms/org/management' || path === '/bms/org') {
    if (orgShortcutMap[orgType]) {
      path = orgShortcutMap[orgType].routePath
      query = {}
      canonicalRouteName = orgShortcutMap[orgType].routeName
    } else if (path === '/bms/org/management') {
      path = '/bms/org'
      query = {}
      canonicalRouteName = 'bms_org'
    }
  }

  // 按 legacy element_code 兜底映射，避免快捷菜单 code 与真实路由 key 不一致导致 404
  if (!canonicalRouteName && quickCodeMap[trimmedCode]) {
    path = quickCodeMap[trimmedCode].routePath
    query = {}
    canonicalRouteName = quickCodeMap[trimmedCode].routeName
  }

  // bms_dealer 兼容两种语义：
  // - /bms/dealer: 旧页面
  // - 组织管理快捷入口: /bms/org(*/management)?org_type=DEALER
  if (!canonicalRouteName && trimmedCode === 'bms_dealer' && (orgType === 'DEALER' || path.startsWith('/bms/org'))) {
    path = '/bms/org/dealer'
    query = {}
    canonicalRouteName = 'bms_org_dealer'
  }

  if (!canonicalRouteName && path) {
    canonicalRouteName = getRouteName(path as any) || null
  }

  return { path, query, canonicalRouteName }
}

/** 递归处理数据 */
function replaceKeys(data: ElegantConstRoute[]): ElegantRoute[] {
  // element_type=4 为按钮/元素权限，不应参与前端动态路由构建
  const routeCandidates = data.filter((item: any) => Number(item?.element_type) !== 4)

  return routeCandidates.map((item: any): ElegantRoute => {
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
    const {
      path: routePath,
      query: routeQuery,
      canonicalRouteName
    } = resolveMenuRouteLocation(item.element_code, item.param1)
    const name = item.element_code.trim().replace(/\s/g, '_')
    let component = ''

    // 优先使用规范化后的 route key，避免 legacy 菜单 code 导致动态路由名称/组件不一致。
    const routeName = canonicalRouteName || name
    const pageKey = canonicalRouteName || name

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
      } else if (!item.children?.length && canonicalRouteName) {
        // 历史数据兼容：部分“菜单”节点实际是页面入口（如电池列表），若无子路由则按页面渲染
        component = transformLayoutAndPageToComponent('', pageKey)
      } else {
        // 其他类型（如 element_type=1）：使用布局
        component = transformLayoutAndPageToComponent('base', '')
      }
    }
    const route = {
      // id: item.id,
      // parentId: item.parent_id,
      name: routeName,
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
