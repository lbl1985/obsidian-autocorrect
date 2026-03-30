import { cycleSpellIndex, reduceSpellNavState, SpellNavState } from "../main.ts";

const BASE: SpellNavState = {
  wordStart: 10,
  wordEnd: 15,
  originalWord: "tge",
  suggestions: ["the", "tie", "tee"],
  selectedIndex: 0,
};

// ============================================================================
// cycleSpellIndex
// ============================================================================

describe("cycleSpellIndex", () => {
  it("advances to the next index", () => {
    expect(cycleSpellIndex(0, 3)).toBe(1);
    expect(cycleSpellIndex(1, 3)).toBe(2);
  });

  it("wraps around at the end", () => {
    expect(cycleSpellIndex(2, 3)).toBe(0);
  });

  it("wraps immediately with a single suggestion", () => {
    expect(cycleSpellIndex(0, 1)).toBe(0);
  });
});

// ============================================================================
// reduceSpellNavState — open
// ============================================================================

describe("reduceSpellNavState — open", () => {
  it("creates state with selectedIndex 0 when opening from null", () => {
    const next = reduceSpellNavState(null, {
      type: "open",
      wordStart: 5,
      wordEnd: 10,
      originalWord: "helo",
      suggestions: ["hello", "help"],
    });
    expect(next).toEqual({
      wordStart: 5,
      wordEnd: 10,
      originalWord: "helo",
      suggestions: ["hello", "help"],
      selectedIndex: 0,
    });
  });

  it("resets selectedIndex to 0 when opening over an existing state", () => {
    const existing: SpellNavState = { ...BASE, selectedIndex: 2 };
    const next = reduceSpellNavState(existing, {
      type: "open",
      wordStart: 20,
      wordEnd: 25,
      originalWord: "xyz",
      suggestions: ["xylophone"],
    });
    expect(next?.selectedIndex).toBe(0);
    expect(next?.originalWord).toBe("xyz");
  });
});

// ============================================================================
// reduceSpellNavState — setIndex
// ============================================================================

describe("reduceSpellNavState — setIndex", () => {
  it("updates selectedIndex", () => {
    const next = reduceSpellNavState(BASE, { type: "setIndex", index: 2 });
    expect(next?.selectedIndex).toBe(2);
  });

  it("preserves all other fields when updating index", () => {
    const next = reduceSpellNavState(BASE, { type: "setIndex", index: 1 });
    expect(next?.wordStart).toBe(BASE.wordStart);
    expect(next?.wordEnd).toBe(BASE.wordEnd);
    expect(next?.originalWord).toBe(BASE.originalWord);
    expect(next?.suggestions).toEqual(BASE.suggestions);
  });

  it("returns null when there is no current state", () => {
    const next = reduceSpellNavState(null, { type: "setIndex", index: 1 });
    expect(next).toBeNull();
  });
});

// ============================================================================
// reduceSpellNavState — close and docChanged
// ============================================================================

describe("reduceSpellNavState — dismissal", () => {
  it("returns null on close", () => {
    expect(reduceSpellNavState(BASE, { type: "close" })).toBeNull();
  });

  it("returns null on close from null state", () => {
    expect(reduceSpellNavState(null, { type: "close" })).toBeNull();
  });

  it("returns null on docChanged", () => {
    expect(reduceSpellNavState(BASE, { type: "docChanged" })).toBeNull();
  });

  it("returns null on docChanged from null state", () => {
    expect(reduceSpellNavState(null, { type: "docChanged" })).toBeNull();
  });
});

// ============================================================================
// Full Tab-cycle scenario
// ============================================================================

describe("Tab-cycle scenario", () => {
  it("cycles through all suggestions and wraps back to the first", () => {
    let state: SpellNavState | null = reduceSpellNavState(null, {
      type: "open",
      ...BASE,
    });
    expect(state?.selectedIndex).toBe(0);

    state = reduceSpellNavState(state, {
      type: "setIndex",
      index: cycleSpellIndex(state!.selectedIndex, state!.suggestions.length),
    });
    expect(state?.selectedIndex).toBe(1);

    state = reduceSpellNavState(state, {
      type: "setIndex",
      index: cycleSpellIndex(state!.selectedIndex, state!.suggestions.length),
    });
    expect(state?.selectedIndex).toBe(2);

    // Wrap around
    state = reduceSpellNavState(state, {
      type: "setIndex",
      index: cycleSpellIndex(state!.selectedIndex, state!.suggestions.length),
    });
    expect(state?.selectedIndex).toBe(0);
  });

  it("dismisses on Esc at any point in the cycle", () => {
    let state: SpellNavState | null = reduceSpellNavState(null, { type: "open", ...BASE });
    state = reduceSpellNavState(state, {
      type: "setIndex",
      index: cycleSpellIndex(state!.selectedIndex, state!.suggestions.length),
    });
    expect(state?.selectedIndex).toBe(1);

    state = reduceSpellNavState(state, { type: "close" });
    expect(state).toBeNull();
  });

  it("dismisses when the document changes mid-cycle", () => {
    let state: SpellNavState | null = reduceSpellNavState(null, { type: "open", ...BASE });
    state = reduceSpellNavState(state, {
      type: "setIndex",
      index: cycleSpellIndex(state!.selectedIndex, state!.suggestions.length),
    });
    state = reduceSpellNavState(state, { type: "docChanged" });
    expect(state).toBeNull();
  });
});
