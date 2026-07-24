# Options and Cosmetic Original Resource Audit

---
date: 2026-07-24
status: done-with-concerns
scope: static-only original-resource audit for Options, cosmetic selectors, and selected cosmetic consumers
baseline-head: c42d7c66ff88c41c9f037061ece6abf376161d62
evidence-policy: no APK, native library, emulator, Creator Preview, or game runtime execution
---

## Decision

The recovered Options surface has an exact direct dependency set for each active resolution
profile:

- **51 PNG rasters**: 15 fixed UI/effect rasters, 10 theme thumbnails, 18 blade thumbnails,
  and 8 background thumbnails;
- **one font**: `Fonts/SlabThing.ttf`;
- **three effects**: `Sounds/menubuttonclick.wav`, `Sounds/mono1.wav`, and
  `Sounds/mono2.wav`.

Both original resolution trees contain all 51 direct rasters. The staged Creator copy therefore
contains 102 direct raster files totaling 1,110,500 bytes. Every staged byte and SHA-256 matches
the original inventory.

The direct Options loader must not absorb the full cosmetic render families. Those are downstream
consumers:

- the already-persistent shared scene owns 10 full-screen themes, 9 full-screen paper
  backgrounds, and 7 ambient leaf rasters;
- gameplay owns the selected blade render resources, optional blade particles, and the shared
  nine-sound swoosh bank.

Four physical thumbnails are outside the recovered selector loops:
`Icons/background-icon-8.png` and `Icons/blade-icon-{19,20,21}.png`. There is no
`blade-icon-18.png`. Background index `8` is nevertheless a valid saved/live full-screen
background in the current target, which exposes a real contract mismatch: the recovered Options
row has only items `0..7`, while Settings and the shared background presenter accept `0..8`.

The selected/pressed-looking files do not form a cosmetic-selected badge family. They are input
frames for Previous, Next, Back, and Buy. `SelectItems` renders the currently selected cosmetic
texture itself; no additional selected-item raster is referenced.

Two release gates remain outside the mechanics of this inventory:

- rights are unresolved for all 862 recovered APK assets in the staging manifest;
- the global Creator metadata audit is structurally clean but remains fidelity-blocked by
  `Fonts/CooperBlackStd.otf`. That OTF is **not** an Options dependency; Options uses the supported
  `SlabThing.ttf`.

## Evidence Boundary and Notation

The requested repository-root `README.md` does not exist. `forensics/README.md`, Phase 6, the
resource catalogs, metadata validator/tests, current loaders/contracts/tests, and the related
Options/cosmetic reports were read instead.

Primary evidence:

- `.forensics-work/phase-01/native/libgame.so`
  (`SHA-256 55385c170f08c45c6a36358c6cac6f4b82104475ae8d2efd22c9187d1038500e`);
- `forensics/native/function-map.csv`;
- `.forensics-work/phase-01/native/strings.txt`;
- `forensics/resources/resource-usage-map.json`
  (`SHA-256 165238f13f4186a9ab429c9c5a8bab07b4a42e941d0608f757d9e41a44d2ce67`);
- `assets/catalog/creator-staging-manifest.json`
  (`SHA-256 9462b09d39004366269b215e25ce61829cf9982d668d79c1940c0fbe10e4e2c2`);
- `scripts/validate-creator-resource-meta.mjs` and its tests;
- `game/assets/scripts/domain/shared-game-scene-resources.ts`;
- `game/assets/scripts/creator/shared-game-resource-loader.ts`;
- `game/assets/scripts/creator/shared-{background,theme}-presenter.ts`;
- `game/assets/scripts/domain/classic-resource-contract.ts`;
- `game/assets/scripts/creator/classic-resource-loader.ts`;
- [Phase 6](../phase-06-recreate-full-game-content-and-progression.md);
- [Options integration map](./explorer-2026-07-24-options-integration-map.md);
- [Options native contract](./researcher-2026-07-24-options-native-contract.md);
- [Cosmetic economy native contract](./researcher-2026-07-24-cosmetic-economy-native-contract.md);
- [Cosmetic Settings checkpoint](./implementer-2026-07-24-cosmetic-settings-runtime.md).

Confidence labels used below:

- **[RECOVERED]** direct native symbol, branch, loop bound, resource string, or constructor;
- **[CORPUS]** exact original file path, IHDR dimensions, bytes, or SHA-256;
- **[CURRENT]** directly inspected Creator TypeScript, metadata, or tests;
- **[INFERRED]** a conclusion from exact static evidence, not an explicit source contract;
- **[UNKNOWN]** static evidence does not close the behavior.

For a logical path `L`, the copies are:

| Role | Exact path form |
|---|---|
| Original extracted APK asset | `.forensics-work/phase-01/jadx/resources/assets/<tree>/L` |
| Original catalog path | `assets/<tree>/L` |
| Creator staged source | `game/assets/game/<tree>/L` |
| Creator bundle contract | `<tree>/L`, then extension stripped by the bundle-path helper |

Shared fonts/audio omit `<tree>`. The user-supplied `game/assets/resources/game/**` location does
not exist in this repository; the byte-verified target is `game/assets/game/**`.

## Static Native Consumer Map

Direct Thumb disassembly resolves the historical callback names and their resource consumers:

| Consumer | Address | Direct resource behavior |
|---|---:|---|
| `OptionsLayer::onEnter` | `0x0015f668` | measures selector/buy geometry; creates `options-title`, coin HUD/label, and Back pair |
| `OptionsLayer::OptionsTitleCallback` | `0x0015f338` | creates the **background** row, header, 8 icons, Buy pair, and price label |
| `OptionsLayer::BackgroundsCallback` | `0x0015efb0` | creates the **blade** row, header, 18 icons, Buy pair, and price label |
| `OptionsLayer::BladesCallback` | `0x0015edb4` | creates the **theme** row, header, and 10 icons |
| `SelectItems::onEnter` | `0x00162d0c` | creates selector backdrop, Previous/Next pairs, and current selected texture |
| three `Selected*Changed` callbacks | `0x0015ec50`, `0x0015ed04`, `0x0015fb7c` | use the current selector index; effect-gated menu click |
| two `Buy*Callback` functions | `0x0015e9f0`, `0x0015eb20` | create the success burst from `xmasfive.png` |
| `OptionsLayer::BackButtonCallback` | `0x0015fc48` | effect-gated menu click and return |

The precise row headers are:

| Surface | Exact raster |
|---|---|
| whole screen title | `Options/options-title.png` |
| background row | `Options/options-backgrounds.png` |
| blade row | `Options/options-blade.png` |
| theme row | `Options/options-themes.png` |

Important correction: direct disassembly shows
`Sounds/menubuttonclick.wav` in **all three** selection callbacks, not
`Sounds/gameplayselected.wav`. The blade-row construction uses `Sounds/mono1.wav`; theme-row
construction uses `Sounds/mono2.wav`. The parallel native/integration reports contain stale
header/audio claims in some sections; the literal targets and call sites above supersede those
claims.

The upstream Main Menu entry control is associated with routing to Options but belongs to the
Main Menu loader, not the direct Options set:

| Logical path | 480x800: dimensions; bytes; SHA-256 | 720x1280: dimensions; bytes; SHA-256 |
|---|---|---|
| `Buttons/button-blue-wheel-normal.png` | 109x107; 7066; `616c7d2bff7cb695b5e96a8a8115c9faac328495d4306fbe60d188da5fcce8b7` | 161x160; 11740; `dce0ee2bda6afdf2dea454ad9644d49f18defd2ec3de8df0058e9b49adb20bcb` |
| `Buttons/button-blue-wheel-selected.png` | 109x107; 3796; `634fe593d3f9ae0d2346bb30491a0729dd3df351de0389552e6073910ca8b4f7` | 161x160; 6062; `b622a5f3b2c077ddeeda11fd75cf13eabf96c4c56e63c1b428e6f1fda899a252` |

Its route callback also uses the shared menu-click effect. It is excluded from the 51-raster
Options preload because the current Main Menu must already own it before Options can be opened.

## Direct Options Raster Inventory

Every value below is read from the original corpus. The Creator metadata validator separately
proves that the staged bytes and dimensions are identical.

| Tree | Direct raster count | Direct raster bytes | Missing direct paths |
|---|---:|---:|---:|
| `480x800` | 51 | 424957 | 0 |
| `720x1280` | 51 | 685543 | 0 |

