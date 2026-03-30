# Changelog

All notable changes to Obsidian Autocorrect are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.1] - 2026-03-30

### Added

- **Spell check suggestions** — When a typed word is not found in the curated
  dictionary, an optional Hunspell-based spell checker (nspell + English
  dictionary) now kicks in:
  - High-confidence match (one suggestion, or top suggestion clearly closer
    than the runner-up by edit distance) → silently auto-corrected.
  - Ambiguous matches → inline tooltip at the word with clickable suggestion
    buttons; auto-dismissed on the next keystroke, or manually via `×`.
  - New setting toggle **"Enable spell check suggestions"** (default **off**,
    opt-in — existing behaviour is fully preserved).

- **Promoted corrections** — Custom corrections can now be merged into the
  built-in list to keep the settings UI clean when the custom list grows large:
  - **↑** button on each row promotes a single entry.
  - **Merge all** button promotes the entire custom list at once.
  - **Reset all** button in Dictionary Info moves promoted entries back to
    the custom list.
  - Promoted corrections are active in autocorrect but hidden from the custom
    corrections section.

- **Separate dictionary file** — `BUILTIN_DICTIONARY` and `AMBIGUOUS_WORDS`
  moved from `main.ts` into `dictionary.ts` for easier management.

- **Test suite** — Jest + ts-jest infrastructure added (`npm run test`):
  - `tests/promotedCorrections.test.ts` — 11 tests for promoted corrections
    and `buildDictionary()` behaviour.
  - `tests/settingsMigration.test.ts` — 7 tests verifying that existing user
    data (customCorrections, ignoreList, promotedCorrections) is never lost
    across plugin upgrades.
  - `tests/spellcheck.test.ts` — 12 tests for `levenshtein()` and
    `checkWord()` covering all result kinds (correct, auto, ambiguous,
    unknown).

### Changed

- `buildDictionary()` extracted as a pure exported function; plugin's
  `rebuildDictionary()` delegates to it (enables unit testing without Obsidian
  runtime).
- `DEFAULT_SETTINGS` exported so migration logic can be tested in isolation.

---

## [1.0.0] - 2026-03-28

### Added

- Initial release.
- 450+ built-in corrections across common typos, keyboard transpositions,
  tech terms, work-context words, and doubled-letter mistakes.
- Custom corrections — add your own misspelling → correction pairs.
- Ignore list — words that are never auto-corrected.
- Smart exclusion zones — skips code blocks, inline code, frontmatter, and
  wiki-links.
- Case preservation — corrected words match the capitalisation of the
  original (lowercase, Title Case, UPPER CASE).
- Toggle command (`Toggle autocorrect on/off`) available in the command
  palette.
- Settings tab with Dictionary Info stats.
