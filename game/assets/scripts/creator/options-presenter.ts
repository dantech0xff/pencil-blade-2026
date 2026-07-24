import {
  EventKeyboard,
  Input,
  KeyCode,
  Label,
  Node,
  Sprite,
  UIOpacity,
  UITransform,
  input as cocosInput,
  isValid,
} from 'cc';

import {
  OPTIONS_THEME_REVEAL_AT_SECONDS,
  createOptionsPresentation,
  type OptionsPoint,
  type OptionsPresentationSnapshot,
  type OptionsRowKind,
  type OptionsRowPresentation,
  type OptionsViewport,
} from '../domain/options-presentation';
import {
  OPTIONS_BACKGROUND_COUNT,
  OptionsState,
  type OptionsPurchaseParticleRandom,
  type OptionsStateSnapshot,
} from '../domain/options-state';
import {
  OPTIONS_RASTER_RESOURCE_COUNT,
  getOptionsRasterResources,
} from '../domain/options-resource-contract';
import { createDetachedScreenRoot } from './detached-screen-root';
import type { LoadedGameRasterResource } from './game-resource-loader';
import {
  OptionsItemSelectorPresenter,
  type OptionsSelectorFramePair,
} from './options-item-selector-presenter';
import {
  OptionsPurchaseParticlePresenter,
} from './options-purchase-particle-presenter';
import type { LoadedOptionsResources } from './options-resource-loader';

const MAX_OPACITY = 255;
const OPTIONS_COMPATIBLE_SAVED_BACKGROUND_MAXIMUM = 8;
const OPTIONS_FINAL_ENTRY_ACTION_SECONDS = Math.fround(
  OPTIONS_THEME_REVEAL_AT_SECONDS + Math.fround(0.25),
);
const OPTIONS_ROW_KINDS = Object.freeze([
  'background',
  'blade',
  'theme',
] as const);

export interface OptionsAudioPort {
  playOneShot(canonicalPath: string): void;
}

export interface OptionsSettingsSnapshot {
  readonly effectsEnabled: boolean;
  readonly selectedBackground: number;
  readonly selectedBlade: number;
  readonly selectedTheme: number;
  readonly totalCoins: number;
}

export interface OptionsSettingsStatePort {
  readonly backgroundPrices: readonly number[];
  readonly bladePrices: readonly number[];
  readonly snapshot: OptionsSettingsSnapshot;
  setSelectedBackground(index: number): void;
  setSelectedBlade(index: number): void;
  setSelectedTheme(index: number): void;
}

export type OptionsSettingsPurchaseResult =
  | Readonly<{
      readonly index: number;
      readonly kind: 'already-owned';
      readonly price: 0;
      readonly totalCoins: number;
    }>
  | Readonly<{
      readonly index: number;
      readonly kind: 'insufficient-coins';
      readonly price: number;
      readonly totalCoins: number;
    }>
  | Readonly<{
      readonly index: number;
      readonly kind: 'purchased';
      readonly price: number;
      readonly totalCoins: number;
    }>;

export interface OptionsSettingsPort {
  readonly state: OptionsSettingsStatePort;
  purchaseBackgroundWithCoins(index: number): OptionsSettingsPurchaseResult;
  purchaseBladeWithCoins(index: number): OptionsSettingsPurchaseResult;
}

/**
 * Process-owned background and theme presenters adapted by the app shell.
 *
 * The getters deliberately stay live: a screen transaction can verify the persistent
 * presenters without relying on values copied when Options was constructed.
 */
export interface OptionsSharedCosmeticsPort {
  readonly currentBackgroundIndex: number;
  readonly currentThemeIndex: number;
  selectBackground(index: number): void;
  selectTheme(index: number): void;
}

export interface OptionsNavigationTransaction {
  readonly destination: 'MainMenuLayer';
  readonly root: Node;
  readonly timing: 'immediate';
  readonly zOrder: 1;
}

export interface OptionsPresenterLifecycle {
  /** `false` reports a rejected or rolled-back host transaction; `void` means success. */
  onMainMenuRequested(transaction: OptionsNavigationTransaction): boolean | void;
}

export interface OptionsPresenterInput {
  readonly audio: OptionsAudioPort;
  readonly canvas: Node;
  readonly lifecycle: OptionsPresenterLifecycle;
  readonly random: OptionsPurchaseParticleRandom;
  readonly resources: LoadedOptionsResources;
  readonly settings: OptionsSettingsPort;
  readonly sharedCosmetics: OptionsSharedCosmeticsPort;
  readonly viewport: OptionsViewport;
}

export interface OptionsPresenterState {
  readonly activated: boolean;
  /**
   * A valid shared background index `8` has no recovered Options thumbnail or price.
   * The local selector is seeded at `0`, while Settings/shared presentation remain at `8`
   * until the user makes a background selection.
   */
  readonly backgroundSelectionOutsideOptions: boolean;
  readonly disposed: boolean;
  readonly entryElapsedSeconds: number;
  readonly model: OptionsStateSnapshot;
  readonly navigationPending: boolean;
  readonly purchaseBurstCount: number;
  readonly revealedRows: readonly OptionsRowKind[];
  readonly suspended: boolean;
}

export class OptionsCleanupError extends Error {
  readonly causes: readonly unknown[];

  constructor(message: string, causes: readonly unknown[]) {
    super(`${message}: ${causes.length} failure${causes.length === 1 ? '' : 's'}`);
    this.name = 'OptionsCleanupError';
    this.causes = Object.freeze([...causes]);
  }
}

interface RuntimeSprite {
  readonly node: Node;
  readonly opacity: UIOpacity;
  readonly sprite: Sprite;
  readonly transform: UITransform;
}

interface RuntimeButton {
  readonly node: Node;
  readonly normal: LoadedGameRasterResource;
  readonly selected: LoadedGameRasterResource;
  readonly sprite: Sprite;
  readonly transform: UITransform;
}

interface RuntimePurchaseControl {
  readonly button: RuntimeButton;
  readonly cancel: () => void;
  readonly category: 'background' | 'blade';
  readonly end: () => void;
  listenersRegistered: boolean;
  readonly menu: Node;
  readonly priceLabel: Label;
  readonly start: () => void;
}

