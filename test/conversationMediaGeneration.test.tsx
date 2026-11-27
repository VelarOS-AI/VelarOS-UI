import assert from "node:assert/strict";
import { test } from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  type ConversationBlockHooks,
  ConversationBlockHooksProvider,
} from "../src/conversation/blocks/conversationBlockHooks";
import { MessageBubble } from "../src/conversation/blocks/MessageBubble";
import type { ChatMessage, ContentBlock } from "../src/conversation/contracts";
import {
  type ConversationI18nContextValue,
  ConversationLocalizationProvider,
} from "../src/conversation/i18n";
import type { ChatInlineNoticeMeta } from "../src/conversation/status/chatStatus";

type MediaBlock = Extract<ContentBlock, { type: "media-generation" }>;

const localization: ConversationI18nContextValue = {
  locale: "en-US",
  setLocale: async () => {},
  t: (key) => key,
};

const blockHooks: ConversationBlockHooks = {
  useAutoTranslateThinkingEnabled: () => false,
  useScriptLiveOutput: () => null,
  useMessageActionView: () => ({
    actionItems: [],
    actionRows: [],
    formatPathForDisplay: (path) => path,
    hasActionItems: false,
    openPathInLight: async () => {},
  }),
};

function render(blocks: MediaBlock[], inlineNotice?: ChatInlineNoticeMeta): string {
  const message: ChatMessage = {
    id: "answer",
    role: "assistant",
    timestamp: 1,
    blocks,
  };
  return renderToStaticMarkup(
    createElement(
      ConversationLocalizationProvider,
      { value: localization },
      createElement(
        ConversationBlockHooksProvider,
        { value: blockHooks },
        createElement(MessageBubble, {
          message,
          sessionId: "media",
          isStreaming: blocks.some((block) => block.status === "generating"),
          inlineNotice,
        }),
      ),
    ),
  );
}

void test("媒体助手消息显示对应的无文案骨架和内联成品", () => {
  for (const [kind, element] of [
    ["image", "img"],
    ["video", "video"],
    ["audio", "audio"],
  ] as const) {
    const pending = render([{
      type: "media-generation",
      id: kind,
      kind,
      status: "generating",
    }]);
    assert.match(pending, new RegExp(`data-media-kind="${  kind  }"`));
    assert.match(pending, /role="status"/u);
    assert.doesNotMatch(pending, new RegExp(`<${  element  }\\b`));
    if (kind === "image") assert.doesNotMatch(pending, /<svg\b/u);

    const ready = render([{
      type: "media-generation",
      id: kind,
      kind,
      status: "ready",
      src: "https://example.test/media",
    }]);
    assert.doesNotMatch(ready, /data-media-kind=/u);
    assert.match(ready, new RegExp(`<${  element  }\\b`));
    if (kind !== "image") assert.match(ready, /controls=""/u);
  }
});

void test("同轮并行成品和占位独立渲染，运行状态显示在占位下方", () => {
  const markup = render([
    { type: "media-generation", id: "first", kind: "image", status: "ready", src: "https://example.test/image.png" },
    { type: "media-generation", id: "second", kind: "image", status: "generating" },
  ], { text: "Preparing", tone: "running" });
  assert.equal(markup.match(/data-generated-media="image"/gu)?.length, 2);
  assert.match(markup, /<img\b[^>]*>.*data-media-kind="image".*>chat\.generatingImage<\/span>/u);
  assert.doesNotMatch(markup, /Preparing/u);
});
