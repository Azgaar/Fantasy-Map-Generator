// replaceAll
if (String.prototype.replaceAll === undefined) {
  String.prototype.replaceAll = function (
    str: string | RegExp,
    newStr: string | ((substring: string, ...args: any[]) => string),
  ): string {
    if (Object.prototype.toString.call(str).toLowerCase() === "[object regexp]")
      return this.replace(str as RegExp, newStr as any);
    return this.replace(new RegExp(str, "g"), newStr as any);
  };
}

// flat
if (Array.prototype.flat === undefined) {
  Array.prototype.flat = function <T>(this: T[], depth?: number): any[] {
    return (this as Array<unknown>).reduce(
      (acc: any[], val: unknown) =>
        Array.isArray(val)
          ? acc.concat((val as any).flat(depth))
          : acc.concat(val),
      [],
    );
  };
}

// at
if (Array.prototype.at === undefined) {
  Array.prototype.at = function <T>(this: T[], index: number): T | undefined {
    if (index < 0) index += this.length;
    if (index < 0 || index >= this.length) return undefined;
    return this[index];
  };
}

// readable stream iterator: https://bugs.chromium.org/p/chromium/issues/detail?id=929585#c10
if ((ReadableStream.prototype as any)[Symbol.asyncIterator] === undefined) {
  (ReadableStream.prototype as any)[Symbol.asyncIterator] = async function* <R>(
    this: ReadableStream<R>,
  ): AsyncGenerator<R, void, unknown> {
    const reader = this.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  };
}

declare global {
  interface String {
    replaceAll(
      searchValue: string | RegExp,
      replaceValue: string | ((substring: string, ...args: any[]) => string),
    ): string;
  }

  interface Array<T> {
    flat(depth?: number): T[];
    at(index: number): T | undefined;
  }

  interface ReadableStream<R> {
    [Symbol.asyncIterator](): AsyncIterableIterator<R>;
  }
}
