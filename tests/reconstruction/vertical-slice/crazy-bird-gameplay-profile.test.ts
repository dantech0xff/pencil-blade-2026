import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SOURCE = readFileSync(
  `${REPOSITORY_ROOT}/game/assets/scripts/creator/crazy-gameplay-controller.ts`,
  'utf8',
);

test('Crazy Bird owns a separate retryable type-2 readiness boundary', () => {
  const prepare = extractMethod(SOURCE, 'prepareCrazyBirdRuntime');
  assertOrderedSubstrings(prepare, [
    "this.crazyBirdReadinessStatus = 'pending'",
    'const attempt = this.initializeCrazyBirdPreparation()',
    'this.crazyBirdPreparation = attempt',
    'void attempt.catch',
    'this.crazyBirdPreparation = null',
    "this.crazyBirdReadinessStatus = 'failed'",
    'CRAZY_BIRD_RESOURCE_LOAD_FAILED_EVENT',
  ]);
  assert.doesNotMatch(prepare, /this\.readinessStatus\s*=/);
  assert.doesNotMatch(prepare, /CRAZY_RESOURCE_LOAD_FAILED_EVENT/);

  const initialize = extractMethod(SOURCE, 'initializeCrazyBirdPreparation');
  assertOrderedSubstrings(initialize, [
    'await this.prepareCrazyRuntime()',
    'const assetTree = this.requireCrazyResources().assetTree',
    'await loadBirdResources(assetTree, 2)',
    'resources.assetTree !== assetTree',
    'resources.birdType !== 2',
    'this.crazyBirdResources = resources',
    "this.crazyBirdReadinessStatus = 'ready'",
  ]);
  assert.match(
    SOURCE,
    /get crazyBirdReadiness\(\): CrazyGameplayReadiness[\s\S]*?error: this\.crazyBirdPreparationError[\s\S]*?status: this\.crazyBirdReadinessStatus/,
  );
  assert.match(
    SOURCE,
    /get crazyBirdPrepared\(\): boolean[\s\S]*?this\.crazyBirdReadinessStatus === 'ready'/,
  );
});

test('one serialized controller keeps mode 1 default and exposes explicit mode 4 entry', () => {
  const crazyEntry = extractMethod(SOURCE, 'activateCrazyFromAppShell');
  const birdEntry = extractMethod(SOURCE, 'activateCrazyBirdFromAppShell');
  assert.match(
    crazyEntry,
    /activateTimedModeFromAppShell\(screenPlacement, CRAZY_TIMED_PROFILE\)/,
  );
  assert.match(
    birdEntry,
    /activateTimedModeFromAppShell\(screenPlacement, CRAZY_BIRD_TIMED_PROFILE\)/,
  );

  const construct = extractMethod(SOURCE, 'constructCrazyMode');
  assert.match(
    construct,
    /profile: CrazyTimedModeProfile = CRAZY_TIMED_PROFILE/,
  );
  assert.match(
    construct,
    /profile === CRAZY_BIRD_TIMED_PROFILE \? 'CrazyBirdModeRoot' : 'CrazyModeRoot'/,
  );
  assertOrderedSubstrings(construct, [
    'this.runProfile = profile',
    'this.createCorePresentation(',
    'profile,',
  ]);

  const activate = extractMethod(SOURCE, 'activateTimedModeFromAppShell');
  assert.match(
    activate,
    /profile === CRAZY_BIRD_TIMED_PROFILE[\s\S]*?this\.crazyBirdReadinessStatus[\s\S]*?: this\.readinessStatus/,
  );
  assertOrderedSubstrings(activate, [
    'this.constructCrazyMode(profile)',
    'this.attachCrazyModeAndActivateScene(screenPlacement, profile)',
  ]);
});

test('immutable profile identity crosses ownership, scene activation, replay, and Result', () => {
  const capture = extractMethod(SOURCE, 'captureCrazyRunOwnership');
  const empty = extractMethod(SOURCE, 'createEmptyCrazyRunOwnership');
  const install = extractMethod(SOURCE, 'installCrazyRunOwnership');
  assert.match(capture, /profile: this\.runProfile/);
  assert.match(empty, /profile: null/);
  assert.match(install, /this\.runProfile = ownership\.profile/);

  const attach = extractMethod(SOURCE, 'attachCrazyModeAndActivateScene');
  assertOrderedSubstrings(attach, [
    'profile !== this.requireRunProfile()',
    'scene.activateCrazyBirdLayer(best)',
    'scene.activateCrazyLayer(best)',
    'scene.sessionSnapshot().mode !== profile.mode',
    'scene.timedModeProfile !== profile',
  ]);

  const replay = extractMethod(SOURCE, 'restartCrazyFromPause');
  assertOrderedSubstrings(replay, [
    'const profile = this.requireRunProfile()',
    'this.constructCrazyMode(profile)',
    'timedModeLeaderboardFirst(this.sharedSettingsRuntime, profile)',
    'freshScene.activateCrazyBirdLayer(best)',
    'freshScene.activateCrazyLayer(best)',
    'freshScene.timedModeProfile !== profile',
  ]);

  const resultCapture = extractMethod(SOURCE, 'captureCrazyForResult');
  const resultConstruction = extractMethod(SOURCE, 'beginResultConstruction');
  const configuredResult = extractMethod(SOURCE, 'configuredResult');
  assert.match(resultCapture, /profile: this\.requireRunProfile\(\)/);
  assert.match(resultConstruction, /profile: this\.requireRunProfile\(\)/);
  assert.match(
    configuredResult,
    /pending\.mode !== pending\.profile\.mode[\s\S]*?profile: pending\.profile/,
  );
});

