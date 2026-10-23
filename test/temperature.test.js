import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTemperature,validTemperature,temperatureState,temperatureHistory,DAY } from '../lib/temperature.js';
import { collectTemperature } from '../scripts/collect-temperature.mjs';
const now=Date.parse('2026-10-23T01:00:00Z'),day=Date.parse('2026-10-23T00:00:00Z');
const response=(offsets=[0,1,7])=>({metadata:{error:null},data:offsets.map((d,i)=>({value:String(50+i),timestamp:String((day-d*DAY)/1000),value_classification:'Neutral'}))});
test('reference feed preserves actual observations and exact dated comparisons',()=>{
 const f=normalizeTemperature(response(),new Date(now).toISOString());assert.equal(validTemperature(f),true);const s=temperatureState(f,{now});assert.equal(s.current.value,50);assert.equal(s.change,-1);assert.equal(s.weekChange,-2);assert.equal(s.status,'current');assert.equal(temperatureHistory(f,7).length,2);
 const gaps=normalizeTemperature(response([0,2,8]),new Date(now).toISOString());assert.equal(temperatureState(gaps,{now}).change,null);assert.equal(temperatureState(gaps,{now}).weekChange,null);
});
test('malformed, future and duplicate reference readings are rejected',()=>{
 for(const value of ['101','-1','50%','',null]){const p=response();p.data[0].value=value;assert.throws(()=>normalizeTemperature(p,new Date(now).toISOString()));}
 assert.throws(()=>normalizeTemperature(response([0,0]),new Date(now).toISOString()));assert.throws(()=>normalizeTemperature(response([-1]),new Date(now).toISOString()));assert.equal(validTemperature({}),false);
});
test('a failed reference refresh retains original observation and retrieval times',async()=>{
 const previous=normalizeTemperature(response(),new Date(now).toISOString());const result=await collectTemperature({previous,now:now+3*3600000,fetchJSON:async()=>{throw Error('down');}});assert.equal(result.status,'cached');assert.equal(result.checkedAt,previous.checkedAt);assert.deepEqual(result.points,previous.points);assert.equal(temperatureState(result,{now:now+3*3600000}).status,'old');
 const empty=await collectTemperature({now,fetchJSON:async()=>({})});assert.equal(validTemperature(empty),true);assert.equal(empty.points.length,0);assert.equal(empty.status,'unavailable');
});
