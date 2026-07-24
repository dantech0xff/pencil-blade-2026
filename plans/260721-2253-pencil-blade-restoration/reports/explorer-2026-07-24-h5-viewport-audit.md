---
type: explorer
date: 2026-07-24
status: complete
scope: h5-viewport-and-mode-select-rail
---

# H5 Viewport and Mode Select Rail Audit

## Summary

The `1280x720` desktop observation is **expected wide-viewport exposure**, not
evidence of a Mode Select implementation defect.

The reconstruction intentionally applies recovered policy argument `2` as Cocos
Creator 3.8.8 `ResolutionPolicy.SHOW_ALL`. The Web Mobile canvas and serialized
Canvas camera occupy the full browser frame. Mode Select intentionally creates
all six cards at one logical design width apart and has no viewport mask. On a
landscape frame, the full-frame orthographic camera sees world space beyond the
portrait design rectangle, so neighboring cards and rope links can draw over
the camera-clear regions that otherwise look like black letterbox bars.

This does not make desktop landscape a supported fidelity target. Phase 7
explicitly excludes Web Desktop as a separate build. Canonical visual acceptance
must use the two recovered logical rectangles; real mobile portrait shapes may
be supported functionally with their expected `SHOW_ALL` margin behavior; wide
tablet and desktop landscape shapes must be labeled compatibility-only or
unsupported.

No gameplay or presentation source should be changed for this finding.

## Evidence: Intended Resolution Policy

- [`phase-07-validate-fidelity-and-prepare-release.md`](../phase-07-validate-fidelity-and-prepare-release.md)
  lines 15-26 limits release builds to Android debug and Web Mobile H5, and
  explicitly excludes Web Desktop as a separate build. Lines 84-87 require the
  `web-mobile` platform, recovered portrait `720x1280` design resolution, and
  responsive viewport policy.
- [`web-mobile-pages.json`](../../../game/build-configs/web-mobile-pages.json)
  lines 6-10 locks `720x1280` with both `fitWidth` and `fitHeight`; lines 19-29
  lock `orientation: portrait` and platform `web-mobile`.
- [`project.json`](../../../game/settings/v2/packages/project.json) lines 4-7
  sets the project design resolution to `720x1280`.
- [`classic.scene`](../../../game/assets/scenes/classic.scene) lines 124-151
  centers the Canvas at `(360,640)`; lines 212-230 serialize an orthographic
  camera with `orthoHeight=640` and normalized rect `(0,0,1,1)`; lines 245-280
  serialize a `720x1280` Canvas with `alignCanvasWithScreen=true`.
- [`resolution-profile-service.ts`](../../../game/assets/scripts/domain/resolution-profile-service.ts)
  lines 13-37 selects `480x800` below Cocos frame width `720`, otherwise
  `720x1280`; both profiles preserve recovered policy argument `2`.
- [`classic-resolution-adapter.ts`](../../../game/assets/scripts/creator/classic-resolution-adapter.ts)
  lines 29-53 proves policy `2` equals `ResolutionPolicy.SHOW_ALL`, calls
  `view.setDesignResolutionSize` with that policy, and returns Cocos'
  `getVisibleOrigin/getVisibleSize` result.
- [`resolution-profile-service.test.ts`](../../../tests/reconstruction/vertical-slice/resolution-profile-service.test.ts)
  lines 9-33 locks both sides of the width-`720` branch and exact profile values.
- [`recovered-app-viewport.test.ts`](../../../tests/reconstruction/vertical-slice/recovered-app-viewport.test.ts)
  lines 36-79 locks the canonical `480x800` and `720x1280` visible rectangles
  while also proving offset visible rectangles are supported inputs.
- [`audit-web-build.test.mjs`](../../../tests/audit-web-build.test.mjs)
  lines 30-57 locks the Web Mobile build task, production scene, portrait
  orientation, and `fitWidth=true` plus `fitHeight=true`.

The fresh generated settings also encode
`screen.designResolution={width:720,height:1280,policy:2}`. This is a generated,
ignored corroboration artifact, not a source authority.

### Pinned Cocos 3.8.8 behavior

The exact installed engine source explains the rendering:

- `cocos/ui/view.ts:423-430` defines `SHOW_ALL` as proportional content with
  black borders when aspect ratios differ.
- `cocos/ui/view.ts:829-860` uses
  `scale=min(frameWidth/designWidth, frameHeight/designHeight)` and centers the
  resulting design viewport.
- `cocos/2d/framework/canvas.ts:223-234` sets a screen-aligned Canvas camera's
  orthographic half-height to `screen.windowSize.height / view.scaleY / 2`.
