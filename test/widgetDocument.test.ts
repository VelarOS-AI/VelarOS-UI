import { expect, test } from 'bun:test'

import {
  buildHtmlPreviewDocument,
  buildHtmlPreviewFrameShell,
} from '../src/conversation/html-preview/htmlPreviewDocument'

test('widget documents preserve their own styles and CSS variables', () => {
  const source =
    '<style>:root{--chart-line:rebeccapurple}svg{color:var(--chart-line)}</style><svg><path stroke="currentColor" d="M0 0L20 20"/></svg>'
  const document = buildHtmlPreviewDocument(source)
  expect(document).toContain(source)
  expect(document).not.toMatch(
    /--color-text-primary|--brand-primary|--font-sans|--border-radius-md/
  )
  expect(document).toContain('window.sendPrompt=')
})

test('HTML and SVG preview shells use only sizing styles', () => {
  for (const source of ['<button>choose</button>', '<svg viewBox="0 0 20 20"></svg>']) {
    const shell = buildHtmlPreviewFrameShell(source)
    expect(shell).not.toMatch(/:root\s*\{|--color-|--brand-|--font-|--border-radius-/)
    expect(shell).toContain('velaros-html-preview-root')
    expect(shell).toContain('window.sendPrompt=')
  }
})
