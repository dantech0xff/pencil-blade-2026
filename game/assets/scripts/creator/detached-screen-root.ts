import { Node, isValid } from 'cc';

/**
 * Creates a detached screen whose world transform already matches the persistent Canvas.
 * SharedGameScenePresenter can then preserve world transform while moving screens transactionally.
 */
export function createDetachedScreenRoot(name: string, canvas: Node): Node {
  if (typeof name !== 'string' || name.length === 0) {
    throw new TypeError('Detached screen name must be a non-empty string');
  }
  if (!isValid(canvas, true) || !canvas.activeInHierarchy) {
    throw new Error('Detached screen requires a valid active Canvas');
  }
  const root = new Node(name);
  root.layer = canvas.layer;
  root.setWorldPosition(canvas.worldPosition);
  root.setWorldRotation(canvas.worldRotation);
  root.setWorldScale(canvas.worldScale);
  return root;
}
