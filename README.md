# Obsidian Autocorrect

Automatically corrects common spelling mistakes as you type in [Obsidian](https://obsidian.md).

## Features

- **450+ built-in corrections** — covers common misspellings, keyboard transpositions, missing contractions, and doubled-letter mistakes
- **Real-time correction** — triggers instantly when you press space, period, comma, or other word boundaries
- **Context-aware** — does NOT correct inside:
  - Code blocks (fenced and inline)
  - YAML frontmatter
  - Wiki-links (`[[...]]`)
  - URLs
- **Case-preserving** — respects ALL CAPS, Title Case, and lowercase
- **Custom dictionary** — add your own misspelling → correction pairs
- **Ignore list** — add words that should never be corrected (technical terms, names, etc.)
- **Toggle command** — quickly enable/disable via command palette
- **Undo support** — Ctrl+Z reverses any correction

## Installation

### From Obsidian Community Plugins

1. Open **Settings** → **Community plugins** → **Browse**
2. Search for "Autocorrect"
3. Click **Install**, then **Enable**

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/user/obsidian-autocorrect/releases/latest)
2. Create a folder `obsidian-autocorrect` in your vault's `.obsidian/plugins/` directory
3. Place the downloaded files in that folder
4. Restart Obsidian and enable the plugin in Settings → Community plugins

## Usage

Once enabled, the plugin works automatically. Just type normally — when you hit a word boundary (space, period, etc.), the previous word is checked against the dictionary and corrected if a match is found.

### Settings

- **Enable/Disable** — master toggle for autocorrect
- **Custom Corrections** — add your own misspelling → correction pairs that supplement the built-in dictionary
- **Ignore List** — words that should never be auto-corrected

### Commands

- **Toggle autocorrect on/off** — quickly enable/disable from the command palette (Ctrl+P)

## Built-in Dictionary Categories

| Category | Examples | Count |
|----------|---------|-------|
| Common misspellings | "definately" → "definitely", "seperate" → "separate" | ~200 |
| Keyboard transpositions | "teh" → "the", "taht" → "that" | ~60 |
| Missing contractions | "dont" → "don't", "youre" → "you're" | ~40 |
| -ign suffix typos | "workign" → "working", "goign" → "going" | ~25 |
| Doubled letter errors | "occuring" → "occurring", "runing" → "running" | ~20 |
| Tech terms | "fucntion" → "function", "retrun" → "return" | ~20 |
| Work context | "meeitng" → "meeting", "converstation" → "conversation" | ~30 |

### Ambiguous Words

Some words that look like typos are actually valid words. These are **not** auto-corrected by default:

- `form` (could be "from", but "form" is valid)
- `were` (could be "we're", but "were" is valid)
- `well` (could be "we'll", but "well" is valid)
- `its` (could be "it's", but "its" is valid)
- `lets` (could be "let's", but "lets" is valid)

## Building from Source

```bash
npm install
npm run build
```

For development with watch mode:

```bash
npm run dev
```

## Contributing

Contributions are welcome! To add new corrections:

1. Fork this repository
2. Add entries to the `BUILTIN_DICTIONARY` in `main.ts`
3. Make sure the misspelling key is unique and lowercase
4. Submit a pull request

## License

[MIT](LICENSE)
