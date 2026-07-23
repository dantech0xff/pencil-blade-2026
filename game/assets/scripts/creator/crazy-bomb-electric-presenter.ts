import {
  Node,
  Sprite,
  UITransform,
  isValid,
} from 'cc';

import {
  CRAZY_BOMB_ELECTRIC_ACTIVE_SECONDS,
  CRAZY_BOMB_ELECTRIC_ENTRY_SECONDS,
  CRAZY_BOMB_ELECTRIC_FRAME_SECONDS,
  CRAZY_ELECTRIC_EXPLOSION_AUDIO_PATH,
  CRAZY_ELECTRIC_POWER_UP_AUDIO_PATH,
} from '../domain/crazy-audio-contract';
import {
  CRAZY_SUPPLEMENTAL_RASTER_COUNT,
  getCrazySupplementalRasterSet,
} from '../domain/crazy-resource-contract';
import type { LoadedCrazyResources } from './crazy-resource-loader';
import type { LoadedGameRasterResource } from './game-resource-loader';

const ELECTRIC_FIELD_Z_ORDER = 1;
const ELECTRIC_NODE_Z_ORDER = 10;
const ELECTRIC_EXIT_SECONDS = Math.fround(1);
const EPSILON = 1e-7;

export interface CrazyBombElectricAudioPort {
  playElectricBackgroundMusic(): void;
  playOneShot(
    canonicalPath:
      | typeof CRAZY_ELECTRIC_EXPLOSION_AUDIO_PATH
      | typeof CRAZY_ELECTRIC_POWER_UP_AUDIO_PATH,
  ): void;
  stopBackgroundMusic(): void;
}

/** Type-safe replacement for the native listener's conflicting fixture-layout cast. */
export interface CrazyBombElectricSensorPort {
  readonly active: boolean;
  setActive(active: boolean): void;
}

export interface CrazyBombElectricVisibleRect {
  readonly height: number;
  readonly leftX: number;
  readonly rightX: number;
  readonly width: number;
}

export interface CrazyBombElectricPresenterInput {
  readonly effectsEnabled: () => boolean;
  /** Raw logical director height H; distinct from the visible span. */
  readonly logicalHeight: number;
  /** Raw logical director width W; distinct from VisibleRect width and origin. */
  readonly logicalWidth: number;
  readonly resources: LoadedCrazyResources;
  readonly visibleRect: CrazyBombElectricVisibleRect;
}

export interface CrazyBombElectricPresenterPorts {
  readonly audio: CrazyBombElectricAudioPort;
  readonly sensor: CrazyBombElectricSensorPort;
}

export interface CrazyBombElectricPresenterState {
  readonly activeElectricFieldCount: number;
  readonly attached: boolean;
  readonly currentFrameIndex: number | null;
  readonly disposed: boolean;
  readonly entryRemainingSeconds: number | null;
  readonly leftNodePosition: Readonly<{ x: number; y: number }>;
  readonly off: boolean;
  readonly rightNodePosition: Readonly<{ x: number; y: number }>;
  readonly sensorActive: boolean;
  readonly turnOffRemainingSeconds: number | null;
}

interface PresentedElectricField {
  elapsedSeconds: number;
  frameIndex: number;
  readonly node: Node;
  readonly sprite: Sprite;
}

interface NodeMotion {
  elapsedSeconds: number;
  readonly fromX: number;
  readonly toX: number;
}

/**
 * Recovered BombElectric visual/action owner.
 *
 * The regular path is exact: one-second crossing, eight-frame looping field at 15 fps,
 * fifteen-second powered window, immediate sensor removal, and one-second node exit. Native
 * delayed callbacks intentionally survive an early Stop; this presenter keeps that callback
 * behavior while replacing the unsafe contact cast with an explicit sensor port.
 */
export class CrazyBombElectricPresenter {
  readonly leftNode: Node;
  readonly rightNode: Node;
  readonly root: Node;

