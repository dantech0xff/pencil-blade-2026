import {
  _decorator,
  Component,
  EventTouch,
  Input,
  input,
} from 'cc';

import type { BirdBladePoint } from '../domain/bird-blade-state';

const { ccclass } = _decorator;

export const BIRD_BLADE_TOUCH_BEGAN_EVENT = 'bird-blade-touch-began';

export interface BirdBladeTouchBeganEvent {
  readonly point: BirdBladePoint;
}

/**
 * Explicit global-input lease for BaseBird's touch-began-only contract.
 *
 * Every delivered start is emitted. The BirdBlade presenter owns first-touch-wins
 * acceptance, so a busy blade still leaves the input/audio delivery order observable.
 */
@ccclass('BirdInputController')
export class BirdInputController extends Component {
  private birdLayerActive = false;
  private birdLayerOwner: object | null = null;

  activateForBirdLayer(owner: object = this): void {
    if (this.birdLayerActive && this.birdLayerOwner === owner) {
      return;
    }

    const alreadySubscribed = this.birdLayerActive;
    this.birdLayerActive = true;
    this.birdLayerOwner = owner;
    if (alreadySubscribed) {
      return;
    }
    try {
      input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    } catch (error) {
      this.deactivateForNonBirdScreen(owner);
      throw error;
    }
  }

  /**
   * An owner-bound release cannot deactivate a newer scene controller that has already taken the
   * shared input lease. Calls without an owner remain the component-level teardown boundary.
   */
  deactivateForNonBirdScreen(owner?: object): boolean {
    if (owner !== undefined && this.birdLayerOwner !== owner) {
      return false;
    }
    this.birdLayerActive = false;
    this.birdLayerOwner = null;
    input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
    return true;
  }

  onDisable(): void {
    this.deactivateForNonBirdScreen();
  }

  onDestroy(): void {
    this.deactivateForNonBirdScreen();
  }

  private readonly onTouchStart = (event: EventTouch): void => {
    if (!this.birdLayerActive) {
      return;
    }
    const location = event.getUILocation();
    const point: BirdBladePoint = Object.freeze({
      x: location.x,
      y: location.y,
    });
    const payload: BirdBladeTouchBeganEvent = Object.freeze({ point });
    this.node.emit(BIRD_BLADE_TOUCH_BEGAN_EVENT, payload);
  };
}
