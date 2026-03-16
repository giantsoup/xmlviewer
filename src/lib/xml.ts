import type { ParsedDocument, ViewerSource, XmlNodeKind, XmlTreeNode } from '../types'

export const LARGE_FILE_WARNING_BYTES = 20 * 1024 * 1024

type BuildState = {
  maxDepth: number
  nodes: Record<string, XmlTreeNode>
  sequence: number
  totalAttributes: number
  totalElements: number
  totalTextNodes: number
  uniqueTags: Set<string>
}

export class XmlParseError extends Error {
  details?: string

  constructor(message: string, details?: string) {
    super(message)
    this.name = 'XmlParseError'
    this.details = details
  }
}

export function shouldWarnAboutLargeInput(bytes: number): boolean {
  return bytes > LARGE_FILE_WARNING_BYTES
}

export function parseXmlSource(source: ViewerSource): ParsedDocument {
  if (!source.xml.trim()) {
    throw new XmlParseError('XML input is empty.')
  }

  const start = performance.now()
  const parser = new DOMParser()
  const xmlDocument = parser.parseFromString(source.xml, 'application/xml')
  const rootElement = xmlDocument.documentElement
  const parseErrorNode = Array.from(xmlDocument.getElementsByTagName('parsererror')).find(
    (node) =>
      node.namespaceURI === 'http://www.mozilla.org/newlayout/xml/parsererror.xml' ||
      node.namespaceURI === 'http://www.w3.org/1999/xhtml',
  )

  if (!rootElement) {
    throw new XmlParseError('The XML document does not contain a root element.')
  }

  if (parseErrorNode) {
    const details =
      parseErrorNode.textContent?.replace(/\s+/g, ' ').trim() ?? 'Unknown XML parsing error.'
    throw new XmlParseError('The XML document is not valid.', details)
  }

  const state: BuildState = {
    maxDepth: 0,
    nodes: {},
    sequence: 0,
    totalAttributes: 0,
    totalElements: 0,
    totalTextNodes: 0,
    uniqueTags: new Set<string>(),
  }

  const rootId = buildElementNode(rootElement, null, 0, state)
  const end = performance.now()

  return {
    nodes: state.nodes,
    rootId,
    source,
    stats: {
      fileName: source.name,
      fileSize: source.size,
      maxDepth: state.maxDepth,
      parseTimeMs: end - start,
      rootTag: rootElement.nodeName,
      totalAttributes: state.totalAttributes,
      totalElements: state.totalElements,
      totalTextNodes: state.totalTextNodes,
      uniqueTagCount: state.uniqueTags.size,
    },
  }
}

function buildElementNode(
  element: Element,
  parentId: string | null,
  depth: number,
  state: BuildState,
): string {
  const elementId = nextId(state, 'element')
  const attributeCount = element.attributes.length
  const childIds: string[] = []
  const elementChildNames: string[] = []
  let textPreview = ''

  state.totalElements += 1
  state.totalAttributes += attributeCount
  state.uniqueTags.add(element.nodeName)
  state.maxDepth = Math.max(state.maxDepth, depth)

  if (attributeCount > 0) {
    const attributesGroupId = nextId(state, 'attributes')
    const attributeChildIds: string[] = []

    state.nodes[attributesGroupId] = {
      attributeCount,
      children: attributeChildIds,
      depth: depth + 1,
      elementChildCount: attributeCount,
      id: attributesGroupId,
      kind: 'attributes',
      name: '@attributes',
      parentId: elementId,
      searchText: Array.from(element.attributes)
        .map((attribute) => `${attribute.name} ${attribute.value}`)
        .join(' '),
    }

    childIds.push(attributesGroupId)

    for (const attribute of Array.from(element.attributes)) {
      const attributeId = nextId(state, 'attribute')
      state.nodes[attributeId] = {
        attributeCount: 0,
        children: [],
        depth: depth + 2,
        elementChildCount: 0,
        id: attributeId,
        kind: 'attribute',
        name: attribute.name,
        parentId: attributesGroupId,
        searchText: `${attribute.name} ${attribute.value}`,
        value: attribute.value,
      }
      attributeChildIds.push(attributeId)
    }
  }

  for (const childNode of Array.from(element.childNodes)) {
    if (childNode.nodeType === Node.ELEMENT_NODE) {
      const childElement = childNode as Element
      elementChildNames.push(childElement.nodeName)
      childIds.push(buildElementNode(childElement, elementId, depth + 1, state))
      continue
    }

    const childText = normalizeNodeText(childNode.nodeValue)
    if (!childText) {
      continue
    }

    const normalized = buildLeafNode(childNode.nodeType, childText, elementId, depth + 1, state)
    if (normalized) {
      childIds.push(normalized.id)
      if (!textPreview && normalized.kind === 'text') {
        textPreview = truncate(normalized.value ?? '', 40)
      }
    }
  }

  const searchTextParts = [element.nodeName]

  for (const attribute of Array.from(element.attributes)) {
    searchTextParts.push(attribute.name, attribute.value)
  }

  if (textPreview) {
    searchTextParts.push(textPreview)
  }

  state.nodes[elementId] = {
    attributeCount,
    children: childIds,
    depth,
    elementChildCount: elementChildNames.length,
    id: elementId,
    kind: 'element',
    name: element.nodeName,
    parentId,
    searchText: searchTextParts.join(' '),
    textPreview,
  }

  return elementId
}

