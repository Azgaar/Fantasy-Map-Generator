export interface ContextRecoveryCallbacks {
  lost: () => void;
  restored: () => void;
}

export function monitorWebGlContext(
  canvas: Pick<HTMLCanvasElement, "addEventListener" | "removeEventListener">,
  callbacks: ContextRecoveryCallbacks
): () => void {
  const handleLost = (event: Event) => {
    event.preventDefault();
    callbacks.lost();
  };
  const handleRestored = () => callbacks.restored();
  canvas.addEventListener("webglcontextlost", handleLost);
  canvas.addEventListener("webglcontextrestored", handleRestored);
  return () => {
    canvas.removeEventListener("webglcontextlost", handleLost);
    canvas.removeEventListener("webglcontextrestored", handleRestored);
  };
}
