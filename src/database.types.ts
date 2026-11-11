/**
 * 云数据库的 schema 类型。
 * 与云端实际建表结构一一对应(style_templates / rewrite_records)。
 * 传给 createWorkBuddyCloud<Database> 后,查询构造器即可获得正确的行类型推导。
 */

export interface StyleTemplateRow {
  id: number
  owner_id: string
  owner_name: string | null
  name: string
  scene: string
  summary: string | null
  traits: Record<string, string> | null
  style_prompt: string | null
  sample_count: number | null
  source_excerpt: string | null
  created_at: string
  updated_at: string
}

export interface RewriteRecordRow {
  id: number
  owner_id: string
  owner_name: string | null
  source_text: string
  result_text: string
  scene: string
  template_id: number | null
  template_name: string | null
  variant_label: string | null
  variant_desc: string | null
  tone: Record<string, unknown> | null
  is_favorite: boolean
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      style_templates: {
        Row: StyleTemplateRow
        Insert: {
          owner_name?: string | null
          name: string
          scene?: string | null
          summary?: string | null
          traits?: Record<string, string> | null
          style_prompt?: string | null
          sample_count?: number | null
          source_excerpt?: string | null
        }
        Update: Partial<StyleTemplateRow>
      }
      rewrite_records: {
        Row: RewriteRecordRow
        Insert: {
          owner_name?: string | null
          source_text: string
          result_text: string
          scene?: string | null
          template_id?: number | null
          template_name?: string | null
          variant_label?: string | null
          variant_desc?: string | null
          tone?: Record<string, unknown> | null
          is_favorite?: boolean | null
        }
        Update: Partial<RewriteRecordRow>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
