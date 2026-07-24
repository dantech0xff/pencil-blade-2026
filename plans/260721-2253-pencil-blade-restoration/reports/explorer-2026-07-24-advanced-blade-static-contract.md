# Advanced Standard-Blade Static Contract

---
date: 2026-07-24
scope: standard cosmetic blade IDs 13 through 17 and move-particle ambiguities
method: static ELF disassembly and literal/string inspection only
binary: `.forensics-work/phase-01/native/libgame.so`
sha256: `55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e`
---

## Outcome

The advanced standard blades are implementable without reusing or approximating the
`BasicBlade` renderer:

- **[RECOVERED]** selected IDs `13..16` create four `DragonBlade(ID - 13)` instances.
  Selected ID `17` creates four `CentipedeBlade` instances
  (`PhysicsBladeLayer::onEnter`, `0x00161380..0x00161414`).
- **[RECOVERED]** Dragon samples a waved render path every `20.0` units and retains at most
  15 render points. Centipede uses `10.0` units and retains at most 20 render points
  (`DragonBlade::Push`, `0x0014e8a8..0x0014ea34`;
  `CentipedeBlade::Push`, `0x00147cc8..0x00147e54`).
- **[RECOVERED]** the constructor's nominal maximum of 32 is not the active base-path cap.
  The advanced `update` overrides hard-code an overflow test at 11 base points and remove one
  oldest base point per scheduled update
  (`0x0014e03e..0x0014e058`, `0x001473ce..0x001473e8`).
- **[RECOVERED]** draw transforms use the waved render points directly. A second resampled
  scratch path is rebuilt but never consumed by head, body, or tail transforms
  (Dragon scratch `0x0014e4a2..0x0014e59c`, render `0x0014e5c8..0x0014e89c`;
  Centipede scratch `0x00147922..0x00147a24`, render `0x00147a4a..0x00147cba`).
- **[CORRECTED]** `ParticleObject::SetVectorRotation()` is not `atan2(delta.y, delta.x)`.
  It compares the stored movement vector with the particle node's absolute current position
  and uses one-argument `atanf`
  (`0x001601f8..0x00160224`, `0x001653a0..0x001653bc`).
- **[CORRECTED]** Fire selection 1 does not produce a value in `[-45,+45]`.
  `RandomRotaion(-45,+45)` produces exactly
  `0, 4.5, 9, ..., 40.5` degrees for the ten native deciles
  (`0x00160158..0x0016017a`, call at `0x00160c12..0x00160c18`).
- **[CORRECTED]** each Fire smoke particle draws X from
  `trunc(float32(-0.1W))..trunc(double(0.2W))`, not through `+0.1W`
  (`0x00160c6c..0x00160c94`, repeated at
  `0x00160d0a..0x00160d32` and `0x00160da8..0x00160dd0`).

No APK, native library, or game runtime was loaded or executed.

## Evidence and Confidence

- **[RECOVERED]** means a direct branch, immediate, literal, string, or data-flow result in the
  scoped ELF.
- **[DERIVED]** means algebra or collection-size interpretation derived directly from recovered
  operations.
- **[UNKNOWN]** identifies behavior outside the inspected bodies or behavior that would require
  execution to distinguish.

The ELF is a stripped 32-bit little-endian ARM EABI5 object. Dynamic symbol addresses were
enumerated with `llvm-nm -D -n -C`; Thumb code was decoded with
`llvm-objdump --triple=thumbv7-none-linux-gnueabi`. The first load segment maps virtual
addresses to equal file offsets, so the literals cited below were also checked directly at
their virtual-address file offsets.

### Principal symbols

