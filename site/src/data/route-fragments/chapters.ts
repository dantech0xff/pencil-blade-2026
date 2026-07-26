import type { RouteFragment } from "../routes.ts";

export const chaptersRouteFragment = [
  {
    id: "forensics.en",
    localePairId: "forensics",
    locale: "en",
    path: "/forensics/",
  },
  {
    id: "forensics.vi",
    localePairId: "forensics",
    locale: "vi",
    path: "/vi/forensics/",
  },
] as const satisfies RouteFragment;
