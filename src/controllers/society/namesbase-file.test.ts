// @vitest-environment jsdom
import { beforeEach, expect, it } from "vitest";
import { NameBases } from "@/model/society/names/name-bases";
import { Dialog } from "@/ui/dialog/dialog";
import { DIALOGS_MARKUP } from "@/ui/dialog/dialog-testing";
import { NamesbaseFile } from "./namesbase-file";

const names = ["Alpha", "Beta", "Gamma"];

beforeEach(() => {
  document.body.innerHTML = DIALOGS_MARKUP;
});

it("reads back what it writes, a list or a single base", () => {
  const bases = [NameBases.compose("one", "One", [4, 8], names), NameBases.compose("two", "Two", [4, 8], names, "l")];
  expect(NamesbaseFile.parse(NamesbaseFile.format(bases))).toEqual(bases);
  expect(NamesbaseFile.parse(JSON.stringify(bases[0]))).toEqual([bases[0]]);
});

it("reads every shipped base back as it is", async () => {
  await NameBases.loadAll();
  expect(NamesbaseFile.parse(NamesbaseFile.format(NameBases.loaded()))).toEqual(NameBases.loaded());
});

it("reads an older file a line a base and tells which lines are broken", () => {
  const bases = NamesbaseFile.parse("Elvish|5|10|ln|0|Alpha,Beta,Gamma\r\nBroken|5|10\nElvish|4|9||0|Alpha,Beta,Gamma");
  expect(bases.map(({ id, length }) => [id, length])).toEqual([
    ["elvish", [5, 10]],
    ["elvish-2", [4, 9]]
  ]);
  expect(document.querySelector(".dialog-message")?.textContent).toContain("Broken|5|10");
  Dialog.closeAll();
});

it("gives a base whose id is taken an id of its own", () => {
  const base = NameBases.compose("one", "One", [4, 8], names);
  expect(NamesbaseFile.withOwnIds([base, base], ["one"]).map(({ id }) => id)).toEqual(["one-2", "one-3"]);
});
