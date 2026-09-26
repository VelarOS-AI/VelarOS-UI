import { useEffect, useState } from 'react'
import { useMemoizedFn } from 'ahooks'

import type { ComposerSubmenuId } from '../chatInputTypes'
import { OnboardingCloseComposerMenusEventName } from '../composerHostEvents'

/** 新手引导把「+」菜单钉开时，菜单不随点击外部或 Escape 关掉。 */
function isComposerMenuTourLocked(): boolean {
  return document.documentElement.dataset.tourComposerMenuLock === 'primary'
}

export interface UseComposerAddMenuStateResult {
  composerMenuOpen: boolean
  composerSubmenuId: Nullable<ComposerSubmenuId>
  setComposerMenuOpenState: (open: boolean) => void
  closeComposerSubmenus: () => void
  handleComposerActiveSubmenuChange: (submenuId: Nullable<string>) => void
}

export function useComposerAddMenuState(): UseComposerAddMenuStateResult {
  const [composerMenuOpen, setComposerMenuOpen] = useState(false)
  const [composerSubmenuId, setComposerSubmenuId] = useState<Nullable<ComposerSubmenuId>>(null)

  const closeComposerSubmenus = useMemoizedFn((): void => {
    setComposerSubmenuId(null)
  })

  const setComposerMenuOpenState = useMemoizedFn((open: boolean): void => {
    if (!open && isComposerMenuTourLocked()) return
    if (!open) {
      closeComposerSubmenus()
    }
    setComposerMenuOpen(open)
  })

  const handleComposerActiveSubmenuChange = useMemoizedFn((submenuId: Nullable<string>): void => {
    const nextSubmenuId: Nullable<ComposerSubmenuId> =
      submenuId === 'quick-prompts' || submenuId === 'skills' ? submenuId : null

    setComposerSubmenuId(nextSubmenuId)
  })

  useEffect(() => {
    const forceCloseComposerMenus = (): void => {
      setComposerSubmenuId(null)
      setComposerMenuOpen(false)
    }
    window.addEventListener(OnboardingCloseComposerMenusEventName, forceCloseComposerMenus)
    return () =>
      window.removeEventListener(OnboardingCloseComposerMenusEventName, forceCloseComposerMenus)
  }, [])

  return {
    composerMenuOpen,
    composerSubmenuId,
    setComposerMenuOpenState,
    closeComposerSubmenus,
    handleComposerActiveSubmenuChange,
  }
}