  private attachedValue = false;
  private backgroundMusicStartedValue = false;
  private currentField: PresentedElectricField | null = null;
  private disposedValue = false;
  private entryRemainingSecondsValue: number | null = null;
  private readonly fields = new Set<PresentedElectricField>();
  private leftMotion: NodeMotion | null = null;
  private offValue = true;
  private readonly pendingCleanupNodes = new Set<Node>();
  private readonly ports: CrazyBombElectricPresenterPorts;
  private readonly input: CrazyBombElectricPresenterInput;
  private rightMotion: NodeMotion | null = null;
  private sensorDeactivationPendingValue: boolean;
  private turnOffRemainingSecondsValue: number | null = null;
  private readonly verticalPosition: number;

  private constructor(
    input: CrazyBombElectricPresenterInput,
    ports: CrazyBombElectricPresenterPorts,
  ) {
    this.input = input;
    this.ports = ports;
    this.sensorDeactivationPendingValue = ports.sensor.active;
    const contracts = getCrazySupplementalRasterSet(input.resources.assetTree);
    this.verticalPosition = finiteFloat32(
      Math.fround(input.logicalHeight * 0.25),
      'Crazy BombElectric vertical position',
    );

    this.root = new Node('CrazyBombElectricRoot');
    this.root.active = false;
    const left = createRasterNode(
      'CrazyElectricLeftNode',
      input.resources.raster(contracts.electricLeftNode),
    );
    const right = createRasterNode(
      'CrazyElectricRightNode',
      input.resources.raster(contracts.electricRightNode),
    );
    left.node.setParent(this.root);
    left.node.setSiblingIndex(ELECTRIC_NODE_Z_ORDER);
    right.node.setParent(this.root);
    right.node.setSiblingIndex(ELECTRIC_NODE_Z_ORDER);
    this.leftNode = left.node;
    this.rightNode = right.node;
    this.resetNodePositions();
  }

  static create(
    input: CrazyBombElectricPresenterInput,
    ports: CrazyBombElectricPresenterPorts,
  ): CrazyBombElectricPresenter {
    const normalizedInput = normalizeInput(input);
    assertPorts(ports);
    return new CrazyBombElectricPresenter(normalizedInput, ports);
  }

  get state(): CrazyBombElectricPresenterState {
    const currentField = this.currentField;
    return Object.freeze({
      activeElectricFieldCount: this.fields.size,
      attached: this.attachedValue,
      currentFrameIndex: currentField?.frameIndex ?? null,
      disposed: this.disposedValue,
      entryRemainingSeconds: this.entryRemainingSecondsValue,
      leftNodePosition: freezeNodePosition(this.leftNode),
      off: this.offValue,
      rightNodePosition: freezeNodePosition(this.rightNode),
      sensorActive: this.ports.sensor.active,
      turnOffRemainingSeconds: this.turnOffRemainingSecondsValue,
    });
  }

  attach(parent: Node, zOrder: 1): void {
    // Crazy constructs this presenter under its detached mode root, then commits the complete
    // tree to the scene. The later start boundary verifies hierarchy attachment.
    if (!isValid(parent, true) || !parent.active) {
      throw new Error('Crazy BombElectric parent must be valid and active');
    }
    if (
      zOrder !== ELECTRIC_FIELD_Z_ORDER
      || this.disposedValue
      || this.attachedValue
      || this.root.parent !== null
    ) {
      throw new Error('Crazy BombElectric must attach once at recovered z-order 1');
    }
    this.root.layer = parent.layer;
    this.leftNode.layer = parent.layer;
    this.rightNode.layer = parent.layer;
    this.root.setParent(parent);
    this.root.setSiblingIndex(zOrder);
    this.attachedValue = true;
  }

