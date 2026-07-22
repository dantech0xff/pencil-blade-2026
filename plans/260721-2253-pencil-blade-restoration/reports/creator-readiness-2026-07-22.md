# Creator Readiness — 2026-07-22

## Status

Installed and now proven runnable for bounded local project work, but the original signature
provenance concern remains unresolved. The initial audit below was read-only; a later
user-authorized session opened Creator through Dashboard without launching the APK or native
game code.

## Present

- Host: macOS 26.5.2 (`25F84`), arm64.
- Cocos Creator 3.8.8:
  `/Applications/Cocos/Creator/3.8.8/CocosCreator.app`.
- Creator executable:
  `/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator`;
  universal x86_64/arm64.
- Cocos Dashboard 2.2.1: `/Applications/CocosDashboard.app`; universal x86_64/arm64.
- Node 22.21.0 and npm 10.9.4 are available from the active NVM installation.

No `cocos`, `CocosCreator`, or `creator` command is on `PATH`. `/usr/bin/cc` is the system C
compiler and must not be mistaken for a Creator command.

## Repository State

- `game/` exists as the Creator 3.8.8 foundation, with generated library cache and domain
  modules in place. Creator later reopened this exact root, imported all current source, and
  serialized `assets/scenes/classic.scene`.
- Git exists on `main` with no commits.
- The Classic static presentation/gameplay contract gate is closed: the inventory/evidence
  suite passes 14/14. Phase 5 remains in progress on toolchain pinning and full scene/build
  integration.

## Blocker

`codesign --verify --deep --strict` reports modified/invalid signatures for both Creator and
Dashboard. Gatekeeper assessment did not validate either bundle. The installed version is
therefore runnable but its official-byte provenance is not established. The exact `.../game`
root reopen and current source/meta mapping are complete.

Before scaffolding:

1. Classic presentation/time contracts and reconstruction policy: complete and validated;
2. official stable Creator channel: rechecked 2026-07-22; baseline remains 3.8.8;
3. repair/reinstall the official editor if release provenance requires strict bundle
   verification; bounded project work now has explicit user authorization;
4. pin the editor/engine revision and Android JDK/SDK/NDK/Gradle configuration.

## Unresolved Questions

- Was the installed app intentionally modified after download?
- Should the installation be repaired from the official distribution before a release build?
