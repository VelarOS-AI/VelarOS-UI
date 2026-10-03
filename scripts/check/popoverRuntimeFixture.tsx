import React, { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AnchoredPopover } from '@velaros-ai/ui/primitives/overlays/AnchoredPopover'
import { Select } from '@velaros-ai/ui/primitives/forms/Select'
import { Dialog, DialogContent, DialogTitle } from '@velaros-ai/ui/primitives/overlays/Dialog'
import { SettingsPanelDialog } from '@velaros-ai/ui/primitives/overlays/SettingsPanelDialog'
import { WorkspaceGitCommitControl } from '@velaros-ai/ui/product/git/WorkspaceGitCommitControl'

declare global {
  interface Window {
    focusEvents: Array<{ visibility: string; rects: number }>
    preventCloseFocus: boolean
    outsideClicks: number
    selectedValues: string[]
  }
}

const providerOptions = [
  { value: 'openrouter', label: 'OpenRouter', description: 'Provider description', help: 'Provider help' },
  { value: 'chatgpt', label: 'ChatGPT' },
  { value: 'disabled', label: 'Unavailable provider', disabled: true },
]

function OverlayProbe(): React.ReactElement {
  const [value, setValue] = useState('openrouter')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const change = (next: string): void => {
    window.selectedValues.push(next)
    setValue(next)
  }
  return <>
    <section style={{ position: 'absolute', left: 40, top: 400 }}>
      <Select id="provider-trigger" value={value} options={providerOptions} onChange={change} />
    </section>
    <section style={{ position: 'absolute', left: 350, top: 400 }}>
      <Select id="search-trigger" searchable value={value} options={providerOptions} onChange={change} />
    </section>
    <button id="outside-action" style={{ position: 'absolute', left: 780, top: 500 }}
      onClick={() => { window.outsideClicks++ }}>Outside action</button>
    <button id="dialog-trigger" style={{ position: 'absolute', left: 40, top: 500 }}
      onClick={() => setDialogOpen(true)}>Dialog</button>
    <button id="settings-trigger" style={{ position: 'absolute', left: 350, top: 500 }}
      onClick={() => setSettingsOpen(true)}>Settings</button>
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent aria-describedby={undefined} showClose={false}>
        <DialogTitle>Modal probe</DialogTitle>
        <Select id="modal-select-trigger" value={value} options={providerOptions} onChange={change} />
        <button id="dialog-close" onClick={() => setDialogOpen(false)}>Close dialog</button>
      </DialogContent>
    </Dialog>
    <SettingsPanelDialog open={settingsOpen} onOpenChange={setSettingsOpen} title="Settings probe">
      <button id="settings-close" onClick={() => setSettingsOpen(false)}>Close settings</button>
    </SettingsPanelDialog>
  </>
}

const messages = {
  branchSearchPlaceholder: 'Search branches', branchCreate: 'New branch', checkoutAction: 'Checkout',
  commitAction: 'Commit', fetchAction: 'Fetch', uploadAction: 'Push', localBranches: 'Local branches',
  remoteBranches: 'Remote branches', createDialogTitle: 'Create branch', createDialogDescription: () => '',
  createBranchPlaceholder: 'Branch name', checkoutCreatedBranch: 'Checkout new branch', cancel: 'Cancel',
  create: 'Create', clean: 'Clean', changedFiles: () => 'Changed',
}
const summary = {
  repository: true, status: { branch: 'main', upstream: 'origin/main', isClean: true, changedFiles: 0 },
  branches: [
    { name: 'main', kind: 'local' as const, current: true },
    { name: 'feature/search', kind: 'local' as const },
    { name: 'origin/main', kind: 'remote' as const },
  ], lineStats: { additions: 0, deletions: 0 },
}

function FocusProbe(): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [nestedOpen, setNestedOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  return <AnchoredPopover open={open} onOpenChange={setOpen} onOpenAutoFocus={() => {
    const target = input.current!
    window.focusEvents.push({ visibility: getComputedStyle(target).visibility, rects: target.getClientRects().length })
    target.focus()
  }} onCloseAutoFocus={(event) => {
    if (window.preventCloseFocus) event.preventDefault()
  }} anchor={({ getAnchorProps }) => <button {...getAnchorProps()} id="focus-trigger">Focus probe</button>}>
    <input id="focus-target" ref={input} />
    <AnchoredPopover open={nestedOpen} onOpenChange={setNestedOpen}
      anchor={({ getAnchorProps }) => <button {...getAnchorProps()} id="nested-trigger">Nested</button>}>
      <input id="nested-target" />
    </AnchoredPopover>
  </AnchoredPopover>
}

export function mount(): void {
  window.focusEvents = []
  window.preventCloseFocus = false
  window.outsideClicks = 0
  window.selectedValues = []
  createRoot(document.getElementById('root')!).render(<>
    <section id="git"><WorkspaceGitCommitControl summary={summary} messages={messages}
      themeColor="#7c3aed" layout="pill" onSwitchBranch={() => undefined} onCreateBranch={() => undefined}
      onUpload={() => undefined} onFetch={() => undefined} onOpenCommit={() => undefined} /></section>
    <section id="focus"><FocusProbe /></section>
    <input id="outside-focus" aria-label="Outside input" />
    <OverlayProbe />
  </>)
}
