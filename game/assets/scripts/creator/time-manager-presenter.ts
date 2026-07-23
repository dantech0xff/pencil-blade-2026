import {
  Color,
  Label,
  Node,
  Sprite,
  UIOpacity,
  UITransform,
  isValid,
} from 'cc';

import type { Font } from 'cc';

import {
  assertGameAssetTree,
  createGameRaster,
  type GameAssetTree,
  type GameRasterResource,
} from '../domain/game-resource-contract';
import {
  TimeManagerService,
  createTimeManagerEntryPlan,
  createTimeManagerTimeUpPresentationPlan,
  type TimeManagerColor,
  type TimeManagerCommand,
  type TimeManagerEntryPlan,
  type TimeManagerSnapshot,
  type TimeManagerTimeUpPresentationPlan,
  type TimeManagerVisibleRect,
} from '../domain/time-manager-service';
import type { LoadedGameRasterResource } from './game-resource-loader';

const MAX_OPACITY = 255;

interface TimeManagerRasterContract {
  readonly freezeClock: GameRasterResource;
  readonly timeUp: GameRasterResource;
}

const TIME_MANAGER_RASTER_CONTRACTS: Readonly<
  Record<GameAssetTree, TimeManagerRasterContract>
> = Object.freeze({
  '480x800': Object.freeze({
    freezeClock: createGameRaster(
      '480x800/Interfaces/object-time-freeze.png',
      [148, 85],
    ),
    timeUp: createGameRaster('480x800/Text/text-time-up.png', [345, 135]),
  }),
  '720x1280': Object.freeze({
    freezeClock: createGameRaster(
      '720x1280/Interfaces/object-time-freeze.png',
      [222, 127],
    ),
    timeUp: createGameRaster('720x1280/Text/text-time-up.png', [481, 165]),
  }),
});

type TimeManagerAudioCommand = Extract<
  TimeManagerCommand,
  Readonly<{ type: 'request-audio' }>
>;

export type TimeManagerAudioPath = TimeManagerAudioCommand['canonicalPath'];

export interface TimeManagerAudioPort {
  playOneShot(canonicalPath: TimeManagerAudioPath): void;
}

export interface TimeManagerResourcePort {
  readonly assetTree: GameAssetTree;
  readonly freezeClock: LoadedGameRasterResource;
  readonly timeManagerFont: Font;
  readonly timeUp: LoadedGameRasterResource;
}

export interface TimeManagerPresenterInput {
  readonly effectsEnabled: () => boolean;
  readonly logicalHeight: number;
  readonly logicalWidth: number;
  readonly resources: TimeManagerResourcePort;
  readonly totalSeconds: number;
  readonly visibleRect: TimeManagerVisibleRect;
}

export interface TimeManagerPresenterPorts {
  readonly audio: TimeManagerAudioPort;
  readonly disableBonusType: (bonusType: 12) => void;
  readonly onFreezeFinish: () => void;
  readonly onFreezeStart: () => void;
  readonly onTimeUp: () => void;
  readonly onTimeUpFinish: () => void;
}

export interface PresentedTimeManagerLabel {
  readonly label: Label;
  readonly node: Node;
  readonly opacity: UIOpacity;
  readonly transform: UITransform;
}

export interface PresentedTimeManagerSprite {
  readonly node: Node;
  readonly opacity: UIOpacity;
  readonly sprite: Sprite;
  readonly transform: UITransform;
}

export interface TimeManagerPresenterState {
  readonly activated: boolean;
  readonly activeTimeUpPresentationCount: number;
  readonly attached: boolean;
  readonly disposed: boolean;
  readonly entryElapsedActionSeconds: number;
  readonly pendingTimeUpPresentationCount: number;
  readonly timeManager: TimeManagerSnapshot;
  readonly timeUpPresentationCount: number;
}

interface PreparedTimeManagerPresenterInput {
  readonly entryPlan: TimeManagerEntryPlan;
  readonly freezeClockResource: LoadedGameRasterResource;
  readonly timeUpPlan: TimeManagerTimeUpPresentationPlan;
  readonly timeUpResource: LoadedGameRasterResource;
}

interface ActiveTimeUpPresentation {
  completed: boolean;
  elapsedActionSeconds: number;
  finishing: boolean;
  readonly presented: PresentedTimeManagerSprite;
}

export class TimeManagerTimeUpDispatchError extends Error {
  readonly cause: unknown;
  readonly errors: readonly unknown[];

