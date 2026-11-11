import { cloud } from './cloud'
import {
  SCENE_MAP,
  intensityDirective,
  toneDirective,
  type SceneKey,
  type StyleTraits,
  type ToneConfig,
} from './types'

/**
 * 模型目录:首次调用前拉取并择优。
 * 风格分析需要稳定输出 JSON,改写需要更强的语言表现力,
 * 因此按用途分别挑选候选模型。
 */
let modelCache: { analysis: string; rewrite: string } | null = null

/** 候选模型 id 优先级:越靠前越优先,不存在则自动跳过 */
const ANALYSIS_MODEL_PREFERENCE = ['balanced-model', 'auto', 'fast-model']
const REWRITE_MODEL_PREFERENCE = ['auto', 'balanced-model', 'fast-model']

function pickModel(
  models: { id: string; disabled?: boolean }[],
  preference: string[],
): string {
  const usable = models.filter((m) => m.disabled !== true)
  for (const preferred of preference) {
    const hit = usable.find((m) => m.id === preferred)
    if (hit) return hit.id
  }
  const fallback = usable[0]
  if (!fallback) throw new Error('当前没有可用的模型')
  return fallback.id
}

async function resolveModels(): Promise<{ analysis: string; rewrite: string }> {
  if (modelCache) return modelCache
  const models = (await cloud.llm.models.list()) as {
    id: string
    disabled?: boolean
  }[]
  if (models.length === 0) throw new Error('当前没有可用的模型')
  modelCache = {
    analysis: pickModel(models, ANALYSIS_MODEL_PREFERENCE),
    rewrite: pickModel(models, REWRITE_MODEL_PREFERENCE),
  }
  return modelCache
}

async function resolveModelId(): Promise<string> {
  const { rewrite } = await resolveModels()
  return rewrite
}

/** 收集流式增量,拼成完整文本 */
async function collectStream(
  messages: { role: string; content: string }[],
  options: {
    signal?: AbortSignal
    json?: boolean
    temperature?: number
    onDelta?: (text: string) => void
    /** 指定模型,不传则用默认改写模型 */
    model?: string
  } = {},
): Promise<string> {
  const model = options.model ?? (await resolveModelId())
  let content = ''

  const payload: Record<string, unknown> = {
    model,
    messages,
    stream: true,
    temperature: options.temperature ?? 0.9,
  }
  if (options.json) payload.response_format = { type: 'json_object' }
  if (options.signal) payload.signal = options.signal

  for await (const chunk of cloud.llm.chat.completions.create(payload as never)) {
    const delta = chunk.choices[0]?.delta?.content
    if (delta) {
      content += delta
      options.onDelta?.(delta)
    }
  }
  return content
}

/** 从可能带 markdown 围栏的输出里提取 JSON */
function parseJsonLoose(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1))
      } catch {
        /* fallthrough */
      }
    }
    throw new Error('模型返回的内容无法解析为结构化结果')
  }
}

export interface StyleAnalysis {
  name: string
  summary: string
  traits: StyleTraits
  stylePrompt: string
  sampleCount: number
  sourceExcerpt: string
}

/**
 * 核心差异化能力:从多篇范文提取用户的写作风格。
 * 分两步,避免长文本一次性分析时模型输出跑偏:
 * 1) 逐篇做细粒度特征提取(句长、语气词、修辞、人称等可观测指标)
 * 2) 汇总各篇特征,归纳成可复用的风格模板与 prompt
 */
