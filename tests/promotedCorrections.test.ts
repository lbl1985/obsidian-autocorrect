import { buildDictionary } from "../main.ts";
import { BUILTIN_DICTIONARY, AMBIGUOUS_WORDS } from "../dictionary";

// ============================================================================
// buildDictionary — promoted corrections
// ============================================================================

describe("buildDictionary — promoted corrections", () => {
  it("includes promoted corrections in the active dictionary", () => {
    const dict = buildDictionary(
      {},
      { mytypo: "myword" },
      []
    );
    expect(dict.get("mytypo")).toBe("myword");
  });

  it("promoted corrections are active even after custom list is cleared", () => {
    // Simulates the "Merge all" flow: customCorrections emptied, promotedCorrections populated
    const dict = buildDictionary(
      {},
      { helo: "hello", wrold: "world" },
      []
    );
    expect(dict.get("helo")).toBe("hello");
    expect(dict.get("wrold")).toBe("world");
  });

  it("promoted corrections can override built-in entries", () => {
    // Pick a built-in entry and override it via promoted
    const builtInKey = Object.keys(BUILTIN_DICTIONARY).find(k => !AMBIGUOUS_WORDS.has(k))!;
    const builtInValue = BUILTIN_DICTIONARY[builtInKey];
    const overrideValue = builtInValue + "_override";

    const dict = buildDictionary({}, { [builtInKey]: overrideValue }, []);
    expect(dict.get(builtInKey)).toBe(overrideValue);
  });

  it("promoted corrections are removed when word is on the ignore list", () => {
    const dict = buildDictionary(
      {},
      { helo: "hello" },
      ["helo"]
    );
    expect(dict.get("helo")).toBeUndefined();
  });

  it("key lookup is case-insensitive for promoted corrections", () => {
    const dict = buildDictionary({}, { MYTYPO: "myword" }, []);
    expect(dict.get("mytypo")).toBe("myword");
  });
});

// ============================================================================
// buildDictionary — interaction between custom and promoted
// ============================================================================

describe("buildDictionary — custom vs promoted interaction", () => {
  it("both custom and promoted corrections are active simultaneously", () => {
    const dict = buildDictionary(
      { typoA: "correctionA" },
      { typoB: "correctionB" },
      []
    );
    expect(dict.get("typoa")).toBe("correctionA");
    expect(dict.get("typob")).toBe("correctionB");
  });

  it("promoted correction wins over custom when keys collide", () => {
    // promoted is applied after custom, so it takes precedence
    const dict = buildDictionary(
      { helo: "helo_custom" },
      { helo: "helo_promoted" },
      []
    );
    expect(dict.get("helo")).toBe("helo_promoted");
  });

  it("ignore list removes both custom and promoted entries", () => {
    const dict = buildDictionary(
      { typoA: "correctionA" },
      { typoB: "correctionB" },
      ["typoa", "typob"]
    );
    expect(dict.get("typoa")).toBeUndefined();
    expect(dict.get("typob")).toBeUndefined();
  });
});

// ============================================================================
// buildDictionary — built-in and ambiguous word behaviour
// ============================================================================

describe("buildDictionary — built-in and ambiguous words", () => {
  it("excludes ambiguous words from the built-in dictionary", () => {
    const dict = buildDictionary({}, {}, []);
    for (const word of AMBIGUOUS_WORDS) {
      // Should not exist unless overridden by custom/promoted
      expect(dict.get(word)).toBeUndefined();
    }
  });

  it("includes non-ambiguous built-in entries", () => {
    const dict = buildDictionary({}, {}, []);
    const safeKey = Object.keys(BUILTIN_DICTIONARY).find(k => !AMBIGUOUS_WORDS.has(k))!;
    expect(dict.get(safeKey)).toBe(BUILTIN_DICTIONARY[safeKey]);
  });

  it("empty custom and promoted with empty ignore list returns full built-in (minus ambiguous)", () => {
    const dict = buildDictionary({}, {}, []);
    const expectedSize = Object.keys(BUILTIN_DICTIONARY).filter(k => !AMBIGUOUS_WORDS.has(k)).length;
    expect(dict.size).toBe(expectedSize);
  });
});
