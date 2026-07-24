import type {
  ObjectiveDefinition,
  ObjectiveId,
  ObjectivesManagerState,
} from './objectives-manager-state';
import {
  OBJECTIVES_COUNT,
  objectiveDefinitionAt,
} from './objectives-manager-state';

export const OBJECTIVES_SCREEN_INITIAL_VIEWED_SEQUENCE_POSITION = 0 as const;
export const OBJECTIVES_SCREEN_NO_VIEWED_SEQUENCE_POSITION = -1 as const;

const STATE_INPUT_KEYS = Object.freeze(['listMetrics', 'manager'] as const);
const LIST_METRICS_KEYS = Object.freeze([
  'bottomBound',
  'logicalHeight',
  'rowSpacing',
  'topBound',
] as const);
const OBJECTIVE_DEFINITION_KEYS = Object.freeze([
  'description',
  'id',
  'rewardCoins',
  'sequencePosition',
  'target',
] as const);

export interface ObjectivesScreenManagerPort extends Pick<
  ObjectivesManagerState,
  'activeObjective' | 'isFinished' | 'skip'
> {}

export interface ObjectivesScreenListMetrics {
  readonly bottomBound: number;
  readonly logicalHeight: number;
  readonly rowSpacing: number;
  readonly topBound: number;
}

export interface ObjectivesScreenStateInput {
  readonly listMetrics: ObjectivesScreenListMetrics;
  readonly manager: ObjectivesScreenManagerPort;
}

export interface ObjectivesScreenRowSnapshot {
  /**
   * Authoritative completion state used by UpdateBackground.
   * It may change after construction without changing label colors.
   */
  readonly finished: boolean;
  /** Completion state captured when ObjectiveItem::onEnter chose its colors. */
  readonly labelsFinishedAtConstruction: boolean;
  readonly objective: ObjectiveDefinition;
  readonly y: number;
}

export interface ObjectivesScreenCurrentCardSnapshot {
  /** The native custom objectives-next raster always overrides row completion texture. */
  readonly customBackground: true;
  /** Color selection is construction-time state even when Skip replaces the two strings. */
  readonly labelsFinishedAtConstruction: boolean;
  readonly objective: ObjectiveDefinition;
}

export type ObjectivesScreenViewedSequencePosition =
  | typeof OBJECTIVES_SCREEN_NO_VIEWED_SEQUENCE_POSITION
  | ObjectiveDefinition['sequencePosition'];

export interface ObjectivesScreenStateSnapshot {
  readonly currentCard: ObjectivesScreenCurrentCardSnapshot;
  readonly initialBaseY: number;
  readonly listMetrics: ObjectivesScreenListMetrics;
  readonly rows: readonly ObjectivesScreenRowSnapshot[];
  readonly viewedSequencePosition: ObjectivesScreenViewedSequencePosition;
}

export interface ObjectivesScreenDragResult {
  readonly appliedMovementY: number;
  readonly moved: boolean;
  /** Exact finite float32 equivalent of the native sign-bit flip: -deltaY. */
  readonly movementY: number;
  readonly viewedSequencePosition: ObjectivesScreenViewedSequencePosition;
}

export interface ObjectivesScreenSkipResult {
  readonly nextActiveObjective: ObjectiveDefinition;
  readonly previousActiveObjective: ObjectiveDefinition;
  readonly skippedObjectiveId: ObjectiveId;
  readonly viewedSequencePosition: ObjectivesScreenViewedSequencePosition;
}

/**
 * Pure authoritative list model for the recovered Objectives screen.
 *
 * The manager remains the only progression owner. This model snapshots its
 * definitions/completion state, owns only row coordinates and viewed-row
 * selection, and calls Skip with the manager's active objective rather than
 * the independently viewed row.
 */
export class ObjectivesScreenState {
  private readonly listMetricsValue: ObjectivesScreenListMetrics;
  private readonly manager: ObjectivesScreenManagerPort;
  private readonly initialBaseYValue: number;
  private readonly rowLabelFinishStates: readonly boolean[];
  private readonly currentCardLabelsFinishedAtConstruction: boolean;
  private currentCardObjectiveValue: ObjectiveDefinition;
  private rowFinishedValues: boolean[];
  private rowYValues: number[];
  private viewedSequencePositionValue: ObjectivesScreenViewedSequencePosition;