- `cocos/render-scene/scene/camera.ts:972-978,1066-1080` derives camera aspect
  from the full render-window rectangle and projects
  `orthoHeight * aspect` horizontally.
- `pal/screen-adapter/web/screen-adapter.ts:100-110,237-266` reports Web
  `screen.windowSize` as CSS frame size multiplied by DPR capped at `2`.
- `tests/core/view.test.ts:34-72` locks that `SHOW_ALL` retains the design
  visible size while centering a smaller viewport inside a mismatched frame.

These files are under:

`/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/resources/3d/engine/`

## Evidence: Recovered Six-Card Rail Geometry

- [`mode-select-state.ts`](../../../game/assets/scripts/domain/mode-select-state.ts)
  lines 3-6 fixes six cards. Lines 51-57 deliberately distinguish raw logical
  width from VisibleRect inputs. Lines 717-722 place card `i` at:

  `visibleCenterX - (5 - i) * logicalWidth`

- The same file lines 470-493 centers the selected card on
  `logicalWidth * 0.5`, and lines 408-438 preserve the asymmetric recovered
  VisibleRect-left/raw-logical-width drag bounds.
- [`mode-select-presentation.ts`](../../../game/assets/scripts/domain/mode-select-presentation.ts)
  lines 864-987 creates all six RopeButtons, their seven visible rope links,
  fruit/card art, and static anchors at those world-space X coordinates.
- [`mode-select-presenter.ts`](../../../game/assets/scripts/creator/mode-select-presenter.ts)
  lines 318-345 creates an ordinary detached screen root and gesture layer.
  Lines 404-429 instantiate and attach every RopeButton. It adds no clipping or
  mask component around the rail.
- [`mode-select-state.test.ts`](../../../tests/reconstruction/vertical-slice/mode-select-state.test.ts)
  lines 82-126 locks high-profile anchors to
  `[-3240,-2520,-1800,-1080,-360,360]`, with card `5` initially centered.
  Lines 236-246 lock the recovered frame-count rail movement.
- [`mode-select-presentation.test.ts`](../../../tests/reconstruction/vertical-slice/mode-select-presentation.test.ts)
  lines 345-390 locks the initial Combo-to-Classic sweep. In the high profile,
  its first unpressed frame moves anchors to
  `[-2879,-2159,-1439,-719,1,721]`.
- [`mode-select-presenter.test.ts`](../../../tests/reconstruction/vertical-slice/mode-select-presenter.test.ts)
  lines 360-377 verifies that the runtime creates exactly six cards; lines
  379-404 verify gesture-driven rail movement and centering.

Focused verification run during this audit:

```text
node --test \
  tests/reconstruction/vertical-slice/resolution-profile-service.test.ts \
  tests/reconstruction/vertical-slice/recovered-app-viewport.test.ts \
  tests/reconstruction/vertical-slice/mode-select-state.test.ts \
  tests/reconstruction/vertical-slice/mode-select-presentation.test.ts

37/37 pass
```

Only Node reconstruction tests ran. No original APK, native library, emulator,
or original application was executed.

## Why `1280x720` Shows a Neighbor

At browser frame `1280x720`, Cocos selects the high profile because frame width
is at least `720`. The numeric pixel/scale values below assume DPR `1`; a higher
DPR multiplies frame and viewport pixels together but preserves the same aspect,
camera world bounds, and diagnosis.

| Quantity | Value |
|---|---:|
| design rectangle | `720x1280` |
| `SHOW_ALL` scale | `min(1280/720, 720/1280) = 0.5625` |
| centered design viewport in browser pixels | about `x=438`, `width=405`, `height=720` |
| Canvas camera orthographic half-height | `720 / 0.5625 / 2 = 640` |
| full-frame camera aspect | `1280/720 = 1.777...` |
| camera horizontal half-span | `640 * 1.777... = 1137.777...` |
| camera world-space X bounds around Canvas center `360` | about `-777.778..1497.778` |
| intended portrait design X bounds | `0..720` |

Once any card is centered at `x=360`, its neighbors are one logical width away,
at `x=-360` and/or `x=1080`. Both coordinates lie inside the landscape camera
bounds but outside the portrait design rectangle. The runtime observation is
therefore the direct composition of:

1. recovered `SHOW_ALL`;
2. a full-frame, screen-aligned Canvas camera;
3. recovered one-logical-width rail spacing;
4. all six live cards without a viewport mask.

At exact high-profile aspect `720x1280`, the camera X bounds are exactly
`0..720`, so there are no side regions in which a neighbor can appear. The same
holds for exact compact aspect `480x800`.

## Classification

**Decision: expected wide-viewport exposure.**

It is not:

