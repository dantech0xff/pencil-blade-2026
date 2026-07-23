export const BASE_GAMEPLAY_PAUSE_ACTION_SECONDS = 0.25;
export const BASE_GAMEPLAY_PAUSE_OVERLAY_OPACITY = 65 as const;
export const BASE_GAMEPLAY_PAUSE_Z_ORDER = 1 as const;

export interface BaseGameplayPausePoint {
  readonly x: number;
  readonly y: number;
}

export interface BaseGameplayPauseObjectiveCard {
  readonly description: string;
  readonly progress: string;
  readonly reward: string;
}

export interface BaseGameplayPauseLayoutInput {
  readonly contentScaleFactor: number;
  readonly objectiveBackgroundHeight: number;
  readonly objectiveBackgroundWidth: number;
  readonly viewportHeight: number;
  readonly viewportWidth: number;
}

export interface BaseGameplayPauseLayout {
  readonly descriptionLocalPosition: BaseGameplayPausePoint;
  readonly fontSize: number;
  readonly objectiveBackgroundWorldPosition: BaseGameplayPausePoint;
  readonly pauseItemWorldPosition: BaseGameplayPausePoint;
  readonly progressAnchor: BaseGameplayPausePoint;
  readonly progressLocalPosition: BaseGameplayPausePoint;
  readonly quitHidden: BaseGameplayPausePoint;
  readonly quitShown: BaseGameplayPausePoint;
  readonly replayHidden: BaseGameplayPausePoint;
  readonly replayShown: BaseGameplayPausePoint;
  readonly resumeHidden: BaseGameplayPausePoint;
  readonly resumeShown: BaseGameplayPausePoint;
  readonly rewardAnchor: BaseGameplayPausePoint;
  readonly rewardLocalPosition: BaseGameplayPausePoint;
}

export type BaseGameplayPauseActionCommand =
  | Readonly<{ readonly type: 'pause-director' }>
  | Readonly<{ readonly type: 'resume-director' }>;

export interface BaseGameplayPauseSnapshot {
  readonly card: BaseGameplayPauseObjectiveCard;
  readonly directorPauseOwned: boolean;
  readonly disposed: boolean;
  readonly objectiveOverlayVisible: boolean;
  readonly optionsMenuEnabled: boolean;
  readonly optionsMenuVisible: boolean;
  readonly pauseMenuEnabled: boolean;
  readonly pauseMenuVisible: boolean;
  readonly pendingCallbackCount: number;
  readonly pendingMoveCount: number;
  readonly quitPosition: BaseGameplayPausePoint;
  readonly replayPosition: BaseGameplayPausePoint;
  readonly resumePosition: BaseGameplayPausePoint;
}

type PauseItem = 'quit' | 'replay' | 'resume';

interface MoveAction {
  elapsedSeconds: number;
  readonly end: BaseGameplayPausePoint;
  readonly item: PauseItem;
  readonly sequence: number;
  readonly start: BaseGameplayPausePoint;
}

interface DelayedCallback {
  elapsedSeconds: number;
  readonly kind: 'disable-options' | 'pause-director';
  readonly sequence: number;
}

/**
 * Deterministic projection of BaseGameplayLayer's pause actions.
 *
 * It deliberately permits overlapping ingress/egress actions and leaves ingress callbacks
 * pending after an early resume. Those races are part of the recovered native contract.
 */
export class BaseGameplayPauseState {
  readonly layout: BaseGameplayPauseLayout;

  private cardValue: BaseGameplayPauseObjectiveCard;
  private readonly delayedCallbacks: DelayedCallback[] = [];
  private directorPauseOwnedValue = false;
  private disposedValue = false;
  private readonly moveActions: MoveAction[] = [];
  private objectiveOverlayVisibleValue = false;
  private optionsMenuEnabledValue = false;
  private optionsMenuVisibleValue = false;
  private pauseMenuEnabledValue = true;
  private pauseMenuVisibleValue = true;
  private positions: Record<PauseItem, BaseGameplayPausePoint>;
  private sequence = 0;

  constructor(
    layoutInput: BaseGameplayPauseLayoutInput,
    initialCard: BaseGameplayPauseObjectiveCard,
  ) {
    this.layout = createBaseGameplayPauseLayout(layoutInput, initialCard.progress);
    this.cardValue = freezeCard(initialCard);
    this.positions = {
      quit: this.layout.quitHidden,
      replay: this.layout.replayHidden,
      resume: this.layout.resumeHidden,
    };
  }

  get snapshot(): BaseGameplayPauseSnapshot {
    return Object.freeze({
      card: freezeCard(this.cardValue),
      directorPauseOwned: this.directorPauseOwnedValue,
      disposed: this.disposedValue,
      objectiveOverlayVisible: this.objectiveOverlayVisibleValue,
      optionsMenuEnabled: this.optionsMenuEnabledValue,
      optionsMenuVisible: this.optionsMenuVisibleValue,
      pauseMenuEnabled: this.pauseMenuEnabledValue,
      pauseMenuVisible: this.pauseMenuVisibleValue,
      pendingCallbackCount: this.delayedCallbacks.length,
      pendingMoveCount: this.moveActions.length,
      quitPosition: freezePoint(this.positions.quit),
      replayPosition: freezePoint(this.positions.replay),
      resumePosition: freezePoint(this.positions.resume),
    });
  }

