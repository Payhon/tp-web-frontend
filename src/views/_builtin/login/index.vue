<script setup lang="ts">
import { computed, watch } from 'vue'
import type { Component } from 'vue'
import { useTitle } from '@vueuse/core'
import { NEllipsis } from 'naive-ui'
import { $t } from '@/locales'
import { useAppStore } from '@/store/modules/app'
import { useThemeStore } from '@/store/modules/theme'
import { loginModuleRecord } from '@/constants/app'
import { useSysSettingStore } from '@/store/modules/sys-setting'
import PwdLogin from './modules/pwd-login.vue'
import CodeLogin from './modules/code-login.vue'
import Register from './modules/register.vue'
import RegisterByEmail from './modules/register-email.vue'
import ResetPwd from './modules/reset-pwd.vue'
import BindWechat from './modules/bind-wechat.vue'
import LoginBg from './modules/login-bg.vue'

interface Props {
  /** The login module */
  module?: UnionKey.LoginModule
}

const props = withDefaults(defineProps<Props>(), {
  module: 'pwd-login'
})

const appStore = useAppStore()
const themeStore = useThemeStore()
const sysSetting = useSysSettingStore()

interface LoginModule {
  key: UnionKey.LoginModule
  label: string
  component: Component
}

const modules: LoginModule[] = [
  { key: 'pwd-login', label: loginModuleRecord['pwd-login'], component: PwdLogin },
  { key: 'code-login', label: loginModuleRecord['code-login'], component: CodeLogin },
  { key: 'register', label: loginModuleRecord.register, component: Register },
  { key: 'register-email', label: loginModuleRecord.register, component: RegisterByEmail },
  { key: 'reset-pwd', label: loginModuleRecord['reset-pwd'], component: ResetPwd },
  { key: 'bind-wechat', label: loginModuleRecord['bind-wechat'], component: BindWechat }
]

const activeModule = computed(() => {
  const findItem = modules.find(item => item.key === props.module)
  return findItem || modules[0]
})

const loginQrcodeItems = computed(() => {
  return [
    {
      key: 'wxmp',
      label: $t('page.login.pwdLogin.wxmpQrcode'),
      src: sysSetting.wxmp_qrcode
    },
    {
      key: 'app',
      label: $t('page.login.pwdLogin.appDownloadQrcode'),
      src: sysSetting.app_download_qrcode
    }
  ].filter(item => Boolean(item.src))
})

// 计算当前模块的标题
const moduleTitle = computed(() => {
  switch (props.module) {
    case 'pwd-login':
      return $t('page.login.pwdLogin.title')
    case 'register-email':
      return $t('page.login.register.title')
    case 'reset-pwd':
      return $t('page.login.resetPwd.title')
    case 'code-login':
      return $t('page.login.codeLogin.title')
    default:
      return $t('page.login.pwdLogin.title')
  }
})

// 卡片背景色
const cardBgColor = computed(() => {
  if (themeStore.darkMode) {
    return 'rgba(31, 41, 55, 0.95)'
  }
  return 'rgba(255, 255, 255, 0.95)'
})

// 边框颜色
const borderColor = computed(() => {
  if (themeStore.darkMode) {
    return '#374151'
  }
  return '#e5e7eb'
})

// 监听标题变化
watch(moduleTitle, newTitle => {
  useTitle(newTitle)
})
</script>

