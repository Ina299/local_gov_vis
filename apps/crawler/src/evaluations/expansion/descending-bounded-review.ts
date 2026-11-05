import {boundedKasaokaScope,reviewBoundedKasaoka} from './descending-kasaoka-bounded';
import {boundedHatsukaichiScope,reviewBoundedHatsukaichi} from './descending-hatsukaichi-bounded';
import {boundedNagatoScope,reviewBoundedNagato} from './descending-nagato-bounded';
import {boundedMunakataPolicyScope,reviewBoundedMunakataPolicy} from './descending-munakata-policy';
import type {CachedInput} from './shared';
import {boundedFukutsuScope,reviewBoundedFukutsu} from './descending-fukutsu-bounded';
import {boundedMunakataScope,reviewBoundedMunakata} from './descending-munakata-bounded';
/** Only individually reviewed, pinned prefix families. Other incomplete inputs remain held. */
export const boundedSourceScope=(i:CachedInput)=>boundedHatsukaichiScope(i)??boundedNagatoScope(i)??boundedFukutsuScope(i)??boundedMunakataScope(i)??boundedMunakataPolicyScope(i)??boundedKasaokaScope(i);
export const reviewBoundedSource=(i:CachedInput)=>reviewBoundedHatsukaichi(i)??reviewBoundedNagato(i)??reviewBoundedFukutsu(i)??reviewBoundedMunakata(i)??reviewBoundedMunakataPolicy(i)??reviewBoundedKasaoka(i);
