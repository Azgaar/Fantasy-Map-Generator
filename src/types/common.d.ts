type UnknownObject = {[key: string]: unknown};

type noop = () => void;

interface Dict<T> {
  [key: string]: T;
}

type UintArray = Uint8Array | Uint16Array | Uint32Array;
type IntArray = Int8Array | Int16Array | Int32Array;

type RGB = `rgb(${number}, ${number}, ${number})`;
type Hex = `#${string}`;
