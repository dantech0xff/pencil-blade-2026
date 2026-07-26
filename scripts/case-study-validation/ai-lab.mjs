export const fragmentId = 'ai-lab';

const DECISION_ACTOR_KINDS = Object.freeze([
  'human',
  'automation',
  'mixed',
  'unknown',
]);
const FORBIDDEN_FIELD_NAMES = new Set([
  'rawchat',
  'rawtranscript',
  'prompt',
  'systemprompt',
  'chainofthought',
  'hiddencot',
  'hiddenmessage',
  'hiddenmessages',
  'messages',
  'chathistory',
  'privatereviewnotes',
]);
const AUTHORITY_OVERRIDE_FIELDS = new Set([
  'status',
  'canonicalstatus',
  'evidencetier',
  'confidence',
  'contradictionids',
  'contracteligible',
  'sourcepath',
  'evidencepath',
  'authoritypath',
  'currentreport',
]);
const PRIVATE_PATH_PATTERN =
  /(?:file:\/\/|\/Users\/|\/home\/|[A-Za-z]:\\|(?:^|[/"'])(?:\.forensics-work|offline-evidence|jadx-output|apktool-output|reference\/historical-media\/raw|reference\/external-material)\/)/u;
const DENIED_ARTIFACT_PATTERN =
  /(?:^|[\s"'(/\\])[^ \n"'()]*\.(?:apk|apks|xapk|so|gpr|i64|idb|jks|keystore)(?:$|[\s"'()])/iu;
const HUMAN_WORDING_PATTERN = /\bhuman\s+(?:reviewed|accepted|rejected)\b/iu;
const UNVERIFIED_MODEL_PATTERN = /\b(?:ChatGPT|Claude|Gemini|GPT-\d|model session)\b/iu;

function finding(code, path, message) {
  return { code, path, message };
}

function entryData(entry) {
  return entry?.data && typeof entry.data === 'object' ? entry.data : entry;
}

function normalizeFieldName(name) {
  return String(name).replaceAll(/[-_.\s]/gu, '').toLowerCase();
}

function walk(value, pointer, visit) {
  visit(value, pointer);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walk(entry, `${pointer}[${index}]`, visit));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, entry]) =>
      walk(entry, `${pointer}.${key}`, visit));
  }
}

function sourceRecords(context) {
  return context.sourceCatalog?.sources ?? [];
}

function canonicalRecords(context) {
  return context.canonicalClaims ?? [];
}

function mediaRecords(context) {
  return context.publicationManifest?.media ?? [];
}

function requiredFields(context) {
  return context.publicationManifest?.aiEpisodeContract?.requiredFields ?? [
    'id',
    'question',
    'evidence',
    'hypothesis',
    'reviewDecision',
    'decisionActorKind',
    'decisionRef',
    'implementation',
    'verification',
    'failureLesson',
    'reportRefs',
  ];
}

function publicSourceRefs(record) {
  return Array.isArray(record?.publicSourceIds)
    ? record.publicSourceIds
    : Array.isArray(record?.reportRefs)
      ? record.reportRefs
      : [];
}

function validatePathPayloads(record, pointer) {
  const findings = [];
  walk(record, pointer, (value, valuePointer) => {
    if (typeof value !== 'string') {
      return;
    }
    if (PRIVATE_PATH_PATTERN.test(value)) {
      findings.push(
        finding(
          'AI_PRIVATE_PATH',
          valuePointer,
          'AI Lab content may not expose machine-local or denied repository paths.',
        ),
      );
    }
    if (DENIED_ARTIFACT_PATTERN.test(value)) {
      findings.push(
        finding(
          'AI_DENIED_ARTIFACT_PATH',
          valuePointer,
          'AI Lab content may mention restricted artifacts only as names, never as paths or downloads.',
        ),
      );
    }
  });
  return findings;
}