### Fixed UI and purchase effect: 15 logical rasters

| Logical path | 480x800: dimensions; bytes; SHA-256 | 720x1280: dimensions; bytes; SHA-256 |
|---|---|---|
| `Options/options-title.png` | 552x118; 21224; `b70b1a3893ff8bdb90e3ccdfd37707ff38fac4a217925e402898f73a8f9453e6` | 792x159; 40327; `eb624761c028811320be1963dce1461e9f538e3c120a0e3db3ddbe61411fdba8` |
| `Options/options-backgrounds.png` | 552x74; 10578; `41c048f6f4b81d1fe77608a971490033d810d7bf921eab8703c37ef4470ea2fe` | 792x80; 17765; `723fda49d0cd95704b994f4f6692f5216eb2a5e69b5453a9cc939eee58dc598c` |
| `Options/options-blade.png` | 552x74; 9750; `643e54adcedbd83e0c3a26352a4ec305e1edcc4212d14a08c62332c1031810fc` | 792x80; 16260; `563f33560f1dd12d2db82fd3a5c0890f10ee06801087bc041a45e3f5b10b1d8d` |
| `Options/options-themes.png` | 552x74; 9891; `a5dca5cd7cd2b4d1077921cb532a68a2e526b04a46b60521072ee7807614c4d8` | 792x80; 16406; `dbdf364c8742c85592be30975c19b6af8935ecdfcdb9d515f38f3203811c047e` |
| `Icons/icon-image-background.png` | 139x139; 596; `e782f95859e297da9fb61869d3cbeeba5e0c0a116d9cdad87b77ef1efc20799a` | 208x208; 850; `94a2e60b3eb0896ea2aa2da4fef5c97e85726564dc963e5b533ed31eb7e5477d` |
| `Icons/icon-button-prev.png` | 173x141; 8415; `fc6e4863736a59155d2b7a2dded5996d2527ad8f73fb12f3a4dfce62713aa0c2` | 223x175; 10926; `d3bc12d0ef4f4d9aa95df3e720873c91137cd982899ed938c8f90e2b7a1d3f9e` |
| `Icons/icon-button-prev-selected.png` | 173x141; 6949; `d771ce796f8d9b66e59ee5965c032a5c14c970481586429d0f6c77e5351d67bd` | 223x175; 9430; `30444e81973ce92f6bf4ce621c80f9470d9928e4b377e47e75cee60804dc9759` |
| `Icons/icon-button-next.png` | 173x141; 8348; `0c9f8e9867c875c40e9160c2e355a731e9ffcbd4547c0adb65ba17fa53021f2a` | 223x175; 10857; `92436a64cd4bc9ce38b05943ec75ea9a08ef66f28fc64410b355f5eadeaf17d5` |
| `Icons/icon-button-next-selected.png` | 173x141; 6997; `11fbceb6b1ff0396296be8c7f50098a77ed0b165013b4758c6e9e480ede7f9a9` | 223x175; 9332; `4feda23e246ab6014f74e5efe4b17e328f12ad6d70463fa32bf22a03550ad6a5` |
| `Icons/back-button.png` | 135x113; 4899; `8a619b938e82f5a8395a666372af694ecb785476445ec5e5a4d8e0e07ec28d36` | 166x134; 7594; `4718fe0a95c6cdedfa5c500c7f53be144a9f95bc916dc5f0cb390554b0b86ed9` |
| `Icons/back-button-selected.png` | 135x113; 3773; `44f0a89a3d6da0b148093805fac66b52e14fc6afa489e9bd1a57d1ff7111344f` | 166x134; 5381; `1f33afc8e23d892b296c348a6340258b47abe487203a5c8a2e704aa978118fe7` |
| `Buttons/button-buyitem-normal.png` | 133x36; 5861; `14a1f50e720107a9e02606192ea4b69bdd31b96fb21dc4d2f4785dc0d91a6656` | 200x54; 10632; `0db2f8e760e3373f19eafb51c4bc1d62929b45911fa91a193aa526c1ca95f08c` |
| `Buttons/button-buyitem-selected.png` | 133x36; 4000; `2cd57b7dfc0fa8487fab87bf41c466fe466d12c8ad99249dba366613a41c10c5` | 200x54; 6963; `e4f826b51446ecedade4a5c6758b3ea16708d1468e6cb8997c44b6459ac048b8` |
| `Interfaces/total-coins.png` | 334x131; 17406; `1deacc8db298095825586bb60857d6c6e70894f6f4783de81967bdce517ced30` | 464x160; 27907; `0254cb29e6b68f2ed13903803f2415e1808265e5798a39352ad015a1ec69cab1` |
| `Blades/Particles/X-Mas/xmasfive.png` | 46x44; 1029; `2116d7623e8fe6449665823f2e2ffc0c183de54595edb87f4c07850f941d48b2` | 66x64; 1408; `a22ab1d4c49336316860db10587696fe7d5f5190d7ee762839f8909e1b13a9b3` |

### Theme thumbnails: 10 logical rasters

| Logical path | 480x800: dimensions; bytes; SHA-256 | 720x1280: dimensions; bytes; SHA-256 |
|---|---|---|
| `Icons/theme-icon-0.png` | 117x116; 1513; `0d851d9d5e55532dc893307cecad7188899f34b5f1d51f12c11f11ecd77b8487` | 175x175; 2146; `4432c53c0de52813cb6a7f6bd9a67ec5242a38c5ba0be714af57eac803ea8a71` |
| `Icons/theme-icon-1.png` | 117x117; 7559; `d69af1828c4f151f51b99594e872457341e5f1746c35a47c72a3647121f7cbd7` | 175x175; 11502; `51a57a6ad88304aca8001df61d81fb0aedabf3517a8ac2642f1f4ca398becd25` |
| `Icons/theme-icon-2.png` | 117x117; 7718; `eb7089083c06849f162a52946cefa822d7c055cbd1c6f40ec43e753ae246c9a2` | 175x175; 11951; `ee6de4ec1000bbc67c8dede12f4999306215b8ec0bc0ce611413944cc38c2e56` |
| `Icons/theme-icon-3.png` | 117x117; 3490; `58d2c219ede9eebb99f67c614f018e61f4363582aa648c9cb8f8b13e0559f807` | 175x175; 6023; `e6787e611415448f2e401d7e60dd759c7ba2f11671fc7bf797c7410d8ef68eb7` |
| `Icons/theme-icon-4.png` | 117x117; 5654; `1b42fe8478f1f7ca0215989f4fb2ad5cd638c4cdb5044d52748e7f9765f1af01` | 175x175; 8641; `3867b4d9f55490718ac0021fc8d1ab027214974516e043e938fe00258017e8b6` |
| `Icons/theme-icon-5.png` | 116x117; 8426; `ffde65bd124a7e32bdf65d5194129e21369f398463885dfb3a28cf6893de8c9d` | 175x175; 13234; `9035fd81d18c6e01aa6036ca723e68e5c48c825cea940f553a82ec73cdd4a489` |
| `Icons/theme-icon-6.png` | 117x117; 8754; `64d419fd399a58824332395cd1203e421a9eb76fca8dbf1286ac1d38b1e2cfa4` | 175x175; 13985; `3a30ad1e849726680461894495adc4a7be664a4edce789f53d77b5fcf05191c9` |
| `Icons/theme-icon-7.png` | 117x116; 4625; `550e84312c2487440566eebdd9ef76e51694a2cf0f8d81e2b07d071e8adc9ab6` | 175x174; 7944; `49b6eced3f1c0bcf1169af76ba0f3649b7b8c7cdc99f26d3f127993c6ffd8e02` |
| `Icons/theme-icon-8.png` | 116x116; 4452; `31e20ec285e7109ba9bfcbe414c1ebab635c60f9b9f34343395215d446f41b38` | 175x174; 7488; `f4a5cd09f7ba705f91065be2bca8f54fda3b0d4133dc935a7d4fcd3bac173581` |
| `Icons/theme-icon-9.png` | 117x116; 8736; `a04696e9aba1904f2e396a4364bbcf8c4d28b6f732d63475a67c421ae5c4b61f` | 175x174; 13982; `063f1df5591fc58a8c27bf1f51f8dc2ffc7ef49790fa599e7999d54d8137c65d` |

### Background thumbnails: 8 live plus one physical extra

