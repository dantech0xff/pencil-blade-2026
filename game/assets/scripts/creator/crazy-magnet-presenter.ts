import {
  Node,
  Sprite,
  UIOpacity,
  UITransform,
  isValid,
} from 'cc';

import {
  CRAZY_MAGNET_ACTIVE_SECONDS,
  CRAZY_MAGNET_ENTRY_SECONDS,
  CRAZY_MAGNET_EXIT_SECONDS,
  CRAZY_MAGNET_LOOP_AUDIO_PATH,
} from '../domain/crazy-audio-contract';
import type { GameplayRandom } from '../domain/gameplay-random';
import {
  CRAZY_SUPPLEMENTAL_RASTER_COUNT,
  getCrazySupplementalRasterSet,
} from '../domain/crazy-resource-contract';
import type {
  CrazyRetainedAudioHandle,
} from './crazy-audio-presenter';
import type { LoadedCrazyResources } from './crazy-resource-loader';
import type { LoadedGameRasterResource } from './game-resource-loader';

const MAGNET_Z_ORDER = 1;
const MAX_OPACITY = 255;
const INITIAL_LINE_FADE_OUT_SECONDS = Math.fround(0.5);
const FLICKER_DURATION_DIVISOR = Math.fround(100);
const EPSILON = 1e-7;

export interface CrazyMagnetAudioPort {
  playLoopingEffect(
    canonicalPath: typeof CRAZY_MAGNET_LOOP_AUDIO_PATH,
  ): CrazyRetainedAudioHandle;
}

export interface CrazyMagnetGameplayPort {
  onMagnetBegin(): void;
  onMagnetEnd(): void;
}

export interface CrazyMagnetPresenterInput {
  readonly centerX: number;
  readonly effectsEnabled: () => boolean;
  readonly random: GameplayRandom;
  readonly resources: LoadedCrazyResources;
  readonly topY: number;
}

export interface CrazyMagnetPresenterPorts {
  readonly audio: CrazyMagnetAudioPort;
  readonly gameplay: CrazyMagnetGameplayPort;
}

export type CrazyMagnetPhase =
  | 'detached'
  | 'entering'
  | 'active'
  | 'exiting'
  | 'disposed';

export interface CrazyMagnetPresenterState {
  readonly attached: boolean;
  readonly elapsedPhaseSeconds: number;
  readonly lineOpacity: number | null;
  readonly magnetPosition: Readonly<{ x: number; y: number }>;
  readonly phase: CrazyMagnetPhase;
  readonly retainedAudioPresent: boolean;
}

type FlickerDirection = 'fade-in' | 'fade-out';

interface PresentedRaster {
  readonly node: Node;
  readonly opacity: UIOpacity;
}

interface FlickerState {
  direction: FlickerDirection;
  durationSeconds: number;
  elapsedSeconds: number;
}

/**
 * Recovered 14.5-second MagnetAnimation.
 *
 * Gameplay callbacks own the exact Crazy toss-limit/pause behavior. This presenter owns the
 * two-second entry, 10.5-second active window, shared-RNG line flicker, retained effect loop,
 * immediate end callback, and two-second exit.
 */
export class CrazyMagnetPresenter {
  readonly magnet: PresentedRaster;
  readonly root: Node;

  private attachedValue = false;
  private elapsedPhaseSecondsValue = 0;
  private flicker: FlickerState | null = null;
  private readonly input: CrazyMagnetPresenterInput;
  private line: PresentedRaster | null = null;
  private phaseValue: CrazyMagnetPhase = 'detached';
  private readonly ports: CrazyMagnetPresenterPorts;
  private retainedAudio: CrazyRetainedAudioHandle | null = null;

