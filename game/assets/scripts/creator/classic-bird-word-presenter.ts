import {
  Node,
  Sprite,
  UITransform,
  isValid,
} from 'cc';

import {
  CLASSIC_BIRD_GAME_OVER_PRESENTATION,
  CLASSIC_BIRD_INTRO_PRESENTATION,
} from '../domain/classic-bird-session';
import type {
  LoadedClassicPresentationResources,
  LoadedClassicRasterResource,
} from './classic-resource-loader';

const EPSILON = 1e-7;
const RECOVERED_Z_ORDER = 1;

export type ClassicBirdWordPresentation = 'intro' | 'game-over';

export interface ClassicBirdWordViewport {
  readonly height: number;
  readonly width: number;
}

export interface ClassicBirdWordPresenterInput {
  readonly resources: LoadedClassicPresentationResources;
  readonly viewport: ClassicBirdWordViewport;
}

export interface ClassicBirdWordPresenterLifecycle {
  readonly onComplete: () => void;
}

export interface ClassicBirdWordPresenterState {
  readonly active: boolean;
  readonly attached: boolean;
  readonly complete: boolean;
  readonly disposed: boolean;
  readonly elapsedActionSeconds: number;
  readonly presentation: ClassicBirdWordPresentation;
}

interface WordTrack {
  readonly end: Readonly<{ x: number; y: number }>;
  readonly holdSeconds: number;
  readonly moveInSeconds: number;
  readonly moveOutSeconds: number;
  readonly node: Node;
  readonly start: Readonly<{ x: number; y: number }>;
  readonly target: Readonly<{ x: number; y: number }>;
}

/**
 * Manual action-clock presenter for BaseBird's simultaneous GOOD/LUCK and GAME/OVER words.
 *
 * The owner advances this clock only while the run is active. That keeps the recovered action
 * timing paused with the gameplay run without relying on global Creator tween state.
 */
export class ClassicBirdWordPresenter {
  readonly root: Node;

  private activeValue = false;
  private attachedValue = false;
  private completeValue = false;
  private disposedValue = false;
  private elapsedActionSecondsValue = 0;
  private readonly lifecycle: ClassicBirdWordPresenterLifecycle;
  private readonly presentationValue: ClassicBirdWordPresentation;
  private readonly totalActionSeconds: number;
  private readonly tracks: readonly WordTrack[];

  private constructor(
    input: ClassicBirdWordPresenterInput,
    lifecycle: ClassicBirdWordPresenterLifecycle,
    presentation: ClassicBirdWordPresentation,
  ) {
    this.lifecycle = lifecycle;
    this.presentationValue = presentation;
    this.totalActionSeconds = presentation === 'intro'
      ? CLASSIC_BIRD_INTRO_PRESENTATION.durationSeconds
      : CLASSIC_BIRD_GAME_OVER_PRESENTATION.durationSeconds;
    this.root = new Node(
      presentation === 'intro'
        ? 'ClassicBirdIntroRoot'
        : 'ClassicBirdGameOverRoot',
    );
    this.root.active = false;
    this.tracks = presentation === 'intro'
      ? createIntroTracks(this.root, input)
      : createGameOverTracks(this.root, input);
  }

  static createIntro(
    input: ClassicBirdWordPresenterInput,
    lifecycle: ClassicBirdWordPresenterLifecycle,
  ): ClassicBirdWordPresenter {
    assertInput(input);
    assertLifecycle(lifecycle);
    return new ClassicBirdWordPresenter(input, lifecycle, 'intro');
  }

  static createGameOver(
    input: ClassicBirdWordPresenterInput,
    lifecycle: ClassicBirdWordPresenterLifecycle,
  ): ClassicBirdWordPresenter {
    assertInput(input);
    assertLifecycle(lifecycle);
    return new ClassicBirdWordPresenter(input, lifecycle, 'game-over');
  }

  get state(): ClassicBirdWordPresenterState {
    return Object.freeze({
      active: this.activeValue,
      attached: this.attachedValue,
      complete: this.completeValue,
      disposed: this.disposedValue,
      elapsedActionSeconds: this.elapsedActionSecondsValue,
      presentation: this.presentationValue,
    });
  }

