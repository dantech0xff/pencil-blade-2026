# Forensics Workspace

This directory holds curated, reviewable evidence contracts. The APK and all decoder output
remain outside the versionable evidence surface.

## Evidence zones

### Original

- Workspace source: `../Pencil+Blade_1.5_APKPure.apk`
- Required hash:
  `95225733d46473f2b155737e8c83b567e028342257c747c0faac6ed4ab87e7aa`
- Required external copies: at least two offline backups whose hashes match the source.

Never overwrite, patch, align, re-sign, install, or execute the APK during Phase 1. The root
APK and any local backup directory are ignored by `.gitignore`. External backup destinations
must be supplied and verified by the user; a second workspace copy is not an offline backup.

### Working

Run the extraction command into `.forensics-work/phase-01/`. This ignored directory is
reproducible and may contain copyrighted or executable evidence, so none of it is curated for
source control.

Expected layout:

```text
.forensics-work/phase-01/
  inventory.txt
  tool-versions.txt
  commands.txt
  checksums.sha256
  archive/
  manifest/
  resources/
  jadx/
  java/app-owned/
  native/
    libgame.so
    elf-header.txt
    elf-sections.txt
    dynamic-symbols.txt
    imports.txt
    strings.txt
```

The manifest/resource evidence must include independent outputs from Android resource tools
and JADX. The full JADX tree stays under `jadx/`; only `uit/dev/pencilblade` is copied into
`java/app-owned/`. Google, Cocos, and other vendor code is not app-owned evidence. The native
directory contains a derived copy of `libgame.so` plus ELF headers, attributes, sections,
dynamic symbols, imports, and strings. `checksums.sha256` links preserved derived files to the
source APK recorded in the evidence register.

### Curated

The following files are designed to be versioned after the boundary is approved:

- `claims.schema.json` and `claims.jsonl`
- `contracts/*.md`
- `native/function-map.csv` and `native/*.md`
- `resources/resource-usage-map.json`
- `../docs/evidence-register.md`
- `../reference/reconstruction-policy.yaml`
- specifications and small native/resource catalogs created by later phases
- `../scripts/inventory-apk.sh`
- reviewed reports under `../plans/`

Do not move bulk assets, decompiler output, native binaries, raw historical media, or tool caches into
the curated zone.

## Reproduction

From the project root:

```sh
scripts/inventory-apk.sh verify Pencil+Blade_1.5_APKPure.apk
scripts/inventory-apk.sh extract Pencil+Blade_1.5_APKPure.apk .forensics-work/phase-01
scripts/analyze-native-static.sh .forensics-work/phase-01/native/libgame.so .forensics-work/phase-02/native
node scripts/catalog-static-resources.mjs \
  .forensics-work/phase-01/jadx/resources \
  .forensics-work/phase-01/native/strings.txt \
  forensics/resources/resource-usage-map.json
sh tests/reconstruction-policy-test.sh
```

`verify` performs read-only checks and exits nonzero on a baseline mismatch. `extract` first
verifies the APK, requires a new or empty working directory, records commands and tool
versions, and writes only derived evidence beneath that directory. Tool binaries may be set
with the documented `*_BIN` environment overrides; otherwise the script checks `PATH` and
the Android SDK roots.

To reproduce an evidence set, create a different empty work directory and run `extract`
again. Compare its `checksums.sha256`, inventory, manifests, and native reports. Remove a
working set only when it is no longer needed and can be regenerated from a hash-verified APK;
never use cleanup commands against the project root or an unvalidated path.

The Phase 2 commands require a missing or empty output target. The curated map files are
regression checked against fresh generated output by their focused tests; move an existing
curated output aside before intentionally regenerating it.

## Identifiers and claims

- Immutable sources use `SRC-...` identifiers.
- Derived evidence sets use `DER-...` identifiers and cite their parent source.
- Claims use `CLM-...` identifiers and cite one or more registered source or derived identifiers.
- Historical media and user recollections require separately registered supporting IDs before
  they can be cited; they never become static-recovery evidence by themselves.

Gameplay conclusions use `recovered`, `inferred`, or `unknown`, with contradictions linked
separately. Original-runtime observation is unavailable. A static fact directly extracted
and corroborated from the APK is `recovered`; user memory supports only an inference.

## Rights and repository boundary

Possession of the APK is not redistribution permission. All original artwork, audio, fonts,
code, product names, and trademarks remain `unknown / not cleared` until rights evidence is
registered. Public release is blocked until every shipped item is cleared or replaced.

The workspace is a Git repository on `main`, initialized after explicit user approval on
2026-07-22. `.gitignore` defines the active boundary. Review it before every broad staging
operation; never commit the APK, `libgame.so`, bulk extraction, analysis databases, or secrets.
