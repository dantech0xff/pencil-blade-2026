import generatedFacts from "../../generated/facts.json" with { type: "json" };
import publicationManifest from "../../../../reference/case-study-publication-manifest.json" with { type: "json" };
import sourceCatalog from "../../../../reference/case-study-public-source-catalog.json" with { type: "json" };
import academicDisplayDecision from "../../../../reference/case-study-academic-display-decision.json" with { type: "json" };
import commercialRightsManifest from "../../../../release/public-release-variant-manifest.json" with { type: "json" };

import type { Locale } from "../locales.ts";

export const DECISION_ACTOR_KINDS = [
  "human",
  "automation",
  "mixed",
  "unknown",
] as const;

export type DecisionActorKind = (typeof DECISION_ACTOR_KINDS)[number];
export type CanonicalStatus = "recovered" | "inferred" | "unknown";

export interface AiEpisodeRecord {
  readonly id: string;
  readonly locale: Locale;
  readonly order: number;
  readonly question: string;
  readonly evidence: readonly string[];
  readonly hypothesis: string;
  readonly reviewDecision: string;
  readonly decisionActorKind: DecisionActorKind;
  readonly decisionRef: string;
  readonly implementation: string;
  readonly verification: string;
  readonly failureLesson: string;
  readonly agentRoles: readonly string[];
  readonly publicSourceIds: readonly string[];
  readonly draft?: boolean;
}

interface CanonicalPresentation {
  readonly canonicalClaimId: string;
  readonly order: number;
  readonly claim: string;
  readonly status: CanonicalStatus;
  readonly evidenceTier: number;
  readonly confidence: number;
  readonly evidenceRefs: readonly string[];
  readonly contradictionIds: readonly string[];
  readonly contractEligible: boolean;
  readonly publicCopy: Readonly<Record<Locale, string>>;
  readonly publicExcerpt: Readonly<Record<Locale, string>>;
  readonly publicExplanation: Readonly<Record<Locale, string>>;
  readonly displayQualifier: Readonly<Record<Locale, string>>;
  readonly tags: readonly string[];
  readonly redaction: {
    readonly disposition: "public" | "redacted";
    readonly reason: Readonly<Record<Locale, string>>;
  };
  readonly publicSourceIds: readonly string[];
}

interface PublicSourceRecord {
  readonly sourceId: string;
  readonly publicSafeExcerpt: Readonly<Record<Locale, string>>;
  readonly publicLinkAllowed: boolean;
  readonly path: string;
  readonly lineRange: {
    readonly start: number;
    readonly end?: number;
  } | null;
}

export interface PublicSourcePresentation {
  readonly sourceId: string;
  readonly excerpt: string;
  readonly href: string | null;
  readonly linkKind: "direct" | "excerpt-only";
}

export interface EvidencePresentation {
  readonly id: string;
  readonly order: number;
  readonly copy: string;
  readonly excerpt: string;
  readonly explanation: string;
  readonly qualifier: string;
  readonly status: CanonicalStatus;
  readonly evidenceTier: number;
  readonly confidence: number;
  readonly contractEligible: boolean;
  readonly evidenceRefs: readonly string[];
  readonly contradictionIds: readonly string[];
  readonly tags: readonly string[];
  readonly publicSourceIds: readonly string[];
  readonly redactionDisposition: "public" | "redacted";
  readonly redactionReason: string;
}

export interface DisclosurePresentation {
  readonly assistanceLabel: string;
  readonly actorLabel: string;
  readonly decisionLabel: string;
  readonly verificationLabel: string;
  readonly actorKind: DecisionActorKind;
  readonly decisionRef: string;
}

export interface RightsLabels {
  readonly academicDisplay: {
    readonly status: string;
    readonly ref: string;
    readonly label: Readonly<Record<Locale, string>>;
  };
  readonly commercialRights: {
    readonly status: string;
    readonly ref: string;
    readonly label: Readonly<Record<Locale, string>>;
  };
}

export interface AiLabIndexEntry {
  readonly id: string;
  readonly locale: Locale;
  readonly order: number;
  readonly question: string;
  readonly reviewDecision: string;
  readonly decisionActorKind: DecisionActorKind;
  readonly decisionRef: string;
  readonly verification: string;
  readonly failureLesson: string;
  readonly publicSourceIds: readonly string[];
  readonly claims: readonly EvidencePresentation[];
  readonly disclosure: DisclosurePresentation;
  readonly rights: RightsLabels;
}

