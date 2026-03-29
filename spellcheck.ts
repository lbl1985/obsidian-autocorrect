// @ts-ignore – inlined as a string by esbuild text loader (see esbuild.config.mjs)
import aff from "dictionary-en/index.aff";
// @ts-ignore – inlined as a string by esbuild text loader
import dic from "dictionary-en/index.dic";

// Minimal type surface we need from nspell v2
interface NSpellAPI {
  correct(word: string): boolean;
  suggest(word: string): string[];
}

// nspell v2 uses CommonJS export = style; require() is the safest way to load it.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nspell: (dict: { aff: string; dic: string }) => NSpellAPI = require("nspell");

let instance: NSpellAPI | null = null;

export type SpellCheckerInstance = NSpellAPI;

export function initSpellChecker(): SpellCheckerInstance {
  if (!instance) {
    instance = nspell({ aff: aff as unknown as string, dic: dic as unknown as string });
  }
  return instance;
}

// ============================================================================
// Levenshtein distance (used to rank suggestions)
// ============================================================================

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const row: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = row[j];
      row[j] =
        a[i - 1] === b[j - 1]
          ? prev
          : 1 + Math.min(prev, row[j - 1], row[j]);
      prev = temp;
    }
  }
  return row[n];
}

// ============================================================================
// Spell check result
// ============================================================================

export type SpellResult =
  | { kind: "correct" }
  | { kind: "auto"; correction: string }
  | { kind: "ambiguous"; suggestions: string[] }
  | { kind: "unknown" }; // misspelled but nspell has no suggestions

export function checkWord(spell: SpellCheckerInstance, word: string): SpellResult {
  // Accept the word if it or its lowercase form is considered correct
  if (spell.correct(word) || spell.correct(word.toLowerCase())) {
    return { kind: "correct" };
  }

  const raw = spell.suggest(word);
  if (raw.length === 0) return { kind: "unknown" };

  const suggestions = raw.slice(0, 5);
  if (suggestions.length === 1) return { kind: "auto", correction: suggestions[0] };

  // Auto-correct only when the top suggestion is clearly closer than the runner-up
  const w = word.toLowerCase();
  const d0 = levenshtein(w, suggestions[0].toLowerCase());
  const d1 = levenshtein(w, suggestions[1].toLowerCase());
  if (d0 < d1) return { kind: "auto", correction: suggestions[0] };

  return { kind: "ambiguous", suggestions };
}