  private constructor(
    input: CrazyMagnetPresenterInput,
    ports: CrazyMagnetPresenterPorts,
  ) {
    this.input = input;
    this.ports = ports;
    const contracts = getCrazySupplementalRasterSet(input.resources.assetTree);
    this.root = new Node('CrazyMagnetRoot');
    this.root.active = false;
    this.magnet = createRasterNode(
      'CrazyMagnet',
      input.resources.raster(contracts.magnet),
    );
    this.magnet.node.setParent(this.root);
    this.magnet.node.setPosition(
      input.centerX,
      input.topY + magnetHeight(this.magnet) / 2,
      0,
    );
  }

  static create(
    input: CrazyMagnetPresenterInput,
    ports: CrazyMagnetPresenterPorts,
  ): CrazyMagnetPresenter {
    assertInput(input);
    assertPorts(ports);
    return new CrazyMagnetPresenter(input, ports);
  }

  get state(): CrazyMagnetPresenterState {
    return Object.freeze({
      attached: this.attachedValue,
      elapsedPhaseSeconds: this.elapsedPhaseSecondsValue,
      lineOpacity: this.line?.opacity.opacity ?? null,
      magnetPosition: Object.freeze({
        x: this.magnet.node.position.x,
        y: this.magnet.node.position.y,
      }),
      phase: this.phaseValue,
      retainedAudioPresent: this.retainedAudio !== null,
    });
  }

  attach(parent: Node, zOrder: 1): void {
    if (!isValid(parent, true) || !parent.activeInHierarchy) {
      throw new Error('Crazy Magnet parent must be valid and active');
    }
    if (
      zOrder !== MAGNET_Z_ORDER
      || this.phaseValue !== 'detached'
      || this.attachedValue
      || this.root.parent !== null
    ) {
      throw new Error('Crazy Magnet must attach once at recovered z-order 1');
    }
    this.root.layer = parent.layer;
    this.magnet.node.layer = parent.layer;
    this.root.setParent(parent);
    this.root.setSiblingIndex(zOrder);
    this.root.active = true;
    this.attachedValue = true;
    this.phaseValue = 'entering';
    this.elapsedPhaseSecondsValue = 0;
  }

  updateAction(deltaSeconds: number): void {
    assertNonNegativeFinite(deltaSeconds, 'deltaSeconds');
    if (
      this.phaseValue === 'detached'
      || this.phaseValue === 'disposed'
      || deltaSeconds === 0
    ) {
      return;
    }

    let remaining = deltaSeconds;
    while (remaining > EPSILON) {
      const phase = this.currentPhase();
      switch (phase) {
        case 'entering':
          remaining = this.advanceEntering(remaining);
          break;
        case 'active':
          remaining = this.advanceActive(remaining);
          break;
        case 'exiting':
          remaining = this.advanceExiting(remaining);
          break;
        case 'detached':
        case 'disposed':
          return;
        default:
          assertNever(phase);
      }
    }
  }

  dispose(): boolean {
    if (this.phaseValue === 'disposed') {
      return false;
    }
    this.phaseValue = 'disposed';
    this.attachedValue = false;
    this.flicker = null;
    if (this.line !== null && isValid(this.line.node, true)) {
      this.line.node.destroy();
    }
    this.line = null;
    // Native visual disposal does not stop a retained effect. Crazy's finish boundary owns
    // stopAllEffects(), so intentionally leave the handle registered with the audio owner.
    this.retainedAudio = null;
    if (isValid(this.root, true)) {
      this.root.destroy();
    }
    return true;
  }

  private advanceEntering(availableSeconds: number): number {
    const consumed = Math.min(
      availableSeconds,
      CRAZY_MAGNET_ENTRY_SECONDS - this.elapsedPhaseSecondsValue,
    );
    this.elapsedPhaseSecondsValue += consumed;
    const initialY = this.input.topY + magnetHeight(this.magnet) / 2;
    const activeY = initialY - magnetHeight(this.magnet);
    const progress = this.elapsedPhaseSecondsValue / CRAZY_MAGNET_ENTRY_SECONDS;
    this.magnet.node.setPosition(
      this.input.centerX,
      lerp(initialY, activeY, progress),
      0,
    );

    if (this.elapsedPhaseSecondsValue + EPSILON >= CRAZY_MAGNET_ENTRY_SECONDS) {
      this.beginActivePhase();
    }
    return availableSeconds - consumed;
  }

