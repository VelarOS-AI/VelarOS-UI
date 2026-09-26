import {
  ChatDebugTimeline,
  type DisclosureItem,
} from '@catalog/adapters/PreviewAdapters'
import { useI18n } from '@catalog/i18n'
import { CheckCircleIcon, ClockIcon } from '@phosphor-icons/react'
import type { ReactElement } from 'react'

import { Stack } from '@velaros-ai/ui/primitives/layout/Stack'
import { CompactToolRow } from '@velaros-ai/ui/product/layout/CompactToolRow'

const DebugTimestamp = new Date('2026-05-08T19:20:00+08:00').getTime()

export function DebugTimelineExample(): ReactElement {
  const { t } = useI18n()
  const timelineItems: DisclosureItem[] = [
    {
      id: 'context-built',
      timestamp: DebugTimestamp,
      tone: 'success',
      title: t('componentLibrary.exampleDebugContextBuilt'),
      description: t('componentLibrary.exampleDebugContextDescription'),
      content: (
        <CompactToolRow
          icon={<CheckCircleIcon size={14} />}
          label={t('componentLibrary.exampleDebugSystemPrompt')}
          detail={t('componentLibrary.exampleDebugContextSize')}
        />
      ),
    },
    {
      id: 'tool-running',
      timestamp: DebugTimestamp + 18_000,
      tone: 'running',
      title: t('componentLibrary.exampleDebugToolRunning'),
      description: 'bash · bun run scripts:run typecheck:web',
      content: (
        <CompactToolRow
          icon={<ClockIcon size={14} />}
          label={t('componentLibrary.exampleDebugTypecheck')}
          detail={t('chat.workerThreadRunning')}
          tone="running"
        />
      ),
    },
  ]

  return (
    <Stack gap="sm">
      <ChatDebugTimeline items={timelineItems} />
    </Stack>
  )
}
