const SELECTOR = "[data-contract-trace]";
const replayTimers = new WeakMap<HTMLElement, number>();

function stopReplay(root: HTMLElement): void {
  const timer = replayTimers.get(root);
  if (timer !== undefined) {
    window.clearInterval(timer);
    replayTimers.delete(root);
  }
  root.dataset.replaying = "false";
}

function showStep(root: HTMLElement, requestedIndex: number, showAll = false): void {
  const steps = [...root.querySelectorAll<HTMLElement>("[data-trace-step]")];
  const tabs = [...root.querySelectorAll<HTMLButtonElement>("[data-trace-tab]")];
  const index = Math.max(0, Math.min(steps.length - 1, requestedIndex));

  steps.forEach((step, stepIndex) => {
    step.hidden = !showAll && stepIndex !== index;
  });
  tabs.forEach((tab, tabIndex) => {
    tab.setAttribute("aria-selected", String(!showAll && tabIndex === index));
    tab.tabIndex = tabIndex === index ? 0 : -1;
  });
  root.dataset.selectedStep = showAll ? "all" : String(index);
}

function replay(root: HTMLElement): void {
  stopReplay(root);
  const steps = [...root.querySelectorAll<HTMLElement>("[data-trace-step]")];
  if (steps.length === 0) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    showStep(root, 0, true);
    return;
  }
  let index = 0;
  root.dataset.replaying = "true";
  showStep(root, index);
  const timer = window.setInterval(() => {
    index += 1;
    if (index >= steps.length) {
      stopReplay(root);
      showStep(root, 0, true);
      return;
    }
    showStep(root, index);
  }, 900);
  replayTimers.set(root, timer);
}

function enhance(root: HTMLElement): void {
  if (root.dataset.enhanced === "true") return;
  root.dataset.enhanced = "true";

  const tabs = [...root.querySelectorAll<HTMLButtonElement>("[data-trace-tab]")];
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      stopReplay(root);
      showStep(root, index);
    });
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next]?.focus();
      stopReplay(root);
      showStep(root, next);
    });
  });

  root.querySelector<HTMLButtonElement>("[data-trace-replay]")
    ?.addEventListener("click", () => replay(root));
  root.querySelector<HTMLButtonElement>("[data-trace-stop]")
    ?.addEventListener("click", () => stopReplay(root));
  root.querySelector<HTMLButtonElement>("[data-trace-show-all]")
    ?.addEventListener("click", () => {
      stopReplay(root);
      showStep(root, 0, true);
    });
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      stopReplay(root);
      showStep(root, 0, true);
    }
  });

  showStep(
    root,
    0,
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
}

export function enhanceContractTraces(scope: ParentNode = document): void {
  scope.querySelectorAll<HTMLElement>(SELECTOR).forEach(enhance);
}