| Contract body | Address |
|---|---:|
| `CentipedeBlade::DisposeStateUpdate` | `0x00147350` |
| `CentipedeBlade::SetToDisposeState` | `0x00147370` |
| `CentipedeBlade::update` | `0x001473a0` |
| `CentipedeBlade::fAngle` | `0x00147448` |
| `CentipedeBlade::FSin` | `0x00147530` |
| `CentipedeBlade::SetNew` | `0x001475f0` |
| `CentipedeBlade` constructor | `0x00147734` |
| `CentipedeBlade::draw` | `0x00147870` |
| `CentipedeBlade::Push` | `0x00147cc8` |
| `DragonBlade::DisposeStateUpdate` | `0x0014dfb8` |
| `DragonBlade::SetToDisposeState` | `0x0014dfda` |
| `DragonBlade::update` | `0x0014e010` |
| `DragonBlade::fAngle` | `0x0014e0b8` |
| `DragonBlade::FSin` | `0x0014e198` |
| `DragonBlade::SetNew` | `0x0014e218` |
| `DragonBlade` constructor | `0x0014e26c` |
| `DragonBlade::draw` | `0x0014e3f0` |
| `DragonBlade::Push` | `0x0014e8a8` |
| `ParticleObject::RandomRotaion(float,float)` | `0x00160158` |
| `ParticleObject::RandomPositionData` | `0x0016017e` |
| `ParticleObject::SetVectorRotation` | `0x001601f8` |
| `PhysicsBladeLayer::ccTouchesMoved` | `0x00160640` |
| `PhysicsBladeLayer::onEnter` | `0x001612c0` |
| `RandomHelper::nextInt(int,int)` | `0x0016196c` |
| `RandomHelper::nextFloat` | `0x001619a0` |
| `VectorHelper::getAngleOfVector(point,point)` | `0x001653a0` |

## Selected-ID Construction and Resources

`PhysicsBladeLayer::onEnter()` loads the selected cosmetic ID, then dispatches as follows
(`0x0016131e..0x00161414`):

| Selected ID | Native construction | Count | Layer z |
|---:|---|---:|---:|
| `0..12` | `BasicBlade` | 4 | 1 |
| `13..16` | `DragonBlade(selectedID - 13)` | 4 | 1 |
| `17` | `CentipedeBlade` | 4 | 1 |
| other | no blade object in this switch | 0 | — |

For every advanced instance, the layer attaches the blade node at z `1`, focuses its combo
manager on the layer score manager, and appends it to the four-slot blade vector
(`0x00161388..0x001613cc`, `0x001613d4..0x00161414`).

### Dragon resources

`DragonBlade(int variant)` requests the following exact strings, with
`variant = selectedID - 13`:

```text
Blades/Dragon/dragon-head-%d.png
Blades/Dragon/dragon-body-%d.png
Blades/Dragon/dragon-tail-%d.png
```

The format calls and sprite construction are at `0x0014e2ca..0x0014e376`; the strings are at
ELF offsets `0x003d10cd`, `0x003d10ee`, and `0x003d110f`.

Each Dragon instance creates one head, 15 independent body sprites, and one tail. It hides every
sprite before adding it as a child at z `1`, and records the X content-size component of body
sprite `0` as its body width (`0x0014e2d6..0x0014e392`). No anchor, texture-rect, flip, blend,
or UV mutation occurs in this constructor.

### Centipede resources

`CentipedeBlade()` requests:

```text
Blades/Centipede/head.png
Blades/Centipede/body.png
Blades/Centipede/tail.png
```

The strings occur at ELF offsets `0x003d0ef1`, `0x003d0f0b`, and `0x003d0f25`. The constructor
creates one head, 20 body sprites, and one tail, initially hides them, attaches them at z `1`,
and records body sprite `0`'s width (`0x00147780..0x00147828`). It likewise performs no
anchor, texture-rect, flip, blend, or UV mutation.

## Advanced Trail Data Model

Use these names in the rest of the contract:

- `B`: base anchor vector inherited from `Blade`, oldest to newest.
- `Q`: waved render-point vector owned by the advanced renderer, oldest to newest.
- `S`: draw-time resampling scratch vector.
- `phase`: the wave phase accumulator.
- `n`: `Q.length`.

The native object layout is not required by a clean implementation, but the three distinct
vectors are proven by their separate vector bases: inherited `B` at object offset `0x100`;
Dragon `Q/S` at `0x128/0x134`; Centipede `Q/S` at `0x120/0x12c`
(constructors `0x00147734..0x00147778`, `0x0014e26c..0x0014e2b8`).

Both constructors call `InitializeWithMaximumPoint(32)`
(`0x00147778..0x0014777c`, `0x0014e2c0..0x0014e2c6`), which stores `32` in the inherited
limit field (`Blade::InitializeWithMaximumPoint`, `0x00144b74..0x00144b78`). Their overridden
`update` methods never read that field; they compare the byte size of `B` directly with
`0x57` instead (`0x001473ce..0x001473de`, `0x0014e03e..0x0014e04e`).

### Effective capacities

