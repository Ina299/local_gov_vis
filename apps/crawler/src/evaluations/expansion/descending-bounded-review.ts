import type {CachedInput} from './shared';
import {boundedFukutsuScope,reviewBoundedFukutsu} from './descending-fukutsu-bounded';
import {boundedMunakataScope,reviewBoundedMunakata} from './descending-munakata-bounded';
/** Only individually reviewed, pinned prefix families. Other incomplete inputs remain held. */
export const boundedSourceScope=(i:CachedInput)=>boundedFukutsuScope(i)??boundedMunakataScope(i);
export const reviewBoundedSource=(i:CachedInput)=>reviewBoundedFukutsu(i)??reviewBoundedMunakata(i);
