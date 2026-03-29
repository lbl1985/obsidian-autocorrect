// Minimal mock for the obsidian module so tests can import main.ts without a real Obsidian environment.

export class Plugin {}
export class PluginSettingTab {}
export class Notice {}
export class Setting {
  setName() { return this; }
  setDesc() { return this; }
  addToggle() { return this; }
  addText() { return this; }
  addButton() { return this; }
}
export const App = {};
