# PDF Viewer Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persisted PDF viewer side panel that opens PDFs from a file picker or drag-and-drop, restores the last opened document on reload, and leaves the tldraw canvas fully usable.

**Architecture:** Keep PDF concerns in a dedicated client-side subsystem under `src/pdf`. Persist one saved PDF plus viewer metadata in IndexedDB, manage runtime state in a focused Zustand store, and render pages through `pdf.js` in a docked panel that integrates with both fullscreen and debug canvas layouts.

**Tech Stack:** React 19, TypeScript, Zustand, `pdfjs-dist`, IndexedDB, Vitest, Testing Library, plain CSS.

---

## File Structure

- Modify `package.json` and `package-lock.json`: add `pdfjs-dist` for runtime PDF rendering and `fake-indexeddb` for persistence tests.
- Create `src/pdf/pdfPersistence.ts`: IndexedDB adapter for one stored PDF record and viewer metadata.
- Create `src/pdf/pdfPersistence.test.ts`: persistence adapter tests using `fake-indexeddb`.
- Create `src/pdf/pdfStore.ts`: dedicated Zustand store for current PDF runtime state.
- Create `src/pdf/pdfController.ts`: import, restore, clear, and viewer-state persistence orchestration.
- Create `src/pdf/pdfController.test.ts`: controller tests with mocked persistence.
- Create `src/pdf/pdfDocument.ts`: `pdf.js` worker setup and document-loading wrapper.
- Create `src/pdf/PdfViewerPanel.tsx`: docked viewer UI with toolbar, render canvas, empty/loading/error states, and collapse behavior.
- Create `src/pdf/PdfViewerPanel.test.tsx`: component tests with mocked `pdfDocument`.
- Modify `src/App.tsx`: add import button, hidden file input, drag-and-drop handling, restore-on-mount, and panel integration in fullscreen and debug layouts.
- Modify `src/App.test.tsx`: cover restore call, file picker import, drag-and-drop overlay, and debug/fullscreen placement.
- Modify `src/styles.css`: add layout, toolbar, panel, and drag-overlay styles for the PDF viewer.

### Task 1: Install PDF Dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install the runtime PDF renderer**

Run:

```bash
npm install pdfjs-dist
```

Expected: `package.json` adds `"pdfjs-dist"` under `dependencies`.

- [ ] **Step 2: Install the IndexedDB test helper**

Run:

```bash
npm install -D fake-indexeddb
```

Expected: `package.json` adds `"fake-indexeddb"` under `devDependencies`.

- [ ] **Step 3: Verify dependency metadata**

Run:

```bash
node -e "const p=require('./package.json'); console.log({ pdfjs:p.dependencies['pdfjs-dist'], fakeIndexedDb:p.devDependencies['fake-indexeddb'] })"
```

Expected output:

```text
{ pdfjs: '^4', fakeIndexedDb: '^6' }
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add pdf viewer dependencies"
```

### Task 2: Add IndexedDB Persistence For The Last PDF

**Files:**
- Create: `src/pdf/pdfPersistence.ts`
- Test: `src/pdf/pdfPersistence.test.ts`

- [ ] **Step 1: Write the failing persistence tests**

Create `src/pdf/pdfPersistence.test.ts`:

```ts
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearStoredPdf,
  loadStoredPdf,
  saveStoredPdf,
  type StoredPdfRecord
} from './pdfPersistence'

const record: StoredPdfRecord = {
  key: 'last-opened-pdf',
  name: 'roadmap.pdf',
  mimeType: 'application/pdf',
  size: 4,
  openedAt: '2026-07-10T08:00:00.000Z',
  currentPage: 2,
  zoom: 1.25,
  data: new Uint8Array([1, 2, 3, 4])
}

describe('pdfPersistence', () => {
  beforeEach(async () => {
    await clearStoredPdf()
  })

  it('saves and reloads the last stored pdf', async () => {
    await saveStoredPdf(record)

    await expect(loadStoredPdf()).resolves.toEqual(record)
  })

  it('replaces the previously stored pdf with the new one', async () => {
    await saveStoredPdf(record)
    await saveStoredPdf({
      ...record,
      name: 'updated.pdf',
      currentPage: 5,
      zoom: 1.75
    })

    await expect(loadStoredPdf()).resolves.toEqual(
      expect.objectContaining({
        name: 'updated.pdf',
        currentPage: 5,
        zoom: 1.75
      })
    )
  })

  it('clears the saved pdf record', async () => {
    await saveStoredPdf(record)
    await clearStoredPdf()

    await expect(loadStoredPdf()).resolves.toBeNull()
  })
})
```