| Logical path | Consumer status | 480x800: dimensions; bytes; SHA-256 | 720x1280: dimensions; bytes; SHA-256 |
|---|---|---|---|
| `Icons/background-icon-0.png` | live index 0 | 117x117; 18815; `351c2d7a7c59b46f155b62ac99ecea9c7deb3d7be5a7463a5979aeca2c6bae7c` | 175x175; 27518; `d66a31c2a6cae946a83ceba572a75b8719e6ae893ab3bfbc6012ea26d56a425e` |
| `Icons/background-icon-1.png` | live index 1 | 117x117; 30177; `ec5c1579be8a25533f1e30e85d314803527e93900cf3870884b14c7c3c919e1b` | 175x175; 37406; `97d6c58997d88c80496987d945b346e4d44a9c19ed89abde072658f10dcaa276` |
| `Icons/background-icon-2.png` | live index 2 | 118x139; 22967; `99451708ea1883691c104f3a742b903b579af561ff8857dc9d0ee9ad18bd0346` | 176x175; 39480; `49b54fb82d6421d1ec148f603fc3edcc99f999d05810bae452c82b08cad63d5e` |
| `Icons/background-icon-3.png` | live index 3 | 118x117; 25895; `90229e403724288bc7b9b9d4954ed9935eea5321bd70bfe1a1d678170b4324fd` | 176x175; 49535; `b105d3bb2b2d8dee72c3ded5ce079efec513a73d385be0d9bd52d6d512aed8f6` |
| `Icons/background-icon-4.png` | live index 4 | 118x117; 14906; `a2b896b72d3354c658e0d1958a4f79bf3343c90c9bd735d8e0a82f9553caaeef` | 177x175; 22840; `684922b07bba990f623e7d4de10984f26ea566ccaf1a90f22d6694dc1b713b7e` |
| `Icons/background-icon-5.png` | live index 5 | 118x117; 15730; `1eec0285a722c30ac500ed83f5149bcf9a09f7038693e776896e5b4655a891c3` | 177x175; 20318; `426c6ae9bd05a5849c253832cd8620fff885631788e7a6b8594287a5b39f9974` |
| `Icons/background-icon-6.png` | live index 6 | 118x117; 16558; `e984f49675409ec3e369cf5bd27e8d1196fcc9b74716d8eebf037f64c341fa7a` | 177x175; 29404; `4bb17d7c170f4ee3072bc99e5ca61f6a6a70a7cfdfe41947c2a8299634ce2b95` |
| `Icons/background-icon-7.png` | live index 7 | 118x117; 27049; `8621b8037f0846d56fb0bcc24a249d70279c413369bffec03e6e5ea76b98c953` | 177x175; 56956; `540a089838addc732a2c5e60dda92768159e26d9faca78d2243af2c00685a77a` |
| `Icons/background-icon-8.png` | **extra; not iterated** | 118x117; 3740; `639ce206b871b13fa85df807f40d71e1741155f5ac51eb97fac0fa69b84daf6e` | 177x175; 5712; `7b2a37491a8915570820682be061fe26b4858d74794e56fb499235a733f6f21a` |

The anomalous 480p `background-icon-2.png` is genuinely 118x139; it is not a transcription
error or trimmed Creator frame. Metadata preserves its complete IHDR rectangle.

### Blade thumbnails: 18 live plus three physical extras

| Logical path | Consumer status | 480x800: dimensions; bytes; SHA-256 | 720x1280: dimensions; bytes; SHA-256 |
|---|---|---|---|
| `Icons/blade-icon-0.png` | live index 0 | 131x129; 2270; `ff09942c4ee6b35092303183e8957088d36264fa8cde76ee711f5958b508328e` | 197x194; 3338; `0e565cf0ac7ee96a1fcc6a6d1397ee5a666e3dd800baeb3f632f7c92b6adc1ae` |
| `Icons/blade-icon-1.png` | live index 1 | 131x129; 2305; `9bb0426a8fc206fb5ec7d16ddcae0961383b7387450d408f6f48475a383f0ede` | 197x194; 3387; `493f9738cea05a8caff69c09d7dd7dc8d91ec0a9bb813636c4b450981d597201` |
| `Icons/blade-icon-2.png` | live index 2 | 131x129; 2291; `57fbfdaf7ee22c372edb27b4643359b49b92f617f00572fda15c9ca7bea189fc` | 197x194; 3335; `2330c67033f2b5a2645c475f21413f554833c9abeb5261ca825f8d55b6496e8b` |
| `Icons/blade-icon-3.png` | live index 3 | 131x129; 2340; `6569a45a33f46ce8f1c1bc65f664bda1797836c1b72892b41a2256e752112445` | 197x193; 3386; `31e8562d9ef8bde73b7cae489794e6e501275e2621ea4a83bca8e9340c56a1cf` |
| `Icons/blade-icon-4.png` | live index 4 | 131x129; 2268; `a1a0823ceb5aa2da497e8e60a484450c4a6d226a73baf1d2dfc9148b30d0bf37` | 197x193; 3333; `0bcd26468c65848d2c0948018ee0b0fb925a6301e0c9e6d5578bb9bc4abed2e5` |
| `Icons/blade-icon-5.png` | live index 5 | 131x129; 2272; `83dd1377faf88853d9b04ccfd600f95950cfa59a66f5b93e1fe2949b6bb0b473` | 197x193; 3289; `c51771ea25681ed952e8057b0a069aee442e1081ff18bfac74c863e60d3e4a2e` |
| `Icons/blade-icon-6.png` | live index 6 | 131x129; 2571; `3f50facd29d0542302d1581437fa52e4e583b82ab8ded8b641d6b42ce287ac7f` | 197x193; 3689; `27970ecf8891ddcfe5df46b3a3df11008237477889aa016d76d76a0795e35d9b` |
| `Icons/blade-icon-7.png` | live index 7 | 131x129; 5401; `9018aebaf6252d0bc0e35b0b22d33e6803a727e3c48125e869e26c11a85cddd3` | 197x193; 9259; `409e52263df9ea2875472fb681e69cd60539fb02995f7cafd5062cd392bcaaa5` |
| `Icons/blade-icon-8.png` | live index 8 | 131x129; 6206; `af9076b34836281379a6523bfc86c29a05cd0b7f86eb211d62cdd3a2bcb38938` | 197x193; 10762; `6c3f3951638342ddec3ec8792a9da1c23af884b8f7309a100bd6cd323f95a562` |
| `Icons/blade-icon-9.png` | live index 9 | 131x129; 4500; `54862c9e92a7914a598297e8e9df6aaff39efc8233246f3068e696bf8ec97a82` | 197x193; 6684; `ac8b4bd7f555d435a48ff74167fd854c34345bcbf572967be44b86457d0756b2` |
| `Icons/blade-icon-10.png` | live index 10 | 131x129; 6547; `d7cda95e6022acf57d7b5d181243f851ff177e2d4442a57851f63d52a0cd9a4b` | 197x193; 10529; `822583aa1187fc146c6bf998962fdde9ed0e109ba16a9d018874583240074718` |
| `Icons/blade-icon-11.png` | live index 11 | 131x129; 4948; `b789c46fc6c37cbee90fe97071ecf02636a6f8d6599c44619b2c3be33f7bd187` | 197x193; 7680; `3124dd319ff46355a8d45cded0c9340cba69989d63c09a12440b9715ae8fc789` |
| `Icons/blade-icon-12.png` | live index 12 | 132x130; 7198; `d8cba64a98b2d1f56065baee077615e5f430e22c4a0f2b1a59d5bf85c1789b1d` | 196x194; 11378; `e38d50c23cb2d38c2417cf183000936408bd324d29fd38d6b08494fca9b89ebf` |
| `Icons/blade-icon-13.png` | live index 13 | 131x130; 3823; `d45459947003499279e2d79c72bd433469c310af9b9e5d37221327b57018eceb` | 197x193; 5981; `f95d5f0ab5b6f0a85bf72f1d4cc4315f5984542391db4679d194beb973459629` |
| `Icons/blade-icon-14.png` | live index 14 | 132x129; 4022; `6d982fa15bc29cc91ea040ff1e1b6a37a18ba9f6f64515116e424123284d7ede` | 197x194; 6004; `d6352d8822cc00a746dce6764ebfd7ea7a20ae7090d883d65299914be6b637ed` |
| `Icons/blade-icon-15.png` | live index 15 | 131x130; 3818; `8b7fb5ebf39cf839f9d7025b2b9c9788429f494944abfa8f21fd8417964f7eb0` | 197x193; 6066; `2d21d89b9595c1388d5b24d0007a142c39dfa599998d4d3c77bf3bfc3efa6cc6` |
| `Icons/blade-icon-16.png` | live index 16 | 132x129; 3980; `ca25cf13785fd45fc0654892bd44a265895750b74e69c90e03cef131f21382b8` | 197x193; 5837; `a193741baf75f0df16af6b9f10b59d44ef4e1a7178e978353e314e0c8783bf20` |
| `Icons/blade-icon-17.png` | live index 17 | 132x130; 5457; `cb88b5cd46b2ca1a5733c58bede143fcbe3416d6443259b53aa8a71fb3643aa0` | 196x194; 9215; `8889adeb3fead5fbeaa36ea1c0355faac5788f496f87e1f76aa777fe1896e716` |
| `Icons/blade-icon-19.png` | **extra; not iterated** | 132x130; 7019; `79d7127ced31917aabb4f026785e33fb6b8caef5c4c283fcf7cef574f6a2df68` | 196x194; 11289; `e5781407ec919a4d212031eeb3ae3df079f68b5c74098e5327b49e74b79436e8` |
| `Icons/blade-icon-20.png` | **extra; not iterated** | 132x130; 3930; `0a3e05de7bc36ebd3fd016084dc0357c9c5a62c0fd5c9d8a376a198b2696517d` | 196x194; 6089; `51ea6d6b1943f856fa104d2e4ba9f4412d79489c32d19fd6fd0ce0c9f925173e` |
| `Icons/blade-icon-21.png` | **extra; not iterated** | 132x130; 4203; `921f6e99811edc8350f9204eefc05328da9222672c29ee092c5a75eb0faf1fc5` | 196x193; 6479; `5558446ab9a7e799d240cdb52d4c8012750bb8b75fbff45d5d995fb1fae59ef0` |

