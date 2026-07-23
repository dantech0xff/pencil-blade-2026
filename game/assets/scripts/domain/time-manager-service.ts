export const TIME_MANAGER_LABEL_FONT_PATH = 'Fonts/MotorwerkOblique.ttf' as const;
export const TIME_MANAGER_FREEZE_CLOCK_PATH
  = 'Interfaces/object-time-freeze.png' as const;
export const TIME_MANAGER_TICK_AUDIO_PATH = 'Sounds/timetick.wav' as const;
export const TIME_MANAGER_TIME_UP_AUDIO_PATH = 'Sounds/timeup.wav' as const;
export const TIME_MANAGER_FREEZE_AUDIO_PATH = 'Sounds/freeze.wav' as const;
export const TIME_MANAGER_TIME_UP_RASTER_PATH = 'Text/text-time-up.png' as const;

export const TIME_MANAGER_INITIAL_WARNING_SECOND = 10 as const;
export const TIME_MANAGER_FREEZE_SECONDS = Math.fround(15);
export const TIME_MANAGER_FREEZE_RAMP_SECONDS = Math.fround(1.5);
export const TIME_MANAGER_FREEZE_FADE_START_SECONDS = Math.fround(13.5);
export const TIME_MANAGER_LABEL_FADE_SECONDS = Math.fround(1);
export const TIME_MANAGER_TIME_UP_MOVE_SECONDS = Math.fround(1);
export const TIME_MANAGER_TIME_UP_DELAY_SECONDS = Math.fround(1);
export const TIME_MANAGER_TIME_UP_TOTAL_SECONDS = Math.fround(3);
export const TIME_MANAGER_Z_ORDER = 1 as const;

export interface TimeManagerColor {
  readonly blue: number;
  readonly green: number;
  readonly red: number;
}

export interface TimeManagerPoint {
  readonly x: number;
  readonly y: number;
}

export interface TimeManagerVisibleRect {
  readonly center: TimeManagerPoint;
  readonly height: number;
  readonly leftX: number;
  readonly rightX: number;
  readonly topY: number;
  readonly width: number;
}

export interface TimeManagerEntryInput {
  readonly freezeClockHeight: number;
  readonly freezeClockWidth: number;
  readonly initialRemainingSeconds: number;
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  readonly visibleRect: TimeManagerVisibleRect;
}

export interface TimeManagerEntryPlan {
  readonly freezeClock: Readonly<{
    readonly initialVisible: false;
    readonly rasterPath: typeof TIME_MANAGER_FREEZE_CLOCK_PATH;
    readonly worldPosition: TimeManagerPoint;
    readonly zOrder: 1;
  }>;
  readonly label: Readonly<{
    readonly color: TimeManagerColor;
    readonly fadeInSeconds: number;
    readonly fontPath: typeof TIME_MANAGER_LABEL_FONT_PATH;
    readonly fontSize: number;
    readonly initialText: string;
    readonly worldPosition: TimeManagerPoint;
    readonly zOrder: 1;
  }>;
}

export interface TimeManagerTimeUpPresentationInput {
  readonly spriteHeight: number;
  readonly spriteWidth: number;
  readonly visibleRect: TimeManagerVisibleRect;
}

export interface TimeManagerTimeUpPresentationPlan {
  readonly actionSequence: readonly [
    Readonly<{
      readonly durationSeconds: number;
      readonly position: TimeManagerPoint;
      readonly type: 'move-to';
    }>,
    Readonly<{
      readonly durationSeconds: number;
      readonly type: 'delay';
    }>,
    Readonly<{
      readonly durationSeconds: number;
      readonly position: TimeManagerPoint;
      readonly type: 'move-to';
    }>,
    Readonly<{
      readonly type: 'invoke-time-up-finish';
    }>,
  ];
  readonly initialWorldPosition: TimeManagerPoint;
  readonly rasterPath: typeof TIME_MANAGER_TIME_UP_RASTER_PATH;
  readonly totalActionSeconds: number;
  readonly zOrder: 1;
}

export interface TimeManagerOptions {
  readonly effectsEnabled: () => boolean;
  readonly totalSeconds: number;
}