  private currentPhase(): CrazyMagnetPhase {
    return this.phaseValue;
  }

  private beginActivePhase(): void {
    const effectsEnabled = readEffectsEnabled(this.input.effectsEnabled);
    const contracts = getCrazySupplementalRasterSet(this.input.resources.assetTree);
    const line = createRasterNode(
      'CrazyMagnetLine',
      this.input.resources.raster(contracts.magnetLine),
    );
    line.node.layer = this.root.layer;
    line.node.setParent(this.root);
    line.node.setPosition(
      this.magnet.node.position.x,
      this.magnet.node.position.y
        - magnetHeight(this.magnet) / 2
        - rasterHeight(line) / 2,
      0,
    );
    line.opacity.opacity = MAX_OPACITY;

    this.phaseValue = 'active';
    this.elapsedPhaseSecondsValue = 0;
    this.line = line;
    this.flicker = {
      direction: 'fade-out',
      durationSeconds: INITIAL_LINE_FADE_OUT_SECONDS,
      elapsedSeconds: 0,
    };
    if (effectsEnabled) {
      this.retainedAudio = this.ports.audio.playLoopingEffect(
        CRAZY_MAGNET_LOOP_AUDIO_PATH,
      );
    }
    this.ports.gameplay.onMagnetBegin();
  }

  private advanceActive(availableSeconds: number): number {
    const consumed = Math.min(
      availableSeconds,
      CRAZY_MAGNET_ACTIVE_SECONDS - this.elapsedPhaseSecondsValue,
    );
    this.elapsedPhaseSecondsValue += consumed;
    this.advanceFlicker(consumed);

    if (this.elapsedPhaseSecondsValue + EPSILON >= CRAZY_MAGNET_ACTIVE_SECONDS) {
      this.endActivePhase();
    }
    return availableSeconds - consumed;
  }

  private advanceFlicker(deltaSeconds: number): void {
    let remaining = deltaSeconds;
    while (remaining > EPSILON && this.flicker !== null && this.line !== null) {
      const available = this.flicker.durationSeconds - this.flicker.elapsedSeconds;
      const consumed = Math.min(remaining, available);
      this.flicker.elapsedSeconds += consumed;
      remaining -= consumed;
      const progress = this.flicker.durationSeconds === 0
        ? 1
        : this.flicker.elapsedSeconds / this.flicker.durationSeconds;
      this.line.opacity.opacity = this.flicker.direction === 'fade-out'
        ? MAX_OPACITY * (1 - progress)
        : MAX_OPACITY * progress;

      if (this.flicker.elapsedSeconds + EPSILON < this.flicker.durationSeconds) {
        break;
      }
      const durationHundredths = this.input.random.nextIntInclusive(50, 75);
      if (
        !Number.isSafeInteger(durationHundredths)
        || durationHundredths < 50
        || durationHundredths > 75
      ) {
        throw new RangeError('Magnet flicker RNG must return an integer from 50 through 75');
      }
      this.flicker = {
        direction: this.flicker.direction === 'fade-out' ? 'fade-in' : 'fade-out',
        durationSeconds: Math.fround(
          durationHundredths / FLICKER_DURATION_DIVISOR,
        ),
        elapsedSeconds: 0,
      };
    }
  }

  private endActivePhase(): void {
    const effectsEnabled = readEffectsEnabled(this.input.effectsEnabled);
    if (this.line !== null && isValid(this.line.node, true)) {
      this.line.node.destroy();
    }
    this.line = null;
    this.flicker = null;
    if (effectsEnabled) {
      // Safe target adaptation: native may read an uninitialized handle after a settings
      // toggle. Creator skips that invalid read while preserving the current effects gate.
      this.retainedAudio?.stop();
    }
    this.ports.gameplay.onMagnetEnd();
    this.phaseValue = 'exiting';
    this.elapsedPhaseSecondsValue = 0;
  }

