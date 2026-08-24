export const svgDefinitionsReady = loadSvgDefinitions();

async function loadSvgDefinitions(): Promise<void> {
  if (document.getElementById("defElements")) return;
  const mount = document.getElementById("defElementsMount");
  if (!mount) return;

  const response = await fetch(`${import.meta.env.BASE_URL}def-elements.svg`);
  if (!response.ok) throw new Error(`Cannot load reusable SVG definitions: ${response.status}`);
  mount.outerHTML = await response.text();
}