interface RuntimeRow {
  readonly header: RuntimeSprite;
  readonly kind: OptionsRowKind;
  readonly presentation: OptionsRowPresentation;
  readonly purchase: RuntimePurchaseControl | null;
  revealed: boolean;
  readonly selector: OptionsItemSelectorPresenter;
}

/** Detached, activation-gated Creator presenter for the recovered chained Options screen. */
export class OptionsPresenter {
  readonly presentation: OptionsPresentationSnapshot;
  readonly root: Node;
  readonly selectors: Readonly<{
    readonly background: OptionsItemSelectorPresenter;
    readonly blade: OptionsItemSelectorPresenter;
    readonly theme: OptionsItemSelectorPresenter;
  }>;

  private activatedValue = false;
  private readonly backControl: RuntimeButton;
  private backgroundSelectionOutsideOptionsValue: boolean;
  private readonly coinLabel: Label;
  private readonly coinLabelNode: Node;
  private readonly coinLabelOpacity: UIOpacity;
  private readonly coinPanelNode: Node;
  private readonly coinPanelOpacity: UIOpacity;
  private disposedValue = false;
  private entryElapsedSecondsValue = 0;
  private readonly input: OptionsPresenterInput;
  private listenersRegistered = false;
  private model: OptionsState;
  private navigationPendingValue = false;
  private readonly purchaseBursts: OptionsPurchaseParticlePresenter[] = [];
  private readonly rows: Readonly<Record<OptionsRowKind, RuntimeRow>>;
  private suspendedValue = false;
  private readonly titleNode: Node;

  private constructor(input: OptionsPresenterInput) {
    this.input = input;
    const settings = readSettings(input.settings.state);
    const localBackground = settings.snapshot.selectedBackground < OPTIONS_BACKGROUND_COUNT
      ? settings.snapshot.selectedBackground
      : 0;
    this.backgroundSelectionOutsideOptionsValue
      = settings.snapshot.selectedBackground >= OPTIONS_BACKGROUND_COUNT;
    this.model = new OptionsState({
      backgroundPrices: settings.backgroundPrices,
      bladePrices: settings.bladePrices,
      selectedBackground: localBackground,
      selectedBlade: settings.snapshot.selectedBlade,
      selectedTheme: settings.snapshot.selectedTheme,
      totalCoins: settings.snapshot.totalCoins,
    });
    this.presentation = createOptionsPresentation(
      input.resources.assetTree,
      input.viewport,
      settings.snapshot.totalCoins,
      this.model.snapshot,
    );
    this.root = createDetachedScreenRoot('OptionsRoot', input.canvas);
    this.root.active = false;

    const constructedRows: RuntimeRow[] = [];
    let rows: Readonly<Record<OptionsRowKind, RuntimeRow>> | null = null;
    try {
      const title = createSpriteNode(
        'title',
        input.resources.raster(this.presentation.title.resource),
        this.presentation.title.anchor,
        MAX_OPACITY,
      );
      title.node.setWorldPosition(
        this.presentation.title.initialPosition.x,
        this.presentation.title.initialPosition.y,
        0,
      );
      attachPreservingWorld(
        title.node,
        this.root,
        this.presentation.title.attachmentInsertion - 1,
      );
      this.titleNode = title.node;

      const coinPanel = createSpriteNode(
        'total-coins-panel',
        input.resources.raster(this.presentation.coins.panel.resource),
        this.presentation.coins.panel.anchor,
        0,
      );
      coinPanel.node.setWorldPosition(
        this.presentation.coins.panel.initialPosition.x,
        this.presentation.coins.panel.initialPosition.y,
        0,
      );
      attachPreservingWorld(
        coinPanel.node,
        this.root,
        this.presentation.coins.panel.attachmentInsertion - 1,
      );
      this.coinPanelNode = coinPanel.node;
      this.coinPanelOpacity = coinPanel.opacity;

      const coins = createLabelNode(
        'total-coins-label',
        input.resources.font,
        this.presentation.coins.label.fontPointSize,
        this.presentation.coins.label.text,
        this.presentation.coins.label.anchor,
      );
      coins.node.setWorldPosition(
        this.presentation.coins.label.initialPosition.x,
        this.presentation.coins.label.initialPosition.y,
        0,
      );
      coins.opacity.opacity = 0;
      attachPreservingWorld(
        coins.node,
        this.root,
        this.presentation.coins.label.attachmentInsertion - 1,
      );
      this.coinLabel = coins.label;
      this.coinLabelNode = coins.node;
      this.coinLabelOpacity = coins.opacity;

      const backMenu = new Node('back-menu');
      backMenu.setWorldPosition(
        this.presentation.back.menuContainerPosition.x,
        this.presentation.back.menuContainerPosition.y,
        0,
      );
      attachPreservingWorld(
        backMenu,
        this.root,
        this.presentation.back.attachmentInsertion - 1,
      );
      this.backControl = createButton(
        'back-item',
        loadedFramePair(input.resources, this.presentation.back.resources),
      );
      this.backControl.node.setWorldPosition(
        this.presentation.back.initialPosition.x,
        this.presentation.back.initialPosition.y,
        0,
      );
      attachPreservingWorld(this.backControl.node, backMenu, 0);

      const gestures = new Node('gestures-layer');
      const gesturesTransform = gestures.addComponent(UITransform);
      gesturesTransform.setAnchorPoint(0.5, 0.5);
      gesturesTransform.setContentSize(
        this.presentation.viewport.logicalWidth,
        this.presentation.viewport.logicalHeight,
      );
      gestures.setWorldPosition(
        this.presentation.viewport.visibleRect.center.x,
        this.presentation.viewport.visibleRect.center.y,
        0,
      );
      attachPreservingWorld(
        gestures,
        this.root,
        this.presentation.gestures.attachmentInsertion - 1,
      );

      const rasterProfile = getOptionsRasterResources(input.resources.assetTree);
      const background = this.createRow(
        this.presentation.rows.background,
        rasterProfile.backgroundIcons.map((resource) => input.resources.raster(resource)),
      );
      constructedRows.push(background);
      const blade = this.createRow(
        this.presentation.rows.blade,
        rasterProfile.bladeIcons.map((resource) => input.resources.raster(resource)),
      );
      constructedRows.push(blade);
      const theme = this.createRow(
        this.presentation.rows.theme,
        rasterProfile.themeIcons.map((resource) => input.resources.raster(resource)),
      );
      constructedRows.push(theme);
      rows = Object.freeze({ background, blade, theme });
    } catch (error) {
      for (const row of constructedRows) {
        disposeRow(row);
      }
      if (isValid(this.root, true)) {
        this.root.destroy();
      }
      throw error;
    }
    this.rows = rows;
    this.selectors = Object.freeze({
      background: rows.background.selector,
      blade: rows.blade.selector,
      theme: rows.theme.selector,
    });
  }

