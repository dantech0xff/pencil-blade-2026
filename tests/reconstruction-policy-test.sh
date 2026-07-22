#!/bin/sh

set -eu
LC_ALL=C
export LC_ALL

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
POLICY=${RECONSTRUCTION_POLICY_FILE:-"$ROOT_DIR/reference/reconstruction-policy.yaml"}
CLAIMS=${RECONSTRUCTION_CLAIMS_FILE:-"$ROOT_DIR/forensics/claims.jsonl"}
REGISTER=${RECONSTRUCTION_REGISTER_FILE:-"$ROOT_DIR/docs/evidence-register.md"}
CONTRACTS_DIR="$ROOT_DIR/forensics/contracts"

fail() {
  printf 'FAIL reconstruction policy: %s\n' "$*" >&2
  exit 1
}

sha256_file() {
  shasum -a 256 "$1" | awk '{print $1}'
}

[ -f "$POLICY" ] || fail "missing policy"
[ -f "$CLAIMS" ] || fail "missing claims ledger"
[ -f "$REGISTER" ] || fail "missing evidence register"
[ -d "$CONTRACTS_DIR" ] || fail "missing curated contract directory"
[ ! -L "$ROOT_DIR/forensics" ] || fail "forensics directory must not be a symlink"
[ ! -L "$CONTRACTS_DIR" ] || fail "contract directory must not be a symlink"

