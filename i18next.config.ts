import { defineConfig } from 'i18next-cli';
import { type Plugin, ExtractedKey } from "i18next-cli";
import { readFile } from "node:fs/promises";

const HTMLPlugin: Plugin = {
  name: "html-plugin",
  async onEnd(keys: Map<string, ExtractedKey>) {
    const content = await readFile("src/index.html", "utf-8");
    const matches = content.matchAll(/data-(?:html|text|tip)="([^"]+)"/g);
    for (const match of matches) {
      const key = match[1];
      keys.set(key, {key, defaultValue: key});
    }
  }
};

export default defineConfig({
  locales: [
    "en",
    "fr"
  ],
  extract: {
    input: "src/**/*.{js,ts}",
    output: "public/locales/{{language}}/{{namespace}}.json",
    defaultNS: "lang",
    keySeparator: false
  },
  plugins: [
    HTMLPlugin
  ]
});