function buildLeafNode(
  nodeType: number,
  value: string,
  parentId: string,
  depth: number,
  state: BuildState,
): XmlTreeNode | null {
  let kind: XmlNodeKind
  let name: string

  switch (nodeType) {
    case Node.TEXT_NODE:
      kind = 'text'
      name = '#text'
      state.totalTextNodes += 1
      break
    case Node.CDATA_SECTION_NODE:
      kind = 'cdata'
      name = '#cdata'
      state.totalTextNodes += 1
      break
    case Node.COMMENT_NODE:
      kind = 'comment'
      name = '#comment'
      break
    default:
      return null
  }

  state.maxDepth = Math.max(state.maxDepth, depth)

  return {
    attributeCount: 0,
    children: [],
    depth,
    elementChildCount: 0,
    id: nextId(state, kind),
    kind,
    name,
    parentId,
    searchText: `${name} ${value}`,
    value,
  }
}

function normalizeNodeText(input: string | null): string {
  if (!input) {
    return ''
  }

  const value = input.replace(/\s+/g, ' ').trim()
  return value
}

function truncate(value: string, limit: number): string {
  if (value.length <= limit) {
    return value
  }

  return `${value.slice(0, limit - 1)}…`
}

function nextId(state: BuildState, prefix: string): string {
  state.sequence += 1
  return `${prefix}-${state.sequence}`
}

export function defaultExpandedIds(nodes: Record<string, XmlTreeNode>): Set<string> {
  return new Set(
    Object.values(nodes)
      .filter((node) => isExpandableNode(node, nodes) && node.depth <= 1)
      .map((node) => node.id),
  )
}

export function isExpandableNode(
  node: XmlTreeNode,
  nodes: Record<string, XmlTreeNode>,
): boolean {
  return node.children.some((childId) => {
    const child = nodes[childId]

    if (!child) {
      return false
    }

    return child.kind !== 'text'
  })
}

export function flattenVisibleTree(
  rootId: string,
  nodes: Record<string, XmlTreeNode>,
  expandedIds: Set<string>,
): XmlTreeNode[] {
  const rows: XmlTreeNode[] = []

  function visit(nodeId: string) {
    const node = nodes[nodeId]
    if (!node) {
      return
    }

    rows.push(node)

    if (!expandedIds.has(node.id)) {
      return
    }

    for (const childId of node.children) {
      visit(childId)
    }
  }

  visit(rootId)
  return rows
}

export function findMatchNodeIds(
  nodes: Record<string, XmlTreeNode>,
  query: string,
): string[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return []
  }

  return Object.values(nodes)
    .filter((node) => node.searchText.toLowerCase().includes(normalizedQuery))
    .map((node) => node.id)
}