  start(): void {
    this.assertUsable('start');
    const effectsEnabled = readEffectsEnabled(this.input.effectsEnabled);
    this.root.active = true;

    // Native Start stops actions on the owner and both endpoint nodes before rearming.
    this.entryRemainingSecondsValue = CRAZY_BOMB_ELECTRIC_ENTRY_SECONDS;
    this.turnOffRemainingSecondsValue = null;
    this.leftMotion = null;
    this.rightMotion = null;
    this.offValue = false;
    this.resetNodePositions();
    this.leftMotion = createMotion(
      this.leftNode.position.x,
      this.input.visibleRect.rightX + this.leftNodeWidth / 2,
    );
    this.rightMotion = createMotion(
      this.rightNode.position.x,
      this.input.visibleRect.leftX - this.rightNodeWidth / 2,
    );

    if (effectsEnabled) {
      this.ports.audio.playOneShot(CRAZY_ELECTRIC_POWER_UP_AUDIO_PATH);
    }
  }

  /**
   * Native Stop is guarded only by its off flag. It does not cancel a pending entry callback
   * or an already scheduled automatic turn-off.
   */
  stop(): boolean {
    this.assertUsable('stop');
    if (this.offValue) {
      return false;
    }
    this.turnOffElectric();
    return true;
  }

  updateAction(deltaSeconds: number): void {
    assertNonNegativeFinite(deltaSeconds, 'deltaSeconds');
    if (this.disposedValue || !this.attachedValue) {
      return;
    }

    let remaining = deltaSeconds;
    while (remaining > EPSILON) {
      const step = Math.min(
        remaining,
        this.entryRemainingSecondsValue ?? Number.POSITIVE_INFINITY,
        this.turnOffRemainingSecondsValue ?? Number.POSITIVE_INFINITY,
      );
      if (!Number.isFinite(step)) {
        this.advanceVisuals(remaining);
        return;
      }
      this.advanceVisuals(step);
      remaining -= step;

      if (this.entryRemainingSecondsValue !== null) {
        this.entryRemainingSecondsValue = Math.max(
          0,
          this.entryRemainingSecondsValue - step,
        );
      }
      if (this.turnOffRemainingSecondsValue !== null) {
        this.turnOffRemainingSecondsValue = Math.max(
          0,
          this.turnOffRemainingSecondsValue - step,
        );
      }

      let fired = false;
      if (
        this.entryRemainingSecondsValue !== null
        && this.entryRemainingSecondsValue <= EPSILON
      ) {
        this.entryRemainingSecondsValue = null;
        this.turnOnElectric();
        fired = true;
      }
      if (
        this.turnOffRemainingSecondsValue !== null
        && this.turnOffRemainingSecondsValue <= EPSILON
      ) {
        this.turnOffRemainingSecondsValue = null;
        this.turnOffElectric();
        fired = true;
      }
      if (!fired && step <= EPSILON) {
        break;
      }
    }
    if (remaining > 0) {
      this.advanceVisuals(remaining);
    }
  }

  dispose(): boolean {
    const firstDisposal = !this.disposedValue;
    if (firstDisposal) {
      this.disposedValue = true;
      this.attachedValue = false;
      this.offValue = true;
      this.entryRemainingSecondsValue = null;
      this.turnOffRemainingSecondsValue = null;
      this.leftMotion = null;
      this.rightMotion = null;
    }

    const failures: CleanupFailure[] = [];
    if (this.backgroundMusicStartedValue) {
      runCleanup(failures, 'stop owned electric background', () => {
        this.ports.audio.stopBackgroundMusic();
        this.backgroundMusicStartedValue = false;
      });
    }
    if (this.sensorDeactivationPendingValue) {
      runCleanup(failures, 'deactivate electric sensor', () => {
        this.ports.sensor.setActive(false);
        this.sensorDeactivationPendingValue = false;
      });
    }

    const fields = [...this.fields];
    this.fields.clear();
    this.currentField = null;
    for (const field of fields) {
      this.pendingCleanupNodes.add(field.node);
    }
    for (const node of [...this.pendingCleanupNodes]) {
      runCleanup(failures, `destroy ${node.name}`, () => {
        if (isValid(node, true)) {
          node.destroy();
        }
        this.pendingCleanupNodes.delete(node);
      });
    }
    if (isValid(this.root, true)) {
      runCleanup(failures, 'destroy BombElectric root', () => {
        this.root.destroy();
      });
    } else {
      this.pendingCleanupNodes.clear();
    }
    throwCleanupFailures('Crazy BombElectric dispose', failures);
    return firstDisposal;
  }

