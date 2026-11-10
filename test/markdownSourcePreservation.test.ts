import assert from 'node:assert/strict'
import { test } from 'node:test'

import { prepareStreamdownMarkdownText } from '../src/conversation/markdown/streamdownMarkdownSource.utils'

void test('short or mismatched fences inside a long fence preserve literal dollars and trees', () => {
  for (const [opening, inner, closing] of [
    ['````typescript', '```', '````'],
    ['~~~~~text', '~~~~', '~~~~~'],
    ['```text', '~~~', '```'],
    ['   ````text', '```', '   `````\t'],
  ]) {
    const source = [opening, inner, 'price = "$20"', 'project/', '├── source', '└── tests', closing].join('\n')
    assert.equal(prepareStreamdownMarkdownText(source), source)
  }
})

void test('only a complete closing line ends protection and resumes normal text preparation', () => {
  const code = ['````text', '````still-code', '$20', '├── source', '└── tests', '````` \t'].join('\n')
  const text = '\nOutside $5\n\nproject/\n└── file'
  const preparedText = '\nOutside \\$5\n\n```\nproject/\n└── file\n```'
  assert.equal(prepareStreamdownMarkdownText(`${code}${text}`), `${code}${preparedText}`)
})

void test('unclosed and CRLF fences preserve the original code bytes', () => {
  for (const source of [
    '````js\n```\nconst amount = "$5"\n├── source\n└── tests',
    '~~~~text\r\n~~~\r\n$10\r\n├── source\r\n└── tests\r\n~~~~\r\n',
  ]) assert.equal(prepareStreamdownMarkdownText(source), source)
})
