/**
Race multiple async operations with automatic AbortSignal cleanup for losers.

@template T
@param {Array<(signal: AbortSignal) => Promise<T>>} tasks - Functions that receive an AbortSignal and return a Promise.
@param {object} [options]
@param {AbortSignal} [options.signal] - An external AbortSignal for cancelling all tasks.
@returns {Promise<T>} The result of the winning task.
*/
export default async function abortRace(tasks, options = {}) {
  const { signal: parentSignal } = options;

  if (!Array.isArray(tasks)) {
    throw new TypeError("Expected `tasks` to be an array");
  }

  if (tasks.length === 0) {
    throw new TypeError("Expected at least one task");
  }

  for (const task of tasks) {
    if (typeof task !== "function") {
      throw new TypeError("Expected every task to be a function");
    }
  }

  if (parentSignal?.aborted) {
    throw parentSignal.reason ?? new Error("Aborted");
  }

  const controllers = tasks.map(() => new AbortController());
  let winnerIndex = -1;

  const abortLosers = (index) => {
    if (winnerIndex !== -1) {
      return;
    }

    winnerIndex = index;

    for (const [i, controller] of controllers.entries()) {
      if (i !== index) {
        controller.abort(new Error("Race lost"));
      }
    }
  };

  const abortAll = (reason) => {
    for (const controller of controllers) {
      controller.abort(reason);
    }
  };

  const parentAbort = parentSignal ? Promise.withResolvers() : undefined;
  const onParentAbort = () => {
    const reason = parentSignal.reason ?? new Error("Aborted");
    abortAll(reason);
    parentAbort.reject(reason);
  };

  if (parentSignal) {
    parentSignal.addEventListener("abort", onParentAbort, { once: true });
  }

  try {
    const promises = tasks.map(async (task, index) => {
      const linkedSignal = parentSignal
        ? AbortSignal.any([controllers[index].signal, parentSignal])
        : controllers[index].signal;

      const result = await task(linkedSignal);
      abortLosers(index);
      return result;
    });

    return await Promise.race(
      parentAbort ? [parentAbort.promise, ...promises] : promises
    );
  } catch (error) {
    abortAll(error);
    throw error;
  } finally {
    if (parentSignal) {
      parentSignal.removeEventListener("abort", onParentAbort);
    }
  }
}
