import { Plugin, PluginSettingTab, App, Setting, Notice } from "obsidian";
import { EditorView, ViewUpdate, Decoration, DecorationSet } from "@codemirror/view";
import { StateField, StateEffect, Transaction, Annotation, Extension, RangeSetBuilder } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

// ============================================================================
// Dictionary of common misspellings
// ============================================================================

const BUILTIN_DICTIONARY: Record<string, string> = {
  // Very common typos
  "teh": "the", "hte": "the", "thier": "their", "adn": "and",
  "dont": "don't", "doesnt": "doesn't", "didnt": "didn't", "cant": "can't",
  "wont": "won't", "isnt": "isn't", "wasnt": "wasn't", "werent": "weren't",
  "havent": "haven't", "hasnt": "hasn't", "hadnt": "hadn't", "shouldnt": "shouldn't",
  "wouldnt": "wouldn't", "couldnt": "couldn't", "arent": "aren't",
  "im": "I'm", "ive": "I've", "id": "I'd", "ill": "I'll",
  "youre": "you're", "youve": "you've", "youd": "you'd", "youll": "you'll",
  "theyre": "they're", "theyve": "they've", "theyd": "they'd", "theyll": "they'll",
  "were": "we're", "weve": "we've", "wed": "we'd", "well": "we'll",
  "hes": "he's", "shes": "she's", "its": "it's", "lets": "let's",
  "thats": "that's", "whats": "what's", "whos": "who's", "wheres": "where's",
  "heres": "here's", "theres": "there's",

  // Common misspellings
  "abbout": "about", "abotu": "about", "abouta": "about",
  "accidently": "accidentally", "accomodate": "accommodate", "acheive": "achieve",
  "acomplish": "accomplish", "acording": "according", "adress": "address",
  "agian": "again", "agianst": "against", "agressve": "aggressive",
  "alledge": "allege", "allready": "already", "alot": "a lot",
  "amatuer": "amateur", "amung": "among", "anohter": "another",
  "aparent": "apparent", "apparantly": "apparently", "apperance": "appearance",
  "arguement": "argument", "assasination": "assassination",
  "basicly": "basically", "becasue": "because", "becuase": "because",
  "becomeing": "becoming", "beeing": "being", "begining": "beginning",
  "beleive": "believe", "belive": "believe", "benificial": "beneficial",
  "buisness": "business", "busines": "business",
  "calender": "calendar", "catagory": "category", "cauhgt": "caught",
  "certian": "certain", "changeing": "changing", "cheif": "chief",
  "cieling": "ceiling", "collegue": "colleague", "comeing": "coming",
  "comision": "commission", "commited": "committed", "commitee": "committee",
  "comparision": "comparison", "compeletly": "completely", "concensus": "consensus",
  "consciencious": "conscientious", "concious": "conscious",
  "consistant": "consistent", "controll": "control", "controversal": "controversial",
  "convienient": "convenient", "copywrite": "copyright",
  "dacquiri": "daiquiri", "decieve": "deceive", "deffinate": "definite",
  "definately": "definitely", "definatly": "definitely", "definetly": "definitely",
  "definitly": "definitely", "dependant": "dependent", "develope": "develop",
  "diffrence": "difference", "dilema": "dilemma", "disapear": "disappear",
  "disapoint": "disappoint", "dissappoint": "disappoint",
  "ecstacy": "ecstasy", "effecient": "efficient", "embarass": "embarrass",
  "enviroment": "environment", "enviorment": "environment",
  "equiptment": "equipment", "essense": "essence", "exagerate": "exaggerate",
  "excede": "exceed", "exellent": "excellent", "existance": "existence",
  "experiance": "experience", "expierence": "experience",
  "facinated": "fascinated", "fianlly": "finally", "flourescent": "fluorescent",
  "foriegn": "foreign", "fourty": "forty", "freind": "friend",
  "fulfill": "fulfill", "fundametal": "fundamental",
  "garauntee": "guarantee", "goverment": "government", "gramar": "grammar",
  "greatful": "grateful", "gaurd": "guard", "guidence": "guidance",
  "happend": "happened", "harrass": "harass", "heighth": "height",
  "heirarchy": "hierarchy", "humourous": "humorous",
  "ignorence": "ignorance", "imaginery": "imaginary", "imediate": "immediate",
  "immediatly": "immediately", "incidently": "incidentally",
  "independant": "independent", "indispensible": "indispensable",
  "innoculate": "inoculate", "inteligence": "intelligence",
  "interuption": "interruption", "irrelevent": "irrelevant",
  "jewlery": "jewelry", "judgement": "judgment",
  "kernal": "kernel", "knowlege": "knowledge", "knowledgable": "knowledgeable",
  "laguage": "language", "lenght": "length", "liase": "liaise",
  "libary": "library", "liason": "liaison", "liscense": "license",
  "lisence": "licence", "lonelyness": "loneliness",
  "maintainance": "maintenance", "managment": "management",
  "manuever": "maneuver", "millenium": "millennium", "miniscule": "minuscule",
  "mischevious": "mischievous", "mispell": "misspell", "morgage": "mortgage",
  "mysterius": "mysterious",
  "naturaly": "naturally", "neccessary": "necessary", "necessery": "necessary",
  "necesary": "necessary", "negligable": "negligible", "negociate": "negotiate",
  "neighbour": "neighbor", "nieghbor": "neighbor", "noticable": "noticeable",
  "nuisanse": "nuisance",
  "ocasion": "occasion", "occassion": "occasion", "occured": "occurred",
  "occurence": "occurrence", "occurrance": "occurrence", "offically": "officially",
  "omision": "omission", "oportunity": "opportunity", "orignal": "original",
  "outragous": "outrageous",
  "parliment": "parliament", "particulary": "particularly",
  "pastime": "pastime", "perseverence": "perseverance",
  "personell": "personnel", "persue": "pursue", "plagerize": "plagiarize",
  "posession": "possession", "potatos": "potatoes", "preceed": "precede",
  "presance": "presence", "privelege": "privilege", "priviledge": "privilege",
  "probly": "probably", "profesion": "profession", "proffesional": "professional",
  "programer": "programmer", "pronounciation": "pronunciation",
  "propoganda": "propaganda", "prufe": "proof", "publically": "publicly",
  "pursuade": "persuade",
  "questionaire": "questionnaire",
  "realy": "really", "reccomend": "recommend", "recieve": "receive",
  "reciept": "receipt", "reconize": "recognize", "reccommend": "recommend",
  "refered": "referred", "referance": "reference", "relevent": "relevant",
  "religous": "religious", "repitition": "repetition", "resistence": "resistance",
  "restaraunt": "restaurant", "rythm": "rhythm",
  "satelite": "satellite", "scedule": "schedule", "scholership": "scholarship",
  "seize": "seize", "sentance": "sentence", "seperate": "separate",
  "sargent": "sergeant", "similer": "similar", "sinceerly": "sincerely",
  "skilfull": "skillful", "speach": "speech", "strenght": "strength",
  "succede": "succeed", "succesful": "successful", "successfull": "successful",
  "supercede": "supersede", "suprise": "surprise", "surelly": "surely",
  "tatoo": "tattoo", "tendancy": "tendency", "therefor": "therefore",
  "threshhold": "threshold", "tomatos": "tomatoes", "tommorow": "tomorrow",
  "tommorrow": "tomorrow", "tounge": "tongue", "truely": "truly",
  "tyrany": "tyranny",
  "unecessary": "unnecessary", "unfortunatly": "unfortunately",
  "untill": "until", "unuseual": "unusual", "useable": "usable",
  "vaccum": "vacuum", "vegetable": "vegetable", "vehical": "vehicle",
  "visious": "vicious",
  "wether": "whether", "wich": "which", "wierd": "weird",
  "wellfare": "welfare", "whereever": "wherever", "whitch": "which",
  "writting": "writing",

  // Common keyboard typos (transpositions)
  "ahve": "have", "hvae": "have", "haved": "have",
  "taht": "that", "waht": "what", "wiht": "with", "tath": "that",
  "thsi": "this", "htis": "this", "tihs": "this",
  "form": "from", "fomr": "from", "frome": "from",
  "jsut": "just", "juts": "just",
  "konw": "know", "knwo": "know",
  "liek": "like", "lkie": "like",
  "mroe": "more", "moer": "more",
  "nto": "not", "tno": "not",
  "nowe": "now", "onw": "own",
  "cna": "can", "coudl": "could", "shoudl": "should", "woudl": "would",
  "sicne": "since", "snce": "since",
  "soem": "some", "smoe": "some",
  "tiem": "time", "itme": "time",
  "veyr": "very", "vrey": "very",
  "wrok": "work", "owrk": "work",
  "yuor": "your", "yoru": "your",
  "baout": "about", "abut": "about",
  "aftre": "after", "atfer": "after",
  "befoer": "before", "befroe": "before",
  "betwene": "between", "bewteen": "between",
  "dosen't": "doesn't", "doens't": "doesn't",

  // Tech-related common typos
  "fucntion": "function", "funciton": "function",
  "retrun": "return", "reutrn": "return",
  "stirng": "string", "strign": "string",
  "ture": "true", "flase": "false",
  "nulll": "null", "undefiend": "undefined",
  "cosnt": "const", "conts": "const",
  "improt": "import", "exoprt": "export",
  "classs": "class", "interfce": "interface",
  "pubilc": "public", "priavte": "private",
  "requets": "request", "reqeust": "request",
  "reponse": "response", "repsonse": "response",
  "databse": "database", "databaes": "database",
  "deplyoment": "deployment", "deploymnet": "deployment",
  "confgiuration": "configuration", "configration": "configuration",
  "implmentation": "implementation",
  "documnet": "document", "docuemnt": "document",

  // Work-context typos
  "meeitng": "meeting", "meetign": "meeting",
  "disucssion": "discussion", "dicussion": "discussion", "discussoin": "discussion",
  "converstation": "conversation",
  "managemnet": "management",
  "developement": "development",
  "performacne": "performance", "performane": "performance",
  "informaiton": "information", "infomration": "information",
  "applicaiton": "application",
  "communicaiton": "communication",
  "organizaiton": "organization",
  "presentaiton": "presentation",
  "investigaiton": "investigation",
  "specifc": "specific", "speciifc": "specific",
  "additonal": "additional", "addtional": "additional",
  "availabel": "available", "avialable": "available",
  "differnet": "different", "diferent": "different",
  "importnat": "important", "improtant": "important",
  "possibel": "possible", "possilbe": "possible",
  "probelm": "problem", "problme": "problem",
  "poposal": "proposal",
  "speical": "special",
  "followign": "following",
  "runnign": "running",
  "workign": "working",
  "lookign": "looking",
  "havign": "having",
  "takign": "taking",
  "makign": "making",
  "comign": "coming",
  "goign": "going",
  "doign": "doing",
  "beign": "being",
  "tryign": "trying",
  "usign": "using",
  "gettign": "getting",
  "settign": "setting",
  "lettign": "letting",
  "puttign": "putting",
  "startign": "starting",
  "checkign": "checking",
  "needign": "needing",
  "helpign": "helping",
  "askign": "asking",
  "readign": "reading",
  "writign": "writing",
  "buildign": "building",
  "testign": "testing",
  "fixign": "fixing",

  // Doubled letter mistakes
  "occuring": "occurring",
  "comming": "coming",
  "runing": "running", "stoping": "stopping",
  "geting": "getting", "seting": "setting",
  "planing": "planning", "shoping": "shopping",
  "droping": "dropping", "skiping": "skipping",
  "wraping": "wrapping", "cliping": "clipping",
  "triming": "trimming", "swiming": "swimming",
  "cuting": "cutting", "hiting": "hitting",
  "siting": "sitting", "puting": "putting",
  "biger": "bigger", "bigest": "biggest",
  "smaler": "smaller", "smalest": "smallest",
};

// Words that should NEVER be auto-corrected because they are valid words
// even though they look like misspellings. "form" -> "from" is risky, remove it.
const AMBIGUOUS_WORDS = new Set([
  "form", "were", "well", "its", "lets", "id",
]);

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