  constructor(failures: readonly unknown[]) {
    super(`Time Up dispatch failed: ${failures.map(errorMessage).join('; ')}`);
    this.name = 'TimeManagerTimeUpDispatchError';
    this.cause = failures[0];
    this.errors = Object.freeze([...failures]);
  }
}

/**
 * Creator presentation boundary for the recovered shared TimeManager.
 *
 * Construction is detached and inactive. Activation creates the recovered on-enter frame but
 * deliberately does not start the scheduler; Crazy starts it only after the GO callback.
 */
export class TimeManagerPresenter {
  readonly freezeClock: PresentedTimeManagerSprite;
  readonly root: Node;
  readonly timerLabel: PresentedTimeManagerLabel;

  private activatedValue = false;
  private attachedValue = false;
  private disposedValue = false;
  private entryElapsedActionSecondsValue = 0;
  private readonly entryPlan: TimeManagerEntryPlan;
  private readonly ports: TimeManagerPresenterPorts;
  private readonly service: TimeManagerService;
  private readonly timeUpPlan: TimeManagerTimeUpPresentationPlan;
  private readonly timeUpPresentations: ActiveTimeUpPresentation[] = [];
  private readonly timeUpResource: LoadedGameRasterResource;
  private pendingTimeUpPresentationCountValue = 0;
  private resumingTimeUpPresentationValue = false;

  private constructor(
    input: TimeManagerPresenterInput,
    ports: TimeManagerPresenterPorts,
    prepared: PreparedTimeManagerPresenterInput,
    service: TimeManagerService,
  ) {
    this.ports = ports;
    this.entryPlan = prepared.entryPlan;
    this.timeUpPlan = prepared.timeUpPlan;
    this.timeUpResource = prepared.timeUpResource;
    this.service = service;

    const root = new Node('TimeManagerRoot');
    root.active = false;
    let timerLabel: PresentedTimeManagerLabel | null = null;
    let freezeClock: PresentedTimeManagerSprite | null = null;
    try {
      timerLabel = createTimerLabel(input.resources, this.entryPlan);
      timerLabel.node.setParent(root);
      timerLabel.node.setPosition(
        this.entryPlan.label.worldPosition.x,
        this.entryPlan.label.worldPosition.y,
        0,
      );

      freezeClock = createSprite(
        'TimeManagerFreezeClock',
        prepared.freezeClockResource,
      );
      freezeClock.node.setParent(root);
      freezeClock.node.setPosition(
        this.entryPlan.freezeClock.worldPosition.x,
        this.entryPlan.freezeClock.worldPosition.y,
        0,
      );
      freezeClock.node.active = this.entryPlan.freezeClock.initialVisible;
    } catch (error) {
      if (freezeClock !== null && isValid(freezeClock.node, true)) {
        freezeClock.node.destroy();
      }
      if (timerLabel !== null && isValid(timerLabel.node, true)) {
        timerLabel.node.destroy();
      }
      if (isValid(root, true)) {
        root.destroy();
      }
      throw error;
    }

    this.root = root;
    this.timerLabel = timerLabel;
    this.freezeClock = freezeClock;
  }

