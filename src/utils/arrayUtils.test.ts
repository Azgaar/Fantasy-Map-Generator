import {sliceFragment} from "./arrayUtils";

describe("sliceFragment", () => {
  const array = ["a", "b", "c", "d", "e", "f"];

  it("should return expected fragment within array length", () => {
    expect(sliceFragment(array, 2, 2)).toEqual(["a", "b", "c", "d", "e"]);
    expect(sliceFragment(array, 2, 1)).toEqual(["b", "c", "d"]);
    expect(sliceFragment(array, 2, 0)).toEqual(["c"]);
  });

  it("should cycle array and return expected fragment if input is beyond array length", () => {
    expect(sliceFragment(array, 1, 2)).toEqual(["f", "a", "b", "c", "d"]);
    expect(sliceFragment(array, 0, 1)).toEqual(["f", "a", "b"]);
    expect(sliceFragment(array, 5, 1)).toEqual(["e", "f", "a"]);
  });

  it("should return original array if boundaries exceed the array", () => {
    expect(sliceFragment(array, 2, 10)).toEqual(array);
    expect(sliceFragment([], 2, 10)).toEqual([]);
  });

  it("should throw an error if input is incorrect", () => {
    expect(() => sliceFragment(array, -2, 2)).toThrow();
    expect(() => sliceFragment(array, 2, -1)).toThrow();
  });
});
