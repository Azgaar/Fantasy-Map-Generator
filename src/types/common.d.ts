type UnknownObject = {[key: string]: unknown};

type noop = () => void;

interface Dict<T> {
  [key: string]: T;
}

type RGB = `rgb(${number}, ${number}, ${number})`;
type Hex = `#${string}`;
