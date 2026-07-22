# BasicBlade Presentation Contract

Status: statically recovered and independently cross-checked on 2026-07-23  
Evidence: `DER-NATIVE-001`, `DER-NATIVE-CORPUS-001`, `DER-FUNCMAP-001`,
`DER-RESMAP-001`

This contract defines the default textured blade trail used by the current Classic
reconstruction. It was recovered without installing, loading, or executing the original APK or
`libgame.so`. GNU and LLVM disassembly were compared against the immutable native hash
`55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e`.

## Native anchors

| Address | Symbol | Contract surface |
|---|---|---|
| `0x0014343C` | `BasicBlade::DisposeStateUpdate()` | one-point disposal and width division |
| `0x00143458` | `BasicBlade::onEnter()` | backing sprite and ten-point initialization |
| `0x00143484` | `BasicBlade::draw()` | draw gate, vertex layout, texture/blend source, strip draw |
| `0x0014366C` | `BasicBlade::BasicBlade(char const*)` | texture path and stock textured-color shader |
| `0x001436B4` | `BasicBlade::updateColor()` | sprite-quad color copy |
| `0x00143738` | `BasicBlade::getDefaultBladeWidth()` | viewport-width formula |
| `0x00143768` | `BasicBlade::SetNew()` | path/state reset and base-width restore |
| `0x0014381E` | `BasicBlade::InitializeWithMaximumPoint(int)` | vertex capacity |
| `0x00143AE0` | `BasicBlade::OnPathMemberChanged()` | positions and UV rebuild |
| `0x00144B74`–`0x00144F74` | `Blade` lifecycle methods | state, update, push, pop, overflow |
| `0x001602D4`–`0x00160640` | `PhysicsBladeLayer` touch methods | four-slot begin/move/end routing |
| `0x001612C0` | `PhysicsBladeLayer::onEnter()` | blade type/resource selection and z-order |

## Construction and selection

- A new `Blade` starts with touch ID `-1`, state `0`, zero previous/current endpoints, an
  empty path, and a scheduled per-frame update.
- `BasicBlade::onEnter()` creates and retains a sprite from its supplied texture path and
  initializes a maximum of exactly `10` path points.
- Selected blade IDs `0..12` create exactly four `BasicBlade` children at z-order `1` with
  native path format `Blades/blade%d.png`.
- IDs `13..16` instead create four `DragonBlade` instances. ID `17` creates four
  `CentipedeBlade` instances. Those geometry strategies are outside this contract.
- The recovered persistence default is selected blade `0`; an existing save may override it.
  The bounded Phase 5A implementation therefore restores clean/default selection `0` only and
  must not claim that every saved session selects it.

Default selected resource in both resolution trees:

| Canonical path | Bytes | PNG | SHA-256 |
|---|---:|---|---|
| `480x800/Blades/blade0.png` | 634 | 256x256, 8-bit RGB, no alpha | `32713af6c40cf4e9a0b48e87fed53c37cb32818b14143020db22787c336559d8` |
| `720x1280/Blades/blade0.png` | 634 | 256x256, 8-bit RGB, no alpha | `32713af6c40cf4e9a0b48e87fed53c37cb32818b14143020db22787c336559d8` |

The two default files are byte-identical. The top 128 rows are RGB `#4D4D4D`; the bottom
128 rows are `#333333`.

## Touch and state lifecycle

- Begin claims the first free entry only when the blade vector has exactly four entries. It
  stores the touch ID and endpoints but does not append a trail point.
- A fifth simultaneous touch is not claimed. Native container iteration defines allocation;
  chronological simultaneous-touch ordering is not proven.
- Every accepted move updates endpoints and appends its current point, including a repeated or
  zero-distance point.
- State `1` blocks `Push`, but no default BasicBlade transition into that state is assigned by
  this contract.
- A push received in disposal state `4` first calls `SetNew()`: old points are cleared, state
  returns to `0`, and base width is restored before the new point is appended.
- After an append makes the transient count greater than `10`, `Pop(2)` removes exactly the
  two oldest points and leaves nine. Native overflow rebuilds geometry inside `Pop` and again
  after `Push`; this redundant second rebuild has no different final data.
- End immediately frees the touch ID, zeroes both endpoints, and enters state `4`. It does not
  immediately clear the visual path, so that slot can be reclaimed while its old path disposes.
- On each scheduled frame in state `4`:
  - if the frame starts with at least two points, remove one oldest point, rebuild geometry with
    the current pre-division width, then divide stored width by float32 `1.1`;
  - if the frame starts with at most one point, `SetNew()` clears it, restores base width, and
    returns state to `0`.
- Disposal is frame-count based. No elapsed-time conversion is permitted.
- Cutting-disabled state gates post-physics raycasts, not touch ownership or visual updates.

Creator touch cancellation has no recovered original callback contract. Treating cancellation
as end is a bounded cleanup inference; it must stay labeled and cannot increase recovered
coverage.

## Float32 width

All intermediate operations follow float32 order:

```text
baseWidth = f32(f32(f32(viewportWidth - 480.0) * 0.0024999999441206455) + 3.5)
```

This yields exactly `3.5` for width `480` and `4.099999904632568` for width `720`. No clamp
was recovered. During disposal, each completed point removal stores:

```text
currentWidth = f32(currentWidth / 1.100000023841858)
```

The geometry rebuilt on that frame still uses the width from before this division.

## Geometry