  attach(parent: Node): void {
    if (!isValid(parent, true) || !parent.active) {
      throw new Error('Classic Bird word parent must be valid and active');
    }
    if (this.disposedValue) {
      throw new Error('Disposed Classic Bird words cannot be attached');
    }
    if (this.attachedValue || this.root.parent !== null) {
      throw new Error('Classic Bird words are already attached');
    }
    this.root.layer = parent.layer;
    for (const track of this.tracks) {
      track.node.layer = parent.layer;
    }
    this.root.setParent(parent);
    this.root.setSiblingIndex(RECOVERED_Z_ORDER);
    this.attachedValue = true;
  }

  activate(): void {
    if (
      this.disposedValue
      || !this.attachedValue
      || this.root.parent === null
      || !isValid(this.root, true)
    ) {
      throw new Error('Classic Bird words must be attached before activation');
    }
    if (this.activeValue || this.completeValue) {
      throw new Error('Classic Bird words can activate only once');
    }
    this.activeValue = true;
    this.root.active = true;
    this.render();
  }

  updateAction(unscaledDeltaSeconds: number): void {
    assertNonNegativeFinite(unscaledDeltaSeconds, 'unscaledDeltaSeconds');
    if (this.disposedValue || !this.activeValue || this.completeValue) {
      return;
    }

    this.elapsedActionSecondsValue = Math.min(
      this.totalActionSeconds,
      this.elapsedActionSecondsValue + unscaledDeltaSeconds,
    );
    this.render();
    if (
      this.elapsedActionSecondsValue + EPSILON
      < this.totalActionSeconds
    ) {
      return;
    }

    this.elapsedActionSecondsValue = this.totalActionSeconds;
    this.completeValue = true;
    this.activeValue = false;
    if (this.presentationValue === 'intro') {
      for (const track of this.tracks) {
        if (isValid(track.node, true)) {
          track.node.destroy();
        }
      }
      this.root.active = false;
    }
    this.lifecycle.onComplete();
  }

  dispose(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.disposedValue = true;
    this.activeValue = false;
    this.attachedValue = false;
    if (isValid(this.root, true)) {
      this.root.destroy();
    }
    return true;
  }

  private render(): void {
    for (const track of this.tracks) {
      const position = trackPosition(track, this.elapsedActionSecondsValue);
      track.node.setPosition(position.x, position.y, 0);
    }
  }
}

function createIntroTracks(
  root: Node,
  input: ClassicBirdWordPresenterInput,
): readonly WordTrack[] {
  const { height, width } = input.viewport;
  const goodY = height * 0.025;
  const luckY = -height * 0.025;
  const outside = width * 0.75;
  return Object.freeze([
    createTrack(
      root,
      'ClassicBirdIntroGood',
      input.resources.introGood,
      frozenPoint(-outside, goodY),
      frozenPoint(0, goodY),
      frozenPoint(outside, goodY),
      CLASSIC_BIRD_INTRO_PRESENTATION.good.moveInSeconds,
      CLASSIC_BIRD_INTRO_PRESENTATION.good.holdSeconds,
      CLASSIC_BIRD_INTRO_PRESENTATION.good.moveOutSeconds,
    ),
    createTrack(
      root,
      'ClassicBirdIntroLuck',
      input.resources.introLuck,
      frozenPoint(outside, luckY),
      frozenPoint(0, luckY),
      frozenPoint(-outside, luckY),
      CLASSIC_BIRD_INTRO_PRESENTATION.luck.moveInSeconds,
      CLASSIC_BIRD_INTRO_PRESENTATION.luck.holdSeconds,
      CLASSIC_BIRD_INTRO_PRESENTATION.luck.moveOutSeconds,
    ),
  ]);
}

function createGameOverTracks(
  root: Node,
  input: ClassicBirdWordPresenterInput,
): readonly WordTrack[] {
  const { height, width } = input.viewport;
  const gameY = height * 0.075;
  const overY = -height * 0.075;
  return Object.freeze([
    createTrack(
      root,
      'ClassicBirdTerminalGame',
      input.resources.terminalGame,
      frozenPoint(0, height / 2 + input.resources.terminalGame.dimensions.height / 2),
      frozenPoint(0, gameY),
      frozenPoint(-width, gameY),
      CLASSIC_BIRD_GAME_OVER_PRESENTATION.game.moveInSeconds,
      CLASSIC_BIRD_GAME_OVER_PRESENTATION.game.holdSeconds,
      CLASSIC_BIRD_GAME_OVER_PRESENTATION.game.moveOutSeconds,
    ),
    createTrack(
      root,
      'ClassicBirdTerminalOver',
      input.resources.terminalOver,
      frozenPoint(0, -height / 2 - input.resources.terminalOver.dimensions.height / 2),
      frozenPoint(0, overY),
      frozenPoint(width, overY),
      CLASSIC_BIRD_GAME_OVER_PRESENTATION.over.moveInSeconds,
      CLASSIC_BIRD_GAME_OVER_PRESENTATION.over.holdSeconds,
      CLASSIC_BIRD_GAME_OVER_PRESENTATION.over.moveOutSeconds,
    ),
  ]);
}

