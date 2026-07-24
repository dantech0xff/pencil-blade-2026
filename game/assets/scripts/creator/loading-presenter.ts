import {
  Node,
  Sprite,
  UITransform,
  isValid,
} from 'cc';

import {
  createLoadingPresentation,
  type LoadingPresentation,
  type LoadingSpritePresentation,
  type LoadingViewport,
} from '../domain/loading-presentation';
import {
  LOADING_RASTER_RESOURCE_COUNT,
  type LoadingRasterResource,
} from '../domain/loading-resource-contract';
import {
  LoadingState,
  type LoadingFrameResult,
} from '../domain/loading-state';
import { createDetachedScreenRoot } from './detached-screen-root';
import type { LoadedGameRasterResource } from './game-resource-loader';
import type { LoadingAudioPreloadPort } from './loading-audio-preloader';
import type { LoadedLoadingResources } from './loading-resource-loader';

export interface LoadingPresenterInput {
  readonly audioPreloader: LoadingAudioPreloadPort;
  readonly canvas: Node;
  readonly resources: LoadedLoadingResources;
  readonly viewport: LoadingViewport;
}

export interface LoadingPresenterSnapshot extends LoadingFrameResult {
  readonly active: boolean;
  readonly disposed: boolean;
}

interface RuntimeLoadingSprite {
  readonly node: Node;
  readonly sprite: Sprite;
  readonly transform: UITransform;
}

interface RuntimeLoadingGraph {
  readonly backgroundLogo: RuntimeLoadingSprite;
  readonly barBack: RuntimeLoadingSprite;
  readonly barFront: RuntimeLoadingSprite;
  readonly progress: RuntimeLoadingSprite;
}

/** Shell-owned transient overlay for the recovered native `LoadingScene`. */
export class LoadingPresenter {
  readonly completion: Promise<void>;
  readonly failure: Promise<never>;
  readonly presentation: LoadingPresentation;
  readonly root: Node;

  private activeValue = false;
  private readonly canvas: Node;
  private completionResolved = false;
  private disposedValue = false;
  private failureSignaled = false;
  private readonly graph: RuntimeLoadingGraph;
  private readonly audioPreloader: LoadingAudioPreloadPort;
  private readonly resolveCompletion: () => void;
  private readonly rejectFailure: (error: Error) => void;
  private readonly state = new LoadingState();

  private constructor(input: LoadingPresenterInput) {
    this.audioPreloader = input.audioPreloader;
    this.canvas = input.canvas;
    this.presentation = createLoadingPresentation(
      input.resources.assetTree,
      input.viewport,
    );
    this.root = createDetachedScreenRoot('LoadingScene', input.canvas);
    this.root.active = false;

    let resolveCompletion: (() => void) | null = null;
    let rejectFailure: ((error: Error) => void) | null = null;
    this.completion = new Promise<void>((resolve) => {
      resolveCompletion = resolve;
    });
    this.failure = new Promise<never>((_resolve, reject) => {
      rejectFailure = reject;
    });
    // Keep a presenter-local rejection handler so an injected update failure can never become
    // an unhandled engine promise while the shell is between asynchronous boot boundaries.
    void this.failure.catch(() => undefined);
    if (resolveCompletion === null || rejectFailure === null) {
      throw new Error('Loading lifecycle promises did not initialize');
    }
    this.resolveCompletion = resolveCompletion;
    this.rejectFailure = rejectFailure;

    try {
      this.graph = constructRuntimeGraph(
        this.root,
        this.presentation,
        input.resources,
      );
    } catch (error) {
      if (isValid(this.root, true)) {
        this.root.destroy();
      }
      throw error;
    }
  }

  static create(input: LoadingPresenterInput): LoadingPresenter {
    assertInput(input);
    return new LoadingPresenter(input);
  }

  get snapshot(): LoadingPresenterSnapshot {
    return Object.freeze({
      ...this.state.snapshot,
      active: this.activeValue,
      disposed: this.disposedValue,
    });
  }

  activate(): void {
    if (this.disposedValue || !isValid(this.root, true)) {
      throw new Error('Disposed Loading presenter cannot activate');
    }
    if (this.activeValue || this.root.parent !== null) {
      throw new Error('Loading presenter can activate only once');
    }
    const canvas = this.requireCanvas();
    this.root.setParent(canvas, true);
    this.root.setSiblingIndex(canvas.children.length - 1);
    this.root.active = true;
    this.activeValue = true;
  }

  update(deltaSeconds: number): void {
    if (!this.activeValue || this.disposedValue) {
      return;
    }
    try {
      const frame = this.state.update(deltaSeconds);
      if (frame.preload !== null) {
        this.audioPreloader.preload(frame.preload);
      }
      this.graph.progress.sprite.fillRange = frame.progress;
      if (frame.finishedThisFrame) {
        this.finish();
      }
    } catch (error) {
      this.fail(error);
    }
  }

  dispose(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.disposedValue = true;
    this.activeValue = false;
    this.resolveCompletionOnce();
    if (isValid(this.root, true)) {
      this.root.active = false;
      this.root.destroy();
    }
    return true;
  }

