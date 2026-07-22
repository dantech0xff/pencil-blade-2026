# Static Reconstruction Method

## Constraint

The original Pencil Blade APK cannot run on any available current Android device. The
project never installs or executes it. Restoration uses only the immutable APK,
`libgame.so`, packaged resources, app-owned Java, and metadata. Historical material and
user memory may support an inference but cannot become recovered runtime evidence.

## Immutable Inputs

| Evidence | SHA-256 |
|---|---|
| `SRC-APK-001` | `95225733d46473f2b155737e8c83b567e028342257c747c0faac6ed4ab87e7aa` |
| `DER-NATIVE-001` (`libgame.so`) | `55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e` |

Every analyzer verifies its input before writing to a new, empty output directory. Raw
disassembly, analysis databases, and extracted resources stay under ignored working storage.
Curated maps contain only the evidence needed to review and implement contracts.

Current curated projections are `DER-FUNCMAP-001` (713 explicitly allowlisted application
functions) and `DER-RESMAP-001` (862 packaged assets plus Android resource and native-string
correlation). Focused tests regenerate both projections and require byte-for-byte equality.

## Independent Static Views

The current local Android toolchains provide two independent instruction views without
installing additional software:

- GNU ARM binutils 2.27: `readelf`, `objdump`, `nm`, and `c++filt` from NDK 21.
- LLVM 19.0.1: `llvm-readobj`, `llvm-objdump`, `llvm-nm`, and `llvm-cxxfilt` from NDK 28.
- `/usr/bin/strings` for raw printable-string extraction.

Ghidra, Rizin/radare2, Capstone, pyelftools, LIEF, angr, and Unicorn are not currently
installed. Their absence does not block symbol-led disassembly, but type recovery and
indirect-call analysis remain less automated.

## ARM/Thumb Rule

`libgame.so` is ELF32 little-endian ARM EABI5, CPU ARMv5TE, image base `0x0`. App functions
are predominantly Thumb. In the dynamic symbol table the low address bit identifies Thumb
state; the instruction address is `rawAddress & ~1`. GNU ARM `objdump` respects this metadata.
LLVM must be invoked with `--triple=thumbv5te-none-linux-android`; its default ELF mode can
misdecode Thumb bytes as ARM instructions.

A rule is not marked recovered from decompiler-like output alone. Representative functions
must agree at the instruction/constant level across GNU and LLVM views, or the disagreement
must be recorded.

## Contract Workflow

1. Verify source/native hashes and record resolved tools, versions, commands, and image base.
2. Inventory headers, sections, dynamic entries, needed libraries, relocations, symbols,
   objects, imports, strings, and Java/JNI boundaries.
3. Normalize Thumb addresses and group app-owned symbols by subsystem.
4. Trace constructors and lifecycle/update roots before leaf methods.
5. Recover constants, branches, object fields, calls, resource paths, save keys, and event order.
6. Cross-check instructions with the second tool and corroborate with resource geometry,
   naming, Java metadata, or authentic historical material where available.
7. Record a claim as `recovered`, `inferred`, or `unknown`; link contradictions separately.
8. Map each accepted contract to a Cocos Creator TypeScript owner, Creator Physics2D
   configuration, fixture, and automated test.

## Evidence Status

- `recovered`: directly supported by immutable static evidence and appropriate cross-checks.
- `inferred`: best explanation of multiple clues or user memory, clearly labeled and reviewed.
- `unknown`: evidence is insufficient or conflicting.

Only recovered claims increase recovered-coverage metrics. Inferred rules may be implemented
to complete a playable restoration but retain their label in tests and reports.

## Physics Translation

Cocos Creator Physics2D is the production simulation layer. The analysis must recover and
test gravity, timestep/substeps, world speed, unit scale, bodies, fixture geometry and
material values, sensors, collision filters, velocities/impulses, ray casts, contacts, and
contact-driven score/failure behavior. TypeScript owns state, scoring, spawn, progression,
and persistence rules around a narrow Physics2D adapter.

The first cross-checked contracts already recover gravity `(0, -10)`, sleeping enabled,
velocity/position iterations `10/10`, initial world-speed `1.0`, and
`Step(deltaTime * worldSpeed, velocityIterations, positionIterations)`. The Classic slice
also recovers the exact `32 legacy Cocos world units = 1 Box2D metre` transform used by
spawn and blade paths,
the four-direction spawn formulas, the nine-controller toss graph, and the post-step,
bidirectional blade ray cast. Creator receives these as explicit adapter contracts; it does
not ingest or call the original Box2D implementation.

## Classic Contract Set

The first Phase 3/4 implementation boundary is split into five independently reviewable
contracts:

- `../forensics/contracts/classic-physics-contract.md`: world, bodies, fixtures, contacts,
  and Creator Physics2D translation.
- `../forensics/contracts/classic-toss-contract.md`: RNG, timers, strategies, the fixed
  Classic controller graph, and spawn kinematics.
- `../forensics/contracts/classic-cut-score-contract.md`: touch/blade sampling, ray-cut
  filtering, fruit/combo/score rules, misses, bombs, and game-over ordering.
- `../forensics/contracts/classic-time-state-contract.md`: untimed Classic ownership,
  intro/start, speed-up, pause, physics hold, terminal state, and the shared
  time-management boundary.
- `../forensics/contracts/classic-presentation-contract.md`: resolution profiles, assets,
  logical layout, z-order, HUD/fail/bomb/terminal/result timelines, and bounded audio order.

Each contract names deterministic tests for recovered rules and retains separate unknowns
where static evidence does not support a unique implementation.

`../reference/reconstruction-policy.yaml` pins the registered contract hashes, recovered
claim gate, clean-room restrictions, Creator physics unit boundary, compatibility decisions,
asset-fidelity rules, and unresolved scope. Its focused test treats the JSON-syntax file as
YAML 1.2 and cross-checks it against the evidence register and claims ledger.

## Clean-Room Boundary

The shipped Creator project must not contain the source APK, `libgame.so`, Cocos2d-x 2.1.4
application runtime, decompiler output, native compatibility bridge, or emulation layer.
Recovered behavior is rewritten from reviewed contracts; native instructions are never
mechanically translated into production code.

## Open Analysis Limits

- Some entity fixture geometry, damping/material fields, contact-listener details, and the
  semantic name of node tag `1437` remain incomplete or ambiguous.
- Indirect calls and stripped local functions need call-neighborhood analysis.
- The native RNG formulas are recovered, but exact draw interleaving with engine/VFX users
  and libc sequence parity cannot be measured without the original runtime; the Creator
  rewrite uses injectable deterministic fixtures without claiming an observed native trace.
- Remaining screens/modes and unlinked audio literals still need resource-string call-site
  correlation; the minimum Classic presentation path is now bounded by its contract.
