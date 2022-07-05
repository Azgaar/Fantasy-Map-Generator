type UnknownObject = {[key: string]: unknown};

type noop = () => void;

interface Dict<T> {
  [key: string]: T;
}

type IntArray = Uint8Array | Uint16Array | Uint32Array;

type RGB = `rgb(${number}, ${number}, ${number})`;
type Hex = `#${string}`;