| Collection | Dragon | Centipede | Evidence |
|---|---:|---:|---|
| configured inherited limit | 32 | 32 | constructor calls above |
| active `B` overflow trigger | count 11 | count 11 | byte size `> 0x57`; advanced `update` |
| action at `B` overflow | pop exactly 1 oldest | pop exactly 1 oldest | `OnOverPointLimit`, `0x0014dfa8..0x0014dfb4`, `0x00147340..0x0014734c` |
| retained `Q` maximum | 15 | 20 | byte size `>0x7f` / `>0xa7` after insertion |
| sprite body pool | 15 | 20 | constructors |
| maximum visible body indices | `1..14` | `1..19` | draw reverse loops; body `0` stays hidden |

The base-path limit is checked only during scheduled `update`. A sequence of accepted pushes can
therefore leave `B` above ten temporarily; each subsequent update removes only one oldest point.
The render-path cap is synchronous inside every generated-point insertion: insertion of Dragon
point 16 or Centipede point 21 shifts the vector left once and restores its retained maximum
(`0x0014e9c0..0x0014ea06`, `0x00147de0..0x00147e26`).

## Lifecycle and State Contract

The relevant inherited states are `0 = new`, `1 = blocked`, `2 = active`, and `4 = disposing`
(`Blade::SetNew`, `0x00144b9c`; `Blade::Block`, `0x00144bb2`;
advanced first push at `0x00147d02..0x00147d1a` /
`0x0014e8e2..0x0014e8fa`; `Blade::SetToDisposeState`, `0x00144bba`).

### Push entry behavior

- State `1`: return without modifying either path
  (`0x00147cd0..0x00147cd8`, `0x0014e8b0..0x0014e8b8`).
- State `4`: call the virtual `SetNew()` first, then process the incoming point as a new gesture
  (`0x00147cda..0x00147cf0`, `0x0014e8ba..0x0014e8d0`).
- Empty `B`: append the input point to both `B` and `Q`, set state `2`, and return
  (`0x00147cf0..0x00147d1e`, `0x0014e8d0..0x0014e8fe`).

### Active update

When state is `2` and `B` has 11 or more points, the advanced override invokes
`OnOverPointLimit()`, which invokes inherited `Pop(1)`. This removes exactly one oldest point;
it is not a `while` reduction (`0x001473ce..0x001473e8`,
`0x0014e03e..0x0014e058`, `Blade::Pop` at `0x00144bc2..0x00144c34`).

### Touch-end and disposal

`SetToDisposeState()` stores the current `Q` count, then sets inherited state `4`
(`0x00147370..0x0014738c`, `0x0014dfda..0x0014dff6`).

On a state-`4` update:

- if `B.length >= 2`, virtual `DisposeStateUpdate()` runs;
- if `B.length <= 1`, virtual `SetNew()` runs
  (`0x001473b0..0x001473cc`, `0x0014e020..0x0014e03c`).

Advanced `DisposeStateUpdate()` does **not** pop `B` and does not return to state `0`. It writes
`-1` over the saved count, clears `Q` by assigning its end pointer to its begin pointer, and
sets the opacity byte to Dragon `239` or Centipede `244`
(`0x0014dfb8..0x0014dfd8`, `0x00147350..0x0014736e`). Thus a normal gesture with at least two
base anchors remains in state `4` until the next `Push`, whose state-`4` entry calls `SetNew`.
The empty `Q` causes the next draw to hide all component sprites
(`0x0014e3f0..0x0014e464`, `0x00147870..0x001478e2`).

`SetNew()` performs:

| Reset | Dragon | Centipede | Evidence |
|---|---:|---:|---|
| `phase` | `0.0f` | `0.0f` | `0x0014e218..0x0014e220`; `0x001475f0..0x001475f8` |
| extra Dragon float | `1.0f` | n/a | `0x0014e222..0x0014e226` |
| clear `Q` | yes | yes | `0x0014e228..0x0014e238`; `0x001475fa..0x0014760a` |
| opacity | `255` | `255` | `0x0014e23a..0x0014e240`; `0x0014760c..0x00147610` |
| hide body pool | all 15 | all 20 | `0x0014e242..0x0014e260`; `0x00147612..0x00147630` |
| inherited reset | state `0`, clear `B` | state `0`, clear `B` | calls `Blade::SetNew` |

`SetNew()` does not explicitly hide head or tail. The `n < 3` draw branch hides them if visible
(`0x0014e428..0x0014e464`, `0x001478a6..0x001478e2`).