jq -e '
  keys == [
    "coverage",
    "evidence",
    "method",
    "policyId",
    "policyVersion",
    "rules",
    "schemaVersion"
  ] and
  .schemaVersion == 1 and
  .policyId == "pencil-blade-static-reconstruction" and
  (.policyVersion | test("^[0-9]+\\.[0-9]+\\.[0-9]+$")) and
  .method.scope == "classic-vertical-slice" and
  .method.evidenceMode == "static-only" and
  .method.originalRuntimeAvailable == false and
  .method.originalRuntimeObserved == false and
  .method.originalRuntimeRequired == false and
  .method.apkInstallationAllowed == false and
  .method.apkExecutionAllowed == false and
  .method.nativeExecutionAllowed == false and
  .method.mechanicalTranslationAllowed == false and
  .method.target == {
    "engine": "Cocos Creator",
    "language": "TypeScript",
    "physics": "Physics2D",
    "version": "3.8.8"
  } and
  (.evidence.sources | length == 2) and
  (.evidence.sources | map(.id) | unique | length == 2) and
  (.evidence.contracts | length >= 5) and
  (.evidence.contracts | (length == (map(.id) | unique | length))) and
  (.evidence.contracts | (length == (map(.path) | unique | length))) and
  (.coverage.requiredClaimIds | length >= 17) and
  (.coverage.requiredClaimIds | (length == (unique | length))) and
  ((.coverage.requiredClaimContracts | keys | sort) ==
    (.coverage.requiredClaimIds | sort)) and
  ([.evidence.contracts[].id] as $contractIds |
    all(
      .coverage.requiredClaimContracts[];
      type == "array" and
      length >= 1 and
      (length == (unique | length)) and
      all(.[]; . as $id | ($contractIds | index($id)) != null)
    )) and
  .coverage.metric == "registered-policy-contract-claims" and
  .coverage.requiredStatus == "recovered" and
  .coverage.requiredEvidenceTier == 1 and
  .coverage.requireContractEligible == true and
  .coverage.requireNoContradictions == true and
  .coverage.minimumConfidence == 0.99 and
  .coverage.minimumRecoveredFraction == 1.0 and
  .coverage.inferredTreatment == "excluded" and
  .coverage.unknownTreatment == "blocks-affected-scope" and
  .rules.compatibility.units == {
    "angularVelocityToCreatorScale": 1,
    "creatorGravityWorldUnitsPerSecondSquared": [0, -320],
    "creatorRotation": "stock-positive-body-angle-sync",
    "legacyWorldUnitsPerBox2DMetre": 32,
    "linearVelocityToCreatorScale": 1,
    "nativeGravityMetresPerSecondSquared": [0, -10],
    "positionAndGeometryToCreatorWorldUnits": 32,
    "rayEndpointsToCreatorWorldUnits": 1
  } and
  .rules.compatibility.creatorTimestepMapping == "public-manual-variable-step-post-update" and
  .rules.compatibility.bidirectionalRayFixtureDuplicates == "preserve-order-and-duplicates" and
  .rules.compatibility.concurrentCountMaxPlusOne == "preserve" and
  .rules.compatibility.effectsComboRngDraw == "preserve-shared-stream" and
  .rules.compatibility.separateAudioOrVfxRng == "disabled" and
  .rules.compatibility.nativeLrand48SequenceParity == "not-claimed" and
  .rules.compatibility.unsafeBombElectricPointerLayout == "forbidden" and
  .rules.compatibility.sameQueryMultiBomb == "preserve-independent-explosions-and-last-writer-physics-stop" and
  .rules.compatibility.classicModeZeroMusicResumeAsymmetry == "preserve" and
  .rules.assetFidelity.sourceBytes == "sha256-exact" and
  .rules.assetFidelity.geometry == "exact" and
  .rules.assetFidelity.trim == "forbidden" and
  .rules.assetFidelity.recompression == "forbidden" and
  .rules.assetFidelity.audioResampling == "forbidden" and
  .rules.assetFidelity.fontSubstitution == "forbidden" and
  .rules.assetFidelity.visualTolerance == null and
  .rules.assetFidelity.audioTolerance == null and
  .rules.assetFidelity.unknownRights == "not-ship-ready" and
  (.rules.cleanRoom.forbiddenProductionContent | sort) == ([
    "cocos2d-x-2.1.4-runtime",
    "decompiler-output",
    "emulation-layer",
    "libgame.so",
    "native-compatibility-bridge",
    "source-apk"
  ] | sort) and
  (.rules.openDecisions | (length == (map(.id) | unique | length))) and
  ((.rules.openDecisions | sort_by(.id)) == ([
    {
      "id": "bomb-electric-zero-height-fixture",
      "status": "unresolved",
      "blocks": "bomb-electric-recovered-label"
    },
    {
      "id": "bomb-electric-contact-behavior",
      "status": "unresolved",
      "blocks": "bomb-electric-recovered-label"
    },
    {
      "id": "creator-physics-runtime-validation",
      "status": "unresolved",
      "blocks": "physics-integration-equivalence-label"
    },
    {
      "id": "time-manager-callback-hardening",
      "status": "unresolved",
      "blocks": "safe-divergence-decision"
    },
    {
      "id": "multi-bomb-reference-counted-variant",
      "status": "unresolved",
      "blocks": "post-fidelity-safety-variant"
    },
    {
      "id": "original-content-rights",
      "status": "unknown-not-cleared",
      "blocks": "shipping-original-content"
    }
  ] | sort_by(.id)))
' "$POLICY" >/dev/null || fail "schema or fixed invariant mismatch"

jq -e '
  (.evidence.sources | map(select(
    .id == "SRC-APK-001" and
    .sha256 == "95225733d46473f2b155737e8c83b567e028342257c747c0faac6ed4ab87e7aa" and
    .bytes == 35817225
  )) | length == 1) and
  (.evidence.sources | map(select(
    .id == "DER-NATIVE-001" and
    .sha256 == "55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e" and
    .bytes == 4734880
  )) | length == 1)
' "$POLICY" >/dev/null || fail "immutable source tuple mismatch"

for source_id in SRC-APK-001 DER-NATIVE-001; do
  grep -Fq "$source_id" "$REGISTER" || fail "unregistered source $source_id"
  source_hash=$(jq -r --arg id "$source_id" '.evidence.sources[] | select(.id == $id) | .sha256' "$POLICY")
  grep -Fq "$source_hash" "$REGISTER" || fail "source hash absent from register: $source_id"