  constructor(input: ObjectivesScreenStateInput) {
    assertExactObject(input, STATE_INPUT_KEYS, 'input');
    this.manager = validateManager(input.manager);
    this.listMetricsValue = copyListMetrics(input.listMetrics);

    const activeObjective = readRequiredActiveObjective(this.manager);
    const initialRows = readAuthoritativeRows(this.manager);
    this.initialBaseYValue = addFloat32(
      this.listMetricsValue.topBound,
      multiplyFloat32(
        activeObjective.sequencePosition,
        this.listMetricsValue.rowSpacing,
      ),
    );
    this.rowYValues = initialRows.map((_, sequencePosition) => subtractFloat32(
      this.initialBaseYValue,
      multiplyFloat32(sequencePosition, this.listMetricsValue.rowSpacing),
    ));
    this.rowFinishedValues = initialRows.map(({ finished }) => finished);
    this.rowLabelFinishStates = Object.freeze(
      initialRows.map(({ finished }) => finished),
    );
    this.currentCardObjectiveValue = activeObjective;
    this.currentCardLabelsFinishedAtConstruction = readFinished(
      this.manager,
      activeObjective.id,
    );
    this.viewedSequencePositionValue = nearestViewedSequencePosition(
      this.rowYValues,
      this.initialBaseYValue,
      this.listMetricsValue.logicalHeight,
    );
  }

  get snapshot(): ObjectivesScreenStateSnapshot {
    const definitions = canonicalObjectiveDefinitions();
    const rows = definitions.map((objective, sequencePosition) => Object.freeze({
      finished: requireArrayValue(
        this.rowFinishedValues,
        sequencePosition,
        'rowFinishedValues',
      ),
      labelsFinishedAtConstruction: requireArrayValue(
        this.rowLabelFinishStates,
        sequencePosition,
        'rowLabelFinishStates',
      ),
      objective,
      y: requireArrayValue(this.rowYValues, sequencePosition, 'rowYValues'),
    }));
    return deepFreeze({
      currentCard: {
        customBackground: true as const,
        labelsFinishedAtConstruction:
          this.currentCardLabelsFinishedAtConstruction,
        objective: this.currentCardObjectiveValue,
      },
      initialBaseY: this.initialBaseYValue,
      listMetrics: this.listMetricsValue,
      rows,
      viewedSequencePosition: this.viewedSequencePositionValue,
    });
  }

  /**
   * Applies the full -deltaY only when the pre-move first/last-row gate passes.
   * No clamp, snap, inertia, easing, or fixed-card movement is performed.
   */
  drag(deltaY: number): ObjectivesScreenDragResult {
    const movementY = Math.fround(-finiteFloat32(deltaY, 'deltaY'));
    const firstRowY = requireArrayValue(this.rowYValues, 0, 'rowYValues');
    const lastRowY = requireArrayValue(
      this.rowYValues,
      OBJECTIVES_COUNT - 1,
      'rowYValues',
    );
    const canMove = (
      movementY > 0
      && lastRowY <= this.listMetricsValue.topBound
    ) || (
      movementY < 0
      && firstRowY >= this.listMetricsValue.bottomBound
    );
    const nextRowYValues = canMove
      ? this.rowYValues.map((rowY, sequencePosition) => finiteFloat32(
        addFloat32(rowY, movementY),
        `rows[${sequencePosition}].y after movement`,
      ))
      : this.rowYValues;
    const nextViewedSequencePosition = nearestViewedSequencePosition(
      nextRowYValues,
      this.initialBaseYValue,
      this.listMetricsValue.logicalHeight,
    );

    if (canMove) {
      this.rowYValues = nextRowYValues;
    }
    this.viewedSequencePositionValue = nextViewedSequencePosition;
    return Object.freeze({
      appliedMovementY: canMove ? movementY : 0,
      moved: canMove,
      movementY,
      viewedSequencePosition: nextViewedSequencePosition,
    });
  }

