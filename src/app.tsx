import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Binary,
  ChevronRight,
  FileCode2,
  FileUp,
  FolderOpen,
  Keyboard,
  MoonStar,
  Search,
  Sparkles,
  SunMedium,
} from 'lucide-preact'
import { useEffect, useId, useRef, useState } from 'preact/hooks'
import './app.css'
import { formatBytes, formatCount, formatDuration, formatNodeSummary } from './lib/format'
import {
  LARGE_FILE_WARNING_BYTES,
  XmlParseError,
  defaultExpandedIds,
  findMatchNodeIds,
  flattenVisibleTree,
  isExpandableNode,
  parseXmlSource,
  shouldWarnAboutLargeInput,
} from './lib/xml'
import type {
  DocumentStats,
  ParsedDocument,
  ShortcutDefinition,
  ThemeMode,
  ViewerSource,
  XmlTreeNode,
} from './types'
import { useLocalStorageState } from './hooks/use-local-storage-state'

const shortcuts: ShortcutDefinition[] = [
  { key: 'Cmd/Ctrl + O', description: 'Open a local XML file' },
  { key: 'Cmd/Ctrl + Enter', description: 'Parse the current pasted XML' },
  { key: 'Cmd/Ctrl + F or /', description: 'Focus search' },
  { key: 'Enter / Shift + Enter', description: 'Move to next or previous search result' },
  { key: 'Shift + E', description: 'Expand every branch' },
  { key: 'Shift + C', description: 'Collapse back to the root' },
  { key: 'I', description: 'Show or hide the stats box' },
  { key: '?', description: 'Open the shortcut guide' },
  { key: 'Esc', description: 'Close overlays or clear focus states' },
]

const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform)

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(target.closest('input, textarea, [contenteditable="true"]'))
}

function isSearchInputTarget(
  target: EventTarget | null,
  searchInput: HTMLInputElement | null,
): boolean {
  if (!searchInput) {
    return false
  }

  if (document.activeElement === searchInput) {
    return true
  }

  return target instanceof Node && searchInput.contains(target)
}

function getFileName(file: File | null): string {
  if (!file) {
    return ''
  }

  return file.name || 'XML file'
}

