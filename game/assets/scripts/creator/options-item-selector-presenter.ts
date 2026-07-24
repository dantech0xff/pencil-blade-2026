import {
  Node,
  Sprite,
  UITransform,
  isValid,
} from 'cc';

import type { LoadedGameRasterResource } from './game-resource-loader';

export interface OptionsSelectorFramePair {
  readonly normal: LoadedGameRasterResource;
  readonly selected: LoadedGameRasterResource;
}

export interface OptionsItemSelectorPresenterInput {
  readonly icons: readonly LoadedGameRasterResource[];
  readonly name: string;
  readonly next: OptionsSelectorFramePair;
  readonly onSelectionChanged: (index: number) => void;
  readonly previous: OptionsSelectorFramePair;
  readonly selectedIndex: number;
  readonly selectorBackground: LoadedGameRasterResource;
}

interface SelectorButton {
  readonly node: Node;
  readonly normal: LoadedGameRasterResource;
  readonly selected: LoadedGameRasterResource;
  readonly sprite: Sprite;
  readonly transform: UITransform;
}

interface SelectorButtonEvents {
  readonly cancel: () => void;
  readonly end: () => void;
  readonly node: Node;
  readonly start: () => void;
}

/** Creator counterpart of the recovered bounded `SelectItems` node. */
export class OptionsItemSelectorPresenter {
  readonly root: Node;

  private activeValue = false;
  private readonly buttonEvents: SelectorButtonEvents[] = [];
  private disposedValue = false;
  private readonly icons: readonly LoadedGameRasterResource[];
  private readonly itemSprite: Sprite;
  private readonly itemTransform: UITransform;
  private listenersRegistered = false;
  private readonly nextButton: SelectorButton;
  private readonly onSelectionChanged: (index: number) => void;
  private readonly previousButton: SelectorButton;
  private selectedIndexValue: number;

  private constructor(input: OptionsItemSelectorPresenterInput) {
    this.icons = input.icons;
    this.onSelectionChanged = input.onSelectionChanged;
    this.selectedIndexValue = input.selectedIndex;
    this.root = new Node(input.name);

    const background = createSpriteNode(
      'selector-background',
      input.selectorBackground,
      this.root,
    );
    background.node.setPosition(0, 0, 0);

    this.previousButton = createButton(
      'previous',
      input.previous,
      this.root,
      -input.selectorBackground.dimensions.width,
    );
    this.nextButton = createButton(
      'next',
      input.next,
      this.root,
      input.selectorBackground.dimensions.width,
    );

    const item = createSpriteNode(
      'selected-item',
      requireIcon(this.icons, this.selectedIndexValue),
      this.root,
    );
    item.node.setPosition(0, 0, 0);
    this.itemSprite = item.sprite;
    this.itemTransform = item.transform;
    this.root.active = false;
  }

  static create(input: OptionsItemSelectorPresenterInput): OptionsItemSelectorPresenter {
    assertInput(input);
    return new OptionsItemSelectorPresenter(input);
  }

  get disposed(): boolean {
    return this.disposedValue;
  }

  get selectedIndex(): number {
    return this.selectedIndexValue;
  }

  activate(): void {
    this.assertUsable('activate');
    if (this.activeValue) {
      return;
    }
    this.activeValue = true;
    try {
      this.registerButtonEvents();
      this.root.active = true;
    } catch (error) {
      this.activeValue = false;
      this.unregisterButtonEvents();
      this.root.active = false;
      throw error;
    }
  }

  suspend(): boolean {
    if (this.disposedValue || !this.activeValue) {
      return false;
    }
    this.activeValue = false;
    this.unregisterButtonEvents();
    return true;
  }

  /** Programmatic selection used for transaction rollback; does not emit the native callback. */
  select(index: number): boolean {
    this.assertUsable('select');
    assertIndex(index, this.icons.length, 'Options selector index');
    if (index === this.selectedIndexValue) {
      return false;
    }
    this.selectedIndexValue = index;
    this.applyIcon(requireIcon(this.icons, index));
    return true;
  }

  dispose(): boolean {
    if (this.disposedValue) {
      return false;
    }
    this.disposedValue = true;
    this.activeValue = false;
    this.unregisterButtonEvents();
    if (isValid(this.root, true)) {
      this.root.destroy();
    }
    return true;
  }

  private move(delta: -1 | 1): void {
    if (this.disposedValue || !this.activeValue) {
      return;
    }
    const nextIndex = this.selectedIndexValue + delta;
    // Native boundary presses keep the current texture and do not invoke the callback/audio.
    if (nextIndex < 0 || nextIndex >= this.icons.length) {
      return;
    }
    this.selectedIndexValue = nextIndex;
    this.applyIcon(requireIcon(this.icons, nextIndex));
    this.onSelectionChanged(nextIndex);
  }

  private applyIcon(resource: LoadedGameRasterResource): void {
    this.itemSprite.spriteFrame = resource.spriteFrame;
    this.itemTransform.setContentSize(
      resource.dimensions.width,
      resource.dimensions.height,
    );
  }

