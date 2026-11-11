import { useState } from 'react'
import type { RewriteRecord, StyleTemplate } from '../types'

interface Props {
  templates: StyleTemplate[]
  records: RewriteRecord[]
  onDeleteTemplate: (id: number) => Promise<void>
  onUpdateTemplate: (id: number, patch: Partial<StyleTemplate>) => Promise<void>
  onToggleFavorite: (id: number, next: boolean) => Promise<void>
  onDeleteRecord: (id: number) => Promise<void>
  onUseTemplate: (t: StyleTemplate) => void
  onReuseRecord: (r: RewriteRecord) => void
}

const TRAIT_KEYS: { key: keyof StyleTemplate['traits']; label: string }[] = [
  { key: 'language', label: '语言风格' },
  { key: 'sentence', label: '句式特点' },
  { key: 'diction', label: '用词习惯' },
  { key: 'emotion', label: '情绪表达' },
  { key: 'structure', label: '文章结构' },
]

export default function Library({
  templates,
  records,
  onDeleteTemplate,
  onUpdateTemplate,
  onToggleFavorite,
  onDeleteRecord,
  onUseTemplate,
  onReuseRecord,
}: Props) {
  const [tab, setTab] = useState<'templates' | 'history'>('templates')
  const [editing, setEditing] = useState<StyleTemplate | null>(null)
  const [editName, setEditName] = useState('')
  const [editSummary, setEditSummary] = useState('')
  const [editPrompt, setEditPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [historyFilter, setHistoryFilter] = useState<'all' | 'favorites'>('all')

  const favorites = records.filter((r) => r.isFavorite)
  const shownRecords = historyFilter === 'favorites' ? favorites : records

  function startEdit(t: StyleTemplate) {
    setEditing(t)
    setEditName(t.name)
    setEditSummary(t.summary)
    setEditPrompt(t.stylePrompt)
  }

  async function submitEdit() {
    if (!editing?.id) return
    setBusy(true)
    try {
      await onUpdateTemplate(editing.id, {
        name: editName.trim() || editing.name,
        summary: editSummary.trim(),
        stylePrompt: editPrompt.trim(),
      })
      setEditing(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <div className="row" style={{ alignItems: 'center' }}>
        <div className="tabs">
          <button
            className={`tab ${tab === 'templates' ? 'active' : ''}`}
            onClick={() => setTab('templates')}
          >
            风格库
            <span className="tab-badge">{templates.length}</span>
          </button>
          <button
            className={`tab ${tab === 'history' ? 'active' : ''}`}
            onClick={() => setTab('history')}
          >
            历史记录
            <span className="tab-badge">{records.length}</span>
          </button>
          <button
            className={`tab ${tab === 'history' && historyFilter === 'favorites' ? 'active' : ''}`}
            onClick={() => {
              setTab('history')
              setHistoryFilter('favorites')
            }}
          >
            收藏
            <span className="tab-badge">{favorites.length}</span>
          </button>
        </div>
        {tab === 'history' ? (
          <div className="spacer" />
        ) : null}
        {tab === 'history' ? (
          <div className="tabs">
            <button
              className={`tab ${historyFilter === 'all' ? 'active' : ''}`}
              onClick={() => setHistoryFilter('all')}
            >
              全部
            </button>
            <button
              className={`tab ${historyFilter === 'favorites' ? 'active' : ''}`}
              onClick={() => setHistoryFilter('favorites')}
            >
              仅收藏
            </button>
          </div>
        ) : null}
      </div>

      {tab === 'templates' ? (
        templates.length === 0 ? (
          <div className="card">
            <div className="empty">
              <div className="empty-icon">🗂️</div>
              还没有风格模板
              <div style={{ marginTop: 6, fontSize: 12 }}>
                去「风格实验室」上传 3～5 篇范文,生成你的第一个专属模板
              </div>
            </div>
          </div>
        ) : (
          <div className="template-grid">
            {templates.map((t) => (
              <div className="template-card" key={t.id}>
                <div className="template-head">
                  <div className="grow">
                    <div className="template-name">{t.name}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>
                      基于 {t.sampleCount} 篇范文 ·{' '}
                      {t.createdAt
                        ? new Date(t.createdAt).toLocaleDateString('zh-CN')
                        : ''}
                    </div>
                  </div>
                  {t.scene !== 'custom' ? (
                    <span className="pill pill-accent">
                      {t.scene === 'xiaohongshu'
                        ? '小红书'
                        : t.scene === 'email'
                          ? '正式邮件'
                          : t.scene === 'wechat'
                            ? '公众号'
                            : '英文'}
                    </span>
                  ) : null}
                </div>

                <div className="template-summary">{t.summary}</div>

                <div className="trait-list">
                  {TRAIT_KEYS.map(({ key, label }) => (
                    <div className="trait-item" key={key}>
                      <span className="trait-key">{label}</span>
                      <span className="trait-val">{t.traits[key] || '—'}</span>
                    </div>
                  ))}
                </div>

                <div className="template-foot">
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => onUseTemplate(t)}
                  >
                    使用此风格
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => startEdit(t)}
                  >
                    编辑
                  </button>
                  <div className="spacer" />
                  <button
                    className="btn btn-sm btn-ghost btn-danger"
                    onClick={() => t.id && onDeleteTemplate(t.id)}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : shownRecords.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon">📝</div>
            {historyFilter === 'favorites' ? '还没有收藏的文案' : '还没有改写记录'}
            <div style={{ marginTop: 6, fontSize: 12 }}>
              在「改写工作台」生成内容后点「保存到历史」即可留存
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="stack">
            {shownRecords.map((r) => (
              <div className="history-item" key={r.id}>
                <div className="history-text">{r.resultText}</div>
                <div className="history-meta">
                  {r.variantLabel ? (
                    <span className="pill pill-pink">
                      {r.variantLabel} · {r.variantDesc}
                    </span>
                  ) : null}
                  {r.templateName ? (
                    <span className="pill pill-accent">{r.templateName}</span>
                  ) : null}
                  <span className="pill">
                    正式 {r.tone.formality} · 情绪 {r.tone.emotion} ·{' '}
                    {r.tone.length === 'short'
                      ? '简短'
                      : r.tone.length === 'long'
                        ? '详尽'
                        : '适中'}
                  </span>
                  <span className="muted" style={{ fontSize: 11 }}>
                    {r.createdAt
                      ? new Date(r.createdAt).toLocaleString('zh-CN', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''}
                  </span>
                  <div className="spacer" />
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() =>
                      r.id && onToggleFavorite(r.id, !r.isFavorite)
                    }
                  >
                    {r.isFavorite ? '★ 已收藏' : '☆ 收藏'}
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => onReuseRecord(r)}
                  >
                    复用
                  </button>
                  <button
                    className="btn btn-sm btn-ghost btn-danger"
                    onClick={() => r.id && onDeleteRecord(r.id)}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {editing ? (
        <div className="modal-mask" onClick={() => setEditing(null)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <span className="modal-title">编辑风格模板</span>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => setEditing(null)}
              >
                关闭
              </button>
            </div>
            <div className="stack">
              <div>
                <label className="label">模板名称</label>
                <input
                  className="input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div>
                <label className="label">风格描述</label>
                <textarea
                  className="textarea"
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                />
              </div>
              <div>
                <label className="label">风格指令</label>
                <textarea
                  className="textarea"
                  style={{ minHeight: 150 }}
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                />
              </div>
              <div className="result-actions">
                <button
                  className="btn btn-primary"
                  onClick={submitEdit}
                  disabled={busy}
                >
                  {busy ? '保存中…' : '保存修改'}
                </button>
                <button className="btn" onClick={() => setEditing(null)}>
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