  /**
   * Calls manager.skip with the authoritative active ID, then refreshes every
   * completion background and the fixed-current definition from that manager.
   * Existing row positions and construction-time label colors are retained.
   */
  skipActiveObjective(): ObjectivesScreenSkipResult {
    const previousActiveObjective = readRequiredActiveObjective(this.manager);
    this.manager.skip(previousActiveObjective.id);

    const nextActiveObjective = readRequiredActiveObjective(this.manager);
    const authoritativeRows = readAuthoritativeRows(this.manager);
    this.currentCardObjectiveValue = nextActiveObjective;
    this.rowFinishedValues = authoritativeRows.map(({ finished }) => finished);

    return deepFreeze({
      nextActiveObjective,
      previousActiveObjective,
      skippedObjectiveId: previousActiveObjective.id,
      viewedSequencePosition: this.viewedSequencePositionValue,
    });
  }

  /**
   * Synchronizes background completion and the fixed card after an external
   * manager mutation without changing scroll coordinates or item label colors.
   */
  refreshFromManager(): ObjectivesScreenStateSnapshot {
    const activeObjective = readRequiredActiveObjective(this.manager);
    const authoritativeRows = readAuthoritativeRows(this.manager);
    this.currentCardObjectiveValue = activeObjective;
    this.rowFinishedValues = authoritativeRows.map(({ finished }) => finished);
    return this.snapshot;
  }
}

function readAuthoritativeRows(
  manager: ObjectivesScreenManagerPort,
): readonly Readonly<{
  readonly finished: boolean;
  readonly objective: ObjectiveDefinition;
}>[] {
  return Object.freeze(canonicalObjectiveDefinitions().map((objective) => Object.freeze({
    finished: readFinished(manager, objective.id),
    objective,
  })));
}

function canonicalObjectiveDefinitions(): readonly ObjectiveDefinition[] {
  return Object.freeze(Array.from(
    { length: OBJECTIVES_COUNT },
    (_, sequencePosition) => {
      const definition = objectiveDefinitionAt(sequencePosition);
      if (definition === null) {
        throw new Error(
          `Objective sequence position ${sequencePosition} has no recovered definition`,
        );
      }
      return definition;
    },
  ));
}

function readRequiredActiveObjective(
  manager: ObjectivesScreenManagerPort,
): ObjectiveDefinition {
  const candidate = manager.activeObjective();
  if (candidate === null) {
    throw new RangeError('Objectives screen requires an active objective from 0 through 51');
  }
  return copyCanonicalObjective(candidate, 'manager.activeObjective()');
}

function copyCanonicalObjective(
  candidate: unknown,
  label: string,
): ObjectiveDefinition {
  assertExactObject(candidate, OBJECTIVE_DEFINITION_KEYS, label);
  const sequencePosition = candidate.sequencePosition;
  if (
    typeof sequencePosition !== 'number'
    || !Number.isInteger(sequencePosition)
    || sequencePosition < 0
    || sequencePosition >= OBJECTIVES_COUNT
  ) {
    throw new RangeError(`${label}.sequencePosition must be an integer from 0 through 51`);
  }
  const canonical = objectiveDefinitionAt(sequencePosition);
  if (canonical === null) {
    throw new RangeError(`${label}.sequencePosition is unavailable`);
  }
  if (
    candidate.description !== canonical.description
    || candidate.id !== canonical.id
    || candidate.rewardCoins !== canonical.rewardCoins
    || candidate.target !== canonical.target
  ) {
    throw new RangeError(`${label} must match the recovered objective definition`);
  }
  return canonical;
}

function readFinished(
  manager: ObjectivesScreenManagerPort,
  objectiveId: ObjectiveId,
): boolean {
  const finished = manager.isFinished(objectiveId);
  if (typeof finished !== 'boolean') {
    throw new TypeError(`manager.isFinished(${objectiveId}) must return a boolean`);
  }
  return finished;
}

