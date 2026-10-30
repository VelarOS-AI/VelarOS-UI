import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { FolderIcon } from '@phosphor-icons/react'
import { Streamdown } from 'streamdown'

import { MessageMarkdownRuntimeProvider, useMessageMarkdownComponents } from '../src/conversation/blocks/useMessageMarkdownComponents'
import { resolveMessageMarkdownHrefTarget } from '../src/conversation/markdown/messageMarkdownLinks.utils'
import { STREAMDOWN_MARKDOWN_REHYPE_PLUGINS, transformMessageMarkdownUrl } from '../src/conversation/markdown/streamdownMarkdown.config'
import { FileTypeIcon } from '../src/primitives/display/FileTypeIcon'

function MarkdownProbe({ text, streaming = false, host = true }: { text: string; streaming?: boolean; host?: boolean }): ReactElement {
  const { components, runtime } = useMessageMarkdownComponents(undefined, host ? async () => {} : undefined)
  return createElement(MessageMarkdownRuntimeProvider, { runtime },
    createElement(Streamdown, { components, rehypePlugins: STREAMDOWN_MARKDOWN_REHYPE_PLUGINS, urlTransform: transformMessageMarkdownUrl, mode: streaming ? 'streaming' : 'static', remend: { linkMode: 'text-only' } }, text))
}
const render = (text: string, streaming = false, host = true) => renderToStaticMarkup(createElement(MarkdownProbe, { text, streaming, host }))

