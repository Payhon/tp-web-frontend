import type { App } from 'vue'
import { uiPermissionDirective } from './ui-permission'

export function setupDirectives(app: App) {
  app.directive('ui-permission', uiPermissionDirective)
}
