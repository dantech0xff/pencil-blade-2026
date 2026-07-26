import { enhancePlayLauncher } from "../components/play/play-controller.ts";
import { enhanceContractTraces } from "./contract-trace.ts";
import { observeReveal } from "./observe-reveal.ts";

observeReveal();
enhanceContractTraces();

document.querySelectorAll<HTMLElement>("[data-play-launcher]").forEach(enhancePlayLauncher);

if (location.hash) {
  let targetExists = false;
  try {
    targetExists = document.querySelector(location.hash) !== null;
  } catch {
    targetExists = false;
  }
  if (targetExists) {
    document.querySelectorAll<HTMLAnchorElement>("[data-locale-switcher]").forEach((switcher) => {
      const destination = new URL(switcher.href);
      destination.hash = location.hash;
      switcher.href = destination.href;
    });
  }
}