function createTrack(
  root: Node,
  name: string,
  resource: LoadedClassicRasterResource,
  start: Readonly<{ x: number; y: number }>,
  target: Readonly<{ x: number; y: number }>,
  end: Readonly<{ x: number; y: number }>,
  moveInSeconds: number,
  holdSeconds: number,
  moveOutSeconds: number,
): WordTrack {
  const node = new Node(name);
  const transform = node.addComponent(UITransform);
  transform.setAnchorPoint(0.5, 0.5);
  transform.setContentSize(resource.dimensions.width, resource.dimensions.height);
  const sprite = node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = resource.spriteFrame;
  node.setParent(root);
  node.setSiblingIndex(RECOVERED_Z_ORDER);
  node.setPosition(start.x, start.y, 0);
  return Object.freeze({
    end,
    holdSeconds,
    moveInSeconds,
    moveOutSeconds,
    node,
    start,
    target,
  });
}

function trackPosition(
  track: WordTrack,
  elapsedActionSeconds: number,
): Readonly<{ x: number; y: number }> {
  if (elapsedActionSeconds <= track.moveInSeconds) {
    const progress = track.moveInSeconds === 0
      ? 1
      : elapsedActionSeconds / track.moveInSeconds;
    return lerpPoint(track.start, track.target, progress);
  }
  const holdEnd = track.moveInSeconds + track.holdSeconds;
  if (elapsedActionSeconds <= holdEnd) {
    return track.target;
  }
  const progress = track.moveOutSeconds === 0
    ? 1
    : Math.min(1, (elapsedActionSeconds - holdEnd) / track.moveOutSeconds);
  return lerpPoint(track.target, track.end, progress);
}

function assertInput(input: ClassicBirdWordPresenterInput): void {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('Classic Bird word input must be an object');
  }
  if (
    input.resources === null
    || typeof input.resources !== 'object'
  ) {
    throw new TypeError('Classic Bird words require presentation resources');
  }
  const requiredResources: readonly Readonly<{
    label: string;
    resource: LoadedClassicRasterResource;
  }>[] = Object.freeze([
    Object.freeze({ label: 'introGood', resource: input.resources.introGood }),
    Object.freeze({ label: 'introLuck', resource: input.resources.introLuck }),
    Object.freeze({ label: 'terminalGame', resource: input.resources.terminalGame }),
    Object.freeze({ label: 'terminalOver', resource: input.resources.terminalOver }),
  ]);
  for (const { label, resource } of requiredResources) {
    if (
      resource === null
      || typeof resource !== 'object'
      || typeof resource.canonicalPath !== 'string'
      || resource.spriteFrame === null
      || typeof resource.spriteFrame !== 'object'
    ) {
      throw new Error(`Classic Bird ${label} resource is unavailable`);
    }
  }
  assertPositiveFinite(input.viewport?.width, 'viewport.width');
  assertPositiveFinite(input.viewport?.height, 'viewport.height');
}

function assertLifecycle(lifecycle: ClassicBirdWordPresenterLifecycle): void {
  if (
    lifecycle === null
    || typeof lifecycle !== 'object'
    || typeof lifecycle.onComplete !== 'function'
  ) {
    throw new TypeError('Classic Bird word lifecycle must provide onComplete()');
  }
}

function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be finite and positive`);
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be finite and non-negative`);
  }
}

function frozenPoint(x: number, y: number): Readonly<{ x: number; y: number }> {
  return Object.freeze({ x, y });
}

function lerpPoint(
  start: Readonly<{ x: number; y: number }>,
  end: Readonly<{ x: number; y: number }>,
  progress: number,
): Readonly<{ x: number; y: number }> {
  return frozenPoint(
    start.x + (end.x - start.x) * progress,
    start.y + (end.y - start.y) * progress,
  );
}
