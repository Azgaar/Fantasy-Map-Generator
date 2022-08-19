type Logical = number & (1 | 0); // data type for logical numbers

type UnknownObject = {[key: string]: unknown};

// extract element from array
type Entry<T> = T[number];

type noop = () => void;

interface Dict<T> {
  [key: string]: T;
}

// element of Object.entries
type ObjectEntry<T> = [string, T];

type UintArray = Uint8Array | Uint16Array | Uint32Array;
type IntArray = Int8Array | Int16Array | Int32Array;

type RGB = `rgb(${number}, ${number}, ${number})`;
type Hex = `#${string}`;

type CssUrl = `url(#${string})`;