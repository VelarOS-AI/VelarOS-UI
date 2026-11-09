import React from 'react'
import { createRoot } from 'react-dom/client'

import { ChatInput } from '../../src/conversation/composer/ChatInput'
import { ConversationComposerPortProvider, emptyConversationComposerPort } from '../../src/conversation/composer/conversationComposerPort'
import { ConversationLocalizationProvider } from '../../src/conversation/i18n'

const root = createRoot(document.getElementById('root')!)
const scene = { value: '@sample', disabled: false, acceptsFiles: true, files: [] as File[] }
let selected: string[] = []
let fileChanges = 0
let sends = 0

function Harness(): React.ReactElement {
  return <ConversationLocalizationProvider value={{ locale: 'en-US', setLocale: async () => {}, t: (key) => key }}>
    <ConversationComposerPortProvider value={emptyConversationComposerPort}>
      <ChatInput control={{
        input: { value: scene.value, disabled: scene.disabled, onValueChange: (value) => { scene.value = value; render() }, onSend: () => { sends++ } },
        attachments: { files: scene.files, onFilesChange: scene.acceptsFiles ? (files) => { fileChanges++; scene.files = files; render() } : undefined },
        features: { voiceInput: false, mentionables: {
          available: [{ id: 'first', label: 'sample.ts', body: 'First file' }, { id: 'second', label: 'second-sample.ts', body: 'Second file' }],
          selectedIds: selected,
          onToggleSelected: (id, enabled) => { selected = enabled ? [...selected, id] : selected.filter((item) => item !== id); render() },
          onDelete: () => {},
        } },
      }} />
    </ConversationComposerPortProvider>
  </ConversationLocalizationProvider>
}

function render(): void { root.render(<Harness />) }
async function settle(): Promise<void> {
  for (let index = 0; index < 3; index++) await new Promise(requestAnimationFrame)
}
async function update(next: Partial<typeof scene>): Promise<void> { Object.assign(scene, next); render(); await settle() }
const textarea = (): HTMLTextAreaElement => document.querySelector('textarea')!
const inputRoot = (): HTMLElement => document.querySelector('[data-chat-input-root]')!
const hasOverlay = (): boolean => inputRoot().textContent!.includes('chat.dropFilesHere')
const expect = (condition: boolean, message: string): void => { if (!condition) throw Error(message) }
function keydown(key: string, shiftKey = false): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true })
  textarea().dispatchEvent(event)
  return event
}
function drag(type: string, transfer: DataTransfer): void {
  inputRoot().dispatchEvent(new DragEvent(type, { dataTransfer: transfer, bubbles: true, cancelable: true }))
}

Object.assign(window, {
  async runComposerInteractionRegression(): Promise<string[]> {
    const passed: string[] = []
    render()
    await settle()
    for (const key of ['Enter', 'ArrowDown', 'ArrowUp']) {
      const event = keydown(key, true)
      await settle()
      expect(!event.defaultPrevented, `The mention menu consumed Shift+${key}`)
      expect(scene.value === '@sample' && selected.length === 0 && sends === 0, `Shift+${key} changed the draft or mention selection`)
    }
    keydown('Enter')
    await settle()
    expect(selected.join() === 'first' && scene.value === '' && sends === 0, 'Normal Enter must select the original highlighted mention')
    await update({ value: '@sample' })
    keydown('ArrowDown')
    await settle()
    keydown('Enter')
    await settle()
    expect(selected.join() === 'first,second', 'Normal arrow navigation and Enter must still select a mention')
    passed.push('mention modifiers preserve editing and ordinary navigation still selects')

    const transfer = new DataTransfer()
    transfer.items.add(new File(['attachment'], 'proof.txt', { type: 'text/plain' }))
    drag('dragenter', transfer)
    drag('dragenter', transfer)
    await settle()
    expect(hasOverlay(), 'File drag must show the overlay')
    await update({ disabled: true })
    expect(!hasOverlay(), 'Revoking file admission must release the drag overlay')
    drag('drop', transfer)
    await settle()
    expect(fileChanges === 0 && scene.files.length === 0, 'A disabled drop must not attach files')
    await update({ disabled: false })
    drag('dragenter', transfer)
    await settle()
    drag('dragleave', transfer)
    await settle()
    expect(!hasOverlay(), 'A new drag must start with no depth left from revoked admission')
    passed.push('disabled admission cancels nested drag state and rejects the drop')

    drag('dragenter', transfer)
    await settle()
    await update({ acceptsFiles: false })
    expect(!hasOverlay(), 'Removing the attachment handler must cancel drag state')
    drag('drop', transfer)
    await settle()
    expect(fileChanges === 0, 'A drop without an attachment handler must remain rejected')
    await update({ acceptsFiles: true })
    drag('dragenter', transfer)
    drag('dragenter', transfer)
    drag('dragleave', transfer)
    await settle()
    expect(hasOverlay(), 'Leaving one nested drag target must keep the active drag')
    drag('drop', transfer)
    await settle()
    expect(!hasOverlay() && fileChanges === 1 && scene.files[0].name === 'proof.txt', 'An admitted drop must attach once and release drag state')
    passed.push('handler removal cancels the drag and accepted nested drops still work')
    root.unmount()
    return passed
  },
})
