export type ViewerSource = {
  loadedAt: string
  name: string
  size: number
  type: 'paste' | 'file'
  xml: string
}

export type XmlNodeKind =
  | 'element'
  | 'attributes'
  | 'attribute'
  | 'text'
  | 'comment'
  | 'cdata'

export type XmlTreeNode = {
  attributeCount: number
  children: string[]
  depth: number
  elementChildCount: number
  id: string
  kind: XmlNodeKind
  name: string
  parentId: string | null
  searchText: string
  textPreview?: string
  value?: string
}

export type DocumentStats = {
  fileName: string
  fileSize: number
  maxDepth: number
  parseTimeMs: number
  rootTag: string
  totalAttributes: number
  totalElements: number
  totalTextNodes: number
  uniqueTagCount: number
}

export type ParsedDocument = {
  nodes: Record<string, XmlTreeNode>
  rootId: string
  source: ViewerSource
  stats: DocumentStats
}

export type ThemeMode = 'light' | 'dark'

export type ShortcutDefinition = {
  description: string
  key: string
}