- [ ] **Step 2: Run the persistence test to verify red**

Run:

```bash
npm test -- src/pdf/pdfPersistence.test.ts
```

Expected: FAIL because `src/pdf/pdfPersistence.ts` does not exist yet.

- [ ] **Step 3: Write the minimal IndexedDB adapter**

Create `src/pdf/pdfPersistence.ts`:

```ts
export const LAST_STORED_PDF_KEY = 'last-opened-pdf'

export type StoredPdfRecord = {
  key: typeof LAST_STORED_PDF_KEY
  name: string
  mimeType: string
  size: number
  openedAt: string
  currentPage: number
  zoom: number
  data: Uint8Array
}

const DB_NAME = 'hermes-canvas-pdf'
const STORE_NAME = 'pdfDocuments'
const DB_VERSION = 1

async function openPdfDatabase(): Promise<IDBDatabase> {
  return await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
  })
}

export async function loadStoredPdf(): Promise<StoredPdfRecord | null> {
  const database = await openPdfDatabase()

  return await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).get(LAST_STORED_PDF_KEY)

    request.onsuccess = () => resolve((request.result as StoredPdfRecord | undefined) ?? null)
    request.onerror = () => reject(request.error ?? new Error('Failed to read saved PDF'))
  })
}

export async function saveStoredPdf(record: StoredPdfRecord): Promise<void> {
  const database = await openPdfDatabase()

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(record)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Failed to save PDF'))
  })
}

export async function clearStoredPdf(): Promise<void> {
  const database = await openPdfDatabase()

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).delete(LAST_STORED_PDF_KEY)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Failed to clear saved PDF'))
  })
}
```

- [ ] **Step 4: Run the persistence test to verify green**

Run:

```bash
npm test -- src/pdf/pdfPersistence.test.ts
```

Expected: PASS with 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/pdf/pdfPersistence.ts src/pdf/pdfPersistence.test.ts
git commit -m "feat: persist the last opened pdf"
```

### Task 3: Add PDF Runtime State And Controller Logic

**Files:**
- Create: `src/pdf/pdfStore.ts`
- Create: `src/pdf/pdfController.ts`
- Test: `src/pdf/pdfController.test.ts`

- [ ] **Step 1: Write the failing controller tests**

Create `src/pdf/pdfController.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearPdfDocument,
  importPdfFile,
  persistPdfViewerState,
  restoreLastPdf
} from './pdfController'
import { usePdfStore } from './pdfStore'

const persistence = vi.hoisted(() => ({
  loadStoredPdf: vi.fn(),
  saveStoredPdf: vi.fn(),
  clearStoredPdf: vi.fn()
}))

vi.mock('./pdfPersistence', () => persistence)

