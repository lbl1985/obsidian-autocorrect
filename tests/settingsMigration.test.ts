// Tests verifying that settings are safely migrated across plugin versions.
// Obsidian persists settings as JSON; when a user upgrades, their saved data
// may not contain new fields introduced in the new version. The loadSettings()
// pattern Object.assign({}, DEFAULT_SETTINGS, savedData) must preserve all
// existing user data and default any missing fields gracefully.

import { DEFAULT_SETTINGS } from "../main.ts";

// Simulate the loadSettings() merge logic without needing the Plugin class.
function simulateLoad(savedData: Record<string, unknown>) {
  return Object.assign({}, DEFAULT_SETTINGS, savedData);
}

describe("Settings migration — upgrading from a version without promotedCorrections", () => {
  it("preserves existing customCorrections after upgrade", () => {
    const savedData = {
      enabled: true,
      customCorrections: { helo: "hello", wrold: "world" },
      ignoreList: [],
    };
    const settings = simulateLoad(savedData);
    expect(settings.customCorrections).toEqual({ helo: "hello", wrold: "world" });
  });

  it("defaults promotedCorrections to empty object when not in saved data", () => {
    const savedData = {
      enabled: true,
      customCorrections: { helo: "hello" },
      ignoreList: [],
    };
    const settings = simulateLoad(savedData);
    expect(settings.promotedCorrections).toEqual({});
  });

  it("preserves existing ignoreList after upgrade", () => {
    const savedData = {
      enabled: false,
      customCorrections: {},
      ignoreList: ["javascript", "typescript"],
    };
    const settings = simulateLoad(savedData);
    expect(settings.ignoreList).toEqual(["javascript", "typescript"]);
  });

  it("preserves enabled flag after upgrade", () => {
    const savedData = { enabled: false, customCorrections: {}, ignoreList: [] };
    const settings = simulateLoad(savedData);
    expect(settings.enabled).toBe(false);
  });
});

describe("Settings migration — no data loss for users who already have promotedCorrections", () => {
  it("preserves promotedCorrections from saved data", () => {
    const savedData = {
      enabled: true,
      customCorrections: { typoA: "corrA" },
      promotedCorrections: { typoB: "corrB", typoC: "corrC" },
      ignoreList: [],
    };
    const settings = simulateLoad(savedData);
    expect(settings.promotedCorrections).toEqual({ typoB: "corrB", typoC: "corrC" });
    expect(settings.customCorrections).toEqual({ typoA: "corrA" });
  });

  it("does not merge promotedCorrections into customCorrections on load", () => {
    const savedData = {
      enabled: true,
      customCorrections: {},
      promotedCorrections: { helo: "hello" },
      ignoreList: [],
    };
    const settings = simulateLoad(savedData);
    expect(settings.customCorrections).toEqual({});
    expect(settings.promotedCorrections).toEqual({ helo: "hello" });
  });
});

describe("Settings migration — fresh install with no saved data", () => {
  it("uses all defaults when no saved data exists", () => {
    const settings = simulateLoad({});
    expect(settings.enabled).toBe(true);
    expect(settings.customCorrections).toEqual({});
    expect(settings.promotedCorrections).toEqual({});
    expect(settings.ignoreList).toEqual([]);
  });
});