- a wrong profile selection: `1280 >= 720` correctly selects `720x1280`;
- a wrong policy: both tracked source and generated output use policy `2`;
- a spacing error: source and tests lock one raw logical width per card;
- a missing-card-culling regression: native-faithful presentation deliberately
  owns all six physical RopeButtons and their joints simultaneously;
- evidence that Web Desktop is supported: Phase 7 explicitly excludes it.

The black areas should be described as camera-clear space outside the recovered
portrait design rectangle, not as an isolated DOM layer guaranteed to occlude
game objects.

## Honest Phase 7 H5 Matrix

Record exact browser, OS, CSS viewport, DPR, Cocos `screen.windowSize`, selected
asset tree, and orientation for every run. CSS width alone does not determine
the branch because Cocos multiplies it by DPR, capped at `2`.

### Release acceptance

| Tier | Browser/device | CSS viewport and DPR | Expected Cocos frame/profile | Acceptance claim |
|---|---|---|---|---|
| Canonical compact geometry | Desktop Chromium, Firefox, and WebKit harnesses | `480x800`, DPR `1`, portrait | `480x800`; compact | Full static-layout fidelity gate; no off-design margins; all menus and six modes |
| Canonical high geometry | Desktop Chromium, Firefox, and WebKit harnesses | `720x1280`, DPR `1`, portrait | `720x1280`; high | Full static-layout fidelity gate; no off-design margins; all menus and six modes |
| Android phone release | Chrome on a real supported Android device | representative `360x800`, DPR at least `2`, portrait | typically `720x1600`; high | Supported mobile functional/responsive gate; `SHOW_ALL` vertical clear space is allowed, but controls, touch, audio, save, pause/result/retry, and all six modes must pass |
| iPhone release | Safari on a real supported iOS device | representative `390x844`, DPR at least `2`, portrait | typically `780x1688`; high | Supported mobile functional/responsive gate with the same criteria; record the actual post-browser-chrome viewport |
| Compact Web branch | Chrome Android or a DPR-`1` mobile/emulation target | any tested portrait frame whose Cocos width is `<720`; include exact `480x800` | compact | Required branch-coverage gate; do not assume modern high-DPR phones exercise this branch |

For common tall phones, `SHOW_ALL` may expose vertical camera-clear space and
off-design entrance geometry. Accept it only as responsive behavior; fidelity
scoring remains anchored to the canonical logical rectangle.

Each supported row should additionally require:

- Pages-prefix load with zero failed eager/lazy requests and zero game/Cocos
  console errors;
- touch/blade entry, horizontal drag/flick, all six mode handoffs, pause,
  resume, replay/retry, result, quit/back, audio unlock, and storage;
- initial load, browser background/foreground, resize caused by browser chrome,
  and portrait-orientation handling;
- screenshots at stable checkpoints, with any clear-space exposure recorded
  separately from design-rectangle fidelity.

### Compatibility-only or unsupported

| Shape | Phase 7 label | Expected behavior |
|---|---|---|
| `1280x720`, DPR `1`, desktop landscape | Diagnostic smoke only; **not supported Web Desktop** | High profile; centered portrait content; neighboring Mode Select rail content may render in side clear space |
| Mobile landscape, such as `844x390` | Unsupported | Portrait build/orientation contract no longer matches frame; severe horizontal exposure is expected |
| Wide portrait tablet/foldable, such as `768x1024` | Compatibility-only until separately validated | High profile and wider-than-design aspect; partial off-design horizontal content may be visible |
| Samsung Internet, Firefox Android, embedded webviews, or other untested engines | Unclaimed | Add only after an explicit device/browser pass |

Passing at `1280x720` with zero console errors is useful compatibility evidence,
but it must not be promoted to visual-fidelity or Web Desktop support.

## Fix Recommendation

No implementation fix is justified by the evidence, so do not:

- change `SHOW_ALL`, `fitWidth`, or `fitHeight`;
- alter the recovered rail anchors or spacing;
- cull/deactivate neighboring physical RopeButtons;
- add a gameplay-layer mask that would also clip rope physics, cut halves,
  particles, or recovered entrance motion.

If desktop support is added later by an explicit product decision, the
lowest-risk direction is a Web-shell-only portrait aspect-ratio container with
host-owned black margins. That would be a new Web Desktop presentation feature,
not a correction to the recovered gameplay implementation, and would require
fresh input-coordinate, resize, and Pages-template tests.

## Unresolved Questions

- Which exact Android and iOS OS/browser versions will Phase 7 designate as the
  release floor? Record them when physical-device validation occurs.
- Will wide portrait tablets/foldables remain explicitly compatibility-only, or
  become a separately accepted H5 viewport tier?
