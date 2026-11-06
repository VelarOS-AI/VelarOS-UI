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
    showFeaturesSubmenu,
    showQuickPromptsSubmenu,
    availableFeatures,
    quickPrompts,
    selectedFeatureIdSet,
    updateSelectedFeature,
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

      {showFeaturesSubmenu && activeSubmenuId === 'features' && (
        <BusinessCascadingSubmenuSection
          menu={menu}
          className={styles.composerFeatureList}
          submenuWidth="var(--chat-input-menu-feature-width)"
          header={t('chat.composerFeatureCount', { count: availableFeatures.length })}
        >
          {availableFeatures.map((feature) => {
            const selected = selectedFeatureIdSet.has(feature.id)

            return (
              <BusinessCascadingMenuItem
                menu={menu}
                key={feature.id}
                className={styles.composerFeatureItem}
                data-feature-item="true"
                selected={selected}
                selectedIndicator={
                  <CheckIcon size={11} weight="bold" className={styles.composerFeatureCheck} />
                }
                title={feature.description || feature.label}
                onClick={() => updateSelectedFeature(feature.id, !selected)}
                disabled={disabled}
              >
                <span className={styles.composerFeatureIcon}>
                  <FileCodeIcon size={13} weight="fill" />
                </span>
                <span className={styles.composerFeatureTitleRow}>
                  <Text className={menu.classes.itemLabel}>{feature.label}</Text>
                  {!!feature.builtIn && (
                    <span className={styles.composerFeatureBuiltInBadge}>
                      {t('chat.composerFeatureBuiltInBadge')}
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
