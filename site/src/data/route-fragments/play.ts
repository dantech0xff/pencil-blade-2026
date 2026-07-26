import type { RouteFragment } from "../routes.ts";

export const playRouteFragment = [
  {
    id: "play.en",
    localePairId: "play",
    locale: "en",
    path: "/play/",
  },
  {
    id: "play.vi",
    localePairId: "play",
    locale: "vi",
    path: "/vi/play/",
  },
] as const satisfies RouteFragment;
