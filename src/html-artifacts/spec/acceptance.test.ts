/**
 * HTML 制品的验收测试：每一条对应 spec/invariants.md 里的一个编号。
 * 只经根入口，只测对外承诺的行为；utils 里的实现细节在 test/ 下补。
 */

import { describe, expect, test } from 'bun:test'

import { HtmlArtifactDefaults, htmlArtifactDocuments } from '../index.js'

describe('沙箱文档', () => {
  test('INV-5 注入脚本里的缺省上限就是常量表里那两个数字', () => {
    const shell = htmlArtifactDocuments.buildShellDocument()
    const document = htmlArtifactDocuments.buildDocument('<main>hi</main>')
    const expected = `)(${HtmlArtifactDefaults.maxReportedHeight},${HtmlArtifactDefaults.maxWidthRatio});`

    expect(shell).toContain(expected)
    expect(document).toContain(expected)
    expect(shell).toContain(`id="${HtmlArtifactDefaults.rootId}"`)
    // 脚本里不再另抄一份：整份文档里出现的这两个数字只来自常量表插值。
    expect(htmlArtifactDocuments.buildShellDocument({ maxReportedHeight: 720 })).toContain(
      `)(720,${HtmlArtifactDefaults.maxWidthRatio});`
    )
  })

  test('INV-8 外链只放行 http / https，主动执行型、相对地址与空串一律给 null', () => {
    for (const url of ['javascript:alert(1)', '/relative', 'data:text/html,<b>x', '']) {
      expect(htmlArtifactDocuments.normalizeExternalUrl(url)).toBeNull()
    }
    expect(htmlArtifactDocuments.normalizeExternalUrl('https://example.com/docs')).toBe(
      'https://example.com/docs'
    )
  })
})
