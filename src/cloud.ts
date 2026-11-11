import { createWorkBuddyCloud } from '@tencent-ai/workbuddy-cloud-sdk'
import type { Database } from './database.types'

/**
 * 云服务公开配置。
 *
 * 这些值属于「前端可持有」的公开配置(不含任何服务端密钥),
 * 但为了让仓库克隆后能独立运行,这里支持通过环境变量覆盖:
 *
 *   VITE_CLOUD_ENDPOINT / VITE_CLOUD_PUBLISHABLE_KEY / VITE_CLOUD_OAUTH_RELAY
 *
 * 注意:publishableKey 仅标识应用,本身不含权限;
 * 服务端会校验请求 Origin,因此它不能被当作开放代理使用。
 */
const publicConfig = {
  resourceId:
    import.meta.env.VITE_CLOUD_RESOURCE_ID ?? 'wbcs_n5mWU9TNikFy5j3fUSyv2p',
  endpoint:
    import.meta.env.VITE_CLOUD_ENDPOINT ??
    'https://stylemate-34839.app.workbuddy.host',
  oauthRelayBaseUrl:
    import.meta.env.VITE_CLOUD_OAUTH_RELAY ??
    'https://www.workbuddy.cn/v2/as/genie-baas/oauth',
  publishableKey:
    import.meta.env.VITE_CLOUD_PUBLISHABLE_KEY ??
    'wbpk_JQ4RM2uVZZoJ8mV6wSjRb4_N5zj4LVU4sJlHzw6lApvYPS7tfPmDLl6',
}

/**
 * 全局唯一的云客户端。Auth / Database / LLM 共用同一实例,
 * 登录后数据库请求会自动携带当前会话。
 */
export const cloud = createWorkBuddyCloud<Database>({
  endpoint: publicConfig.endpoint,
  oauthRelayBaseUrl: publicConfig.oauthRelayBaseUrl,
  publishableKey: publicConfig.publishableKey,
})

export { publicConfig }
