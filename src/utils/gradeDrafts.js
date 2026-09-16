// A background refresh may update untouched rows, but never unsaved input.
export const mergeGradeDraft = (server = {}, draft = {}, dirtyKeys = new Set()) => ({
  ...server,
  ...Object.fromEntries([...dirtyKeys].filter(key => Object.hasOwn(draft, key)).map(key => [key, draft[key]])),
});
