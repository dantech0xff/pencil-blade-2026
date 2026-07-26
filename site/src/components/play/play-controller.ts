export function toggleFullscreen(container: HTMLElement): Promise<void> {
  if (document.fullscreenElement === container) {
    return document.exitFullscreen();
  }
  return container.requestFullscreen();
}

export function enhancePlayLauncher(root: HTMLElement): void {
  const load = root.querySelector<HTMLButtonElement>("[data-play-load]");
  const fullscreen = root.querySelector<HTMLButtonElement>("[data-play-fullscreen]");
  const stage = root.querySelector<HTMLElement>("[data-play-stage]");
  const error = root.querySelector<HTMLElement>("[data-play-error]");
  const gameUrl = root.dataset.gameUrl;
  const frameTitle = root.dataset.frameTitle;
  if (!load || !fullscreen || !stage || !error || !gameUrl || !frameTitle) return;

  load.addEventListener("click", () => {
    if (stage.querySelector("iframe")) return;
    const frame = document.createElement("iframe");
    frame.title = frameTitle;
    frame.allowFullscreen = true;
    frame.loading = "eager";
    frame.src = gameUrl;
    frame.addEventListener("load", () => {
      error.hidden = true;
      fullscreen.disabled = false;
      load.disabled = true;
    }, { once: true });
    frame.addEventListener("error", () => {
      error.hidden = false;
      fullscreen.disabled = true;
    });
    stage.replaceChildren(frame);
  });

  fullscreen.addEventListener("click", async () => {
    try {
      await toggleFullscreen(stage);
    } catch {
      error.hidden = false;
    }
  });
}