The native loop is exactly `0..17`. The missing physical index `18` and present `19..21` files
must not be normalized into a 21-item selector without new evidence and an explicit product
decision.

## Direct Non-Raster Dependencies

| Logical path | Exact role | Bytes | SHA-256 | Static format |
|---|---|---:|---|---|
| `Fonts/SlabThing.ttf` | coin and purchase-price labels | 161488 | `9e07461cbe34a525fe36222710f6067712c6a956f732e2a0d963bdb3d7e151a8` | TrueType font |
| `Sounds/menubuttonclick.wav` | selection-change and Back callbacks | 32812 | `3a4906c2b50e84f7955246b43319a5ca9b4ba8cbbb130430bfa7a4bfeaf1ca3e` | PCM stereo, 44100 Hz, 16-bit, data 32768 bytes |
| `Sounds/mono1.wav` | blade-row reveal after `BackgroundsCallback` builds/seeds the row | 33162 | `1e54cc21d75c18c8031be601b1d76937ed3693e273ca3819da4aa7bd5e6887d2` | PCM mono, 22050 Hz, 16-bit, data 33118 bytes |
| `Sounds/mono2.wav` | theme-row reveal after `BladesCallback` builds/seeds the row | 33104 | `aac7a424635c6518349f6b65f4ece3cecc06be4181f322303bd6a38f5649d4e4` | PCM mono, 22050 Hz, 16-bit, data 33060 bytes |

`mono1` and `mono2` are direct `SimpleAudioEngine::playEffect(path, false)` calls, gated by the
effects setting. They are not stored in, or passed through, `SelectItems`. Specifically,
`BackgroundsCallback` plays `mono1` at `0x0015f190..0x0015f19a`, while `BladesCallback` plays
`mono2` at `0x0015ef64..0x0015ef7a`. No analogous reveal effect was recovered for the background
row.

`Fonts/CooperBlackStd.otf` (35728 bytes,
`de19d86db2757c6162bc90c13f060b6e8aa855ff318a74397add96d59f0e728c`) is recorded only to
separate the global metadata gate from this consumer. It is not loaded by Options.

## Selected States and Purchase Effect

- [RECOVERED] Previous, Next, Back, and Buy each use their `normal`/`selected` raster pair as
  touch frames. “Selected” in those filenames means pressed-control state.
- [RECOVERED] The cosmetic selected state is the selector's current icon itself, placed over
  `Icons/icon-image-background.png`; no badge, outline, checkmark, or separate selected-cosmetic
  texture string is present.
- [RECOVERED] An item price of zero suppresses Buy. Blade/background purchase success constructs
  a `ParticleExplosion` of 45 programmatic sprites and supplies
  `Blades/Particles/X-Mas/xmasfive.png` with a 0.05-second creation delay. Neither Buy callback
  calls an audio engine function.
- [CORPUS] Neither original/staged tree contains `.plist`, `.fsh`, `.vsh`, `.glsl`, `.shader`,
  or `.effect` files. The Options purchase burst therefore has no external particle descriptor
  or shader dependency.
- [RECOVERED] `BasicBlade` refers to the embedded Cocos cache key
  `ShaderPositionTextureColor`; that is downstream gameplay behavior, not an Options asset.
  The current Creator default blade uses `builtin-unlit`.

## Downstream Selected Theme and Background Resources

These full-screen rasters are selected by the saved values but are owned by the already
persistent shared-scene loader. They must be reused live by Options rather than loaded a second
time.

### Full-screen backgrounds: indices 0 through 8

| Logical path | 480x800: dimensions; bytes; SHA-256 | 720x1280: dimensions; bytes; SHA-256 |
|---|---|---|
| `Backgrounds/paperbackground0.png` | 480x800; 161538; `d634be5b392cc1b36c18403addfa7d2794b0f637596b637704d11b2c7acf6283` | 720x1280; 197452; `5ee663012fe0b67e35fd44dd9023ddad673cca7bbaa016baeaa0e80eed84f622` |
| `Backgrounds/paperbackground1.png` | 480x800; 780605; `516df505b71cd29f9abeaace661c98a3a71baa9f2b2391a30eac50c3f47403aa` | 721x1281; 958353; `156198a9c1ad6bd7934b91c6fe481cd8eafffcca658f0e619ecae9996714fa8c` |
| `Backgrounds/paperbackground2.png` | 480x800; 461631; `0199ca3eef3477a4dba41611ca020db637cf2d19858706c08c133caec2490744` | 720x1280; 824287; `ae14a1ac62a293ce1023be3defcb0f8bf5660af34c5d1690635a4e8ef5cce555` |
| `Backgrounds/paperbackground3.png` | 480x802; 576735; `c062fa0fcea9bebaa5e74d3ce035b253836ca06d4ee7df8b89ae9e236fd52cad` | 720x1280; 1177571; `78d7196cc10f9aa5ba2a78492b02cea65fdcab3ffe56acf38d9f9d713c348c44` |
| `Backgrounds/paperbackground4.png` | 481x801; 479539; `8c8a55083c1a43cbb6d5e9222a51548d4debd79c915f5a710a44261485f08f93` | 721x1281; 1040557; `9c42b14ba55895a527bc62b7d3d645f4151f4e9e581a8dca21842833c42c5535` |
| `Backgrounds/paperbackground5.png` | 480x800; 356514; `ad94de28151fd06f21c8fb35c820ed5f907eb0a031556927548309fd71af1eb4` | 720x1280; 444778; `ce1af64fc3d206e4a02ac75b808983b0cff65f6a972806e6cc1fbc7e34b4bc2d` |
| `Backgrounds/paperbackground6.png` | 480x800; 291277; `c89a368a04d5b4006a98abcbd8ff9116893ce134cc70bc78a945841c1d9b4428` | 721x1280; 634890; `739f61c110c0bd2a0fe64afa118525998a782f356abf4617bb481a1a65875aa2` |
| `Backgrounds/paperbackground7.png` | 480x801; 711080; `9cde53b4dcea87de5dae2a76f8c11448de2bad87cd7ac48668a06d40146a8bbe` | 720x1281; 1671368; `7d84c39ef517eb55d973c3ac69a73d5e6f02f3a9d28c5d561dd505ea371d535d` |
| `Backgrounds/paperbackground8.png` | 481x800; 511050; `2482355de6e2408b113bdede9a173e7602bdcde0efc2d4d9ae710e6506bd324b` | 721x1281; 1002071; `cdec39865f994e3a9b61b997b015f998d011919849d946a37cb78b6b43ddc6fa` |