  static create(input: OptionsPresenterInput): OptionsPresenter {
    assertInput(input);
    return new OptionsPresenter(input);
  }

  get state(): OptionsPresenterState {
    return Object.freeze({
      activated: this.activatedValue,
      backgroundSelectionOutsideOptions: this.backgroundSelectionOutsideOptionsValue,
      disposed: this.disposedValue,
      entryElapsedSeconds: this.entryElapsedSecondsValue,
      model: this.model.snapshot,
      navigationPending: this.navigationPendingValue,
      purchaseBurstCount: this.purchaseBursts.length,
      revealedRows: Object.freeze(
        OPTIONS_ROW_KINDS.filter(
          (kind) => this.rows[kind].revealed,
        ),
      ),
      suspended: this.suspendedValue,
    });
  }

  activate(): void {
    this.assertUsable('activate');
    if (this.activatedValue) {
      throw new Error('Options presenter can activate only once');
    }
    if (
      this.root.parent === null
      || !isValid(this.root.parent, true)
      || !this.root.parent.activeInHierarchy
    ) {
      throw new Error('Options root must be host-attached before activation');
    }

    this.root.active = true;
    try {
      this.registerEvents();
      this.activatedValue = true;
    } catch (error) {
      this.unregisterEvents();
      this.root.active = false;
      throw error;
    }
  }

  update(deltaSeconds: number): void {
    assertNonNegativeFinite(deltaSeconds, 'deltaSeconds');
    if (!this.activatedValue || this.suspendedValue || this.disposedValue) {
      return;
    }

    this.entryElapsedSecondsValue = Math.min(
      OPTIONS_FINAL_ENTRY_ACTION_SECONDS,
      this.entryElapsedSecondsValue + deltaSeconds,
    );
    this.updateEntryShell();
    this.revealDueRows();
    this.updateRowActions();
    for (const burst of this.purchaseBursts) {
      burst.update(deltaSeconds);
    }
    for (let index = this.purchaseBursts.length - 1; index >= 0; index -= 1) {
      if (this.purchaseBursts[index]?.state.disposed === true) {
        this.purchaseBursts.splice(index, 1);
      }
    }
  }

  /**
   * Converges unpaid previews before the process-owned Settings snapshot is persisted.
   *
   * The same transaction is used by Back, but this boundary deliberately does not navigate,
   * play audio, or purchase anything. A failed convergence restores the preview state and
   * throws so the caller can skip persistence and retry on the next lifecycle checkpoint.
   */
  reconcileSelectionsForPersistence(): void {
    this.assertUsable('reconcile selections for persistence');
    this.commitExitRollback();
  }

  suspendForTransition(): boolean {
    if (
      this.disposedValue
      || !this.activatedValue
      || this.suspendedValue
    ) {
      return false;
    }
    this.unregisterEvents();
    for (const kind of OPTIONS_ROW_KINDS) {
      const row = this.rows[kind];
      if (row.revealed) {
        row.selector.suspend();
      }
    }
    this.suspendedValue = true;
    return true;
  }

  rearmNavigationAfterFailure(): boolean {
    if (
      this.disposedValue
      || !this.activatedValue
      || this.root.parent === null
      || !isValid(this.root.parent, true)
      || !this.root.parent.activeInHierarchy
    ) {
      return false;
    }
    this.navigationPendingValue = false;
    if (!this.suspendedValue) {
      this.registerEvents();
      return true;
    }

    this.root.active = true;
    const activatedSelectors: OptionsItemSelectorPresenter[] = [];
    try {
      this.registerEvents();
      for (const kind of OPTIONS_ROW_KINDS) {
        const row = this.rows[kind];
        if (row.revealed) {
          row.selector.activate();
          activatedSelectors.push(row.selector);
        }
      }
      this.suspendedValue = false;
      return true;
    } catch (error) {
      this.unregisterEvents();
      for (const selector of activatedSelectors.reverse()) {
        selector.suspend();
      }
      this.root.active = false;
      throw error;
    }
  }

  dispose(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.disposedValue = true;
    this.activatedValue = false;
    this.navigationPendingValue = false;
    const failures: unknown[] = [];
    attemptCleanup(failures, () => this.unregisterEvents());
    for (const burst of this.purchaseBursts) {
      attemptCleanup(failures, () => burst.dispose());
    }
    this.purchaseBursts.length = 0;
    for (const kind of OPTIONS_ROW_KINDS) {
      const row = this.rows[kind];
      attemptCleanup(failures, () => row.selector.dispose());
      if (isValid(row.header.node, true)) {
        attemptCleanup(failures, () => row.header.node.destroy());
      }
      if (row.purchase !== null && isValid(row.purchase.menu, true)) {
        attemptCleanup(failures, () => row.purchase?.menu.destroy());
      }
    }
    if (isValid(this.root, true)) {
      attemptCleanup(failures, () => this.root.destroy());
    }
    if (failures.length > 0) {
      throw new OptionsCleanupError('Options disposal failed', failures);
    }
    return true;
  }

  private createRow(
    presentation: OptionsRowPresentation,
    icons: readonly LoadedGameRasterResource[],
  ): RuntimeRow {
    const header = createSpriteNode(
      `${presentation.kind}-header`,
      this.input.resources.raster(presentation.header.resource),
      presentation.header.anchor,
      MAX_OPACITY,
    );
    let selector: OptionsItemSelectorPresenter | null = null;
    let purchase: RuntimePurchaseControl | null = null;
    try {
      selector = OptionsItemSelectorPresenter.create({
        icons,
        name: `${presentation.kind}-selector`,
        next: loadedFramePair(this.input.resources, presentation.selector.nextResources),
        onSelectionChanged: (index) => this.selectionChanged(presentation.kind, index),
        previous: loadedFramePair(
          this.input.resources,
          presentation.selector.previousResources,
        ),
        selectedIndex: presentation.selector.selectedIndex,
        selectorBackground: this.input.resources.raster(
          presentation.selector.backgroundResource,
        ),
      });
      purchase = presentation.purchase === null
        ? null
        : this.createPurchaseControl(presentation.kind, presentation);
      return {
        header,
        kind: presentation.kind,
        presentation,
        purchase,
        revealed: false,
        selector,
      };
    } catch (error) {
      selector?.dispose();
      if (purchase !== null && isValid(purchase.menu, true)) {
        purchase.menu.destroy();
      }
      if (isValid(header.node, true)) {
        header.node.destroy();
      }
      throw error;
    }
  }

