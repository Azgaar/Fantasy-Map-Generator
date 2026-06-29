type Loader<T> = () => Promise<T>;
type DispatchFn = (...args: unknown[]) => unknown;

let pendingLoads = 0;
function trackLoad<T>(promise: Promise<T>): Promise<T> {
  pendingLoads++;
  tip("Loading…", false, "info");
  return promise.finally(() => {
    if (--pendingLoads <= 0) {
      pendingLoads = 0;
      clearMainTip();
    }
  });
}

// Every method of a registered module becomes async
type AsyncMethods<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R ? (...args: A) => Promise<Awaited<R>> : T[K];
};

export type Registry<T> = {
  [K in keyof T]: AsyncMethods<T[K]>;
};

export const eager =
  <T extends object>(value: T): Loader<T> =>
  () =>
    Promise.resolve(value);

export function createRegistry<T extends Record<string, object>>(
  loaders: {
    [K in keyof T]: Loader<T[K]>;
  }
): Registry<T> {
  const modulePromises = new Map<string, Promise<unknown>>();
  const entryProxies = new Map<string, object>();

  const loaderByName = loaders as Record<string, Loader<unknown>>;

  // Memoise the loader promise so each module is fetched/evaluated once.
  const load = (name: string): Promise<unknown> => {
    let promise = modulePromises.get(name);
    if (!promise) {
      promise = trackLoad(loaderByName[name]());
      modulePromises.set(name, promise);
    }
    return promise;
  };

  return new Proxy({} as Registry<T>, {
    get(_target, name) {
      if (typeof name !== "string" || !Object.hasOwn(loaders, name)) return undefined;

      let entry = entryProxies.get(name);
      if (!entry) {
        entry = new Proxy(
          {},
          {
            get(_t, method) {
              if (typeof method !== "string" || method === "then") return undefined;
              return (...args: unknown[]) =>
                load(name).then(module => (module as Record<string, DispatchFn>)[method](...args));
            }
          }
        );
        entryProxies.set(name, entry);
      }
      return entry;
    }
  });
}