describe('pdfController', () => {
  beforeEach(() => {
    persistence.loadStoredPdf.mockReset()
    persistence.saveStoredPdf.mockReset()
    persistence.clearStoredPdf.mockReset()
    usePdfStore.setState({
      status: 'idle',
      isPanelOpen: false,
      document: null,
      currentPage: 1,
      zoom: 1,
      error: null
    })
  })

  it('hydrates the store from the saved pdf record', async () => {
    persistence.loadStoredPdf.mockResolvedValue({
      key: 'last-opened-pdf',
      name: 'guide.pdf',
      mimeType: 'application/pdf',
      size: 3,
      openedAt: '2026-07-10T08:00:00.000Z',
      currentPage: 3,
      zoom: 1.5,
      data: new Uint8Array([1, 2, 3])
    })

    await restoreLastPdf()

    expect(usePdfStore.getState()).toMatchObject({
      status: 'ready',
      isPanelOpen: true,
      currentPage: 3,
      zoom: 1.5,
      document: expect.objectContaining({ name: 'guide.pdf' })
    })
  })

  it('rejects non-pdf files without writing persistence', async () => {
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' })

    await importPdfFile(file)

    expect(persistence.saveStoredPdf).not.toHaveBeenCalled()
    expect(usePdfStore.getState()).toMatchObject({
      status: 'error',
      error: 'Only PDF files are supported.'
    })
  })

  it('imports a pdf and persists the last-opened record', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'guide.pdf', {
      type: 'application/pdf'
    })

    await importPdfFile(file)

    expect(persistence.saveStoredPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'last-opened-pdf',
        name: 'guide.pdf',
        currentPage: 1,
        zoom: 1
      })
    )
    expect(usePdfStore.getState()).toMatchObject({
      status: 'ready',
      isPanelOpen: true,
      document: expect.objectContaining({ name: 'guide.pdf' })
    })
  })

  it('persists updated page and zoom state for the current document', async () => {
    usePdfStore.setState({
      status: 'ready',
      isPanelOpen: true,
      document: {
        name: 'guide.pdf',
        mimeType: 'application/pdf',
        size: 3,
        openedAt: '2026-07-10T08:00:00.000Z',
        data: new Uint8Array([1, 2, 3])
      },
      currentPage: 1,
      zoom: 1,
      error: null
    })

    await persistPdfViewerState({ currentPage: 4, zoom: 1.8 })

    expect(usePdfStore.getState()).toMatchObject({
      currentPage: 4,
      zoom: 1.8
    })
    expect(persistence.saveStoredPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        currentPage: 4,
        zoom: 1.8
      })
    )
  })

  it('clears the current document and persistence', async () => {
    usePdfStore.setState({
      status: 'ready',
      isPanelOpen: true,
      document: {
        name: 'guide.pdf',
        mimeType: 'application/pdf',
        size: 3,
        openedAt: '2026-07-10T08:00:00.000Z',
        data: new Uint8Array([1, 2, 3])
      },
      currentPage: 2,
      zoom: 1.25,
      error: null
    })

    await clearPdfDocument()

    expect(persistence.clearStoredPdf).toHaveBeenCalled()
    expect(usePdfStore.getState()).toMatchObject({
      status: 'idle',
      isPanelOpen: false,
      document: null,
      currentPage: 1,
      zoom: 1,
      error: null
    })
  })
})
```

- [ ] **Step 2: Run the controller test to verify red**

Run:

```bash
npm test -- src/pdf/pdfController.test.ts
```

Expected: FAIL because `pdfStore.ts` and `pdfController.ts` do not exist yet.

- [ ] **Step 3: Implement the store and controller**

Create `src/pdf/pdfStore.ts`:

```ts
import { create } from 'zustand'

export type PdfDocumentState = {
  name: string
  mimeType: string
  size: number
  openedAt: string
  data: Uint8Array
}

export type PdfStatus = 'idle' | 'loading' | 'ready' | 'error'

type PdfState = {
  status: PdfStatus
  isPanelOpen: boolean
  document: PdfDocumentState | null
  currentPage: number
  zoom: number
  error: string | null
}

const initialState: PdfState = {
  status: 'idle',
  isPanelOpen: false,
  document: null,
  currentPage: 1,
  zoom: 1,
  error: null
}

export const usePdfStore = create<PdfState>(() => initialState)

export function resetPdfState() {
  usePdfStore.setState(initialState)
}

export function setPdfPanelOpen(isPanelOpen: boolean) {
  usePdfStore.setState({ isPanelOpen })
}
```

Create `src/pdf/pdfController.ts`:

```ts
import { clearStoredPdf, loadStoredPdf, saveStoredPdf, LAST_STORED_PDF_KEY } from './pdfPersistence'
import { resetPdfState, setPdfPanelOpen, usePdfStore } from './pdfStore'

