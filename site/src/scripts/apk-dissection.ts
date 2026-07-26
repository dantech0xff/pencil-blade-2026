const SELECTOR = "[data-apk-dissection]";

function setLayer(root: HTMLElement, requestedIndex: number, showAll = false): void {
  const panels = [...root.querySelectorAll<HTMLElement>("[data-apk-layer]")];
  const buttons = [...root.querySelectorAll<HTMLButtonElement>("[data-apk-layer-button]")];
  const range = root.querySelector<HTMLInputElement>("[data-apk-range]");
  const index = Math.max(0, Math.min(panels.length - 1, requestedIndex));

  panels.forEach((panel, panelIndex) => {
    panel.hidden = !showAll && panelIndex !== index;
  });
  buttons.forEach((button, buttonIndex) => {
    button.setAttribute("aria-pressed", String(!showAll && buttonIndex === index));
  });
  if (range && panels[index]) {
    const title = panels[index].querySelector("h3")?.textContent?.trim() ?? "";
    range.value = String(index + 1);
    range.setAttribute("aria-valuenow", String(index + 1));
    range.setAttribute(
      "aria-valuetext",
      `${index + 1} / ${panels.length}: ${title}`,
    );
  }
  root.dataset.selectedLayer = showAll ? "all" : String(index);
}

function enhance(root: HTMLElement): void {
  if (root.dataset.enhanced === "true") return;
  root.dataset.enhanced = "true";

  const buttons = [...root.querySelectorAll<HTMLButtonElement>("[data-apk-layer-button]")];
  const range = root.querySelector<HTMLInputElement>("[data-apk-range]");
  const showAll = root.querySelector<HTMLButtonElement>("[data-apk-show-all]");

  buttons.forEach((button, index) => {
    button.addEventListener("click", () => setLayer(root, index));
    button.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
      setLayer(root, next);
    });
  });
  range?.addEventListener("input", () => setLayer(root, Number(range.value) - 1));
  showAll?.addEventListener("click", () => setLayer(root, 0, true));
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setLayer(root, 0, true);
  });

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  setLayer(root, 0, reduceMotion);
}

export function enhanceApkDissections(scope: ParentNode = document): void {
  scope.querySelectorAll<HTMLElement>(SELECTOR).forEach(enhance);
}
