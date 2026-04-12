import { describe, it, expect, beforeAll } from "vitest";
import { Marp } from "@marp-team/marp-core";
import { SLIDE_INDEX } from "@/content/slideIndex";
import SENSO_THEME_CSS from "@/styles/marp-senso-theme.css?raw";

// Shared Marp instance for all tests (same setup as the component singleton)
let marp: Marp;
beforeAll(() => {
  marp = new Marp({ script: false, math: "katex", emoji: { shortcode: false, unicode: false } });
  marp.themeSet.add(SENSO_THEME_CSS);
});

describe("MARP senso theme registration", () => {
  it("senso theme is available in the theme set", () => {
    const theme = marp.themeSet.get("senso");
    expect(theme).not.toBeNull();
    expect(theme?.name).toBe("senso");
  });
});

describe("MARP slide rendering - all decks", () => {
  const deckEntries = Object.entries(SLIDE_INDEX);

  it.each(deckEntries)("renders deck %s with correct slide count", (_id, raw) => {
    const { html } = marp.render(raw, { htmlAsArray: true } as never);
    const slides = html as string[];

    // Count `---` separators in the raw markdown (excluding front-matter).
    // Front-matter ends at the second `---`; remaining `---` are slide separators.
    const lines = raw.split("\n");
    let fmEnd = -1;
    if (lines[0]?.trim() === "---") {
      for (let i = 1; i < lines.length; i++) {
        if (lines[i]?.trim() === "---") {
          fmEnd = i;
          break;
        }
      }
    }
    const body = fmEnd >= 0 ? lines.slice(fmEnd + 1).join("\n") : raw;
    const separatorCount = (body.match(/^---\s*$/gm) ?? []).length;
    const expectedSlides = separatorCount + 1;

    expect(slides.length).toBe(expectedSlides);
  });

  it.each(deckEntries)("deck %s renders without visible HTML comment text", (_id, raw) => {
    const { html } = marp.render(raw, { htmlAsArray: true } as never);
    const joined = (html as string[]).join("");
    // MARP comments (<!-- _class: lead -->) must be consumed, not rendered as text
    expect(joined).not.toContain("&lt;!--");
    expect(joined).not.toContain("<!-- _");
  });
});

describe("MARP CSS scoping", () => {
  it("generated CSS is scoped to .marpit container", () => {
    const sampleDeck = Object.values(SLIDE_INDEX)[0];
    const { css } = marp.render(sampleDeck);
    // MARP scopes all CSS to its container class
    expect(css).toContain("marpit");
  });

  it("generated CSS does not use senso-light or senso-dark", () => {
    const sampleDeck = Object.values(SLIDE_INDEX)[0];
    const { css } = marp.render(sampleDeck);
    expect(css).not.toContain("senso-light");
    expect(css).not.toContain("senso-dark");
  });
});
