import{reviewYokoshibaR7}from'./descending-chiba-yokoshiba-r7';
import{reviewTonosho}from'./descending-chiba-tonosho';
import{reviewChonanMore}from'./descending-chiba-chonan-more';
import{reviewKyonan}from'./descending-chiba-kyonan';
import{reviewChonan}from'./descending-chiba-chonan';
import{reviewChosei}from'./descending-chiba-chosei';
import{reviewYokoshibaR3}from'./descending-chiba-yokoshiba-r3';
import{reviewYokoshibaExtra}from'./descending-chiba-yokoshiba-extra';
import{reviewYokoshibaR4}from'./descending-chiba-yokoshiba-r4';
import{reviewYokoshibaR5}from'./descending-chiba-yokoshiba-r5';
import{reviewYokoshibaR6}from'./descending-chiba-yokoshiba-r6';
import type{CachedInput}from'./shared';
export function reviewChiba(i:CachedInput){const found=[reviewYokoshibaR7(i),reviewTonosho(i),reviewChonanMore(i),reviewKyonan(i),reviewChonan(i),reviewChosei(i),reviewYokoshibaR3(i),reviewYokoshibaExtra(i),reviewYokoshibaR4(i),reviewYokoshibaR5(i),reviewYokoshibaR6(i)].filter(x=>x!==null);if(!found.length)return null;const projects=found.flatMap(x=>x.projects);if(new Set(projects.map(p=>p.id)).size!==projects.length)throw Error('Overlapping Chiba review outputs');return{projects,units:found.flatMap(x=>x.units),proofs:found.flatMap(x=>x.proofs),status:projects.length?'reviewed_chiba_named_rows':'source_identity_hold',reason:found.map(x=>x.reason).join(' | ')};}