  private createPurchaseControl(
    kind: OptionsRowKind,
    row: OptionsRowPresentation,
  ): RuntimePurchaseControl {
    if (kind === 'theme' || row.purchase === null) {
      throw new Error('Only background and blade rows can construct a Buy control');
    }
    const purchase = row.purchase;
    const menu = new Node(`${kind}-buy-menu`);
    menu.setWorldPosition(purchase.position.x, purchase.position.y, 0);
    const button = createButton(
      `${kind}-buy-item`,
      loadedFramePair(this.input.resources, purchase.resources),
    );
    button.node.setParent(menu);
    button.node.setPosition(0, 0, 0);
    const price = createLabelNode(
      `${kind}-price-label`,
      this.input.resources.font,
      purchase.priceLabel.fontPointSize,
      purchase.priceLabel.text,
      purchase.priceLabel.anchor,
    );
    price.node.setParent(button.node);
    price.node.setPosition(
      purchase.priceLabel.localPosition.x,
      purchase.priceLabel.localPosition.y,
      0,
    );
    menu.active = purchase.buyControlVisible;

    const control = {
      button,
      cancel: (): void => applyButtonFrame(button, button.normal),
      category: kind,
      end: (): void => {
        applyButtonFrame(button, button.normal);
        this.purchase(kind);
      },
      listenersRegistered: false,
      menu,
      priceLabel: price.label,
      start: (): void => applyButtonFrame(button, button.selected),
    } satisfies RuntimePurchaseControl;
    return control;
  }

  private updateEntryShell(): void {
    const elapsed = this.entryElapsedSecondsValue;
    const title = this.presentation.title;
    setAnimatedWorldPosition(
      this.titleNode,
      title.initialPosition,
      title.finalPosition,
      progressAt(elapsed, title.actions[0].durationSeconds),
    );

    const panel = this.presentation.coins.panel;
    const coinProgress = progressAt(elapsed, panel.actions[0].durationSeconds);
    setAnimatedWorldPosition(
      this.coinPanelNode,
      panel.initialPosition,
      panel.finalPosition,
      coinProgress,
    );
    this.coinPanelOpacity.opacity = MAX_OPACITY * coinProgress;

    const label = this.presentation.coins.label;
    setAnimatedWorldPosition(
      this.coinLabelNode,
      label.initialPosition,
      label.finalPosition,
      progressAt(elapsed, label.actions[0].durationSeconds),
    );
    this.coinLabelOpacity.opacity = MAX_OPACITY * progressAt(
      elapsed,
      label.actions[1].durationSeconds,
    );

    const back = this.presentation.back;
    setAnimatedWorldPosition(
      this.backControl.node,
      back.initialPosition,
      back.finalPosition,
      progressAt(elapsed, back.action.durationSeconds),
    );
  }

  private revealDueRows(): void {
    for (const kind of OPTIONS_ROW_KINDS) {
      const row = this.rows[kind];
      if (
        !row.revealed
        && this.entryElapsedSecondsValue >= row.presentation.header.revealAtSeconds
      ) {
        this.revealRow(row);
      }
    }
  }

  private revealRow(row: RuntimeRow): void {
    const { header, selector } = row.presentation;
    const revealAudio = this.presentation.audio.rowReveal[row.kind];
    if (revealAudio !== null && this.effectsEnabled()) {
      this.input.audio.playOneShot(revealAudio.canonicalPath);
    }
    row.header.node.setWorldPosition(
      header.initialPosition.x,
      header.initialPosition.y,
      0,
    );
    attachPreservingWorld(
      row.header.node,
      this.root,
      header.attachmentInsertion - 1,
    );
    row.selector.root.setWorldPosition(
      selector.initialPosition.x,
      selector.initialPosition.y,
      0,
    );
    attachPreservingWorld(
      row.selector.root,
      this.root,
      selector.attachmentInsertion - 1,
    );
    if (row.purchase !== null && row.presentation.purchase !== null) {
      row.purchase.menu.setWorldPosition(
        row.presentation.purchase.position.x,
        row.presentation.purchase.position.y,
        0,
      );
      attachPreservingWorld(
        row.purchase.menu,
        this.root,
        row.presentation.purchase.attachmentInsertion - 1,
      );
    }
    row.revealed = true;
    if (this.canInteract()) {
      row.selector.activate();
      if (row.purchase !== null && row.purchase.menu.active) {
        this.registerPurchaseEvents(row.purchase);
      }
    }
  }

  private updateRowActions(): void {
    for (const kind of OPTIONS_ROW_KINDS) {
      const row = this.rows[kind];
      if (!row.revealed) {
        continue;
      }
      const elapsed = Math.max(
        0,
        this.entryElapsedSecondsValue - row.presentation.header.revealAtSeconds,
      );
      const header = row.presentation.header;
      setAnimatedWorldPosition(
        row.header.node,
        header.initialPosition,
        header.finalPosition,
        progressAt(elapsed, header.action.durationSeconds),
      );
      const selector = row.presentation.selector;
      setAnimatedWorldPosition(
        row.selector.root,
        selector.initialPosition,
        selector.position,
        progressAt(elapsed, selector.action.durationSeconds),
      );
    }
  }

  private selectionChanged(kind: OptionsRowKind, index: number): void {
    if (!this.canInteract()) {
      return;
    }
    if (kind === 'background') {
      this.selectBackground(index);
    } else if (kind === 'blade') {
      this.selectBlade(index);
    } else {
      this.selectTheme(index);
    }
    if (this.effectsEnabled()) {
      this.input.audio.playOneShot(this.presentation.audio.selection.canonicalPath);
    }
  }

