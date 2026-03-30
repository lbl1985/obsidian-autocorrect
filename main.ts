import { Plugin, PluginSettingTab, App, Setting, Notice } from "obsidian";
import { EditorView, ViewUpdate, Decoration, DecorationSet, Tooltip, showTooltip, tooltips, keymap } from "@codemirror/view";
import { StateField, StateEffect, Transaction, Annotation, Extension, RangeSetBuilder, Prec } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { BUILTIN_DICTIONARY, AMBIGUOUS_WORDS } from "./dictionary";
import { initSpellChecker, checkWord, SpellCheckerInstance } from "./spellcheck";


// ============================================================================
// Case preservation
// ============================================================================

function preserveCase(original: string, correction: string): string {
  if (original === original.toUpperCase() && original.length > 1) {
    return correction.toUpperCase();
  }
  if (original[0] === original[0].toUpperCase() && original.slice(1) === original.slice(1).toLowerCase()) {
    return correction.charAt(0).toUpperCase() + correction.slice(1);
  }
  return correction;
}

// ============================================================================
// Context detection — skip corrections inside code, YAML, links, URLs
// ============================================================================

function isInExclusionZone(state: any, from: number, to: number): boolean {
  // Check syntax tree for code blocks, inline code, URLs
  try {
    const tree = syntaxTree(state);
    let excluded = false;
    tree.iterate({
      from, to,
      enter(node: any) {
        const name = node.type.name;
        if (/code|Code|FencedCode|CodeBlock|InlineCode|CodeText|CodeMark|HyperLink|URL|Link|HTMLTag/i.test(name)) {
          excluded = true;
          return false;
        }
      }
    });
    if (excluded) return true;
  } catch (e) {
    // If syntax tree is not available, fall through to regex checks
  }

  // Check YAML frontmatter
  const docText = state.doc.toString();
  if (docText.startsWith("---\n") || docText.startsWith("---\r\n")) {
    const endIdx = docText.indexOf("\n---", 3);
    if (endIdx !== -1 && from < endIdx + 4) {
      return true;
    }
  }

  // Check wiki-links [[ ... ]]
  const line = state.doc.lineAt(from);
  const lineText = line.text;
  const posInLine = from - line.from;
  let depth = 0;
  for (let i = 0; i < lineText.length; i++) {
    if (lineText[i] === '[' && lineText[i + 1] === '[') {
      depth++;
      i++;
    } else if (lineText[i] === ']' && lineText[i + 1] === ']') {
      depth--;
      i++;
    }
    if (i >= posInLine && depth > 0) return true;
  }

  // Check if inside a URL pattern
  const lineBeforePos = lineText.substring(0, posInLine);
  if (/https?:\/\/\S*$/.test(lineBeforePos)) return true;

  // Check if inside inline code backticks
  const backtickCount = (lineText.substring(0, posInLine).match(/`/g) || []).length;
  if (backtickCount % 2 === 1) return true;

  return false;
}

// ============================================================================
// Settings
// ============================================================================

interface AutocorrectSettings {
  enabled: boolean;
  enableSpellCheck: boolean;
  customCorrections: Record<string, string>;
  promotedCorrections: Record<string, string>;
  ignoreList: string[];
}

export const DEFAULT_SETTINGS: AutocorrectSettings = {
  enabled: true,
  enableSpellCheck: false,
  customCorrections: {},
  promotedCorrections: {},
  ignoreList: [],
};

// ============================================================================
// Spell-check suggestion tooltip with keyboard navigation
// ============================================================================

/** Pure navigation state — no CM6 types, easy to unit-test. */
export interface SpellNavState {
  wordStart: number;
  wordEnd: number;
  originalWord: string;
  suggestions: string[];
  selectedIndex: number;
}

export type SpellNavEvent =
  | { type: "open"; wordStart: number; wordEnd: number; originalWord: string; suggestions: string[] }
  | { type: "setIndex"; index: number }
  | { type: "close" }
  | { type: "docChanged" };

export function cycleSpellIndex(current: number, total: number): number {
  return (current + 1) % total;
}

export function reduceSpellNavState(
  state: SpellNavState | null,
  event: SpellNavEvent
): SpellNavState | null {
  switch (event.type) {
    case "docChanged":
    case "close":
      return null;
    case "open":
      return {
        wordStart: event.wordStart,
        wordEnd: event.wordEnd,
        originalWord: event.originalWord,
        suggestions: event.suggestions,
        selectedIndex: 0,
      };
    case "setIndex":
      if (!state) return null;
      return { ...state, selectedIndex: event.index };
  }
}

interface SpellTooltipState extends SpellNavState {
  tooltip: Tooltip;
}

const setSpellTooltipEffect = StateEffect.define<Omit<SpellTooltipState, "tooltip" | "selectedIndex"> | null>();
const setSpellIndexEffect = StateEffect.define<number>();

// Forward declaration: assigned after buildTooltip, referenced inside its update callback.
let spellStateField!: StateField<SpellTooltipState | null>;

function buildTooltip(meta: Omit<SpellTooltipState, "tooltip" | "selectedIndex">): Tooltip {
  return {
    pos: meta.wordStart,
    above: true,
    strictSide: false,
    arrow: false,
    create(view: EditorView) {
      const dom = document.createElement("div");
      dom.className = "autocorrect-spell-tooltip";

      const buttons: HTMLButtonElement[] = [];
      for (const suggestion of meta.suggestions) {
        const btn = document.createElement("button");
        btn.textContent = suggestion;
        btn.className = "autocorrect-spell-btn";
        btn.addEventListener("mousedown", (e) => {
          e.preventDefault();
          view.dispatch({
            changes: { from: meta.wordStart, to: meta.wordEnd, insert: preserveCase(meta.originalWord, suggestion) },
            annotations: [autocorrectAnnotation.of(true), Transaction.addToHistory.of(true)],
          });
        });
        dom.appendChild(btn);
        buttons.push(btn);
      }

      const dismiss = document.createElement("button");
      dismiss.textContent = "×";
      dismiss.className = "autocorrect-spell-dismiss";
      dismiss.title = "Dismiss (Esc)";
      dismiss.addEventListener("mousedown", (e) => {
        e.preventDefault();
        view.dispatch({ effects: setSpellTooltipEffect.of(null) });
      });
      dom.appendChild(dismiss);

      const hint = document.createElement("span");
      hint.className = "autocorrect-spell-hint";
      hint.textContent = "Tab · Enter · Esc";
      dom.appendChild(hint);

      // Highlight the initial selection
      if (buttons.length > 0) buttons[0].classList.add("autocorrect-spell-btn-selected");

      return {
        dom,
        update(viewUpdate: ViewUpdate) {
          const s = viewUpdate.state.field(spellStateField);
          if (!s) return;
          buttons.forEach((btn, i) => {
            btn.classList.toggle("autocorrect-spell-btn-selected", i === s.selectedIndex);
          });
        },
      };
    },
  };
}

spellStateField = StateField.define<SpellTooltipState | null>({
  create: () => null,
  update(state, tr) {
    for (const e of tr.effects) {
      if (e.is(setSpellTooltipEffect)) {
        const nav = reduceSpellNavState(state, e.value ? { type: "open", ...e.value } : { type: "close" });
        if (!nav) return null;
        return { ...nav, tooltip: buildTooltip(e.value!) };
      }
      if (e.is(setSpellIndexEffect) && state) {
        const nav = reduceSpellNavState(state, { type: "setIndex", index: e.value });
        return nav ? { ...nav, tooltip: state.tooltip } : null;
      }
    }
    if (tr.docChanged) return reduceSpellNavState(state, { type: "docChanged" }) as null;
    return state;
  },
  provide: (f) => showTooltip.from(f, (s) => (s ? s.tooltip : null)),
});

const spellTooltipKeymap = keymap.of([
  {
    key: "Tab",
    run(view: EditorView): boolean {
      const s = view.state.field(spellStateField);
      if (!s) return false;
      const nextIndex = (s.selectedIndex + 1) % s.suggestions.length;
      view.dispatch({ effects: setSpellIndexEffect.of(nextIndex) });
      return true;
    },
  },
  {
    key: "Enter",
    run(view: EditorView): boolean {
      const s = view.state.field(spellStateField);
      if (!s) return false;
      const suggestion = s.suggestions[s.selectedIndex];
      view.dispatch({
        changes: { from: s.wordStart, to: s.wordEnd, insert: preserveCase(s.originalWord, suggestion) },
        annotations: [autocorrectAnnotation.of(true), Transaction.addToHistory.of(true)],
      });
      return true;
    },
  },
  {
    key: "Escape",
    run(view: EditorView): boolean {
      const s = view.state.field(spellStateField);
      if (!s) return false;
      view.dispatch({ effects: setSpellTooltipEffect.of(null) });
      return true;
    },
  },
]);

// ============================================================================
// Autocorrect CM6 Extension
// ============================================================================

const autocorrectAnnotation = Annotation.define<boolean>();

function createAutocorrectExtension(
  getSettings: () => AutocorrectSettings,
  getDictionary: () => Map<string, string>,
  getSpellChecker: () => SpellCheckerInstance | null
): Extension {
  return EditorView.updateListener.of((update: ViewUpdate) => {
    if (!getSettings().enabled) return;
    if (!update.docChanged) return;

    // Skip if this transaction was our own correction
    for (const tr of update.transactions) {
      if (tr.annotation(autocorrectAnnotation)) return;
      // Skip IME composition
      if (tr.isUserEvent("input.type.compose")) return;
    }

    const changes: Array<{ from: number; to: number; insert: string }> = [];
    type SpellCandidate = { wordStart: number; wordEnd: number; originalWord: string; suggestions: string[] };
    const spellCandidates: SpellCandidate[] = [];

    update.changes.iterChanges((fromA: number, toA: number, fromB: number, toB: number, inserted: any) => {
      const insertedText = inserted.toString();

      // Only trigger on word boundary characters
      if (!/^[\s.,;:!?\-)\]}>\/\n\r]$/.test(insertedText)) return;

      const doc = update.state.doc;
      const boundaryPos = fromB;

      // Find the word before the boundary
      const line = doc.lineAt(boundaryPos);
      const lineText = line.text;
      const posInLine = boundaryPos - line.from;

      let i = posInLine - 1;
      while (i >= 0 && /[a-zA-Z']/.test(lineText[i])) {
        i--;
      }
      const wordStartInLine = i + 1;
      const wordStart = line.from + wordStartInLine;
      const wordEnd = boundaryPos;

      if (wordStart >= wordEnd) return;

      const word = doc.sliceString(wordStart, wordEnd);
      if (word.length < 2) return;

      // Skip if word contains only apostrophes or is just punctuation
      if (!/[a-zA-Z]/.test(word)) return;

      // Check exclusion zones
      if (isInExclusionZone(update.state, wordStart, wordEnd)) return;

      // Check ignore list
      const settings = getSettings();
      if (settings.ignoreList.some(w => w.toLowerCase() === word.toLowerCase())) return;

      // 1. Look up in the curated dictionary first
      const dictionary = getDictionary();
      const correction = dictionary.get(word.toLowerCase());
      if (correction) {
        const corrected = preserveCase(word, correction);
        if (corrected !== word) changes.push({ from: wordStart, to: wordEnd, insert: corrected });
        return;
      }

      // 2. Fall back to spell checker (when enabled)
      if (!settings.enableSpellCheck) return;
      const spell = getSpellChecker();
      if (!spell) return;

      const result = checkWord(spell, word);
      if (result.kind === "auto") {
        const corrected = preserveCase(word, result.correction);
        if (corrected !== word) changes.push({ from: wordStart, to: wordEnd, insert: corrected });
      } else if (result.kind === "ambiguous") {
        spellCandidates.push({ wordStart, wordEnd, originalWord: word, suggestions: result.suggestions });
      }
    });

    if (changes.length > 0) {
      // Apply all corrections in one transaction; skip tooltip if there were auto-corrections
      update.view.dispatch({
        changes: changes,
        annotations: [
          autocorrectAnnotation.of(true),
          Transaction.addToHistory.of(true),
        ],
      });
      return;
    }

    // Show suggestion tooltip for the first ambiguous spell-check word
    if (spellCandidates.length > 0) {
      const { wordStart, wordEnd, originalWord, suggestions } = spellCandidates[0];
      update.view.dispatch({
        effects: setSpellTooltipEffect.of({ wordStart, wordEnd, originalWord, suggestions }),
      });
    }
  });
}

// ============================================================================
// Settings Tab
// ============================================================================

class AutocorrectSettingTab extends PluginSettingTab {
  plugin: AutocorrectPlugin;

  constructor(app: App, plugin: AutocorrectPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Autocorrect Settings" });

    new Setting(containerEl)
      .setName("Enable autocorrect")
      .setDesc("Automatically correct common misspellings as you type.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enabled)
          .onChange(async (value) => {
            this.plugin.settings.enabled = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Enable spell check suggestions")
      .setDesc(
        "When a word is not in the built-in dictionary, use a spell checker to suggest corrections. " +
        "High-confidence matches are corrected automatically; ambiguous ones show an inline popup."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableSpellCheck)
          .onChange(async (value) => {
            this.plugin.settings.enableSpellCheck = value;
            if (value && !this.plugin.spellChecker) {
              this.plugin.spellChecker = initSpellChecker();
            }
            await this.plugin.saveSettings();
          })
      );

    // Custom corrections section
    containerEl.createEl("h3", { text: "Custom Corrections" });
    containerEl.createEl("p", {
      text: "Add your own misspelling → correction pairs. These are added on top of the built-in dictionary.",
      cls: "setting-item-description",
    });

    const customContainer = containerEl.createDiv("autocorrect-custom-list");
    this.renderCustomCorrections(customContainer);

    // Merge all into built-in button
    if (Object.keys(this.plugin.settings.customCorrections).length > 0) {
      new Setting(containerEl)
        .setName("Merge all into built-in")
        .setDesc("Move all custom corrections into the built-in list. They stay active but no longer appear in the custom section.")
        .addButton((button) =>
          button.setButtonText("Merge all").onClick(async () => {
            const custom = this.plugin.settings.customCorrections;
            for (const [k, v] of Object.entries(custom)) {
              this.plugin.settings.promotedCorrections[k] = v;
            }
            this.plugin.settings.customCorrections = {};
            await this.plugin.saveSettings();
            this.display();
          })
        );
    }

    // Add new custom correction
    const addCorrectionDiv = containerEl.createDiv("autocorrect-add-correction");
    let newMisspelling = "";
    let newCorrection = "";

    new Setting(addCorrectionDiv)
      .setName("Add custom correction")
      .addText((text) =>
        text.setPlaceholder("Misspelling").onChange((value) => {
          newMisspelling = value;
        })
      )
      .addText((text) =>
        text.setPlaceholder("Correction").onChange((value) => {
          newCorrection = value;
        })
      )
      .addButton((button) =>
        button.setButtonText("Add").onClick(async () => {
          if (newMisspelling && newCorrection) {
            this.plugin.settings.customCorrections[newMisspelling.toLowerCase()] = newCorrection;
            await this.plugin.saveSettings();
            this.display(); // refresh
          }
        })
      );

    // Ignore list section
    containerEl.createEl("h3", { text: "Ignore List" });
    containerEl.createEl("p", {
      text: "Words that should never be auto-corrected (e.g., technical terms, names).",
      cls: "setting-item-description",
    });

    const ignoreContainer = containerEl.createDiv("autocorrect-ignore-list");
    this.renderIgnoreList(ignoreContainer);

    // Add to ignore list
    let newIgnoreWord = "";
    new Setting(containerEl)
      .setName("Add word to ignore list")
      .addText((text) =>
        text.setPlaceholder("Word to ignore").onChange((value) => {
          newIgnoreWord = value;
        })
      )
      .addButton((button) =>
        button.setButtonText("Add").onClick(async () => {
          if (newIgnoreWord && !this.plugin.settings.ignoreList.includes(newIgnoreWord.toLowerCase())) {
            this.plugin.settings.ignoreList.push(newIgnoreWord.toLowerCase());
            await this.plugin.saveSettings();
            this.display();
          }
        })
      );

    // Stats
    containerEl.createEl("h3", { text: "Dictionary Info" });
    const promotedCount = Object.keys(this.plugin.settings.promotedCorrections).length;
    containerEl.createEl("p", {
      text: `Built-in dictionary: ${Object.keys(BUILTIN_DICTIONARY).length} entries${promotedCount > 0 ? ` (+${promotedCount} promoted)` : ""} | Custom corrections: ${Object.keys(this.plugin.settings.customCorrections).length} entries | Ignore list: ${this.plugin.settings.ignoreList.length} words`,
      cls: "setting-item-description",
    });

    if (promotedCount > 0) {
      new Setting(containerEl)
        .setName("Promoted corrections")
        .setDesc(`${promotedCount} correction${promotedCount === 1 ? "" : "s"} merged into the built-in list. Reset to move them back to custom corrections.`)
        .addButton((button) =>
          button.setButtonText("Reset all").onClick(async () => {
            const promoted = this.plugin.settings.promotedCorrections;
            for (const [k, v] of Object.entries(promoted)) {
              this.plugin.settings.customCorrections[k] = v;
            }
            this.plugin.settings.promotedCorrections = {};
            await this.plugin.saveSettings();
            this.display();
          })
        );
    }
  }

  renderCustomCorrections(container: HTMLElement): void {
    container.empty();
    const corrections = this.plugin.settings.customCorrections;
    for (const [misspelling, correction] of Object.entries(corrections)) {
      const item = container.createDiv("autocorrect-list-item");
      item.style.display = "flex";
      item.style.alignItems = "center";
      item.style.gap = "8px";
      item.style.marginBottom = "4px";

      item.createSpan({ text: `${misspelling} → ${correction}` });

      const promoteBtn = item.createEl("button", { text: "↑", title: "Merge into built-in" });
      promoteBtn.style.cursor = "pointer";
      promoteBtn.addEventListener("click", async () => {
        this.plugin.settings.promotedCorrections[misspelling] = correction;
        delete this.plugin.settings.customCorrections[misspelling];
        await this.plugin.saveSettings();
        this.display();
      });

      const deleteBtn = item.createEl("button", { text: "×" });
      deleteBtn.style.cursor = "pointer";
      deleteBtn.addEventListener("click", async () => {
        delete this.plugin.settings.customCorrections[misspelling];
        await this.plugin.saveSettings();
        this.renderCustomCorrections(container);
      });
    }
    if (Object.keys(corrections).length === 0) {
      container.createEl("em", { text: "No custom corrections defined." });
    }
  }

  renderIgnoreList(container: HTMLElement): void {
    container.empty();
    const ignoreList = this.plugin.settings.ignoreList;
    for (const word of ignoreList) {
      const item = container.createDiv("autocorrect-list-item");
      item.style.display = "flex";
      item.style.alignItems = "center";
      item.style.gap = "8px";
      item.style.marginBottom = "4px";

      item.createSpan({ text: word });

      const deleteBtn = item.createEl("button", { text: "×" });
      deleteBtn.style.cursor = "pointer";
      deleteBtn.addEventListener("click", async () => {
        this.plugin.settings.ignoreList = this.plugin.settings.ignoreList.filter(
          (w) => w !== word
        );
        await this.plugin.saveSettings();
        this.renderIgnoreList(container);
      });
    }
    if (ignoreList.length === 0) {
      container.createEl("em", { text: "No ignored words." });
    }
  }
}

// ============================================================================
// Plugin
// ============================================================================

export function buildDictionary(
  customCorrections: Record<string, string>,
  promotedCorrections: Record<string, string>,
  ignoreList: string[]
): Map<string, string> {
  const dictionary = new Map<string, string>();

  // Add built-in dictionary, excluding ambiguous words
  for (const [key, value] of Object.entries(BUILTIN_DICTIONARY)) {
    if (!AMBIGUOUS_WORDS.has(key)) {
      dictionary.set(key, value);
    }
  }

  // Add custom corrections (override built-in if conflicting)
  for (const [key, value] of Object.entries(customCorrections)) {
    dictionary.set(key.toLowerCase(), value);
  }

  // Add promoted corrections (treated as built-in, override if conflicting)
  for (const [key, value] of Object.entries(promotedCorrections)) {
    dictionary.set(key.toLowerCase(), value);
  }

  // Remove ignored words
  for (const word of ignoreList) {
    dictionary.delete(word.toLowerCase());
  }

  return dictionary;
}

export default class AutocorrectPlugin extends Plugin {
  settings: AutocorrectSettings = DEFAULT_SETTINGS;
  dictionary: Map<string, string> = new Map();
  spellChecker: SpellCheckerInstance | null = null;

  async onload() {
    await this.loadSettings();
    this.rebuildDictionary();

    if (this.settings.enableSpellCheck) {
      this.spellChecker = initSpellChecker();
    }

    // Register the CM6 editor extensions
    this.registerEditorExtension([
      spellStateField,
      tooltips(),
      Prec.highest(spellTooltipKeymap),
      createAutocorrectExtension(
        () => this.settings,
        () => this.dictionary,
        () => this.spellChecker
      ),
    ]);

    // Register settings tab
    this.addSettingTab(new AutocorrectSettingTab(this.app, this));

    // Command: toggle autocorrect
    this.addCommand({
      id: "toggle-autocorrect",
      name: "Toggle autocorrect on/off",
      callback: () => {
        this.settings.enabled = !this.settings.enabled;
        this.saveSettings();
        new Notice(`Autocorrect ${this.settings.enabled ? "enabled" : "disabled"}`);
      },
    });
  }

  rebuildDictionary() {
    this.dictionary = buildDictionary(
      this.settings.customCorrections,
      this.settings.promotedCorrections,
      this.settings.ignoreList
    );
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.rebuildDictionary();
  }
}