export async function analyzeStyle(
  samples: string[],
  sceneHint: SceneKey | 'custom',
  onProgress?: (step: string) => void,
): Promise<StyleAnalysis> {
  const clean = samples.map((s) => s.trim()).filter(Boolean)
  if (clean.length === 0) throw new Error('请至少提供一篇范文')

  const { analysis: analysisModel } = await resolveModels()

  // 第一步:逐篇特征提取
  onProgress?.('正在逐篇提取表达特征…')
  const perSample: string[] = []
  for (let i = 0; i < clean.length; i++) {
    onProgress?.(`正在分析第 ${i + 1}/${clean.length} 篇范文…`)
    const raw = await collectStream(
      [
        {
          role: 'system',
          content:
            '你是一位文风分析专家。你的任务是从给定的一段文字中客观提取其写作特征,只描述你在文本中真实观察到的现象,不要臆测作者意图,不要输出改写建议。用简洁的中文短语回答,每项不超过 30 字。',
        },
        {
          role: 'user',
          content: `请提取这段文字的写作特征,严格按以下 JSON 格式输出,不要输出任何其他文字:\n{\n  "sentenceLength": "平均句长特征(如:多为10字以内的短句/长短句交替)",\n  "personUse": "人称使用(如:第一人称为主/第二人称对话/无人称客观陈述)",\n  "emotionalTone": "情绪基调(如:克制平静/热情外放/幽默调侃)",\n  "vocabulary": "用词特点(如:口语化日常词/书面正式语/夹杂网络用语)",\n  "sentencePattern": "句式套路(如:常以疑问句开头/设问后给答案/总分总结构)",\n  "rhetoric": "修辞与表达技巧(如:多用比喻/对比排比/场景代入/讲故事)",\n  "rhythm": "节奏感(如:短句密集推进/舒缓从容/长短交错)",\n  "structure": "整体结构(如:总-分-总/故事叙述/清单罗列/对比论证)",\n  "signature": "最有辨识度的1-2个标志性特征"\n}\n\n文字内容:\n"""\n${clean[i]}\n"""`,
        },
      ],
      { json: true, temperature: 0.4, model: analysisModel },
    )
    const parsed = parseJsonLoose(raw) as Record<string, string>
    perSample.push(
      `【范文 ${i + 1}】\n${Object.entries(parsed)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n')}`,
    )
  }

  // 第二步:汇总归纳成风格模板
  onProgress?.('正在归纳为专属风格模板…')
  const sceneLabel =
    sceneHint === 'custom'
      ? '通用写作'
      : (SCENE_MAP[sceneHint]?.label ?? '通用写作')

  const rawSummary = await collectStream(
    [
      {
          role: 'system',
        content:
          '你是一位资深写作风格顾问,擅长把零散的语言观察归纳成可复用的写作风格画像。你的输出会被直接存成风格模板,供后续改写任务作为风格指令使用,因此必须具体、可执行,不能是"生动活泼""结构清晰"这类空泛形容词。',
      },
      {
        role: 'user',
        content: `以下是用户提供的 ${clean.length} 篇范文的逐篇特征提取结果。这些文本属于【${sceneLabel}】场景。

${perSample.join('\n\n')}

请综合归纳出用户的个人写作风格,严格按以下 JSON 格式输出,不要输出任何其他文字:

{
  "name": "给这个风格起的名字,6-12字,体现特点(如:生活流碎碎念/冷幽默观察派)",
  "summary": "用2-3句话概括这个人的表达特点,涵盖他如何开头、怎么叙述、用什么语气,100字以内",
  "traits": {
    "language": "语言风格特征",
    "sentence": "句式特点",
    "diction": "用词习惯",
    "emotion": "情绪表达",
    "structure": "文章结构"
  },
  "stylePrompt": "一段可直接用于指导AI改写的中文风格指令,150-250字。要具体说明:用什么语气、如何组织句子、习惯用什么修辞、开头结尾怎么处理、明确要避免什么。这是整个模板最关键的部分。"
}

注意:trait 里每一项都要从上面的观察中提炼,不要套用通用模板;stylePrompt 要写成'像这个人一样说话'的实操指引。`,
      },
    ],
    { json: true, temperature: 0.6, model: analysisModel },
  )

  const summary = parseJsonLoose(rawSummary) as {
    name?: string
    summary?: string
    traits?: Partial<StyleTraits>
    stylePrompt?: string
  }

  const traits: StyleTraits = {
    language: summary.traits?.language || '自然流畅',
    sentence: summary.traits?.sentence || '长短句交替',
    diction: summary.traits?.diction || '贴合场景用词',
    emotion: summary.traits?.emotion || '情绪适中',
    structure: summary.traits?.structure || '清晰有层次',
  }

  return {
    name: summary.name?.trim() || '我的专属风格',
    summary: summary.summary?.trim() || '由范文分析生成的专属写作风格。',
    traits,
    stylePrompt:
      summary.stylePrompt?.trim() ||
      '模仿用户的表达习惯进行改写,保持其用词偏好和叙述节奏。',
    sampleCount: clean.length,
    sourceExcerpt: clean.map((s) => s.slice(0, 60)).join(' / ').slice(0, 240),
  }
}

/** 场景改写:支持内置场景风格或用户专属模板 */
export async function rewriteText(
  source: string,
  scene: SceneKey | 'custom',
  tone: ToneConfig,
  stylePrompt?: string | null,
  sceneSystemPrompt?: string | null,
  onDelta?: (text: string) => void,
  signal?: AbortSignal,
  /** 风格强度 0-100,仅在有个人模板时生效 */
  intensity: number = 70,
): Promise<string> {
  const base =
    sceneSystemPrompt ||
    (scene !== 'custom' ? SCENE_MAP[scene]?.systemPrompt : '') ||
    '你是一名专业的写作助手,改写文案使其更清晰、更有表达力。'

  const custom = stylePrompt
    ? `\n\n同时必须严格模仿以下用户的个人写作风格,这是最重要的要求:\n${stylePrompt}`
    : ''

  // 强度指令只在使用了个人模板时有意义 —— 没有模板时谈不上"浓度"
  const intensityNote = stylePrompt ? intensityDirective(intensity) : ''

  return collectStream(
    [
      { role: 'system', content: base + custom },
      {
        role: 'user',
        content: `${toneDirective(tone)}
${intensityNote}

请改写下面这段文字。只输出改写后的正文,不要加任何解释、前言或标题。

原文:
"""
${source}
"""`,
      },
    ],
    { onDelta, signal, temperature: 0.9 },
  )
}

