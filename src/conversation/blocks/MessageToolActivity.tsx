import {
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  useEffect,
  useId,
  useState,
} from "react";
import { CaretRightIcon, WrenchIcon } from "@phosphor-icons/react";

import { StyleUtils } from "@velaros-ai/ui";

import { useConversationI18n, useConversationTranslatorRuntime } from "../i18n";
import { useConversationScrollFollow } from "../react-hooks/conversationScrollFollow";
import { AutoScrollSuspendEventName } from "../react-hooks/scrollBehavior";
import { useDisclosurePresence } from "../react-hooks/useDisclosurePresence";
import { useTimerScope } from "../react-hooks/useTimerScope";

import { getToolActivityDisclosureSummary } from "./toolActivityDisclosurePresentation";

import styles from "./MessageBubble.module.css";

import type { ConversationStepBlock } from "#contracts";
import { isEmpty, isFunction } from "#internal/runtime";

const cx = StyleUtils.bindCx(styles);
const EmptyToolActivityBlocks: ConversationStepBlock[] = [];

export function shouldInitiallyExpandToolActivityDisclosure({
  autoCollapseAfterPaint,
  defaultExpanded,
  hasRunningTool,
}: {
  autoCollapseAfterPaint: boolean;
  defaultExpanded: boolean;
  hasRunningTool: boolean;
}): boolean {
  return defaultExpanded || (autoCollapseAfterPaint && !hasRunningTool);
}

export function ToolActivityDisclosure({
  blocks,
  children,
  autoCollapseAfterPaint = false,
  defaultExpanded = false,
  isRunning,
  label,
  formatPathForDisplay,
}: {
  blocks?: ConversationStepBlock[];
  /** 传函数时只在展开期间渲染：收着的折叠不必先把里面的卡全画一遍。 */
  children: ReactNode | (() => ReactNode);
  autoCollapseAfterPaint?: boolean;
  defaultExpanded?: boolean;
  isRunning?: boolean;
  label?: string;
  formatPathForDisplay?: (path: string) => string;
}): ReactElement {
  const { t, locale } = useConversationI18n();
  const translator = useConversationTranslatorRuntime();
  const bodyId = useId();
  const activityBlocks = blocks ?? EmptyToolActivityBlocks;
  const summary = getToolActivityDisclosureSummary(
    activityBlocks,
    locale,
    translator,
    formatPathForDisplay,
  );
  const hasRunningTool = isRunning ?? summary.isRunning;
  const shouldAutoCollapseAfterPaint =
    autoCollapseAfterPaint && !hasRunningTool;
  // 完成信号可能在容器已经挂载后到达。信号保持实时，先呈现展开态，再在浏览器绘制后
  // 切到折叠态，使原地完成和新容器挂载都能执行同一条自动收起路径。
  const shouldInitiallyExpand = shouldInitiallyExpandToolActivityDisclosure({
    autoCollapseAfterPaint: shouldAutoCollapseAfterPaint,
    defaultExpanded,
    hasRunningTool,
  });
  // 工具与脚本默认收起；进度更新只改摘要，用户点击独占展开状态。
  // 整轮完成容器仍可显式请求绘制后收起。
  const [expanded, setExpanded] = useState(shouldInitiallyExpand);
  const timers = useTimerScope("ToolActivityDisclosure");
  const scrollFollow = useConversationScrollFollow();
  const { mounted: isMounted, visible: isVisible } =
    useDisclosurePresence(expanded);
  const displayLabel =
    label || (isEmpty(activityBlocks) ? t("chat.toolCalls") : summary.label);

  useEffect(() => {
    if (!shouldAutoCollapseAfterPaint) return;

    let collapseFrame: ReturnType<typeof timers.nextFrame> | undefined;
    const paintedExpandedFrame = timers.nextFrame(
      () => {
        collapseFrame = timers.nextFrame(
          () => {
            collapseFrame = undefined;
            // 读者已上滑解除跟随：他可能正读着这组内容，收起会把视口里的节点整段抽走。
            // 保持展开，收不收由他自己点。
            if (!scrollFollow.isFollowingBottom()) return;
            setExpanded(false);
          },
          { label: "collapse processed tool activity" },
        );
      },
      { label: "paint expanded processed tool activity" },
    );

    return () => {
      paintedExpandedFrame.cancel();
      collapseFrame?.cancel();
    };
  }, [scrollFollow, shouldAutoCollapseAfterPaint, timers]);

  const handleToggleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    event.currentTarget.dispatchEvent(
      new Event(AutoScrollSuspendEventName, { bubbles: true }),
    );
    setExpanded((current) => !current);
  };

  return (
    <div
      className={styles.toolActivityDisclosure}
      data-slot="tool-activity-disclosure"
    >
      <button
        type="button"
        className={cx(
          "toolActivityToggle",
          hasRunningTool && "toolActivityToggleRunning",
        )}
        aria-expanded={expanded}
        aria-controls={bodyId}
        title={displayLabel}
        onClick={handleToggleClick}
      >
        {hasRunningTool && (
          <span className={styles.runningStatusDot} aria-hidden="true" />
        )}
        {!hasRunningTool && !label && (
          <WrenchIcon size={14} aria-hidden="true" />
        )}
        <span className={styles.toolActivityLabel}>{displayLabel}</span>
        <CaretRightIcon
          size={14}
          weight="bold"
          className={cx(
            "toolActivityChevron",
            expanded && "toolActivityChevronExpanded",
          )}
          aria-hidden="true"
        />
      </button>
      {isMounted && (
        <div
          className={cx(
            "toolActivityBodyShell",
            expanded && isVisible && "toolActivityBodyShellExpanded",
          )}
          id={bodyId}
          aria-hidden={!isVisible}
          inert={!isVisible}
        >
          <div className={styles.toolActivityBodyFrame}>
            <div className={styles.toolActivityBody}>
              {isFunction(children)
                ? (children as () => ReactNode)()
                : children}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