  private selectBackground(index: number): void {
    const previousLocal = this.model.snapshot.selectedBackground;
    const previousSettings = readSettings(this.input.settings.state).snapshot.selectedBackground;
    const previousShared = readSharedBackground(this.input.sharedCosmetics);
    const previousOutside = this.backgroundSelectionOutsideOptionsValue;
    this.model.selectBackground(index);
    try {
      this.input.settings.state.setSelectedBackground(index);
      this.input.sharedCosmetics.selectBackground(index);
      assertLiveSharedIndex(
        this.input.sharedCosmetics.currentBackgroundIndex,
        index,
        'background',
      );
      this.backgroundSelectionOutsideOptionsValue = false;
      this.refreshPurchaseControl('background');
    } catch (error) {
      const failures: unknown[] = [error];
      attemptCleanup(failures, () => this.model.selectBackground(previousLocal));
      attemptCleanup(failures, () => this.selectors.background.select(previousLocal));
      attemptCleanup(
        failures,
        () => this.input.settings.state.setSelectedBackground(previousSettings),
      );
      attemptCleanup(
        failures,
        () => this.input.sharedCosmetics.selectBackground(previousShared),
      );
      this.backgroundSelectionOutsideOptionsValue = previousOutside;
      attemptCleanup(failures, () => this.refreshPurchaseControl('background'));
      throw new OptionsCleanupError('Options background selection rollback failed', failures);
    }
  }

  private selectBlade(index: number): void {
    const previousLocal = this.model.snapshot.selectedBlade;
    const previousSettings = readSettings(this.input.settings.state).snapshot.selectedBlade;
    this.model.selectBlade(index);
    try {
      this.input.settings.state.setSelectedBlade(index);
      this.refreshPurchaseControl('blade');
    } catch (error) {
      const failures: unknown[] = [error];
      attemptCleanup(failures, () => this.model.selectBlade(previousLocal));
      attemptCleanup(failures, () => this.selectors.blade.select(previousLocal));
      attemptCleanup(
        failures,
        () => this.input.settings.state.setSelectedBlade(previousSettings),
      );
      attemptCleanup(failures, () => this.refreshPurchaseControl('blade'));
      throw new OptionsCleanupError('Options blade selection rollback failed', failures);
    }
  }

  private selectTheme(index: number): void {
    const previousLocal = this.model.snapshot.selectedTheme;
    const previousSettings = readSettings(this.input.settings.state).snapshot.selectedTheme;
    const previousShared = readSharedTheme(this.input.sharedCosmetics);
    this.model.selectTheme(index);
    try {
      this.input.settings.state.setSelectedTheme(index);
      this.input.sharedCosmetics.selectTheme(index);
      assertLiveSharedIndex(
        this.input.sharedCosmetics.currentThemeIndex,
        index,
        'theme',
      );
    } catch (error) {
      const failures: unknown[] = [error];
      attemptCleanup(failures, () => this.model.selectTheme(previousLocal));
      attemptCleanup(failures, () => this.selectors.theme.select(previousLocal));
      attemptCleanup(
        failures,
        () => this.input.settings.state.setSelectedTheme(previousSettings),
      );
      attemptCleanup(failures, () => this.input.sharedCosmetics.selectTheme(previousShared));
      throw new OptionsCleanupError('Options theme selection rollback failed', failures);
    }
  }

  private refreshPurchaseControl(category: 'background' | 'blade'): void {
    const row = this.rows[category];
    const control = row.purchase;
    if (control === null) {
      throw new Error(`Options ${category} row is missing its Buy control`);
    }
    const index = category === 'background'
      ? this.model.snapshot.selectedBackground
      : this.model.snapshot.selectedBlade;
    const price = category === 'background'
      ? this.model.backgroundPriceAt(index)
      : this.model.bladePriceAt(index);
    control.priceLabel.string = `${price}`;
    control.menu.active = price > 0;
    applyButtonFrame(control.button, control.button.normal);
    if (price > 0 && row.revealed && this.canInteract()) {
      this.registerPurchaseEvents(control);
    } else {
      this.unregisterPurchaseEvents(control);
    }
  }

  private purchase(category: 'background' | 'blade'): void {
    if (!this.canInteract()) {
      return;
    }
    const index = category === 'background'
      ? this.model.snapshot.selectedBackground
      : this.model.snapshot.selectedBlade;
    const result = category === 'background'
      ? this.input.settings.purchaseBackgroundWithCoins(index)
      : this.input.settings.purchaseBladeWithCoins(index);
    assertPurchaseResult(result, category, index);
    if (result.kind !== 'purchased') {
      return;
    }

    const settings = readSettings(this.input.settings.state);
    if (settings.snapshot.totalCoins !== result.totalCoins) {
      throw new Error(`Options ${category} purchase returned a stale coin balance`);
    }
    this.model = new OptionsState({
      backgroundPrices: settings.backgroundPrices,
      bladePrices: settings.bladePrices,
      selectedBackground: this.model.snapshot.selectedBackground,
      selectedBlade: this.model.snapshot.selectedBlade,
      selectedTheme: this.model.snapshot.selectedTheme,
      totalCoins: settings.snapshot.totalCoins,
    });
    this.coinLabel.string = `${result.totalCoins}`;
    this.refreshPurchaseControl(category);

    const burst = OptionsPurchaseParticlePresenter.create({
      random: this.input.random,
      resource: this.input.resources.raster(this.presentation.purchaseParticleResource),
      viewport: { logicalWidth: this.presentation.viewport.logicalWidth },
    });
    try {
      burst.attach(this.root);
      this.purchaseBursts.push(burst);
    } catch (error) {
      try {
        burst.dispose();
      } catch (cleanupError) {
        throw new OptionsCleanupError(
          `Options ${category} purchase burst cleanup failed`,
          [error, cleanupError],
        );
      }
      throw error;
    }
  }

