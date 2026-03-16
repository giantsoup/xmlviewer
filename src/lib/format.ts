import type { XmlTreeNode } from '../types'

const numberFormatter = new Intl.NumberFormat()

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  const units = ['KB', 'MB', 'GB']
  let size = bytes / 1024
  let index = 0

  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index += 1
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[index]}`
}

export function formatCount(value: number): string {
  return numberFormatter.format(value)
}

export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1) {
    return '<1 ms'
  }

  if (milliseconds >= 1000) {
    return `${(milliseconds / 1000).toFixed(2)} s`
  }

  return `${milliseconds.toFixed(1)} ms`
}

export function formatNodeSummary(node: XmlTreeNode): string {
  const parts: string[] = []

  if (node.attributeCount > 0) {
    parts.push(`${node.attributeCount} attr`)
  }

  if (node.elementChildCount > 0) {
    parts.push(`${node.elementChildCount} child`)
  }

  return parts.join(' · ')
}