done

tab=$(printf '\t')
jq -r '.evidence.contracts[] | [.id, .path, .sha256, (.bytes | tostring)] | @tsv' "$POLICY" |
while IFS="$tab" read -r evidence_id relative_path expected_hash expected_bytes; do
  case "$evidence_id:$relative_path" in
    DER-CLASSIC-PHYSICS-001:forensics/contracts/classic-physics-contract.md | \
    DER-CLASSIC-TOSS-001:forensics/contracts/classic-toss-contract.md | \
    DER-CLASSIC-CUT-SCORE-001:forensics/contracts/classic-cut-score-contract.md | \
    DER-CLASSIC-TIME-STATE-001:forensics/contracts/classic-time-state-contract.md | \
    DER-CLASSIC-PRESENTATION-001:forensics/contracts/classic-presentation-contract.md) ;;
    *) fail "unexpected contract id/path tuple: $evidence_id:$relative_path" ;;
  esac

  artifact="$ROOT_DIR/$relative_path"
  [ -f "$artifact" ] || fail "missing contract artifact: $relative_path"
  [ ! -L "$artifact" ] || fail "contract artifact must not be a symlink: $relative_path"
  actual_hash=$(sha256_file "$artifact")
  actual_bytes=$(wc -c <"$artifact" | tr -d '[:space:]')
  [ "$actual_hash" = "$expected_hash" ] || fail "policy hash mismatch: $evidence_id"
  [ "$actual_bytes" = "$expected_bytes" ] || fail "policy byte count mismatch: $evidence_id"

  row=$(grep -F "| $evidence_id |" "$REGISTER" || true)
  [ -n "$row" ] || fail "contract is not registered: $evidence_id"
  registered_hash=$(printf '%s\n' "$row" | awk -F '|' '{ value=$6; gsub(/[ `]/, "", value); print value }')
  registered_bytes=$(printf '%s\n' "$row" | awk -F '|' '{ value=$7; gsub(/[ ,]/, "", value); print value }')
  [ "$registered_hash" = "$expected_hash" ] || fail "register hash mismatch: $evidence_id"
  [ "$registered_bytes" = "$expected_bytes" ] || fail "register byte count mismatch: $evidence_id"
done

jq -e --slurpfile claims "$CLAIMS" '
  .coverage as $coverage |
  [.evidence.contracts[].id] as $contractIds |
  all(
    $coverage.requiredClaimIds[];
    . as $requiredId |
    $coverage.requiredClaimContracts[$requiredId] as $expectedContractRefs |
    ($claims | map(select(
      .id == $requiredId and
      (.status | type == "string") and
      .status == $coverage.requiredStatus and
      (.evidenceTier | type == "number") and
      .evidenceTier == $coverage.requiredEvidenceTier and
      (.contractEligible | type == "boolean") and
      .contractEligible == $coverage.requireContractEligible and
      (.confidence | type == "number") and
      .confidence >= $coverage.minimumConfidence and
      (.contradictionIds | type == "array") and
      ((.contradictionIds | length == 0) or ($coverage.requireNoContradictions == false)) and
      (.evidenceRefs | type == "array") and
      ([.evidenceRefs[] |
        select(. as $ref | ($contractIds | index($ref)) != null)] | sort) ==
        ($expectedContractRefs | sort)
    )) | length == 1)
  ) and
  (
    [
      $claims[] |
      select(.contractEligible == true) |
      select(any(.evidenceRefs[]; . as $ref | ($contractIds | index($ref)) != null)) |
      .id
    ] | sort
  ) == ($coverage.requiredClaimIds | sort)
' "$POLICY" >/dev/null || fail "claim coverage does not match the registered contract set"

printf 'PASS reconstruction policy\n'
