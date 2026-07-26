import type { RouteFragment } from "../routes.ts";

export const aiLabRouteFragment = [
  {
    id: "ai-lab.en",
    localePairId: "ai-lab",
    locale: "en",
    path: "/ai-lab/",
  },
  {
    id: "ai-lab.vi",
    localePairId: "ai-lab",
    locale: "vi",
    path: "/vi/ai-lab/",
  },
  {
    id: "ai-lab.detail.en",
    localePairId: "ai-lab-detail",
    locale: "en",
    path: "/ai-lab/[slug]/",
  },
  {
    id: "ai-lab.detail.vi",
    localePairId: "ai-lab-detail",
    locale: "vi",
    path: "/vi/ai-lab/[slug]/",
  },
  {
    id: "evidence.en",
    localePairId: "evidence",
    locale: "en",
    path: "/evidence/",
  },
  {
    id: "evidence.vi",
    localePairId: "evidence",
    locale: "vi",
    path: "/vi/evidence/",
  },
  {
    id: "evidence.detail.en",
    localePairId: "evidence-detail",
    locale: "en",
    path: "/evidence/[id]/",
  },
  {
    id: "evidence.detail.vi",
    localePairId: "evidence-detail",
    locale: "vi",
    path: "/vi/evidence/[id]/",
  },
] as const satisfies RouteFragment;