export function validateAiEpisode(record, context = {}, pointer = '$.episode') {
  const findings = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return [
      finding('INVALID_AI_EPISODE', pointer, 'AI episode must be an object.'),
    ];
  }

  const sourceById = new Map(
    sourceRecords(context).map((source) => [source.sourceId, source]),
  );
  const claimById = new Map(
    canonicalRecords(context).map((claim) => [claim.id, claim]),
  );
  const mediaById = new Map(
    mediaRecords(context).map((media) => [media.mediaId, media]),
  );

  for (const field of requiredFields(context)) {
    const effectiveField = field === 'reportRefs' && record.reportRefs === undefined
      ? 'publicSourceIds'
      : field;
    const value = record[effectiveField];
    if (
      value === undefined
      || value === null
      || (typeof value === 'string' && value.trim().length === 0)
      || (Array.isArray(value) && value.length === 0)
    ) {
      findings.push(
        finding(
          'MISSING_AI_EPISODE_FIELD',
          `${pointer}.${effectiveField}`,
          `AI episode requires ${effectiveField}.`,
        ),
      );
    }
  }

  for (const [key] of Object.entries(record)) {
    const normalized = normalizeFieldName(key);
    if (FORBIDDEN_FIELD_NAMES.has(normalized)) {
      findings.push(
        finding(
          'FORBIDDEN_AI_PAYLOAD_FIELD',
          `${pointer}.${key}`,
          `Raw conversation or hidden-reasoning field ${key} is forbidden.`,
        ),
      );
    }
    if (AUTHORITY_OVERRIDE_FIELDS.has(normalized)) {
      findings.push(
        finding(
          'AI_AUTHORITY_OVERRIDE',
          `${pointer}.${key}`,
          `${key} must be joined from the canonical frozen projection, not authored in an episode.`,
        ),
      );
    }
  }

  walk(record, pointer, (value, valuePointer) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return;
    }
    for (const key of Object.keys(value)) {
      const normalized = normalizeFieldName(key);
      if (FORBIDDEN_FIELD_NAMES.has(normalized)) {
        findings.push(
          finding(
            'FORBIDDEN_AI_PAYLOAD_FIELD',
            `${valuePointer}.${key}`,
            `Nested raw conversation or hidden-reasoning field ${key} is forbidden.`,
          ),
        );
      }
    }
  });
  findings.push(...validatePathPayloads(record, pointer));

  if (!DECISION_ACTOR_KINDS.includes(record.decisionActorKind)) {
    findings.push(
      finding(
        'INVALID_DECISION_ACTOR_KIND',
        `${pointer}.decisionActorKind`,
        `Expected one of ${DECISION_ACTOR_KINDS.join(', ')}.`,
      ),
    );
  }

  const decisionSource = sourceById.get(record.decisionRef);
  if (!decisionSource) {
    findings.push(
      finding(
        'UNKNOWN_DECISION_REF',
        `${pointer}.decisionRef`,
        'decisionRef must resolve through the public source catalog.',
      ),
    );
  }
  const publicRefs = publicSourceRefs(record);
  if (!publicRefs.includes(record.decisionRef)) {
    findings.push(
      finding(
        'DECISION_REF_NOT_CITED',
        `${pointer}.decisionRef`,
        'decisionRef must also appear in the episode public-source references.',
      ),
    );
  }

  publicRefs.forEach((sourceId, index) => {
    const source = sourceById.get(sourceId);
    if (!source) {
      findings.push(
        finding(
          'UNKNOWN_AI_SOURCE_REF',
          `${pointer}.publicSourceIds[${index}]`,
          `Unknown or non-allowlisted source ${String(sourceId)}.`,
        ),
      );
      return;
    }
    if (
      typeof source.path !== 'string'
      || source.path.startsWith('/')
      || source.path.includes('\\')
      || source.path.split('/').includes('..')
    ) {
      findings.push(
        finding(
          'UNSAFE_AI_SOURCE_PATH',
          `${pointer}.publicSourceIds[${index}]`,
          `Catalog source ${sourceId} has an unsafe repository path.`,
        ),
      );
    }
  });

  if (!Array.isArray(record.evidence) || record.evidence.length === 0) {
    findings.push(
      finding(
        'MISSING_AI_EVIDENCE',
        `${pointer}.evidence`,
        'AI episode requires at least one canonical claim ID.',
      ),
    );
  } else {
    record.evidence.forEach((evidence, index) => {
      if (typeof evidence !== 'string') {
        findings.push(
          finding(
            'AI_AUTHORITY_OVERRIDE',
            `${pointer}.evidence[${index}]`,
            'Evidence joins must use canonical IDs only; authored claim objects are forbidden.',
          ),
        );
      } else if (!claimById.has(evidence)) {
        findings.push(
          finding(
            'UNKNOWN_AI_EVIDENCE_REF',
            `${pointer}.evidence[${index}]`,
            `Unknown canonical claim ${evidence}.`,
          ),
        );
      }
    });
  }

  const prose = [
    record.question,
    record.hypothesis,
    record.reviewDecision,
    record.implementation,
    record.verification,
    record.failureLesson,
  ].filter((value) => typeof value === 'string').join('\n');
  const hasPublicHumanSignoff = decisionSource?.publicHumanSignoff === true;
  if (
    record.decisionActorKind === 'human'
    && !hasPublicHumanSignoff
  ) {
    findings.push(
      finding(
        'MISSING_PUBLIC_HUMAN_SIGNOFF',
        `${pointer}.decisionRef`,
        'Human decision wording requires a cataloged public-safe human sign-off.',
      ),
    );
  }
  if (
    HUMAN_WORDING_PATTERN.test(prose)
    && (record.decisionActorKind !== 'human' || !hasPublicHumanSignoff)
  ) {
    findings.push(
      finding(
        'UNSUPPORTED_HUMAN_REVIEW_WORDING',
        pointer,
        'Human reviewed/accepted/rejected wording requires a human actor and public sign-off.',
      ),
    );
  }
  if (UNVERIFIED_MODEL_PATTERN.test(prose)) {
    findings.push(
      finding(
        'UNVERIFIED_AI_MODEL_NAME',
        pointer,
        'Model or session names are not verified public evidence.',
      ),
    );
  }

  if (record.mediaRefs !== undefined && !Array.isArray(record.mediaRefs)) {
    findings.push(
      finding('INVALID_AI_MEDIA_REFS', `${pointer}.mediaRefs`, 'mediaRefs must be an array.'),
    );
  }
  for (const [index, mediaId] of (record.mediaRefs ?? []).entries()) {
    const media = mediaById.get(mediaId);
    if (!media) {
      findings.push(
        finding(
          'UNAPPROVED_AI_MEDIA',
          `${pointer}.mediaRefs[${index}]`,
          `AI Lab media ${String(mediaId)} is not registered.`,
        ),
      );
    } else if (
      typeof media.academicDisplayDecisionRef !== 'string'
      || typeof media.commercialRightsRecordRef !== 'string'
    ) {
      findings.push(
        finding(
          'INCOMPLETE_AI_MEDIA_RIGHTS',
          `${pointer}.mediaRefs[${index}]`,
          `AI Lab media ${mediaId} must preserve both rights dimensions.`,
        ),
      );
    }
  }

  return findings;
}

