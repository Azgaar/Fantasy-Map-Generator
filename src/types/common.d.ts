type UnknownObject = {[key: string]: unknown};

interface Dict<T> {
  [key: string]: T;
}