export interface TimeManagerSnapshot {
  readonly freezeClockColorByte: number;
  readonly freezeElapsedSeconds: number;
  readonly frozen: boolean;
  readonly labelColor: TimeManagerColor;
  readonly remainingSeconds: number;
  readonly scheduled: boolean;
  readonly totalSeconds: number;
  readonly warningSecond: number;
}

export type TimeManagerCommand =
  | Readonly<{
      readonly canonicalPath:
        | typeof TIME_MANAGER_TICK_AUDIO_PATH
        | typeof TIME_MANAGER_TIME_UP_AUDIO_PATH
        | typeof TIME_MANAGER_FREEZE_AUDIO_PATH;
      readonly loop: false;
      readonly type: 'request-audio';
    }>
  | Readonly<{
      readonly color: TimeManagerColor;
      readonly type: 'set-timer-label-color';
    }>
  | Readonly<{
      readonly text: string;
      readonly type: 'set-timer-label-text';
    }>
  | Readonly<{
      readonly type: 'invoke-time-up';
    }>
  | Readonly<{
      readonly type: 'begin-time-up-presentation';
    }>
  | Readonly<{
      readonly type: 'invoke-time-up-finish';
    }>
  | Readonly<{
      readonly colorByte: number;
      readonly type: 'set-freeze-clock-color';
    }>
  | Readonly<{
      readonly opacity: number;
      readonly type: 'set-freeze-clock-opacity';
    }>
  | Readonly<{
      readonly type: 'invoke-freeze-start';
    }>
  | Readonly<{
      readonly type: 'invoke-freeze-finish';
    }>
  | Readonly<{
      readonly type: 'set-freeze-clock-visible';
      readonly visible: boolean;
    }>
  | Readonly<{
      readonly bonusType: 12;
      readonly type: 'disable-bonus-type';
    }>;

export const TIME_MANAGER_NORMAL_COLOR: TimeManagerColor = frozenColor(71, 71, 71);
export const TIME_MANAGER_WARNING_COLOR: TimeManagerColor = frozenColor(247, 147, 30);

/**
 * Recovered TimeManager state machine. The returned command batches preserve synchronous
 * callback/presenter order while keeping the domain independent from Cocos Creator.
 */
export class TimeManagerService {
  private readonly effectsEnabledSource: () => boolean;
  private totalSecondsValue: number;
  private remainingSecondsValue: number;
  private freezeElapsedSecondsValue = Math.fround(0);
  private warningSecondValue = TIME_MANAGER_INITIAL_WARNING_SECOND;
  private frozenValue = false;
  private scheduledValue = false;
  private labelColorValue = TIME_MANAGER_NORMAL_COLOR;
  private freezeClockColorByteValue = 255;

  constructor(options: TimeManagerOptions) {
    assertOptions(options);
    this.effectsEnabledSource = options.effectsEnabled;
    this.totalSecondsValue = toFiniteFloat32(options.totalSeconds, 'totalSeconds');
    this.remainingSecondsValue = this.totalSecondsValue;
  }

  get snapshot(): TimeManagerSnapshot {
    return Object.freeze({
      freezeClockColorByte: this.freezeClockColorByteValue,
      freezeElapsedSeconds: this.freezeElapsedSecondsValue,
      frozen: this.frozenValue,
      labelColor: this.labelColorValue,
      remainingSeconds: this.remainingSecondsValue,
      scheduled: this.scheduledValue,
      totalSeconds: this.totalSecondsValue,
      warningSecond: this.warningSecondValue,
    });
  }

  setTotalTime(totalSeconds: number): void {
    const value = toFiniteFloat32(totalSeconds, 'totalSeconds');
    this.totalSecondsValue = value;
    this.remainingSecondsValue = value;
  }

  /** Recovered Start schedules only; it does not reset any timer or presentation state. */
  start(): void {
    this.scheduledValue = true;
  }

  /** Recovered Stop unschedules only and preserves all other state. */
  stop(): void {
    this.scheduledValue = false;
  }

  /** Recovered Restart resets remaining and the warning cursor only; it does not schedule. */
  restart(): void {
    this.remainingSecondsValue = this.totalSecondsValue;
    this.warningSecondValue = TIME_MANAGER_INITIAL_WARNING_SECOND;
  }

