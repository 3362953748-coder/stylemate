import { useEffect, useRef, useState } from 'react'
import { generateVariants, refineText, rewriteText } from '../llm'
import {
  LENGTH_LABEL,
  SCENES,
  VARIANTS,
  type SceneKey,
  type StyleTemplate,
  type ToneConfig,
  type VariantKey,
} from '../types'

/** 历史记录「复用」时携带的回填数据 */
export interface ReuseSeed {
  sourceText: string
  tone: ToneConfig
  templateId: number | null
  scene: SceneKey | 'custom'
  nonce: number
}

interface Props {
  templates: StyleTemplate[]
  reuseSeed: ReuseSeed | null
  onSaveResult: (payload: {
    sourceText: string
    resultText: string
    scene: SceneKey | 'custom'
    templateId: number | null
    templateName: string | null
    variantLabel: string | null
    variantDesc: string | null
    tone: ToneConfig
  }) => Promise<void>
  onUseTemplate: (t: StyleTemplate) => void
}

export default function RewriteWorkbench({
  templates,
  reuseSeed,
  onSaveResult,
  onUseTemplate,
}: Props) {
  const [source, setSource] = useState('')
  const [scene, setScene] = useState<SceneKey>('xiaohongshu')
  const [tone, setTone] = useState<ToneConfig>(SCENES[0].defaults)
  const [templateId, setTemplateId] = useState<number | null>(null)

  const [output, setOutput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')

  const [variants, setVariants] = useState<{
    texts: Partial<Record<VariantKey, string>>
    descs: Partial<Record<VariantKey, string>>
  }>({ texts: {}, descs: {} })
  const [variantRunning, setVariantRunning] = useState(false)
  const [selectedVariant, setSelectedVariant] = useState<VariantKey | null>(null)

  const [refineInput, setRefineInput] = useState('')
  const [refining, setRefining] = useState(false)

  const abortRef = useRef<AbortController | null>(null)

  const activeTemplate = templates.find((t) => t.id === templateId) ?? null
  const sceneConfig = SCENES.find((s) => s.key === scene)!

  // 历史记录「复用」:回填原文、语气与所选模板
  useEffect(() => {
    if (!reuseSeed) return
    setSource(reuseSeed.sourceText)
    setTone(reuseSeed.tone)
    setTemplateId(reuseSeed.templateId)
    if (reuseSeed.scene !== 'custom') {
      setScene(reuseSeed.scene)
    }
    setOutput('')
    setVariants({ texts: {}, descs: {} })
    setSelectedVariant(null)
    setError('')
  }, [reuseSeed])

  function pickScene(key: SceneKey) {
    setScene(key)
    const cfg = SCENES.find((s) => s.key === key)!
    setTone(cfg.defaults)
  }

  async function doRewrite() {
    if (!source.trim()) {
      setError('请先输入要改写的内容')
      return
    }
    setError('')
    setStreaming(true)
    setOutput('')
    setVariants({ texts: {}, descs: {} })
    setSelectedVariant(null)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const text = await rewriteText(
        source,
        scene,
        tone,
        activeTemplate?.stylePrompt ?? null,
        sceneConfig.systemPrompt,
        (delta) => setOutput((prev) => prev + delta),
        controller.signal,
      )
      setOutput(text)
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(e instanceof Error ? e.message : '改写失败,请重试')
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  function stopRewrite() {
    abortRef.current?.abort()
    abortRef.current = null
    setStreaming(false)
  }

  async function doVariants() {
    if (!source.trim()) {
      setError('请先输入要改写的内容')
      return
    }
    setError('')
    setVariantRunning(true)
    setVariants({ texts: {}, descs: {} })
    setSelectedVariant(null)
    try {
      const results = await generateVariants(
        source,
        scene,
        tone,
        activeTemplate?.stylePrompt ?? null,
        sceneConfig.systemPrompt,
        VARIANTS.map((v) => ({
          label: v.key,
          desc: v.desc,
          hint: v.hint,
        })),
        (_index, result) => {
          const key = result.label as VariantKey
          setVariants((prev) => ({
            texts: { ...prev.texts, [key]: result.text },
            descs: { ...prev.descs, [key]: result.desc },
          }))
        },
      )
      setVariants({
        texts: {
          A: results[0]?.text ?? '',
          B: results[1]?.text ?? '',
          C: results[2]?.text ?? '',
        },
        descs: {
          A: results[0]?.desc ?? '',
          B: results[1]?.desc ?? '',
          C: results[2]?.desc ?? '',
        },
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : '多版本生成失败,请重试')
    } finally {
      setVariantRunning(false)
    }
  }

  async function doRefine() {
    const target = selectedVariant ? variants.texts[selectedVariant] : output
    if (!target?.trim()) {
      setError('当前没有可修改的内容')
      return
    }
    if (!refineInput.trim()) {
      setError('请描述你想要调整的方向')
      return
    }
    setError('')
    setRefining(true)
    try {
      const refined = await refineText(
        target,
        refineInput.trim(),
        scene,
        activeTemplate?.stylePrompt ?? null,
        sceneConfig.systemPrompt,
      )
      if (selectedVariant) {
        const key = selectedVariant
        setVariants((prev) => ({
          ...prev,
          texts: { ...prev.texts, [key]: refined },
        }))
      } else {
        setOutput(refined)
      }
      setRefineInput('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '修改失败,请重试')
    } finally {
      setRefining(false)
    }
  }

  async function persist(text: string, label: VariantKey | null) {
    try {
      await onSaveResult({
        sourceText: source,
        resultText: text,
        scene: activeTemplate ? 'custom' : scene,
        templateId: activeTemplate?.id ?? null,
        templateName: activeTemplate?.name ?? null,
        variantLabel: label ? VARIANTS.find((v) => v.key === label)?.label ?? null : null,
        variantDesc: label ? variants.descs[label] ?? null : null,
        tone,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存到历史失败')
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card-title">✏️ 改写你的文案</div>
        <div className="card-desc">
          选择目标风格与语气,AI 会按你的偏好重写这段文字。
        </div>

        {error ? (
          <div className="banner banner-error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        ) : null}

        <label className="label">原文内容</label>
        <textarea
          className="textarea"
          style={{ minHeight: 118 }}
          placeholder="粘贴需要改写的内容,例如一段产品介绍、一封邮件草稿、一条社交动态…"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        />
        <div className="char-count">{source.length} 字符</div>

        <div className="section-gap">
          <label className="label">目标风格</label>
          <div className="scene-grid">
            {SCENES.map((s) => (
              <button
                key={s.key}
                className={`scene-card ${scene === s.key ? 'active' : ''}`}
                onClick={() => pickScene(s.key)}
              >
                <div className="scene-icon">{s.icon}</div>
                <div className="scene-name">{s.label}</div>
                <div className="scene-desc">{s.description}</div>
              </button>
            ))}
          </div>
        </div>

        {templates.length > 0 ? (
          <div className="section-gap">
            <label className="label">叠加我的专属风格(可选)</label>
            <div className="row">
              <select
                className="select"
                value={templateId ?? ''}
                onChange={(e) =>
                  setTemplateId(e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">不使用专属模板</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}({t.sampleCount} 篇范文)
                  </option>
                ))}
              </select>
              {activeTemplate ? (
                <button
                  className="btn btn-sm"
                  onClick={() => onUseTemplate(activeTemplate)}
                >
                  查看模板
                </button>
              ) : null}
            </div>
            {activeTemplate ? (
              <div className="muted" style={{ marginTop: 7 }}>
                将严格模仿「{activeTemplate.name}」的用词偏好与叙述节奏。
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="section-gap">
          <label className="label">语气调节</label>
          <div className="tone-row">
            <div>
              <div className="tone-head">
                <span className="tone-name">正式程度</span>
                <span className="tone-val">{tone.formality} / 5</span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                value={tone.formality}
                onChange={(e) =>
                  setTone({ ...tone, formality: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <div className="tone-head">
                <span className="tone-name">情绪浓度</span>
                <span className="tone-val">{tone.emotion} / 5</span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                value={tone.emotion}
                onChange={(e) =>
                  setTone({ ...tone, emotion: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <div className="tone-head">
                <span className="tone-name">表达长度</span>
                <span className="tone-val">
                  {LENGTH_LABEL[tone.length]}
                </span>
              </div>
              <div className="length-group">
                {(['short', 'medium', 'long'] as const).map((len) => (
                  <button
                    key={len}
                    className={`length-btn ${tone.length === len ? 'active' : ''}`}
                    onClick={() => setTone({ ...tone, length: len })}
                  >
                    {LENGTH_LABEL[len]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="result-actions" style={{ marginTop: 18 }}>
          {streaming ? (
            <button className="btn btn-danger" onClick={stopRewrite}>
              ⏹ 停止生成
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={doRewrite}
              disabled={!source.trim()}
            >
              ✨ 生成改写
            </button>
          )}
          <button
            className="btn"
            onClick={doVariants}
            disabled={variantRunning || !source.trim()}
          >
            {variantRunning ? '生成中…' : '🔀 生成三个版本对比'}
          </button>
        </div>
      </div>

      {output || streaming ? (
        <div className="card fade-in">
          <div className="card-title">改写结果</div>
          <div className="card-desc">
            {streaming ? 'AI 正在生成…' : '生成完成,可继续微调或保存'}
          </div>
          <div className={`result-box ${streaming ? 'streaming' : ''}`}>{output}</div>

          {!streaming ? (
            <>
              <div className="result-actions">
                <button className="btn btn-sm" onClick={() => persist(output, null)}>
                  💾 保存到历史
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => navigator.clipboard?.writeText(output)}
                >
                  复制
                </button>
              </div>

              <div className="section-gap">
                <label className="label">继续微调</label>
                <div className="inline-field">
                  <input
                    className="input grow"
                    placeholder="例如:再口语一点 / 开头更吸引人 / 加一句数据支撑"
                    value={refineInput}
                    onChange={(e) => setRefineInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) doRefine()
                    }}
                  />
                  <button
                    className="btn"
                    onClick={doRefine}
                    disabled={refining || !refineInput.trim()}
                  >
                    {refining ? '修改中…' : '应用修改'}
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {variantRunning || variants.texts.A ? (
        <div className="card fade-in">
          <div className="card-title">🔀 多版本对比</div>
          <div className="card-desc">
            同一段内容的三个取向,点击卡片选中后可继续微调
          </div>
          <div className="variant-grid">
            {VARIANTS.map((v) => {
              const text = variants.texts[v.key]
              return (
                <div
                  key={v.key}
                  className={`variant-card ${selectedVariant === v.key ? 'selected' : ''}`}
                  onClick={() => text && setSelectedVariant(v.key)}
                >
                  <div className="variant-head">
                    <span className="variant-label">{v.label}</span>
                    <span className="pill pill-blue">{v.desc}</span>
                    <div className="spacer" />
                    {selectedVariant === v.key ? (
                      <span className="pill pill-accent">已选中</span>
                    ) : null}
                  </div>
                  <div className="variant-body">
                    {text ? (
                      text
                    ) : (
                      <div className="variant-loading">
                        <span className="spinner" />
                        <span>生成中…</span>
                      </div>
                    )}
                  </div>
                  <div className="variant-foot">
                    <button
                      className="btn btn-sm"
                      disabled={!text}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (text) persist(text, v.key)
                      }}
                    >
                      收藏
                    </button>
                    <button
                      className="btn btn-sm"
                      disabled={!text}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!text) return
                        setOutput(text)
                        setSelectedVariant(v.key)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                    >
                      继续编辑
                    </button>
                    <div className="spacer" />
                    <span className="muted" style={{ fontSize: 11 }}>
                      {v.hint}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {selectedVariant && variants.texts[selectedVariant] ? (
            <div className="section-gap">
              <div className="muted" style={{ marginBottom: 7 }}>
                正在微调 {VARIANTS.find((v) => v.key === selectedVariant)?.label} ·{' '}
                {variants.descs[selectedVariant]}
              </div>
              <div className="inline-field">
                <input
                  className="input grow"
                  placeholder="描述你想怎么调整这个版本"
                  value={refineInput}
                  onChange={(e) => setRefineInput(e.target.value)}
                />
                <button
                  className="btn"
                  onClick={doRefine}
                  disabled={refining || !refineInput.trim()}
                >
                  {refining ? '修改中…' : '应用修改'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
