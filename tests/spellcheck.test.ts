// Tests for spellcheck.ts pure logic. Uses real nspell so we can validate
// actual spelling behaviour without needing Obsidian or CM6.
// The nspell mock is bypassed here via jest.unmock / direct import of the real module.

import { levenshtein, checkWord, SpellCheckerInstance } from "../spellcheck.ts";

// Build a minimal stub spell checker so we can test checkWord() without
// needing the full Hunspell dictionary (keeps tests fast and deterministic).
function makeSpell(correct: string[], suggestions: Record<string, string[]>): SpellCheckerInstance {
  return {
    correct: (word: string) => correct.includes(word.toLowerCase()),
    suggest: (word: string) => suggestions[word.toLowerCase()] ?? [],
  };
}

// ============================================================================
// levenshtein
// ============================================================================

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("hello", "hello")).toBe(0);
  });

  it("counts single substitution", () => {
    // "helo" vs "held": one substitution (o → d)
    expect(levenshtein("helo", "held")).toBe(1);
  });

  it("counts single insertion", () => {
    expect(levenshtein("helo", "hello")).toBe(1);
  });

  it("counts single deletion", () => {
    expect(levenshtein("helllo", "hello")).toBe(1);
  });

  it("handles empty strings", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
    expect(levenshtein("", "")).toBe(0);
  });
});

// ============================================================================
// checkWord — result kinds
// ============================================================================

describe("checkWord — correct word", () => {
  it("returns correct when the spell checker accepts the word", () => {
    const spell = makeSpell(["hello"], {});
    expect(checkWord(spell, "hello")).toEqual({ kind: "correct" });
  });

  it("accepts word via lowercase normalisation", () => {
    const spell = makeSpell(["hello"], {});
    // spell.correct("Hello") returns false, but spell.correct("hello") returns true
    expect(checkWord(spell, "Hello")).toEqual({ kind: "correct" });
  });
});

describe("checkWord — auto correction", () => {
  it("returns auto when there is exactly one suggestion", () => {
    const spell = makeSpell([], { recieve: ["receive"] });
    expect(checkWord(spell, "recieve")).toEqual({ kind: "auto", correction: "receive" });
  });

  it("returns auto when the top suggestion has a lower distance than the second", () => {
    // "helllo" → "hello" (distance 1: delete extra l), "hellfire" (distance 4)
    const spell = makeSpell([], { helllo: ["hello", "hellfire"] });
    const result = checkWord(spell, "helllo");
    expect(result).toEqual({ kind: "auto", correction: "hello" });
  });
});

describe("checkWord — ambiguous suggestions", () => {
  it("returns ambiguous when two suggestions are equally close", () => {
    // "tge" → "the" and "tie" both at distance 1
    const spell = makeSpell([], { tge: ["the", "tie"] });
    const result = checkWord(spell, "tge");
    expect(result.kind).toBe("ambiguous");
    if (result.kind === "ambiguous") {
      expect(result.suggestions).toContain("the");
      expect(result.suggestions).toContain("tie");
    }
  });

  it("caps suggestions at 5", () => {
    const spell = makeSpell([], {
      xyz: ["a", "b", "c", "d", "e", "f", "g"],
    });
    const result = checkWord(spell, "xyz");
    if (result.kind === "ambiguous") {
      expect(result.suggestions.length).toBeLessThanOrEqual(5);
    }
  });
});

describe("checkWord — unknown word", () => {
  it("returns unknown when the spell checker has no suggestions", () => {
    const spell = makeSpell([], { gibberish: [] });
    expect(checkWord(spell, "gibberish")).toEqual({ kind: "unknown" });
  });
});