export function App() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchInputFocusedRef = useRef(false)
  const pasteInputRef = useRef<HTMLTextAreaElement>(null)
  const treeRef = useRef<HTMLDivElement>(null)
  const helpButtonRef = useRef<HTMLButtonElement>(null)
  const helpPanelRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef(new Map<string, HTMLButtonElement>())
  const dragDepthRef = useRef(0)

  const [theme, setTheme] = useLocalStorageState<ThemeMode>('xmlviewer.theme', getInitialTheme)
  const [statsVisible, setStatsVisible] = useLocalStorageState('xmlviewer.statsVisible', true)
  const [showImporter, setShowImporter] = useState(true)
  const [xmlDraft, setXmlDraft] = useState('')
  const [documentModel, setDocumentModel] = useState<ParsedDocument | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [activeMatchIndex, setActiveMatchIndex] = useState(0)
  const [shortcutGuideOpen, setShortcutGuideOpen] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const visibleRows = documentModel
    ? flattenVisibleTree(documentModel.rootId, documentModel.nodes, expandedIds)
    : []
  const matchNodeIds = documentModel ? findMatchNodeIds(documentModel.nodes, searchQuery) : []
  const activeMatchNodeId = matchNodeIds.length > 0 ? matchNodeIds[activeMatchIndex] : null
  const selectedVisibleIndex = selectedNodeId
    ? visibleRows.findIndex((row) => row.id === selectedNodeId)
    : -1

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    if (matchNodeIds.length === 0) {
      setActiveMatchIndex(0)
      return
    }

    if (activeMatchIndex > matchNodeIds.length - 1) {
      setActiveMatchIndex(matchNodeIds.length - 1)
    }
  }, [activeMatchIndex, matchNodeIds.length])

  useEffect(() => {
    if (!documentModel || !activeMatchNodeId) {
      return
    }

    const nextExpanded = new Set(expandedIds)
    let cursor: string | null = activeMatchNodeId

    while (cursor) {
      const node: XmlTreeNode | undefined = documentModel.nodes[cursor]
      if (!node) {
        break
      }
      if (isExpandableNode(node, documentModel.nodes)) {
        nextExpanded.add(node.id)
      }
      cursor = node.parentId
    }

    if (nextExpanded.size !== expandedIds.size) {
      setExpandedIds(nextExpanded)
    }
    setSelectedNodeId(activeMatchNodeId)
  }, [activeMatchNodeId, documentModel, expandedIds])

  useEffect(() => {
    if (!selectedNodeId) {
      return
    }

    const button = rowRefs.current.get(selectedNodeId)
    if (!button) {
      return
    }

    button.scrollIntoView({ block: 'nearest' })

    if (searchInputFocusedRef.current) {
      return
    }

    const activeElement = document.activeElement
    const shouldMoveFocus =
      !(activeElement instanceof HTMLElement) ||
      activeElement === document.body ||
      Boolean(treeRef.current?.contains(activeElement))

    if (shouldMoveFocus) {
      button.focus({ preventScroll: true })
    }
  }, [selectedNodeId, visibleRows.length])

  useEffect(() => {
    if (!shortcutGuideOpen || !helpButtonRef.current || !helpPanelRef.current) {
      return
    }

    return autoUpdate(helpButtonRef.current, helpPanelRef.current, () => {
      if (!helpButtonRef.current || !helpPanelRef.current) {
        return
      }

      computePosition(helpButtonRef.current, helpPanelRef.current, {
        placement: 'bottom-end',
        middleware: [offset(12), flip({ padding: 16 }), shift({ padding: 16 })],
      }).then(({ x, y }) => {
        if (!helpPanelRef.current) {
          return
        }

        Object.assign(helpPanelRef.current.style, {
          left: `${x}px`,
          top: `${y}px`,
        })
      })
    })
  }, [shortcutGuideOpen])

  useEffect(() => {
    if (!shortcutGuideOpen) {
      return
    }

    helpPanelRef.current?.focus()
  }, [shortcutGuideOpen])

  useEffect(() => {
    const handleGlobalKeydown = (event: KeyboardEvent) => {
      const modifier = isMac ? event.metaKey : event.ctrlKey
      const key = event.key
      const typing = isEditableTarget(event.target)
      const typingInSearch =
        searchInputFocusedRef.current || isSearchInputTarget(event.target, searchInputRef.current)

      if (typingInSearch) {
        return
      }

      if (modifier && key.toLowerCase() === 'o') {
        event.preventDefault()
        fileInputRef.current?.click()
        return
      }

      if (modifier && key === 'Enter') {
        if (!xmlDraft.trim()) {
          return
        }

        event.preventDefault()
        submitXml({
          type: 'paste',
          name: 'Pasted XML',
          size: new Blob([xmlDraft]).size,
          xml: xmlDraft,
          loadedAt: new Date().toISOString(),
        })
        return
      }

      if (typing) {
        return
      }

      if ((modifier && key.toLowerCase() === 'f') || key === '/') {
        if (!documentModel) {
          return
        }

        event.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
        return
      }

      if (key === 'I' || key === 'i') {
        event.preventDefault()
        setStatsVisible((current) => !current)
        return
      }

      if (key === '?' || (event.shiftKey && key === '/')) {
        event.preventDefault()
        setShortcutGuideOpen((current) => !current)
        return
      }

      if (event.shiftKey && (key === 'E' || key === 'e')) {
        if (!documentModel) {
          return
        }

        event.preventDefault()
        expandAll()
        return
      }

      if (event.shiftKey && (key === 'C' || key === 'c')) {
        if (!documentModel) {
          return
        }

        event.preventDefault()
        collapseAll()
        return
      }

      if (key === 'Escape') {
        if (shortcutGuideOpen) {
          event.preventDefault()
          setShortcutGuideOpen(false)
          return
        }

        if (searchQuery) {
          event.preventDefault()
          setSearchQuery('')
          setActiveMatchIndex(0)
          return
        }
      }
    }

    window.addEventListener('keydown', handleGlobalKeydown)
    return () => window.removeEventListener('keydown', handleGlobalKeydown)
  }, [documentModel, searchQuery, shortcutGuideOpen, theme, xmlDraft])

  function submitXml(source: ViewerSource) {
    try {
      const parsed = parseXmlSource(source)
      setDocumentModel(parsed)
      setParseError(null)
      setSelectedNodeId(parsed.rootId)
      setExpandedIds(defaultExpandedIds(parsed.nodes))
      setShowImporter(false)
      setSearchQuery('')
      setActiveMatchIndex(0)
    } catch (error) {
      const message =
        error instanceof XmlParseError
          ? error.details || error.message
          : 'The XML could not be parsed.'

      setDocumentModel(null)
      setExpandedIds(new Set())
      setSelectedNodeId(null)
      setParseError(message)
      setShowImporter(true)
    }
  }

  async function loadFile(file: File | null) {
    if (!file) {
      return
    }

    if (shouldWarnAboutLargeInput(file.size)) {
      const allowed = window.confirm(
        `This file is ${formatBytes(file.size)}, which is above the recommended ${formatBytes(
          LARGE_FILE_WARNING_BYTES,
        )} range for the first version. Continue loading it?`,
      )

      if (!allowed) {
        return
      }
    }

    const xml = await file.text()
    setXmlDraft(xml)
    submitXml({
      type: 'file',
      name: getFileName(file),
      size: file.size,
      xml,
      loadedAt: new Date().toISOString(),
    })
  }

  function handleSearchInput(value: string) {
    setSearchQuery(value)
    setActiveMatchIndex(0)
  }

  function toggleNode(nodeId: string) {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }

  function expandAll() {
    if (!documentModel) {
      return
    }

    setExpandedIds(
      new Set(
        Object.values(documentModel.nodes)
          .filter((node) => isExpandableNode(node, documentModel.nodes))
          .map((node) => node.id),
      ),
    )
  }

  function collapseAll() {
    if (!documentModel) {
      return
    }

    setExpandedIds(new Set([documentModel.rootId]))
    setSelectedNodeId(documentModel.rootId)
  }

  function stepSearch(direction: 1 | -1) {
    if (matchNodeIds.length === 0) {
      return
    }

    setActiveMatchIndex((current) => {
      const next = (current + direction + matchNodeIds.length) % matchNodeIds.length
      return next
    })
  }

  function handleTreeKeyDown(event: KeyboardEvent) {
    if (!documentModel || visibleRows.length === 0) {
      return
    }

    if (isEditableTarget(event.target)) {
      return
    }

    const activeIndex = selectedVisibleIndex >= 0 ? selectedVisibleIndex : 0
    const activeNode = visibleRows[activeIndex]
    const activeExpandable = activeNode
      ? isExpandableNode(activeNode, documentModel.nodes)
      : false

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault()
        const nextRow = visibleRows[Math.min(activeIndex + 1, visibleRows.length - 1)]
        setSelectedNodeId(nextRow.id)
        return
      }
      case 'ArrowUp': {
        event.preventDefault()
        const previousRow = visibleRows[Math.max(activeIndex - 1, 0)]
        setSelectedNodeId(previousRow.id)
        return
      }
      case 'Home': {
        event.preventDefault()
        setSelectedNodeId(visibleRows[0].id)
        return
      }
      case 'End': {
        event.preventDefault()
        setSelectedNodeId(visibleRows[visibleRows.length - 1].id)
        return
      }
      case 'ArrowRight': {
        if (!activeNode || !activeExpandable) {
          return
        }

        event.preventDefault()
        if (!expandedIds.has(activeNode.id)) {
          toggleNode(activeNode.id)
        } else {
          setSelectedNodeId(activeNode.children[0])
        }
        return
      }
      case 'ArrowLeft': {
        if (!activeNode) {
          return
        }

        event.preventDefault()
        if (expandedIds.has(activeNode.id) && activeExpandable) {
          toggleNode(activeNode.id)
        } else if (activeNode.parentId) {
          setSelectedNodeId(activeNode.parentId)
        }
        return
      }
      case 'Enter':
      case ' ': {
        if (!activeNode || !activeExpandable) {
          return
        }

        event.preventDefault()
        toggleNode(activeNode.id)
        return
      }
      default:
        return
    }
  }

  function registerRowRef(nodeId: string, element: HTMLButtonElement | null) {
    if (element) {
      rowRefs.current.set(nodeId, element)
      return
    }

    rowRefs.current.delete(nodeId)
  }

  function handleFileSelection(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    void loadFile(input.files?.[0] ?? null)
    input.value = ''
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault()
    setDragActive(false)
    dragDepthRef.current = 0
    const file = event.dataTransfer?.files?.[0] ?? null
    void loadFile(file)
  }

  function handleDragEnter(event: DragEvent) {
    if (!event.dataTransfer?.types.includes('Files')) {
      return
    }

    event.preventDefault()
    dragDepthRef.current += 1
    setDragActive(true)
  }

  function handleDragLeave(event: DragEvent) {
    if (!event.dataTransfer?.types.includes('Files')) {
      return
    }

    event.preventDefault()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) {
      setDragActive(false)
    }
  }

  function handleDragOver(event: DragEvent) {
    if (event.dataTransfer?.types.includes('Files')) {
      event.preventDefault()
    }
  }

  const importHint =
    xmlDraft.trim().length > 0
      ? `${formatBytes(new Blob([xmlDraft]).size)} ready to parse`
      : 'Paste XML, drop a file, or open one from disk'

  return (
    <div
      class="app-shell"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        class="sr-only"
        type="file"
        accept=".xml,text/xml,application/xml"
        onChange={handleFileSelection}
      />

      <div class="app-chrome">
        <header class="topbar">
          <div class="topbar__group">
            <div class="brand-mark">
              <Binary size={20} strokeWidth={2.2} />
            </div>
            <div>
              <p class="eyebrow">Local-only XML workspace</p>
              <h1>Arbor XML Viewer</h1>
            </div>
          </div>

          <div class="topbar__group topbar__group--actions">
            {documentModel ? (
              <div class="document-pill">
                <FileCode2 size={16} />
                <span>{documentModel.stats.fileName}</span>
              </div>
            ) : null}

            <button
              type="button"
              class="toolbar-button"
              onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            >
              {theme === 'light' ? <MoonStar size={16} /> : <SunMedium size={16} />}
            </button>

            <button
              ref={helpButtonRef}
              type="button"
              class="toolbar-button"
              onClick={() => setShortcutGuideOpen((current) => !current)}
              aria-expanded={shortcutGuideOpen}
              aria-label="Open keyboard shortcuts"
            >
              <Keyboard size={16} />
            </button>
          </div>
        </header>

        <main class="workspace">
          <section class={`hero-panel ${showImporter || !documentModel ? '' : 'hero-panel--collapsed'}`}>
            <div class="hero-panel__content">
              <div class="hero-panel__copy">
                <span class="status-chip">
                  <Sparkles size={14} />
                  Tree-first XML inspection
                </span>
                <h2>Open an XML document and inspect the structure without leaving the browser.</h2>
                <p>
                  Paste raw XML, drag a file directly into the workspace, or choose a file from disk.
                  Once loaded, the tree takes over and the importer steps aside.
                </p>
              </div>

              <div class="import-panel">
                <div class="import-panel__actions">
                  <button type="button" class="action-button action-button--primary" onClick={() => fileInputRef.current?.click()}>
                    <FolderOpen size={18} />
                    Choose XML file
                  </button>
                  <button type="button" class="action-button" onClick={() => pasteInputRef.current?.focus()}>
                    <FileUp size={18} />
                    Paste XML
                  </button>
                  {documentModel ? (
                    <button type="button" class="action-button" onClick={() => setShowImporter((current) => !current)}>
                      {showImporter ? 'Hide importer' : 'Show importer'}
                    </button>
                  ) : null}
                </div>

                <label class="import-panel__textarea">
                  <span class="import-panel__label">XML input</span>
                  <textarea
                    ref={pasteInputRef}
                    value={xmlDraft}
                    onInput={(event) => setXmlDraft((event.currentTarget as HTMLTextAreaElement).value)}
                    placeholder={`<?xml version="1.0"?>\n<catalog>\n  <book id="bk101">\n    <title>Sample XML</title>\n  </book>\n</catalog>`}
                    spellcheck={false}
                  />
                </label>

                <div class="import-panel__footer">
                  <p>{importHint}</p>
                  <button
                    type="button"
                    class="action-button action-button--primary"
                    onClick={() =>
                      submitXml({
                        type: 'paste',
                        name: 'Pasted XML',
                        size: new Blob([xmlDraft]).size,
                        xml: xmlDraft,
                        loadedAt: new Date().toISOString(),
                      })
                    }
                    disabled={!xmlDraft.trim()}
                  >
                    Parse XML
                  </button>
                </div>
              </div>
            </div>
          </section>

          {documentModel ? (
            <section class="viewer-card">
              <div class="viewer-toolbar">
                <div class="viewer-toolbar__left">
                  <button type="button" class="toolbar-button toolbar-button--labelled" onClick={() => setShowImporter((current) => !current)}>
                    <FileUp size={16} />
                    {showImporter ? 'Hide import panel' : 'Paste or replace'}
                  </button>
                  <button type="button" class="toolbar-button toolbar-button--labelled" onClick={() => fileInputRef.current?.click()}>
                    <FolderOpen size={16} />
                    Open file
                  </button>
                  <button type="button" class="toolbar-button toolbar-button--labelled" onClick={expandAll}>
                    Expand all
                  </button>
                  <button type="button" class="toolbar-button toolbar-button--labelled" onClick={collapseAll}>
                    Collapse all
                  </button>
                </div>

                <div class="viewer-toolbar__search">
                  <label class="search-field">
                    <Search size={16} />
                    <input
                      ref={searchInputRef}
                      value={searchQuery}
                      onFocus={() => {
                        searchInputFocusedRef.current = true
                      }}
                      onBlur={() => {
                        searchInputFocusedRef.current = false
                      }}
                      onInput={(event) => handleSearchInput((event.currentTarget as HTMLInputElement).value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          stepSearch(event.shiftKey ? -1 : 1)
                        }
                      }}
                      type="search"
                      placeholder="Search tags, attributes, or text"
                      spellcheck={false}
                    />
                  </label>
                  <div class="search-nav">
                    <span>{matchNodeIds.length > 0 ? `${activeMatchIndex + 1}/${matchNodeIds.length}` : '0 matches'}</span>
                    <button type="button" class="toolbar-button" onClick={() => stepSearch(-1)} disabled={matchNodeIds.length === 0}>
                      <ArrowUp size={15} />
                    </button>
                    <button type="button" class="toolbar-button" onClick={() => stepSearch(1)} disabled={matchNodeIds.length === 0}>
                      <ArrowDown size={15} />
                    </button>
                  </div>
                </div>
              </div>

              <div class="viewer-meta">
                <span>{documentModel.stats.rootTag}</span>
                <span>{formatCount(documentModel.stats.totalElements)} elements</span>
                <span>{formatBytes(documentModel.stats.fileSize)}</span>
                <span>{formatDuration(documentModel.stats.parseTimeMs)}</span>
              </div>

              <div
                ref={treeRef}
                class="tree-panel"
                role="tree"
                tabIndex={0}
                aria-label="XML tree"
                onKeyDown={handleTreeKeyDown}
              >
                {visibleRows.map((node) => (
                  <TreeRow
                    key={node.id}
                    node={node}
                    depth={node.depth}
                    expanded={expandedIds.has(node.id)}
                    selected={selectedNodeId === node.id}
                    matched={matchNodeIds.includes(node.id)}
                    activeMatch={activeMatchNodeId === node.id}
                    expandable={isExpandableNode(node, documentModel.nodes)}
                    query={searchQuery}
                    onSelect={() => setSelectedNodeId(node.id)}
                    onToggle={() => toggleNode(node.id)}
                    registerRef={registerRowRef}
                  />
                ))}
              </div>
            </section>
          ) : (
            <section class="empty-state">
              <div class="empty-state__icon">
                <FileCode2 size={28} />
              </div>
              <h2>No XML loaded yet</h2>
              <p>Use the importer above or drag an XML file anywhere into the window to start browsing the hierarchy.</p>
            </section>
          )}

          {parseError ? <ErrorCard message={parseError} /> : null}
        </main>
      </div>

      <StatsDock
        visible={statsVisible}
        documentStats={documentModel?.stats ?? null}
        onToggle={() => setStatsVisible((current) => !current)}
      />

      {dragActive ? (
        <div class="drop-overlay" aria-hidden="true">
          <div class="drop-overlay__card">
            <FileUp size={28} />
            <strong>Drop an XML file to open it</strong>
            <span>Large documents over {formatBytes(LARGE_FILE_WARNING_BYTES)} will prompt before parsing.</span>
          </div>
        </div>
      ) : null}

      {shortcutGuideOpen ? (
        <ShortcutGuide
          panelRef={helpPanelRef}
          shortcuts={shortcuts}
          onClose={() => setShortcutGuideOpen(false)}
        />
      ) : null}
    </div>
  )
}

