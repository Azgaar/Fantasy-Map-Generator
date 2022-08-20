interface IRoute {
  i: number;
  type: "road" | "trail" | "sea";
  feature: number;
  cells: number[];
}

type TRoutes = IRoute[];
