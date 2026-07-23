import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

interface SerializedReference {
  readonly __id__: number;
}

interface SerializedObject {
  readonly __type__?: string;
  readonly _components?: readonly SerializedReference[];
  readonly _contentSize?: Readonly<{ height: number; width: number }>;
  readonly _name?: string;
  readonly [key: string]: unknown;
}

test('Editor-authored Classic scene resolves all Canvas script components through their metas', () => {
  const scene = readJson<SerializedObject[]>('game/assets/scenes/classic.scene');
  const bladeMeta = readJson<{ imported: boolean; uuid: string }>(
    'game/assets/scripts/creator/blade-input-controller.ts.meta',
  );
  const sceneControllerMeta = readJson<{ imported: boolean; uuid: string }>(
    'game/assets/scripts/creator/classic-scene-controller.ts.meta',
  );
  const gameplayControllerMeta = readJson<{ imported: boolean; uuid: string }>(
    'game/assets/scripts/creator/classic-gameplay-controller.ts.meta',
  );
  const crazySceneControllerMeta = readJson<{ imported: boolean; uuid: string }>(
    'game/assets/scripts/creator/crazy-scene-controller.ts.meta',
  );
  const crazyGameplayControllerMeta = readJson<{ imported: boolean; uuid: string }>(
    'game/assets/scripts/creator/crazy-gameplay-controller.ts.meta',
  );
  const birdInputControllerMeta = readJson<{ imported: boolean; uuid: string }>(
    'game/assets/scripts/creator/bird-input-controller.ts.meta',
  );
  const classicBirdSceneControllerMeta = readJson<{ imported: boolean; uuid: string }>(
    'game/assets/scripts/creator/classic-bird-scene-controller.ts.meta',
  );
  const classicBirdGameplayControllerMeta = readJson<{
    imported: boolean;
    uuid: string;
  }>(
    'game/assets/scripts/creator/classic-bird-gameplay-controller.ts.meta',
  );
  const appShellControllerMeta = readJson<{ imported: boolean; uuid: string }>(
    'game/assets/scripts/creator/recovered-app-shell-controller.ts.meta',
  );
  const canvas = scene.find((entry) => entry.__type__ === 'cc.Node' && entry._name === 'Canvas');
  assert.ok(canvas?._components);

  const componentTypes = canvas._components.map((reference) => scene[reference.__id__]?.__type__);
  const scriptTypes = componentTypes.filter(
    (type): type is string => typeof type === 'string' && type.length === 23,
  );

  assert.equal(bladeMeta.imported, true);
  assert.equal(sceneControllerMeta.imported, true);
  assert.equal(gameplayControllerMeta.imported, true);
  assert.equal(crazySceneControllerMeta.imported, true);
  assert.equal(crazyGameplayControllerMeta.imported, true);
  assert.equal(birdInputControllerMeta.imported, true);
  assert.equal(classicBirdSceneControllerMeta.imported, true);
  assert.equal(classicBirdGameplayControllerMeta.imported, true);
  assert.equal(appShellControllerMeta.imported, true);
  assert.deepEqual(scriptTypes.map(decodeCreatorUuid), [
    bladeMeta.uuid,
    sceneControllerMeta.uuid,
    gameplayControllerMeta.uuid,
    crazySceneControllerMeta.uuid,
    crazyGameplayControllerMeta.uuid,
    birdInputControllerMeta.uuid,
    classicBirdSceneControllerMeta.uuid,
    classicBirdGameplayControllerMeta.uuid,
    appShellControllerMeta.uuid,
  ]);
});

test('Classic project and serialized Canvas start from the canonical high portrait profile', () => {
  const project = readJson<{
    general: { designResolution: { height: number; width: number } };
  }>('game/settings/v2/packages/project.json');
  const scene = readJson<SerializedObject[]>('game/assets/scenes/classic.scene');
  const canvasSize = scene.find((entry) => (
    entry.__type__ === 'cc.UITransform'
    && entry._contentSize?.width === 720
    && entry._contentSize.height === 1280
  ));

  assert.deepEqual(project.general.designResolution, { height: 1280, width: 720 });
  assert.ok(canvasSize);
});

test('BasicBlade mesh presentation enables its required Creator 3D renderer module', () => {
  const engineSettings = readJson<{
    modules: {
      configs: {
        defaultConfig: {
          cache: Record<string, { _value: boolean }>;
          includeModules: string[];
        };
      };
    };
  }>('game/settings/v2/packages/engine.json');
  const presenterSource = readText(
    'game/assets/scripts/creator/classic-blade-presenter.ts',
  );

  assert.match(presenterSource, /node\.addComponent\(MeshRenderer\)/);
  assert.match(presenterSource, /node\.addComponent\(UIMeshRenderer\)/);
  assert.equal(
    engineSettings.modules.configs.defaultConfig.cache['3d']?._value,
    true,
    'MeshRenderer is undefined at runtime when Creator strips the 3D engine module',
  );
  assert.ok(
    engineSettings.modules.configs.defaultConfig.includeModules.includes('3d'),
    'Preview engine excludes MeshRenderer unless the 3D module is included',
  );
});