export interface VariantResult {
  label: string
  desc: string
  text: string
}

/** 多版本并行生成:同一段内容产出 A/B/C 三个不同取向的版本 */
export async function generateVariants(
  source: string,
  scene: SceneKey | 'custom',
  tone: ToneConfig,
  stylePrompt: string | null,
  sceneSystemPrompt: string | null,
  variantSpecs: { label: string; desc: string; hint: string }[],
  onVersionDone?: (index: number, result: VariantResult) => void,
  intensity: number = 70,
): Promise<VariantResult[]> {
  const base =
    sceneSystemPrompt ||
    (scene !== 'custom' ? SCENE_MAP[scene]?.systemPrompt : '') ||
    '你是一名专业的写作助手。'
  const custom = stylePrompt
    ? `\n\n同时必须严格模仿以下用户的个人写作风格:\n${stylePrompt}`
    : ''
  const intensityNote = stylePrompt ? intensityDirective(intensity) : ''

  const results = await Promise.all(
    variantSpecs.map(async (spec, index) => {
      const text = await collectStream(
        [
          { role: 'system', content: base + custom },
          {
            role: 'user',
            content: `${toneDirective(tone)}
${intensityNote}

本次要求版本取向:【${spec.label} · ${spec.desc}】。具体标准:${spec.hint}。
请围绕这一取向改写,与其他版本形成明显区分,不要试图兼顾所有风格。

只输出改写后的正文,不要加任何解释或标签。

原文:
"""
${source}
"""`,
          },
        ],
        { temperature: 0.95 },
      )
      const result: VariantResult = { label: spec.label, desc: spec.desc, text }
      onVersionDone?.(index, result)
      return result
    }),
  )
  return results
}

/**
 * 风格一致性自评。
 *
 * 生成后让模型对照目标风格特征逐条打分,输出 0-100 的总分与
 * 若干条改进建议。这解决了竞品普遍缺失的「写完之后能不能自动
 * 检测一下风格匹配度」问题 —— 此前只能靠人眼判断。
 */
export async function evaluateConsistency(
  generated: string,
  traits: StyleTraits,
  stylePrompt: string | null,
  source?: string,
): Promise<{ score: number; suggestions: string[] }> {
  const { analysis } = await resolveModels()

  const traitLines = Object.entries(traits)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n')

  const raw = await collectStream(
    [
      {
        role: 'system',
        content:
          '你是一位严格的文风审校。你评估的是一段文本的**表达方式**与目标风格的匹配程度,' +
          '而不是内容题材是否合适。原文是产品介绍时,不必强求改成个人随笔;' +
          '你只判断句长节奏、用词习惯、语气与结构这些文风层面是否对齐。' +
          '评分要诚实严格,不要为了鼓励用户而给高分。只输出 JSON。',
      },
      {
        role: 'user',
        content: `目标风格特征:
${traitLines}

${stylePrompt ? `风格指令:\n${stylePrompt}\n` : ''}
待评估文本:
"""
${generated}
"""
${source ? `\n原始素材(仅供理解内容背景,不要求内容与之相同):\n"""\n${source}\n"""\n` : ''}
请评估该文本在**文风层面**与上述风格的匹配程度,严格按以下 JSON 输出:
{
  "score": 0到100的整数,总体文风匹配度,
  "suggestions": ["若要更贴合该文风,应该怎么改", "最多3条,每条不超过40字"]
}`,
      },
    ],
    { json: true, temperature: 0.3, model: analysis },
  )

  const parsed = parseJsonLoose(raw) as {
    score?: number
    suggestions?: string[]
  }
  const score = Math.max(0, Math.min(100, Math.round(parsed.score ?? 0)))
  const suggestions = Array.isArray(parsed.suggestions)
    ? parsed.suggestions.filter((s) => typeof s === 'string').slice(0, 3)
    : []
  return { score, suggestions }
}

/** 继续修改:基于已有版本做局部调整 */
export async function refineText(
  current: string,
  instruction: string,
  scene: SceneKey | 'custom',
  stylePrompt: string | null,
  sceneSystemPrompt: string | null,
  signal?: AbortSignal,
): Promise<string> {
  const base =
    sceneSystemPrompt ||
    (scene !== 'custom' ? SCENE_MAP[scene]?.systemPrompt : '') ||
    '你是一名专业的写作助手。'
  const custom = stylePrompt ? `\n\n同时严格保持用户的个人写作风格:\n${stylePrompt}` : ''

  return collectStream(
    [
      { role: 'system', content: base + custom },
      {
        role: 'user',
        content: `请在保留原有核心信息和整体结构的前提下,按以下要求修改这段文字:「${instruction}」。

只输出修改后的正文,不要加解释。

当前文本:
"""
${current}
"""`,
      },
    ],
    { signal, temperature: 0.85 },
  )
}
