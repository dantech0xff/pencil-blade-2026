import { enhanceEvidenceExplorer } from "../components/evidence-explorer/filter-state.ts";
import { enhancePlayLauncher } from "../components/play/play-controller.ts";
import { enhanceApkDissections } from "./apk-dissection.ts";
import { enhanceContractTraces } from "./contract-trace.ts";
import { enhanceEvidenceDrawers } from "./evidence-drawer.ts";
import { observeReveal } from "./observe-reveal.ts";

enhanceEvidenceDrawers();
observeReveal();
enhanceApkDissections();
enhanceContractTraces();
enhanceEvidenceExplorer();

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