## Exact Push and Wave Sampling

Let incoming point be `P`, `A = B.last`, `delta = P - A`, and
`D = length(delta)`. All interpolation and vector operations are float32 unless explicitly
identified below.

Dragon uses:

```text
step = 20.0f
wave(phase) = float32(sinf(float32(phase * 5.0f)) * 15.0f)
Q maximum = 15
```

The constants are at `0x0014ea34`, `0x0014e1b0`, and `0x0014e1b4`; the wave helper is
`0x0014e198..0x0014e1ac`.

Centipede uses:

```text
step = 10.0f
t = float32(phase * 5.0f)
wave(phase) = float32(sin(double(t)) * 15.0)
Q maximum = 20
```

The constants are at `0x00147e54` and `0x00147550..0x00147558`; the wave helper is
`0x00147530..0x0014754e`.

For either renderer:

```text
segments = truncTowardZero(float32(D / step))

for j = 1 through segments:
    scaledDelta = float32(delta * float32(j))
    straight = A + float32(scaledDelta * float32(step / D))
    normal = (-normalize(delta).y, normalize(delta).x)
    waved = straight + float32(normal * wave(phase))
    phase = float32(phase + step)
    Q.push(waved)
    if Q exceeds its family cap:
        remove Q[0]
    if j == segments:
        B.push(straight)

if segments > 1:
    OnPathMemberChanged()
```

The loop and operation order are Dragon `0x0014e900..0x0014ea2e` and Centipede
`0x00147d20..0x00147e4e`. `OnPathMemberChanged()` resolves to the inherited no-op
(`Blade::OnPathMemberChanged`, `0x00144b9a`) unless another runtime subclass changes the
vtable, which these two constructors do not.

Consequences required for parity:

- `segments == 0`: discard `P`; append nothing; do not change phase or state
  (`0x0014e936..0x0014e946`, `0x0014ea1a..0x0014ea22`, and Centipede equivalents).
- The final base anchor is `straight`, not the waved point and not necessarily `P`
  (`0x0014ea08..0x0014ea16`, `0x00147e28..0x00147e36`).
- Residual sub-step distance carries into the next push because the anchor advances only by
  whole steps.
- The first point of a gesture is unmodified in both `B` and `Q`; every later `Q` insertion is
  waved.
- Phase is sampled before increment and persists across accepted pushes until `SetNew`.

Dragon length uses float32 `sqrtf` (`0x0014e1b8..0x0014e216`). Centipede forms the squared sum
with float32 operations, promotes it to double for `sqrt`, then truncates to float32
(`0x00147560..0x001475ce`). Preserve this distinction only if bit-level cross-family parity is
required.

## Exact Draw Contract

### Visibility threshold

If `n < 3`, draw hides every body sprite, then hides head and tail if each is currently visible,
and returns (`0x0014e3f0..0x0014e464`, `0x00147870..0x001478e2`).

If `n >= 3`, draw makes head and tail visible if needed, rebuilds `S`, hides the full body pool,
then lays out bodies using `Q` (`0x0014e466..0x0014e5c8`,
`0x001478e4..0x00147a4a`).

### Dead resampling pass

The native pass is:

```text
S.clear()
S.push(Q[n - 1])
d = bodySpriteWidth
for i = n - 1 down to 1:
    S.push(S.last + (Q[i - 1] - Q[i]) * (d / length(Q[i], Q[i - 1])))
    d = (float32(i) / float32(n)) * bodySpriteWidth
```

Dragon implements it at `0x0014e4a2..0x0014e59c`; Centipede at
`0x00147922..0x00147a24`. The subsequent loops reload `Q`, not `S`
(Dragon from `0x0014e5c8`; Centipede from `0x00147a4a`). Therefore `S` has no recovered visual
consumer and may be omitted from a visual restoration; using it for component placement would
diverge from the binary.

### Body transforms

After hiding all bodies, draw iterates `i = n - 1` down through `1`. It shows `body[i]` and sets:

```text
bodyPosition = (Q[i] + Q[i - 1]) * 0.5f
bodyAngleRadians = fAngle(Q[i - 1] - Q[i])
bodyRotationDegrees = float32(bodyAngleRadians * 57.29578f)
bodyOpacity = current family opacity byte
```