  private requestMainMenu(): void {
    if (!this.canInteract()) {
      return;
    }
    if (this.effectsEnabled()) {
      this.input.audio.playOneShot(this.presentation.audio.back.canonicalPath);
    }
    this.reconcileSelectionsForPersistence();
    this.navigationPendingValue = true;
    const previousParent = this.root.parent;
    const previousSiblingIndex = this.root.getSiblingIndex();
    const transaction: OptionsNavigationTransaction = Object.freeze({
      destination: 'MainMenuLayer',
      root: this.root,
      timing: 'immediate',
      zOrder: 1,
    });
    try {
      if (this.input.lifecycle.onMainMenuRequested(transaction) === false) {
        this.navigationPendingValue = false;
        restoreRootAfterRejectedTransaction(
          this.root,
          previousParent,
          previousSiblingIndex,
        );
        this.requireNavigationRearm();
      }
    } catch (error) {
      this.navigationPendingValue = false;
      restoreRootAfterRejectedTransaction(
        this.root,
        previousParent,
        previousSiblingIndex,
      );
      try {
        this.requireNavigationRearm();
      } catch (rearmError) {
        throw new OptionsCleanupError(
          'Options Main Menu transaction recovery failed',
          [error, rearmError],
        );
      }
      throw error;
    }
  }

  private commitExitRollback(): void {
    const previousModel = this.model.snapshot;
    const previousSettings = readSettings(this.input.settings.state).snapshot;
    const previousSharedBackground = readSharedBackground(this.input.sharedCosmetics);
    const previousOutside = this.backgroundSelectionOutsideOptionsValue;
    const rollback = this.model.prepareExitRollback();
    try {
      for (const intent of rollback.selectionIntents) {
        if (intent.category === 'background') {
          this.input.settings.state.setSelectedBackground(intent.nextIndex);
          this.input.sharedCosmetics.selectBackground(intent.nextIndex);
          assertLiveSharedIndex(
            this.input.sharedCosmetics.currentBackgroundIndex,
            intent.nextIndex,
            'background',
          );
          this.selectors.background.select(intent.nextIndex);
          this.refreshPurchaseControl('background');
        } else {
          this.input.settings.state.setSelectedBlade(intent.nextIndex);
          this.selectors.blade.select(intent.nextIndex);
          this.refreshPurchaseControl('blade');
        }
      }
    } catch (error) {
      const compensationFailures: unknown[] = [];
      attemptCleanup(
        compensationFailures,
        () => this.model.selectBackground(previousModel.selectedBackground),
      );
      attemptCleanup(
        compensationFailures,
        () => this.model.selectBlade(previousModel.selectedBlade),
      );
      attemptCleanup(
        compensationFailures,
        () => this.input.settings.state.setSelectedBackground(
          previousSettings.selectedBackground,
        ),
      );
      attemptCleanup(
        compensationFailures,
        () => this.input.settings.state.setSelectedBlade(previousSettings.selectedBlade),
      );
      attemptCleanup(
        compensationFailures,
        () => this.input.sharedCosmetics.selectBackground(previousSharedBackground),
      );
      attemptCleanup(
        compensationFailures,
        () => this.selectors.background.select(previousModel.selectedBackground),
      );
      attemptCleanup(
        compensationFailures,
        () => this.selectors.blade.select(previousModel.selectedBlade),
      );
      this.backgroundSelectionOutsideOptionsValue = previousOutside;
      attemptCleanup(
        compensationFailures,
        () => this.refreshPurchaseControl('background'),
      );
      attemptCleanup(compensationFailures, () => this.refreshPurchaseControl('blade'));
      if (compensationFailures.length > 0) {
        throw new OptionsCleanupError(
          'Options exit rollback compensation failed',
          [error, ...compensationFailures],
        );
      }
      throw error;
    }
  }

  private requireNavigationRearm(): void {
    if (!this.rearmNavigationAfterFailure()) {
      throw new Error('Options Main Menu transaction could not rearm the source screen');
    }
  }

  private effectsEnabled(): boolean {
    return readSettings(this.input.settings.state).snapshot.effectsEnabled;
  }

  private registerEvents(): void {
    if (this.listenersRegistered) {
      return;
    }
    try {
      this.backControl.node.on(Node.EventType.TOUCH_START, this.onBackStart, this);
      this.backControl.node.on(Node.EventType.TOUCH_END, this.onBackEnd, this);
      this.backControl.node.on(Node.EventType.TOUCH_CANCEL, this.onBackCancel, this);
      cocosInput.on(Input.EventType.KEY_UP, this.onKeyUp, this);
      for (const kind of OPTIONS_ROW_KINDS) {
        const row = this.rows[kind];
        if (row.revealed && row.purchase !== null && row.purchase.menu.active) {
          this.registerPurchaseEvents(row.purchase);
        }
      }
      this.listenersRegistered = true;
    } catch (error) {
      try {
        this.unregisterEvents();
      } catch (cleanupError) {
        throw new OptionsCleanupError(
          'Options event registration rollback failed',
          [error, cleanupError],
        );
      }
      throw error;
    }
  }

  private unregisterEvents(): void {
    const failures: unknown[] = [];
    this.listenersRegistered = false;
    attemptCleanup(
      failures,
      () => this.backControl.node.off(Node.EventType.TOUCH_START, this.onBackStart, this),
    );
    attemptCleanup(
      failures,
      () => this.backControl.node.off(Node.EventType.TOUCH_END, this.onBackEnd, this),
    );
    attemptCleanup(
      failures,
      () => this.backControl.node.off(Node.EventType.TOUCH_CANCEL, this.onBackCancel, this),
    );
    attemptCleanup(
      failures,
      () => cocosInput.off(Input.EventType.KEY_UP, this.onKeyUp, this),
    );
    for (const kind of OPTIONS_ROW_KINDS) {
      const control = this.rows[kind].purchase;
      if (control !== null) {
        attemptCleanup(failures, () => this.unregisterPurchaseEvents(control));
      }
    }
    if (failures.length > 0) {
      throw new OptionsCleanupError('Options event removal failed', failures);
    }
  }

  private registerPurchaseEvents(control: RuntimePurchaseControl): void {
    if (control.listenersRegistered) {
      return;
    }
    try {
      control.button.node.on(Node.EventType.TOUCH_START, control.start, this);
      control.button.node.on(Node.EventType.TOUCH_END, control.end, this);
      control.button.node.on(Node.EventType.TOUCH_CANCEL, control.cancel, this);
      control.listenersRegistered = true;
    } catch (error) {
      try {
        this.unregisterPurchaseEvents(control);
      } catch (cleanupError) {
        throw new OptionsCleanupError(
          `Options ${control.category} Buy event registration rollback failed`,
          [error, cleanupError],
        );
      }
      throw error;
    }
  }

