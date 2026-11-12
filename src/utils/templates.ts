/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CanvasElement } from '../types/canvas';

export type TemplateType = 'blank';

/**
 * All new whiteboards start completely blank with zero example elements.
 */
export function createTemplateElements(): CanvasElement[] {
  return [];
}