Dragon body layout is `0x0014e5c8..0x0014e6f8`; Centipede body layout is
`0x00147a4a..0x00147b78`. The radians-to-degrees literal is `0x42652ee1`
at `0x0014e8a4` / `0x00147cc4`.

Dragon additionally sets:

```text
bodyScale(i,n) =
    float32(
        float32(i / (n - 1))
        + float32(0.5f * float32((n - 1 - i) / n))
    )
```

with the exact float32 operation sequence at `0x0014e612..0x0014e660`.
Centipede sets every visible body scale to `1.0f`
(`0x00147b12..0x00147b1e`). Body index `0` remains hidden in both families.

### Tail transform

Let:

```text
v = Q[1] - Q[0]
w = tailSpriteWidth
tailPosition = Q[0] - v * (w / (w + length(v)))
tailRotationDegrees = fAngle(-v) * 57.29578f
tailOpacity = current family opacity byte
```

Dragon implements this at `0x0014e704..0x0014e7c2`; Centipede at
`0x00147b7e..0x00147bf4`. No tail scale is set in draw.

### Head transform

Let:

```text
head = Q[n - 1]
back = Q[n - 2] - head
h = 0.5f * headSpriteWidth
headPosition = head - back * (h / (h + length(back)))
headRotationDegrees = fAngle(back) * 57.29578f
headOpacity = current family opacity byte
```

Dragon implements this at `0x0014e7c4..0x0014e89c`; Centipede at
`0x00147bf6..0x00147cba`. No head scale is set in draw.

### `fAngle` must not be replaced by `atan2`

For vector `(x,y)`, the recovered helper is:

```text
if x == 0 and y == 0:  0
if x == 0 and y > 0:  +pi/2
if x == 0 and y < 0:  -pi/2
if y == 0 and x < 0:  -pi
otherwise:
    t = atan(y / x)
    if x < 0: pi - t
    else:     -t
```

Dragon uses float32 division and `atanf` (`0x0014e0b8..0x0014e146`). Centipede uses float32
division, promotes that quotient to double for `atan`, then truncates to float32
(`0x00147448..0x001474de`). The special-case literals and double-precision `pi` are at
`0x0014e148..0x0014e158` and `0x001474e0..0x001474f0`.

No explicit zero-length guard exists in the body/head/tail placement divisions. Generated
points normally have a nonzero step, but an implementation seeking malformed-input parity should
retain IEEE behavior rather than invent a fallback.

## Particle RNG and Rotation Contract

This section resolves the ambiguities found while inspecting the same
`PhysicsBladeLayer::ccTouchesMoved` body. It applies to particle IDs `7..12`, even though the
advanced renderer itself is IDs `13..17`.

### Shared RNG primitives

`RandomHelper::nextInt(min,max)` consumes one `lrand48()` result and returns:

```text
min + (lrand48() % (max - min + 1))
```

so both endpoints are inclusive (`0x0016196c..0x00161998`).

`RandomHelper::nextFloat()` consumes one `lrand48()` result and returns float32:

```text
(lrand48() % 10) / 10.0f
```

so its only results are the ten deciles `0.0f` through `0.9f`
(`0x001619a0..0x001619d0`).

`ParticleObject::RandomPositionData(min,max)` consumes exactly four inclusive integer draws in
this order (`0x0016017e..0x001601c8`):

1. X sign from `[-1,1]`;
2. X magnitude from `[min,max]`;
3. Y sign from `[-1,1]`;
4. Y magnitude from `[min,max]`.

The sign draw includes zero; it is not a two-way `-1/+1` choice. X and Y direct-range helpers
consume one inclusive integer draw each (`0x001601cc..0x001601f4`).

All gates, selections, lifetimes, movement values, and rotation deciles share this one stream.
Gate failure consumes only the gate draw.

### Exact successful-spawn draw order

`Sx,Sy` below means the four signed-pair draws
`X-sign, X-magnitude, Y-sign, Y-magnitude`; `X,Y` means two direct axis draws.