  private turnOnElectric(): void {
    const effectsEnabled = readEffectsEnabled(this.input.effectsEnabled);
    if (effectsEnabled) {
      this.ports.audio.playOneShot(CRAZY_ELECTRIC_EXPLOSION_AUDIO_PATH);
      this.backgroundMusicStartedValue = true;
      this.ports.audio.playElectricBackgroundMusic();
    }

    const contracts = getCrazySupplementalRasterSet(this.input.resources.assetTree);
    const firstFrame = this.input.resources.raster(contracts.electricFrames[0]);
    const fieldNode = createRasterNode('CrazyElectricField', firstFrame);
    fieldNode.node.layer = this.root.layer;
    fieldNode.node.setParent(this.root);
    fieldNode.node.setSiblingIndex(ELECTRIC_FIELD_Z_ORDER);
    this.leftNode.setSiblingIndex(ELECTRIC_NODE_Z_ORDER);
    this.rightNode.setSiblingIndex(ELECTRIC_NODE_Z_ORDER);
    fieldNode.node.setPosition(
      finiteFloat32(
        Math.fround(this.input.logicalWidth * 0.5),
        'Crazy electric field center x',
      ),
      this.verticalPosition,
      0,
    );
    const field: PresentedElectricField = {
      elapsedSeconds: 0,
      frameIndex: 0,
      node: fieldNode.node,
      sprite: fieldNode.sprite,
    };
    this.fields.add(field);
    this.currentField = field;
    this.turnOffRemainingSecondsValue = CRAZY_BOMB_ELECTRIC_ACTIVE_SECONDS;
    this.sensorDeactivationPendingValue = true;
    this.ports.sensor.setActive(true);
  }

  private turnOffElectric(): void {
    const failures: CleanupFailure[] = [];
    let effectsEnabled = false;
    runCleanup(failures, 'read current effects setting', () => {
      effectsEnabled = readEffectsEnabled(this.input.effectsEnabled);
    });
    this.offValue = true;

    this.leftMotion = createMotion(
      this.leftNode.position.x,
      finiteFloat32(
        this.input.visibleRect.leftX - this.leftNodeWidth,
        'Crazy electric left exit x',
      ),
    );
    this.rightMotion = createMotion(
      this.rightNode.position.x,
      finiteFloat32(
        this.input.visibleRect.rightX + this.rightNodeWidth,
        'Crazy electric right exit x',
      ),
    );

    if (effectsEnabled) {
      runCleanup(failures, 'stop gated electric background', () => {
        this.ports.audio.stopBackgroundMusic();
        this.backgroundMusicStartedValue = false;
      });
    }

    const currentField = this.currentField;
    if (currentField !== null) {
      this.fields.delete(currentField);
      this.currentField = null;
      let fieldDestroyed = false;
      runCleanup(failures, `destroy ${currentField.node.name}`, () => {
        if (isValid(currentField.node, true)) {
          currentField.node.destroy();
        }
        fieldDestroyed = true;
      });
      if (!fieldDestroyed) {
        this.pendingCleanupNodes.add(currentField.node);
      }
    }
    runCleanup(failures, 'deactivate electric sensor', () => {
      this.ports.sensor.setActive(false);
      this.sensorDeactivationPendingValue = false;
    });
    throwCleanupFailures('Crazy BombElectric turn-off', failures);
  }