function isPdfFile(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

function setError(message: string) {
  usePdfStore.setState({
    status: 'error',
    isPanelOpen: true,
    error: message
  })
}

export async function restoreLastPdf() {
  usePdfStore.setState({ status: 'loading', error: null })

  try {
    const saved = await loadStoredPdf()
    if (!saved) {
      resetPdfState()
      return
    }

    usePdfStore.setState({
      status: 'ready',
      isPanelOpen: true,
      document: {
        name: saved.name,
        mimeType: saved.mimeType,
        size: saved.size,
        openedAt: saved.openedAt,
        data: saved.data
      },
      currentPage: saved.currentPage,
      zoom: saved.zoom,
      error: null
    })
  } catch {
    await clearStoredPdf().catch(() => undefined)
    setError('Saved PDF could not be restored.')
  }
}

export async function importPdfFile(file: File) {
  if (!isPdfFile(file)) {
    setError('Only PDF files are supported.')
    return
  }

  usePdfStore.setState({ status: 'loading', error: null })

  try {
    const data = new Uint8Array(await file.arrayBuffer())
    const openedAt = new Date().toISOString()

    await saveStoredPdf({
      key: LAST_STORED_PDF_KEY,
      name: file.name,
      mimeType: file.type || 'application/pdf',
      size: file.size,
      openedAt,
      currentPage: 1,
      zoom: 1,
      data
    })

    usePdfStore.setState({
      status: 'ready',
      isPanelOpen: true,
      document: {
        name: file.name,
        mimeType: file.type || 'application/pdf',
        size: file.size,
        openedAt,
        data
      },
      currentPage: 1,
      zoom: 1,
      error: null
    })
  } catch {
    setError('PDF import failed. Try again.')
  }
}

export async function persistPdfViewerState(input: { currentPage: number; zoom: number }) {
  const state = usePdfStore.getState()
  if (!state.document) return

  usePdfStore.setState({
    currentPage: input.currentPage,
    zoom: input.zoom
  })

  await saveStoredPdf({
    key: LAST_STORED_PDF_KEY,
    name: state.document.name,
    mimeType: state.document.mimeType,
    size: state.document.size,
    openedAt: state.document.openedAt,
    currentPage: input.currentPage,
    zoom: input.zoom,
    data: state.document.data
  })
}

export async function clearPdfDocument() {
  await clearStoredPdf()
  resetPdfState()
}

export function reopenPdfPanel() {
  if (usePdfStore.getState().document) {
    setPdfPanelOpen(true)
  }
}
```

- [ ] **Step 4: Run the controller test to verify green**

Run:

```bash
npm test -- src/pdf/pdfController.test.ts
```

Expected: PASS with 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/pdf/pdfStore.ts src/pdf/pdfController.ts src/pdf/pdfController.test.ts
git commit -m "feat: add pdf import and restore state"
```

### Task 4: Render PDFs In A Docked Viewer Panel

**Files:**
- Create: `src/pdf/pdfDocument.ts`
- Create: `src/pdf/PdfViewerPanel.tsx`
- Test: `src/pdf/PdfViewerPanel.test.tsx`

- [ ] **Step 1: Write the failing viewer-panel tests**

Create `src/pdf/PdfViewerPanel.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PdfViewerPanel } from './PdfViewerPanel'
import { usePdfStore } from './pdfStore'

const pdfDocument = vi.hoisted(() => ({
  loadPdfDocument: vi.fn()
}))

const controller = vi.hoisted(() => ({
  clearPdfDocument: vi.fn(),
  persistPdfViewerState: vi.fn()
}))

vi.mock('./pdfDocument', () => pdfDocument)
vi.mock('./pdfController', () => controller)

describe('PdfViewerPanel', () => {
  beforeEach(() => {
    pdfDocument.loadPdfDocument.mockReset()
    controller.clearPdfDocument.mockReset()
    controller.persistPdfViewerState.mockReset()
    controller.persistPdfViewerState.mockImplementation(async ({ currentPage, zoom }) => {
      usePdfStore.setState({ currentPage, zoom })
    })
    usePdfStore.setState({
      status: 'ready',
      isPanelOpen: true,
      document: {
        name: 'guide.pdf',
        mimeType: 'application/pdf',
        size: 3,
        openedAt: '2026-07-10T08:00:00.000Z',
        data: new Uint8Array([1, 2, 3])
      },
      currentPage: 1,
      zoom: 1,
      error: null
    })
  })

  it('loads and renders the current pdf page', async () => {
    const renderPage = vi.fn(() => ({ promise: Promise.resolve() }))
    pdfDocument.loadPdfDocument.mockResolvedValue({
      numPages: 4,
      getPage: vi.fn().mockResolvedValue({
        getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
        render: renderPage
      })
    })

    render(<PdfViewerPanel />)

    await waitFor(() => {
      expect(pdfDocument.loadPdfDocument).toHaveBeenCalled()
      expect(screen.getByText('guide.pdf')).toBeInTheDocument()
      expect(screen.getByText('1 / 4')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Fit width' })).toBeInTheDocument()
    })
  })

  it('updates page and zoom controls through the controller', async () => {
    pdfDocument.loadPdfDocument.mockResolvedValue({
      numPages: 3,
      getPage: vi.fn().mockResolvedValue({
        getViewport: ({ scale }: { scale: number }) => ({ width: 500 * scale, height: 700 * scale }),
        render: () => ({ promise: Promise.resolve() })
      })
    })

    render(<PdfViewerPanel />)
    await screen.findByText('1 / 3')

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))

    await waitFor(() => {
      expect(controller.persistPdfViewerState).toHaveBeenCalledWith(
        expect.objectContaining({ currentPage: 2, zoom: 1.1 })
      )
    })
  })

  it('clears the current document from the panel', async () => {
    pdfDocument.loadPdfDocument.mockResolvedValue({
      numPages: 1,
      getPage: vi.fn().mockResolvedValue({
        getViewport: ({ scale }: { scale: number }) => ({ width: 500 * scale, height: 700 * scale }),
        render: () => ({ promise: Promise.resolve() })
      })
    })

    render(<PdfViewerPanel />)
    await screen.findByText('guide.pdf')

    fireEvent.click(screen.getByRole('button', { name: 'Clear PDF' }))

    expect(controller.clearPdfDocument).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the viewer-panel test to verify red**

Run:

```bash
npm test -- src/pdf/PdfViewerPanel.test.tsx
```

Expected: FAIL because `PdfViewerPanel.tsx` and `pdfDocument.ts` do not exist yet.

- [ ] **Step 3: Implement the pdf.js wrapper and viewer panel**

Create `src/pdf/pdfDocument.ts`:

```ts
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

export async function loadPdfDocument(data: Uint8Array) {
  return await getDocument({ data }).promise
}
```

Create `src/pdf/PdfViewerPanel.tsx`:

```tsx
import { type ChangeEvent, type DragEvent, useEffect, useRef, useState } from 'react'
import { clearPdfDocument, persistPdfViewerState } from './pdfController'
import { loadPdfDocument } from './pdfDocument'
import { setPdfPanelOpen, usePdfStore } from './pdfStore'

const ZOOM_STEP = 0.1

export function PdfViewerPanel() {
  const { status, isPanelOpen, document, currentPage, zoom, error } = usePdfStore()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const shellRef = useRef<HTMLDivElement | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [fitWidthZoom, setFitWidthZoom] = useState<number | null>(null)

  useEffect(() => {
    if (!document || status !== 'ready' || !canvasRef.current) return

    let cancelled = false

    async function renderPage() {
      const pdf = await loadPdfDocument(document.data)
      if (cancelled) return

      setPageCount(pdf.numPages)
      const page = await pdf.getPage(currentPage)
      if (cancelled) return

      const viewport = page.getViewport({ scale: zoom })
      const canvas = canvasRef.current
      if (!canvas) return

      canvas.width = viewport.width
      canvas.height = viewport.height
      if (shellRef.current) {
        const baseViewport = page.getViewport({ scale: 1 })
        setFitWidthZoom(
          Number(Math.max(0.5, (shellRef.current.clientWidth - 32) / baseViewport.width).toFixed(2))
        )
      }
      const context = canvas.getContext('2d')
      if (!context) return

      await page.render({ canvasContext: context, viewport }).promise
    }

    renderPage().catch(() => {
      if (!cancelled) {
        usePdfStore.setState({ status: 'error', error: 'PDF rendering failed.' })
      }
    })

    return () => {
      cancelled = true
    }
  }, [document, currentPage, zoom, status])

  if (!isPanelOpen) return null

  return (
    <aside className="pdf-viewer-panel" aria-label="PDF viewer panel">
      <div className="pdf-viewer-header">
        <div>
          <h2>{document?.name ?? 'PDF Viewer'}</h2>
          {document ? <p>{currentPage} / {pageCount || currentPage}</p> : null}
        </div>
        <div className="pdf-toolbar">
          <button type="button" className="btn btn-secondary btn-sm" aria-label="Previous page" disabled={!document || currentPage <= 1} onClick={() => void persistPdfViewerState({ currentPage: Math.max(1, currentPage - 1), zoom })}>
            Prev
          </button>
          <button type="button" className="btn btn-secondary btn-sm" aria-label="Next page" disabled={!document || (pageCount > 0 && currentPage >= pageCount)} onClick={() => void persistPdfViewerState({ currentPage: pageCount > 0 ? Math.min(pageCount, currentPage + 1) : currentPage + 1, zoom })}>
            Next
          </button>
          <button type="button" className="btn btn-secondary btn-sm" aria-label="Zoom out" disabled={!document} onClick={() => void persistPdfViewerState({ currentPage, zoom: Math.max(0.5, Number((zoom - ZOOM_STEP).toFixed(2))) })}>
            -
          </button>
          <button type="button" className="btn btn-secondary btn-sm" aria-label="Zoom in" disabled={!document} onClick={() => void persistPdfViewerState({ currentPage, zoom: Number((zoom + ZOOM_STEP).toFixed(2)) })}>
            +
          </button>
          <button type="button" className="btn btn-secondary btn-sm" aria-label="Fit width" disabled={!document || fitWidthZoom === null} onClick={() => void persistPdfViewerState({ currentPage, zoom: fitWidthZoom ?? zoom })}>
            Fit
          </button>
          <button type="button" className="btn btn-secondary btn-sm" aria-label="Close PDF panel" onClick={() => setPdfPanelOpen(false)}>
            Hide
          </button>
          <button type="button" className="btn btn-danger btn-sm" aria-label="Clear PDF" onClick={() => void clearPdfDocument()}>
            Clear
          </button>
        </div>
      </div>

      {status === 'loading' ? <div className="pdf-viewer-empty">Loading PDF…</div> : null}
      {error ? <div className="pdf-viewer-error">{error}</div> : null}
      {!document && status === 'idle' ? <div className="pdf-viewer-empty">Import a PDF to open it here.</div> : null}
      {document && status === 'ready' ? (
        <div className="pdf-canvas-shell" ref={shellRef}>
          <canvas ref={canvasRef} />
        </div>
      ) : null}
    </aside>
  )
}
```

- [ ] **Step 4: Run the viewer-panel test to verify green**

Run:

```bash
npm test -- src/pdf/PdfViewerPanel.test.tsx
```

Expected: PASS with 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/pdf/pdfDocument.ts src/pdf/PdfViewerPanel.tsx src/pdf/PdfViewerPanel.test.tsx
git commit -m "feat: add pdf viewer panel"
```

### Task 5: Integrate Import, Drag-And-Drop, Restore, And Layout

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write the failing app-shell tests**

Add these tests to `src/App.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { usePdfStore } from './pdf/pdfStore'

const pdfController = vi.hoisted(() => ({
  importPdfFile: vi.fn(),
  restoreLastPdf: vi.fn(),
  reopenPdfPanel: vi.fn()
}))

vi.mock('./pdf/pdfController', () => pdfController)
vi.mock('./pdf/PdfViewerPanel', () => ({
  PdfViewerPanel: () => <div data-testid="pdf-viewer-panel-stub" />
}))

beforeEach(() => {
  pdfController.importPdfFile.mockReset()
  pdfController.restoreLastPdf.mockReset()
  pdfController.reopenPdfPanel.mockReset()
  usePdfStore.setState({
    status: 'idle',
    isPanelOpen: false,
    document: null,
    currentPage: 1,
    zoom: 1,
    error: null
  })
})

it('restores the last pdf on mount', () => {
  render(<App />)

  expect(pdfController.restoreLastPdf).toHaveBeenCalledTimes(1)
})

it('imports a pdf from the file picker in fullscreen mode', async () => {
  render(<App />)

  const file = new File([new Uint8Array([1, 2, 3])], 'guide.pdf', { type: 'application/pdf' })
  const input = screen.getByLabelText('Import PDF file') as HTMLInputElement

  fireEvent.change(input, { target: { files: [file] } })

  await waitFor(() => {
    expect(pdfController.importPdfFile).toHaveBeenCalledWith(file)
  })
})

it('shows a drop overlay and imports a pdf on drop', async () => {
  render(<App />)

  const dropZone = screen.getByLabelText('Fullscreen canvas surface')
  const file = new File([new Uint8Array([1, 2, 3])], 'guide.pdf', { type: 'application/pdf' })

  fireEvent.dragEnter(dropZone, { dataTransfer: { items: [{ kind: 'file', type: 'application/pdf' }] } })
  expect(screen.getByText('Drop PDF to open viewer')).toBeInTheDocument()

  fireEvent.drop(dropZone, { dataTransfer: { files: [file] } })

  await waitFor(() => {
    expect(pdfController.importPdfFile).toHaveBeenCalledWith(file)
  })
})

it('keeps the import action available in debug mode', () => {
  window.history.replaceState({}, '', '/?debug=true')

  render(<App />)

  expect(screen.getByRole('button', { name: 'Import PDF' })).toBeInTheDocument()
  expect(screen.getByTestId('pdf-viewer-panel-stub')).toBeInTheDocument()
})

it('reopens a hidden pdf panel without asking for a new file', () => {
  usePdfStore.setState({
    status: 'ready',
    isPanelOpen: false,
    document: {
      name: 'guide.pdf',
      mimeType: 'application/pdf',
      size: 3,
      openedAt: '2026-07-10T08:00:00.000Z',
      data: new Uint8Array([1, 2, 3])
    },
    currentPage: 1,
    zoom: 1,
    error: null
  })

  render(<App />)

  fireEvent.click(screen.getByRole('button', { name: 'Show PDF' }))

  expect(pdfController.reopenPdfPanel).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run the app-shell test to verify red**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: FAIL because `App.tsx` does not restore PDFs, does not expose import controls, and does not render the PDF viewer panel yet.

- [ ] **Step 3: Implement app integration and styles**

Replace the top of `src/App.tsx` imports and the `App` component with this structure:

```tsx
import { useEffect, useRef, useState } from 'react'
import { CanvasSurface } from './canvas/components/CanvasSurface'
import { CanvasInsertMenu } from './canvas/components/CanvasInsertMenu'
import { Simulator } from './canvas/components/Simulator'
import { Inspector } from './canvas/components/Inspector'
import { useBridgeStore } from './canvas/state/bridgeStore'
import { importPdfFile, reopenPdfPanel, restoreLastPdf } from './pdf/pdfController'
import { PdfViewerPanel } from './pdf/PdfViewerPanel'
import { usePdfStore } from './pdf/pdfStore'

function usePdfDropHandlers() {
  const [isDragActive, setIsDragActive] = useState(false)

  return {
    isDragActive,
    onDragEnter(event: DragEvent<HTMLElement>) {
      event.preventDefault()
      setIsDragActive(true)
    },
    onDragOver(event: DragEvent<HTMLElement>) {
      event.preventDefault()
      setIsDragActive(true)
    },
    onDragLeave(event: DragEvent<HTMLElement>) {
      event.preventDefault()
      if (event.currentTarget === event.target) {
        setIsDragActive(false)
      }
    },
    async onDrop(event: DragEvent<HTMLElement>) {
      event.preventDefault()
      setIsDragActive(false)
      const file = event.dataTransfer.files?.[0]
      if (file) await importPdfFile(file)
    }
  }
}

export default function App() {
  const status = useBridgeStore((state) => state.status)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const pdfDocument = usePdfStore((state) => state.document)
  const isPdfPanelOpen = usePdfStore((state) => state.isPanelOpen)
  const isActionDebugMode = new URLSearchParams(window.location.search).get('debug') === 'true'
  const dropHandlers = usePdfDropHandlers()

  useEffect(() => {
    void restoreLastPdf()
  }, [])

  const openFilePicker = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      await importPdfFile(file)
      event.target.value = ''
    }
  }

  const importControl = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        aria-label="Import PDF file"
        hidden
        onChange={(event) => void handleFileChange(event)}
      />
      <button type="button" className="btn btn-secondary btn-sm" onClick={openFilePicker}>
        Import PDF
      </button>
      {pdfDocument && !isPdfPanelOpen ? (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => reopenPdfPanel()}>
          Show PDF
        </button>
      ) : null}
    </>
  )

  if (!isActionDebugMode) {
    return (
      <main className="fullscreen-canvas-page">
        <div className="fullscreen-floating-actions">{importControl}</div>
        <section className="canvas-workspace" aria-label="Fullscreen canvas surface" {...dropHandlers}>
          <div className="canvas-workspace-main fullscreen-canvas-container">
            <CanvasInsertMenu />
            <CanvasSurface />
            {dropHandlers.isDragActive ? <div className="pdf-drop-overlay">Drop PDF to open viewer</div> : null}
          </div>
          <PdfViewerPanel />
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-group">
          <div className="logo-glow"></div>
          <div className="logo-symbol">H</div>
          <div>
            <p className="eyebrow">Infinite canvas workspace</p>
            <h1 id="app-title">Hermes Canvas Productivity</h1>
            <p className="brand-description">Visual workspace for agent-driven execution</p>
          </div>
        </div>

        <BridgeStatusMeta status={status} />
      </header>

      <div className="workspace-layout">
        <Simulator />

        <section className="canvas-panel">
          <div className="canvas-header-bar">
            <span className="canvas-title">Interactive Canvas Surface</span>
            <div className="canvas-header-actions">
              <span className="canvas-engine-badge">tldraw sync</span>
              {importControl}
              <a className="canvas-action-link" href="?view=canvas">
                Fullscreen
              </a>
            </div>
          </div>
          <div className="canvas-workspace" {...dropHandlers}>
            <div className="canvas-workspace-main canvas-container">
              <CanvasInsertMenu />
              <CanvasSurface />
              {dropHandlers.isDragActive ? <div className="pdf-drop-overlay">Drop PDF to open viewer</div> : null}
            </div>
            <PdfViewerPanel />
          </div>
        </section>

        <Inspector />
      </div>
    </main>
  )
}
```

Add these CSS blocks to `src/styles.css`:

```css
.canvas-workspace {
  display: flex;
  min-height: 0;
  width: 100%;
  height: 100%;
}