  pauseIngress(
    refreshedCard: BaseGameplayPauseObjectiveCard,
  ): readonly BaseGameplayPauseActionCommand[] {
    this.assertUsable('begin pause ingress');
    // Validate the refreshed strings before exposing any UI or queueing actions. A malformed
    // host payload must leave the reusable pause owner at its exact previous snapshot.
    const card = freezeCard(refreshedCard);
    this.objectiveOverlayVisibleValue = true;
    this.optionsMenuEnabledValue = true;
    this.optionsMenuVisibleValue = true;
    this.pauseMenuEnabledValue = false;
    this.pauseMenuVisibleValue = false;
    this.queueMove('resume', this.layout.resumeShown);
    this.queueMove('replay', this.layout.replayShown);
    this.queueMove('quit', this.layout.quitShown);
    this.queueCallback('pause-director');
    // Native refreshes strings after exposing the overlay and scheduling every action.
    this.cardValue = card;
    return Object.freeze([]);
  }

  resumeEgress(): readonly BaseGameplayPauseActionCommand[] {
    this.assertUsable('begin pause egress');
    // Native invokes director.resume() even if ingress has not paused it yet.
    this.directorPauseOwnedValue = false;
    this.objectiveOverlayVisibleValue = false;
    this.pauseMenuEnabledValue = true;
    this.pauseMenuVisibleValue = true;
    this.queueMove('resume', this.layout.resumeHidden);
    this.queueMove('replay', this.layout.replayHidden);
    this.queueMove('quit', this.layout.quitHidden);
    this.queueCallback('disable-options');
    return Object.freeze([
      Object.freeze({ type: 'resume-director' as const }),
    ]);
  }

  updateAction(
    deltaSeconds: number,
  ): readonly BaseGameplayPauseActionCommand[] {
    assertNonNegativeFinite(deltaSeconds, 'deltaSeconds');
    if (this.disposedValue) {
      return Object.freeze([]);
    }

    this.advanceMoves(deltaSeconds);
    const commands: BaseGameplayPauseActionCommand[] = [];
    const completed = this.advanceCallbacks(deltaSeconds);
    for (const callback of completed) {
      if (callback.kind === 'pause-director') {
        this.directorPauseOwnedValue = true;
        commands.push(Object.freeze({ type: 'pause-director' }));
      } else {
        this.optionsMenuEnabledValue = false;
        this.optionsMenuVisibleValue = false;
      }
    }
    return Object.freeze(commands);
  }

  /** Native Replay/Quit call stopAllActions immediately after scheduling PauseOutAction. */
  stopAllActions(): void {
    this.assertUsable('stop pause actions');
    this.moveActions.length = 0;
    this.delayedCallbacks.length = 0;
  }

  /**
   * Explicit target cleanup. Returns a resume command only for a director pause lease that this
   * state actually reached; it never resumes an unrelated external pause.
   */
  dispose(): readonly BaseGameplayPauseActionCommand[] {
    if (this.disposedValue) {
      return Object.freeze([]);
    }
    this.disposedValue = true;
    this.moveActions.length = 0;
    this.delayedCallbacks.length = 0;
    const resumeOwnedPause = this.directorPauseOwnedValue;
    this.directorPauseOwnedValue = false;
    return resumeOwnedPause
      ? Object.freeze([Object.freeze({ type: 'resume-director' as const })])
      : Object.freeze([]);
  }

  private advanceCallbacks(deltaSeconds: number): readonly DelayedCallback[] {
    const completed: DelayedCallback[] = [];
    for (const callback of [...this.delayedCallbacks]) {
      callback.elapsedSeconds = Math.min(
        BASE_GAMEPLAY_PAUSE_ACTION_SECONDS,
        callback.elapsedSeconds + deltaSeconds,
      );
      if (callback.elapsedSeconds >= BASE_GAMEPLAY_PAUSE_ACTION_SECONDS) {
        const index = this.delayedCallbacks.indexOf(callback);
        if (index >= 0) {
          this.delayedCallbacks.splice(index, 1);
        }
        completed.push(callback);
      }
    }
    completed.sort((left, right) => left.sequence - right.sequence);
    return Object.freeze(completed);
  }