  freeze(): readonly TimeManagerCommand[] {
    // Read the injected settings port before mutating freeze state. Native settings reads
    // cannot fail; this target validation keeps a broken Creator adapter retryable.
    const effectsEnabled = this.readEffectsEnabled();
    this.frozenValue = true;
    this.freezeElapsedSecondsValue = Math.fround(0);
    this.freezeClockColorByteValue = 255;

    const commands: TimeManagerCommand[] = [];
    if (effectsEnabled) {
      commands.push(frozenCommand({
        canonicalPath: TIME_MANAGER_FREEZE_AUDIO_PATH,
        loop: false,
        type: 'request-audio',
      }));
    }
    commands.push(
      frozenCommand({ colorByte: 255, type: 'set-freeze-clock-color' }),
      frozenCommand({ type: 'invoke-freeze-start' }),
      frozenCommand({ type: 'set-freeze-clock-visible', visible: true }),
      frozenCommand({ opacity: 0, type: 'set-freeze-clock-opacity' }),
    );
    return frozenBatch(commands);
  }

  /** Native DisableFreeze has no already-thawed guard. */
  disableFreeze(): readonly TimeManagerCommand[] {
    this.frozenValue = false;
    return frozenBatch([
      frozenCommand({ type: 'invoke-freeze-finish' }),
      frozenCommand({ type: 'set-freeze-clock-visible', visible: false }),
      frozenCommand({ bonusType: 12, type: 'disable-bonus-type' }),
    ]);
  }

  timeUpPresentationFinished(): readonly TimeManagerCommand[] {
    return frozenBatch([frozenCommand({ type: 'invoke-time-up-finish' })]);
  }

  update(deltaSeconds: number): readonly TimeManagerCommand[] {
    const delta = toFiniteNonNegativeFloat32(deltaSeconds, 'deltaSeconds');
    if (!this.scheduledValue) {
      return Object.freeze([]);
    }
    return this.frozenValue
      ? this.updateFrozen(delta)
      : this.updateCountdown(delta);
  }

  private updateCountdown(deltaSeconds: number): readonly TimeManagerCommand[] {
    const nextRemainingSeconds = Math.fround(
      this.remainingSecondsValue - deltaSeconds,
    );

    const minutes = Math.trunc(nextRemainingSeconds / Math.fround(60));
    const truncatedSeconds = Math.trunc(nextRemainingSeconds);
    const seconds = truncatedSeconds % 60;
    const labelText = seconds > 9
      ? `${minutes}:${seconds}`
      : `${minutes}:0${seconds}`;

    const warningReached = minutes === 0 && seconds === this.warningSecondValue;
    const expired = nextRemainingSeconds <= 0;
    const effectsEnabled = warningReached || expired
      ? this.readEffectsEnabled()
      : false;

    // All external reads are now validated; commit the recovered countdown mutation.
    this.remainingSecondsValue = nextRemainingSeconds;
    const commands: TimeManagerCommand[] = [];
    if (warningReached) {
      if (effectsEnabled) {
        commands.push(frozenCommand({
          canonicalPath: TIME_MANAGER_TICK_AUDIO_PATH,
          loop: false,
          type: 'request-audio',
        }));
      }
      this.warningSecondValue -= 1;
      this.labelColorValue = this.labelColorValue.red === TIME_MANAGER_NORMAL_COLOR.red
        ? TIME_MANAGER_WARNING_COLOR
        : TIME_MANAGER_NORMAL_COLOR;
      commands.push(frozenCommand({
        color: this.labelColorValue,
        type: 'set-timer-label-color',
      }));
    }

    if (expired) {
      if (effectsEnabled) {
        commands.push(frozenCommand({
          canonicalPath: TIME_MANAGER_TIME_UP_AUDIO_PATH,
          loop: false,
          type: 'request-audio',
        }));
      }
      this.stop();
      commands.push(
        frozenCommand({ type: 'invoke-time-up' }),
        frozenCommand({ type: 'begin-time-up-presentation' }),
      );
    }

    commands.push(frozenCommand({
      text: labelText,
      type: 'set-timer-label-text',
    }));
    return frozenBatch(commands);
  }

