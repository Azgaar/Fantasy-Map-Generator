interface IRoute {
  i: number;
  type: "road" | "trail" | "sea";
  feature: number;
  from: number;
  to: number;
  end: number;
  cells: number[];
}

type TRoutes = IRoute[];