export interface EvidenceExplorerEntry extends EvidencePresentation {
  readonly locale: Locale;
  readonly chapter: "story" | "forensics" | "reconstruction" | "release";
  readonly sourceType: string;
  readonly verificationType: string;
  readonly academicDisplay: string;
  readonly commercialRights: string;
  readonly sources: readonly PublicSourcePresentation[];
}

export interface ExplorerFacets {
  readonly chapter: readonly string[];
  readonly status: readonly string[];
  readonly locale: readonly Locale[];
  readonly sourceType: readonly string[];
  readonly academicDisplay: readonly string[];
  readonly commercialRights: readonly string[];
  readonly verificationType: readonly string[];
}

const canonicalPresentations = generatedFacts.claimPresentations as readonly CanonicalPresentation[];
const canonicalById = new Map(
  canonicalPresentations.map((record) => [record.canonicalClaimId, record]),
);
const catalogRecords = sourceCatalog.sources as readonly PublicSourceRecord[];
const sourceById = new Map(catalogRecords.map((record) => [record.sourceId, record]));
const repositoryCommit = publicationManifest.restorationEvidenceSnapshot.repositoryCommit;

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function stableUnique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort((left, right) => left.localeCompare(right)));
}

function directSourceHref(source: PublicSourceRecord): string {
  const encodedPath = source.path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const lineRange = source.lineRange;
  const fragment = lineRange
    ? `#L${lineRange.start}${lineRange.end ? `-L${lineRange.end}` : ""}`
    : "";
  return `https://github.com/dantech0xff/pencil-blade-2026/blob/${repositoryCommit}/${encodedPath}${fragment}`;
}

function validateSourcePath(source: PublicSourceRecord): void {
  invariant(!source.path.startsWith("/"), `Absolute source path is forbidden for ${source.sourceId}.`);
  invariant(!source.path.includes("\\"), `Backslash source path is forbidden for ${source.sourceId}.`);
  invariant(
    source.path.split("/").every((segment) => segment.length > 0 && segment !== ".."),
    `Unsafe source path is forbidden for ${source.sourceId}.`,
  );
}

export function resolveCaseFileSources(
  refs: readonly string[],
  locale: Locale = "en",
): readonly PublicSourcePresentation[] {
  invariant(refs.length > 0, "A case file requires at least one public source reference.");
  return Object.freeze(refs.map((sourceId) => {
    const source = sourceById.get(sourceId);
    invariant(source, `Unknown public source reference: ${sourceId}`);
    validateSourcePath(source);
    return Object.freeze({
      sourceId,
      excerpt: source.publicSafeExcerpt[locale],
      href: source.publicLinkAllowed ? directSourceHref(source) : null,
      linkKind: source.publicLinkAllowed ? "direct" : "excerpt-only",
    });
  }));
}

export function resolveEvidencePresentation(
  canonicalClaimId: string,
  locale: Locale,
): EvidencePresentation {
  const canonical = canonicalById.get(canonicalClaimId);
  invariant(canonical, `Unknown canonical claim: ${canonicalClaimId}`);
  return Object.freeze({
    id: canonical.canonicalClaimId,
    order: canonical.order,
    copy: canonical.publicCopy[locale],
    excerpt: canonical.publicExcerpt[locale],
    explanation: canonical.publicExplanation[locale],
    qualifier: canonical.displayQualifier[locale],
    status: canonical.status,
    evidenceTier: canonical.evidenceTier,
    confidence: canonical.confidence,
    contractEligible: canonical.contractEligible,
    evidenceRefs: Object.freeze([...canonical.evidenceRefs]),
    contradictionIds: Object.freeze([...canonical.contradictionIds]),
    tags: Object.freeze([...canonical.tags]),
    publicSourceIds: Object.freeze([...canonical.publicSourceIds]),
    redactionDisposition: canonical.redaction.disposition,
    redactionReason: canonical.redaction.reason[locale],
  });
}