  private advanceMoves(deltaSeconds: number): void {
    const ordered = [...this.moveActions].sort(
      (left, right) => left.sequence - right.sequence,
    );
    for (const action of ordered) {
      action.elapsedSeconds = Math.min(
        BASE_GAMEPLAY_PAUSE_ACTION_SECONDS,
        action.elapsedSeconds + deltaSeconds,
      );
      const progress = action.elapsedSeconds / BASE_GAMEPLAY_PAUSE_ACTION_SECONDS;
      this.positions[action.item] = freezePoint({
        x: action.start.x + (action.end.x - action.start.x) * progress,
        y: action.start.y + (action.end.y - action.start.y) * progress,
      });
      if (action.elapsedSeconds >= BASE_GAMEPLAY_PAUSE_ACTION_SECONDS) {
        const index = this.moveActions.indexOf(action);
        if (index >= 0) {
          this.moveActions.splice(index, 1);
        }
      }
    }
  }

  private queueCallback(kind: DelayedCallback['kind']): void {
    this.sequence += 1;
    this.delayedCallbacks.push({
      elapsedSeconds: 0,
      kind,
      sequence: this.sequence,
    });
  }

  private queueMove(item: PauseItem, end: BaseGameplayPausePoint): void {
    this.sequence += 1;
    this.moveActions.push({
      elapsedSeconds: 0,
      end,
      item,
      sequence: this.sequence,
      start: freezePoint(this.positions[item]),
    });
  }

  private assertUsable(action: string): void {
    if (this.disposedValue) {
      throw new Error(`Disposed base-gameplay pause state cannot ${action}`);
    }
  }
}

export function createBaseGameplayPauseLayout(
  input: BaseGameplayPauseLayoutInput,
  initialProgress: string,
): BaseGameplayPauseLayout {
  assertLayoutInput(input);
  if (typeof initialProgress !== 'string') {
    throw new TypeError('initialProgress must be a string');
  }
  const width = input.viewportWidth;
  const height = input.viewportHeight;
  const backgroundWidth = input.objectiveBackgroundWidth;
  const backgroundHeight = input.objectiveBackgroundHeight;
  const emptyProgress = initialProgress.length === 0;
  return Object.freeze({
    descriptionLocalPosition: freezePoint({
      x: backgroundWidth * 0.5,
      y: backgroundHeight * (emptyProgress ? 0.5845 : 0.635),
    }),
    fontSize: 24 * width / 400,
    objectiveBackgroundWorldPosition: freezePoint({
      x: width * 0.5,
      y: height - backgroundHeight * 0.5,
    }),
    pauseItemWorldPosition: freezePoint({
      x: 0.075 * width * input.contentScaleFactor,
      y: 0.075 * width,
    }),
    progressAnchor: freezePoint({ x: 0, y: 0.5 }),
    progressLocalPosition: freezePoint({
      x: backgroundWidth * 0.5,
      y: backgroundHeight * 0.4335,
    }),
    quitHidden: freezePoint({ x: width * 1.25, y: height * 0.15 }),
    quitShown: freezePoint({ x: width * 0.85, y: height * 0.15 }),
    replayHidden: freezePoint({ x: width * 1.25, y: height * 0.5 }),
    replayShown: freezePoint({ x: width * 0.65, y: height * 0.5 }),
    resumeHidden: freezePoint({ x: width * -0.15, y: height * 0.5 }),
    resumeShown: freezePoint({ x: width * 0.35, y: height * 0.5 }),
    rewardAnchor: freezePoint({ x: 0, y: 0.5 }),
    rewardLocalPosition: freezePoint({
      x: backgroundWidth * 0.4,
      y: backgroundHeight * (emptyProgress ? 0.335 : 0.275),
    }),
  });
}

function assertLayoutInput(input: BaseGameplayPauseLayoutInput): void {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('layout input must be an object');
  }
  assertPositiveFinite(input.viewportWidth, 'viewportWidth');
  assertPositiveFinite(input.viewportHeight, 'viewportHeight');
  assertPositiveFinite(input.objectiveBackgroundWidth, 'objectiveBackgroundWidth');
  assertPositiveFinite(input.objectiveBackgroundHeight, 'objectiveBackgroundHeight');
  assertPositiveFinite(input.contentScaleFactor, 'contentScaleFactor');
}

function freezeCard(
  card: BaseGameplayPauseObjectiveCard,
): BaseGameplayPauseObjectiveCard {
  if (card === null || typeof card !== 'object') {
    throw new TypeError('objective card must be an object');
  }
  for (const [label, value] of [
    ['description', card.description],
    ['progress', card.progress],
    ['reward', card.reward],
  ] as const) {
    if (typeof value !== 'string') {
      throw new TypeError(`objective card ${label} must be a string`);
    }
  }
  return Object.freeze({
    description: card.description,
    progress: card.progress,
    reward: card.reward,
  });
}

function freezePoint(point: BaseGameplayPausePoint): BaseGameplayPausePoint {
  assertFinite(point.x, 'point.x');
  assertFinite(point.y, 'point.y');
  return Object.freeze({ x: point.x, y: point.y });
}

function assertPositiveFinite(value: number, label: string): void {
  assertFinite(value, label);
  if (value <= 0) {
    throw new RangeError(`${label} must be positive`);
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  assertFinite(value, label);
  if (value < 0) {
    throw new RangeError(`${label} must be non-negative`);
  }
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
}
