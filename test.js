import test from "ava";
import abortRace from "./index.js";

const delay = (ms, value, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      resolve(value);
    }, ms);

    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(signal.reason);
        },
        { once: true }
      );
    }
  });

// Winner result tests

test("returns the result of the winning task", async (t) => {
  const result = await abortRace([
    async () => delay(10, "fast"),
    async () => delay(200, "slow"),
  ]);

  t.is(result, "fast");
});

test("returns the result of the only task", async (t) => {
  const result = await abortRace([async () => "only"]);

  t.is(result, "only");
});

test("winner is determined by fastest resolution", async (t) => {
  const result = await abortRace([
    async () => delay(200, "first"),
    async () => delay(10, "second"),
    async () => delay(100, "third"),
  ]);

  t.is(result, "second");
});

// Abort signal tests

test("loser signals are aborted", async (t) => {
  const signals = [];

  await abortRace([
    (signal) => {
      signals.push(signal);
      return Promise.resolve("winner");
    },
    (signal) => {
      signals.push(signal);
      return delay(200, "loser", signal);
    },
  ]);

  // Give a tick for abort to propagate
  await delay(10);

  t.false(signals[0].aborted);
  t.true(signals[1].aborted);
});

test('loser abort reason is "Race lost"', async (t) => {
  let loserSignal;

  await abortRace([
    async () => "winner",
    (signal) => {
      loserSignal = signal;
      return delay(200, "loser", signal);
    },
  ]);

  await delay(10);

  t.true(loserSignal.aborted);
  t.is(loserSignal.reason.message, "Race lost");
});

// External signal tests

test("external signal aborts all tasks", async (t) => {
  const controller = new AbortController();
  const signals = [];

  const racePromise = abortRace(
    [
      (signal) => {
        signals.push(signal);
        return delay(500, "a", signal);
      },
      (signal) => {
        signals.push(signal);
        return delay(500, "b", signal);
      },
    ],
    { signal: controller.signal }
  );

  setTimeout(() => {
    controller.abort(new Error("External abort"));
  }, 10);

  await t.throwsAsync(racePromise, { message: "External abort" });
});

test("pre-aborted external signal throws immediately", async (t) => {
  const controller = new AbortController();
  controller.abort(new Error("Already aborted"));

  await t.throwsAsync(
    abortRace([async () => "never"], { signal: controller.signal }),
    { message: "Already aborted" }
  );
});

// Error handling tests

test("error in one task aborts all others", async (t) => {
  let otherSignal;

  await t.throwsAsync(
    abortRace([
      () => Promise.reject(new Error("Task failed")),
      (signal) => {
        otherSignal = signal;
        return delay(200, "other", signal);
      },
    ]),
    { message: "Task failed" }
  );

  await delay(10);
  t.true(otherSignal.aborted);
});

test("first error wins", async (t) => {
  await t.throwsAsync(
    abortRace([
      () => Promise.reject(new Error("First error")),
      async () => {
        await delay(10);
        throw new Error("Second error");
      },
    ]),
    { message: "First error" }
  );
});

// Multiple tasks tests

test("works with 3 tasks", async (t) => {
  const result = await abortRace([
    async () => delay(100, "a"),
    async () => delay(10, "b"),
    async () => delay(50, "c"),
  ]);

  t.is(result, "b");
});

test("works with 5 tasks", async (t) => {
  const result = await abortRace([
    async () => delay(100, "a"),
    async () => delay(200, "b"),
    async () => delay(10, "c"),
    async () => delay(150, "d"),
    async () => delay(50, "e"),
  ]);

  t.is(result, "c");
});

// Edge cases

test("rejects an empty task list", async (t) => {
  t.timeout(500);
  await t.throwsAsync(abortRace([]), {
    instanceOf: TypeError,
    message: "Expected at least one task",
  });
});

test("rejects a non-array task list with a clear error", async (t) => {
  await t.throwsAsync(abortRace(null), {
    instanceOf: TypeError,
    message: "Expected `tasks` to be an array",
  });
});

test("rejects non-function tasks before starting the race", async (t) => {
  let started = false;

  await t.throwsAsync(
    abortRace([
      () => {
        started = true;
        return Promise.resolve();
      },
      undefined,
    ]),
    {
      instanceOf: TypeError,
      message: "Expected every task to be a function",
    }
  );

  t.false(started);
});

test("rejects sparse task arrays before starting the race", async (t) => {
  let started = false;
  const tasks = new Array(3);
  tasks[0] = () => {
    started = true;
    return Promise.resolve();
  };
  tasks[2] = async () => "never reached";

  await t.throwsAsync(abortRace(tasks), {
    instanceOf: TypeError,
    message: "Expected every task to be a function",
  });

  t.false(started);
});

test("task receives an AbortSignal", async (t) => {
  await abortRace([
    (signal) => {
      t.truthy(signal);
      t.true(signal instanceof AbortSignal);
      return Promise.resolve("done");
    },
  ]);
});

test("resolved values are preserved", async (t) => {
  const complexValue = { a: 1, b: [2, 3], c: { d: 4 } };
  const result = await abortRace([async () => complexValue]);

  t.deepEqual(result, complexValue);
});

test("undefined result is returned correctly", async (t) => {
  const result = await abortRace([async () => undefined]);

  t.is(result, undefined);
});
