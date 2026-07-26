export function observeReveal(root: ParentNode = document): void {
  const targets = [...root.querySelectorAll<HTMLElement>("[data-reveal]")];
  if (targets.length === 0) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    targets.forEach((target) => target.dataset.revealState = "visible");
    return;
  }

  targets.forEach((target) => target.dataset.revealState = "pending");
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      (entry.target as HTMLElement).dataset.revealState = "visible";
      observer.unobserve(entry.target);
    }
  }, { rootMargin: "0px 0px -8% 0px" });
  targets.forEach((target) => observer.observe(target));
}
