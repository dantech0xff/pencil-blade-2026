export function enhanceEvidenceDrawers(root: ParentNode = document): void {
  root.querySelectorAll<HTMLDetailsElement>("[data-evidence-drawer]").forEach((drawer) => {
    const summary = drawer.querySelector<HTMLElement>("summary");
    const close = drawer.querySelector<HTMLButtonElement>("[data-evidence-close]");
    if (!summary || !close) return;

    close.hidden = false;
    close.addEventListener("click", () => {
      drawer.open = false;
      summary.focus();
    });
    drawer.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && drawer.open) {
        event.preventDefault();
        drawer.open = false;
        summary.focus();
      }
    });
  });
}