  private advanceExiting(availableSeconds: number): number {
    const consumed = Math.min(
      availableSeconds,
      CRAZY_MAGNET_EXIT_SECONDS - this.elapsedPhaseSecondsValue,
    );
    this.elapsedPhaseSecondsValue += consumed;
    const activeY = this.input.topY - magnetHeight(this.magnet) / 2;
    const exitY = activeY + magnetHeight(this.magnet);
    const progress = this.elapsedPhaseSecondsValue / CRAZY_MAGNET_EXIT_SECONDS;
    this.magnet.node.setPosition(
      this.input.centerX,
      lerp(activeY, exitY, progress),
      0,
    );
    if (this.elapsedPhaseSecondsValue + EPSILON >= CRAZY_MAGNET_EXIT_SECONDS) {
      this.dispose();
    }
    return availableSeconds - consumed;
  }
}

function createRasterNode(
  name: string,
  resource: LoadedGameRasterResource,
): PresentedRaster {
  const node = new Node(name);
  const transform = node.addComponent(UITransform);
  transform.setAnchorPoint(0.5, 0.5);
  transform.setContentSize(resource.dimensions.width, resource.dimensions.height);
  const sprite = node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = resource.spriteFrame;
  const opacity = node.addComponent(UIOpacity);
  opacity.opacity = MAX_OPACITY;
  return Object.freeze({ node, opacity });
}

function magnetHeight(magnet: PresentedRaster): number {
  return rasterHeight(magnet);
}

function rasterHeight(presented: PresentedRaster): number {
  const transform = presented.node.getComponent(UITransform);
  if (transform === null) {
    throw new Error(`${presented.node.name} is missing its UITransform`);
  }
  return transform.contentSize.height;
}

function assertInput(input: CrazyMagnetPresenterInput): void {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Crazy Magnet input must be an object');
  }
  if (
    input.resources === null
    || typeof input.resources !== 'object'
    || input.resources.rasterCount !== CRAZY_SUPPLEMENTAL_RASTER_COUNT
    || typeof input.resources.raster !== 'function'
  ) {
    throw new Error('Crazy Magnet requires the complete Crazy resource catalog');
  }
  if (typeof input.effectsEnabled !== 'function') {
    throw new TypeError('Crazy Magnet effectsEnabled must be a function');
  }
  if (
    input.random === null
    || typeof input.random !== 'object'
    || typeof input.random.nextIntInclusive !== 'function'
  ) {
    throw new TypeError('Crazy Magnet requires GameplayRandom');
  }
  if (!Number.isFinite(input.centerX) || !Number.isFinite(input.topY)) {
    throw new RangeError('Crazy Magnet centerX and topY must be finite');
  }
}

function assertPorts(ports: CrazyMagnetPresenterPorts): void {
  if (ports === null || typeof ports !== 'object' || Array.isArray(ports)) {
    throw new TypeError('Crazy Magnet ports must be an object');
  }
  if (
    ports.audio === null
    || typeof ports.audio !== 'object'
    || typeof ports.audio.playLoopingEffect !== 'function'
  ) {
    throw new TypeError('Crazy Magnet audio port is incomplete');
  }
  if (
    ports.gameplay === null
    || typeof ports.gameplay !== 'object'
    || typeof ports.gameplay.onMagnetBegin !== 'function'
    || typeof ports.gameplay.onMagnetEnd !== 'function'
  ) {
    throw new TypeError('Crazy Magnet gameplay port is incomplete');
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

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * Math.min(1, Math.max(0, progress));
}

function assertNever(value: never): never {
  throw new Error(`unsupported Crazy Magnet phase ${String(value)}`);
}
