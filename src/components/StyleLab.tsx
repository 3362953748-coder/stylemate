import { useState } from 'react'
import { analyzeStyle, type StyleAnalysis } from '../llm'
import { SCENES, type SceneKey, type StyleTemplate } from '../types'

interface Props {
  onSaveTemplate: (t: StyleTemplate) => Promise<void>
}

const TRAIT_KEYS: { key: keyof StyleAnalysis['traits']; label: string }[] = [
  { key: 'language', label: '语言风格' },
  { key: 'sentence', label: '句式特点' },
  { key: 'diction', label: '用词习惯' },
  { key: 'emotion', label: '情绪表达' },
  { key: 'structure', label: '文章结构' },
]

export default function StyleLab({ onSaveTemplate }: Props) {
  const [samples, setSamples] = useState<string[]>([''])
  const [scene, setScene] = useState<SceneKey | 'custom'>('custom')
  const [analysis, setAnalysis] = useState<StyleAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const validCount = samples.filter((s) => s.trim().length > 0).length

  function updateSample(index: number, value: string) {
    setSamples((prev) => prev.map((s, i) => (i === index ? value : s)))
    setAnalysis(null)
    setSaved(false)
  }

  function addSample() {
    if (samples.length >= 5) return
    setSamples((prev) => [...prev, ''])
  }

  function removeSample(index: number) {
    setSamples((prev) => (prev.length === 1 ? [''] : prev.filter((_, i) => i !== index)))
    setAnalysis(null)
  }

  async function runAnalysis() {
    const clean = samples.filter((s) => s.trim())
    if (clean.length === 0) {
      setError('请至少提供一篇范文')
      return
    }
    if (clean.length < 3) {
      setError('建议提供 3～5 篇范文 —— 样本越多,风格归纳越准确')
    } else {
      setError('')
    }
    setLoading(true)
    setAnalysis(null)
    setSaved(false)
    setProgress('准备中…')
    try {
      const result = await analyzeStyle(clean, scene, setProgress)
      setAnalysis(result)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '风格分析失败'
      setError(msg)
    } finally {
      setLoading(false)
      setProgress('')
    }
  }

  async function save() {
    if (!analysis) return
    setSaving(true)
    try {
      await onSaveTemplate({
        name: analysis.name,
        scene,
        summary: analysis.summary,
        traits: analysis.traits,
        stylePrompt: analysis.stylePrompt,
        sampleCount: analysis.sampleCount,
        sourceExcerpt: analysis.sourceExcerpt,
      })
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card-title">🧬 专属风格模板</div>
        <div className="card-desc">
          上传 3～5 篇你喜欢的范文,AI 会逐篇提取表达特征,再归纳成一份可反复使用的风格模板。
        </div>

        {error ? (
          <div className="banner banner-warn">
            <span>💡</span>
            <span>{error}</span>
          </div>
        ) : null}

        <div className="section-gap">
          <label className="label">范文适用场景(可选,有助于归因)</label>
          <div className="scene-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            <button
              className={`scene-card ${scene === 'custom' ? 'active' : ''}`}
              onClick={() => setScene('custom')}
            >
              <div className="scene-icon">✨</div>
              <div className="scene-name">通用</div>
              <div className="scene-desc">不限场景</div>
            </button>
            {SCENES.map((s) => (
              <button
                key={s.key}
                className={`scene-card ${scene === s.key ? 'active' : ''}`}
                onClick={() => setScene(s.key)}
              >
                <div className="scene-icon">{s.icon}</div>
                <div className="scene-name">{s.shortLabel}</div>
                <div className="scene-desc">{s.description.split('，')[0]}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="section-gap">
          <div className="row" style={{ alignItems: 'center', marginBottom: 12 }}>
            <label className="label" style={{ marginBottom: 0 }}>
              我的范文({validCount}/5)
            </label>
            <div className="spacer" />
            <button
              className="btn btn-sm"
              onClick={addSample}
              disabled={samples.length >= 5}
            >
              + 添加一篇
            </button>
          </div>

          <div className="sample-list">
            {samples.map((sample, i) => (
              <div className="sample-item" key={i}>
                <div className="sample-item-head">
                  <span className="pill">范文 {i + 1}</span>
                  <div className="spacer" />
                  {samples.length > 1 ? (
                    <button
                      className="btn btn-sm btn-ghost btn-danger"
                      onClick={() => removeSample(i)}
                    >
                      移除
                    </button>
                  ) : null}
                </div>
                <textarea
                  className="textarea"
                  style={{ minHeight: 92 }}
                  placeholder={`粘贴第 ${i + 1} 篇范文原文。支持直接粘贴小红书笔记、公众号文章、邮件片段等。`}
                  value={sample}
                  onChange={(e) => updateSample(i, e.target.value)}
                />
                <div className="char-count">{sample.length} 字符</div>
              </div>
            ))}
          </div>
        </div>

        <div className="result-actions" style={{ marginTop: 18 }}>
          <button
            className="btn btn-primary"
            onClick={runAnalysis}
            disabled={loading || validCount === 0}
          >
            {loading ? '分析中…' : '🔍 开始分析风格'}
          </button>
          {loading ? (
            <span className="variant-loading" style={{ padding: 0 }}>
              <span className="spinner" />
              <span>{progress}</span>
            </span>
          ) : null}
        </div>
      </div>

      {analysis ? (
        <div className="card fade-in">
          <div className="card-title">✨ {analysis.name}</div>
          <div className="card-desc">
            已基于 {analysis.sampleCount} 篇范文生成 · 风格描述
          </div>

          <p
            style={{
              fontSize: 13,
              color: 'var(--text-dim)',
              lineHeight: 1.75,
              marginBottom: 16,
            }}
          >
            {analysis.summary}
          </p>

          <div className="trait-list" style={{ marginBottom: 18 }}>
            {TRAIT_KEYS.map(({ key, label }) => (
              <div className="trait-item" key={key}>
                <span className="trait-key">{label}</span>
                <span className="trait-val">{analysis.traits[key] || '—'}</span>
              </div>
            ))}
          </div>

          <label className="label">风格指令(用于指导 AI 改写)</label>
          <div
            className="result-box"
            style={{ fontSize: 12.5, lineHeight: 1.8, color: 'var(--text-dim)' }}
          >
            {analysis.stylePrompt}
          </div>

          <div className="result-actions">
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? '保存中…' : saved ? '✓ 已保存到风格库' : '💾 保存为风格模板'}
            </button>
            {saved ? (
              <span className="pill pill-green">可在「改写」和「风格库」中使用</span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
