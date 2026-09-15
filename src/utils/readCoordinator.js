export const READ_TTL_MS = 5 * 60 * 1000;

// Query equality is supplied by Firestore's public queryEqual API.
export function createInFlightReader(read, equal) {
  const pending = new Set();
  return reference => {
    for (const entry of pending) {
      if (equal(entry.reference, reference)) return entry.promise;
    }
    const entry = { reference };
    entry.promise = Promise.resolve().then(() => read(reference)).finally(() => pending.delete(entry));
    pending.add(entry);
    return entry.promise;
  };
}

// One coordinator per authenticated app instance. Cache the completed work,
// not a copy of React state: local edits must never be overwritten by old data.
export function createReadCoordinator({ now = Date.now } = {}) {
  const entries = new Map();
  return {
    isFresh(key, ttl = READ_TTL_MS) {
      const entry = entries.get(key);
      return Boolean(entry?.completed && now() - entry.completedAt < ttl);
    },
    clear() {
      entries.clear();
    },
    run(key, task, { force = false, ttl = READ_TTL_MS } = {}) {
      const existing = entries.get(key);
      if (existing && (!existing.completed || (!force && now() - existing.completedAt < ttl))) {
        return existing.promise;
      }
      const entry = { completed: false };
      entries.set(key, entry);
      const isCurrent = () => entries.get(key) === entry;
      entry.promise = Promise.resolve().then(() => task(isCurrent)).then(value => {
        entry.completed = true;
        entry.completedAt = now();
        return value;
      }, error => {
        if (isCurrent()) entries.delete(key);
        throw error;
      });
      return entry.promise;
    },
  };
}