  private updateFrozen(deltaSeconds: number): readonly TimeManagerCommand[] {
    this.freezeElapsedSecondsValue = Math.fround(
      this.freezeElapsedSecondsValue + deltaSeconds,
    );

    if (this.freezeElapsedSecondsValue >= TIME_MANAGER_FREEZE_SECONDS) {
      const commands = [...this.disableFreeze()];
      commands.push(frozenCommand({
        colorByte: this.freezeClockColorByteValue,
        type: 'set-freeze-clock-color',
      }));
      return frozenBatch(commands);
    }

    this.freezeClockColorByteValue = freezeClockIntensity(
      this.freezeElapsedSecondsValue,
    );
    return frozenBatch([
      frozenCommand({
        opacity: this.freezeClockColorByteValue,
        type: 'set-freeze-clock-opacity',
      }),
      frozenCommand({
        colorByte: this.freezeClockColorByteValue,
        type: 'set-freeze-clock-color',
      }),
    ]);
  }

  private readEffectsEnabled(): boolean {
    const enabled = this.effectsEnabledSource();
    if (typeof enabled !== 'boolean') {
      throw new TypeError('effectsEnabled() must return a boolean');
    }
    return enabled;
  }
}

export function createTimeManagerEntryPlan(
  input: TimeManagerEntryInput,
): TimeManagerEntryPlan {
  assertEntryInput(input);
  const scale = Math.fround(input.logicalWidth / 480);
  return Object.freeze({
    freezeClock: Object.freeze({
      initialVisible: false,
      rasterPath: TIME_MANAGER_FREEZE_CLOCK_PATH,
      worldPosition: frozenPoint(
        input.visibleRect.rightX - Math.fround(input.freezeClockWidth * 0.5),
        input.visibleRect.topY - Math.fround(input.freezeClockHeight * 0.5),
      ),
      zOrder: TIME_MANAGER_Z_ORDER,
    }),
    label: Object.freeze({
      color: TIME_MANAGER_NORMAL_COLOR,
      fadeInSeconds: TIME_MANAGER_LABEL_FADE_SECONDS,
      fontPath: TIME_MANAGER_LABEL_FONT_PATH,
      fontSize: Math.fround(scale * 36),
      initialText: `${Math.trunc(input.initialRemainingSeconds)}`,
      worldPosition: frozenPoint(
        Math.fround(input.logicalWidth * 0.85),
        Math.fround(input.logicalHeight * 0.95),
      ),
      zOrder: TIME_MANAGER_Z_ORDER,
    }),
  });
}

export function createTimeManagerTimeUpPresentationPlan(
  input: TimeManagerTimeUpPresentationInput,
): TimeManagerTimeUpPresentationPlan {
  assertPositiveFinite(input?.spriteWidth, 'spriteWidth');
  assertPositiveFinite(input?.spriteHeight, 'spriteHeight');
  assertVisibleRect(input?.visibleRect);

  const y = input.visibleRect.center.y;
  const center = frozenPoint(input.visibleRect.center.x, y);
  const exit = frozenPoint(
    input.visibleRect.rightX + Math.fround(input.spriteWidth * 0.5),
    y,
  );
  return Object.freeze({
    actionSequence: Object.freeze([
      Object.freeze({
        durationSeconds: TIME_MANAGER_TIME_UP_MOVE_SECONDS,
        position: center,
        type: 'move-to',
      }),
      Object.freeze({
        durationSeconds: TIME_MANAGER_TIME_UP_DELAY_SECONDS,
        type: 'delay',
      }),
      Object.freeze({
        durationSeconds: TIME_MANAGER_TIME_UP_MOVE_SECONDS,
        position: exit,
        type: 'move-to',
      }),
      Object.freeze({ type: 'invoke-time-up-finish' }),
    ] as const),
    initialWorldPosition: frozenPoint(
      input.visibleRect.leftX - Math.fround(input.spriteWidth * 0.5),
      y,
    ),
    rasterPath: TIME_MANAGER_TIME_UP_RASTER_PATH,
    totalActionSeconds: TIME_MANAGER_TIME_UP_TOTAL_SECONDS,
    zOrder: TIME_MANAGER_Z_ORDER,
  });
}

export function formatTimeManagerCountdown(remainingSeconds: number): string {
  const remaining = toFiniteFloat32(remainingSeconds, 'remainingSeconds');
  const minutes = Math.trunc(remaining / Math.fround(60));
  const seconds = Math.trunc(remaining) % 60;
  return seconds > 9 ? `${minutes}:${seconds}` : `${minutes}:0${seconds}`;
}

