type UnknownObject = {[key: string]: unknown};

interface Dict<T> {
  [key: string]: T;
}

type RGB = `rgb(${number}, ${number}, ${number})`;
type Hex = `#${string}`;
