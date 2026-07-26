export const PUBLIC_ROUTES = Object.freeze([
  '/',
  '/forensics/',
  '/play/',
  '/play/game/',
  '/vi/',
  '/vi/forensics/',
  '/vi/play/',
]);

export const REQUIRED_CASE_STUDY_ROUTES = Object.freeze(
  PUBLIC_ROUTES.filter((route) => route !== '/play/game/'),
);

export const FORBIDDEN_PUBLIC_ROUTES = Object.freeze([
  '/about/',
  '/ai-lab/',
  '/evidence/',
  '/reconstruction/',
  '/story/',
  '/vi/about/',
  '/vi/ai-lab/',
  '/vi/evidence/',
  '/vi/reconstruction/',
  '/vi/story/',
]);

export function hasExpectedPublicRoutes(routes) {
  return JSON.stringify(routes) === JSON.stringify(PUBLIC_ROUTES);
}

export function routeToFile(route) {
  const segments = route.split('/').filter(Boolean);
  return segments.length === 0 ? 'index.html' : `${segments.join('/')}/index.html`;
}

export function assertRequiredPublicRouteFiles(paths, label = 'candidate') {
  const filePaths = paths instanceof Set ? paths : new Set(paths);
  for (const route of PUBLIC_ROUTES) {
    const path = routeToFile(route);
    if (!filePaths.has(path)) {
      throw new Error(`${label} is missing required public route ${route}: ${path}`);
    }
  }
}

export function assertExactPublicRouteFiles(paths, label = 'candidate') {
  const filePaths = paths instanceof Set ? paths : new Set(paths);
  const expectedPublicFiles = new Set(
    PUBLIC_ROUTES.map((route) => routeToFile(route)),
  );

  for (const path of filePaths) {
    const lowerPath = path.toLowerCase();
    if (path === '404.html' || !/\.html?$/u.test(lowerPath)) {
      continue;
    }
    if (!expectedPublicFiles.has(path)) {
      throw new Error(`${label} contains unexpected public HTML route: ${path}`);
    }
  }
}

export function forbiddenRouteForFile(path) {
  return FORBIDDEN_PUBLIC_ROUTES.find((route) => {
    const routeDirectory = route.slice(1);
    return path.startsWith(routeDirectory);
  });
}

export function assertNoForbiddenRouteFiles(paths, label = 'candidate') {
  for (const path of paths) {
    const route = forbiddenRouteForFile(path);
    if (route) {
      throw new Error(`${label} contains removed public route ${route}: ${path}`);
    }
  }
}

export function assertExactSitemapRoutes(
  sitemapSources,
  pagesPrefix,
  label = 'candidate sitemap',
) {
  if (
    typeof pagesPrefix !== 'string'
    || !pagesPrefix.startsWith('/')
    || !pagesPrefix.endsWith('/')
  ) {
    throw new Error('pagesPrefix must start and end with "/"');
  }

  const expectedPathnames = new Map(
    REQUIRED_CASE_STUDY_ROUTES.map((route) => [
      `${pagesPrefix}${route.slice(1)}`,
      route,
    ]),
  );
  const observedPathnames = new Set();

  for (const source of sitemapSources) {
    for (const match of source.matchAll(/<loc>([^<]+)<\/loc>/giu)) {
      const pathname = new URL(match[1]).pathname;
      if (/(?:^|\/)sitemap(?:-index|-\d+)?\.xml$/iu.test(pathname)) {
        continue;
      }
      if (!expectedPathnames.has(pathname)) {
        throw new Error(`${label} contains unexpected public URL: ${pathname}`);
      }
      if (observedPathnames.has(pathname)) {
        throw new Error(`${label} contains duplicate public URL: ${pathname}`);
      }
      observedPathnames.add(pathname);
    }
  }

  for (const [pathname, route] of expectedPathnames) {
    if (!observedPathnames.has(pathname)) {
      throw new Error(`${label} is missing required public route ${route}`);
    }
  }
}

export function assertNoForbiddenSitemapUrls(sitemapSources, label = 'candidate sitemap') {
  for (const source of sitemapSources) {
    for (const match of source.matchAll(/<loc>([^<]+)<\/loc>/giu)) {
      const pathname = new URL(match[1]).pathname;
      const route = FORBIDDEN_PUBLIC_ROUTES.find((candidate) =>
        pathname.includes(candidate));
      if (route) {
        throw new Error(`${label} contains removed public route ${route}: ${pathname}`);
      }
    }
  }
}
