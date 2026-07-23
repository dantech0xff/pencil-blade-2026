import { Node, isValid } from 'cc';

import { SharedBackgroundPresenter } from './shared-background-presenter';
import type { LoadedSharedGameSceneResources } from './shared-game-resource-loader';
import { SharedThemePresenter } from './shared-theme-presenter';

export interface SharedLeafPresenterHandle {
  readonly root: Node;
  dispose(): boolean;
}

export interface SharedLeafPresenterFactory {
  create(): SharedLeafPresenterHandle;
}

export interface SharedGameScenePresenterInput {
  readonly backgroundIndex: number;
  readonly leafFactory: SharedLeafPresenterFactory;
  readonly parent: Node;
  readonly resources: LoadedSharedGameSceneResources;
  readonly themeIndex: number;
}

export interface SharedGameSceneRoots {
  readonly background: Node;
  readonly leaf: Node;
  readonly theme: Node;
}

/** Persistent equal-z GameScene shell with explicit legacy insertion order. */
export class SharedGameScenePresenter {
  readonly background: SharedBackgroundPresenter;
  readonly leaf: SharedLeafPresenterHandle;
  readonly theme: SharedThemePresenter;

  private currentScreenValue: Node | null = null;
  private disposedValue = false;
  private readonly parent: Node;

  private constructor(input: SharedGameScenePresenterInput) {
    this.parent = input.parent;
    this.background = SharedBackgroundPresenter.create(
      input.resources.backgrounds,
      input.backgroundIndex,
    );
    this.leaf = input.leafFactory.create();
    this.theme = SharedThemePresenter.create(input.resources.themes, input.themeIndex);
    assertDetachedLeaf(this.leaf);

    try {
      this.background.attach(this.parent, 0);
      attachSharedLeafRoot(this.leaf.root, this.parent, 1);
      this.theme.attach(this.parent, 2);
      this.enforceSharedOrder();
    } catch (error) {
      this.theme.dispose();
      this.leaf.dispose();
      this.background.dispose();
      throw error;
    }
  }

  static create(input: SharedGameScenePresenterInput): SharedGameScenePresenter {
    assertInput(input);
    return new SharedGameScenePresenter(input);
  }

  get roots(): SharedGameSceneRoots {
    return Object.freeze({
      background: this.background.root,
      leaf: this.leaf.root,
      theme: this.theme.root,
    });
  }

  get currentScreen(): Node | null {
    return this.currentScreenValue;
  }

  get disposed(): boolean {
    return this.disposedValue;
  }

  attachCurrentScreen(screen: Node): void {
    this.assertUsable('attach a current screen');
    assertDetachedScreen(screen);
    if (this.currentScreenValue !== null) {
      throw new Error('Shared GameScene already owns a current screen');
    }
    try {
      attachRoot(screen, this.parent, 3, 'current screen');
      this.currentScreenValue = screen;
      this.enforceSharedOrder();
    } catch (error) {
      if (screen.parent === this.parent) {
        screen.setParent(null, true);
      }
      this.currentScreenValue = null;
      throw error;
    }
  }

  detachCurrentScreen(expectedScreen?: Node): Node {
    this.assertUsable('detach the current screen');
    const screen = this.currentScreenValue;
    if (screen === null) {
      throw new Error('Shared GameScene has no current screen to detach');
    }
    if (expectedScreen !== undefined && expectedScreen !== screen) {
      throw new Error('Current-screen identity changed before detach');
    }
    try {
      screen.setParent(null, true);
    } catch (error) {
      if (screen.parent === null) {
        attachRoot(screen, this.parent, 3, 'rollback failed current-screen detach');
      }
      this.currentScreenValue = screen;
      this.enforceSharedOrder();
      throw error;
    }
    this.currentScreenValue = null;
    return screen;
  }

  replaceCurrentScreen(nextScreen: Node): Node {
    this.assertUsable('replace the current screen');
    assertDetachedScreen(nextScreen);
    const previous = this.currentScreenValue;
    if (previous === null) {
      throw new Error('Shared GameScene has no current screen to replace');
    }
    this.detachCurrentScreen(previous);
    try {
      this.attachCurrentScreen(nextScreen);
      return previous;
    } catch (error) {
      this.attachCurrentScreen(previous);
      throw error;
    }
  }

  dispose(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.disposedValue = true;
    if (this.currentScreenValue !== null && isValid(this.currentScreenValue, true)) {
      this.currentScreenValue.destroy();
    }
    this.currentScreenValue = null;
    this.theme.dispose();
    this.leaf.dispose();
    this.background.dispose();
    return true;
  }

  private enforceSharedOrder(): void {
    this.background.root.setSiblingIndex(0);
    this.leaf.root.setSiblingIndex(1);
    this.theme.root.setSiblingIndex(2);
    this.currentScreenValue?.setSiblingIndex(3);
  }

  private assertUsable(action: string): void {
    if (this.disposedValue || !isValid(this.parent, true)) {
      throw new Error(`Disposed shared GameScene cannot ${action}`);
    }
  }
}

function assertInput(input: SharedGameScenePresenterInput): void {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('Shared GameScene input must be an object');
  }
  if (!isValid(input.parent, true) || !input.parent.active) {
    throw new Error('Shared GameScene parent must be valid and active');
  }
  if (
    input.leafFactory === null
    || typeof input.leafFactory !== 'object'
    || typeof input.leafFactory.create !== 'function'
  ) {
    throw new TypeError('Shared GameScene requires a leaf presenter factory');
  }
  if (input.resources === null || typeof input.resources !== 'object') {
    throw new TypeError('Shared GameScene resources must be an object');
  }
}

function assertDetachedLeaf(leaf: SharedLeafPresenterHandle): void {
  if (
    leaf === null
    || typeof leaf !== 'object'
    || !isValid(leaf.root, true)
    || leaf.root.parent !== null
    || typeof leaf.dispose !== 'function'
  ) {
    throw new Error('Shared leaf factory must return a valid detached presenter handle');
  }
}

function assertDetachedScreen(screen: Node): void {
  if (!isValid(screen, true) || screen.parent !== null) {
    throw new Error('Current screen must be a valid detached Creator node');
  }
}

function attachRoot(root: Node, parent: Node, siblingIndex: number, label: string): void {
  if (!isValid(root, true) || root.parent !== null) {
    throw new Error(`${label} root must be valid and detached`);
  }
  applyLayerRecursively(root, parent.layer);
  root.setParent(parent, true);
  root.setSiblingIndex(siblingIndex);
}

function attachSharedLeafRoot(root: Node, parent: Node, siblingIndex: number): void {
  if (!isValid(root, true) || root.parent !== null) {
    throw new Error('shared leaf root must be valid and detached');
  }
  applyLayerRecursively(root, parent.layer);
  // Shared visual roots are authored at the Canvas-local origin. Unlike staged current
  // screens, they inherit the parent transform instead of preserving detached world zero.
  root.setParent(parent);
  root.setSiblingIndex(siblingIndex);
}

function applyLayerRecursively(root: Node, layer: number): void {
  root.layer = layer;
  for (const child of root.children) {
    applyLayerRecursively(child, layer);
  }
}