export function resolveRightsLabels(): RightsLabels {
  return Object.freeze({
    academicDisplay: Object.freeze({
      status: "text-only-no-media-claim",
      ref: publicationManifest.academicDisplayDecisionRef,
      label: Object.freeze({
        en: "Editorial text only; no standalone recovered media is claimed.",
        vi: "Chỉ có văn bản biên tập; không tuyên bố quyền hiển thị media phục hồi độc lập.",
      }),
    }),
    commercialRights: Object.freeze({
      status: commercialRightsManifest.releaseDecision.status,
      ref: publicationManifest.commercialRightsRecordRef,
      label: Object.freeze({
        en: "Commercial rights remain blocked and unresolved.",
        vi: "Quyền thương mại vẫn bị chặn và chưa được làm rõ.",
      }),
    }),
  });
}

export function resolveDisclosureBadge(record: AiEpisodeRecord): DisclosurePresentation {
  invariant(
    DECISION_ACTOR_KINDS.includes(record.decisionActorKind),
    `Unsupported decision actor kind: ${String(record.decisionActorKind)}`,
  );
  invariant(sourceById.has(record.decisionRef), `Unknown decision reference: ${record.decisionRef}`);
  if (record.decisionActorKind === "human") {
    throw new Error(
      "No public-safe human sign-off source is registered; human-reviewed wording is unavailable.",
    );
  }
  return Object.freeze({
    assistanceLabel: record.locale === "vi" ? "AI hỗ trợ có giới hạn" : "Bounded AI assistance",
    actorLabel: record.locale === "vi"
      ? `Loại tác nhân quyết định: ${record.decisionActorKind}`
      : `Decision actor kind: ${record.decisionActorKind}`,
    decisionLabel: record.reviewDecision,
    verificationLabel: record.verification,
    actorKind: record.decisionActorKind,
    decisionRef: record.decisionRef,
  });
}

export function validateAiEpisode(record: AiEpisodeRecord): readonly string[] {
  const errors: string[] = [];
  const requiredText = [
    "id",
    "question",
    "hypothesis",
    "reviewDecision",
    "decisionRef",
    "implementation",
    "verification",
    "failureLesson",
  ] as const;
  for (const field of requiredText) {
    if (typeof record[field] !== "string" || record[field].trim().length === 0) {
      errors.push(`${field} must be a non-empty string.`);
    }
  }
  if (!DECISION_ACTOR_KINDS.includes(record.decisionActorKind)) {
    errors.push("decisionActorKind is invalid.");
  }
  if (record.decisionActorKind === "human") {
    errors.push("No public-safe human sign-off source is registered.");
  }
  if (!Array.isArray(record.evidence) || record.evidence.length === 0) {
    errors.push("evidence must contain canonical claim IDs.");
  } else {
    for (const claimId of record.evidence) {
      if (!canonicalById.has(claimId)) {
        errors.push(`Unknown canonical claim: ${claimId}.`);
      }
    }
  }
  if (!Array.isArray(record.publicSourceIds) || record.publicSourceIds.length === 0) {
    errors.push("publicSourceIds must contain allowlisted source IDs.");
  } else {
    for (const sourceId of record.publicSourceIds) {
      if (!sourceById.has(sourceId)) {
        errors.push(`Unknown public source: ${sourceId}.`);
      }
    }
  }
  if (!sourceById.has(record.decisionRef)) {
    errors.push(`Unknown decision reference: ${record.decisionRef}.`);
  }
  return Object.freeze(errors);
}

export function validateLocaleParity(
  en: AiEpisodeRecord,
  vi: AiEpisodeRecord,
): readonly string[] {
  const errors: string[] = [];
  const scalarFields = ["id", "order", "decisionActorKind", "decisionRef"] as const;
  for (const field of scalarFields) {
    if (en[field] !== vi[field]) {
      errors.push(`${field} must match across locales.`);
    }
  }
  const arrayFields = ["evidence", "agentRoles", "publicSourceIds"] as const;
  for (const field of arrayFields) {
    if (JSON.stringify(en[field]) !== JSON.stringify(vi[field])) {
      errors.push(`${field} must preserve identical IDs and order across locales.`);
    }
  }
  if (en.locale !== "en" || vi.locale !== "vi") {
    errors.push("Locale pair must be ordered en then vi.");
  }
  return Object.freeze(errors);
}

