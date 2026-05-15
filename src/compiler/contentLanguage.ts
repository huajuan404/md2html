import type { ContentLanguage, SourceBlock } from './types'

export type ResolvedContentLanguage = Exclude<ContentLanguage, 'auto'>

export function resolveContentLanguage(blocks: SourceBlock[], contentLanguage: ContentLanguage): ResolvedContentLanguage {
  if (contentLanguage === 'zh' || contentLanguage === 'en') return contentLanguage
  const text = blocks.map((block) => block.text).join('')
  const cjk = text.match(/[\u3400-\u9fff]/g)?.length ?? 0
  return cjk > text.length * 0.1 ? 'zh' : 'en'
}