export function validateLocaleParity(en, vi, pointer = '$.localePair') {
  const findings = [];
  if (en?.locale !== 'en' || vi?.locale !== 'vi') {
    findings.push(
      finding(
        'INVALID_AI_LOCALE_PAIR',
        pointer,
        'AI locale parity requires one en record and one vi record.',
      ),
    );
    return findings;
  }
  for (const field of ['id', 'order', 'decisionActorKind', 'decisionRef']) {
    if (en[field] !== vi[field]) {
      findings.push(
        finding(
          'AI_LOCALE_DRIFT',
          `${pointer}.${field}`,
          `${field} must match across locales.`,
        ),
      );
    }
  }
  for (const field of ['evidence', 'agentRoles', 'publicSourceIds', 'reportRefs', 'mediaRefs']) {
    if (
      (en[field] !== undefined || vi[field] !== undefined)
      && JSON.stringify(en[field] ?? []) !== JSON.stringify(vi[field] ?? [])
    ) {
      findings.push(
        finding(
          'AI_LOCALE_DRIFT',
          `${pointer}.${field}`,
          `${field} must preserve identical IDs and order across locales.`,
        ),
      );
    }
  }
  for (const field of ['status', 'reviewOutcome', 'verificationType']) {
    if (
      (en[field] !== undefined || vi[field] !== undefined)
      && en[field] !== vi[field]
    ) {
      findings.push(
        finding(
          'AI_LOCALE_MEANING_DRIFT',
          `${pointer}.${field}`,
          `${field} must preserve the same technical meaning across locales.`,
        ),
      );
    }
  }
  return findings;
}