  private unregisterPurchaseEvents(control: RuntimePurchaseControl): void {
    const failures: unknown[] = [];
    control.listenersRegistered = false;
    attemptCleanup(
      failures,
      () => control.button.node.off(Node.EventType.TOUCH_START, control.start, this),
    );
    attemptCleanup(
      failures,
      () => control.button.node.off(Node.EventType.TOUCH_END, control.end, this),
    );
    attemptCleanup(
      failures,
      () => control.button.node.off(Node.EventType.TOUCH_CANCEL, control.cancel, this),
    );
    if (failures.length > 0) {
      throw new OptionsCleanupError(
        `Options ${control.category} Buy event removal failed`,
        failures,
      );
    }
  }

  private readonly onBackStart = (): void => {
    if (this.canInteract()) {
      applyButtonFrame(this.backControl, this.backControl.selected);
    }
  };

  private readonly onBackEnd = (): void => {
    applyButtonFrame(this.backControl, this.backControl.normal);
    this.requestMainMenu();
  };

  private readonly onBackCancel = (): void => {
    applyButtonFrame(this.backControl, this.backControl.normal);
  };

  private readonly onKeyUp = (event: EventKeyboard): void => {
    if (event.keyCode === KeyCode.MOBILE_BACK) {
      this.requestMainMenu();
    }
  };

  private canInteract(): boolean {
    return this.activatedValue
      && !this.disposedValue
      && !this.suspendedValue
      && !this.navigationPendingValue;
  }

  private assertUsable(action: string): void {
    if (this.disposedValue || !isValid(this.root, true)) {
      throw new Error(`Disposed Options presenter cannot ${action}`);
    }
  }
}

function createSpriteNode(
  name: string,
  resource: LoadedGameRasterResource,
  anchor: Readonly<{ readonly x: number; readonly y: number }>,
  initialOpacity: number,
): RuntimeSprite {
  const node = new Node(name);
  const transform = node.addComponent(UITransform);
  transform.setAnchorPoint(anchor.x, anchor.y);
  transform.setContentSize(resource.dimensions.width, resource.dimensions.height);
  const opacity = node.addComponent(UIOpacity);
  opacity.opacity = initialOpacity;
  const sprite = node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = resource.spriteFrame;
  return Object.freeze({ node, opacity, sprite, transform });
}

function createLabelNode(
  name: string,
  font: OptionsPresenterInput['resources']['font'],
  fontSize: number,
  text: string,
  anchor: Readonly<{ readonly x: number; readonly y: number }>,
): Readonly<{
  readonly label: Label;
  readonly node: Node;
  readonly opacity: UIOpacity;
}> {
  const node = new Node(name);
  const transform = node.addComponent(UITransform);
  transform.setAnchorPoint(anchor.x, anchor.y);
  const opacity = node.addComponent(UIOpacity);
  const label = node.addComponent(Label);
  label.font = font;
  label.fontSize = fontSize;
  label.string = text;
  return Object.freeze({ label, node, opacity });
}

function createButton(name: string, frames: OptionsSelectorFramePair): RuntimeButton {
  const presented = createSpriteNode(
    name,
    frames.normal,
    { x: 0.5, y: 0.5 },
    MAX_OPACITY,
  );
  return Object.freeze({
    node: presented.node,
    normal: frames.normal,
    selected: frames.selected,
    sprite: presented.sprite,
    transform: presented.transform,
  });
}

function loadedFramePair(
  resources: LoadedOptionsResources,
  frames: Readonly<{
    readonly normal: Parameters<LoadedOptionsResources['raster']>[0];
    readonly selected: Parameters<LoadedOptionsResources['raster']>[0];
  }>,
): OptionsSelectorFramePair {
  return Object.freeze({
    normal: resources.raster(frames.normal),
    selected: resources.raster(frames.selected),
  });
}

function applyButtonFrame(button: RuntimeButton, resource: LoadedGameRasterResource): void {
  button.sprite.spriteFrame = resource.spriteFrame;
  button.transform.setContentSize(
    resource.dimensions.width,
    resource.dimensions.height,
  );
}

function attachPreservingWorld(node: Node, parent: Node, siblingIndex: number): void {
  applyLayerRecursively(node, parent.layer);
  node.setParent(parent, true);
  node.setSiblingIndex(siblingIndex);
}

function applyLayerRecursively(node: Node, layer: number): void {
  node.layer = layer;
  for (const child of node.children) {
    applyLayerRecursively(child, layer);
  }
}

function setAnimatedWorldPosition(
  node: Node,
  initial: OptionsPoint,
  final: OptionsPoint,
  progress: number,
): void {
  node.setWorldPosition(
    interpolateFloat32(initial.x, final.x, progress),
    interpolateFloat32(initial.y, final.y, progress),
    0,
  );
}

function progressAt(elapsedSeconds: number, durationSeconds: number): number {
  return durationSeconds === 0 ? 1 : Math.min(1, elapsedSeconds / durationSeconds);
}

function interpolateFloat32(start: number, end: number, progress: number): number {
  return Math.fround(Math.fround(start) + Math.fround(
    Math.fround(end - start) * Math.fround(progress),
  ));
}

function readSettings(state: OptionsSettingsStatePort): Readonly<{
  readonly backgroundPrices: readonly number[];
  readonly bladePrices: readonly number[];
  readonly snapshot: OptionsSettingsSnapshot;
}> {
  if (state === null || typeof state !== 'object') {
    throw new TypeError('Options settings state must be an object');
  }
  const snapshot = state.snapshot;
  if (snapshot === null || typeof snapshot !== 'object') {
    throw new TypeError('Options settings snapshot must be an object');
  }
  if (typeof snapshot.effectsEnabled !== 'boolean') {
    throw new TypeError('Options effectsEnabled must be a boolean');
  }
  assertIndex(
    snapshot.selectedBackground,
    OPTIONS_COMPATIBLE_SAVED_BACKGROUND_MAXIMUM + 1,
    'selectedBackground',
  );
  assertIndex(snapshot.selectedBlade, 18, 'selectedBlade');
  assertIndex(snapshot.selectedTheme, 10, 'selectedTheme');
  assertSignedInt32(snapshot.totalCoins, 'totalCoins');
  return Object.freeze({
    backgroundPrices: state.backgroundPrices,
    bladePrices: state.bladePrices,
    snapshot: Object.freeze({
      effectsEnabled: snapshot.effectsEnabled,
      selectedBackground: snapshot.selectedBackground,
      selectedBlade: snapshot.selectedBlade,
      selectedTheme: snapshot.selectedTheme,
      totalCoins: snapshot.totalCoins,
    }),
  });
}