  static create(
    input: TimeManagerPresenterInput,
    ports: TimeManagerPresenterPorts,
  ): TimeManagerPresenter {
    assertPorts(ports);
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
      throw new TypeError('input must be an object');
    }
    const service = new TimeManagerService({
      effectsEnabled: input.effectsEnabled,
      totalSeconds: input.totalSeconds,
    });
    const prepared = prepareInput(input, service.snapshot.remainingSeconds);
    return new TimeManagerPresenter(input, ports, prepared, service);
  }

  get isActivated(): boolean {
    return this.activatedValue;
  }

  get isAttached(): boolean {
    return this.attachedValue;
  }

  get isDisposed(): boolean {
    return this.disposedValue;
  }

  get state(): TimeManagerPresenterState {
    return Object.freeze({
      activated: this.activatedValue,
      activeTimeUpPresentationCount: this.timeUpPresentations.filter(
        ({ completed }) => !completed,
      ).length,
      attached: this.attachedValue,
      disposed: this.disposedValue,
      entryElapsedActionSeconds: this.entryElapsedActionSecondsValue,
      pendingTimeUpPresentationCount: this.pendingTimeUpPresentationCountValue,
      timeManager: this.service.snapshot,
      timeUpPresentationCount: this.timeUpPresentations.length,
    });
  }

  get timeUpSprites(): readonly PresentedTimeManagerSprite[] {
    return Object.freeze(this.timeUpPresentations.map(({ presented }) => presented));
  }

  attach(parent: Node, siblingIndex: number): void {
    if (!isValid(parent, true)) {
      throw new Error('TimeManager parent must be a valid Creator node');
    }
    if (!Number.isSafeInteger(siblingIndex) || siblingIndex < 0) {
      throw new RangeError('TimeManager siblingIndex must be a non-negative safe integer');
    }
    if (
      this.disposedValue
      || this.attachedValue
      || this.root.parent !== null
    ) {
      throw new Error('TimeManager presenter cannot attach from its current state');
    }

    try {
      applyLayerRecursively(this.root, parent.layer);
      this.root.setParent(parent, true);
      this.root.setSiblingIndex(siblingIndex);
      this.attachedValue = true;
    } catch (error) {
      if (this.root.parent !== null) {
        this.root.setParent(null, true);
      }
      throw error;
    }
  }

  activate(): void {
    if (this.disposedValue || !isValid(this.root, true)) {
      throw new Error('Disposed TimeManager presenter cannot activate');
    }
    if (this.activatedValue) {
      throw new Error('TimeManager presenter can activate only once');
    }
    if (
      !this.attachedValue
      || this.root.parent === null
      || !isValid(this.root.parent, true)
      || !this.root.parent.activeInHierarchy
    ) {
      throw new Error('TimeManager presenter must be host-attached before activation');
    }

    this.entryElapsedActionSecondsValue = 0;
    this.timerLabel.opacity.opacity = 0;
    this.timerLabel.node.active = true;
    this.freezeClock.node.active = this.entryPlan.freezeClock.initialVisible;
    this.root.active = true;
    this.activatedValue = true;
  }

  start(): void {
    this.assertActive('start');
    this.service.start();
  }

  stop(): void {
    this.assertActive('stop');
    this.service.stop();
  }

  restart(): void {
    this.assertActive('restart');
    this.service.restart();
  }

  freeze(): void {
    this.assertActive('freeze');
    this.dispatchCommands(this.service.freeze());
  }

  disableFreeze(): void {
    this.assertActive('disable freeze');
    this.dispatchCommands(this.service.disableFreeze());
  }

  /** Advances only the recovered TimeManager scheduler clock. */
  updateScheduler(unscaledDeltaSeconds: number): void {
    assertNonNegativeFinite(unscaledDeltaSeconds, 'unscaledDeltaSeconds');
    if (this.disposedValue) {
      return;
    }
    this.assertActive('update the scheduler');
    const commands = this.service.update(unscaledDeltaSeconds);
    if (commands.some(({ type }) => type === 'invoke-time-up')) {
      this.dispatchTimeUpCommands(commands);
      return;
    }
    this.dispatchCommands(commands);
  }

  /** Advances only label and Time Up actions; the host pause boundary controls this clock. */
  updateAction(unscaledDeltaSeconds: number): void {
    assertNonNegativeFinite(unscaledDeltaSeconds, 'unscaledDeltaSeconds');
    if (this.disposedValue) {
      return;
    }
    this.assertActive('update actions');
    this.resumeTimeUpPresentation();
    this.updateEntry(unscaledDeltaSeconds);
    this.updateTimeUpPresentations(unscaledDeltaSeconds);
  }

  /**
   * Retries only Time Up sprite creations that previously failed before attachment.
   *
   * The immediate Time Up callback is deliberately not replayed: Crazy commits its time-up
   * lifecycle before dispatching the callback's session commands, so a surfaced error does not
   * prove that re-entry is safe. Successful sprite creations are consumed before this returns,
   * making repeated recovery calls idempotent.
   */
  resumeTimeUpPresentation(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.assertActive('resume the Time Up presentation');
    if (
      this.pendingTimeUpPresentationCountValue === 0
      || this.resumingTimeUpPresentationValue
    ) {
      return false;
    }

    let resumed = false;
    this.resumingTimeUpPresentationValue = true;
    try {
      while (this.pendingTimeUpPresentationCountValue > 0) {
        this.beginTimeUpPresentation();
        this.pendingTimeUpPresentationCountValue -= 1;
        resumed = true;
      }
    } finally {
      this.resumingTimeUpPresentationValue = false;
    }
    return resumed;
  }

  /** Explicit teardown. Returns false after the first disposal. */
  dispose(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.disposedValue = true;
    this.activatedValue = false;
    this.attachedValue = false;
    this.service.stop();
    this.pendingTimeUpPresentationCountValue = 0;

    for (const presentation of this.timeUpPresentations) {
      if (isValid(presentation.presented.node, true)) {
        presentation.presented.node.destroy();
      }
    }
    this.timeUpPresentations.length = 0;
    for (const node of [this.freezeClock.node, this.timerLabel.node, this.root]) {
      if (isValid(node, true)) {
        node.destroy();
      }
    }
    return true;
  }

  private dispatchCommands(commands: readonly TimeManagerCommand[]): void {
    for (const command of commands) {
      // External callbacks can synchronously tear down the owning Crazy layer. Do not apply
      // later commands to destroyed Creator nodes after that explicit disposal boundary.
      if (this.disposedValue) {
        return;
      }
      this.dispatchCommand(command);
    }
  }

  private dispatchTimeUpCommands(commands: readonly TimeManagerCommand[]): void {
    const failures: unknown[] = [];
    for (const command of commands) {
      if (this.disposedValue) {
        break;
      }
      try {
        this.dispatchCommand(command);
      } catch (error) {
        // Creator construction is locally transactional: beginTimeUpPresentation() destroys
        // its unattached node before throwing. Retain only that safe suffix for retry. Audio
        // and the immediate Crazy callback are at-most-once because either can commit before
        // surfacing an error.
        if (command.type === 'begin-time-up-presentation') {
          this.pendingTimeUpPresentationCountValue += 1;
        }
        failures.push(error);
      }
    }
    throwTimeUpDispatchFailures(failures);
  }

  private dispatchCommand(command: TimeManagerCommand): void {
    switch (command.type) {
      case 'request-audio':
        this.ports.audio.playOneShot(command.canonicalPath);
        break;
      case 'set-timer-label-color':
        this.timerLabel.label.color = creatorColor(command.color);
        break;
      case 'set-timer-label-text':
        this.timerLabel.label.string = command.text;
        break;
      case 'invoke-time-up':
        this.ports.onTimeUp();
        break;
      case 'begin-time-up-presentation':
        this.beginTimeUpPresentation();
        break;
      case 'invoke-time-up-finish':
        this.ports.onTimeUpFinish();
        break;
      case 'set-freeze-clock-color':
        this.freezeClock.sprite.color = new Color(
          command.colorByte,
          command.colorByte,
          command.colorByte,
          MAX_OPACITY,
        );
        break;
      case 'set-freeze-clock-opacity':
        this.freezeClock.opacity.opacity = command.opacity;
        break;
      case 'invoke-freeze-start':
        this.ports.onFreezeStart();
        break;
      case 'invoke-freeze-finish':
        this.ports.onFreezeFinish();
        break;
      case 'set-freeze-clock-visible':
        this.freezeClock.node.active = command.visible;
        break;
      case 'disable-bonus-type':
        this.ports.disableBonusType(command.bonusType);
        break;
      default:
        assertNever(command);
    }
  }

  private beginTimeUpPresentation(): void {
    if (!isValid(this.root, true) || !this.activatedValue) {
      throw new Error('Time Up presentation requires an active TimeManager root');
    }
    const presented = createSprite('TimeManagerTimeUp', this.timeUpResource);
    try {
      presented.node.layer = this.root.layer;
      presented.node.setPosition(
        this.timeUpPlan.initialWorldPosition.x,
        this.timeUpPlan.initialWorldPosition.y,
        0,
      );
      presented.node.setParent(this.root);
      // Label, freeze clock, and every later Time Up sprite share recovered z-order 1.
      // Appending preserves the native equal-z creation order.
      presented.node.setSiblingIndex(this.root.children.length - 1);
      presented.node.active = true;
      this.timeUpPresentations.push({
        completed: false,
        elapsedActionSeconds: 0,
        finishing: false,
        presented,
      });
    } catch (error) {
      if (isValid(presented.node, true)) {
        presented.node.destroy();
      }
      throw error;
    }
  }

  private updateEntry(deltaSeconds: number): void {
    if (
      this.entryElapsedActionSecondsValue
      >= this.entryPlan.label.fadeInSeconds
    ) {
      return;
    }
    this.entryElapsedActionSecondsValue = Math.min(
      this.entryPlan.label.fadeInSeconds,
      this.entryElapsedActionSecondsValue + deltaSeconds,
    );
    this.timerLabel.opacity.opacity = MAX_OPACITY * (
      this.entryElapsedActionSecondsValue / this.entryPlan.label.fadeInSeconds
    );
  }

  private updateTimeUpPresentations(deltaSeconds: number): void {
    // A finish callback may reentrantly arm another expiry. That newly created action starts
    // after this host action tick and must not inherit the delta already being dispatched.
    for (const presentation of [...this.timeUpPresentations]) {
      if (presentation.completed || presentation.finishing || this.disposedValue) {
        continue;
      }
      presentation.elapsedActionSeconds = Math.min(
        this.timeUpPlan.totalActionSeconds,
        presentation.elapsedActionSeconds + deltaSeconds,
      );
      applyTimeUpPosition(presentation, this.timeUpPlan);
      if (
        presentation.elapsedActionSeconds
        >= this.timeUpPlan.totalActionSeconds
      ) {
        // Suppress synchronous re-entry while the callback runs, but commit completion only
        // after success. Crazy rolls a failed Result transition back to its Time Up boundary,
        // so a later action tick must be allowed to retry this callback.
        presentation.finishing = true;
        try {
          this.dispatchCommands(this.service.timeUpPresentationFinished());
          presentation.completed = true;
        } finally {
          presentation.finishing = false;
        }
      }
    }
  }

  private assertActive(action: string): void {
    if (this.disposedValue) {
      throw new Error(`Disposed TimeManager presenter cannot ${action}`);
    }
    if (!this.activatedValue) {
      throw new Error(`TimeManager presenter must be activated before it can ${action}`);
    }
  }
}

