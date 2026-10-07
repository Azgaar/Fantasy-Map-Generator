import { t } from "@/utils/i18n";
// each list is the ocean outline offsets, in cells from the shore
export const OCEAN_OUTLINES = {
  none: t("No outline"),
  "-6,-3,-1": t("Standard 3"),
  "-6,-4,-2": t("Indented 3"),
  "-9,-6,-3,-1": t("Standard 4"),
  "-6,-5,-4,-3,-2,-1": t("Smooth 6"),
  "-9,-8,-7,-6,-5,-4,-3,-2,-1": t("Smooth 9")
};

export const OCEAN_PATTERNS = {
  "": t("No pattern"),
  "./images/pattern1.png": t("Pattern 1"),
  "./images/pattern2.png": t("Pattern 2"),
  "./images/pattern3.png": t("Pattern 3"),
  "./images/pattern4.png": t("Pattern 4"),
  "./images/pattern5.png": t("Pattern 5"),
  "./images/pattern6.png": t("Pattern 6"),
  "./images/kiwiroo.png": "Kiwiroo",
  "./images/waves.png": t("Waves"),
  "./images/whitecaps.png": t("Whitecaps")
};
