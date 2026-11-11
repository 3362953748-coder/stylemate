import { cloud } from './cloud'
import type { RewriteRecordRow, StyleTemplateRow } from './database.types'
import type { RewriteRecord, StyleTemplate } from './types'

/**
 * 用户数据访问层。
 * 所有读写都要求已登录 —— 未登录时由调用方展示登录引导,
 * 这里不做任何"假装成功"的降级。
 */

/* ---------------- 风格模板 ---------------- */

export async function listTemplates(): Promise<StyleTemplate[]> {
  const { data, error } = await cloud.database
    .from('style_templates')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapTemplateRow)
}

export async function saveTemplate(
  template: StyleTemplate,
  ownerName: string | null,
): Promise<StyleTemplate> {
  const { data, error } = await cloud.database
    .from('style_templates')
    .insert({
      name: template.name,
      scene: template.scene,
      summary: template.summary,
      traits: template.traits,
      style_prompt: template.stylePrompt,
      sample_count: template.sampleCount,
      source_excerpt: template.sourceExcerpt,
      ...(ownerName ? { owner_name: ownerName } : {}),
    })
    .select()
  if (error) throw error
  const row = (data ?? [])[0]
  if (!row) throw new Error('风格模板保存失败')
  return mapTemplateRow(row)
}

export async function updateTemplate(
  id: number,
  patch: Partial<StyleTemplate>,
): Promise<void> {
  const { data, error } = await cloud.database
    .from('style_templates')
    .update({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
      ...(patch.traits !== undefined ? { traits: patch.traits } : {}),
      ...(patch.stylePrompt !== undefined
        ? { style_prompt: patch.stylePrompt }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('没有可修改的模板 —— 该模板可能不存在或不属于当前账号')
  }
}

export async function deleteTemplate(id: number): Promise<void> {
  const { data, error } = await cloud.database
    .from('style_templates')
    .delete()
    .eq('id', id)
    .select()
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('没有可删除的模板 —— 该模板可能不存在或不属于当前账号')
  }
}

/* ---------------- 改写记录 ---------------- */

export async function listRecords(): Promise<RewriteRecord[]> {
  const { data, error } = await cloud.database
    .from('rewrite_records')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []).map(mapRecordRow)
}

export async function saveRecord(
  record: RewriteRecord,
  ownerName: string | null,
): Promise<RewriteRecord> {
  const { data, error } = await cloud.database
    .from('rewrite_records')
    .insert({
      source_text: record.sourceText,
      result_text: record.resultText,
      scene: record.scene,
      template_id: record.templateId ?? null,
      template_name: record.templateName ?? null,
      variant_label: record.variantLabel ?? null,
      variant_desc: record.variantDesc ?? null,
      tone: record.tone,
      intensity: record.intensity,
      consistency: record.consistency ?? null,
      is_favorite: record.isFavorite,
      ...(ownerName ? { owner_name: ownerName } : {}),
    })
    .select()
  if (error) throw error
  const row = (data ?? [])[0]
  if (!row) throw new Error('改写记录保存失败')
  return mapRecordRow(row)
}

export async function toggleFavorite(id: number, next: boolean): Promise<void> {
  const { data, error } = await cloud.database
    .from('rewrite_records')
    .update({ is_favorite: next })
    .eq('id', id)
    .select()
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('收藏状态更新失败 —— 记录可能不存在或不属于当前账号')
  }
}

export async function deleteRecord(id: number): Promise<void> {
  const { data, error } = await cloud.database
    .from('rewrite_records')
    .delete()
    .eq('id', id)
    .select()
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('没有可删除的记录 —— 该记录可能不存在或不属于当前账号')
  }
}

/* ---------------- 行映射 ---------------- */

function mapTemplateRow(row: StyleTemplateRow): StyleTemplate {
  const traits = (row.traits ?? {}) as Record<string, string>
  return {
    id: row.id,
    name: row.name,
    scene: (row.scene as StyleTemplate['scene']) ?? 'custom',
    summary: row.summary ?? '',
    traits: {
      language: traits.language ?? '',
      sentence: traits.sentence ?? '',
      diction: traits.diction ?? '',
      emotion: traits.emotion ?? '',
      structure: traits.structure ?? '',
    },
    stylePrompt: row.style_prompt ?? '',
    sampleCount: row.sample_count ?? 0,
    sourceExcerpt: row.source_excerpt ?? '',
    createdAt: row.created_at,
  }
}

function mapRecordRow(row: RewriteRecordRow): RewriteRecord {
  const tone = (row.tone ?? {}) as Partial<RewriteRecord['tone']>
  return {
    id: row.id,
    sourceText: row.source_text,
    resultText: row.result_text,
    scene: (row.scene as RewriteRecord['scene']) ?? 'custom',
    templateId: row.template_id,
    templateName: row.template_name,
    variantLabel: row.variant_label,
    variantDesc: row.variant_desc,
    tone: {
      formality: tone.formality ?? 3,
      emotion: tone.emotion ?? 3,
      length: tone.length ?? 'medium',
    },
    intensity: row.intensity ?? 70,
    consistency: row.consistency,
    isFavorite: row.is_favorite,
    createdAt: row.created_at,
  }
}
