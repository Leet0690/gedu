// A portal connection has one authorization document per user. Complete each
// read (including its cleanup) before another request changes that document.
export function createSerialTaskQueue() {
  let tail = Promise.resolve();
  return {
    run(task) {
      const result = tail.then(task);
      tail = result.catch(() => {});
      return result;
    },
    drain: () => tail,
  };
}
