import {
  _decorator,
  Component,
  EventTouch,
  Input,
  input,
  view,
} from 'cc';

import {
  BladeTracks,
  type BladeMoveResult,
  type BladePoint,
  type BladeSegment,
  type BladeTrackSnapshot,
} from '../domain/blade-tracks';

const { ccclass } = _decorator;

export const CLASSIC_BLADE_BEGAN_EVENT = 'classic-blade-began';
export const CLASSIC_BLADE_MOVED_EVENT = 'classic-blade-moved';
export const CLASSIC_BLADE_ENDED_EVENT = 'classic-blade-ended';

export interface ClassicBladeBeganEvent {
  readonly point: BladePoint;
  readonly slot: number;
  readonly touchId: number;
}

export interface ClassicBladeEndedEvent {
  readonly cancelled: boolean;
  readonly slot: number;
  readonly touchId: number;
}

/** Scene-wide input adapter for the recovered four-slot blade tracker. */
@ccclass('BladeInputController')
export class BladeInputController extends Component {
  private tracks = new BladeTracks();
  private cutEnabled = true;

  onEnable(): void {
    input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.on(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
  }

  onDisable(): void {
    input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    this.tracks = new BladeTracks();
  }

  setCutEnabled(enabled: boolean): void {
    this.cutEnabled = enabled;
  }

  snapshot(): readonly BladeTrackSnapshot[] {
    return this.tracks.snapshot();
  }

  private readonly onTouchStart = (event: EventTouch): void => {
    const touchId = event.getID();
    if (touchId === null) {
      return;
    }
    const location = event.getUILocation();
    const point = Object.freeze({ x: location.x, y: location.y });
    const slot = this.tracks.begin(touchId, point);
    if (slot === null) {
      return;
    }
    const payload: ClassicBladeBeganEvent = Object.freeze({ point, slot, touchId });
    this.node.emit(CLASSIC_BLADE_BEGAN_EVENT, payload);
  };

  private readonly onTouchMove = (event: EventTouch): void => {
    const touchId = event.getID();
    if (touchId === null) {
      return;
    }
    const location = event.getUILocation();
    const result: BladeMoveResult | null = this.tracks.move(
      touchId,
      { x: location.x, y: location.y },
      view.getVisibleSize().width,
    );
    if (result !== null) {
      this.node.emit(CLASSIC_BLADE_MOVED_EVENT, result);
    }
  };

  private readonly onTouchEnd = (event: EventTouch): void => {
    this.finishTouch(event, false);
  };

  private readonly onTouchCancel = (event: EventTouch): void => {
    this.finishTouch(event, true);
  };

  private finishTouch(event: EventTouch, cancelled: boolean): void {
    const touchId = event.getID();
    if (touchId === null) {
      return;
    }
    const slot = this.tracks.end(touchId);
    if (slot === null) {
      return;
    }
    const payload: ClassicBladeEndedEvent = Object.freeze({ cancelled, slot, touchId });
    this.node.emit(CLASSIC_BLADE_ENDED_EVENT, payload);
  }

  /** Reserved for the post-physics cut adapter once its timestep contract is resolved. */
  segmentsForPostPhysicsUpdate(): readonly BladeSegment[] {
    return this.tracks.segmentsForPostPhysicsUpdate(this.cutEnabled);
  }
}
