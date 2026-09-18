export interface RequestedMapSize {
  width?: number;
  height?: number;
}

export function getRequestedMapSize(params: URLSearchParams): RequestedMapSize {
  const dimension = (name: "width" | "height") => {
    const value = Number(params.get(name));
    return Number.isFinite(value) && value > 0 ? value : undefined;
  };

  return { width: dimension("width"), height: dimension("height") };
}