test('the discriminated cut driver selects Classic blade or type-2 Bird blade only', () => {
  assert.match(
    SOURCE,
    /type CrazyCutDriver =[\s\S]*?kind: 'standard'[\s\S]*?ClassicBladePresenter[\s\S]*?kind: 'bird'[\s\S]*?BirdBladePresenter[\s\S]*?BirdBladeRayAdapter/,
  );
  const create = extractMethod(SOURCE, 'createCorePresentation');
  assertOrderedSubstrings(create, [
    "if (profile.kind === 'crazy')",
    'ClassicBladePresenter.create({',
    "kind: 'standard'",
    'BirdBladePresenter.create({',
    'resources: this.requireCrazyBirdResources()',
    'BirdBladeRayAdapter.create<CrazyPhysicsRayHit>({',
    "kind: 'bird'",
  ]);

  const update = extractMethod(SOURCE, 'update');
  assert.match(
    update,
    /cutDriver\?\.kind === 'standard'[\s\S]*?presenter\.updateFrame\(\)[\s\S]*?cutDriver\?\.kind === 'bird'[\s\S]*?presenter\.update\(deltaSeconds\)/,
  );
  assert.doesNotMatch(SOURCE, /ClassicBird|BirdSpeed|create-bird-blade/);
});

test('Crazy Bird requests swish before its busy-state touch decision', () => {
  const touch = extractMemberBlock(
    SOURCE,
    '  private readonly onBirdBladeTouchBegan = (',
  );
  assertOrderedSubstrings(touch, [
    "driver?.kind !== 'bird'",
    'this.requireSwishAudio()',
    'swish.request(true, this.effectsEnabled())',
    'playOneShot(instruction.canonicalPath)',
    'driver.presenter.touch(event.point)',
  ]);
  assert.equal(countMatches(touch, /driver\.presenter\.touch\(/g), 1);
});

test('each Crazy Bird physics step consumes at most one cached ray through Crazy owners', () => {
  const physics = extractMemberBlock(
    SOURCE,
    '  private readonly onPhysicsStepped = (',
  );
  assert.match(
    physics,
    /driver\.kind === 'bird'[\s\S]*?!\('bladeSegments' in event\)/,
  );
  assert.equal(countMatches(physics, /processOneCachedRay\(/g), 1);
  assertOrderedSubstrings(physics, [
    'registry.size > 0 && cutEnabled',
    'driver.ray.processOneCachedRay',
    'this.applyBirdRaycastBatch(batch, registry)',
    'driver.presenter.acknowledgeCachedRay()',
    'registry.evaluateBounds(viewport)',
    'registry.updateDragonEffectsPhysics(viewport)',
  ]);

  const batch = extractMethod(SOURCE, 'applyBirdRaycastBatch');
  assertOrderedSubstrings(batch, [
    'registry.runRayQueryCutBatch(() =>',
    'batch.forwardHits.map',
    'batch.reverseHits.map',
    'createCutDispatchCommands(',
    "command.type === 'combo-check'",
    'this.requireCombo().checkCombo(command.position)',
    'registry.cut(command.targetId, command.segment)',
  ]);
});

test('Crazy Bird session commands reuse the Crazy graph with mode-specific boundaries', () => {
  const session = extractMemberBlock(
    SOURCE,
    '  private readonly onSessionCommand = (',
  );
  assert.match(
    session,
    /case 'enter-base-gameplay-layer':[\s\S]*?CRAZY_TIMED_PROFILE/,
  );
  assert.match(
    session,
    /case 'enter-base-bird-layer':[\s\S]*?CRAZY_BIRD_TIMED_PROFILE[\s\S]*?requireCutDriver\(\)\.kind !== 'bird'/,
  );
  assert.match(
    session,
    /case 'capture-crazy-parent':[\s\S]*?case 'capture-crazy-bird-parent':[\s\S]*?this\.captureCrazyForResult\(\)/,
  );
  assert.match(
    session,
    /case 'remove-crazy':[\s\S]*?case 'remove-crazy-bird':[\s\S]*?this\.detachCrazyForResult\(command\.cleanup\)/,
  );
  assert.match(
    session,
    /command\.key !== this\.requireRunProfile\(\)\.bestScoreKey/,
  );
});

test('Crazy Bird Result uses its own ranking, settings, navigation, and terminal events', () => {
  const attach = extractMethod(SOURCE, 'attachCrazyResult');
  assert.match(
    attach,
    /insertCrazyBirdResultScore\([\s\S]*?settings\.state\.birdCrazyLeaderboard/,
  );
  assert.match(
    attach,
    /crazyBirdLeaderboardPanelValues\(ranking\.leaderboard\)/,
  );

  const commit = extractMethod(SOURCE, 'commitCrazyResultTransition');
  assert.match(
    commit,
    /configured\.profile === CRAZY_BIRD_TIMED_PROFILE[\s\S]*?recordCrazyBirdResultScore\(configured\.score\)[\s\S]*?recordCrazyResultScore\(configured\.score\)/,
  );

  const retry = extractMethod(SOURCE, 'restartCrazyFromResult');
  assert.match(retry, /createCrazyBirdResultNavigationCommands\(/);
  assert.match(retry, /mode: CRAZY_BIRD_RESULT_MODE_ID/);
  assert.match(retry, /case 'construct-crazy-bird':/);
  assert.match(retry, /case 'attach-crazy-bird-to-captured-parent':/);

  const menu = extractMemberBlock(SOURCE, '  private readonly onResultMenu = ()');
  assert.match(menu, /createCrazyBirdResultNavigationCommands\(/);
  assert.match(menu, /route: 'main-menu'/);
  assert.match(
    menu,
    /command\.type === 'request-menu-button-audio'[\s\S]*?playOneShot\(command\.canonicalPath\)/,
  );
  assert.match(menu, /CRAZY_BIRD_RESULT_MENU_REQUESTED_EVENT/);

  const reward = extractMemberBlock(
    SOURCE,
    '  private readonly onResultTotalCoinsEntranceComplete = ()',
  );
  assert.match(reward, /awardCrazyBirdResultCoins\(configured\.score\)/);
  assert.match(reward, /CRAZY_BIRD_RESULT_REWARD_READY_EVENT/);
});

test('Crazy Bird public failures are distinct while shared observations remain shared', () => {
  for (const [name, value] of [
    ['CRAZY_BIRD_RESOURCE_LOAD_FAILED_EVENT', 'crazy-bird-resource-load-failed'],
    ['CRAZY_BIRD_PAUSE_QUIT_REQUESTED_EVENT', 'crazy-bird-pause-quit-requested'],
    ['CRAZY_BIRD_PAUSE_REPLAY_FAILED_EVENT', 'crazy-bird-pause-replay-failed'],
    ['CRAZY_BIRD_RESULT_MENU_REQUESTED_EVENT', 'crazy-bird-result-menu-requested'],
    ['CRAZY_BIRD_RESULT_RETRY_FAILED_EVENT', 'crazy-bird-result-retry-failed'],
    ['CRAZY_BIRD_RESULT_REWARD_READY_EVENT', 'crazy-bird-result-reward-ready'],
  ] as const) {
    assert.match(
      SOURCE,
      new RegExp(`${name}\\s*=\\s*'${value}'`),
    );
  }

  const load = extractMethod(SOURCE, 'onEnable');
  const unload = extractMethod(SOURCE, 'onDisable');
  assert.match(load, /BIRD_BLADE_TOUCH_BEGAN_EVENT/);
  assert.match(load, /CRAZY_BIRD_PHYSICS_STEPPED_EVENT/);
  assert.match(load, /CRAZY_BIRD_SESSION_COMMAND_EVENT/);
  assert.match(unload, /BIRD_BLADE_TOUCH_BEGAN_EVENT/);
  assert.match(unload, /CRAZY_BIRD_PHYSICS_STEPPED_EVENT/);
  assert.match(unload, /CRAZY_BIRD_SESSION_COMMAND_EVENT/);

  assert.match(SOURCE, /CRAZY_GAMEPLAY_COMMAND_EVENT/);
  assert.match(SOURCE, /CRAZY_GAMEPLAY_SNAPSHOT_EVENT/);
  assert.doesNotMatch(
    SOURCE,
    /CRAZY_BIRD_GAMEPLAY_COMMAND_EVENT|CRAZY_BIRD_GAMEPLAY_SNAPSHOT_EVENT/,
  );
});

function extractMethod(source: string, methodName: string): string {
  const signature = new RegExp(
    `^\\s*(?:private\\s+)?(?:async\\s+)?${methodName}\\b`,
    'm',
  );
  const match = signature.exec(source);
  assert.ok(match, `${methodName} method must exist`);
  return extractBalancedBlock(source, match.index);
}

function extractMemberBlock(source: string, signature: string): string {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `${signature} must exist`);
  return extractBalancedBlock(source, start);
}

function extractBalancedBlock(source: string, start: number): string {
  const openBrace = source.indexOf('{', start);
  assert.notEqual(openBrace, -1, 'member body must start');
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    const character = source[index];
    if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  throw new Error('member body is unterminated');
}

function assertOrderedSubstrings(source: string, values: readonly string[]): void {
  let previous = -1;
  for (const value of values) {
    const current = source.indexOf(value, previous + 1);
    assert.ok(current > previous, `${value} must appear in recovered order`);
    previous = current;
  }
}

function countMatches(source: string, pattern: RegExp): number {
  return [...source.matchAll(pattern)].length;
}
