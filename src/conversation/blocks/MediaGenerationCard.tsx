import { type ReactElement, useState } from "react";
import {
  FilmStripIcon,
  WarningCircleIcon,
  WaveformIcon,
} from "@phosphor-icons/react";

import { ImagePreviewDialog } from "@velaros-ai/ui/primitives/overlays/ImagePreviewDialog";

import { useConversationI18n } from "../i18n";
import { useImagePreviewDialogMessages } from "../react-hooks/useImagePreviewDialogMessages";

import styles from "./MediaGenerationCard.module.css";

import type { ContentBlock } from "#contracts";

type MediaBlock = Extract<ContentBlock, { type: "media-generation" }>;
type ReadyMediaBlock = Extract<MediaBlock, { status: "ready" }>;

export const MediaGenerationStatusLabels = {
  image: "chat.generatingImage",
  video: "chat.generatingVideo",
  audio: "chat.generatingAudio",
} as const;

const MediaTitles = {
  image: "chat.generatedImage",
  video: "chat.generatedVideo",
  audio: "chat.generatedAudio",
} as const;

const FragmentKeys = Array.from({ length: 64 }, (_, index) => String(index));

export function MediaGenerationCard({
  block,
}: {
  block: MediaBlock;
}): ReactElement {
  return (
    <div className={styles.card} data-generated-media={block.kind}>
      <MediaGenerationContent block={block} />
    </div>
  );
}

function MediaGenerationContent({ block }: { block: MediaBlock }): ReactElement {
  const { t } = useConversationI18n();

  if (block.status === "ready")
    return (
      <GeneratedMedia
        key={block.src}
        block={block}
        title={t(MediaTitles[block.kind])}
      />
    );

  if (block.status !== "generating") {
    const label =
      block.status === "failed"
        ? "chat.mediaGenerationFailed"
        : "chat.mediaGenerationCancelled";
    return (
      <div className={styles.status} role="status">
        <WarningCircleIcon size={16} aria-hidden="true" />
        {t(label)}
      </div>
    );
  }

  const Icon = block.kind === "audio" ? WaveformIcon : FilmStripIcon;
  return (
    <div
      className={styles.skeleton}
      data-media-kind={block.kind}
      role="status"
      aria-label={t(MediaGenerationStatusLabels[block.kind])}
    >
      {block.kind === "image" ? (
        <span className={styles.fragments} aria-hidden="true">
          {FragmentKeys.map((key) => <span key={key} />)}
        </span>
      ) : (
        <span className={styles.symbol} aria-hidden="true">
          <Icon size={block.kind === "audio" ? 20 : 28} weight="duotone" />
        </span>
      )}
      {block.kind === "audio" && (
        <span className={styles.track} aria-hidden="true" />
      )}
    </div>
  );
}

function GeneratedMedia({
  block,
  title,
}: {
  block: ReadyMediaBlock;
  title: string;
}): ReactElement {
  const { t } = useConversationI18n();
  const previewMessages = useImagePreviewDialogMessages();
  const [isFailed, setFailed] = useState(false);
  const [isPreviewOpen, setPreviewOpen] = useState(false);
  const onError = (): void => setFailed(true);
  if (isFailed)
    return (
      <div className={styles.status} role="status">
        <WarningCircleIcon size={16} aria-hidden="true" />
        {t("chat.generatedMediaUnavailable")}
      </div>
    );

  if (block.kind === "audio")
    return (
      <audio
        className={styles.audio}
        aria-label={title}
        src={block.src}
        controls
        preload="metadata"
        onError={onError}
      />
    );
  if (block.kind === "video")
    return (
      <video
        className={styles.video}
        aria-label={title}
        src={block.src}
        controls
        playsInline
        preload="metadata"
        onError={onError}
      />
    );

  return (
    <>
      <button
        type="button"
        className={styles.imageButton}
        aria-label={t("chat.openImagePreview")}
        onClick={() => setPreviewOpen(true)}
      >
        <img
          className={styles.image}
          src={block.src}
          alt={title}
          onError={onError}
        />
      </button>
      <ImagePreviewDialog
        items={[{ id: block.id, src: block.src, alt: title, title }]}
        openIndex={isPreviewOpen ? 0 : null}
        onOpenIndexChange={(index) => setPreviewOpen(index !== null)}
        messages={previewMessages}
      />
    </>
  );
}