function prepareInput(
  input: TimeManagerPresenterInput,
  initialRemainingSeconds: number,
): PreparedTimeManagerPresenterInput {
  if (
    input.resources === null
    || typeof input.resources !== 'object'
    || Array.isArray(input.resources)
  ) {
    throw new TypeError('resources must implement the TimeManager resource port');
  }
  if (!isValid(input.resources.timeManagerFont, true)) {
    throw new Error('TimeManager font must be a valid loaded Creator Font');
  }

  assertGameAssetTree(input.resources.assetTree);
  const contracts = TIME_MANAGER_RASTER_CONTRACTS[input.resources.assetTree];
  const freezeClockResource = input.resources.freezeClock;
  const timeUpResource = input.resources.timeUp;
  assertLoadedRaster(
    freezeClockResource,
    contracts.freezeClock,
    'freezeClockResource',
  );
  assertLoadedRaster(timeUpResource, contracts.timeUp, 'timeUpResource');

  const entryPlan = createTimeManagerEntryPlan({
    freezeClockHeight: freezeClockResource.dimensions.height,
    freezeClockWidth: freezeClockResource.dimensions.width,
    initialRemainingSeconds,
    logicalHeight: input.logicalHeight,
    logicalWidth: input.logicalWidth,
    visibleRect: input.visibleRect,
  });
  const timeUpPlan = createTimeManagerTimeUpPresentationPlan({
    spriteHeight: timeUpResource.dimensions.height,
    spriteWidth: timeUpResource.dimensions.width,
    visibleRect: input.visibleRect,
  });
  return Object.freeze({
    entryPlan,
    freezeClockResource,
    timeUpPlan,
    timeUpResource,
  });
}

