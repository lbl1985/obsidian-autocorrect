import { Plugin, PluginSettingTab, App, Setting, Notice } from "obsidian";
import { EditorView, ViewUpdate, Decoration, DecorationSet } from "@codemirror/view";
import { StateField, StateEffect, Transaction, Annotation, Extension, RangeSetBuilder } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { BUILTIN_DICTIONARY, AMBIGUOUS_WORDS } from "./dictionary";


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
  customCorrections: Record<string, string>;
  ignoreList: string[];
}

const DEFAULT_SETTINGS: AutocorrectSettings = {
  enabled: true,
  customCorrections: {},
  ignoreList: [],
};

// ============================================================================
// Autocorrect CM6 Extension
// ============================================================================

const autocorrectAnnotation = Annotation.define<boolean>();

function createAutocorrectExtension(
  getSettings: () => AutocorrectSettings,
  getDictionary: () => Map<string, string>
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

      // Look up correction
      const dictionary = getDictionary();
      const correction = dictionary.get(word.toLowerCase());
      if (!correction) return;

      // Apply case preservation
      const corrected = preserveCase(word, correction);
      if (corrected === word) return;

      changes.push({ from: wordStart, to: wordEnd, insert: corrected });
    });

    if (changes.length > 0) {
      // Apply all corrections in one transaction
      update.view.dispatch({
        changes: changes,
        annotations: [
          autocorrectAnnotation.of(true),
          Transaction.addToHistory.of(true),
        ],
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

    // Custom corrections section
    containerEl.createEl("h3", { text: "Custom Corrections" });
    containerEl.createEl("p", {
      text: "Add your own misspelling → correction pairs. These are added on top of the built-in dictionary.",
      cls: "setting-item-description",
    });

    const customContainer = containerEl.createDiv("autocorrect-custom-list");
    this.renderCustomCorrections(customContainer);

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
    containerEl.createEl("p", {
      text: `Built-in dictionary: ${Object.keys(BUILTIN_DICTIONARY).length} entries | Custom corrections: ${Object.keys(this.plugin.settings.customCorrections).length} entries | Ignore list: ${this.plugin.settings.ignoreList.length} words`,
      cls: "setting-item-description",
    });
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

export default class AutocorrectPlugin extends Plugin {
  settings: AutocorrectSettings = DEFAULT_SETTINGS;
  dictionary: Map<string, string> = new Map();

  async onload() {
    await this.loadSettings();
    this.rebuildDictionary();

    // Register the CM6 editor extension
    this.registerEditorExtension(
      createAutocorrectExtension(
        () => this.settings,
        () => this.dictionary
      )
    );

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
    this.dictionary = new Map<string, string>();

    // Add built-in dictionary, excluding ambiguous words
    for (const [key, value] of Object.entries(BUILTIN_DICTIONARY)) {
      if (!AMBIGUOUS_WORDS.has(key)) {
        this.dictionary.set(key, value);
      }
    }

    // Add custom corrections (override built-in if conflicting)
    for (const [key, value] of Object.entries(this.settings.customCorrections)) {
      this.dictionary.set(key.toLowerCase(), value);
    }

    // Remove ignored words
    for (const word of this.settings.ignoreList) {
      this.dictionary.delete(word.toLowerCase());
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.rebuildDictionary();
  }
}