test('Creator bridge stays passive until explicit resolution and Classic activation', () => {
  const physicsSource = readText('game/assets/scripts/creator/classic-physics-adapter.ts');
  const sceneSource = readText('game/assets/scripts/creator/classic-scene-controller.ts');
  const physicsAdapterStart = physicsSource.indexOf('export class ClassicPhysicsAdapter');
  const physicsConstructorStart = physicsSource.indexOf('  constructor(', physicsAdapterStart);
  const physicsConfigureStart = physicsSource.indexOf(
    '  configureResolvedWorldProperties()',
    physicsConstructorStart,
  );
  const physicsConstructor = physicsSource.slice(physicsConstructorStart, physicsConfigureStart);
  const configurePhysics = extractMethod(physicsSource, 'configureResolvedWorldProperties');
  const restorePhysics = extractMethod(physicsSource, 'restorePreviousWorldProperties');
  const onLoad = extractMethod(sceneSource, 'onLoad');
  const start = extractMethod(sceneSource, 'start');
  const prepareResolution = extractMemberBlock(
    sceneSource,
    '  prepareSceneResolution(): AppliedClassicResolution {',
  );
  const activateClassic = extractMethod(sceneSource, 'activateInitialClassicLayer');
  const onDestroy = extractMethod(sceneSource, 'onDestroy');

  assert.match(physicsSource, /autoSimulation = false/);
  assert.match(physicsSource, /resetAccumulator\(\)/);
  assert.doesNotMatch(physicsSource, /fixedTimeStep\s*=/);
  assert.match(physicsSource, /class ClassicVariablePhysicsSystem extends System/);
  assert.match(physicsSource, /postUpdate\(frameDeltaSeconds: number\)/);
  assert.match(physicsSource, /this\.physics\.step\(deltaSeconds\)/);
  assert.match(physicsSource, /syncSceneToPhysics\(\)/);
  assert.match(physicsSource, /syncPhysicsToScene\(\)/);
  assert.doesNotMatch(physicsConstructor, /this\.previousState\s*=/);
  assert.match(
    configurePhysics,
    /this\.previousState = capturePreviousPhysicsState\(this\.physics\)/,
  );
  assert.match(restorePhysics, /this\.previousState = null/);
  assert.match(onLoad, /bladeInput\.deactivateForNonClassicScreen\(\)/);
  assert.doesNotMatch(onLoad, /startVariableSimulation|resolution\.apply\(\)/);
  assert.doesNotMatch(onLoad, /CLASSIC_RESOLUTION_APPLIED_EVENT|emitSessionSnapshot/);
  assert.doesNotMatch(start, /enableClassicSpeedUp|startVariableSimulation|emitSessionSnapshot/);
  assertOrderedSubstrings(prepareResolution, [
    'this.resolution.apply()',
    'this.appliedResolution = appliedResolution',
    'CLASSIC_RESOLUTION_APPLIED_EVENT',
  ]);
  assertOrderedSubstrings(activateClassic, [
    'this.physics.configureResolvedWorldProperties()',
    'this.physics.startVariableSimulation(',
    'bladeInput.activateForClassicLayer()',
    'freshWorldSpeed.enableClassicSpeedUp()',
    'this.emitSessionSnapshot()',
  ]);
  assert.match(onDestroy, /restorePreviousWorldProperties/);
});

test('generated Classic slice uses recovered normal-free and stable post-step cut batches', () => {
  const gameplaySource = readText('game/assets/scripts/creator/classic-gameplay-controller.ts');
  const registrySource = readText('game/assets/scripts/creator/classic-entity-registry.ts');
  const fruitSource = readText('game/assets/scripts/creator/classic-generated-fruit.ts');
  const physicsSource = readText('game/assets/scripts/creator/classic-physics-adapter.ts');

  assert.match(gameplaySource, /new ClassicFreeTossStrategy/);
  assert.match(gameplaySource, /controllerId: 'a9'/);
  assert.match(gameplaySource, /effectsEnabled: this\.effectsEnabled/);
  assert.match(gameplaySource, /this\.combo\.update\(deltaSeconds, this\.effectsEnabled\(\)\)/);
  assert.doesNotMatch(gameplaySource, /effectsEnabled: \(\) => false/);
  assert.match(gameplaySource, /if \(registry\.size > 0\)/);
  assert.match(gameplaySource, /runRayQueryCutBatch/);
  assert.match(gameplaySource, /raycastAll\(plan\.forward\.start, plan\.forward\.end\)/);
  assert.match(gameplaySource, /raycastAll\(plan\.reverse\.start, plan\.reverse\.end\)/);
  assert.match(registrySource, /entity\.cutWithinRayQuery/);
  assert.match(registrySource, /entity\.completeRayQueryCuts/);
  assert.match(fruitSource, /this\.node\.active = false/);
  assert.match(fruitSource, /sourceBodyMass = this\.body\.getMass\(\)/);
  assert.match(fruitSource, /sourceAngleRadians: this\.bodyAngleRadiansSnapshot\(\)/);
  assert.match(fruitSource, /sourceAngularVelocityRadiansPerSecond: this\.body\.angularVelocity/);
  assert.match(fruitSource, /rawBody\.GetAngle\.call\(rawBody\)/);
  assert.doesNotMatch(fruitSource, /PhysicsSystem2D/);
  assert.match(physicsSource, /new Vec2\(startWorld\.x, startWorld\.y\)/);
  assert.match(physicsSource, /fruitCollisionMask/);
});