type TreeRowProps = {
  activeMatch: boolean
  depth: number
  expanded: boolean
  expandable: boolean
  matched: boolean
  node: XmlTreeNode
  onSelect: () => void
  onToggle: () => void
  query: string
  registerRef: (nodeId: string, element: HTMLButtonElement | null) => void
  selected: boolean
}

function TreeRow({
  activeMatch,
  depth,
  expanded,
  expandable,
  matched,
  node,
  onSelect,
  onToggle,
  query,
  registerRef,
  selected,
}: TreeRowProps) {
  const rowId = useId()
  const handleRowClick = () => {
    onSelect()

    if (expandable) {
      onToggle()
    }
  }

  return (
    <div
      class={`tree-row ${selected ? 'tree-row--selected' : ''} ${matched ? 'tree-row--matched' : ''} ${
        activeMatch ? 'tree-row--active-match' : ''
      }`}
      role="treeitem"
      id={rowId}
      aria-level={depth + 1}
      aria-selected={selected}
      aria-expanded={expandable ? expanded : undefined}
      style={{ '--depth': `${depth}` }}
    >
      <button
        ref={(element) => registerRef(node.id, element)}
        type="button"
        class="tree-row__button"
        onClick={handleRowClick}
      >
        <span class={`tree-row__toggle ${expandable ? 'tree-row__toggle--interactive' : ''}`}>
          {expandable ? (
            <ChevronRight
              size={15}
              class={expanded ? 'tree-row__chevron tree-row__chevron--open' : 'tree-row__chevron'}
            />
          ) : null}
        </span>
        <span class={`node-kind node-kind--${node.kind}`}>{node.kind}</span>
        <span class="tree-row__label">{highlightText(node.name, query)}</span>
        {node.kind === 'element' && node.textPreview ? (
          <span class="tree-row__value tree-row__value--element">
            {highlightText(node.textPreview, query)}
          </span>
        ) : null}
        {node.value ? <span class="tree-row__value">{highlightText(node.value, query)}</span> : null}
        {node.kind === 'element' ? (
          <span class="tree-row__meta">{formatNodeSummary(node)}</span>
        ) : null}
      </button>
    </div>
  )
}