### Full-screen themes: indices 0 through 9

| Logical path | 480x800: dimensions; bytes; SHA-256 | 720x1280: dimensions; bytes; SHA-256 |
|---|---|---|
| `Themes/theme0.png` | 480x800; 2655; `bcb7ea9a57bd2540ce3a47cc6c2d0f344dc3b784dc5c266217bfe9d6ad5a81fe` | 720x1280; 5693; `6ebe1c974279189ac08a752b1d605031dd6126bf832e5a38c616c7c7cbc6557a` |
| `Themes/theme1.png` | 482x802; 39019; `ba12da2ab46f6f1c141cc83cf6661a82d14c6a29a0d2d16b635d48cc4f5ed778` | 720x1280; 98661; `eecc8944cd7911562d8e4ece3ec2434e2c71ef5c947737d97a48ff0916cf6912` |
| `Themes/theme2.png` | 482x802; 29809; `69c50b8a2f93fcf1474c99706f320a539714eab1976f010e0074d8f6dc00aad8` | 720x1280; 99072; `6096db1dfcaba4d0c787ad6330806fa1464aaf67c4b0be6880c1ef9668f7a3f7` |
| `Themes/theme3.png` | 480x800; 41586; `3b990eab59980a5a1ba17363345784a0327dc1056919869abcfe01979d62f4d7` | 720x1280; 73310; `af47d9f631c5eb062e74387b14fa2ec59c5a069863713db9b92d1d43b5c5a44f` |
| `Themes/theme4.png` | 480x800; 42901; `3e57af3ca605531afb20bd207fe715f94b2cb7d53dedbc7bf65e00a86b7add88` | 720x1280; 82971; `a2fa5dfd5b795c251b868f92ab9705a43350b20705393034f51101471dfc6b2b` |
| `Themes/theme5.png` | 480x800; 58290; `c26bb488987290e2c3dd1e6882ffd4fdaf9cdf458ee2e893da2d0dd1775dc7a1` | 720x1280; 102866; `6dcce23f49c1876667f67c6a9008215f8a9953d6057bf25212ade1439e9f2aa9` |
| `Themes/theme6.png` | 480x800; 57876; `26fbf327fa5e448be5e8b05bd5e345a7329e2ed3dc1026e951ab2e096951eae0` | 720x1280; 101175; `3e5dfa9b74b099c91a557b5ac1ef4cba72e2badeb8fb07f24ba78e0cfec872db` |
| `Themes/theme7.png` | 480x800; 41359; `457c0299e86eddd3a757807bc2891bab92e372536ae1b23f9cda21cc92baa88e` | 720x1280; 81689; `b63b32714088c963f55aba7298133c58e1bb3b3ff4758fff1fe2d3712ac95be9` |
| `Themes/theme8.png` | 480x800; 41389; `b5e40e016748894cf272dec8f15cc35c0164dfae1bf1296cc6325c5d7f0438e5` | 720x1280; 81645; `0c670aff9aee6bb8edded64d0049af2bc178967f9c4c29c5f8febc7d3d85d596` |
| `Themes/theme9.png` | 480x800; 57025; `f504a59f7c25cd5bb8783cfc069da26e0ab502dccfb895d7bd60614f5e06938e` | 720x1280; 103925; `0daeaaf2ffb40b80a6854faae545c52ee6af9883769de048ba1aff2b38505264` |

### Persistent leaf/“level” clarification

No file or directory named `Level` occurs in the original resource trees. The current shared
scene does load a seven-raster `Leaf` family for persistent ambience. If “level resources” means
these shared leaves, their two tree copies are byte-identical:

| Logical path | Dimensions in both trees | Bytes in both trees | SHA-256 in both trees |
|---|---:|---:|---|
| `Leaf/leave1.png` | 84x79 | 3515 | `64a7a8d44208ed22bf14c903b0e1faf8264aec9dfdc1eb8dfc0fa22b001a1bfa` |
| `Leaf/leave2.png` | 69x64 | 4415 | `994bcebea40a2e375a6d4ba9119c7ab256323041777ce5900b39dd24588edf9e` |
| `Leaf/leave3.png` | 51x91 | 7136 | `cfc6f0b49b0461a3cb49fb10e822f909701cc5f282e18d7670f82176ac0c066d` |
| `Leaf/leave4.png` | 74x71 | 3815 | `c091aace9ebe3038d51a975584e3845fd65a17d7574e6087b90eadfe8bee2846` |
| `Leaf/leave5.png` | 79x69 | 3992 | `afce7fbd41f9be4c06d84244714ce76d474994829aa78d84612156b42184dd34` |
| `Leaf/leave6.png` | 66x70 | 5069 | `d51294f17f57343b045d0ee0692c88970c5a26d2b631ccde5101c07c093de1ff` |
| `Leaf/leave7.png` | 75x71 | 5506 | `81e0350dbab6ce33a172bdb30549e57f8dec687c432168e97d66ca404f0c1359` |

Leaves do not change with a cosmetic selection and are not Options dependencies.

## Downstream Selected Blade Resources

`PhysicsBladeLayer::onEnter` at `0x001612c0` maps the saved blade ID as follows:

| Blade ID | Runtime renderer and exact logical path family |
|---:|---|
| 0..12 | `BasicBlade`; `Blades/blade<ID>.png` |
| 13..16 | `DragonBlade`; variant `<ID - 13>` of `Blades/Dragon/dragon-{head,body,tail}-<variant>.png` |
| 17 | `CentipedeBlade`; `Blades/Centipede/{head,body,tail}.png` |

The optional touch-particle families are ID-specific:

| Blade ID | Particle paths |
|---:|---|
| 0..6 | none recovered |
| 7 | `Blades/Particles/VN Flag/vnflagstar.png` |
| 8 | `Blades/Particles/Ice/{snowflake,star,circle}.png` |
| 9 | `Blades/Particles/X-Mas/{xmasfive,xmasfour,xmashexa,xmascircle}.png` |
| 10 | `Blades/Particles/Butterfly/butterfly0.png` through `butterfly5.png` |
| 11 | `Blades/Particles/Fire/{firecircle,fireparticle,smoke}.png` |
| 12 | `Blades/Particles/Rainbow/rainbowstar0.png` through `rainbowstar4.png` |
| 13..17 | none recovered |

The exact physical blade-render corpus follows. `xmasfive.png` appears here too because blade 9
uses it at runtime; it is also the one direct Options purchase particle identified above.