<template>
  <div
    class="relative size-full flex-center overflow-hidden min-h-screen"
    :style="{
      fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif',
      background: sysSetting.home_background ? 'none' : themeStore.darkMode ? '#081121' : '#edf4ff'
    }"
  >
    <!-- 使用 LoginBg 组件显示后端配置的背景图片 -->
    <LoginBg v-if="sysSetting.home_background" :themeColor="themeStore.themeColor" :sysSetting="sysSetting" />

    <!-- 电路板电流粒子背景 -->
    <div v-else class="circuit-bg" :class="{ 'dark-theme': themeStore.darkMode }">
      <div class="circuit-grid"></div>
      <span class="circuit-trace trace-h-1"></span>
      <span class="circuit-trace trace-h-2"></span>
      <span class="circuit-trace trace-h-3"></span>
      <span class="circuit-trace trace-v-1"></span>
      <span class="circuit-trace trace-v-2"></span>
      <span class="circuit-trace trace-v-3"></span>
      <span class="circuit-particle particle-1"></span>
      <span class="circuit-particle particle-2"></span>
      <span class="circuit-particle particle-3"></span>
      <span class="circuit-particle particle-4"></span>
    </div>

    <!-- 登录卡片 -->
    <div
      class="relative z-10 w-full max-w-md mx-4 p-8 rounded-2xl shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-4 duration-500"
      :style="{
        width: '380px',
        background: cardBgColor,
        border: `1px solid ${borderColor}`,
        boxShadow: themeStore.darkMode ? '0 20px 60px rgba(0, 0, 0, 0.3)' : '0 20px 60px rgba(0, 0, 0, 0.1)'
      }"
    >
      <!-- 顶部控制栏 -->
      <div class="flex justify-end gap-2 mb-4">
        <button
          class="flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg border transition-all duration-200 hover:scale-105"
          :style="{
            background: themeStore.darkMode ? '#374151' : '#f9fafb',
            border: `1px solid ${borderColor}`,
            color: themeStore.darkMode ? '#d1d5db' : '#6b7280'
          }"
          @click="themeStore.toggleThemeScheme"
        >
          <svg class="w-3 h-3 fill-current" viewBox="0 0 24 24">
            <path v-if="themeStore.darkMode" d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            <path
              v-else
              d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z"
            />
          </svg>
        </button>
        <button
          class="flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg border transition-all duration-200 hover:scale-105"
          :style="{
            background: themeStore.darkMode ? '#374151' : '#f9fafb',
            border: `1px solid ${borderColor}`,
            color: themeStore.darkMode ? '#d1d5db' : '#6b7280'
          }"
          @click="appStore.changeLocale(appStore.locale === 'zh-CN' ? 'en-US' : 'zh-CN')"
        >
          <svg class="w-3 h-3 fill-current" viewBox="0 0 24 24">
            <path
              d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"
            />
          </svg>
          <span>{{ appStore.locale === 'zh-CN' ? '中文' : 'EN' }}</span>
        </button>
      </div>

      <!-- Logo区域 -->
      <div class="text-center mb-6">
        <div
          class="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3 shadow-lg transition-transform duration-300 hover:scale-110"
          :style="{ background: themeStore.themeColor }"
        >
          <SystemLogo width="32" class="text-white" />
        </div>
        <div class="title-container">
          <n-ellipsis
            :line-clamp="2"
            class="text-xl font-semibold mb-1 title-artistic"
            :style="{
              color: themeStore.darkMode ? '#f9fafb' : '#1f2937',
              lineHeight: '1.4',
              letterSpacing: '0.02em',
              textAlign: 'center'
            }"
          >
            {{ $t('system.title') }}
          </n-ellipsis>
        </div>
        <p class="text-xs opacity-60" :style="{ color: themeStore.darkMode ? '#9ca3af' : '#6b7280' }">
          {{ $t('system.description') }}
        </p>
      </div>

      <!-- 表单区域 -->
      <div class="space-y-6">
        <!-- <h2
          class="text-lg font-medium text-center"
          :style="{ color: themeStore.darkMode ? '#f9fafb' : '#1f2937' }"
        >
          {{ $t(activeModule.label as any) }}
        </h2> -->

        <div class="transition-all duration-300">
          <Transition :name="themeStore.page.animateMode" mode="out-in" appear>
            <component :is="activeModule.component" />
          </Transition>
        </div>

        <div v-if="loginQrcodeItems.length" class="login-qrcode-panel">
          <div class="login-qrcode-grid" :class="{ 'single-item': loginQrcodeItems.length === 1 }">
            <div v-for="item in loginQrcodeItems" :key="item.key" class="login-qrcode-item">
              <img :src="item.src" :alt="item.label" class="login-qrcode-image" />
              <p class="login-qrcode-label" :style="{ color: themeStore.darkMode ? '#d1d5db' : '#4b5563' }">
                {{ item.label }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 电路板电流粒子背景 */
.circuit-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  opacity: 0.92;
}

.circuit-bg::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 20% 25%, rgba(99, 102, 241, 0.15), transparent 45%);
}

.circuit-bg.dark-theme::before {
  background:
    radial-gradient(circle at 20% 25%, rgba(59, 130, 246, 0.22), transparent 50%),
    radial-gradient(circle at 78% 72%, rgba(14, 165, 233, 0.2), transparent 48%);
}

.circuit-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(37, 99, 235, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(37, 99, 235, 0.08) 1px, transparent 1px);
  background-size: 48px 48px;
}

.circuit-bg.dark-theme .circuit-grid {
  background-image:
    linear-gradient(rgba(59, 130, 246, 0.14) 1px, transparent 1px),
    linear-gradient(90deg, rgba(59, 130, 246, 0.14) 1px, transparent 1px);
}

.circuit-trace {
  position: absolute;
  opacity: 0.85;
  pointer-events: none;
}

.trace-h-1,
.trace-h-2,
.trace-h-3 {
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(59, 130, 246, 0.2) 25%,
    rgba(59, 130, 246, 0.8) 50%,
    transparent 100%
  );
  animation: current-flow-x 7s linear infinite;
}

.trace-h-1 {
  width: 72%;
  top: 24%;
  left: 8%;
}

