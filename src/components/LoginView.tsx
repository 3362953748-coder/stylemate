import { useEffect, useState } from 'react'
import { cloud } from '../cloud'

interface Props {
  onSignedIn: () => void
}

/**
 * 登录页。
 * 工作台账号登录走平台 Relay,回调地址必须是站点根路径。
 */
export default function LoginView({ onSignedIn }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const url = new URL(location.href)
        const hasCallback =
          url.searchParams.has('code') || url.searchParams.has('error')
        if (hasCallback) {
          const provider = url.searchParams.get('provider')
          const handler =
            provider === 'workbuddy'
              ? cloud.auth.handleWorkBuddyCallback
              : cloud.auth.handleWechatWebCallback
          if (typeof handler !== 'function') {
            setError('登录组件未加载完成,请刷新页面重试')
            return
          }
          const { data: session, error: cbError } = await handler.call(cloud.auth)
          if (cbError) {
            setError(cbError.message)
            return
          }
          if (session) {
            for (const key of ['code', 'state', 'provider']) {
              url.searchParams.delete(key)
            }
            history.replaceState(
              null,
              '',
              `${url.pathname}${url.search}${url.hash}`,
            )
            onSignedIn()
            return
          }
        }
        const { data: session } = await cloud.auth.getSession()
        if (!cancelled && session) onSignedIn()
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '登录状态检查失败')
        }
      } finally {
        if (!cancelled) setChecking(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [onSignedIn])

  async function startLogin(provider: 'workbuddy' | 'wechat') {
    setBusy(true)
    setError('')
    try {
      const back = new URL(location.href)
      back.pathname = '/'
      for (const key of ['code', 'state', 'provider']) back.searchParams.delete(key)

      const { data, error: err } = await cloud.auth.signInWithOAuth({
        provider,
        redirectTo: back.toString(),
      })
      if (err) {
        setError(err.message)
        setBusy(false)
        return
      }
      location.assign(data.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : '登录失败,请重试')
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">✍️</div>
        <div className="login-title">StyleMate</div>
        <div className="login-desc">
          让 AI 从多篇范文中学习你喜欢的表达方式,形成可复用的专属写作风格库。
        </div>

        {error ? (
          <div className="banner banner-error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        ) : null}

        <div className="stack">
          <button
            className="btn btn-primary"
            style={{ justifyContent: 'center', padding: '11px 17px' }}
            disabled={busy || checking}
            onClick={() => startLogin('workbuddy')}
          >
            {busy ? '正在跳转…' : '使用 WorkBuddy 登录'}
          </button>
          <button
            className="btn"
            style={{ justifyContent: 'center', padding: '11px 17px' }}
            disabled={busy || checking}
            onClick={() => startLogin('wechat')}
          >
            微信扫码登录
          </button>
        </div>

        <div className="login-note">
          登录后,你的风格模板与改写历史会保存在云端,换设备也能继续使用。
          <br />
          工作台账号登录需在已发布的站点域名下完成授权。
        </div>
      </div>
    </div>
  )
}