function createTimerLabel(
  resources: TimeManagerResourcePort,
  plan: TimeManagerEntryPlan,
): PresentedTimeManagerLabel {
  const node = new Node('TimeManagerCountdownLabel');
  try {
    const transform = node.addComponent(UITransform);
    transform.setAnchorPoint(0.5, 0.5);
    const label = node.addComponent(Label);
    label.font = resources.timeManagerFont;
    label.fontSize = plan.label.fontSize;
    label.lineHeight = plan.label.fontSize;
    label.string = plan.label.initialText;
    label.color = creatorColor(plan.label.color);
    const opacity = node.addComponent(UIOpacity);
    opacity.opacity = 0;
    return Object.freeze({ label, node, opacity, transform });
  } catch (error) {
    if (isValid(node, true)) {
      node.destroy();
    }
    throw error;
  }
}

function createSprite(
  name: string,
  resource: LoadedGameRasterResource,
): PresentedTimeManagerSprite {
  const node = new Node(name);
  try {
    node.active = false;
    const transform = node.addComponent(UITransform);
    transform.setContentSize(resource.dimensions.width, resource.dimensions.height);
    transform.setAnchorPoint(0.5, 0.5);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.spriteFrame = resource.spriteFrame;
    const opacity = node.addComponent(UIOpacity);
    return Object.freeze({ node, opacity, sprite, transform });
  } catch (error) {
    if (isValid(node, true)) {
      node.destroy();
    }
    throw error;
  }
}

