import { ChatsCircleIcon, CheckIcon, FileCodeIcon } from '@phosphor-icons/react'
import type { ReactElement } from 'react'

import { Text } from '@velaros-ai/ui/primitives/display/Text'
import {
  BusinessCascadingMenuItem,
  type BusinessCascadingMenuRenderProps,
  BusinessCascadingSubmenuSection,
} from '@velaros-ai/ui/product/menus/BusinessCascadingMenu'

import type { ConversationMessageKey as MessageKey } from '../../i18n'
import type { ComposerSubmenuId } from '../chatInputTypes'

import type { ComposerAddMenuFeaturesProps } from './composerAddMenu.types'

import styles from '../ChatInput.module.css'

export interface ComposerAddMenuSubmenuSectionsProps {
  menu: BusinessCascadingMenuRenderProps
  disabled: boolean
  t: (key: MessageKey, params?: Record<string, string | number>) => string
  activeSubmenuId: Nullable<ComposerSubmenuId>
  features: ComposerAddMenuFeaturesProps
}

export function ComposerAddMenuSubmenuSections({
  menu,
  disabled,
  t,
  activeSubmenuId,
  features: {
    showSkillsSubmenu,
    showQuickPromptsSubmenu,
    availableSkills,
    quickPrompts,
    selectedSkillIdSet,
    updateSelectedSkill,
    handleSelectQuickPrompt,
  },
}: ComposerAddMenuSubmenuSectionsProps): ReactElement {
  return (
    <>
      {showQuickPromptsSubmenu && activeSubmenuId === 'quick-prompts' && (
        <BusinessCascadingSubmenuSection
          menu={menu}
          submenuWidth="18rem"
          header={t('chat.composerQuickPromptCount', { count: quickPrompts.length })}
        >
          {quickPrompts.map((option) => (
            <BusinessCascadingMenuItem
              menu={menu}
              key={option.id}
              title={option.description || option.title}
              onClick={() => handleSelectQuickPrompt(option)}
              disabled={disabled}
            >
              <span className={menu.classes.icon}>
                <ChatsCircleIcon size={13} weight="fill" />
              </span>
              <Text className={menu.classes.itemLabel}>{option.title}</Text>
            </BusinessCascadingMenuItem>
          ))}
        </BusinessCascadingSubmenuSection>
      )}

      {showSkillsSubmenu && activeSubmenuId === 'skills' && (
        <BusinessCascadingSubmenuSection
          menu={menu}
          className={styles.composerSkillList}
          submenuWidth="var(--chat-input-menu-skill-width)"
          header={t('chat.composerSkillCount', { count: availableSkills.length })}
        >
          {availableSkills.map((skill) => {
            const selected = selectedSkillIdSet.has(skill.id)

            return (
              <BusinessCascadingMenuItem
                menu={menu}
                key={skill.id}
                className={styles.composerSkillItem}
                data-skill-item="true"
                selected={selected}
                selectedIndicator={
                  <CheckIcon size={11} weight="bold" className={styles.composerSkillCheck} />
                }
                title={skill.description || skill.label}
                onClick={() => updateSelectedSkill(skill.id, !selected)}
                disabled={disabled}
              >
                <span className={styles.composerSkillIcon}>
                  <FileCodeIcon size={13} weight="fill" />
                </span>
                <span className={styles.composerSkillTitleRow}>
                  <Text className={menu.classes.itemLabel}>{skill.label}</Text>
                  {!!skill.builtIn && (
                    <span className={styles.composerSkillBuiltInBadge}>
                      {t('chat.composerSkillBuiltInBadge')}
                    </span>
                  )}
                </span>
              </BusinessCascadingMenuItem>
            )
          })}
        </BusinessCascadingSubmenuSection>
      )}
    </>
  )
}