| ID / branch | Draws after entering its switch case, in exact order | Evidence |
|---|---|---|
| 7 | gate `0..5`; lifetime `50..75`; `Sx,Sy` | `0x00160756..0x0016087a` |
| 8 | gate `0..5`; selection `0..2`; `Sx,Sy` | `0x001607ce..0x0016087a` |
| 9 | gate `0..5`; selection `0..3`; `Sx,Sy` | `0x00160880..0x001609ac`, then common signed helper |
| 10 | gate `0..5`; selection `0..5`; lifetime `50..75`; `Sx,Sy` | `0x001609ae..0x00160a38`, then `0x00160eb8..0x00160ecc` |
| 11 selection 0 | gate `0..4`; selection `0..2`; lifetime `25..125`; `X,Y` | `0x00160ab0..0x00160b70` |
| 11 selection 1 | gate; selection; lifetime `25..125`; `X,Y`; one decile | `0x00160b72..0x00160c18` |
| 11 selection 2 | gate; selection; then three repetitions of `lifetime 25..125, X, Y` | `0x00160c1e..0x00160dea` |
| 12 | gate `0..6`; selection `0..4`; lifetime `50..150`; `Sx,Sy` | `0x00160e30..0x00160ecc` |

Native divides lifetime integers by the float32 `100.0f` literal
(`0x00160a78`, `0x00160e00`, `0x00160f3c`).

### Particle definitions and scaled bounds

Every particle node is positioned at the current touch before movement values are generated
(`setPosition` calls throughout `0x001607a8..0x00160e9c`). Each successful object is attached
to the physics layer at z `1` (`0x0016087e`, `0x00160ed0..0x00160edc`).

For signed particles, both axes use the same integer magnitude bounds:

| ID / selection | Resource | Lifetime seconds | Magnitude bounds |
|---|---|---:|---|
| 7 | `VN Flag/vnflagstar.png` | `nextInt(50,75)/100` | `trunc(float32(.1W))..trunc(double(.35W))` |
| 8 / 0 | `Ice/snowflake.png` | `1.0f` | `.2W` float32 .. `.415W` double |
| 8 / 1 | `Ice/star.png` | `.75f` | `.156W` float32 .. `.3125W` double |
| 8 / 2 | `Ice/circle.png` | `.5f` | `.1W` float32 .. `.25W` double |
| 9 / 0 | `X-Mas/xmasfive.png` | `1.0f` | `.2W` float32 .. `.415W` double |
| 9 / 1 | `X-Mas/xmasfour.png` | `.75f` | `.156W` float32 .. `.3125W` double |
| 9 / 2 | `X-Mas/xmashexa.png` | `.5f` | `.1W` float32 .. `.25W` double |
| 9 / 3 | `X-Mas/xmascircle.png` | `.5f` | `.05W` float32 .. `.156W` double |
| 10 | `Butterfly/butterfly<0..5>.png` | `nextInt(50,75)/100` | `.1W` float32 .. `.4156W` double |
| 12 | `Rainbow/rainbowstar<0..4>.png` | `nextInt(50,150)/100` | `.1W` float32 .. `.2W` double |

The dispatch and literals are `0x00160756..0x00160a6c` and
`0x00160e30..0x00160f40`. Float products use `__fixsfsi`; maximum products shown as double
promote `W`, multiply by the listed double literal, then use `__fixdfsi`. Both conversions
truncate toward zero.

All non-Fire rows enable initial-rotation action, scale-out, and fade-out
(`0x00160790..0x00160a10`, `0x00160e7c..0x00160e90`). Only IDs 10 and 12 additionally replace
the initial sprite angle with `SetVectorRotation`; IDs 7, 8, and 9 retain initial angle zero
(`0x0016087a..0x0016087e` versus `0x00160ec6..0x00160ecc`).

### Exact `SetVectorRotation` inputs

Let:

- `C = particleNode.getPosition()`, which is the absolute current touch position assigned just
  before movement generation;
- `M = particle.motion`, the signed movement vector written by `RandomPositionData`.

`ParticleObject::SetVectorRotation()` copies `C` and `M` and calls
`VectorHelper::getAngleOfVector(C,M)` (`0x001601f8..0x00160218`).
The helper computes `d = M - C`, flips the sign bit of `d.x`, divides by `d.y`, and calls
one-argument `atanf` (`0x001653a0..0x001653bc`). The stored degrees are therefore:

```text
d = float32(M - C)
rotation =
    float32(
        atanf(float32((-d.x) / d.y))
        * 57.29578f
    )
```

This is deliberately **not** any of:

```text
atan2(M.y, M.x)
atan2(C.y + M.y, C.x + M.x)
atan2(d.y, d.x)
```

There is no quadrant correction and no explicit zero-denominator guard. The unusual
absolute-position-versus-displacement input is nevertheless the exact native data flow.
`SetVectorRotation` consumes no RNG draw. Its only switch callers are Butterfly ID `10` and
Rainbow ID `12` at the common `0x00160eca` call.

