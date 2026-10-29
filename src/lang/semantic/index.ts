// Public entry of src/lang/semantic — owned by T02. Contract C03.
import type { CompileResult } from '../ir';

export { getElement, findElementAtOffset, supertypeOf, isSubtype } from './query';

export function compile(_source: string): CompileResult {
  throw new Error('not implemented: T02');
}