function applyTimeUpPosition(
  presentation: ActiveTimeUpPresentation,
  plan: TimeManagerTimeUpPresentationPlan,
): void {
  const enter = plan.actionSequence[0];
  const delay = plan.actionSequence[1];
  const exit = plan.actionSequence[2];
  const elapsed = presentation.elapsedActionSeconds;
  const enterEnd = enter.durationSeconds;
  const delayEnd = enterEnd + delay.durationSeconds;
  const exitEnd = delayEnd + exit.durationSeconds;

  if (elapsed <= enterEnd) {
    const progress = elapsed / enter.durationSeconds;
    presentation.presented.node.setPosition(
      lerp(plan.initialWorldPosition.x, enter.position.x, progress),
      lerp(plan.initialWorldPosition.y, enter.position.y, progress),
      0,
    );
    return;
  }
  if (elapsed <= delayEnd) {
    presentation.presented.node.setPosition(
      enter.position.x,
      enter.position.y,
      0,
    );
    return;
  }
  const progress = Math.min(
    1,
    (elapsed - delayEnd) / (exitEnd - delayEnd),
  );
  presentation.presented.node.setPosition(
    lerp(enter.position.x, exit.position.x, progress),
    lerp(enter.position.y, exit.position.y, progress),
    0,
  );
}

function applyLayerRecursively(node: Node, layer: number): void {
  node.layer = layer;
  for (const child of node.children) {
    applyLayerRecursively(child, layer);
  }
}

function assertPorts(ports: TimeManagerPresenterPorts): void {
  if (ports === null || typeof ports !== 'object' || Array.isArray(ports)) {
    throw new TypeError('ports must be an object');
  }
  if (
    ports.audio === null
    || typeof ports.audio !== 'object'
    || typeof ports.audio.playOneShot !== 'function'
  ) {
    throw new TypeError('ports.audio.playOneShot must be a function');
  }
  for (const [name, callback] of [
    ['disableBonusType', ports.disableBonusType],
    ['onFreezeFinish', ports.onFreezeFinish],
    ['onFreezeStart', ports.onFreezeStart],
    ['onTimeUp', ports.onTimeUp],
    ['onTimeUpFinish', ports.onTimeUpFinish],
  ] as const) {
    if (typeof callback !== 'function') {
      throw new TypeError(`ports.${name} must be a function`);
    }
  }
}

function assertLoadedRaster(
  loaded: LoadedGameRasterResource,
  expected: Readonly<{
    readonly canonicalPath: string;
    readonly dimensions: Readonly<{ readonly height: number; readonly width: number }>;
  }>,
  label: string,
): void {
  if (loaded === null || typeof loaded !== 'object' || Array.isArray(loaded)) {
    throw new TypeError(`${label} must be a loaded raster`);
  }
  if (loaded.canonicalPath !== expected.canonicalPath) {
    throw new RangeError(`${label} must match the exact TimeManager raster contract`);
  }
  if (
    loaded.dimensions.width !== expected.dimensions.width
    || loaded.dimensions.height !== expected.dimensions.height
  ) {
    throw new RangeError(`${label} dimensions must match the exact TimeManager raster`);
  }
  if (!isValid(loaded.spriteFrame, true)) {
    throw new Error(`${label}.spriteFrame must be a valid loaded Creator SpriteFrame`);
  }
  const original = loaded.spriteFrame.originalSize;
  const rect = loaded.spriteFrame.rect;
  if (
    original.width !== expected.dimensions.width
    || original.height !== expected.dimensions.height
    || rect.width !== expected.dimensions.width
    || rect.height !== expected.dimensions.height
  ) {
    throw new RangeError(`${label}.spriteFrame must preserve exact untrimmed raster geometry`);
  }
}

function creatorColor(color: TimeManagerColor): Color {
  return new Color(color.red, color.green, color.blue, MAX_OPACITY);
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be finite and non-negative`);
  }
}

function throwTimeUpDispatchFailures(failures: readonly unknown[]): void {
  if (failures.length === 0) {
    return;
  }
  if (failures.length === 1) {
    throw failures[0];
  }
  throw new TimeManagerTimeUpDispatchError(failures);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function assertNever(value: never): never {
  throw new Error(`Unsupported TimeManager command: ${String(value)}`);
}