function StatsDock({
  documentStats,
  onToggle,
  visible,
}: {
  documentStats: DocumentStats | null
  onToggle: () => void
  visible: boolean
}) {
  if (!visible) {
    return (
      <button type="button" class="stats-chip" onClick={onToggle}>
        <Sparkles size={16} />
        Show stats
      </button>
    )
  }

  return (
    <aside class="stats-dock">
      <div class="stats-dock__header">
        <div>
          <p class="eyebrow">Document stats</p>
          <h2>Inspection snapshot</h2>
        </div>
        <button type="button" class="toolbar-button" onClick={onToggle} aria-label="Hide stats">
          <ChevronRight size={16} class="stats-dock__hide-icon" />
        </button>
      </div>

      {documentStats ? (
        <dl class="stats-grid">
          <StatItem label="File" value={documentStats.fileName} />
          <StatItem label="Size" value={formatBytes(documentStats.fileSize)} />
          <StatItem label="Root" value={documentStats.rootTag} />
          <StatItem label="Elements" value={formatCount(documentStats.totalElements)} />
          <StatItem label="Attributes" value={formatCount(documentStats.totalAttributes)} />
          <StatItem label="Text nodes" value={formatCount(documentStats.totalTextNodes)} />
          <StatItem label="Unique tags" value={formatCount(documentStats.uniqueTagCount)} />
          <StatItem label="Max depth" value={String(documentStats.maxDepth)} />
          <StatItem label="Parse time" value={formatDuration(documentStats.parseTimeMs)} />
        </dl>
      ) : (
        <p class="stats-dock__empty">Stats appear here after you load a document.</p>
      )}
    </aside>
  )
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div class="stats-grid__item">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function ErrorCard({ message }: { message: string }) {
  return (
    <section class="error-card" role="alert">
      <div class="error-card__icon">
        <AlertCircle size={18} />
      </div>
      <div>
        <h2>XML parsing failed</h2>
        <p>{message}</p>
      </div>
    </section>
  )
}

function ShortcutGuide({
  onClose,
  panelRef,
  shortcuts,
}: {
  onClose: () => void
  panelRef: preact.RefObject<HTMLDivElement>
  shortcuts: ShortcutDefinition[]
}) {
  return (
    <div
      class="shortcut-popover"
      ref={panelRef}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
        }
      }}
    >
      <div class="shortcut-popover__header">
        <div>
          <p class="eyebrow">Keyboard shortcuts</p>
          <h2>Work faster in the tree</h2>
        </div>
        <button type="button" class="toolbar-button" onClick={onClose} aria-label="Close shortcut help">
          <ChevronRight size={16} class="shortcut-popover__close" />
        </button>
      </div>
      <div class="shortcut-list">
        {shortcuts.map((shortcut) => (
          <div key={shortcut.key} class="shortcut-list__item">
            <kbd>{shortcut.key}</kbd>
            <span>{shortcut.description}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function highlightText(text: string, query: string) {
  if (!query.trim()) {
    return text
  }

  const normalizedQuery = query.trim().toLowerCase()
  const index = text.toLowerCase().indexOf(normalizedQuery)

  if (index === -1) {
    return text
  }

  const before = text.slice(0, index)
  const match = text.slice(index, index + normalizedQuery.length)
  const after = text.slice(index + normalizedQuery.length)

  return (
    <>
      {before}
      <mark>{match}</mark>
      {after}
    </>
  )
}
