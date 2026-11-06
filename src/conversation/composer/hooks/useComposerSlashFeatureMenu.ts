import { useCallback, useEffect, useMemo, useState } from 'react'
import type React from 'react'

import type { ChatInputFeatureOption } from '../chatInputTypes'

import { isEmpty,isNotNull, isNull } from '#internal/runtime'

export const NoSlashFeatureHighlightIndex = -1

/** 输入值是否处于斜杠调用形态：以 / 开头的单行短查询。 */
export function isSlashFeatureQuery(value: string): boolean {
  return value.startsWith('/') && !value.includes('\n') && value.length <= 64
}

function normalizeSlashFeatureSearchText(value: string): string {
  return value.trim().replace(/^\/+/, '').trim().toLowerCase()
}

function normalizeSlashFeatureSlugText(value: string): string {
  return normalizeSlashFeatureSearchText(value).replaceAll(/\s+/gu, '-')
}

/** 按 / 后的查询词过滤技能（右侧 slug/id/名称/描述，不区分大小写）。 */
export function filterSlashFeatureOptions(
  features: readonly ChatInputFeatureOption[],
  query: string
): ChatInputFeatureOption[] {
  const normalized = normalizeSlashFeatureSearchText(query)
  if (!normalized) return [...features]
  const normalizedSlug = normalizeSlashFeatureSlugText(query)

  return features.filter((feature) => {
    const id = feature.id.toLowerCase()
    const slashSlug = `/${id}`
    const searchableText = [id, slashSlug, feature.label, feature.description ?? '']
      .join('\n')
      .toLowerCase()

    return searchableText.includes(normalized) || id.includes(normalizedSlug)
  })
}

export function isSlashFeatureSelected(
  featureId: string,
  selectedFeatureIds: readonly string[]
): boolean {
  return selectedFeatureIds.includes(featureId)
}

export function resolveSlashFeatureToggleSelected(
  featureId: string,
  selectedFeatureIds: readonly string[]
): boolean {
  return !isSlashFeatureSelected(featureId, selectedFeatureIds)
}

export function resolveNextSlashFeatureHighlightIndex(
  currentIndex: number,
  itemCount: number,
  direction: 'down' | 'up'
): number {
  if (itemCount <= 0) return NoSlashFeatureHighlightIndex
  if (currentIndex === NoSlashFeatureHighlightIndex) return direction === 'down' ? 0 : itemCount - 1

  return direction === 'down'
    ? (currentIndex + 1) % itemCount
    : (currentIndex - 1 + itemCount) % itemCount
}

export function resolveSlashFeatureSelectionIndex(
  highlightedIndex: number,
  itemCount: number
): number {
  if (itemCount <= 0) return NoSlashFeatureHighlightIndex
  if (highlightedIndex < 0 || highlightedIndex >= itemCount) return 0
  return highlightedIndex
}

interface UseComposerSlashFeatureMenuInput {
  value: string
  disabled: boolean
  availableFeatures: readonly ChatInputFeatureOption[]
  selectedFeatureIds: readonly string[]
  updateSelectedFeature: (featureId: string, enabled: boolean) => void
}

export interface UseComposerSlashFeatureMenuReturn {
  open: boolean
  items: ChatInputFeatureOption[]
  highlightedIndex: number
  setHighlightedIndex: (index: number) => void
  selectItem: (featureId: string) => void
  isItemSelected: (featureId: string) => boolean
  /** 返回 true 表示按键已被斜杠菜单消费，调用方不要再走发送等默认行为。 */
  handleKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => boolean
}

/**
 * 聊天输入 `/` 斜杠技能菜单（Claude Code 同款交互）：
 * 输入以 `/` 开头即弹出已装技能列表，随查询过滤；↑↓ 移动、Enter/点击选中、Esc 关闭。
 * 选中 = toggle 技能进入/移出 selectedFeatureIds（chips 条显示），输入保留用于继续过滤多选。
 */
export function useComposerSlashFeatureMenu({
  value,
  disabled,
  availableFeatures,
  selectedFeatureIds,
  updateSelectedFeature,
}: UseComposerSlashFeatureMenuInput): UseComposerSlashFeatureMenuReturn {
  const [dismissed, setDismissed] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(NoSlashFeatureHighlightIndex)

  const query = isSlashFeatureQuery(value) ? value.slice(1) : null
  const items = useMemo(
    () => (isNull(query) ? [] : filterSlashFeatureOptions(availableFeatures, query)),
    [availableFeatures, query]
  )
  const open = !disabled && !dismissed && isNotNull(query) && !isEmpty(items)

  // 输入变化时复位：重新打开、重置高亮到第一项。
  useEffect(() => {
    setDismissed(false)
    setHighlightedIndex(NoSlashFeatureHighlightIndex)
  }, [value])

  const selectItem = useCallback(
    (featureId: string): void => {
      updateSelectedFeature(featureId, resolveSlashFeatureToggleSelected(featureId, selectedFeatureIds))
    },
    [selectedFeatureIds, updateSelectedFeature]
  )

  const isItemSelected = useCallback(
    (featureId: string): boolean => isSlashFeatureSelected(featureId, selectedFeatureIds),
    [selectedFeatureIds]
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!open) return false

      // 输入法组合期（拼音候选框开着）**整条键盘链让路**：↑↓ 是 IME 选候选词的键、
      // Esc 是取消组合的键。此前只有 Enter 判了 isComposing，方向键与 Esc 裸 preventDefault，
      // 于是用中文过滤菜单时候选列表动不了、Esc 关不掉组合。判定必须在 switch 之前一次做完，
      // 不能逐 case 补——逐 case 补就是下一个键再漏一次。
      if (event.nativeEvent.isComposing) return false

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          setHighlightedIndex((index) =>
            resolveNextSlashFeatureHighlightIndex(index, items.length, 'down')
          )
          return true
        case 'ArrowUp':
          event.preventDefault()
          setHighlightedIndex((index) =>
            resolveNextSlashFeatureHighlightIndex(index, items.length, 'up')
          )
          return true
        case 'Enter': {
          event.preventDefault()
          const selectionIndex = resolveSlashFeatureSelectionIndex(highlightedIndex, items.length)
          const item = items[selectionIndex]
          if (item) selectItem(item.id)
          return true
        }
        case 'Escape':
          event.preventDefault()
          setDismissed(true)
          return true
        default:
          return false
      }
    },
    [highlightedIndex, items, open, selectItem]
  )

  return {
    open,
    items,
    highlightedIndex,
    setHighlightedIndex,
    selectItem,
    isItemSelected,
    handleKeyDown,
  }
}
