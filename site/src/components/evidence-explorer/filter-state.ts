export const EXPLORER_FILTER_KEYS = [
  "q",
  "chapter",
  "status",
  "locale",
  "sourceType",
  "academicDisplay",
  "commercialRights",
  "verificationType",
] as const;

export type ExplorerFilterKey = (typeof EXPLORER_FILTER_KEYS)[number];
export type ExplorerFilterState = Readonly<Record<ExplorerFilterKey, string>>;

export interface ExplorerFilterEntry {
  readonly searchText: string;
  readonly chapter: string;
  readonly status: string;
  readonly locale: string;
  readonly sourceType: string;
  readonly academicDisplay: string;
  readonly commercialRights: string;
  readonly verificationType: string;
}

function emptyState(): Record<ExplorerFilterKey, string> {
  return {
    q: "",
    chapter: "",
    status: "",
    locale: "",
    sourceType: "",
    academicDisplay: "",
    commercialRights: "",
    verificationType: "",
  };
}

export function parseExplorerState(search: string | URLSearchParams): ExplorerFilterState {
  const parameters = typeof search === "string"
    ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
    : search;
  const state = emptyState();
  for (const key of EXPLORER_FILTER_KEYS) {
    state[key] = (parameters.get(key) ?? "").trim();
  }
  return Object.freeze(state);
}

export function serializeExplorerState(state: ExplorerFilterState): string {
  const parameters = new URLSearchParams();
  for (const key of EXPLORER_FILTER_KEYS) {
    const value = state[key].trim();
    if (value.length > 0) {
      parameters.set(key, value);
    }
  }
  return parameters.toString();
}

export function matchesExplorerEntry(
  entry: ExplorerFilterEntry,
  state: ExplorerFilterState,
): boolean {
  const query = state.q.toLocaleLowerCase();
  if (query.length > 0 && !entry.searchText.toLocaleLowerCase().includes(query)) {
    return false;
  }
  return EXPLORER_FILTER_KEYS
    .filter((key) => key !== "q")
    .every((key) => state[key].length === 0 || entry[key] === state[key]);
}

function stateFromForm(form: HTMLFormElement): ExplorerFilterState {
  const data = new FormData(form);
  const state = emptyState();
  for (const key of EXPLORER_FILTER_KEYS) {
    const value = data.get(key);
    state[key] = typeof value === "string" ? value.trim() : "";
  }
  return Object.freeze(state);
}

function entryFromElement(element: HTMLElement): ExplorerFilterEntry {
  return {
    searchText: element.dataset.searchText ?? "",
    chapter: element.dataset.chapter ?? "",
    status: element.dataset.status ?? "",
    locale: element.dataset.locale ?? "",
    sourceType: element.dataset.sourceType ?? "",
    academicDisplay: element.dataset.academicDisplay ?? "",
    commercialRights: element.dataset.commercialRights ?? "",
    verificationType: element.dataset.verificationType ?? "",
  };
}

function applyState(root: HTMLElement, state: ExplorerFilterState): void {
  const form = root.querySelector<HTMLFormElement>("[data-explorer-form]");
  if (!form) {
    return;
  }
  for (const key of EXPLORER_FILTER_KEYS) {
    const control = form.elements.namedItem(key);
    if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement) {
      control.value = state[key];
    }
  }

  const cards = [...root.querySelectorAll<HTMLElement>("[data-explorer-card]")];
  let visible = 0;
  for (const card of cards) {
    const matches = matchesExplorerEntry(entryFromElement(card), state);
    card.hidden = !matches;
    if (matches) {
      visible += 1;
    }
  }
  const count = root.querySelector<HTMLElement>("[data-explorer-count]");
  if (count) {
    count.textContent = String(visible);
  }
}

export function enhanceEvidenceExplorer(root: ParentNode = document): void {
  const explorer = root.querySelector<HTMLElement>("[data-evidence-explorer]");
  const form = explorer?.querySelector<HTMLFormElement>("[data-explorer-form]");
  if (!explorer || !form) {
    return;
  }

  const update = (state: ExplorerFilterState, replaceUrl: boolean): void => {
    applyState(explorer, state);
    if (replaceUrl) {
      const query = serializeExplorerState(state);
      const next = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
      window.history.replaceState(null, "", next);
    }
  };

  form.addEventListener("input", () => update(stateFromForm(form), true));
  form.addEventListener("change", () => update(stateFromForm(form), true));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    update(stateFromForm(form), true);
  });
  form.querySelector<HTMLElement>("[data-explorer-reset]")?.addEventListener("click", () => {
    form.reset();
    update(stateFromForm(form), true);
  });
  window.addEventListener("popstate", () => update(parseExplorerState(window.location.search), false));
  update(parseExplorerState(window.location.search), false);
}