### Exact Fire behavior

Fire's gate is `nextInt(0,4)==0`, followed by `nextInt(0,2)` selection
(`0x00160ab0..0x00160acc`).

| Selection | Objects | Direct integer movement bounds | Flags | Evidence |
|---:|---|---|---|---|
| 0 | one `Fire/firecircle.png` | X `trunc(float32(-.2W))..trunc(double(.2W))`; Y `trunc(float32(.05W))..trunc(float32(.2W))` | rotation false, scale false, fade true | `0x00160ad4..0x00160b70` |
| 1 | one `Fire/fireparticle.png` | same X/Y as selection 0 | rotation false, scale true, fade true; special initial angle below | `0x00160b72..0x00160c1c` |
| 2 | three independent `Fire/smoke.png` | each X `trunc(float32(-.1W))..trunc(double(.2W))`; Y `0..trunc(float32(.2W))` | rotation false, scale false, fade true | `0x00160c1e..0x00160dea` |

Each Fire object independently draws its lifetime before its X and Y movement draws.
Selection 2 completes and attaches one smoke object before drawing the next object's lifetime
(`0x00160cae..0x00160cbc`, `0x00160d4c..0x00160d5a`).

Selection 1 calls:

```text
RandomRotaion(-45.0f, +45.0f)
```

after X and Y (`0x00160c12..0x00160c18`; literals at `0x00160e18..0x00160e1c`).
The helper's exact float32 operation order is:

```text
u = nextFloat()
rotation = a + (float32(u * b) - a)
```

(`0x00160158..0x0016017a`). With `a=-45`, `b=+45`, and native deciles, the stored values are:

```text
0, 4.5, 9, 13.5, 18, 22.5, 27, 31.5, 36, 40.5
```

The first parameter cancels algebraically; this is not the conventional
`a + u * (b - a)` range formula. Rotation action remains disabled, but the stored value is
applied once as the sprite's initial rotation when the particle enters
(`ParticleObject::onEnter`, `0x0015ffb6..0x0015ffc6`).

## Implementation Acceptance Gates

An implementation matches this static contract only if it:

1. uses four Dragon/Centipede renderers and the exact selected-ID/resource mapping from
   `PhysicsBladeLayer::onEnter`;
2. keeps separate base and waved paths, with 20/10-unit sampling and 15/20 render caps;
3. treats 32 as constructor metadata, not the advanced active overflow limit;
4. makes `n < 3` fully invisible and never renders body index `0`;
5. places sprites from `Q`, not the dead scratch resampling vector;
6. preserves the Dragon body-scale formula and the family-specific float/double math where
   exact parity is claimed;
7. implements the recovered non-`atan2` `fAngle` helper for advanced sprite rotation;
8. preserves particle RNG call count and order, including lifetime-before-position for every
   Fire object;
9. implements Butterfly/Rainbow `SetVectorRotation` from `M - C`, not from movement direction;
10. uses Fire selection 1's native `a + (u*b - a)` operation and smoke's asymmetric
    `[-0.1W,+0.2W]` X bounds.

## Remaining Unknowns

- **[UNKNOWN]** The scoped static bodies do not prove engine scheduling order between an
  input-end callback, the next `update`, and the next `draw`. The state mutations themselves are
  exact, but a possible one-frame visibility difference at disposal requires runtime evidence.
- **[UNKNOWN]** Native `lrand48` seeding is time-based on first use
  (`RandomHelper`, `0x00161948..0x001619c6`). This report specifies consumption order and value
  mapping, not a reproducible seed.
- **[UNKNOWN]** IEEE results for deliberately malformed duplicate points or zero denominators
  were not executed. The native code has no explicit guards; production restoration should not
  manufacture a parity claim for those inputs.
- **[UNKNOWN]** The dead scratch vector has no visual consumer in either inspected draw body.
  Its allocation timing could be observable only through performance or allocation failure, which
  is outside this visual restoration contract.

## Status

Status: DONE
Summary: Static implementation contract recovered for DragonBlade IDs 13–16, CentipedeBlade ID 17, exact particle RNG ordering, SetVectorRotation inputs, and Fire rotation/range semantics.
Concerns/Blockers: Runtime update/draw scheduling at disposal remains intentionally unknown; no blocker remains for deterministic implementation of the recovered logic.