  private finish(): void {
    this.activeValue = false;
    this.resolveCompletionOnce();
  }

  private fail(error: unknown): void {
    if (this.failureSignaled || this.disposedValue) {
      return;
    }
    this.failureSignaled = true;
    this.activeValue = false;
    this.rejectFailure(
      error instanceof Error
        ? error
        : new Error(`Loading update failed: ${String(error)}`),
    );
  }

  private resolveCompletionOnce(): void {
    if (this.completionResolved) {
      return;
    }
    this.completionResolved = true;
    this.resolveCompletion();
  }

  private requireCanvas(): Node {
    if (isValid(this.canvas, true) && this.canvas.activeInHierarchy) {
      return this.canvas;
    }
    throw new Error('Loading presenter lost its Canvas owner before activation');
  }
}

function constructRuntimeGraph(
  root: Node,
  presentation: LoadingPresentation,
  resources: LoadedLoadingResources,
): RuntimeLoadingGraph {
  const backgroundLogo = createAttachedRuntimeSprite(
    'backgroundLogo',
    presentation.backgroundLogo,
    resources,
    root,
  );
  const barBack = createAttachedRuntimeSprite(
    'loadbkback',
    presentation.barBack,
    resources,
    root,
  );
  const progress = createAttachedRuntimeSprite(
    'loadprocess',
    presentation.progress,
    resources,
    root,
    (runtime) => {
      runtime.sprite.type = Sprite.Type.FILLED;
      runtime.sprite.fillType = Sprite.FillType.HORIZONTAL;
      runtime.sprite.fillStart = 0;
      runtime.sprite.fillRange = 0;
    },
  );
  const barFront = createAttachedRuntimeSprite(
    'loadbkfront',
    presentation.barFront,
    resources,
    root,
  );

  if (
    root.children.length !== LOADING_RASTER_RESOURCE_COUNT
    || root.children[0] !== backgroundLogo.node
    || root.children[1] !== barBack.node
    || root.children[2] !== progress.node
    || root.children[3] !== barFront.node
  ) {
    throw new Error('Loading presenter must preserve the native four-sprite insertion order');
  }
  return Object.freeze({
    backgroundLogo,
    barBack,
    barFront,
    progress,
  });
}

function createAttachedRuntimeSprite(
  name: string,
  plan: LoadingSpritePresentation,
  resources: LoadedLoadingResources,
  root: Node,
  configure?: (runtime: RuntimeLoadingSprite) => void,
): RuntimeLoadingSprite {
  const runtime = createRuntimeSprite(name, plan, resources);
  try {
    configure?.(runtime);
    runtime.node.setWorldPosition(plan.position.x, plan.position.y, 0);
    attachPreservingWorld(runtime.node, root, plan.insertionIndex);
    return runtime;
  } catch (error) {
    if (isValid(runtime.node, true)) {
      runtime.node.destroy();
    }
    throw error;
  }
}

function createRuntimeSprite(
  name: string,
  plan: LoadingSpritePresentation,
  resources: LoadedLoadingResources,
): RuntimeLoadingSprite {
  const node = new Node(name);
  try {
    const resource = requireRaster(resources, plan.resource);
    const transform = node.addComponent(UITransform);
    transform.setAnchorPoint(plan.anchor.x, plan.anchor.y);
    transform.setContentSize(
      resource.dimensions.width,
      resource.dimensions.height,
    );
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.spriteFrame = resource.spriteFrame;
    return Object.freeze({ node, sprite, transform });
  } catch (error) {
    if (isValid(node, true)) {
      node.destroy();
    }
    throw error;
  }
}

function requireRaster(
  resources: LoadedLoadingResources,
  expected: LoadingRasterResource,
): LoadedGameRasterResource {
  const loaded = resources.raster(expected);
  if (
    loaded.canonicalPath !== expected.canonicalPath
    || loaded.dimensions.width !== expected.dimensions.width
    || loaded.dimensions.height !== expected.dimensions.height
    || !isValid(loaded.spriteFrame, true)
  ) {
    throw new Error(`Loading raster contract changed: ${expected.canonicalPath}`);
  }
  return loaded;
}

function attachPreservingWorld(
  node: Node,
  parent: Node,
  siblingIndex: number,
): void {
  node.layer = parent.layer;
  node.setParent(parent, true);
  node.setSiblingIndex(siblingIndex);
}

function assertInput(input: LoadingPresenterInput): void {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('Loading presenter input must be an object');
  }
  if (!isValid(input.canvas, true) || !input.canvas.activeInHierarchy) {
    throw new Error('Loading presenter requires a valid active Canvas');
  }
  if (
    input.audioPreloader === null
    || typeof input.audioPreloader !== 'object'
    || typeof input.audioPreloader.preload !== 'function'
  ) {
    throw new TypeError('Loading presenter requires an audio preload port');
  }
  if (
    input.resources === null
    || typeof input.resources !== 'object'
    || input.resources.rasterCount !== LOADING_RASTER_RESOURCE_COUNT
  ) {
    throw new Error('Loading presenter requires the exact four-raster catalog');
  }
}
