type PixiStartupTheme = "biomes" | "states";

export const getInitialPixiTheme = (search: string): PixiStartupTheme | null => {
  const params = new URLSearchParams(search);
  const renderer = params.get("renderer");
  if (renderer !== null && renderer !== "pixi") return null;

  return params.get("pixiTheme") === "biomes" ? "biomes" : "states";
};
