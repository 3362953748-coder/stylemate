/**
 * 联调脚本:验证「风格强度调节」与「风格一致性自评」。
 * 用法:node scripts/verify-intensity.mjs
 */
import { createWorkBuddyCloud } from '@tencent-ai/workbuddy-cloud-sdk'

const cloud = createWorkBuddyCloud({
  endpoint:
    process.env.VITE_CLOUD_ENDPOINT ??
    'https://stylemate-34839.app.workbuddy.host',
  oauthRelayBaseUrl:
    process.env.VITE_CLOUD_OAUTH_RELAY ??
    'https://www.workbuddy.cn/v2/as/genie-baas/oauth',
  publishableKey:
    process.env.VITE_CLOUD_PUBLISHABLE_KEY ??
    'wbpk_JQ4RM2uVZZoJ8mV6wSjRb4_N5zj4LVU4sJlHzw6lApvYPS7tfPmDLl6',
})

const STYLE_PROMPT = `用第一人称"我"写日常随笔。通篇短句,单句控制在15-25字内,多用动词串联动作,像说话一样自然。
词汇只用日常口语,可用"最爽""拧巴""解压"这类词,允许偶尔中英混用。禁止比喻、夸张等修辞,全部白描。
情绪保持平和松弛,写小确幸但不煽情。评价物件时用身体感受代替形容词,如"肩膀是松的"。
多给具体量化细节。结构上首句点题,然后按时间或事项逐条展开,一段只写一事,段落短小。
结尾不总结不升华,用一个轻口语短语或具体小细节轻轻收住。整体像随手写的日记,不刻意修饰。`

const TRAITS = {
  language: '口语化日常语,朴素直白,白描写实',
  sentence: '短句为主,单句多在15-25字内,长短交替',
  diction: '日常词汇如"最爽""拧巴""解压",量化细节',
  emotion: '平和满足,带自嘲式幽默',
  structure: '首句点题后逐项展开,每段一事',
}

const SOURCE =
  '公司新推出了一款智能升降桌,支持记忆高度,桌面材质是环保板材,质保五年,售价 1999 元。'

const INTENSITY_DIRECTIVE = (n) => {
  if (n <= 20) return '风格强度:极低。只做轻度润色,保持中性通用的表达,不要刻意模仿任何个人风格特征。'
  if (n <= 45) return '风格强度:较低。仅借鉴原文的大致语气倾向,不要复现具体句式、词汇习惯或结构套路。'
  if (n <= 70) return '风格强度:中等。可以体现部分个人风格特征(用词偏好、句长节奏),但保留原文的信息骨架,避免与原文高度雷同。'
  if (n <= 88) return '风格强度:较高。充分体现个人风格的用词偏好、句式节奏与叙述方式,同时确保内容主题与原文不同,不得出现与原文雷同的句子。'
  return '风格强度:极高。完全以该风格组织语言表达,句式节奏、词汇选择、段落结构都对齐目标风格;但内容必须是新的,不可复用原文的具体表述。'
}

async function collect(messages, opts = {}) {
  const models = await cloud.llm.models.list()
  const model =
    models.find((m) => m.id === 'auto' && m.disabled !== true)?.id ??
    models.find((m) => m.disabled !== true)?.id
  let out = ''
  for await (const chunk of cloud.llm.chat.completions.create({
    model,
    messages,
    stream: true,
    temperature: opts.temperature ?? 0.9,
    ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
  })) {
    const delta = chunk.choices[0]?.delta?.content
    if (delta) out += delta
  }
  return out
}

async function rewrite(intensity) {
  return collect([
    {
      role: 'system',
      content: `你是一名专业的写作助手,改写文案使其更清晰、更有表达力。\n\n同时必须严格模仿以下用户的个人写作风格,这是最重要的要求:\n${STYLE_PROMPT}`,
    },
    {
      role: 'user',
      content: `语气要求:偏日常自然,既不随便也不刻板;情绪适度,有温度但不夸张;篇幅适中,信息完整但不冗余。
${INTENSITY_DIRECTIVE(intensity)}

请改写下面这段文字。只输出改写后的正文,不要加任何解释、前言或标题。

原文:
"""
${SOURCE}
"""`,
    },
  ])
}

async function score(text) {
  const traitLines = Object.entries(TRAITS).map(([k, v]) => `- ${k}: ${v}`).join('\n')
  const raw = await collect(
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

风格指令:
${STYLE_PROMPT}

待评估文本:
"""
${text}
"""

原始素材(仅供理解内容背景,不要求内容与之相同):
"""
${SOURCE}
"""

请评估该文本在**文风层面**与上述风格的匹配程度,严格按以下 JSON 输出:
{
  "score": 0到100的整数,总体文风匹配度,
  "suggestions": ["若要更贴合该文风,应该怎么改", "最多3条,每条不超过40字"]
}`,
      },
    ],
    { json: true, temperature: 0.3 },
  )
  return JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, ''))
}

console.log('=== 风格强度 20%(低)===')
const low = await rewrite(20)
console.log(low)
const lowScore = await score(low)
console.log(`→ 一致性评分: ${lowScore.score}`)
console.log(`→ 建议: ${(lowScore.suggestions || []).join(' / ')}`)

console.log('\n' + '='.repeat(60))
console.log('=== 风格强度 95%(高)===')
const high = await rewrite(95)
console.log(high)
const highScore = await score(high)
console.log(`→ 一致性评分: ${highScore.score}`)
console.log(`→ 建议: ${(highScore.suggestions || []).join(' / ')}`)

console.log('\n' + '='.repeat(60))
console.log(`对比结果: 低强度 ${lowScore.score} 分 vs 高强度 ${highScore.score} 分`)
console.log(
  highScore.score > lowScore.score
    ? '✅ 强度调节有效:高强度产出的风格一致性更高'
    : '⚠️ 强度调节未体现明显差异(模型随机性影响,需多次采样确认)',
)