  private advanceVisuals(deltaSeconds: number): void {
    this.leftMotion = advanceNodeMotion(
      this.leftNode,
      this.leftMotion,
      deltaSeconds,
    );
    this.rightMotion = advanceNodeMotion(
      this.rightNode,
      this.rightMotion,
      deltaSeconds,
    );

    const contracts = getCrazySupplementalRasterSet(this.input.resources.assetTree);
    for (const field of this.fields) {
      field.elapsedSeconds = Math.fround(field.elapsedSeconds + deltaSeconds);
      const frameIndex = Math.floor(
        field.elapsedSeconds / CRAZY_BOMB_ELECTRIC_FRAME_SECONDS,
      ) % contracts.electricFrames.length;
      if (frameIndex !== field.frameIndex) {
        const contract = contracts.electricFrames[frameIndex];
        if (contract === undefined) {
          throw new Error(`Crazy electric frame ${frameIndex} is missing`);
        }
        field.frameIndex = frameIndex;
        field.sprite.spriteFrame = this.input.resources.raster(contract).spriteFrame;
      }
    }
  }

  private resetNodePositions(): void {
    this.leftNode.setPosition(
      finiteFloat32(
        this.input.visibleRect.leftX - this.leftNodeWidth / 2,
        'Crazy electric left start x',
      ),
      this.verticalPosition,
      0,
    );
    this.rightNode.setPosition(
      finiteFloat32(
        this.input.visibleRect.rightX + this.rightNodeWidth / 2,
        'Crazy electric right start x',
      ),
      this.verticalPosition,
      0,
    );
  }

  private get leftNodeWidth(): number {
    return requireTransform(this.leftNode).contentSize.width;
  }

  private get rightNodeWidth(): number {
    return requireTransform(this.rightNode).contentSize.width;
  }

  private assertUsable(operation: string): void {
    if (
      this.disposedValue
      || !this.attachedValue
      || !isValid(this.root, true)
      || this.root.parent === null
      || !isValid(this.root.parent, true)
      || !this.root.parent.activeInHierarchy
    ) {
      throw new Error(
        `Crazy BombElectric must be attached in the active hierarchy to ${operation}`,
      );
    }
  }
}

function createRasterNode(
  name: string,
  resource: LoadedGameRasterResource,
): Readonly<{ readonly node: Node; readonly sprite: Sprite }> {
  const node = new Node(name);
  const transform = node.addComponent(UITransform);
  transform.setAnchorPoint(0.5, 0.5);
  transform.setContentSize(resource.dimensions.width, resource.dimensions.height);
  const sprite = node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = resource.spriteFrame;
  return Object.freeze({ node, sprite });
}

function createMotion(fromX: number, toX: number): NodeMotion {
  return {
    elapsedSeconds: 0,
    fromX: finiteFloat32(fromX, 'Crazy electric motion start x'),
    toX: finiteFloat32(toX, 'Crazy electric motion target x'),
  };
}

function advanceNodeMotion(
  node: Node,
  motion: NodeMotion | null,
  deltaSeconds: number,
): NodeMotion | null {
  if (motion === null) {
    return null;
  }
  motion.elapsedSeconds = Math.min(
    ELECTRIC_EXIT_SECONDS,
    motion.elapsedSeconds + deltaSeconds,
  );
  const progress = motion.elapsedSeconds / ELECTRIC_EXIT_SECONDS;
  node.setPosition(
    finiteFloat32(
      motion.fromX + (motion.toX - motion.fromX) * progress,
      'Crazy electric motion x',
    ),
    node.position.y,
    0,
  );
  return progress >= 1 ? null : motion;
}

function requireTransform(node: Node): UITransform {
  const transform = node.getComponent(UITransform);
  if (transform === null) {
    throw new Error(`${node.name} is missing its UITransform`);
  }
  return transform;
}

function freezeNodePosition(node: Node): Readonly<{ x: number; y: number }> {
  return Object.freeze({ x: node.position.x, y: node.position.y });
}