function freezeClockIntensity(elapsedSeconds: number): number {
  if (elapsedSeconds <= TIME_MANAGER_FREEZE_RAMP_SECONDS) {
    const dividedByDuration = Math.fround(
      elapsedSeconds / TIME_MANAGER_FREEZE_SECONDS,
    );
    const dividedByTenth = Math.fround(dividedByDuration / Math.fround(0.1));
    return toColorByte(Math.fround(Math.fround(255) * dividedByTenth));
  }
  if (elapsedSeconds <= TIME_MANAGER_FREEZE_FADE_START_SECONDS) {
    return 255;
  }
  const fadeElapsed = Math.fround(
    elapsedSeconds - TIME_MANAGER_FREEZE_FADE_START_SECONDS,
  );
  const fadeRatio = Math.fround(fadeElapsed / TIME_MANAGER_FREEZE_RAMP_SECONDS);
  const remainingRatio = Math.fround(Math.fround(1) - fadeRatio);
  return toColorByte(Math.fround(Math.fround(255) * remainingRatio));
}

function toColorByte(value: number): number {
  return Math.max(0, Math.min(255, Math.trunc(value)));
}

function assertOptions(options: TimeManagerOptions): void {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('options must be an object');
  }
  if (typeof options.effectsEnabled !== 'function') {
    throw new TypeError('effectsEnabled must be a function');
  }
  toFiniteFloat32(options.totalSeconds, 'totalSeconds');
}

function assertEntryInput(input: TimeManagerEntryInput): void {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('input must be an object');
  }
  assertPositiveFinite(input.logicalWidth, 'logicalWidth');
  assertPositiveFinite(input.logicalHeight, 'logicalHeight');
  assertPositiveFinite(input.freezeClockWidth, 'freezeClockWidth');
  assertPositiveFinite(input.freezeClockHeight, 'freezeClockHeight');
  assertFinite(input.initialRemainingSeconds, 'initialRemainingSeconds');
  assertVisibleRect(input.visibleRect);
}

function assertVisibleRect(rect: TimeManagerVisibleRect): void {
  if (rect === null || typeof rect !== 'object' || Array.isArray(rect)) {
    throw new TypeError('visibleRect must be an object');
  }
  assertPositiveFinite(rect.width, 'visibleRect.width');
  assertPositiveFinite(rect.height, 'visibleRect.height');
  assertFinite(rect.leftX, 'visibleRect.leftX');
  assertFinite(rect.rightX, 'visibleRect.rightX');
  assertFinite(rect.topY, 'visibleRect.topY');
  assertPoint(rect.center, 'visibleRect.center');
  if (rect.rightX <= rect.leftX) {
    throw new RangeError('visibleRect.rightX must be greater than leftX');
  }
}

function assertPoint(point: TimeManagerPoint, label: string): void {
  if (point === null || typeof point !== 'object' || Array.isArray(point)) {
    throw new TypeError(`${label} must be an object`);
  }
  assertFinite(point.x, `${label}.x`);
  assertFinite(point.y, `${label}.y`);
}

function assertPositiveFinite(value: number, label: string): void {
  assertFinite(value, label);
  if (value <= 0) {
    throw new RangeError(`${label} must be positive`);
  }
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} must be finite`);
  }
}

function toFiniteFloat32(value: number, label: string): number {
  assertFinite(value, label);
  const result = Math.fround(value);
  if (!Number.isFinite(result)) {
    throw new RangeError(`${label} is outside the float32 range`);
  }
  return result;
}

function toFiniteNonNegativeFloat32(value: number, label: string): number {
  const result = toFiniteFloat32(value, label);
  if (result < 0) {
    throw new RangeError(`${label} must be non-negative`);
  }
  return result;
}

function frozenPoint(x: number, y: number): TimeManagerPoint {
  return Object.freeze({ x: Math.fround(x), y: Math.fround(y) });
}

function frozenColor(red: number, green: number, blue: number): TimeManagerColor {
  return Object.freeze({ blue, green, red });
}

function frozenCommand<T extends TimeManagerCommand>(command: T): T {
  return Object.freeze(command);
}

function frozenBatch(
  commands: readonly TimeManagerCommand[],
): readonly TimeManagerCommand[] {
  return Object.freeze([...commands]);
}