  private registerButtonEvents(): void {
    if (this.listenersRegistered) {
      return;
    }
    this.listenersRegistered = true;
    try {
      this.buttonEvents.push(
        registerButtonEvents(this.previousButton, () => this.move(-1)),
      );
      this.buttonEvents.push(
        registerButtonEvents(this.nextButton, () => this.move(1)),
      );
    } catch (error) {
      this.unregisterButtonEvents();
      throw error;
    }
  }

  private unregisterButtonEvents(): void {
    if (!this.listenersRegistered) {
      return;
    }
    for (const events of this.buttonEvents) {
      events.node.off(Node.EventType.TOUCH_START, events.start);
      events.node.off(Node.EventType.TOUCH_CANCEL, events.cancel);
      events.node.off(Node.EventType.TOUCH_END, events.end);
    }
    this.buttonEvents.length = 0;
    this.listenersRegistered = false;
  }

  private assertUsable(action: string): void {
    if (this.disposedValue || !isValid(this.root, true)) {
      throw new Error(`Disposed Options selector cannot ${action}`);
    }
  }
}

function createButton(
  name: string,
  frames: OptionsSelectorFramePair,
  parent: Node,
  x: number,
): SelectorButton {
  const item = createSpriteNode(name, frames.normal, parent);
  item.node.setPosition(x, 0, 0);
  return Object.freeze({
    node: item.node,
    normal: frames.normal,
    selected: frames.selected,
    sprite: item.sprite,
    transform: item.transform,
  });
}

function registerButtonEvents(
  button: SelectorButton,
  activate: () => void,
): SelectorButtonEvents {
  const apply = (resource: LoadedGameRasterResource): void => {
    button.sprite.spriteFrame = resource.spriteFrame;
    button.transform.setContentSize(
      resource.dimensions.width,
      resource.dimensions.height,
    );
  };
  const start = (): void => apply(button.selected);
  const cancel = (): void => apply(button.normal);
  const end = (): void => {
    apply(button.normal);
    activate();
  };
  const events = Object.freeze({ cancel, end, node: button.node, start });
  try {
    button.node.on(Node.EventType.TOUCH_START, start);
    button.node.on(Node.EventType.TOUCH_CANCEL, cancel);
    button.node.on(Node.EventType.TOUCH_END, end);
    return events;
  } catch (error) {
    button.node.off(Node.EventType.TOUCH_START, start);
    button.node.off(Node.EventType.TOUCH_CANCEL, cancel);
    button.node.off(Node.EventType.TOUCH_END, end);
    throw error;
  }
}

function createSpriteNode(
  name: string,
  resource: LoadedGameRasterResource,
  parent: Node,
): Readonly<{ readonly node: Node; readonly sprite: Sprite; readonly transform: UITransform }> {
  const node = new Node(name);
  node.setParent(parent);
  const transform = node.addComponent(UITransform);
  transform.setAnchorPoint(0.5, 0.5);
  transform.setContentSize(resource.dimensions.width, resource.dimensions.height);
  const sprite = node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = resource.spriteFrame;
  return Object.freeze({ node, sprite, transform });
}

function assertInput(input: OptionsItemSelectorPresenterInput): void {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('Options selector input must be an object');
  }
  if (typeof input.name !== 'string' || input.name.length === 0) {
    throw new TypeError('Options selector name must be a non-empty string');
  }
  if (!Array.isArray(input.icons) || input.icons.length === 0) {
    throw new RangeError('Options selector must contain at least one icon');
  }
  for (let index = 0; index < input.icons.length; index += 1) {
    requireIcon(input.icons, index);
  }
  assertIndex(input.selectedIndex, input.icons.length, 'selectedIndex');
  assertFramePair(input.previous, 'previous');
  assertFramePair(input.next, 'next');
  requireLoadedRaster(input.selectorBackground, 'selector background');
  if (typeof input.onSelectionChanged !== 'function') {
    throw new TypeError('Options selector requires onSelectionChanged()');
  }
}

function assertFramePair(value: OptionsSelectorFramePair, label: string): void {
  if (value === null || typeof value !== 'object') {
    throw new TypeError(`Options ${label} frames must be an object`);
  }
  requireLoadedRaster(value.normal, `${label} normal`);
  requireLoadedRaster(value.selected, `${label} selected`);
}

function requireIcon(
  icons: readonly LoadedGameRasterResource[],
  index: number,
): LoadedGameRasterResource {
  const resource = icons[index];
  requireLoadedRaster(resource, `selector icon ${index}`);
  return resource;
}

function requireLoadedRaster(
  resource: LoadedGameRasterResource | undefined,
  label: string,
): asserts resource is LoadedGameRasterResource {
  if (
    resource === undefined
    || resource === null
    || !isValid(resource.spriteFrame, true)
    || !Number.isFinite(resource.dimensions.width)
    || !Number.isFinite(resource.dimensions.height)
  ) {
    throw new Error(`Options ${label} must be a valid loaded raster`);
  }
}

function assertIndex(index: number, count: number, label: string): void {
  if (!Number.isSafeInteger(index) || index < 0 || index >= count) {
    throw new RangeError(`${label} must be an integer from 0 through ${count - 1}`);
  }
}
