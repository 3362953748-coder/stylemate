export type SceneKey = 'xiaohongshu' | 'email' | 'wechat' | 'english'

export interface SceneConfig {
  key: SceneKey
  label: string
  shortLabel: string
  icon: string
  description: string
  /** 写给模型的风格指令 */
  systemPrompt: string
  /** 该场景的默认语气参数 */
  defaults: ToneConfig
}

export interface ToneConfig {
  /** 正式程度 1-5:1 最口语,5 最正式 */
  formality: number
  /** 情绪浓度 1-5 */
  emotion: number
  /** 表达长度:简短 / 适中 / 详尽 */
  length: 'short' | 'medium' | 'long'
}

export interface StyleTraits {
  language: string
  sentence: string
  diction: string
  emotion: string
  structure: string
}

export interface StyleTemplate {
  id?: number
  name: string
  scene: SceneKey | 'custom'
  summary: string
  traits: StyleTraits
  stylePrompt: string
  sampleCount: number
  sourceExcerpt: string
  createdAt?: string
}

export interface RewriteRecord {
  id?: number
  sourceText: string
  resultText: string
  scene: SceneKey | 'custom'
  templateId?: number | null
  templateName?: string | null
  variantLabel?: string | null
  variantDesc?: string | null
  tone: ToneConfig
  isFavorite: boolean
  createdAt?: string
}

export const SCENES: SceneConfig[] = [
  {
    key: 'xiaohongshu',
    label: '小红书风格',
    shortLabel: '小红书',
    icon: '📕',
    description: '自然、活泼、有吸引力,像朋友分享',
    systemPrompt:
      '你是一名资深小红书博主写手。改写文案时要口语自然、亲切有画面感,善用短句和段落分隔,像真实用户分享经验,不要过度营销,不要堆砌"绝绝子""yyds"这类空洞热词。可适量使用 emoji,但不要每句都加。开头要有吸引力,结尾引导互动。',
    defaults: { formality: 2, emotion: 4, length: 'medium' },
  },
  {
    key: 'email',
    label: '正式邮件',
    shortLabel: '正式邮件',
    icon: '📧',
    description: '专业、礼貌、简洁,得体不失分寸',
    systemPrompt:
      '你是一名职场商务沟通顾问。改写文案为正式邮件:称呼得体,语气礼貌专业,结构清晰(开场说明事由、正文分点陈述、结尾致谢),语言简洁干练,不寒暄过度,不生硬。信息层次要一目了然。',
    defaults: { formality: 5, emotion: 2, length: 'medium' },
  },
  {
    key: 'wechat',
    label: '公众号风格',
    shortLabel: '公众号',
    icon: '📄',
    description: '有逻辑、有层次、有感染力',
    systemPrompt:
      '你是一名公众号主笔。改写文案要有清晰的逻辑层次和段落结构,善用小标题和过渡句,观点明确,兼具理性与感染力,语言有质感但不晦涩。开头能抓住读者,结尾留下思考或共鸣。',
    defaults: { formality: 3, emotion: 3, length: 'long' },
  },
  {
    key: 'english',
    label: '英文表达',
    shortLabel: '英文',
    icon: '🌐',
    description: '地道、自然,符合英语语境',
    systemPrompt:
      'You are a professional English copywriter. Rewrite the text into idiomatic, natural English that reads as if written by a native speaker. Respect the cultural context, avoid translating Chinese word-for-word, keep the meaning and intent intact, and use varied, confident sentence structures. Output English only.',
    defaults: { formality: 3, emotion: 3, length: 'medium' },
  },
]

export const SCENE_MAP: Record<string, SceneConfig> = Object.fromEntries(
  SCENES.map((s) => [s.key, s]),
)

export const LENGTH_LABEL: Record<ToneConfig['length'], string> = {
  short: '简短',
  medium: '适中',
  long: '详尽',
}

/** 把语气数值翻译成模型能理解的自然语言指令 */
export function toneDirective(tone: ToneConfig): string {
  const formality =
    tone.formality <= 2
      ? '非常口语化、像日常聊天'
      : tone.formality === 3
        ? '偏日常自然,既不随便也不刻板'
        : tone.formality === 4
          ? '较正式,适合专业场合'
          : '高度正式庄重,书面语规范'
  const emotion =
    tone.emotion <= 2
      ? '情绪克制,平实陈述'
      : tone.emotion === 3
        ? '情绪适度,有温度但不夸张'
        : tone.emotion === 4
          ? '情绪饱满,富有感染力'
          : '情绪强烈,热情洋溢'
  const length =
    tone.length === 'short'
      ? '篇幅精简,只保留核心信息,能删则删'
      : tone.length === 'long'
        ? '篇幅充分展开,适当补充细节与铺陈'
        : '篇幅适中,信息完整但不冗余'
  return `语气要求:${formality};${emotion};${length}。`
}

export const VARIANTS = [
  { key: 'A', label: 'A 版', desc: '简洁专业', hint: '结构清晰、信息克制、偏书面表达' },
  { key: 'B', label: 'B 版', desc: '自然亲切', hint: '口语自然、有温度、贴近日常交流' },
  { key: 'C', label: 'C 版', desc: '情绪感染力强', hint: '节奏感强、情绪饱满、容易引发共鸣' },
] as const

export type VariantKey = (typeof VARIANTS)[number]['key']