void describe('explicit Markdown link protocols', () => {
  void test('file URI uses UTF-8 and decodes exactly once without requiring an extension', () => {
    for (const [uri, path] of [
      ['file:///tmp/README', '/tmp/README'],
      ['file://localhost/tmp/report.pdf', '/tmp/report.pdf'],
      ['file:///tmp/%E6%8A%A5%E5%91%8A%20%23%25.txt', '/tmp/报告 #%.txt'],
      ['file:///tmp/%2520', '/tmp/%20'],
      ['file:///C:/work/app.ts', 'C:/work/app.ts'],
    ]) {
      const result = resolveMessageMarkdownHrefTarget(uri)
      assert.equal(result.kind, 'file', uri)
      assert.equal(result.kind === 'file' && result.path, path)
    }
  })
  void test('paths, unsupported schemes and invalid local URIs stay text', () => {
    for (const href of ['src/app.ts', '~/app.ts', 'C:app.ts', '//server/share', '\\\\server\\share', 'x://host/path', 'file:relative',
      'file://server/share/a', 'file:////server/share/a', 'file:///tmp/a%2fb', 'file:///tmp/a%5cb', 'file:///tmp/%00',
      'file:///tmp/%ZZ', 'file:///tmp/%FF', 'file:///tmp/a?x=1', 'file:///tmp/a#part',
      'file:///tmp/a b', 'file:///tmp/a\\b', 'javascript:alert(1)', 'data:text/html,test',
      'https://', 'https://name:password@example.com', 'https:\\example.com'])
      assert.equal(resolveMessageMarkdownHrefTarget(href).kind, 'text', href)
  })
  void test('web URLs preserve query and fragment; explicit mail and phone links remain compatible', () => {
    assert.deepEqual(resolveMessageMarkdownHrefTarget('https://example.com/a?q=1#part'), { kind: 'web', url: 'https://example.com/a?q=1#part' })
    assert.equal(resolveMessageMarkdownHrefTarget('mailto:a@example.com').kind, 'external-protocol')
    assert.equal(resolveMessageMarkdownHrefTarget('tel:+123').kind, 'external-protocol')
  })
  void test('actual Streamdown renders the file URI as an application file control', () => {
    const markup = render('[报告](file:///tmp/%E6%8A%A5%E5%91%8A%20%23%25.txt)')
    assert.match(markup, /<a\b/u)
    assert.match(markup, /href="file:\/\/\/tmp\/%E6%8A%A5%E5%91%8A%20%23%25.txt"/u)
    assert.match(markup, /<svg\b/u)
    assert.match(render('[报告](file:///tmp/report "model title")'), /title="file:\/\/\/tmp\/report"/u)
    assert.doesNotMatch(render('[报告](file:///tmp/report)', false, false), /<a\b/u)
  })
  void test('inline code, plain paths and relative links have no file-opening behavior', () => {
    for (const source of ['D:/work/a.ts', '`D:/work/a.ts`', '`/tmp/a.ts`', '`file:///tmp/a.ts`', '[代码](src/a.ts)'])
      assert.doesNotMatch(render(source), /<a\b/u, source)
  })
  void test('local links use file-type icons and keep directory descriptions outside the link', () => {
    const svg = (markup: string) => markup.match(/<svg\b[\s\S]*?<\/svg>/u)?.[0].replace(/ class="[^"]*"/u, '')
    for (const streaming of [false, true]) {
      for (const name of ['report.docx', 'report.xlsx', 'slides.pptx', 'report.pdf', 'image.png', 'app.ts', 'README']) {
        assert.equal(svg(render(`[文件](D:/work/${name})`, streaming)),
          svg(renderToStaticMarkup(createElement(FileTypeIcon, { fileName: name, size: 14, 'aria-hidden': true }))))
      }
      const folder = render('[evidence 目录](D:/work/evidence/)', streaming)
      assert.equal(svg(folder), svg(renderToStaticMarkup(createElement(FolderIcon, { size: 14, 'aria-hidden': true }))))
      assert.match(folder, /evidence<\/a> 目录/u)
      assert.match(render('[文件 目录](D:/work/目录.txt)', streaming), /文件 目录<\/a>/u)
      assert.match(render('[目录](D:/work/目录/)', streaming), /目录<\/a>/u)
    }
  })
  void test('absolute path targets normalize to host file controls in static and streaming replies', () => {
    for (const [href, path] of [
      ['D:/work/evidence/', 'D:/work/evidence/'],
      ['C:\\work\\report.txt', 'C:/work/report.txt'],
      ['/tmp/报告%20final.txt', '/tmp/报告 final.txt'],
      ['D:/work/报告 #100%.txt', 'D:/work/报告 #100%.txt'],
      ['D:/work/%2520.txt', 'D:/work/%20.txt'],
    ]) {
      const result = resolveMessageMarkdownHrefTarget(href)
      assert.equal(result.kind, 'file', href)
      assert.equal(result.kind === 'file' && result.path, path)
    }
    for (const streaming of [false, true])
      for (const source of [
        '[evidence 目录](D:/Projects/VelarOS-Desktop/workspace/evidence/)',
        '[previews 目录](C:/work/previews/)',
        '[报告](</tmp/报告 final.txt>)',
        '[报告](<D:/work/报告 #100%.txt>)',
      ]) {
        const markup = render(source, streaming)
        assert.match(markup, /href="file:\/\/\//u, source)
        assert.doesNotMatch(markup, /\[blocked\]/u, source)
        assert.doesNotMatch(render(source, streaming, false), /<a\b/u, source)
      }
  })
  void test('unsupported links degrade to their label without leaking a blocked marker', () => {
    for (const streaming of [false, true])
      for (const source of [
        '[普通标签](src/evidence/)',
        '[普通标签](x://host/path)',
        '[普通标签](javascript:alert%281%29)',
        '[普通标签](file://server/share/a)',
      ]) {
        const markup = render(source, streaming)
        assert.doesNotMatch(markup, /\[blocked\]|<a\b/u, source)
        assert.match(markup, /目录|普通标签/u)
      }
  })
  void test('HTML and image filtering still rejects active content and local image sources', () => {
    const markup = render('<script>alert(1)</script>\n\n[bad](javascript:alert(1))\n\n![local](file:///tmp/secret.png)\n\n![local](D:/work/secret.png)\n\n<img src="https://example.com/a.png" onerror="alert(1)" />')
    assert.doesNotMatch(markup, /<script|onerror=|href="javascript:|src="(?:file:|D:)/u)
  })
  void test('streaming links become interactive only when their target is complete', () => {
    for (const source of ['[报告](file:///tmp/report', '[报告](D:/work/report', '[网页](https://example.com'])
      assert.doesNotMatch(render(source, true), /<a\b/u, source)
    assert.match(render('[报告](file:///tmp/report)', true), /<a\b/u)
    assert.match(render('[网页](https://example.com)', true), /<a\b/u)
  })
})