test('Classic presentation loads the exact game bundle before using recovered fruit rasters', () => {
  const bundleMeta = readJson<{
    imported: boolean;
    userData: { isBundle?: boolean };
  }>('game/assets/game.meta');
  const loaderSource = readText('game/assets/scripts/creator/classic-resource-loader.ts');
  const gameplaySource = readText('game/assets/scripts/creator/classic-gameplay-controller.ts');
  const sharedBackgroundSource = readText(
    'game/assets/scripts/creator/shared-background-presenter.ts',
  );
  const fruitSource = readText('game/assets/scripts/creator/classic-generated-fruit.ts');

  assert.equal(bundleMeta.imported, true);
  assert.equal(bundleMeta.userData.isBundle, true);
  assert.match(loaderSource, /CLASSIC_RESOURCE_BUNDLE_NAME = 'game'/);
  assert.match(loaderSource, /assetManager\.loadBundle\(CLASSIC_RESOURCE_BUNDLE_NAME/);
  assert.match(loaderSource, /canonicalRasterToSpriteFrameBundlePath\(resource\.canonicalPath\)/);
  assert.match(loaderSource, /\/spriteFrame/);
  assert.match(loaderSource, /bundle\.load\(paths, SpriteFrame/);
  assert.match(loaderSource, /error !== null && error !== undefined/);
  assert.match(loaderSource, /assertSpriteFrameDimensions/);
  assert.match(loaderSource, /getClassicCriticalParticleResource/);
  assert.match(loaderSource, /criticalParticles/);

  assert.match(gameplaySource, /await loadClassicSliceResourceCatalog\(assetTree\)/);
  assert.match(gameplaySource, /resourceCatalog: resources/);
  assert.doesNotMatch(gameplaySource, /createRecoveredBackground|ClassicRecoveredPaperBackground/);
  assert.match(sharedBackgroundSource, /new Node\('SharedBackgroundRoot'\)/);
  assert.match(sharedBackgroundSource, /this\.root\.setSiblingIndex\(siblingIndex\)/);
  assert.match(sharedBackgroundSource, /this\.opacity\.opacity = 255/);
  assert.doesNotMatch(sharedBackgroundSource, /tween\(|opacity\s*=\s*0/);
  assert.match(
    gameplaySource,
    /playRecoveredIntro\(classicModeRoot, viewport, resources\)/,
  );
  assert.doesNotMatch(gameplaySource, /Swipe to start/);
  assert.match(gameplaySource, /\.to\(0\.5, \{ position:/);
  assert.match(gameplaySource, /\.delay\(0\.5\)/);
  assert.match(gameplaySource, /this\.sceneController\.completeIntro\(\)/);

  assert.match(fruitSource, /this\.node\.addComponent\(Sprite\)/);
  assert.match(fruitSource, /visuals\.intact\.spriteFrame/);
  assert.match(fruitSource, /spriteWidthWorldUnits: visuals\.intact\.dimensions\.width/);
  assert.match(fruitSource, /spriteHeightWorldUnits: visuals\.intact\.dimensions\.height/);
  assert.doesNotMatch(fruitSource, /Graphics|CLASSIC_GENERATED_FRUIT_VISUAL_SIZE|64x64/);
});

test('Classic score HUD replaces the provisional label and routes smoothing through the icon presenter', () => {
  const gameplaySource = readText('game/assets/scripts/creator/classic-gameplay-controller.ts');
  const presenterSource = readText('game/assets/scripts/creator/classic-score-hud-presenter.ts');
  const presenterUpdateIndex = gameplaySource.indexOf(
    'this.scoreHudPresenter?.updateAction(deltaSeconds)',
  );
  const scoreUpdateIndex = gameplaySource.indexOf(
    'this.score.updateDisplayedScore()',
  );
  const scoreRootIndex = gameplaySource.indexOf("'ClassicScoreHudRoot'");
  const worldRootIndex = gameplaySource.indexOf("'ClassicWorldPresentationRoot'");
  const failRootIndex = gameplaySource.indexOf("'ClassicFailPresentationRoot'");

  assert.match(gameplaySource, /ClassicScoreHudPresenter\.create\(\{/);
  assert.match(gameplaySource, /scoreIconResource: resources\.presentation\.scoreIcon/);
  assert.match(gameplaySource, /bestScoreCupResource: resources\.presentation\.bestScoreCup/);
  assert.match(gameplaySource, /doubleScorePanelResource: resources\.presentation\.doubleScorePanel/);
  assert.match(gameplaySource, /fontResource: resources\.scoreFont/);
  assert.match(
    gameplaySource,
    /createRecoveredPresenterRoot\(parent, 'ClassicScoreHudRoot'\)/,
  );
  assert.match(gameplaySource, /this\.scoreHudPresenter\.attach\(scoreHudRoot\)/);
  assert.match(
    gameplaySource,
    /createRecoveredPresenterRoot\([\s\S]*?parent,[\s\S]*?'ClassicFailPresentationRoot'/,
  );
  assert.match(gameplaySource, /this\.failPresenter\.attach\(failPresentationRoot\)/);
  assert.ok(scoreRootIndex >= 0 && worldRootIndex > scoreRootIndex);
  assert.ok(failRootIndex > worldRootIndex);
  assert.match(
    gameplaySource,
    /applySpawnPlan\([\s\S]*?spawnCommands,[\s\S]*?this\.requireWorldPresentationRoot\(\)/,
  );
  assert.match(
    gameplaySource,
    /presenter\.attach\(this\.requireWorldPresentationRoot\(\), 1\)/,
  );
  assert.match(gameplaySource, /presenter\.attach\(this\.requireWorldPresentationRoot\(\)\)/);
  assert.ok(presenterUpdateIndex >= 0 && scoreUpdateIndex > presenterUpdateIndex);
  assert.match(gameplaySource, /presenter\.startScoreIconScaleUp\(command\.durationSeconds, command\.targetScale\)/);
  assert.match(gameplaySource, /presenter\.startScoreIconScaleDown\(command\.durationSeconds, command\.targetScale\)/);
  assert.match(
    gameplaySource,
    /startDoubleScorePanelIntro\([\s\S]*?command\.introDurationSeconds,[\s\S]*?command\.activeDelaySeconds/,
  );
  assert.match(gameplaySource, /startDoubleScorePanelExit\([\s\S]*?command\.exitDurationSeconds/);
  assert.match(
    gameplaySource,
    /onDoubleScoreActiveDelayComplete[\s\S]*?score\.completeDoubleScoreDelay\(\)/,
  );
  assert.match(gameplaySource, /this\.scoreHudPresenter\?\.setDisplayedScore\(this\.score\.displayedScore\)/);
  assert.match(gameplaySource, /this\.scoreHudPresenter\?\.setBestScore\(this\.score\.bestScore, this\.score\.bestScoreIsNew\)/);
  assert.match(
    gameplaySource,
    /const preparation = this\.initializeRecoveredResources\(assetTree\)[\s\S]*?preparation\.catch\([\s\S]*?onRecoveredResourceInitializationFailed/,
  );
  assert.match(
    gameplaySource,
    /this\.shuttingDown[\s\S]*?!isValid\(this\.node, true\)/,
  );
  assert.match(
    gameplaySource,
    /activateInitialClassicRuntime[\s\S]*?catch \(error\) \{[\s\S]*?disposeClassicModePresentation\(\)[\s\S]*?this\.screenPlacement = null[\s\S]*?throw error/,
  );
  assert.doesNotMatch(gameplaySource, /ClassicGeneratedScore|`SCORE \$\{|setContentSize\(260, 90\)|fontSize \+ 8/);
  assert.match(presenterSource, /label\.lineHeight\s*=\s*layout\.fontSize/);
  assert.match(presenterSource, /node\.addComponent\(Mask\)/);
  assert.doesNotMatch(presenterSource, /mask\.(?:type|inverted)\s*=/);
  assert.match(presenterSource, /ClassicDoubleScoreViewportClip/);
  assert.doesNotMatch(presenterSource, /setContentSize\(260, 90\)/);
});

test('Classic audio preload and event consumers use the exact recovered clips', () => {
  const audioSource = readText('game/assets/scripts/creator/classic-audio-presenter.ts');
  const gameplaySource = readText('game/assets/scripts/creator/classic-gameplay-controller.ts');
  const registrySource = readText('game/assets/scripts/creator/classic-entity-registry.ts');
  const visualLoadIndex = gameplaySource.indexOf(
    'resources = await loadClassicSliceResourceCatalog(assetTree)',
  );
  const audioLoadIndex = gameplaySource.indexOf(
    'loadedAudioPresenter = await ClassicAudioPresenter.load(this.node)',
  );

  assert.notEqual(visualLoadIndex, -1);
  assert.ok(audioLoadIndex > visualLoadIndex);
  assert.match(audioSource, /CLASSIC_CORE_AUDIO_PATHS\.map\(canonicalResourceToBundlePath\)/);
  assert.match(audioSource, /bundle\.load\(bundlePaths, AudioClip/);
  assert.match(audioSource, /error !== null && error !== undefined/);
  assert.match(
    audioSource,
    /createEffectVoice\('ClassicOneShotAudio', clip, false, true\)/,
  );
  assert.match(audioSource, /voice\.volume = TARGET_ONE_SHOT_VOLUME_SCALE/);
  assert.match(audioSource, /voice\.play\(\)/);
  assert.doesNotMatch(audioSource, /canonicalRasterToSpriteFrameBundlePath|\/spriteFrame/);

  assert.match(registrySource, /case 'play-toss-sound':[\s\S]*onPlayTossSound\(command\.sound\)/);
  assert.match(gameplaySource, /onPlayTossSound: \(sound\) => audioPresenter\.playOneShot\(sound\)/);
  assert.match(gameplaySource, /getClassicFruitCutAudioSequence\(event\.fruitId, event\.critical\)/);
  assert.match(gameplaySource, /getClassicComboAudioPath\(command\.soundIndex\)/);
  assert.match(gameplaySource, /new ClassicSwishAudioGate\(this\.random\)/);
  assert.match(gameplaySource, /this\.swishAudio\.request\([\s\S]*event\.shouldPlaySwish/);
  assert.match(gameplaySource, /this\.scheduleOnce\(this\.onSwishCooldownComplete, instruction\.delaySeconds\)/);
  assert.match(gameplaySource, /this\.unschedule\(this\.onSwishCooldownComplete\)/);
});

test('ordinary cuts present exact recovered halves before audio and scoring', () => {
  const gameplaySource = readText('game/assets/scripts/creator/classic-gameplay-controller.ts');
  const presenterSource = readText('game/assets/scripts/creator/classic-cut-half-presenter.ts');
  const cutHandlerStart = gameplaySource.indexOf(
    '  private onFruitCut(event: ClassicGeneratedFruitCutEvent): void {',
  );
  const cutPresentationStart = gameplaySource.indexOf(
    '  private presentRecoveredCutHalves(event: ClassicGeneratedFruitCutEvent): void {',
  );
  assert.notEqual(cutHandlerStart, -1);
  assert.notEqual(cutPresentationStart, -1);
  const cutHandler = gameplaySource.slice(cutHandlerStart, cutPresentationStart);

  const visualIndex = cutHandler.indexOf('this.presentRecoveredCutHalves(event)');
  const audioIndex = cutHandler.indexOf('getClassicFruitCutAudioSequence');
  const scoreIndex = cutHandler.indexOf('createClassicFruitCutCommands');
  assert.ok(visualIndex >= 0 && audioIndex > visualIndex && scoreIndex > audioIndex);

  assert.match(gameplaySource, /createClassicCutHalfMotion\(\{/);
  assert.match(gameplaySource, /bottomHeightWorldUnits: visuals\.cutBottom\.dimensions\.height/);
  assert.match(gameplaySource, /topHeightWorldUnits: visuals\.cutTop\.dimensions\.height/);
  assert.match(gameplaySource, /sourceAngleRadians: event\.sourceAngleRadians/);
  assert.match(gameplaySource, /sourceBodyMass: event\.sourceBodyMass/);
  assert.match(
    gameplaySource,
    /presenter\.attach\(this\.requireWorldPresentationRoot\(\), 1\)/,
  );
  assert.match(gameplaySource, /presenter\.updateAction\(deltaSeconds\)/);
  assert.match(gameplaySource, /presenter\.evaluateBounds\(viewport\)/);
  assert.match(gameplaySource, /this\.disposeCutHalfPresenters\(\)/);

  assert.match(presenterSource, /nativePart: 1,[\s\S]*part: 'bottom'/);
  assert.match(presenterSource, /nativePart: 0,[\s\S]*part: 'top'/);
  assert.match(presenterSource, /body\.gravityScale = CLASSIC_CUT_HALF_GRAVITY_SCALE/);
  assert.match(presenterSource, /body\.linearVelocity = new Vec2\(0, 0\)/);
  assert.match(presenterSource, /applyLinearImpulseToCenter\([\s\S]*true/);
  assert.match(presenterSource, /this\.queueAll\('fade-complete'\)/);
});

test('critical cut halves preserve per-half update RNG and exact particle consumers', () => {
  const gameplaySource = readText('game/assets/scripts/creator/classic-gameplay-controller.ts');
  const plannerSource = readText('game/assets/scripts/domain/classic-critical-particle-plan.ts');
  const physicsStart = gameplaySource.indexOf(
    '  private readonly onPhysicsStepped = (event: ClassicPhysicsSteppedEvent): void => {',
  );
  const cutStart = gameplaySource.indexOf(
    '  private onFruitCut(event: ClassicGeneratedFruitCutEvent): void {',
  );
  assert.notEqual(physicsStart, -1);
  assert.ok(cutStart > physicsStart);
  const postPhysics = gameplaySource.slice(physicsStart, cutStart);
  const boundsIndex = postPhysics.indexOf('presenter.evaluateBounds(viewport)');
  const particleIndex = postPhysics.indexOf('this.emitRecoveredCriticalParticles(presenter)');
  assert.ok(boundsIndex >= 0 && particleIndex > boundsIndex);

  assert.match(gameplaySource, /const existingCutHalfPresenters = \[\.\.\.this\.cutHalfPresenters\]/);
  assert.match(gameplaySource, /if \(event\.critical\) \{[\s\S]*this\.criticalCutHalfPresenters\.add\(presenter\)/);
  assert.match(gameplaySource, /for \(const half of cutHalves\.halves\)/);
  assert.match(gameplaySource, /if \(half\.disposalQueued\)/);
  assert.match(gameplaySource, /createClassicCriticalParticleUpdateCommands\([\s\S]*critical,[\s\S]*this\.random/);
  assert.match(gameplaySource, /resources\.criticalParticles\[command\.resourceIndex - 1\]/);
  assert.match(gameplaySource, /positionWorldUnits: \{ x: position\.x, y: position\.y \}/);
  assert.match(
    gameplaySource,
    /presenter\.attach\(this\.requireWorldPresentationRoot\(\)\)/,
  );
  assert.match(gameplaySource, /this\.criticalParticlePresenters\.delete\(presenter\)/);
  assert.match(gameplaySource, /presenter\.updateAction\(deltaSeconds\)/);

  assert.match(plannerSource, /drawInclusive\(random, 0, 3\)/);
  assert.match(plannerSource, /drawInclusive\(random, 1, 4\)/);
  assert.match(plannerSource, /drawInclusive\(random, -10, 10\)/);
  assert.match(plannerSource, /CLASSIC_CRITICAL_PARTICLE_SCALE_OUT_ACTION_SECONDS = Math\.fround\(1\.5\)/);
});

test('misses use exact recovered marker resources and the 0.25-second callback boundary', () => {
  const gameplaySource = readText('game/assets/scripts/creator/classic-gameplay-controller.ts');
  const loaderSource = readText('game/assets/scripts/creator/classic-resource-loader.ts');
  const presenterSource = readText('game/assets/scripts/creator/classic-fail-presenter.ts');
  const planSource = readText('game/assets/scripts/domain/classic-fail-presentation.ts');

  assert.match(loaderSource, /descriptor\('presentation\.failFilled', presentation\.failFilled\)/);
  assert.match(loaderSource, /descriptor\('presentation\.failNormal', presentation\.failNormal\)/);
  assert.match(gameplaySource, /ClassicFailPresenter\.create\(\{/);
  assert.match(gameplaySource, /filledResource: resources\.presentation\.failFilled/);
  assert.match(gameplaySource, /normalResource: resources\.presentation\.failNormal/);
  assert.match(gameplaySource, /presenter\.presentMiss\(command\.strike, command\.missPosition\)/);
  assert.match(gameplaySource, /this\.applyFailCommands\(this\.fail\.completeIndicator\(\)\)/);
  assert.match(gameplaySource, /this\.failPresenter\?\.updateAction\(deltaSeconds\)/);
  assert.doesNotMatch(gameplaySource, /ClassicGeneratedStrikes|GENERATED_FAIL_CALLBACK_DELAY_SECONDS/);

  assert.match(planSource, /CLASSIC_FAIL_ACTIVATION_ACTION_SECONDS = Math\.fround\(0\.25\)/);
  assert.match(planSource, /CLASSIC_FAIL_TRANSIENT_ACTION_SECONDS = Math\.fround\(1\)/);
  assert.match(planSource, /Math\.fround\(viewport\.height \* TRANSIENT_Y_FACTOR\)/);
  assert.match(presenterSource, /marker\.sprite\.spriteFrame = this\.filledResource\.spriteFrame/);
  assert.match(presenterSource, /marker\.layout\.scale \* plan\.initialScaleMultiplier/);
  assert.match(presenterSource, /this\.lifecycle\.onIndicatorComplete\(strike\)/);
  assert.match(presenterSource, /destroyTransient\(transient\)/);
});

test('terminal completion replaces Classic with the recovered result shell and explicit deferred seams', () => {
  const gameplaySource = readText('game/assets/scripts/creator/classic-gameplay-controller.ts');
  const resultPresenterSource = readText(
    'game/assets/scripts/creator/classic-result-presenter.ts',
  );
  const sceneSource = readText('game/assets/scripts/creator/classic-scene-controller.ts');
  const terminalStart = gameplaySource.indexOf('  private playRecoveredTerminalPresentation(): void {');
  const resultStart = gameplaySource.indexOf('  private beginResultConstruction(): void {');
  assert.notEqual(terminalStart, -1);
  assert.ok(resultStart > terminalStart);
  const terminalSource = gameplaySource.slice(terminalStart, resultStart);

  assert.match(gameplaySource, /CLASSIC_BLADE_BEGAN_EVENT/);
  assert.match(gameplaySource, /CLASSIC_BLADE_ENDED_EVENT/);
  assert.match(gameplaySource, /ClassicBladePresenter\.create\(\{/);
  assert.match(gameplaySource, /resource: resources\.defaultBlade/);
  assert.match(gameplaySource, /selectedBladeId: 0/);
  assert.match(gameplaySource, /if \(!presenter\.isClaimed\(event\.segment\.slot\)\)/);
  assert.match(gameplaySource, /presenter\.move\(event\.segment\.slot, event\.segment\.current\)/);
  assert.match(gameplaySource, /if \(presenter !== null && !presenter\.isClaimed\(event\.slot\)\)/);
  assert.match(gameplaySource, /if \(presenter !== null && presenter\.isClaimed\(event\.slot\)\)/);
  assert.match(gameplaySource, /this\.bladePresenter\?\.updateFrame\(\)/);
  assert.match(gameplaySource, /this\.bladePresenter\?\.dispose\(\)/);
  assert.match(
    terminalSource,
    /displayScoreComplete\(this\.score\.authoritativeScore\)/,
  );
  assert.doesNotMatch(terminalSource, /game\.destroy\(\)|over\.destroy\(\)/);
  assert.match(gameplaySource, /command\.type === 'stop-effects'[\s\S]*?audioPresenter\?\.stop\(\)/);
  assert.match(gameplaySource, /command\.type === 'construct-result'[\s\S]*?beginResultConstruction\(\)/);
  assert.match(gameplaySource, /command\.type === 'remove-classic'[\s\S]*?disposeClassicModePresentation\(\)/);
  assert.match(gameplaySource, /command\.type === 'attach-result'[\s\S]*?attachRecoveredResult\(command\.zOrder\)/);
  assert.match(
    sceneSource,
    /command\.type === 'remove-classic'[\s\S]*?unschedule\(this\.onSpeedUpDelayComplete\)[\s\S]*?physics\.restorePreviousWorldProperties\(\)/,
  );

  assert.match(gameplaySource, /ClassicResultPresenter\.create\(\{/);
  assert.match(gameplaySource, /fonts: resources\.resultFonts/);
  assert.match(gameplaySource, /resources: resources\.result/);
  assert.match(gameplaySource, /random: this\.random/);
  assert.match(gameplaySource, /panelValues: classicLeaderboardPanelValues\(ranking\.leaderboard\)/);
  assert.match(gameplaySource, /const settings = this\.requireSettingsRuntime\(\)/);
  assert.match(gameplaySource, /settings\.state\.recordClassicResultScore\(configured\.score\)/);
  assert.match(gameplaySource, /totalCoins: settings\.state\.snapshot\.totalCoins/);
  assert.match(
    gameplaySource,
    /createDetachedScreenRoot\([\s\S]*?'ClassicResultPresentationRoot',[\s\S]*?this\.node/,
  );
  assert.match(gameplaySource, /this\.requireScreenPlacement\(\)\.attachCurrentScreen\(root\)/);
  assert.match(gameplaySource, /presenter\.attach\(root\)/);
  assert.match(gameplaySource, /getClassicResultRankAudioPath\(ranking\.achievedRank\)/);

  const retryStart = gameplaySource.indexOf('  private readonly onResultRetry');
  const menuStart = gameplaySource.indexOf('  private readonly onResultMenu');
  assert.notEqual(retryStart, -1);
  assert.ok(menuStart > retryStart);
  const retrySource = gameplaySource.slice(retryStart, menuStart);
  const retryApplySource = extractMemberBlock(
    gameplaySource,
    '  private applyRetryNavigationCommand(',
  );
  const retryTransactionSource = extractMemberBlock(
    gameplaySource,
    '  private restartRecoveredClassicRunSameParent(',
  );
  const retryResetSource = extractMemberBlock(
    gameplaySource,
    '  private resetRecoveredClassicRunState(',
  );
  const retryAttachmentSource = extractMemberBlock(
    gameplaySource,
    '  private attachClassicForRetry(',
  );
  const retryRemovalSource = extractMemberBlock(
    gameplaySource,
    '  private removeResultForRetry(',
  );
  const retryCleanupSource = extractMemberBlock(
    gameplaySource,
    '  private commitRemovedResultForRetry(',
  );
  const retryRollbackSource = extractMemberBlock(
    gameplaySource,
    '  private rollbackFailedRetry(',
  );
  const resultDisposalSource = extractMemberBlock(
    gameplaySource,
    '  private disposeResultPresentation(',
  );
  const modeConstructionSource = extractMemberBlock(
    gameplaySource,
    '  private constructRecoveredClassicMode(',
  );
  const modeAttachmentSource = extractMemberBlock(
    gameplaySource,
    '  private attachRecoveredClassicMode(',
  );
  const modeDisposalSource = extractMemberBlock(
    gameplaySource,
    '  private disposeClassicModePresentation(',
  );
  assertOrderedSubstrings(retrySource, [
    'const retryContext = this.createRetryRestartContext()',
    'const commands = createClassicResultNavigationCommands({',
    'effectsEnabled: this.effectsEnabled()',
    'mode: retryContext.mode',
    "route: 'retry'",
    'this.applyRetryNavigationCommand(command, retryContext, retryState)',
    'this.updatePresentation()',
    'this.emitSnapshot()',
  ]);
  assertOrderedSubstrings(retryApplySource, [
    "case 'request-menu-button-audio':",
    "case 'capture-result-parent':",
    "case 'remove-result':",
    "case 'construct-classic':",
    "case 'attach-classic-to-captured-parent':",
  ]);
  assert.match(
    retryApplySource,
    /retryContext\.audioPresenter\.playOneShot\(command\.canonicalPath\)/,
  );
  assert.match(
    retryApplySource,
    /retryContext\.screenPlacement\.currentScreen !== retryContext\.resultRoot[\s\S]*?retryState\.capturedResultRoot = retryContext\.resultRoot/,
  );
  assert.match(
    retryApplySource,
    /this\.removeResultForRetry\(command, retryContext, retryState\)/,
  );
  assert.match(retryApplySource, /this\.constructClassicForRetry\(retryContext\)/);
  assert.match(
    retryApplySource,
    /this\.attachClassicForRetry\(command, retryContext, retryState\)/,
  );
  assertOrderedSubstrings(resultDisposalSource, [
    "this.detachOwnedScreen(root, 'Classic Result')",
    'this.resultPresenter?.dispose()',
    'root.destroy()',
  ]);
  assertOrderedSubstrings(modeConstructionSource, [
    'classicModeRoot.setWorldPosition(this.node.worldPosition)',
    'classicModeRoot.setWorldRotation(this.node.worldRotation)',
    'classicModeRoot.setWorldScale(this.node.worldScale)',
    'this.createRecoveredPresentation(classicModeRoot, viewport, resources)',
  ]);
  assertOrderedSubstrings(modeAttachmentSource, [
    'const screenPlacement = this.requireScreenPlacement()',
    'screenPlacement.attachCurrentScreen(root)',
    'screenPlacement.currentScreen !== root',
  ]);
  assertOrderedSubstrings(modeDisposalSource, [
    "this.detachOwnedScreen(classicModeRoot, 'Classic mode')",
    'this.failPresenter?.dispose()',
    'classicModeRoot.destroy()',
  ]);
  assertOrderedSubstrings(retryAttachmentSource, [
    'retryContext.sceneController.restartClassicLayer()',
    'this.attachRecoveredClassicMode(command.zOrder)',
    'this.assertRemovedResultReadyForCleanup(retryContext, retryState)',
    'retryContext.sceneController.commitClassicLayerRestart()',
    'this.commitRemovedResultForRetry(retryState, resultCleanup)',
  ]);
  assert.match(
    retryAttachmentSource,
    /catch \(error\)[\s\S]*?rollbackClassicLayerRestart\(\)[\s\S]*?disposeClassicModePresentation\(\)/,
  );
  assert.match(
    retryRemovalSource,
    /retryContext\.screenPlacement\.detachCurrentScreen\([\s\S]*?retryContext\.resultRoot/,
  );
  assert.doesNotMatch(retryRemovalSource, /disposeResultPresentation\(\)/);
  assertOrderedSubstrings(retryCleanupSource, [
    'this.resultPresentationRoot = null',
    'this.resultPresenter = null',
    'retryState.resultCleanupCommitted = true',
    'cleanup.presenter.dispose()',
    'cleanup.root.destroy()',
  ]);
  assert.match(
    retryCleanupSource,
    /cleanupFailures\.length > 0[\s\S]*?new Error\([\s\S]*?committed with Result cleanup failures/,
  );
  assert.doesNotMatch(retryCleanupSource, /disposeResultPresentation\(\)/);
  assertOrderedSubstrings(retryRollbackSource, [
    'this.disposeClassicModePresentation()',
    'this.planner = retryContext.previousRunState.planner',
    'this.swishAudio = retryContext.previousRunState.swishAudio',
    'this.combo = retryContext.previousRunState.combo',
    'this.fail = retryContext.previousRunState.fail',
    'this.score = retryContext.previousRunState.score',
    'this.resultConstructionRequested = true',
    'this.resultMode = retryContext.mode',
    'this.resultScore = retryContext.score',
    'retryContext.screenPlacement.attachCurrentScreen(retryContext.resultRoot)',
    "this.resultPresenter.rearmNavigationAfterFailure('retry')",
    'this.emitSnapshot()',
  ]);
  assert.doesNotMatch(
    retryRollbackSource,
    /recordClassicResultScore|awardClassicResultCoins|attachRecoveredResult/,
  );
  assert.match(
    retryTransactionSource,
    /catch \(error\)[\s\S]*?rollbackFailedRetry\(retryContext, retryState\)[\s\S]*?throw error/,
  );
  assert.match(
    retryResetSource,
    /this\.planner = new ClassicSpawnPlanner\([\s\S]*?this\.swishAudio = new ClassicSwishAudioGate\(this\.random\)[\s\S]*?this\.combo = new ComboService\(this\.random\)[\s\S]*?this\.fail = new FailService\(\)/,
  );
  assert.match(
    retryResetSource,
    /new ScoreService\([\s\S]*?this\.requireSettingsRuntime\(\)\.state\.snapshot\.leaderboard\.first/,
  );
  assert.match(
    retrySource,
    /createRetryRestartContext\(\): ClassicRetryRestartContext \{[\s\S]*?this\.requireSettingsRuntime\(\)[\s\S]*?previousRunState: Object\.freeze\(\{[\s\S]*?fail: this\.fail[\s\S]*?planner: this\.planner[\s\S]*?score: this\.score[\s\S]*?swishAudio: this\.swishAudio[\s\S]*?viewport: this\.requireViewport\(\)/,
  );
  assert.match(
    gameplaySource,
    /requireAttachedResultPresentationRoot\(\): Node \{[\s\S]*?resultRoot\.parent === null[\s\S]*?screenPlacement\?\.currentScreen !== resultRoot/,
  );
  assert.match(
    retrySource,
    /rearmNavigationAfterFailure\('retry'\)[\s\S]*?CLASSIC_RESULT_RETRY_FAILED_EVENT/,
  );
  assert.doesNotMatch(retrySource, /director|loadScene|settingsRuntime\?\.save/);
  assert.match(
    sceneSource,
    /restartClassicLayer\(\): void \{[\s\S]*?new ClassicSession\(\)[\s\S]*?new ClassicWorldSpeed\(\)[\s\S]*?activateForClassicLayer\(\)[\s\S]*?catch \(error\)[\s\S]*?restorePendingClassicLayerRestart\(\)/,
  );
  assert.match(gameplaySource, /CLASSIC_RESULT_MENU_REQUESTED_EVENT/);
  assert.match(gameplaySource, /state\.awardClassicResultCoins\(score\)/);
  assert.match(gameplaySource, /CLASSIC_RESULT_REWARD_READY_EVENT/);
  assert.match(gameplaySource, /return bonusCoins/);
  assert.match(
    resultPresenterSource,
    /ClassicResultParticleExplosionPresenter\.create\(\{[\s\S]*?resource: input\.resources\.bonusParticle/,
  );
  assert.match(resultPresenterSource, /particleExplosionPresenter\.attachBetween\(/);
  assert.match(
    resultPresenterSource,
    /ClassicResultRewardPresenter\.create\(\{[\s\S]*?effectResource: input\.resources\.bonusCoinsEffect/,
  );
  assert.match(resultPresenterSource, /rewardPresenter\.present\(parent\)/);
  assert.match(
    gameplaySource,
    /new ScoreService\([\s\S]*?settingsRuntime\.state\.snapshot\.leaderboard\.first/,
  );
  assert.doesNotMatch(gameplaySource, /game\.on\(Game\.EVENT_HIDE|onGameHidden/);
  assert.match(
    gameplaySource,
    /settingsRuntime\.loadFailure !== null[\s\S]*?CLASSIC_SETTINGS_LOAD_RECOVERED_EVENT/,
  );
  assert.match(gameplaySource, /CLASSIC_SETTINGS_SAVE_FAILED_EVENT/);
  assert.doesNotMatch(gameplaySource, /new MainMenuLayer|scorescreen\.wav/);
});

function readJson<T>(relativePath: string): T {
  return JSON.parse(readText(relativePath)) as T;
}

function readText(relativePath: string): string {
  return readFileSync(`${REPOSITORY_ROOT}${relativePath}`, 'utf8');
}

function extractMethod(source: string, methodName: string): string {
  const methodStart = source.indexOf(`  ${methodName}(): void {`);
  assert.notEqual(methodStart, -1);
  const nextMethod = source.indexOf('\n  }\n\n  ', methodStart);
  assert.notEqual(nextMethod, -1);
  return source.slice(methodStart, nextMethod + 4);
}

function extractMemberBlock(source: string, memberStart: string): string {
  const start = source.indexOf(memberStart);
  assert.notEqual(start, -1);
  const nextPrivate = source.indexOf('\n  private ', start + memberStart.length);
  const nextFunction = source.indexOf('\nfunction ', start + memberStart.length);
  const endCandidates = [nextPrivate, nextFunction].filter((index) => index >= 0);
  assert.ok(endCandidates.length > 0);
  return source.slice(start, Math.min(...endCandidates));
}

function assertOrderedSubstrings(source: string, orderedSubstrings: readonly string[]): void {
  let currentIndex = -1;
  for (const substring of orderedSubstrings) {
    const nextIndex = source.indexOf(substring, currentIndex + 1);
    assert.notEqual(nextIndex, -1, `missing substring: ${substring}`);
    assert.ok(nextIndex > currentIndex, `substring out of order: ${substring}`);
    currentIndex = nextIndex;
  }
}

function decodeCreatorUuid(compressed: string): string {
  assert.equal(compressed.length, 23);
  // Serialized component class IDs retain five hex nibbles, then pack three per Base64 pair.
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let hex = compressed.slice(0, 5);
  for (let index = 5; index < compressed.length; index += 2) {
    const high = alphabet.indexOf(compressed[index] ?? '');
    const low = alphabet.indexOf(compressed[index + 1] ?? '');
    assert.notEqual(high, -1);
    assert.notEqual(low, -1);
    hex += ((high << 6) | low).toString(16).padStart(3, '0');
  }
  assert.equal(hex.length, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}