| Logical path | 480x800: dimensions; bytes; SHA-256 | 720x1280: dimensions; bytes; SHA-256 |
|---|---|---|
| `Blades/blade0.png` | 256x256; 634; `32713af6c40cf4e9a0b48e87fed53c37cb32818b14143020db22787c336559d8` | 256x256; 634; `32713af6c40cf4e9a0b48e87fed53c37cb32818b14143020db22787c336559d8` |
| `Blades/blade1.png` | 256x256; 637; `d6e72a1564ed61ca762cd95edd803d53d6b14ffda4ed8727456b693c26be87d3` | 256x256; 637; `d6e72a1564ed61ca762cd95edd803d53d6b14ffda4ed8727456b693c26be87d3` |
| `Blades/blade2.png` | 256x256; 636; `c85d7c65255b9fb83eb6acf471319c57135383afdb2ed7d661d59f0fb33a888a` | 256x256; 636; `c85d7c65255b9fb83eb6acf471319c57135383afdb2ed7d661d59f0fb33a888a` |
| `Blades/blade3.png` | 256x256; 638; `93a7f31cb7a3831ed3e65b3c5a4ac50450510fb7c87aa3fca2f60ed807b40399` | 256x256; 638; `93a7f31cb7a3831ed3e65b3c5a4ac50450510fb7c87aa3fca2f60ed807b40399` |
| `Blades/blade4.png` | 256x256; 636; `2f76c5c4efc7e8b2da94d7f20460815d128b4d0ce94a6243f3b1c6e1652f7153` | 256x256; 636; `2f76c5c4efc7e8b2da94d7f20460815d128b4d0ce94a6243f3b1c6e1652f7153` |
| `Blades/blade5.png` | 256x256; 639; `dd7ac3744b17319f01db678226b0b2202001c2c5c8501473e836478ec8aca1db` | 256x256; 639; `dd7ac3744b17319f01db678226b0b2202001c2c5c8501473e836478ec8aca1db` |
| `Blades/blade6.png` | 256x256; 3270; `cbefdeffca4a7679082f5a19397d89cae934248d5e3e85490ab3eb0a61e1a8fa` | 256x256; 3270; `cbefdeffca4a7679082f5a19397d89cae934248d5e3e85490ab3eb0a61e1a8fa` |
| `Blades/blade7.png` | 256x256; 3270; `cbefdeffca4a7679082f5a19397d89cae934248d5e3e85490ab3eb0a61e1a8fa` | 256x256; 3270; `cbefdeffca4a7679082f5a19397d89cae934248d5e3e85490ab3eb0a61e1a8fa` |
| `Blades/blade8.png` | 256x256; 636; `c85d7c65255b9fb83eb6acf471319c57135383afdb2ed7d661d59f0fb33a888a` | 256x256; 636; `c85d7c65255b9fb83eb6acf471319c57135383afdb2ed7d661d59f0fb33a888a` |
| `Blades/blade9.png` | 256x256; 2795; `cba19ffa23bdfc74732423e707b61ac620e991a7d105051592dc011d73f44964` | 256x256; 2795; `cba19ffa23bdfc74732423e707b61ac620e991a7d105051592dc011d73f44964` |
| `Blades/blade10.png` | 256x256; 639; `a8fe6f0201571610de9e47bb1fa9f27a1a892cf617f5d4b684a202277d5d0eff` | 256x256; 639; `a8fe6f0201571610de9e47bb1fa9f27a1a892cf617f5d4b684a202277d5d0eff` |
| `Blades/blade11.png` | **missing** | 256x256; 7307; `0661deecf72097a81f8d463bb5a568d08592136d78d9a99bf3e5696d99a380c2` |
| `Blades/blade12.png` | **missing** | 256x256; 1801; `6d91f914f595d766a94afeb8acf8dee00a53365de03b48d76e405b4a65e26d31` |
| `Blades/Centipede/body.png` | 12x40; 733; `2df93d381c9f4771e90a008f42d054335f7150d5c0f374d88ed0d1735cae95f3` | 18x61; 1064; `c4f6a63e768c6d3565e8c8fac2bf06635b17c09aaa67706626e37f9a948b08f0` |
| `Blades/Centipede/head.png` | 47x44; 1333; `d61d20ba63d008445395b08778eafb6136800c2e5b9f436dadf9b4771d4054dd` | 70x66; 1920; `06e0d10b3748fa2efa7fb32f5eb06878cce2ed1332e44af554ad145ebc23c37c` |
| `Blades/Centipede/tail.png` | 51x14; 991; `eff3e7d9c6235b79364f8e774ec0d3e1115cb87bd113c86e46346f5c8313b8f8` | 76x22; 1399; `92821882f25465df442a9c652aaf14098d27a74f092f4acef69d567aebf49726` |
| `Blades/Dragon/dragon-body-0.png` | 21x17; 385; `0d796b11252ad75edea7e2771c2892161ce875e14e5b45f87994c6b4656a8a31` | 33x27; 815; `8d38ea8e3ceca94d5bcd73606547483f56bff34e2a3283aac24b08cc4638f50c` |
| `Blades/Dragon/dragon-body-1.png` | 21x17; 347; `faabd4a6f1095692af9cbb122ca064f929697551dedfc88f1cbd89d84b409b3d` | 33x27; 722; `73a2cbcdcfc86904f51f8380b18cb14845fd9d5c4e8bee384ebe5ecd47429b1f` |
| `Blades/Dragon/dragon-body-2.png` | 21x17; 724; `82bf5e837a4d6d52742eb91a66bddf6c969c66123435b929d4626303cd65ea70` | 33x27; 811; `b0cc02c40eee63031e60726157652ee19b4fae9ea1c318a5dea985d608eaef6d` |
| `Blades/Dragon/dragon-body-3.png` | 21x17; 380; `63360fab1fd9c98d4a3771fac8cd696ac4afee817cdb14cbf8156311c5f6eeef` | 33x28; 838; `b2eb41aacf3c2703a5b93dc853bade558a5838426584a82729516342c0be016e` |
| `Blades/Dragon/dragon-head-0.png` | 92x63; 2308; `9f07492c0d78ab534f3ee2e67db8e023ef87b5617b4bcd206c6b959f1aae30bb` | 140x95; 7155; `11e5d28924b6630a568fcec49b5926e1ff216fbcb774b6d3670c482a998a4d82` |
| `Blades/Dragon/dragon-head-1.png` | 92x63; 1862; `8deb80d733c909e42aff1e8ad67f14cc07ac7c0fae3055e94bc744f6ab7cfd6b` | 139x95; 6822; `5cc3b171a1ba8a4ec4995478996ff4b257c57b944b15b83f1c938d8b16b730a3` |
| `Blades/Dragon/dragon-head-2.png` | 92x63; 6352; `2b95b3adf4bbccae5a87c61d06b4f80c05f71c09f6a851ee7e8a962f3d585f8a` | 139x95; 7009; `a1fe8056bc4f31a36dc2efb7f5a6cf82750887821e07d4fb9f40c45a37459597` |
| `Blades/Dragon/dragon-head-3.png` | 92x63; 2331; `c52d240e4e7b434e136f9061786c9690a23e362e29bff7ff5fe2e92c72341f7c` | 139x95; 7189; `9048d9c7155f250416c62813e9a885a7fa651cf75c7325eb05e06867eb11dd05` |
| `Blades/Dragon/dragon-tail-0.png` | 53x22; 747; `1ef56898ed0fcf4de6def2fd846642a74348031deb838caf390532436fef3222` | 80x34; 1990; `c5b53befb1c3e0266e52b003fa9bfd9f9914d8dbd42cae20f86a4e34d71a3ca6` |
| `Blades/Dragon/dragon-tail-1.png` | 53x22; 656; `0e9fc89676851114a6ee8c7481500148881720e1a78eed4fe168d6ef701df4fb` | 80x34; 1830; `de9ee09bc83cf417facd2b352dda9ded00d8a2a44d4ef221a038dbf1a4a9b3a7` |
| `Blades/Dragon/dragon-tail-2.png` | 53x22; 1804; `60f5eaf4f946943feb3ac8391e4577bad02b937f5857ab8d4606dd3c24a41390` | 80x34; 1939; `933ee8c8b985db13a5a57a5f13346435cef188a438b89d85baa977b6f5d3dd86` |
| `Blades/Dragon/dragon-tail-3.png` | 53x22; 751; `89c9e4de24793e39d8cb2f86a65c10f770916843d7757b0349248f88af4d15a7` | 80x33; 2059; `c462d6687d011b8af3ace55613ed74bb4c29f180119279a88163f5885f734cf2` |
| `Blades/firebladetexture.png` | 256x256; 7307; `0661deecf72097a81f8d463bb5a568d08592136d78d9a99bf3e5696d99a380c2` | **missing** |
| `Blades/Particles/Butterfly/butterfly0.png` | 64x49; 2128; `435f2a84e304205345e5372c0883d0172c7c3b44d8984b9d53ca1c9b3521ecf4` | 86x66; 2835; `49ade407d5b24330c8978944873c4690b75c1d1504a55d7ecf59050ea2fdcb6b` |
| `Blades/Particles/Butterfly/butterfly1.png` | 64x49; 1630; `ea6c9a008c4ccbc3c23776a963a64f99af1beb6fd06baabafd3253295fafda88` | 87x66; 2187; `a3bc864d61215f8e20678985f8352f1bd94d31cfe99ee5275785198f26ed1240` |
| `Blades/Particles/Butterfly/butterfly2.png` | 61x46; 1636; `4eccc0fa100ad15fc513860de8232353c6e8e91469bc32206533cc13f35b4f5d` | 84x64; 2314; `4bad017623c073e335d8b9b4e8e78fcfe548cf5f44c2fd47e4fb3b531c70a9ea` |
| `Blades/Particles/Butterfly/butterfly3.png` | 64x48; 2417; `d6552df2685ef7660611df7702e26636190c82131988008fad5b088a5f53bc4b` | 86x63; 3491; `d98a3fb0c24b2068857d6f1e9c9460ab5483b29cd441b42be5c09c1935464192` |
| `Blades/Particles/Butterfly/butterfly4.png` | 66x50; 1888; `6fed0dd34d01dedb2a6b7dbb0b138cdee7b11a1a5345c1100dbf5f7c0722562e` | 90x68; 2629; `c705465514e8fa0473dc9d1864fa3c893e05f50cb97f7f1747c6ee45e8128014` |
| `Blades/Particles/Butterfly/butterfly5.png` | 66x49; 1885; `daffeb9d7bfd9533b847bfd2f370a3b4710d59a8e20fa27502b5a4ddc2ffdc09` | 90x67; 2543; `1cf7ea8b8db463787dda3bf8742bb804f8511bd1faa2c8588cf68096ed8c6758` |
| `Blades/Particles/Fire/firecircle.png` | 9x9; 208; `44eaee628d8d722a655026e3bdea3e86d325c734e44ab847850608533cffa485` | 15x15; 309; `b0383e5e52dd0d6e778f1a56f032c2eab5d71fa3b4c368a73c28905aa61b592a` |
| `Blades/Particles/Fire/fireparticle.png` | 36x48; 781; `acd20a0e3eae7632c0550a2f3bc01e7c27ef26af4d24db6c0be4b6295c6e777a` | 53x68; 1032; `7704ef0ed0aa90848259bb0fb947a28c7ecfd96a2c6b944af4574c799f2b37bb` |
| `Blades/Particles/Fire/smoke.png` | 111x108; 5629; `6a45b35f8423279c28723454edab62ce0a0f58f6fbc181b0a77ba3d1b668180b` | 109x110; 2376; `15bdadef00ccc4ad82be0f108292e4721c968dbfde261c10979c943bba607281` |
| `Blades/Particles/Ice/circle.png` | 36x36; 1554; `7ffe927fca3ff1cdce4459bf2d8a0e843646522504a8d8d47ffc52cffda27755` | 55x55; 2876; `a3c9b336af9b48072ad4979615d5a035f6f423db1f596c6d136b2d49e5871ae3` |
| `Blades/Particles/Ice/snowflake.png` | 51x54; 4302; `ba52efb71bce3d6a44e5737a45f25a88607b55f6753bda6320d46fcff7ffa499` | 76x82; 7345; `059a8a233df7984905e974c3ccf27a836d46e5100a0235a8ebcf25563f80fdcf` |
| `Blades/Particles/Ice/star.png` | 50x51; 2031; `f2606affa652b9e6515b0d7b0eb4efa4ea4176842d43e119efa696e7158e8fd3` | 74x76; 3295; `696c5a7b932256f480b6daef136d3e276efa78f8d254186096a55ccfe804ee7e` |
| `Blades/Particles/Rainbow/rainbowstar0.png` | 32x32; 3656; `93de7b9ba17deb22ce7b5fe2127ce2d5a4ece6238fc5be45e40256da1f7dae6e` | 134x132; 6244; `530b50c758f2a485af76ea6ec1c8fe6970e8a2e1cab078e0e8c91d250b5384a7` |
| `Blades/Particles/Rainbow/rainbowstar1.png` | 32x32; 3651; `c79901b68f56d3cef4fe0e00bb4b8fb6235915479ca564df7242f7ccba593b52` | 134x132; 6282; `88bede2fd6e180f8d35bcb9aa7dc4d1f03df47399c6035cb226708766cf1b766` |
| `Blades/Particles/Rainbow/rainbowstar2.png` | 32x32; 3658; `03c29dfc2b3ec0cb6fd428c93e46ea83371fdab358aef49ed8da2757a9678796` | 134x131; 6301; `48af04dc244a7ef49a5f894cd6cae74c7affdefec68dc95c37aa9dfc87aac6be` |
| `Blades/Particles/Rainbow/rainbowstar3.png` | 32x32; 3679; `1e314f574716d0e47dc27ea81cc35ada6e7ddde8481423860387a410c8764093` | 134x131; 6114; `3a0b96df9ff2aa5022536c42f995f1956dad029a6c3e3a8423393d37a2276b17` |
| `Blades/Particles/Rainbow/rainbowstar4.png` | 32x32; 3603; `29bbf06d441c57bb81a6637469a4a7e981ef4f2f6f757ce6bfb1e99e812652fc` | 135x131; 6914; `4b5368146ab10bde654564ed9cabc01159107fe701c8d302e0bcf700d75e325c` |
| `Blades/Particles/VN Flag/vnflagstar.png` | 54x52; 2992; `c6f7e09500a94361ba7bf91d4839690c7dd2b29d1e49190609fa2af5301c7174` | 78x74; 4595; `9c2faaba7057d5fc012add2a7f2f17a341858165daa28d56b70b0a0a9c23ded0` |
| `Blades/Particles/X-Mas/xmascircle.png` | 34x34; 869; `97f32efcd79fd577a2a23bede4724f8df0e6ccf4a331fdb481b9bad8622525c8` | 49x50; 1196; `a5f33bf414f4e4c31fe2bea1ea66fbc6f52a8f495ac1436fb0e6a237b515719e` |
| `Blades/Particles/X-Mas/xmasfive.png` | 46x44; 1029; `2116d7623e8fe6449665823f2e2ffc0c183de54595edb87f4c07850f941d48b2` | 66x64; 1408; `a22ab1d4c49336316860db10587696fe7d5f5190d7ee762839f8909e1b13a9b3` |
| `Blades/Particles/X-Mas/xmasfour.png` | 51x59; 914; `5a4c2555892d71a528e0c5ba335795ae5540b92e7d513a693e92b8b28b7b6385` | 70x83; 1216; `7f38b7d318bce450472ecc579a4a9a1a840c7b09d610830339bdcc51ed824a39` |
| `Blades/Particles/X-Mas/xmashexa.png` | 32x36; 800; `36f8ce97327c768fe14e1169672bf5a53147fdb314b086d9559a38631710bef9` | 47x53; 957; `cc4217637576b6c7bb0c92d400905058e952c8bcded9fa90ea4423637d5a89ab` |
| `Blades/rainbow.png` | 256x256; 1801; `6d91f914f595d766a94afeb8acf8dee00a53365de03b48d76e405b4a65e26d31` | **missing** |

