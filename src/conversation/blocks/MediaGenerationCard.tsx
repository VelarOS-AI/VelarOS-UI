import { type ReactElement, useState } from "react";
import {
  FilmStripIcon,
  ImageIcon,
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

const MediaPresentation = {
  image: {
    icon: ImageIcon,
    pending: "chat.generatingImage",
    title: "chat.generatedImage",
  },
  video: {
    icon: FilmStripIcon,
    pending: "chat.generatingVideo",
    title: "chat.generatedVideo",
  },
  audio: {
    icon: WaveformIcon,
    pending: "chat.generatingAudio",
    title: "chat.generatedAudio",
  },
} as const;

export function MediaGenerationCard({
  block,
}: {
  block: MediaBlock;
}): ReactElement {
  const { t } = useConversationI18n();
  const presentation = MediaPresentation[block.kind];
  const Icon = presentation.icon;

  if (block.status === "ready")
    return (
      <GeneratedMedia
        key={block.src}
        block={block}
        title={t(presentation.title)}
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

  return (
    <div
      className={styles.skeleton}
      data-media-kind={block.kind}
      role="status"
      aria-label={t(presentation.pending)}
    >
      <span className={styles.symbol} aria-hidden="true">
        <Icon size={block.kind === "audio" ? 20 : 28} weight="duotone" />
      </span>
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
