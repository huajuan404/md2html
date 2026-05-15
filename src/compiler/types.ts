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
