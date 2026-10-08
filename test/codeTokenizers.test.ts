import { describe, expect, test } from "bun:test";

import { tokenizeHtmlArtifactSource } from "../src/conversation/artifacts/htmlArtifactCodeTokenizer";
import {
  type DiffCodeLanguage,
  inferDiffCodeLanguageFromPath,
  tokenizeDiffCodeLine,
} from "../src/conversation/cards/fileChangeDiffHighlight";

describe("conversation code tokenizers", () => {
  test("preserves each diff line exactly across language scanners", () => {
    const samples: Array<[DiffCodeLanguage, string]> = [
      ["javascript", "const value = `hello ${name}`; // comment"],
      ["json", '{"value": -12.5e+2, "ok": true}'],
      ["css", ".card:hover { color: #aabbcc; width: 12.5rem; }"],
      ["markup", '<article data-id="x"><!-- note --></article>'],
      ["shell", 'printf "%s" "$VALUE" && echo done # note'],
      ["python", "async def fetch(x: int = 1_000) -> None: # note"],
    ];

    for (const [language, source] of samples) {
      expect(
        tokenizeDiffCodeLine(source, language)
          .map((token) => token.text)
          .join(""),
      ).toBe(source);
    }
  });

  test("scans adversarial repeated prefixes without regular-expression backtracking", () => {
    const source = `${"<!--".repeat(20_000)}tail`;
    expect(
      tokenizeDiffCodeLine(source, "markup")
        .map((token) => token.text)
        .join(""),
    ).toBe(source);
  });

  test("recognizes Python file names, stubs and Windows paths without guessing unrelated languages", () => {
    for (const path of [
      "src/worker.py",
      "models/types.pyi",
      "C:\\tools\\MAIN.PYW",
      "/app/job.PY?line=3",
    ])
      expect(inferDiffCodeLanguageFromPath(path)).toBe("python");
    expect(inferDiffCodeLanguageFromPath("notes.txt")).toBe("text");
  });

  test("highlights Python definitions, annotations, comments and separate arithmetic tokens", () => {
    const source =
      "async def fetch(value: int = 1_000) -> None: return value-0xFF + 2.5e-3j # note";
    const tokens = tokenizeDiffCodeLine(source, "python");
    expect(tokens.map((token) => token.text).join("")).toBe(source);
    expect(tokens.find((token) => token.text === "def")?.kind).toBe("keyword");
    expect(tokens.find((token) => token.text === "fetch")?.kind).toBe(
      "function",
    );
    expect(tokens.find((token) => token.text === "int")?.kind).toBe("builtin");
    expect(tokens.find((token) => token.text === "None")?.kind).toBe("keyword");
    expect(
      tokens
        .filter((token) => token.kind === "number")
        .map((token) => token.text),
    ).toEqual(["1_000", "0xFF", "2.5e-3j"]);
    expect(tokens.at(-1)).toEqual({ kind: "comment", text: "# note" });
    expect(
      tokenizeDiffCodeLine("class Worker:", "python").find(
        (token) => token.text === "Worker",
      )?.kind,
    ).toBe("type");
  });

  test("keeps prefixed and triple-quoted Python strings intact without consuming an adjacent comment", () => {
    for (const literal of [
      'r"#path"',
      "b'abc'",
      'f"{value} # text"',
      'FR"{name}"',
      '"""Reset the # buffer."""',
      "'''return True'''",
      '"escaped \\" quote"',
    ]) {
      const source = `text = ${literal} # outside`;
      const tokens = tokenizeDiffCodeLine(source, "python");
      expect(tokens.map((token) => token.text).join("")).toBe(source);
      expect(
        tokens.find(
          (token) => token.kind === "string" || token.kind === "bytes",
        )?.text,
      ).toBe(literal);
      expect(tokens.at(-1)).toEqual({ kind: "comment", text: "# outside" });
    }
  });

  test("distinguishes Python builtins, definitions, calls, self and predefined names", () => {
    const source =
      "def build(self): return str(self.value), worker(), self.__class__";
    const tokens = tokenizeDiffCodeLine(source, "python");
    expect(tokens.map((token) => token.text).join("")).toBe(source);
    expect(tokens.find((token) => token.text === "build")?.kind).toBe(
      "function",
    );
    expect(tokens.find((token) => token.text === "str")?.kind).toBe("builtin");
    expect(tokens.find((token) => token.text === "self")?.kind).toBe("self");
    expect(
      tokens.some(
        (token) => token.kind === "function" && token.text.includes("worker"),
      ),
    ).toBe(false);
    expect(tokens.find((token) => token.text === "__class__")?.kind).toBe(
      "predefined",
    );
  });

  test("keeps adjacent JavaScript operators and member access outside number tokens", () => {
    const source = "const values = [1+2, 1-2, 10..toString()]";
    const tokens = tokenizeDiffCodeLine(source, "javascript");

    expect(tokens.map((token) => token.text).join("")).toBe(source);
    expect(
      tokens
        .filter((token) => token.kind === "number")
        .map((token) => token.text),
    ).toEqual(["1", "2", "1", "2", "10."]);
    expect(
      tokens
        .filter((token) => token.kind === "operator")
        .map((token) => token.text),
    ).toEqual(["=", "+", "-"]);
  });

  test("highlights an HTML doctype as a keyword", () => {
    const source = "<!DOCTYPE html>";
    expect(tokenizeDiffCodeLine(source, "markup")).toEqual([
      { kind: "keyword", text: source },
    ]);
  });

  test("keeps complete CSS class and id selectors", () => {
    const source = ".card:hover, #app { color: #aabbcc; }";
    const tokens = tokenizeDiffCodeLine(source, "css");

    expect(tokens.map((token) => token.text).join("")).toBe(source);
    expect(tokens.find((token) => token.text === ".card")?.kind).toBe("tag");
    expect(tokens.find((token) => token.text === "#app")?.kind).toBe("tag");
    expect(tokens.find((token) => token.text === "#aabbcc")?.kind).toBe(
      "number",
    );
  });

  test("keeps markup namespace names intact", () => {
    const source = '<svg:path xlink:href="#id">';
    expect(tokenizeDiffCodeLine(source, "markup")).toEqual([
      { kind: "punctuation", text: "<" },
      { kind: "tag", text: "svg:path" },
      { kind: "plain", text: " " },
      { kind: "attribute", text: "xlink:href" },
      { kind: "punctuation", text: "=" },
      { kind: "string", text: '"#id"' },
      { kind: "punctuation", text: ">" },
    ]);
  });

  test("starts shell comments only at word boundaries", () => {
    const source = "echo https://example.com/a#frag foo#bar # note";
    expect(tokenizeDiffCodeLine(source, "shell")).toEqual([
      { kind: "keyword", text: "echo" },
      { kind: "plain", text: " https://example.com/a#frag foo#bar " },
      { kind: "comment", text: "# note" },
    ]);
  });

  test("preserves HTML, comments, quoted greater-than signs, and embedded code", () => {
    const source =
      '<div title="1 > 0"><!-- note --><script>const x = "<tag>";</script></div>';
    expect(
      tokenizeHtmlArtifactSource(source)
        .map((token) => token.value)
        .join(""),
    ).toBe(source);
  });
});
