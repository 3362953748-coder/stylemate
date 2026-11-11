import { useCallback, useEffect, useState } from 'react'
import { cloud } from './cloud'
import LoginView from './components/LoginView'
import Library from './components/Library'
import RewriteWorkbench from './components/RewriteWorkbench'
import StyleLab from './components/StyleLab'
import {
  deleteRecord,
  deleteTemplate,
  listRecords,
  listTemplates,
  saveRecord,
  saveTemplate,
  toggleFavorite,
  updateTemplate,
} from './storage'
import type { RewriteRecord, StyleTemplate } from './types'

type TabKey = 'rewrite' | 'style' | 'library'

interface Toast {
  id: number
  message: string
  kind: 'success' | 'error' | 'info'
}

/** 历史记录「复用」时携带的回填数据 */
export interface ReuseSeed {
  sourceText: string
  tone: RewriteRecord['tone']
  templateId: number | null
  scene: RewriteRecord['scene']
  /** 变化即触发一次回填 */
  nonce: number
}

export default function App() {
  const [authReady, setAuthReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [userName, setUserName] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  const [tab, setTab] = useState<TabKey>('rewrite')
  const [templates, setTemplates] = useState<StyleTemplate[]>([])
  const [records, setRecords] = useState<RewriteRecord[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const [bootError, setBootError] = useState('')
  const [reuseSeed, setReuseSeed] = useState<ReuseSeed | null>(null)

  const pushToast = useCallback((message: string, kind: Toast['kind'] = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, kind }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3200)
  }, [])

  const refreshData = useCallback(async () => {
    try {
      const [tpls, recs] = await Promise.all([listTemplates(), listRecords()])
      setTemplates(tpls)
      setRecords(recs)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '数据加载失败'
      setBootError(msg)
    }
  }, [])

  // 会话恢复
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await cloud.auth.getSession()
        if (cancelled) return
        if (!error && data) {
          setSignedIn(true)
          setUserName(data.user?.name ?? null)
          setAvatarUrl(data.user?.avatarUrl ?? null)
        }
      } catch {
        /* 未登录,展示登录页 */
      } finally {
        if (!cancelled) setAuthReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // 登录后拉取云端数据
  useEffect(() => {
    if (signedIn) refreshData()
  }, [signedIn, refreshData])

  // 监听会话变化
  useEffect(() => {
    const unsubscribe = cloud.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setSignedIn(false)
        setTemplates([])
        setRecords([])
      } else if (session) {
        setSignedIn(true)
        setUserName(session.user?.name ?? null)
        setAvatarUrl(session.user?.avatarUrl ?? null)
      }
    })
    return () => unsubscribe()
  }, [])

  async function handleSaveTemplate(t: StyleTemplate) {
    const saved = await saveTemplate(t, userName)
    setTemplates((prev) => [saved, ...prev])
    pushToast('风格模板已保存到风格库', 'success')
  }

  async function handleSaveResult(payload: {
    sourceText: string
    resultText: string
    scene: RewriteRecord['scene']
    templateId: number | null
    templateName: string | null
    variantLabel: string | null
    variantDesc: string | null
    tone: RewriteRecord['tone']
  }) {
    const rec = await saveRecord({ ...payload, isFavorite: false }, userName)
    setRecords((prev) => [rec, ...prev])
    pushToast('已保存到历史记录', 'success')
  }

  async function handleDeleteTemplate(id: number) {
    try {
      await deleteTemplate(id)
      setTemplates((prev) => prev.filter((t) => t.id !== id))
      pushToast('模板已删除', 'success')
    } catch (e) {
      pushToast(e instanceof Error ? e.message : '删除失败', 'error')
    }
  }

  async function handleUpdateTemplate(id: number, patch: Partial<StyleTemplate>) {
    try {
      await updateTemplate(id, patch)
      setTemplates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      )
      pushToast('模板已更新', 'success')
    } catch (e) {
      pushToast(e instanceof Error ? e.message : '更新失败', 'error')
    }
  }

  async function handleToggleFavorite(id: number, next: boolean) {
    try {
      await toggleFavorite(id, next)
      setRecords((prev) =>
        prev.map((r) => (r.id === id ? { ...r, isFavorite: next } : r)),
      )
    } catch (e) {
      pushToast(e instanceof Error ? e.message : '操作失败', 'error')
    }
  }

  async function handleDeleteRecord(id: number) {
    try {
      await deleteRecord(id)
      setRecords((prev) => prev.filter((r) => r.id !== id))
      pushToast('记录已删除', 'success')
    } catch (e) {
      pushToast(e instanceof Error ? e.message : '删除失败', 'error')
    }
  }

  function handleUseTemplate(t: StyleTemplate) {
    setTab('rewrite')
    pushToast(`已在改写工作台选中「${t.name}」`, 'info')
  }

  function handleReuseRecord(r: RewriteRecord) {
    setTab('rewrite')
    setReuseSeed({
      sourceText: r.sourceText,
      tone: r.tone,
      templateId: r.templateId ?? null,
      scene: r.scene,
      nonce: Date.now(),
    })
    pushToast('已载入该次改写的原文与语气设置', 'info')
  }

  async function signOut() {
    await cloud.auth.signOut()
    setSignedIn(false)
    setTemplates([])
    setRecords([])
  }

  if (!authReady) {
    return (
      <div className="app">
        <div className="login-wrap">
          <div className="variant-loading">
            <span className="spinner" />
            <span>正在加载…</span>
          </div>
        </div>
      </div>
    )
  }

  if (!signedIn) {
    return (
      <div className="app">
        <LoginView onSignedIn={() => setSignedIn(true)} />
        {toasts.length ? (
          <div className="toast-host">
            {toasts.map((t) => (
              <div key={t.id} className={`toast ${t.kind}`}>
                {t.message}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">
          <span className="logo-mark">✍️</span>
          <div>
            <div>StyleMate</div>
            <div className="logo-sub">AI 个人风格写作助手</div>
          </div>
        </div>

        <nav className="tabs">
          <button
            className={`tab ${tab === 'rewrite' ? 'active' : ''}`}
            onClick={() => setTab('rewrite')}
          >
            改写工作台
          </button>
          <button
            className={`tab ${tab === 'style' ? 'active' : ''}`}
            onClick={() => setTab('style')}
          >
            风格实验室
          </button>
          <button
            className={`tab ${tab === 'library' ? 'active' : ''}`}
            onClick={() => setTab('library')}
          >
            风格库与历史
          </button>
        </nav>

        <div className="topbar-right">
          <div className="user-chip">
            <span className="avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" />
              ) : (
                (userName ?? 'U').slice(0, 1).toUpperCase()
              )}
            </span>
            <span>{userName ?? '已登录'}</span>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={signOut}>
            退出
          </button>
        </div>
      </header>

      <main className="main">
        <div className="workspace">
          <div className="workspace-inner">
            {bootError ? (
              <div className="banner banner-error">
                <span>⚠️</span>
                <span>{bootError}</span>
              </div>
            ) : null}

            {tab === 'rewrite' ? (
              <RewriteWorkbench
                templates={templates}
                reuseSeed={reuseSeed}
                onSaveResult={handleSaveResult}
                onUseTemplate={handleUseTemplate}
              />
            ) : null}

            {tab === 'style' ? (
              <StyleLab onSaveTemplate={handleSaveTemplate} />
            ) : null}

            {tab === 'library' ? (
              <Library
                templates={templates}
                records={records}
                onDeleteTemplate={handleDeleteTemplate}
                onUpdateTemplate={handleUpdateTemplate}
                onToggleFavorite={handleToggleFavorite}
                onDeleteRecord={handleDeleteRecord}
                onUseTemplate={handleUseTemplate}
                onReuseRecord={handleReuseRecord}
              />
            ) : null}
          </div>
        </div>
      </main>

      {toasts.length ? (
        <div className="toast-host">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.kind}`}>
              {t.message}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
