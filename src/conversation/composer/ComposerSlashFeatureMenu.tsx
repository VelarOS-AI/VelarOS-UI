import { FileCodeIcon } from '@phosphor-icons/react'
import type { ReactElement } from 'react'

import { StyleUtils } from '@velaros-ai/ui'
import { Text } from '@velaros-ai/ui/primitives/display/Text'

import { useConversationI18n } from '../i18n'

import type { UseComposerSlashFeatureMenuReturn } from './hooks/useComposerSlashFeatureMenu'

import styles from './ComposerSlashFeatureMenu.module.css'

const cx = StyleUtils.bindCx(styles)

interface ComposerSlashFeatureMenuProps {
  menu: UseComposerSlashFeatureMenuReturn
  header: string
}

/** 聊天输入 / 弹出的已装技能列表（内联在 composer 顶部，随查询过滤）。 */
export function ComposerSlashFeatureMenu({
  menu,
  header,
}: ComposerSlashFeatureMenuProps): Nullable<ReactElement> {
  const { t } = useConversationI18n()

  if (!menu.open) return null

  return (
    <div className={styles.panel} role="listbox" aria-label={header} aria-multiselectable="true">
      <div className={styles.header}>{header}</div>
      <div className={styles.list}>
        {menu.items.map((feature, index) => {
          const highlighted = index === menu.highlightedIndex
          const selected = menu.isItemSelected(feature.id)
          const className = cx('item', highlighted && 'itemHighlighted', selected && 'itemSelected')

          return (
            <button
              key={feature.id}
              type="button"
              role="option"
              aria-selected={selected}
              className={className}
              onMouseDown={(event) => {
                // 防止 textarea 失焦导致选择前菜单状态变化。
                event.preventDefault()
              }}
              onClick={() => menu.selectItem(feature.id)}
            >
              <span className={styles.itemIcon}>
                <FileCodeIcon size={14} weight="fill" />
              </span>
              <span className={styles.itemMain}>
                <span className={styles.itemTitleRow}>
                  <span className={styles.itemTitlePrimary}>
                    <Text className={styles.itemLabel}>{feature.label}</Text>
                    {!!feature.builtIn && (
                      <span className={styles.itemBuiltInBadge}>
                        {t('chat.composerFeatureBuiltInBadge')}
                      </span>
                    )}
                  </span>
                  <span className={styles.itemSlug}>/{feature.id}</span>
                </span>
                {!!feature.description && (
                  <Text className={styles.itemDescription}>{feature.description}</Text>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