.fullscreen-floating-actions {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 1250;
  display: flex;
  gap: 8px;
}

.canvas-workspace-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  position: relative;
}

.pdf-viewer-panel {
  width: min(32vw, 420px);
  min-width: 320px;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--panel-border);
  background: rgba(3, 7, 18, 0.94);
}

.pdf-viewer-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--panel-border);
}

.pdf-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.pdf-canvas-shell {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

.pdf-canvas-shell canvas {
  display: block;
  max-width: 100%;
  margin: 0 auto;
  background: white;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.28);
}

.pdf-viewer-empty,
.pdf-viewer-error {
  padding: 18px 16px;
  color: var(--text-secondary);
}

.pdf-viewer-error {
  color: var(--color-danger);
}

.pdf-drop-overlay {
  position: absolute;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(4, 9, 19, 0.72);
  border: 2px dashed rgba(56, 189, 248, 0.55);
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

@media (max-width: 1100px) {
  .pdf-viewer-panel {
    width: min(42vw, 360px);
    min-width: 280px;
  }
}

@media (max-width: 820px) {
  .canvas-workspace {
    flex-direction: column;
  }

  .pdf-viewer-panel {
    width: 100%;
    min-width: 0;
    min-height: 260px;
    border-left: 0;
    border-top: 1px solid var(--panel-border);
  }
}
```

- [ ] **Step 4: Run app tests, then full verification**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: PASS with the new PDF import and restore tests passing.

Run:

```bash
npm test
```

Expected: PASS with the full Vitest suite green.

Run:

```bash
npm run lint:types
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/styles.css
git add src/pdf/pdfDocument.ts src/pdf/PdfViewerPanel.tsx src/pdf/PdfViewerPanel.test.tsx
git add src/pdf/pdfPersistence.ts src/pdf/pdfPersistence.test.ts src/pdf/pdfStore.ts src/pdf/pdfController.ts src/pdf/pdfController.test.ts
git commit -m "feat: add persisted pdf viewer panel"
```
