import * as Cocos from 'cc';

import type { AssetManager, Font } from 'cc';

import { CRAZY_DRAGON_COUNTER_FONT_PATH } from '../domain/crazy-dragon-fruit-state';
import { canonicalResourceToBundlePath } from '../domain/game-resource-contract';
import { loadGameResourceBundle } from './game-resource-loader';

export interface LoadedCrazyDragonFont {
  readonly canonicalPath: typeof CRAZY_DRAGON_COUNTER_FONT_PATH;
  readonly font: Font;
}

/** Loads the Dragon counter's Razing font without changing the shared Crazy catalog shape. */
export async function loadCrazyDragonFont(
  bundle?: AssetManager.Bundle,
): Promise<LoadedCrazyDragonFont> {
  const loadedBundle = bundle ?? await loadGameResourceBundle();
  const bundlePath = canonicalResourceToBundlePath(CRAZY_DRAGON_COUNTER_FONT_PATH);
  const font = await new Promise<Font>((resolve, reject) => {
    loadedBundle.load(bundlePath, Cocos.Font, (error, loadedFont) => {
      if (error !== null && error !== undefined) {
        reject(new Error(
          `Failed to load Crazy Dragon font: ${error.message}`,
        ));
        return;
      }
      if (loadedFont === null || loadedFont === undefined) {
        reject(new Error(
          `Creator returned no Crazy Dragon font for ${CRAZY_DRAGON_COUNTER_FONT_PATH}`,
        ));
        return;
      }
      resolve(loadedFont);
    });
  });
  return Object.freeze({
    canonicalPath: CRAZY_DRAGON_COUNTER_FONT_PATH,
    font,
  });
}
