import type { Styles } from "@/generators/styles-schema";

type VignettePreset = { attrs: Partial<Styles["vignette"]["attrs"]>; options: Partial<Styles["vignette"]["options"]> };
export const VIGNETTE_PRESETS: Record<string, VignettePreset> = {
  default: {
    attrs: { opacity: 0.3, fill: "#000000", filter: null },
    options: { x: "0.3%", y: "0.4%", width: "99.6%", height: "99.2%", rx: "5%", ry: "5%", filter: "blur(20px)" }
  },
  neon: {
    attrs: { opacity: 0.5, fill: "#7300ff", filter: null },
    options: { x: "0.3%", y: "0.4%", width: "99.6%", height: "99.2%", rx: "0%", ry: "0%", filter: "blur(15px)" }
  },
  smoke: {
    attrs: { opacity: 1, fill: "#000000", filter: "url(#splotch)" },
    options: { x: "3%", y: "5%", width: "96%", height: "90%", rx: "10%", ry: "10%", filter: "blur(100px)" }
  },
  wound: {
    attrs: { opacity: 0.8, fill: "#ff0000", filter: "url(#paper)" },
    options: { x: "0.5%", y: "1%", width: "99%", height: "98%", rx: "5%", ry: "5%", filter: "blur(50px)" }
  },
  paper: {
    attrs: { opacity: 1, fill: "#000000", filter: "url(#paper)" },
    options: { x: "0.3%", y: "0.4%", width: "99.6%", height: "99.2%", rx: "20%", ry: "20%", filter: "blur(150px)" }
  },
  granite: {
    attrs: { opacity: 0.95, fill: "#231b1b", filter: "url(#crumpled)" },
    options: { x: "3%", y: "5%", width: "94%", height: "90%", rx: "20%", ry: "20%", filter: "blur(150px)" }
  },
  spotlight: {
    attrs: { opacity: 0.96, fill: "#000000", filter: null },
    options: { x: "20%", y: "30%", width: "24%", height: "30%", rx: "50%", ry: "50%", filter: "blur(30px)" }
  }
};