function nearestViewedSequencePosition(
  rowYValues: readonly number[],
  initialBaseY: number,
  logicalHeight: number,
): ObjectivesScreenViewedSequencePosition {
  let bestDistance = logicalHeight;
  let nearest: ObjectivesScreenViewedSequencePosition
    = OBJECTIVES_SCREEN_NO_VIEWED_SEQUENCE_POSITION;
  for (
    let sequencePosition = 0;
    sequencePosition < OBJECTIVES_COUNT;
    sequencePosition += 1
  ) {
    const distance = Math.abs(subtractFloat32(
      requireArrayValue(rowYValues, sequencePosition, 'rowYValues'),
      initialBaseY,
    ));
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = sequencePosition;
    }
  }
  return nearest;
}

function validateManager(candidate: unknown): ObjectivesScreenManagerPort {
  if (
    candidate === null
    || typeof candidate !== 'object'
    || Array.isArray(candidate)
  ) {
    throw new TypeError('input.manager must be an object');
  }
  const manager = candidate as Partial<ObjectivesScreenManagerPort>;
  if (
    typeof manager.activeObjective !== 'function'
    || typeof manager.isFinished !== 'function'
    || typeof manager.skip !== 'function'
  ) {
    throw new TypeError(
      'input.manager requires activeObjective, isFinished, and skip methods',
    );
  }
  return manager as ObjectivesScreenManagerPort;
}

function copyListMetrics(candidate: unknown): ObjectivesScreenListMetrics {
  assertExactObject(candidate, LIST_METRICS_KEYS, 'input.listMetrics');
  const bottomBound = finiteFloat32(
    candidate.bottomBound,
    'input.listMetrics.bottomBound',
  );
  const logicalHeight = positiveFiniteFloat32(
    candidate.logicalHeight,
    'input.listMetrics.logicalHeight',
  );
  const rowSpacing = positiveFiniteFloat32(
    candidate.rowSpacing,
    'input.listMetrics.rowSpacing',
  );
  const topBound = finiteFloat32(
    candidate.topBound,
    'input.listMetrics.topBound',
  );
  if (bottomBound >= topBound) {
    throw new RangeError('input.listMetrics.bottomBound must be below topBound');
  }
  return Object.freeze({
    bottomBound,
    logicalHeight,
    rowSpacing,
    topBound,
  });
}

function assertExactObject(
  candidate: unknown,
  expectedKeys: readonly string[],
  label: string,
): asserts candidate is Record<string, unknown> {
  if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new TypeError(`${label} must be an object`);
  }
  const keys = Object.keys(candidate);
  if (
    keys.length !== expectedKeys.length
    || expectedKeys.some((key) => !Object.prototype.hasOwnProperty.call(candidate, key))
  ) {
    throw new RangeError(`${label} must contain exactly ${expectedKeys.join(', ')}`);
  }
}

function requireArrayValue<T>(
  values: readonly T[],
  index: number,
  label: string,
): T {
  const value = values[index];
  if (value === undefined) {
    throw new Error(`${label}[${index}] is unavailable`);
  }
  return value;
}

function positiveFiniteFloat32(value: unknown, label: string): number {
  const floatValue = finiteFloat32(value, label);
  if (floatValue <= 0) {
    throw new RangeError(`${label} must be positive in float32`);
  }
  return floatValue;
}

function finiteFloat32(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite in float32`);
  }
  const floatValue = Math.fround(value);
  if (!Number.isFinite(floatValue)) {
    throw new RangeError(`${label} must be finite in float32`);
  }
  return floatValue;
}

function addFloat32(left: number, right: number): number {
  return Math.fround(Math.fround(left) + Math.fround(right));
}

function subtractFloat32(left: number, right: number): number {
  return Math.fround(Math.fround(left) - Math.fround(right));
}

function multiplyFloat32(left: number, right: number): number {
  return Math.fround(Math.fround(left) * Math.fround(right));
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      deepFreeze(record[key]);
    }
    Object.freeze(value);
  }
  return value;
}
