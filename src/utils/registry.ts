// The lazy module registry. The caller passes the loading feedback: utils sits below the UI layer
type Loader<T> = () => Promise<T>;
type DispatchFn = (...args: unknown[]) => unknown;

const LOADING_TIP = "Loading…";

let pendingLoads = 0;

interface LoadProgress {
  start(): void;
  end(): void;
}

/** The default feedback when a caller passes none; utils sits below the UI, so it goes through the window seams */
const defaultProgress: LoadProgress = {
  start() {
    pendingLoads++;
    window.tip?.(LOADING_TIP, false, "info");
  },
  end() {
    if (--pendingLoads > 0) return;
    pendingLoads = 0;
    // clear only our own message: a hover tip that replaced it while we loaded must stay up
    if (typeof document !== "undefined" && document.getElementById("tooltip")?.innerHTML === LOADING_TIP)
      window.clearMainTip?.();
  }
};

// Every method of a registered module becomes async
type AsyncMethods<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R ? (...args: A) => Promise<Awaited<R>> : T[K];
};

type Registry<T> = {
  [K in keyof T]: AsyncMethods<T[K]>;
};

export const eager =
  <T extends object>(value: T): Loader<T> =>
  () =>
    Promise.resolve(value);

export function createRegistry<T extends Record<string, object>>(
  loaders: {
    [K in keyof T]: Loader<T[K]>;
  },
  progress: LoadProgress = defaultProgress
): Registry<T> {
  const modulePromises = new Map<string, Promise<unknown>>();
  const entryProxies = new Map<string, object>();

  const loaderByName = loaders as Record<string, Loader<unknown>>;

  // Memoise the loader promise so each module is fetched/evaluated once.
  const load = (name: string): Promise<unknown> => {
    let promise = modulePromises.get(name);
    if (!promise) {
      progress.start();
      promise = loaderByName[name]().finally(() => progress.end());
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
