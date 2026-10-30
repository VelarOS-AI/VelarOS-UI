import { expect, test } from 'bun:test'

import { formatScriptSource } from '../src/conversation/cards/formatScriptSource'

test('script presentation formats dense code and preserves template literals and execution source', async () => {
  const source = "const literal=`a;b{c}`;if(true){console.log(literal);console.log(2)}"
  const formatted = await formatScriptSource(source)
  expect(formatted.split('\n').length).toBeGreaterThan(3)
  expect(formatted).toContain('`a;b{c}`')
  expect(source).not.toContain('\n')
  expect(await formatScriptSource('const unfinished = {')).toBe('const unfinished = {')
})
