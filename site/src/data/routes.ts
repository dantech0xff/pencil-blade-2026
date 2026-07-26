import {
  DEFAULT_LOCALE,
  LOCALES,
  isLocale,
  type Locale,
} from "./locales.ts";
import { chaptersRouteFragment } from "./route-fragments/chapters.ts";
import { playRouteFragment } from "./route-fragments/play.ts";

export const SITE_BASE = "/pencil-blade-2026";

export interface RouteDefinition {
  readonly id: string;
  readonly localePairId: string;
  readonly locale: Locale;
  /**
   * Locale-aware route without the GitHub Pages base.
   * Use withBase() when rendering a public URL.
   */
  readonly path: string;
}

export type RouteFragment = readonly RouteDefinition[];

export interface MergeRouteFragmentsOptions {
  readonly requireLocalePairs?: boolean;
  readonly requiredRouteIds?: readonly string[];
}

interface PathParts {
  pathname: string;
  suffix: string;
}

function splitPath(value: string): PathParts {
  const trimmed = value.trim();

  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed) || trimmed.startsWith("//")) {
    throw new Error(`Expected a site-local path, received "${value}".`);
  }

  const suffixIndex = trimmed.search(/[?#]/);
  const rawPathname =
    suffixIndex === -1 ? trimmed : trimmed.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? "" : trimmed.slice(suffixIndex);
  const pathname = rawPathname.length === 0 ? "/" : rawPathname;

  return {
    pathname: pathname.startsWith("/") ? pathname : `/${pathname}`,
    suffix,
  };
}

function stripSiteBase(pathname: string): string {
  let baseFreePath = pathname;

  while (
    baseFreePath === SITE_BASE ||
    baseFreePath.startsWith(`${SITE_BASE}/`)
  ) {
    baseFreePath = baseFreePath.slice(SITE_BASE.length) || "/";
  }

  return baseFreePath;
}

function normalizeDirectoryPath(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`Path traversal is not allowed in "${pathname}".`);
  }

  const normalized = `/${segments.join("/")}`;
  return normalized === "/" ? normalized : `${normalized}/`;
}

/**
 * Adds the GitHub Pages base exactly once and applies directory trailing slashes.
 */
export function withBase(path: string): string {
  const { pathname, suffix } = splitPath(path);
  const baseFreePath = stripSiteBase(pathname);
  const normalizedPath = normalizeDirectoryPath(baseFreePath);
  const basedPath =
    normalizedPath === "/" ? `${SITE_BASE}/` : `${SITE_BASE}${normalizedPath}`;

  return `${basedPath}${suffix}`;
}

/**
 * Produces a base-free localized route. English is unprefixed; Vietnamese uses /vi/.
 */
export function localizedPath(locale: Locale, route: string): string {
  const { pathname, suffix } = splitPath(route);
  const baseFreePath = stripSiteBase(pathname);
  const segments = baseFreePath.split("/").filter(Boolean);

  if (segments.length > 0 && isLocale(segments[0])) {
    segments.shift();
  }

  if (locale !== DEFAULT_LOCALE) {
    segments.unshift(locale);
  }

  return `${normalizeDirectoryPath(`/${segments.join("/")}`)}${suffix}`;
}

/**
 * Keeps the current route while switching to the requested locale.
 */
export function alternateLocalePath(
  locale: Locale,
  currentRoute: string,
): string {
  return localizedPath(locale, currentRoute);
}

export function mergeRouteFragments(
  fragments: readonly RouteFragment[],
  options: MergeRouteFragmentsOptions = {},
): readonly RouteDefinition[] {
  const routes = fragments.flat();
  const routeIds = new Set<string>();
  const routePaths = new Set<string>();
  const localesByPair = new Map<string, Set<Locale>>();

  for (const route of routes) {
    if (route.id.trim().length === 0 || route.localePairId.trim().length === 0) {
      throw new Error("Route IDs and locale pair IDs must be non-empty.");
    }

    if (routeIds.has(route.id)) {
      throw new Error(`Duplicate route ID "${route.id}".`);
    }
    routeIds.add(route.id);

    const normalizedPath = localizedPath(route.locale, route.path);
    if (normalizedPath !== route.path) {
      throw new Error(
        `Route "${route.id}" must use normalized locale path "${normalizedPath}".`,
      );
    }

    if (routePaths.has(normalizedPath)) {
      throw new Error(`Duplicate route path "${normalizedPath}".`);
    }
    routePaths.add(normalizedPath);

    const pairLocales =
      localesByPair.get(route.localePairId) ?? new Set<Locale>();
    if (pairLocales.has(route.locale)) {
      throw new Error(
        `Duplicate locale "${route.locale}" for route pair "${route.localePairId}".`,
      );
    }
    pairLocales.add(route.locale);
    localesByPair.set(route.localePairId, pairLocales);
  }

  if (options.requireLocalePairs ?? true) {
    for (const [pairId, pairLocales] of localesByPair) {
      const missingLocales = LOCALES.filter(
        (locale) => !pairLocales.has(locale),
      );
      if (missingLocales.length > 0) {
        throw new Error(
          `Route pair "${pairId}" is missing locale(s): ${missingLocales.join(", ")}.`,
        );
      }
    }
  }

  for (const requiredRouteId of options.requiredRouteIds ?? []) {
    if (!routeIds.has(requiredRouteId)) {
      throw new Error(`Missing required route "${requiredRouteId}".`);
    }
  }

  return Object.freeze(routes.map((route) => Object.freeze({ ...route })));
}

const coreRouteFragment = [
  {
    id: "home.en",
    localePairId: "home",
    locale: "en",
    path: "/",
  },
  {
    id: "home.vi",
    localePairId: "home",
    locale: "vi",
    path: "/vi/",
  },
] as const satisfies RouteFragment;

export const routes = mergeRouteFragments(
  [
    coreRouteFragment,
    chaptersRouteFragment,
    playRouteFragment,
  ],
  {
    requiredRouteIds: ["home.en", "home.vi"],
  },
);