No draw is submitted unless the path contains at least three points and the vertex buffer and
backing sprite exist. For `N >= 3`, define `P0..P(N-1)` and current pre-rebuild width `w`:

```text
V0.position = P0
step = f32(w / f32(N - 2))

for i = 0 .. N - 3:
    h = f32(w - f32(w * f32(1.0 - f32(f32(i) * step))))
    A = P[i]
    B = P[i + 1]
    length = length(B - A)
    angle = angle(B - A)

    V[2*i + 1].position = rotateAround(A, (A.x + length, A.y + h), angle)
    V[2*i + 2].position = rotateAround(A, (A.x + length, A.y - h), angle)

V[2*N - 3].position = P[N - 1]
```

For a nonzero segment the pair is equivalent to `B +/- perpendicularUnit(B-A) * h`. That
normalized form is not valid unconditionally: when `A == B`, native angle resolves to zero and
the pair is `(A.x, A.y+h)` and `(A.x, A.y-h)`.

`N=3` submits four vertices, but `i=0` gives `h=0`, so the strip is fully degenerate. It is a
draw submission, not verified visible output. `vertexFromAlphaPoint` is not called by this
path rebuild and is not part of the geometry contract.

## UV and color

Coordinates below are alpha points mapped affinely through the backing sprite quad. This
mapping preserves sub-rects and swaps alpha axes for a rotated atlas sprite:

```text
V0.uv = mapSprite(.5, .5)

for i = 0 .. N - 3:
    u = f32(f32(i + 1) / f32(2 * N))
    V[2*i + 1].uv = mapSprite(u, 1)
    V[2*i + 2].uv = mapSprite(u, 0)

V1.uv = mapSprite(.25, 1)
V2.uv = mapSprite(.25, 0)
V[2*N - 3].uv = mapSprite(1, .5)
```

Every emitted vertex copies the backing sprite quad color bytes. No BasicBlade color setter
was recovered. White modulation is the legacy engine default and therefore an engine-mapping
inference, not an app constant.

## Draw contract

- Primitive: `GL_TRIANGLE_STRIP`.
- Count: `2*N - 2` vertices.
- Legacy stride: `20` bytes.
- Position: two float32 values at byte `0`.
- Color: four normalized unsigned bytes at byte `8`.
- UV: two float32 values at byte `12`.
- Allocation for maximum `10`: `500` bytes; allocation capacity is not draw count.
- Shader behavior: stock position-texture-color path.
- Texture and blend function are read from the backing sprite at draw time.

Creator must preserve the 20-byte attribute layout and strip topology through a dedicated
textured mesh. A `Graphics` line, smoothing, glow, additive effect, replacement texture, or
invented particle is not an accepted implementation.

## Creator mapping

- `BasicBladeTrailModel` owns four independent path/state/width/geometry slots.
- `ClassicBladePresenter` consumes raw began/moved/ended events. It must not derive points from
  the post-physics nonzero ray list, because zero-distance moves remain visual-path inputs.
- Creator resource loading is asynchronous, unlike the covered native construction boundary.
  If a touch begins before the presenter attaches and a move arrives after attachment, the
  adapter lazily claims that recovered slot immediately before appending the real move point;
  it does not synthesize the missed begin point. An end received for an unclaimed presenter
  slot is a no-op, so a gesture completed before attachment leaves no synthetic trail. This is
  a Creator lifecycle compatibility rule, not recovered native behavior.
- Four mesh nodes are created before gameplay objects under a z-order-`1` presentation root.
- The exact SpriteFrame quad maps alpha UVs to the imported texture.
- Creator's textured unlit material and cancellation cleanup are explicit compatibility
  inferences. Legacy numeric blend factors, sampler filtering/wrapping, and pixel output remain
  unknown and isolated at this adapter boundary.
- Advanced selected-blade particles are not attached to default ID `0`; no placeholder effect
  is allowed.

## Validation

1. Assert clean construction, four-slot isolation, fifth-touch rejection at the input owner,
   and reuse while disposal is active.
2. Assert begin adds no point and repeated moves do add points.
3. Assert overflow `11 -> 9` and exact retained order.
4. Assert ordered float32 width values at `480` and `720`.
5. Assert horizontal, vertical, and zero-length geometry, UVs, count, and degenerate `N=3`.
6. Assert disposal rebuilds with pre-division width, removes one point per frame, becomes
   non-drawable below three points, and resets only on the following `N<=1` frame.
7. Assert both staged resources match dimensions, byte count, RGB type, and exact hash.
8. Assert the Creator mesh uses triangle-strip topology and the recovered 20-byte attribute
   offsets, uses the exact SpriteFrame texture, creates four owners at z-order `1`, and has no
   `Graphics` fallback.
9. Span began/moved/ended across asynchronous resource attachment. Assert lazy claim uses only
   the first real post-attachment move and that a fully pre-attachment gesture leaves no owner.
10. Run the full Classic regression suite, strict Creator TypeScript compiler, and prohibited
   original-runtime boundary audit.

## Explicit unknowns

- Original pixel/framebuffer output and device crop.
- Numeric sprite blend factors and texture sampler filtering/wrapping at runtime.
- Wall-clock disposal duration at any particular frame rate.
- Original touch-cancel handling.
- Native startup has no equivalent for Creator's asynchronous presenter-attachment window;
  the bounded lazy-claim/end-no-op adapter above is not counted as recovered behavior.
- Shared RNG interleaving and non-default blade particle parity.
- Saved non-default blade selection until the full Settings/Options flow is restored.
