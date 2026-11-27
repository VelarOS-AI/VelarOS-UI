import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const paneStyles = readFileSync(
  new URL(
    "../src/conversation/shell/ChatConversationPane.module.css",
    import.meta.url,
  ),
  "utf8",
);
const messageStyles = readFileSync(
  new URL(
    "../src/conversation/blocks/MessageBubble.module.css",
    import.meta.url,
  ),
  "utf8",
);
const toolDisclosureStyles = readFileSync(
  new URL(
    "../src/styles/components/product/tool-disclosure-card.css",
    import.meta.url,
  ),
  "utf8",
);

void describe("shared conversation content width", () => {
  void test("uses one column rule for the transcript and composer", () => {
    assert.match(
      paneStyles,
      /\.messageListInner,\s*\.inputDockInner\s*\{[^}]*max-width: var\(--chat-column-max-width\);/u,
    );
    assert.doesNotMatch(
      paneStyles,
      /data-scroll-navigator-hidden/u,
    );
    assert.match(
      paneStyles,
      /\.messageSequence\s*\{\s*@apply flex min-w-0 max-w-full w-full/u,
    );
    assert.match(
      paneStyles,
      /\.streamSlot\s*\{\s*@apply flex w-full min-w-0 max-w-full/u,
    );
  });

  void test("fills that column with prose, rich blocks, and tool cards", () => {
    assert.match(
      messageStyles,
      /\.assistantRow\s*\{[\s\S]*?width: 100%;\s*max-width: 100%;/u,
    );
    assert.match(
      messageStyles,
      /\.textContent\s*\{[\s\S]*?width: 100%;\s*min-width: 0;\s*max-width: 100%;/u,
    );
    assert.match(
      messageStyles,
      /& \[data-streamdown='code-block'\]\s*\{[\s\S]*?width: 100%;\s*min-width: 0;\s*max-width: 100%;/u,
    );
    assert.match(
      messageStyles,
      /& \.expandableCodeBlock\s*\{[\s\S]*?width: 100%;\s*min-width: 0;\s*max-width: 100%;/u,
    );
    assert.match(
      messageStyles,
      /& \[data-streamdown='table-wrapper'\]\s*\{[\s\S]*?width: 100%;\s*min-width: 0;\s*max-width: 100%;/u,
    );
    assert.match(
      messageStyles,
      /\.toolActivityDisclosure\s*\{[\s\S]*?width: 100%;\s*max-width: 100%;/u,
    );
    assert.match(
      toolDisclosureStyles,
      /\.velar-tool-disclosure-card\s*\{[\s\S]*?width: 100%;\s*min-width: 0;\s*max-width: 100%;/u,
    );
  });
});