export function buildAiLabIndex(
  manifest: typeof publicationManifest,
  content: readonly AiEpisodeRecord[],
): readonly AiLabIndexEntry[] {
  invariant(
    manifest.restorationEvidenceSnapshot.snapshotId
      === generatedFacts.snapshot.snapshotId,
    "AI Lab must use the generated restorationEvidenceSnapshot.",
  );
  return Object.freeze(
    content
      .filter((record) => record.draft !== true)
      .map((record) => {
        const errors = validateAiEpisode(record);
        invariant(errors.length === 0, `${record.id}: ${errors.join(" ")}`);
        return Object.freeze({
          id: record.id,
          locale: record.locale,
          order: record.order,
          question: record.question,
          reviewDecision: record.reviewDecision,
          decisionActorKind: record.decisionActorKind,
          decisionRef: record.decisionRef,
          verification: record.verification,
          failureLesson: record.failureLesson,
          publicSourceIds: Object.freeze([...record.publicSourceIds]),
          claims: Object.freeze(
            record.evidence.map((claimId) =>
              resolveEvidencePresentation(claimId, record.locale)),
          ),
          disclosure: resolveDisclosureBadge(record),
          rights: resolveRightsLabels(),
        });
      })
      .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id)),
  );
}

function chapterFor(record: EvidencePresentation): EvidenceExplorerEntry["chapter"] {
  if (record.tags.some((tag) => tag === "rights" || tag === "release")) {
    return "release";
  }
  if (record.tags.some((tag) => ["apk", "provenance"].includes(tag))) {
    return "story";
  }
  if (record.tags.some((tag) => [
    "native",
    "resources",
    "inventory",
    "manifest",
    "java",
    "engine",
  ].includes(tag))) {
    return "forensics";
  }
  return "reconstruction";
}

function sourceTypeFor(sourceIds: readonly string[]): string {
  if (sourceIds.some((id) => id.includes("RIGHTS"))) {
    return "rights-record";
  }
  if (sourceIds.some((id) => id.includes("PHYSICS"))) {
    return "runtime-probe";
  }
  if (sourceIds.some((id) => id.includes("RESOURCE"))) {
    return "resource-ledger";
  }
  if (sourceIds.some((id) => id.includes("NATIVE"))) {
    return "native-index";
  }
  if (sourceIds.some((id) => id.includes("RUNTIME") || id.includes("CLOSEOUT"))) {
    return "runtime-report";
  }
  return "canonical-ledger";
}

export function renderEvidenceCard(
  record: EvidencePresentation,
  locale: Locale,
): EvidenceExplorerEntry {
  const rights = resolveRightsLabels();
  return Object.freeze({
    ...record,
    locale,
    chapter: chapterFor(record),
    sourceType: sourceTypeFor(record.publicSourceIds),
    verificationType: record.contractEligible ? "contract-eligible" : "disclosed-limit",
    academicDisplay: rights.academicDisplay.status,
    commercialRights: rights.commercialRights.status,
    sources: resolveCaseFileSources(record.publicSourceIds, locale),
  });
}

export function buildEvidenceExplorerEntries(
  locale: Locale,
): readonly EvidenceExplorerEntry[] {
  return Object.freeze(
    canonicalPresentations
      .map((record) =>
        renderEvidenceCard(
          resolveEvidencePresentation(record.canonicalClaimId, locale),
          locale,
        ))
      .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id)),
  );
}

export function buildExplorerFilters(
  entries: readonly EvidenceExplorerEntry[],
): ExplorerFacets {
  return Object.freeze({
    chapter: stableUnique(entries.map((entry) => entry.chapter)),
    status: stableUnique(entries.map((entry) => entry.status)),
    locale: Object.freeze(["en", "vi"] as const),
    sourceType: stableUnique(entries.map((entry) => entry.sourceType)),
    academicDisplay: stableUnique(entries.map((entry) => entry.academicDisplay)),
    commercialRights: stableUnique(entries.map((entry) => entry.commercialRights)),
    verificationType: stableUnique(entries.map((entry) => entry.verificationType)),
  });
}

export function getAiLabPublicationManifest(): typeof publicationManifest {
  return publicationManifest;
}

export const aiLabEvidenceSnapshotId = generatedFacts.snapshot.snapshotId;
export const academicDisplayDecisionStatus = academicDisplayDecision.decisionStatus;