function readSharedBackground(shared: OptionsSharedCosmeticsPort): number {
  const value = shared.currentBackgroundIndex;
  assertIndex(
    value,
    OPTIONS_COMPATIBLE_SAVED_BACKGROUND_MAXIMUM + 1,
    'shared background index',
  );
  return value;
}

function readSharedTheme(shared: OptionsSharedCosmeticsPort): number {
  const value = shared.currentThemeIndex;
  assertIndex(value, 10, 'shared theme index');
  return value;
}

function assertLiveSharedIndex(
  actual: number,
  expected: number,
  category: 'background' | 'theme',
): void {
  if (actual !== expected) {
    throw new Error(
      `Options shared ${category} presenter retained ${actual} instead of ${expected}`,
    );
  }
}

function restoreRootAfterRejectedTransaction(
  root: Node,
  previousParent: Node | null,
  siblingIndex: number,
): void {
  if (
    previousParent !== null
    && isValid(root, true)
    && isValid(previousParent, true)
    && previousParent.activeInHierarchy
  ) {
    if (root.parent !== previousParent) {
      root.setParent(previousParent, true);
    }
    root.setSiblingIndex(siblingIndex);
    if (
      root.parent !== previousParent
      || root.getSiblingIndex() !== siblingIndex
    ) {
      throw new Error('Options source root could not restore its exact host position');
    }
  }
  if (root.parent !== null && isValid(root, true)) {
    root.active = true;
  }
}

function assertInput(input: OptionsPresenterInput): void {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('Options presenter input must be an object');
  }
  if (!isValid(input.canvas, true) || !input.canvas.activeInHierarchy) {
    throw new Error('Options canvas must be valid and active');
  }
  if (
    input.resources === null
    || typeof input.resources !== 'object'
    || input.resources.rasterCount !== OPTIONS_RASTER_RESOURCE_COUNT
    || typeof input.resources.raster !== 'function'
    || !isValid(input.resources.font, true)
  ) {
    throw new Error('Options presenter requires the complete loaded resource catalog');
  }
  assertFunctions(input.audio, ['playOneShot'], 'audio');
  assertFunctions(input.lifecycle, ['onMainMenuRequested'], 'lifecycle');
  assertFunctions(input.random, ['nextIntInclusive'], 'random');
  assertFunctions(input.settings, [
    'purchaseBackgroundWithCoins',
    'purchaseBladeWithCoins',
  ], 'settings');
  assertFunctions(input.settings.state, [
    'setSelectedBackground',
    'setSelectedBlade',
    'setSelectedTheme',
  ], 'settings.state');
  assertFunctions(input.sharedCosmetics, [
    'selectBackground',
    'selectTheme',
  ], 'sharedCosmetics');
  readSettings(input.settings.state);
  readSharedBackground(input.sharedCosmetics);
  readSharedTheme(input.sharedCosmetics);
  createOptionsPresentation(
    input.resources.assetTree,
    input.viewport,
    input.settings.state.snapshot.totalCoins,
    {
      backgroundPrices: input.settings.state.backgroundPrices,
      bladePrices: input.settings.state.bladePrices,
      selectedBackground: Math.min(
        input.settings.state.snapshot.selectedBackground,
        OPTIONS_BACKGROUND_COUNT - 1,
      ),
      selectedBlade: input.settings.state.snapshot.selectedBlade,
      selectedTheme: input.settings.state.snapshot.selectedTheme,
    },
  );
}

function assertPurchaseResult(
  result: OptionsSettingsPurchaseResult,
  category: 'background' | 'blade',
  expectedIndex: number,
): void {
  if (result === null || typeof result !== 'object') {
    throw new TypeError(`Options ${category} purchase must return a result`);
  }
  if (result.index !== expectedIndex) {
    throw new Error(`Options ${category} purchase returned a different index`);
  }
  assertSignedInt32(result.totalCoins, `${category} purchase totalCoins`);
  if (
    result.kind !== 'already-owned'
    && result.kind !== 'insufficient-coins'
    && result.kind !== 'purchased'
  ) {
    throw new Error(`Options ${category} purchase returned an unsupported status`);
  }
  assertSignedInt32(result.price, `${category} purchase price`);
  if (result.price < 0 || (result.kind === 'already-owned' && result.price !== 0)) {
    throw new Error(`Options ${category} purchase returned an invalid price`);
  }
}

function disposeRow(row: RuntimeRow): void {
  row.selector.dispose();
  if (isValid(row.header.node, true)) {
    row.header.node.destroy();
  }
  if (row.purchase !== null && isValid(row.purchase.menu, true)) {
    row.purchase.menu.destroy();
  }
}

function assertFunctions(
  value: unknown,
  names: readonly string[],
  label: string,
): void {
  if (value === null || typeof value !== 'object') {
    throw new TypeError(`Options ${label} port must be an object`);
  }
  for (const name of names) {
    if (!(name in value) || typeof (value as Record<string, unknown>)[name] !== 'function') {
      throw new TypeError(`Options ${label} port requires ${name}()`);
    }
  }
}

function assertIndex(index: number, count: number, label: string): void {
  if (!Number.isSafeInteger(index) || index < 0 || index >= count) {
    throw new RangeError(`${label} must be an integer from 0 through ${count - 1}`);
  }
}

function assertSignedInt32(value: number, label: string): void {
  if (
    !Number.isSafeInteger(value)
    || value < -0x8000_0000
    || value > 0x7fff_ffff
  ) {
    throw new RangeError(`${label} must be a signed 32-bit integer`);
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be finite and non-negative`);
  }
}

function attemptCleanup(failures: unknown[], cleanup: () => unknown): void {
  try {
    cleanup();
  } catch (error) {
    failures.push(error);
  }
}
