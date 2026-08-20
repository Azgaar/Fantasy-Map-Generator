export interface SvgFallbackElement {
  innerHTML: string;
}

export interface SvgFallbackRoot {
  querySelector: (selector: string) => SvgFallbackElement | null;
}

export interface SvgFallbackMaterializationOptions {
  afterRestore?: () => void;
  beforeMaterialize?: () => void;
  draw: () => void;
  root: SvgFallbackRoot;
  selectors: readonly string[];
  stopMaterializing?: () => void;
}

export function materializeSvgCompatibilityLayers({
  afterRestore,
  beforeMaterialize,
  draw,
  root,
  selectors,
  stopMaterializing
}: SvgFallbackMaterializationOptions): () => void {
  const snapshots = selectors.map(selector => {
    const element = root.querySelector(selector);
    return { element, html: element?.innerHTML ?? "" };
  });

  beforeMaterialize?.();
  try {
    draw();
  } catch (error) {
    stopMaterializing?.();
    throw error;
  }

  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    for (const { element, html } of snapshots) if (element) element.innerHTML = html;
    stopMaterializing?.();
    afterRestore?.();
  };
}
