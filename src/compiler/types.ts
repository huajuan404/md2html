export type SourceBlockType =
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'table'
  | 'code'
  | 'quote'
  | 'thematicBreak'
  | 'html'

export type SourceBlock = {
  id: string
  type: SourceBlockType
  startLine: number
  endLine: number
  startOffset: number
  endOffset: number
  raw: string
  text: string
  depth?: number
  ordered?: boolean
  parentHeadingId?: string
}

export type LogicId = 'none' | 'result-first' | 'narrative'
export type DensityId = 'comfortable' | 'compact' | 'per-screen'
export type ThemeId = 'editorial-light' | 'dense-brief' | 'dark-studio'
export type ContentLanguage = 'auto' | 'zh' | 'en'

export type RenderNodeKind =
  | 'hero'
  | 'toc'
  | 'section'
  | 'card'
  | 'quote'
  | 'table'
  | 'code'
  | 'timeline'
  | 'summary'
  | 'appendix'

export type RenderNode = {
  id: string
  kind: RenderNodeKind
  sourceBlockIds: string[]
  title?: string
}

export type RenderPlan = {
  logic: LogicId
  density: DensityId
  nodes: RenderNode[]
}

export type CompileOptions = {
  logic: LogicId
  density: DensityId
  theme: ThemeId
  contentLanguage: ContentLanguage
  includeSourceMetadata?: boolean
}

export type CompileResult = {
  html: string
  sourceBlocks: SourceBlock[]
  renderPlan: RenderPlan
  fellBackToFaithful: boolean
  resolvedContentLanguage: Exclude<ContentLanguage, 'auto'>
}
