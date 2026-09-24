import type { ConversationMessageKey as MessageKey } from '../../i18n'
import type { ChatInputGoalModeCopy } from '../ChatInput'
import type {
  ChatInputManualTestPromptOption,
  ChatInputSkillOption,
  ComposerSubmenuId,
} from '../chatInputTypes'
import type { ChatComposerCapabilityControl } from '../ComposerCapabilityControls'

export interface ComposerAddMenuChromeProps {
  disabled: boolean
  t: (key: MessageKey, params?: Record<string, string | number>) => string
  anchorMenuLabel: string
}

export interface ComposerAddMenuMenuProps {
  menuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
  activeSubmenuId: Nullable<ComposerSubmenuId>
  onActiveSubmenuChangeFromCascading: (submenuId: Nullable<string>) => void
  onCloseSubmenus: () => void
}

export interface ComposerAddMenuAttachmentsProps {
  showAddFilesItem: boolean
  onSelectFilesClick: () => void
}

export interface ComposerAddMenuFeaturesProps {
  showSkillsSubmenu: boolean
  showQuickPromptsSubmenu: boolean
  canTogglePlanFeature: boolean
  planModeActive: boolean
  updatePlanMode: (enabled: boolean) => void
  canToggleGoalMode: boolean
  goalModeActive: boolean
  /** 目标模式开关的文案覆盖（外部执行体自报）；不传时用包内的「目标模式」。 */
  goalModeCopy?: ChatInputGoalModeCopy
  updateGoalMode: (enabled: boolean) => void
  availableSkills: ChatInputSkillOption[]
  quickPrompts: ChatInputManualTestPromptOption[]
  selectedSkillIdSet: ReadonlySet<string>
  updateSelectedSkill: (skillId: string, enabled: boolean) => void
  handleSelectQuickPrompt: (option: ChatInputManualTestPromptOption) => void
}

export interface ComposerAddMenuProps {
  chrome: ComposerAddMenuChromeProps
  menu: ComposerAddMenuMenuProps
  attachments: ComposerAddMenuAttachmentsProps
  features: ComposerAddMenuFeaturesProps
  capabilityControls?: readonly ChatComposerCapabilityControl[]
  density?: 'default' | 'compact'
}