The compact tree has a naming defect for IDs 11 and 12. Its
`Blades/firebladetexture.png` is byte-identical to the large tree's `Blades/blade11.png`, and
its `Blades/rainbow.png` is byte-identical to the large tree's `Blades/blade12.png`. The recovered
native path constructor still requests `Blades/blade%d.png`; static evidence does not authorize a
silent alias substitution. A faithful selected-blade loader must either preserve the failure,
record an explicit compatibility alias as a restoration decision, or obtain stronger evidence
for platform-specific renaming.

### Shared downstream blade audio

`PhysicsBladeLayer::PlaySwoshSound` at `0x001605a0` chooses one of nine effects for blade motion.
This bank is common to all blade IDs and is not loaded by Options:

| Logical path | Bytes | SHA-256 | Static format |
|---|---:|---|---|
| `Sounds/swoosh1.wav` | 8130 | `d67be303b242ad8b7ce65ee32803307ea5de2639ef66482cb35f68dfc9959645` | PCM mono, 22050 Hz, 16-bit, data 8086 bytes |
| `Sounds/swoosh2.wav` | 11760 | `512cf09e1662a949dcde847a13a70d1ae963ff1e8a424e16d6f8c06d9cf5a806` | PCM mono, 22050 Hz, 16-bit, data 11716 bytes |
| `Sounds/swoosh3.wav` | 7934 | `169e9140ef37f4387b9075e463957a4d6ed67c5693dd35f1f537e3a7dbe74d65` | PCM mono, 22050 Hz, 16-bit, data 7890 bytes |
| `Sounds/swoosh4.wav` | 13044 | `96b78ac722d24ac5f6cd111a38273cc4c61d72f36f61781c205bebfb3effa8b8` | PCM mono, 22050 Hz, 16-bit, data 13000 bytes |
| `Sounds/swoosh5.wav` | 8790 | `8a54a959f01ca5bc0a74d9fc2c890be8720a0aa5f4b7caf6b973720fdf51fe63` | PCM mono, 22050 Hz, 16-bit, data 8746 bytes |
| `Sounds/swoosh6.wav` | 9120 | `a2dae1bc753734a08e5ccaa54ebbe27d8bfa50cc28bf52fe903c686e41ea0005` | PCM mono, 22050 Hz, 16-bit, data 9076 bytes |
| `Sounds/swoosh7.wav` | 9318 | `4e59b6c040248fc4b1ec80e8e67cf9a2cfa9725cc59fa9f382d3491b50671c14` | PCM mono, 22050 Hz, 16-bit, data 9274 bytes |
| `Sounds/swoosh8.wav` | 6678 | `4b25e4148721eeb4ccf340086f7ac91693366930928aab757ea3ec8e97bdff83` | PCM mono, 22050 Hz, 16-bit, data 6634 bytes |
| `Sounds/swoosh9.wav` | 8064 | `3652ee7698bf4d138dc0eceeb07a0de4e9530304f71047301850b5fd20f03be9` | PCM mono, 22050 Hz, 16-bit, data 8020 bytes |

