import manifest from "../../../reference/case-study-publication-manifest.json" with { type: "json" };
import { SITE_BASE } from "./routes.ts";

interface MediaRecord {
  mediaId: string;
  publishable?: boolean;
  provenance: {
    path: string;
    files?: number;
    bytes?: number;
    treeDigestSha256?: string;
    sha256?: string;
    width?: number;
    height?: number;
  };
  academicDisplayDecisionRef: string;
  commercialRightsRecordRef: string;
}

const media = manifest.media as MediaRecord[];

function requireMedia(mediaId: string): MediaRecord {
  const record = media.find((candidate) => candidate.mediaId === mediaId);
  if (!record) {
    throw new Error(`Required publication media is missing: ${mediaId}.`);
  }
  return record;
}

const h5Tree = requireMedia("MEDIA-H5-AUDITED-TREE");
const preview = requireMedia("MEDIA-PLAY-PREVIEW-SHARED");

export function resolvePlayMount(prefix = SITE_BASE): string {
  const normalized = `/${prefix.split("/").filter(Boolean).join("/")}/`;
  if (normalized.includes("..") || /[:?#]/u.test(normalized)) {
    throw new Error(`Invalid Pages prefix: ${prefix}`);
  }
  return `${normalized}play/game/`;
}

export function shouldLoadGame(interactionState: "idle" | "requested" | "loaded" | "failed"): boolean {
  return interactionState === "requested" || interactionState === "loaded";
}

export function renderFallbackState(reason: "javascript" | "frame-error" | "unsupported"): string {
  const labels = {
    javascript: "JavaScript is unavailable. Use the direct audited H5 link or the text walkthrough.",
    "frame-error": "The embedded reconstruction could not load. Use the direct audited H5 link.",
    unsupported: "This browser cannot embed the reconstruction. The static proof remains available.",
  } as const;
  return labels[reason];
}

export function buildPlayDisclosure(locale: "en" | "vi") {
  const bytes = h5Tree.provenance.bytes ?? 0;
  const mebibytes = (bytes / 1024 / 1024).toFixed(1);
  return Object.freeze({
    locale,
    files: h5Tree.provenance.files,
    bytes,
    mebibytes,
    treeDigestSha256: h5Tree.provenance.treeDigestSha256,
    gameUrl: resolvePlayMount(),
    academicDisplayDecisionRef: h5Tree.academicDisplayDecisionRef,
    commercialRightsRecordRef: h5Tree.commercialRightsRecordRef,
    originalRuntimeObserved: false,
    previewMediaId: preview.mediaId,
    previewPath: preview.provenance.path,
    previewSha256: preview.provenance.sha256,
  });
}

export function validatePlayRights(metadata: ReturnType<typeof buildPlayDisclosure>): void {
  if (!metadata.academicDisplayDecisionRef || !metadata.commercialRightsRecordRef) {
    throw new Error("Play disclosure requires separate academic-display and commercial-rights references.");
  }
  if (metadata.originalRuntimeObserved !== false) {
    throw new Error("The Play route cannot claim original-runtime observation.");
  }
}

export const playFacts = Object.freeze({
  h5Tree,
  preview,
  en: buildPlayDisclosure("en"),
  vi: buildPlayDisclosure("vi"),
});

validatePlayRights(playFacts.en);
validatePlayRights(playFacts.vi);
