import { createSingleFlight } from "../lib/singleFlight";

describe("createSingleFlight", () => {
  it("runs the task only once when two calls happen in the same tick", async () => {
    const flight = createSingleFlight();
    let resolveTask: (v: string) => void = () => {};
    const task = jest.fn(
      () => new Promise<string>((resolve) => { resolveTask = resolve; })
    );

    const first = flight.run(task);
    const second = flight.run(task);

    expect(task).toHaveBeenCalledTimes(1);
    expect(flight.isBusy()).toBe(true);
    await expect(second).resolves.toBeUndefined();

    resolveTask("ok");
    await expect(first).resolves.toBe("ok");
    expect(flight.isBusy()).toBe(false);
  });

  it("frees the lock after an async rejection and propagates the error", async () => {
    const flight = createSingleFlight();
    const failing = jest.fn(() => Promise.reject(new Error("boom")));

    await expect(flight.run(failing)).rejects.toThrow("boom");
    expect(flight.isBusy()).toBe(false);

    const ok = jest.fn(() => Promise.resolve(1));
    await expect(flight.run(ok)).resolves.toBe(1);
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it("frees the lock after a synchronous throw", async () => {
    const flight = createSingleFlight();
    const throwing = jest.fn((): Promise<void> => { throw new Error("sync"); });

    await expect(flight.run(throwing)).rejects.toThrow("sync");
    expect(flight.isBusy()).toBe(false);

    const ok = jest.fn(() => Promise.resolve("again"));
    await expect(flight.run(ok)).resolves.toBe("again");
  });
});
