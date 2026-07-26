export const fragmentId = 'play';

function finding(code, path, message) {
  return { code, path, message };
}

export function validatePlaySource(source, path = '$.playSource') {
  if (typeof source !== 'string') {
    return [finding('INVALID_PLAY_SOURCE', path, 'Play source must be a string.')];
  }
  const findings = [];
  if (/<iframe\b[^>]*\bsrc\s*=/iu.test(source)) {
    findings.push(finding('EAGER_GAME_IFRAME', path, 'The game iframe must not have a source before explicit interaction.'));
  }
  if (/<link\b[^>]*\b(?:preload|prefetch)\b[^>]*play\/game/iu.test(source)) {
    findings.push(finding('EAGER_GAME_PRELOAD', path, 'The game subtree cannot be preloaded or prefetched.'));
  }
  if (/localStorage\s*\.\s*clear\s*\(/u.test(source)) {
    findings.push(finding('GLOBAL_STORAGE_WIPE', path, 'The launcher cannot clear shared origin storage.'));
  }
  if (/\b(?:window\.)?(?:parent|top|opener)\b|\bpostMessage\s*\(/u.test(source)) {
    findings.push(finding('PARENT_GAME_COUPLING', path, 'The launch flow ships no parent/top/opener coupling or bridge.'));
  }
  return findings;
}

export function validatePlay(context = {}) {
  const findings = [];
  const media = context.publicationManifest?.media ?? [];
  const tree = media.find((record) => record.mediaId === 'MEDIA-H5-AUDITED-TREE');
  const preview = media.find((record) => record.mediaId === 'MEDIA-PLAY-PREVIEW-SHARED');
  for (const [id, record] of [['MEDIA-H5-AUDITED-TREE', tree], ['MEDIA-PLAY-PREVIEW-SHARED', preview]]) {
    if (!record) {
      findings.push(finding('MISSING_PLAY_MEDIA', '$.publicationManifest.media', `Missing ${id}.`));
      continue;
    }
    if (!record.academicDisplayDecisionRef || !record.commercialRightsRecordRef) {
      findings.push(finding('MISSING_PLAY_RIGHTS_DIMENSION', `$.publicationManifest.media.${id}`, `${id} requires separate academic and commercial references.`));
    }
  }
  if (context.playSource !== undefined) {
    findings.push(...validatePlaySource(context.playSource));
  }
  return findings;
}

export const playValidationFragment = Object.freeze({
  id: fragmentId,
  validate: validatePlay,
});

export default playValidationFragment;
