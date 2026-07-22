import { _decorator, Component } from 'cc';

import {
  ClassicSession,
  type ClassicSessionCommand,
  type ClassicSessionSnapshot,
} from '../domain/classic-session';
import { BladeInputController } from './blade-input-controller';
import { ClassicPhysicsAdapter } from './classic-physics-adapter';
import {
  ClassicResolutionAdapter,
  type AppliedClassicResolution,
} from './classic-resolution-adapter';

const { ccclass, requireComponent } = _decorator;

export const CLASSIC_RESOLUTION_APPLIED_EVENT = 'classic-resolution-applied';
export const CLASSIC_SESSION_COMMAND_EVENT = 'classic-session-command';
export const CLASSIC_SESSION_SNAPSHOT_EVENT = 'classic-session-snapshot';

/** Root bridge for resolved Classic session, resolution, and Physics2D behavior. */
@ccclass('ClassicSceneController')
@requireComponent(BladeInputController)
export class ClassicSceneController extends Component {
  private readonly session = new ClassicSession();
  private readonly physics = new ClassicPhysicsAdapter();
  private readonly resolution = new ClassicResolutionAdapter();
  private bladeInput: BladeInputController | null = null;
  private appliedResolution: AppliedClassicResolution | null = null;

  onLoad(): void {
    const bladeInput = this.getComponent(BladeInputController);
    if (bladeInput === null) {
      throw new Error('ClassicSceneController requires BladeInputController');
    }
    this.bladeInput = bladeInput;
    this.appliedResolution = this.resolution.apply();
    this.physics.configureResolvedWorldProperties();
  }

  start(): void {
    if (this.appliedResolution === null) {
      throw new Error('Classic resolution must be applied before scene start');
    }
    this.node.emit(CLASSIC_RESOLUTION_APPLIED_EVENT, this.appliedResolution);
    this.emitSessionSnapshot();
  }

  onDestroy(): void {
    if (this.session.snapshot().worldStopped) {
      this.physics.setWorldStopped(false);
    }
  }

  resolutionSnapshot(): AppliedClassicResolution | null {
    return this.appliedResolution;
  }

  sessionSnapshot(): ClassicSessionSnapshot {
    return this.session.snapshot();
  }

  completeIntro(): void {
    this.dispatch(this.session.completeIntro());
  }

  gameOverFromMiss(): void {
    this.dispatch(this.session.gameOverFromMiss());
  }

  bombHit(): void {
    this.dispatch(this.session.bombHit());
  }

  afterBombHit(): void {
    this.dispatch(this.session.afterBombHit());
  }

  displayScoreComplete(bestScore: number): void {
    this.dispatch(this.session.displayScoreComplete(bestScore));
  }

  private dispatch(commands: readonly ClassicSessionCommand[]): void {
    for (const command of commands) {
      this.applyResolvedCommand(command);
      this.node.emit(CLASSIC_SESSION_COMMAND_EVENT, command);
    }
    this.emitSessionSnapshot();
  }

  private applyResolvedCommand(command: ClassicSessionCommand): void {
    if (command.type === 'set-cut-enabled') {
      this.bladeInput?.setCutEnabled(command.enabled);
    } else if (command.type === 'set-physics-stopped') {
      this.physics.setWorldStopped(command.stopped);
    }
  }

  private emitSessionSnapshot(): void {
    this.node.emit(CLASSIC_SESSION_SNAPSHOT_EVENT, this.session.snapshot());
  }
}
