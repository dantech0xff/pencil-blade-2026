/**
 * Standard Classic's recovered orthogonal state dimensions.
 *
 * This domain service owns no countdown. Presentation, physics and scene APIs
 * interpret the returned commands without becoming owners of game state.
 */

export const CLASSIC_MODE_ID = 0;

export const CLASSIC_SESSION_TOSS_ORDER = Object.freeze([
  'normal-free',
  'dragon-free',
  'magnet-free',
  'electric-free',
  'fruit-concurrent',
  'fruit-wave',
  'bomb-free',
  'bomb-concurrent',
  'bomb-wave',
] as const);

export type ClassicTossControllerId = (typeof CLASSIC_SESSION_TOSS_ORDER)[number];
export type ClassicLifecycle = 'intro' | 'running' | 'result-removed';

export type ClassicSessionCommand =
  | Readonly<{ type: 'set-cut-enabled'; enabled: boolean }>
  | Readonly<{ type: 'toss-controller'; action: 'start' | 'stop'; controller: ClassicTossControllerId }>
  | Readonly<{ type: 'stop-electric-bomb' }>
  | Readonly<{ type: 'set-physics-stopped'; stopped: boolean }>
  | Readonly<{ type: 'add-score'; value: number }>
  | Readonly<{ type: 'show-game-over' }>
  | Readonly<{ type: 'stop-effects' }>
  | Readonly<{ type: 'construct-result' }>
  | Readonly<{ type: 'set-result-mode'; mode: 0 }>
  | Readonly<{ type: 'set-result-score'; score: number }>
  | Readonly<{ type: 'remove-classic'; cleanup: true }>
  | Readonly<{ type: 'attach-result'; zOrder: 1 }>;

export interface ClassicSessionSnapshot {
  readonly cutEnabled: boolean;
  readonly hasTimeManager: false;
  readonly lifecycle: ClassicLifecycle;
  readonly mode: 0;
  readonly terminalPresentationGuard: boolean;
  readonly worldStopped: boolean;
}

export class ClassicSession {
  private lifecycle: ClassicLifecycle = 'intro';
  private terminalPresentationGuard = false;
  private cutEnabled = true;
  private worldStopped = false;

  snapshot(): ClassicSessionSnapshot {
    return Object.freeze({
      cutEnabled: this.cutEnabled,
      hasTimeManager: false,
      lifecycle: this.lifecycle,
      mode: CLASSIC_MODE_ID,
      terminalPresentationGuard: this.terminalPresentationGuard,
      worldStopped: this.worldStopped,
    });
  }

  /** Luck completion redundantly enables cutting before starting all nine timers. */
  completeIntro(): readonly ClassicSessionCommand[] {
    if (this.lifecycle !== 'intro') {
      throw new Error('Classic intro can complete only once');
    }

    this.lifecycle = 'running';
    this.cutEnabled = true;

    const commands: ClassicSessionCommand[] = [
      Object.freeze({ type: 'set-cut-enabled', enabled: true }),
    ];
    for (const controller of CLASSIC_SESSION_TOSS_ORDER) {
      commands.push(Object.freeze({ type: 'toss-controller', action: 'start', controller }));
    }
    return Object.freeze(commands);
  }

  /** Every fail callback repeats shutdown; only terminal presentation is guarded. */
  gameOverFromMiss(): readonly ClassicSessionCommand[] {
    const commands = this.shutdownGameplay();
    const terminal = this.armTerminalPresentation();
    if (terminal) {
      commands.push(terminal);
    }
    return Object.freeze(commands);
  }

  /** The explosion presenter must already be attached before this notification. */
  bombHit(): readonly ClassicSessionCommand[] {
    const commands = this.shutdownGameplay();
    this.worldStopped = true;
    commands.push(Object.freeze({ type: 'set-physics-stopped', stopped: true }));
    commands.push(Object.freeze({ type: 'add-score', value: -10 }));
    return Object.freeze(commands);
  }

  /** Guarded Game/Over runs before the last-writer physics Boolean is cleared. */
  afterBombHit(): readonly ClassicSessionCommand[] {
    const commands: ClassicSessionCommand[] = [];
    const terminal = this.armTerminalPresentation();
    if (terminal) {
      commands.push(terminal);
    }
    this.worldStopped = false;
    commands.push(Object.freeze({ type: 'set-physics-stopped', stopped: false }));
    return Object.freeze(commands);
  }

  displayScoreComplete(totalScore: number): readonly ClassicSessionCommand[] {
    // The native callback names this getter `getBestScore`, but it reads the same
    // authoritative field as `getTotalScore`; the result layer receives the completed run.
    assertInteger(totalScore, 'totalScore');
    this.lifecycle = 'result-removed';

    return Object.freeze([
      Object.freeze({ type: 'stop-effects' }),
      Object.freeze({ type: 'construct-result' }),
      Object.freeze({ type: 'set-result-mode', mode: CLASSIC_MODE_ID }),
      Object.freeze({ type: 'set-result-score', score: totalScore }),
      Object.freeze({ type: 'remove-classic', cleanup: true }),
      Object.freeze({ type: 'attach-result', zOrder: 1 }),
    ]);
  }

  private shutdownGameplay(): ClassicSessionCommand[] {
    this.cutEnabled = false;
    const commands: ClassicSessionCommand[] = [
      Object.freeze({ type: 'set-cut-enabled', enabled: false }),
    ];
    for (const controller of CLASSIC_SESSION_TOSS_ORDER) {
      commands.push(Object.freeze({ type: 'toss-controller', action: 'stop', controller }));
    }
    commands.push(Object.freeze({ type: 'stop-electric-bomb' }));
    return commands;
  }

  private armTerminalPresentation(): ClassicSessionCommand | null {
    if (this.terminalPresentationGuard) {
      return null;
    }
    this.terminalPresentationGuard = true;
    return Object.freeze({ type: 'show-game-over' });
  }
}

function assertInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer`);
  }
}
