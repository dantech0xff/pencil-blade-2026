import type { RouteFragment } from "../routes.ts";

export const chaptersRouteFragment = [
  {
    id: "story.en",
    localePairId: "story",
    locale: "en",
    path: "/story/",
  },
  {
    id: "forensics.en",
    localePairId: "forensics",
    locale: "en",
    path: "/forensics/",
  },
  {
    id: "reconstruction.en",
    localePairId: "reconstruction",
    locale: "en",
    path: "/reconstruction/",
  },
  {
    id: "story.vi",
    localePairId: "story",
    locale: "vi",
    path: "/vi/story/",
  },
  {
    id: "forensics.vi",
    localePairId: "forensics",
    locale: "vi",
    path: "/vi/forensics/",
  },
  {
    id: "reconstruction.vi",
    localePairId: "reconstruction",
    locale: "vi",
    path: "/vi/reconstruction/",
  },
] as const satisfies RouteFragment;

export interface ChapterRouteNavigation {
  readonly previousId: string | null;
  readonly nextId: string | null;
}

export const chapterRouteNavigation = Object.freeze({
  "story.en": Object.freeze({ previousId: "home.en", nextId: "forensics.en" }),
  "forensics.en": Object.freeze({ previousId: "story.en", nextId: "reconstruction.en" }),
  "reconstruction.en": Object.freeze({ previousId: "forensics.en", nextId: null }),
  "story.vi": Object.freeze({ previousId: "home.vi", nextId: "forensics.vi" }),
  "forensics.vi": Object.freeze({ previousId: "story.vi", nextId: "reconstruction.vi" }),
  "reconstruction.vi": Object.freeze({ previousId: "forensics.vi", nextId: null }),
} satisfies Readonly<Record<string, ChapterRouteNavigation>>);