## Exact-Duplicate Findings

Staged copies are intentionally excluded from duplicate analysis because every staged file is an
exact mirror of its original. There are no exact duplicate hashes among the 102 direct Options
rasters themselves, and no duplicate collision among the 10 full themes or 9 full backgrounds.

The selected-blade/leaf downstream scope does contain the following meaningful groups:

| SHA-256 | Original paths sharing the hash |
|---|---|
| `32713af6c40cf4e9a0b48e87fed53c37cb32818b14143020db22787c336559d8` | both trees: `Blades/blade0.png` |
| `d6e72a1564ed61ca762cd95edd803d53d6b14ffda4ed8727456b693c26be87d3` | both trees: `Blades/blade1.png` |
| `c85d7c65255b9fb83eb6acf471319c57135383afdb2ed7d661d59f0fb33a888a` | both trees: `Blades/blade2.png` and `Blades/blade8.png` |
| `93a7f31cb7a3831ed3e65b3c5a4ac50450510fb7c87aa3fca2f60ed807b40399` | both trees: `Blades/blade3.png` |
| `2f76c5c4efc7e8b2da94d7f20460815d128b4d0ce94a6243f3b1c6e1652f7153` | both trees: `Blades/blade4.png` |
| `dd7ac3744b17319f01db678226b0b2202001c2c5c8501473e836478ec8aca1db` | both trees: `Blades/blade5.png` |
| `cbefdeffca4a7679082f5a19397d89cae934248d5e3e85490ab3eb0a61e1a8fa` | both trees: `Blades/blade6.png` and `Blades/blade7.png` |
| `cba19ffa23bdfc74732423e707b61ac620e991a7d105051592dc011d73f44964` | both trees: `Blades/blade9.png` |
| `a8fe6f0201571610de9e47bb1fa9f27a1a892cf617f5d4b684a202277d5d0eff` | both trees: `Blades/blade10.png` |
| `0661deecf72097a81f8d463bb5a568d08592136d78d9a99bf3e5696d99a380c2` | compact `Blades/firebladetexture.png`; large `Blades/blade11.png` |
| `6d91f914f595d766a94afeb8acf8dee00a53365de03b48d76e405b4a65e26d31` | compact `Blades/rainbow.png`; large `Blades/blade12.png` |

Each `Leaf/leave1.png` through `leave7.png` also forms one exact two-file cross-tree group, as
shown in its table.

## Current Creator Contract and Ownership Boundary

At audit close, the concurrently added
`game/assets/scripts/domain/options-resource-contract.ts` and
`game/assets/scripts/creator/options-resource-loader.ts` match the resource boundary:

- [CURRENT] the profile contains exactly 51 resolution-qualified raster contracts and rejects
  noncanonical trees;
- [CURRENT] the shared contract identifies `SlabThing.ttf`, `menubuttonclick.wav`, `mono1.wav`,
  and `mono2.wav` with exact bytes/hashes;
- [CURRENT] the loader loads exactly the 51 rasters plus SlabThing and rejects duplicate,
  incomplete, wrong-tree, or dimension-drifted results;
- [CURRENT] audio remains canonical-path callback data rather than part of the raster/font preload;
- [CURRENT] `options-presentation.ts` correctly models no background-row reveal sound, `mono1` on
  the transition that reveals the blade row, `mono2` on the transition that reveals the theme
  row, and `menubuttonclick` for selection/Back.

The downstream boundary is also explicit:

- `shared-game-resource-loader.ts` eagerly loads 9 backgrounds, 10 themes, and 7 leaves once;
- `SharedGameScenePresenter` exposes synchronous background/theme selection against those loaded
  handles;
- the shell seeds those presenters from `ClassicSettingsRuntime` at boot.

Remaining integration facts at this static snapshot:

- the recovered app-shell state/route does not yet own an Options presenter or call
  `loadOptionsResources`;
- the shell reads saved background/theme at boot but does not yet wire Options callbacks to the
  persistent shared presenters for immediate live replacement;
- Settings accepts background index `8`, while the recovered selector/price family contains
  only indices `0..7`;
- Settings accepts blade indices `0..17`, but the current gameplay default-blade contract and
  `ClassicBladePresenter` still intentionally accept only selected blade ID `0`.

These are integration/runtime-presentation gaps, not missing direct Options source assets.

## Corpus, Staging, and Metadata Audit

`resource-usage-map.json` accounts for all 862 recovered APK files:

| Kind | Count |
|---|---:|
| PNG | 784 |
| WAV | 59 |
| MP3 | 3 |
| font | 16 |
| total | 862 |

It reports 389 exact tree pairings, 3 unmatched files in each tree, and one near-match path pair.
The staging manifest accounts for the same 862 files and 32,945,747 bytes. Direct byte/hash
comparison found no staged mismatch. Its older consumer/metadata summary fields are not used as
current truth; the live validator and sidecars are authoritative.

Metadata relevant to this scope:

- all scoped PNGs use the image importer and expose both texture and sprite-frame records;
- every one uses clamp wrapping, linear filtering, no mipmaps, `trimType: "none"`, and full-IHDR
  sprite-frame geometry;
- `menubuttonclick.wav`, `mono1.wav`, `mono2.wav`, and the swoosh bank use the audio-clip importer;
- `SlabThing.ttf` uses the TTF-font importer;
- the unsupported OTF wildcard importer applies only to the unrelated Cooper Black file.

The full live audit is structurally clean:

| Audit field | Result |
|---|---:|
| assets / bytes | 862 / 32945747 |
| sidecars / directories | 935 / 73 |
| metadata records / UUID duplicates | 2503 / 0 |
| sprite frames | 784 |
| `trimType: none` / trimmed geometry | 784 / 0 |
| target-compliant sprite frames | 784 |
| structural errors | 0 |
| known fidelity blockers | 1 (`CooperBlackStd.otf`) |

Rights/provenance remain unresolved for all 862 assets in the staging manifest. Passing mechanical
validation does not clear that release gate.

## Validation

Static verification run:

```text
node --test \
  tests/reconstruction/vertical-slice/options-resource-contract.test.ts \
  tests/validate-creator-resource-meta-test.mjs
```

Result: 13 tests passed, 0 failed. This rechecked both trees' exact 51-resource contract,
dimensions, bytes, SHA-256, staged presence, Slab/audio declarations, metadata structure, UUID
uniqueness, root bundle configuration, and the known OTF fidelity block.

## Concerns and Blockers

1. Rights/provenance is unresolved for every recovered asset.
2. `CooperBlackStd.otf` keeps the global metadata audit fidelity-blocked, although it is outside
   the Options dependency set.
3. Background saved/live range (`0..8`) exceeds the recovered selector and price range (`0..7`).
4. Compact selected blade IDs 11 and 12 have byte-matching alias files but lack the exact native
   `blade11.png`/`blade12.png` path names.
5. Gameplay presentation for selected blade IDs 1..17 and live Options-to-shared-scene
   synchronization remain implementation gaps.

Status: DONE_WITH_CONCERNS

Summary: Exhaustively inventoried direct Options and downstream selected cosmetic resources with
exact paths, dimensions, bytes, hashes, duplicates, non-raster dependencies, consumers, staging,
metadata, and current loader ownership; corrected the direct row/selection audio mapping.

Concerns/Blockers: unresolved rights; unrelated OTF fidelity gate; background range mismatch;
compact blade 11/12 path mismatch; live route/cosmetic integration incomplete.