.trace-h-2 {
  width: 64%;
  top: 56%;
  left: 20%;
  animation-delay: -2s;
}

.trace-h-3 {
  width: 58%;
  top: 76%;
  left: 14%;
  animation-delay: -4s;
}

.trace-v-1,
.trace-v-2,
.trace-v-3 {
  width: 2px;
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(14, 165, 233, 0.2) 25%,
    rgba(14, 165, 233, 0.85) 50%,
    transparent 100%
  );
  animation: current-flow-y 8s linear infinite;
}

.trace-v-1 {
  height: 48%;
  left: 24%;
  top: 18%;
}

.trace-v-2 {
  height: 56%;
  left: 64%;
  top: 10%;
  animation-delay: -3s;
}

.trace-v-3 {
  height: 42%;
  left: 82%;
  top: 38%;
  animation-delay: -5s;
}

.circuit-bg.dark-theme .trace-h-1,
.circuit-bg.dark-theme .trace-h-2,
.circuit-bg.dark-theme .trace-h-3 {
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(59, 130, 246, 0.3) 25%,
    rgba(59, 130, 246, 0.98) 50%,
    transparent 100%
  );
}

.circuit-bg.dark-theme .trace-v-1,
.circuit-bg.dark-theme .trace-v-2,
.circuit-bg.dark-theme .trace-v-3 {
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(14, 165, 233, 0.28) 25%,
    rgba(14, 165, 233, 0.94) 50%,
    transparent 100%
  );
}

.circuit-particle {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(59, 130, 246, 0.95);
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.95);
  opacity: 0;
}

.particle-1 {
  top: 23%;
  animation: particle-run-x 5.2s linear infinite;
}

.particle-2 {
  top: 55%;
  animation: particle-run-x 6s linear infinite;
  animation-delay: -1.8s;
}

.particle-3 {
  left: 24%;
  animation: particle-run-y 6.6s linear infinite;
  animation-delay: -2.2s;
}

.particle-4 {
  left: 64%;
  animation: particle-run-y 5.4s linear infinite;
  animation-delay: -3.2s;
}

.circuit-bg.dark-theme .circuit-particle {
  background: rgba(59, 130, 246, 0.98);
  box-shadow: 0 0 14px rgba(59, 130, 246, 0.95);
}

@keyframes current-flow-x {
  0% {
    transform: translateX(-26px);
  }
  100% {
    transform: translateX(26px);
  }
}

@keyframes current-flow-y {
  0% {
    transform: translateY(-26px);
  }
  100% {
    transform: translateY(26px);
  }
}

@keyframes particle-run-x {
  0% {
    left: 8%;
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    left: 78%;
    opacity: 0;
  }
}

@keyframes particle-run-y {
  0% {
    top: 16%;
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    top: 74%;
    opacity: 0;
  }
}

/* 进入动画 */
@keyframes slide-in-from-bottom {
  from {
    opacity: 0;
    transform: translateY(30px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-in {
  animation: slide-in-from-bottom 0.5s ease-out;
}

/* 标题容器样式 */
.title-container {
  position: relative;
  margin: 0 auto;
  text-align: center;
  max-width: 90%;
}

/* 移除了横线装饰
.title-container::before,
.title-container::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 15%;
  height: 1px;
  background: currentColor;
  opacity: 0.3;
}

.title-container::before {
  left: 0;
  transform: translateX(-50%);
}

.title-container::after {
  right: 0;
  transform: translateX(50%);
}
*/

/* 标题艺术化样式 */
.title-artistic {
  word-break: break-word;
  hyphens: auto;
  display: block;
  padding: 0 1em;
  text-align: center;
  line-height: 1.4;
  letter-spacing: 0.02em;
}

.title-artistic::first-line {
  font-size: 0.9em;
}

.title-artistic::first-letter {
  font-size: 1.2em;
}

/* 响应式适配 */
@media (max-width: 640px) {
  .size-full {
    padding: 1rem;
  }

  .title-container {
    max-width: 95%;
  }

  .title-container::before,
  .title-container::after {
    width: 10%;
  }

  .title-artistic {
    font-size: 1rem;
    padding: 0 0.5em;
  }

  .title-artistic::first-line {
    font-size: 0.85em;
  }
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.slide-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.login-qrcode-panel {
  padding-top: 8px;
  border-top: 0;
}

.login-qrcode-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.login-qrcode-grid.single-item {
  grid-template-columns: minmax(0, 1fr);
}

.login-qrcode-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px 6px;
  border: 0;
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.6);
}

.login-qrcode-image {
  width: 92px;
  height: 92px;
  border-radius: 8px;
  object-fit: contain;
  background: #fff;
  border: 1px solid rgba(203, 213, 225, 0.65);
}

.login-qrcode-label {
  margin: 0;
  font-size: 12px;
  line-height: 1.2;
  text-align: center;
}
</style>
