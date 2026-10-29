// Compatibility barrel for fork modules written before utils moved to one module per file
export { last } from "./array-utils";
export { wiki } from "./common-utils";
export { downloadFile } from "./file-utils";
export { getAdjective } from "./language-utils";
export { ensureEl, findEl, getPointer } from "./node-utils";
export { minmax, rn } from "./number-utils";
export { P, ra, rand, rw } from "./probability-utils";
export { capitalize, escapeHtml } from "./string-utils";
export { getFileName } from "@/services/io/file-name";
export { speak } from "@/services/speech";