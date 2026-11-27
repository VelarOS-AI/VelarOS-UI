import { type CSSProperties, type ReactElement, useState } from 'react'
import {
  FilmStripIcon,
  WarningCircleIcon,
  WaveformIcon,
} from '@phosphor-icons/react'

import { ImagePreviewDialog } from '@velaros-ai/ui/primitives/overlays/ImagePreviewDialog'

import { useConversationI18n } from '../i18n'
import { useImagePreviewDialogMessages } from '../react-hooks/useImagePreviewDialogMessages'

import styles from './MediaGenerationCard.module.css'

import type { ContentBlock } from '#contracts'
import { isEmpty, isNull } from '#internal/runtime'

type MediaBlock = Extract<ContentBlock, { type: 'media-generation' }>
type ReadyMediaBlock = Extract<MediaBlock, { status: 'ready' }>

export const MediaGenerationStatusLabels = {
  image: 'chat.generatingImage',
  video: 'chat.generatingVideo',
  audio: 'chat.generatingAudio',
} as const

const MediaTitles = {
  image: 'chat.generatedImage',
  video: 'chat.generatedVideo',
  audio: 'chat.generatedAudio',
} as const

const ImageHandSpread = 32
const ImageHandAngleStep = 9
const SingleCardAngle = -6

export function MediaGenerationGallery({
  blocks,
}: {
  blocks: readonly MediaBlock[]
}): ReactElement {
  const kind = blocks[0]?.kind
  if (kind !== 'image')
    return (
      <div className={styles.stack} data-media-gallery={kind}>
        {blocks.map((block) => (
          <MediaGenerationContent key={block.id} block={block} />
        ))}
      </div>
    )

  const pending = blocks.filter((block) => block.status === 'generating')
  const spread = Math.min(
    ImageHandSpread,
    (pending.length - 1) * ImageHandAngleStep,
  )
  return (
    <div className={styles.imageGallery} data-media-gallery={kind}>
      {blocks
        .filter((block) => block.status === 'ready')
        .map((block) => (
          <GeneratedImage key={`${block.id}:${block.src}`} block={block} />
        ))}
      {!isEmpty(pending) && (
        <div className={styles.hand} data-media-hand="">
          {pending.map((block, index) => (
            <MediaGenerationContent
              key={block.id}
              block={block}
              angle={
                pending.length === 1
                  ? SingleCardAngle
                  : spread * (index / (pending.length - 1) - 0.5)
              }
            />
          ))}
        </div>
      )}
      {blocks
        .filter(
          (block) => block.status === 'failed' || block.status === 'cancelled',
        )
        .map((block) => (
          <MediaGenerationContent key={block.id} block={block} />
        ))}
    </div>
  )
}

function MediaGenerationContent({
  block,
  angle,
}: {
  block: MediaBlock
  angle?: number
}): ReactElement {
  const { t } = useConversationI18n()
  if (block.status === 'ready')
    return <GeneratedMedia key={block.src} block={block} />

  if (block.status !== 'generating')
    return (
      <MediaStatus
        label={t(
          block.status === 'failed'
            ? 'chat.mediaGenerationFailed'
            : 'chat.mediaGenerationCancelled',
        )}
      />
    )

  const Icon = block.kind === 'audio' ? WaveformIcon : FilmStripIcon
  return (
    <div
      className={styles.skeleton}
      data-media-kind={block.kind}
      role="status"
      aria-label={t(MediaGenerationStatusLabels[block.kind])}
      style={block.kind === 'image' ? { rotate: `${angle}deg` } : undefined}
    >
      {block.kind !== 'image' && (
        <span className={styles.symbol} aria-hidden="true">
          <Icon size={block.kind === 'audio' ? 20 : 28} weight="duotone" />
        </span>
      )}
      {block.kind === 'audio' && (
        <span className={styles.track} aria-hidden="true" />
      )}
    </div>
  )
}

function MediaStatus({ label }: { label: string }): ReactElement {
  return (
    <div className={styles.status} role="status">
      <WarningCircleIcon size={16} aria-hidden="true" />
      {label}
    </div>
  )
}

function GeneratedMedia({ block }: { block: ReadyMediaBlock }): ReactElement {
  const { t } = useConversationI18n()
  const [isFailed, setFailed] = useState(false)
  if (isFailed)
    return <MediaStatus label={t('chat.generatedMediaUnavailable')} />

  const title = t(MediaTitles[block.kind])
  const onError = (): void => setFailed(true)
  return block.kind === 'audio' ? (
    <audio
      className={styles.audio}
      aria-label={title}
      src={block.src}
      controls
      preload="metadata"
      onError={onError}
    />
  ) : (
    <video
      className={styles.video}
      aria-label={title}
      src={block.src}
      controls
      playsInline
      preload="metadata"
      onError={onError}
    />
  )
}

function GeneratedImage({ block }: { block: ReadyMediaBlock }): ReactElement {
  const { t } = useConversationI18n()
  const previewMessages = useImagePreviewDialogMessages()
  const [aspectRatio, setAspectRatio] = useState<Nullable<number>>(null)
  const [isFailed, setFailed] = useState(false)
  const [isPreviewOpen, setPreviewOpen] = useState(false)
  if (isFailed)
    return <MediaStatus label={t('chat.generatedMediaUnavailable')} />

  const title = t(MediaTitles.image)
  const size: CSSProperties & { '--image-aspect': number } = {
    '--image-aspect': aspectRatio ?? 1,
  }
  return (
    <>
      <button
        type="button"
        className={styles.imageButton}
        data-image-loaded={!isNull(aspectRatio) || undefined}
        style={size}
        aria-label={t('chat.openImagePreview')}
        onClick={() => setPreviewOpen(true)}
      >
        <img
          className={styles.image}
          src={block.src}
          alt={title}
          onLoad={({ currentTarget }) =>
            setAspectRatio(
              currentTarget.naturalWidth / currentTarget.naturalHeight,
            )
          }
          onError={() => setFailed(true)}
        />
      </button>
      <ImagePreviewDialog
        items={[{ id: block.id, src: block.src, alt: title, title }]}
        openIndex={isPreviewOpen ? 0 : null}
        onOpenIndexChange={(index) => setPreviewOpen(!isNull(index))}
        messages={previewMessages}
      />
    </>
  )
}
