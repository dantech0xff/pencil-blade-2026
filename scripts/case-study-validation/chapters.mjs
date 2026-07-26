export const fragmentId = 'chapters';

const CHAPTER_KINDS = Object.freeze(['forensics']);
const REQUIRED_RHYTHM = Object.freeze({
  en: Object.freeze([
    'question',
    'artifact',
    'method',
    'contract',
    'proof',
    'limit',
    'next step',
  ]),
  vi: Object.freeze([
    'câu hỏi',
    'hiện vật',
    'phương pháp',
    'hợp đồng',
    'kiểm chứng',
    'giới hạn',
    'bước tiếp theo',
  ]),
});
const PRIVATE_PATH_PATTERN =
  /(?:file:\/\/|\/Users\/|\/home\/|[A-Za-z]:\\|(?:^|[/"'])(?:\.forensics-work|offline-evidence|jadx-output|apktool-output)\/)/u;
const DENIED_DOWNLOAD_PATTERN =
  /(?:href|src)\s*=\s*["'][^"']*\.(?:apk|apks|xapk|so|dex|gpr|i64|idb)(?:[?#][^"']*)?["']/iu;
const ORIGINAL_SOURCE_OVERCLAIM =
  /(?<!not )(?<!never )\b(?:recovered|restored|reconstructed)\s+(?:the\s+)?original\s+C\+\+\s+source\b/iu;
const ORIGINAL_RUNTIME_OVERCLAIM =
  /\b(?:ran|executed|observed|captured|measured)\s+(?:the\s+)?original\s+runtime\b/iu;

function finding(code, path, message) {
  return { code, path, message };
}

function entryData(entry) {
  return entry?.data && typeof entry.data === 'object' ? entry.data : entry;
}

function entryBody(entry) {
  const data = entryData(entry);
  return [
    entry?.body,
    entry?.source,
    data?.body,
    data?.source,
  ].find((value) => typeof value === 'string') ?? '';
}

function exactArray(left, right) {
  return JSON.stringify(left ?? []) === JSON.stringify(right ?? []);
}

function numericTokens(source) {
  return [...String(source).matchAll(
    /(?<![\p{L}\p{N}_])(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?(?:\/\d+)?%?)(?![\p{L}\p{N}_])/gu,
  )].map((match) => match[0]);
}

export function validateChapterEntry(record, context = {}, pointer = '$.chapter') {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return [finding('INVALID_CHAPTER', pointer, 'Chapter must be an object.')];
  }

  const findings = [];
  const claimIds = new Set(
    (context.canonicalClaims ?? []).map((claim) => claim.id),
  );
  const mediaById = new Map(
    (context.publicationManifest?.media ?? []).map((media) => [media.mediaId, media]),
  );

  for (const field of [
    'id',
    'locale',
    'order',
    'chapterKind',
    'evidenceRefs',
    'mediaRefs',
  ]) {
    const value = record[field];
    if (
      value === undefined
      || value === null
      || (typeof value === 'string' && value.length === 0)
      || (Array.isArray(value) && field === 'evidenceRefs' && value.length === 0)
    ) {
      findings.push(
        finding(
          'MISSING_CHAPTER_FIELD',
          `${pointer}.${field}`,
          `Chapter requires ${field}.`,
        ),
      );
    }
  }

  if (!CHAPTER_KINDS.includes(record.chapterKind)) {
    findings.push(
      finding(
        'INVALID_CHAPTER_KIND',
        `${pointer}.chapterKind`,
        `Expected one of ${CHAPTER_KINDS.join(', ')}.`,
      ),
    );
  }
  if (!['en', 'vi'].includes(record.locale)) {
    findings.push(
      finding(
        'INVALID_CHAPTER_LOCALE',
        `${pointer}.locale`,
        'Chapter locale must be en or vi.',
      ),
    );
  }

  for (const [index, claimId] of (record.evidenceRefs ?? []).entries()) {
    if (!claimIds.has(claimId)) {
      findings.push(
        finding(
          'UNKNOWN_CHAPTER_EVIDENCE',
          `${pointer}.evidenceRefs[${index}]`,
          `Unknown canonical claim ${String(claimId)}.`,
        ),
      );
    }
  }

  for (const [index, mediaId] of (record.mediaRefs ?? []).entries()) {
    const media = mediaById.get(mediaId);
    const mediaPointer = `${pointer}.mediaRefs[${index}]`;
    if (!media || media.publishable !== true) {
      findings.push(
        finding(
          'UNAPPROVED_CHAPTER_MEDIA',
          mediaPointer,
          `Chapter media ${String(mediaId)} is not registered as publishable.`,
        ),
      );
      continue;
    }
    if (
      typeof media.academicDisplayDecisionRef !== 'string'
      || typeof media.commercialRightsRecordRef !== 'string'
    ) {
      findings.push(
        finding(
          'INCOMPLETE_CHAPTER_MEDIA_RIGHTS',
          mediaPointer,
          `Chapter media ${mediaId} must preserve separate academic and commercial references.`,
        ),
      );
    }
    if (
      media.kind === 'runtime-display-derivative'
      && (
        typeof media.provenance?.sourceMediaId !== 'string'
        || typeof media.provenance?.sha256 !== 'string'
        || !media.transformationHistory?.some((step) =>
          step === `exact byte copy from ${media.provenance.sourceMediaId}`)
      )
    ) {
      findings.push(
        finding(
          'INVALID_CHAPTER_MEDIA_PROVENANCE',
          mediaPointer,
          `Runtime derivative ${mediaId} must bind an exact registered source copy and hash.`,
        ),
      );
    }
  }

  return findings;
}

export function validateChapterLocalePair(en, vi, pointer = '$.chapterPair') {
  const findings = [];
  if (en?.locale !== 'en' || vi?.locale !== 'vi') {
    return [
      finding(
        'INVALID_CHAPTER_LOCALE_PAIR',
        pointer,
        'Chapter parity requires one en record and one vi record.',
      ),
    ];
  }
  for (const field of ['order', 'chapterKind']) {
    if (en[field] !== vi[field]) {
      findings.push(
        finding(
          'CHAPTER_LOCALE_DRIFT',
          `${pointer}.${field}`,
          `${field} must match across locales.`,
        ),
      );
    }
  }
  for (const field of ['evidenceRefs', 'mediaRefs']) {
    if (!exactArray(en[field], vi[field])) {
      findings.push(
        finding(
          'CHAPTER_LOCALE_DRIFT',
          `${pointer}.${field}`,
          `${field} must preserve identical IDs and order across locales.`,
        ),
      );
    }
  }
  const expectedViNext = en.nextId === null
    ? null
    : typeof en.nextId === 'string'
      ? en.nextId.replace(/\.en$/u, '.vi')
      : en.nextId;
  if (vi.nextId !== expectedViNext) {
    findings.push(
      finding(
        'CHAPTER_LOCALE_DRIFT',
        `${pointer}.nextId`,
        'nextId must preserve the locale-equivalent chapter sequence.',
      ),
    );
  }
  return findings;
}

export function validateChapterDocument(source, options = {}) {
  const path = options.path ?? '$.chapterDocument';
  if (typeof source !== 'string') {
    return [finding('INVALID_CHAPTER_DOCUMENT', path, 'Chapter source must be a string.')];
  }
  const findings = [];
  const lower = source.toLocaleLowerCase();
  const locale = options.locale ?? (
    /(?:^|[/.])vi(?:[/.]|$)/u.test(path) ? 'vi' : 'en'
  );

  for (const section of REQUIRED_RHYTHM[locale] ?? REQUIRED_RHYTHM.en) {
    if (!lower.includes(section)) {
      findings.push(
        finding(
          'MISSING_CHAPTER_RHYTHM',
          path,
          `Chapter source is missing the ${section} editorial stage.`,
        ),
      );
    }
  }
  if (PRIVATE_PATH_PATTERN.test(source)) {
    findings.push(
      finding(
        'CHAPTER_PRIVATE_PATH',
        path,
        'Chapter source may not expose machine-local or denied forensic paths.',
      ),
    );
  }
  if (DENIED_DOWNLOAD_PATTERN.test(source)) {
    findings.push(
      finding(
        'CHAPTER_DENIED_ARTIFACT_LINK',
        path,
        'Chapter source may name restricted artifacts but cannot link or embed them.',
      ),
    );
  }
  if (ORIGINAL_SOURCE_OVERCLAIM.test(source)) {
    findings.push(
      finding(
        'ORIGINAL_SOURCE_OVERCLAIM',
        path,
        'Disassembly or reconstruction cannot be described as recovered original C++ source.',
      ),
    );
  }
  if (ORIGINAL_RUNTIME_OVERCLAIM.test(source)) {
    findings.push(
      finding(
        'ORIGINAL_RUNTIME_OVERCLAIM',
        path,
        'The original runtime was never observed or executed.',
      ),
    );
  }
  if (
    /\b100(?:\.00)?%/u.test(source)
    && !/pencil-blade-maximal-recoverable-fidelity@1\.1\.0/u.test(source)
  ) {
    findings.push(
      finding(
        'UNQUALIFIED_FIDELITY_PERCENTAGE',
        path,
        'A 100% statement must name the frozen fidelity metric version.',
      ),
    );
  }
  return findings;
}

/**
 * Phase 4 owns chapter-specific rules. Phase 2 freezes this callable boundary.
 */
export function validateChapters(context = {}) {
  const entries = (context.entries ?? [])
    .filter((entry) => (entry.collection ?? entryData(entry)?.collection) === 'chapters');
  const findings = [];
  const byKindAndLocale = new Map();

  entries.forEach((entry, index) => {
    const record = entryData(entry);
    const pointer = `$.entries[${index}]`;
    findings.push(...validateChapterEntry(record, context, pointer));
    const body = entryBody(entry);
    if (body.length > 0) {
      findings.push(
        ...validateChapterDocument(body, {
          locale: record?.locale,
          path: `${pointer}.body`,
        }),
      );
    }
    if (record?.chapterKind && record?.locale) {
      byKindAndLocale.set(`${record.chapterKind}:${record.locale}`, record);
    }
  });

  for (const chapterKind of CHAPTER_KINDS) {
    const en = byKindAndLocale.get(`${chapterKind}:en`);
    const vi = byKindAndLocale.get(`${chapterKind}:vi`);
    if (en || vi) {
      findings.push(
        ...validateChapterLocalePair(
          en,
          vi,
          `$.chapterPairs.${chapterKind}`,
        ),
      );
    }
  }

  for (const [index, document] of (context.chapterDocuments ?? []).entries()) {
    const source = typeof document === 'string' ? document : document?.source;
    const path = typeof document === 'string'
      ? `$.chapterDocuments[${index}]`
      : document?.path ?? `$.chapterDocuments[${index}]`;
    findings.push(
      ...validateChapterDocument(source, {
        locale: typeof document === 'string' ? undefined : document?.locale,
        path,
      }),
    );
  }

  if (context.localeDocuments?.en && context.localeDocuments?.vi) {
    const enNumbers = numericTokens(context.localeDocuments.en);
    const viNumbers = numericTokens(context.localeDocuments.vi);
    if (!exactArray(enNumbers, viNumbers)) {
      findings.push(
        finding(
          'CHAPTER_NUMERIC_LOCALE_DRIFT',
          '$.localeDocuments',
          'English and Vietnamese chapter documents must preserve numeric facts in order.',
        ),
      );
    }
  }

  return findings;
}

export const chapterValidationFragment = Object.freeze({
  id: fragmentId,
  validate: validateChapters,
});

export default chapterValidationFragment;
