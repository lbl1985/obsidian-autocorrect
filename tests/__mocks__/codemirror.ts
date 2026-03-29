// Minimal mock for all @codemirror/* packages used in main.ts

export const EditorView = { updateListener: { of: () => ({}) } };
export const ViewUpdate = {};
export const Decoration = {};
export const DecorationSet = {};

export const StateField = { define: () => ({}) };
export const StateEffect = { define: () => ({ of: () => ({}) }) };
export const Transaction = { addToHistory: { of: () => ({}) } };
export const Annotation = { define: () => ({ of: () => ({}) }) };
export const RangeSetBuilder = class {};

export function syntaxTree() { return { cursor: () => ({}) }; }