function normalizeInput(
  input: CrazyBombElectricPresenterInput,
): CrazyBombElectricPresenterInput {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Crazy BombElectric input must be an object');
  }
  if (
    input.resources === null
    || typeof input.resources !== 'object'
    || input.resources.rasterCount !== CRAZY_SUPPLEMENTAL_RASTER_COUNT
    || typeof input.resources.raster !== 'function'
  ) {
    throw new Error('Crazy BombElectric requires the complete Crazy resource catalog');
  }
  if (typeof input.effectsEnabled !== 'function') {
    throw new TypeError('effectsEnabled must be a function');
  }
  const logicalWidth = positiveFiniteFloat32(
    input.logicalWidth,
    'Crazy BombElectric logicalWidth',
  );
  const logicalHeight = positiveFiniteFloat32(
    input.logicalHeight,
    'Crazy BombElectric logicalHeight',
  );
  const visibleRect = input.visibleRect;
  if (
    visibleRect === null
    || typeof visibleRect !== 'object'
  ) {
    throw new TypeError('Crazy BombElectric visible rect must be an object');
  }
  const leftX = finiteFloat32(
    visibleRect.leftX,
    'Crazy BombElectric visibleRect.leftX',
  );
  const rightX = finiteFloat32(
    visibleRect.rightX,
    'Crazy BombElectric visibleRect.rightX',
  );
  const width = positiveFiniteFloat32(
    visibleRect.width,
    'Crazy BombElectric visibleRect.width',
  );
  const height = positiveFiniteFloat32(
    visibleRect.height,
    'Crazy BombElectric visibleRect.height',
  );
  const derivedRightX = finiteFloat32(
    leftX + width,
    'Crazy BombElectric visibleRect derived rightX',
  );
  if (rightX !== derivedRightX || rightX <= leftX) {
    throw new RangeError(
      'Crazy BombElectric visible rect rightX must equal float32 leftX + width',
    );
  }
  return Object.freeze({
    effectsEnabled: input.effectsEnabled,
    logicalHeight,
    logicalWidth,
    resources: input.resources,
    visibleRect: Object.freeze({ height, leftX, rightX, width }),
  });
}

function assertPorts(ports: CrazyBombElectricPresenterPorts): void {
  if (ports === null || typeof ports !== 'object' || Array.isArray(ports)) {
    throw new TypeError('Crazy BombElectric ports must be an object');
  }
  if (
    ports.audio === null
    || typeof ports.audio !== 'object'
    || typeof ports.audio.playOneShot !== 'function'
    || typeof ports.audio.playElectricBackgroundMusic !== 'function'
    || typeof ports.audio.stopBackgroundMusic !== 'function'
  ) {
    throw new TypeError('Crazy BombElectric audio port is incomplete');
  }
  if (
    ports.sensor === null
    || typeof ports.sensor !== 'object'
    || typeof ports.sensor.active !== 'boolean'
    || typeof ports.sensor.setActive !== 'function'
  ) {
    throw new TypeError('Crazy BombElectric sensor port is incomplete');
  }
}

function readEffectsEnabled(source: () => boolean): boolean {
  const value = source();
  if (typeof value !== 'boolean') {
    throw new TypeError('effectsEnabled() must return a boolean');
  }
  return value;
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be finite and non-negative`);
  }
}

interface CleanupFailure {
  readonly error: unknown;
  readonly operation: string;
}

function runCleanup(
  failures: CleanupFailure[],
  operation: string,
  cleanup: () => void,
): void {
  try {
    cleanup();
  } catch (error: unknown) {
    failures.push({ error, operation });
  }
}

function throwCleanupFailures(
  boundary: string,
  failures: readonly CleanupFailure[],
): void {
  if (failures.length === 0) {
    return;
  }
  throw new Error(
    `${boundary} completed with cleanup failures: ${failures.map((failure) => (
      `${failure.operation}: ${errorMessage(failure.error)}`
    )).join('; ')}`,
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function positiveFiniteFloat32(value: number, label: string): number {
  const floatValue = finiteFloat32(value, label);
  if (floatValue <= 0) {
    throw new RangeError(`${label} must be positive in float32`);
  }
  return floatValue;
}

function finiteFloat32(value: number, label: string): number {
  const floatValue = Math.fround(value);
  if (!Number.isFinite(value) || !Number.isFinite(floatValue)) {
    throw new RangeError(`${label} must be finite in float32`);
  }
  return floatValue;
}