/**
 * Phase 5 domain validation runs after the shared Phase 2 content contract.
 */
export function validateAiLab(context = {}) {
  const entries = Array.isArray(context.entries)
    ? context.entries
    : Object.values(context.entries ?? {}).flatMap((value) =>
      Array.isArray(value) ? value : []);
  const episodes = entries
    .filter((entry) => (
      entry?.collection === 'aiEpisodes'
      || entryData(entry)?.collection === 'aiEpisodes'
    ))
    .map((entry) => entryData(entry))
    .filter((entry) => entry?.draft !== true);
  const findings = [];
  const groups = new Map();

  episodes.forEach((episode, index) => {
    findings.push(...validateAiEpisode(episode, context, `$.aiEpisodes[${index}]`));
    if (typeof episode?.id !== 'string' || typeof episode?.locale !== 'string') {
      return;
    }
    const group = groups.get(episode.id) ?? new Map();
    if (group.has(episode.locale)) {
      findings.push(
        finding(
          'DUPLICATE_AI_LOCALE',
          `$.aiEpisodes[${index}]`,
          `Duplicate ${episode.locale} record for ${episode.id}.`,
        ),
      );
    } else {
      group.set(episode.locale, episode);
    }
    groups.set(episode.id, group);
  });

  for (const [id, locales] of groups) {
    if (!locales.has('en') || !locales.has('vi')) {
      findings.push(
        finding(
          'MISSING_AI_LOCALE_PAIR',
          `$.aiEpisodes.${id}`,
          `${id} requires both en and vi records.`,
        ),
      );
    } else {
      findings.push(
        ...validateLocaleParity(
          locales.get('en'),
          locales.get('vi'),
          `$.aiEpisodes.${id}`,
        ),
      );
    }
  }

  if (episodes.length > 0) {
    for (const locale of ['en', 'vi']) {
      const localeEpisodes = episodes.filter((episode) => episode.locale === locale);
      if (localeEpisodes.length < 5) {
        findings.push(
          finding(
            'INSUFFICIENT_AI_EPISODES',
            `$.aiEpisodes.${locale}`,
            `${locale} requires at least five curated episodes.`,
          ),
        );
      }
      const ordered = [...localeEpisodes].sort((left, right) =>
        left.order - right.order || left.id.localeCompare(right.id));
      const orders = ordered.map((episode) => episode.order);
      if (new Set(orders).size !== orders.length) {
        findings.push(
          finding(
            'DUPLICATE_AI_EPISODE_ORDER',
            `$.aiEpisodes.${locale}`,
            `${locale} episode order values must be unique.`,
          ),
        );
      }
    }
  }

  return findings;
}

export const aiLabValidationFragment = Object.freeze({
  id: fragmentId,
  validate: validateAiLab,
});

export default aiLabValidationFragment;
