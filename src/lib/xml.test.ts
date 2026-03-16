import { defaultExpandedIds, findMatchNodeIds, flattenVisibleTree, parseXmlSource } from './xml'
import type { ViewerSource } from '../types'

function makeSource(xml: string): ViewerSource {
  return {
    type: 'paste',
    name: 'inline.xml',
    size: xml.length,
    xml,
    loadedAt: '2026-03-16T00:00:00.000Z',
  }
}

describe('parseXmlSource', () => {
  it('builds a normalized hybrid tree and document stats', () => {
    const xml = `<?xml version="1.0"?>
<catalog region="north">
  <book id="bk101">
    <title>XML Developer's Guide</title>
    <!--featured-->
    <![CDATA[reference]]>
  </book>
</catalog>`

    const parsed = parseXmlSource(makeSource(xml))
    const rootNode = parsed.nodes[parsed.rootId]
    const rows = flattenVisibleTree(parsed.rootId, parsed.nodes, defaultExpandedIds(parsed.nodes))

    expect(parsed.stats.rootTag).toBe('catalog')
    expect(parsed.stats.totalElements).toBe(3)
    expect(parsed.stats.totalAttributes).toBe(2)
    expect(parsed.stats.totalTextNodes).toBe(2)
    expect(parsed.stats.uniqueTagCount).toBe(3)
    expect(rootNode.name).toBe('catalog')
    expect(rootNode.children.length).toBeGreaterThan(1)
    expect(rows.map((row) => row.kind)).toContain('attributes')
  })

  it('finds matches in tag names, attributes, and text', () => {
    const xml = `<catalog><book sku="123"><title>Sample Guide</title></book></catalog>`
    const parsed = parseXmlSource(makeSource(xml))

    expect(findMatchNodeIds(parsed.nodes, 'book')).not.toHaveLength(0)
    expect(findMatchNodeIds(parsed.nodes, 'sku')).not.toHaveLength(0)
    expect(findMatchNodeIds(parsed.nodes, 'guide')).not.toHaveLength(0)
  })

  it('throws a clear error for malformed xml', () => {
    expect(() => parseXmlSource(makeSource('<catalog><book></catalog>'))).toThrow(
      'The XML document is not valid.',
    )
  })

  it('defaults to expanding the root and first nested level only', () => {
    const xml = `<catalog><book><chapters><chapter><name>Intro</name></chapter></chapters></book></catalog>`
    const parsed = parseXmlSource(makeSource(xml))
    const expanded = defaultExpandedIds(parsed.nodes)
    const rows = flattenVisibleTree(parsed.rootId, parsed.nodes, expanded)

    expect(rows.map((row) => row.name)).toContain('book')
    expect(rows.map((row) => row.name)).toContain('chapters')
    expect(rows.map((row) => row.name)).not.toContain('chapter')
  })

  it('creates grouped attribute nodes for elements with attributes', () => {
    const xml = `<catalog region="west"><book id="bk101"><title>Guide</title></book></catalog>`
    const parsed = parseXmlSource(makeSource(xml))

    expect(Object.values(parsed.nodes).some((node) => node.kind === 'attributes')).toBe(true)
    expect(Object.values(parsed.nodes).some((node) => node.kind === 'attribute')).toBe(true)
  })

  it('does not misclassify a valid parsererror tag', () => {
    const parsed = parseXmlSource(makeSource('<parsererror><message>valid data</message></parsererror>'))

    expect(parsed.stats.rootTag).toBe('parsererror')
    expect(parsed.stats.totalElements).toBe(2)
  })
})
