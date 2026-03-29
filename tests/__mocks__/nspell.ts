// nspell mock for Jest. Returns a stub spell checker that marks every word
// as correct so existing tests (promotedCorrections, settingsMigration) are
// unaffected by spell-check logic.
const nspellMock = () => ({
  correct: () => true,
  suggest: () => [] as string[],
});

export = nspellMock;
