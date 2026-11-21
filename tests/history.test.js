import test from 'node:test';
import assert from 'node:assert/strict';
import {HISTORY_LIMIT,recordHistory,travelHistory} from '../src/history.js';

test('all 200 retained edits can be undone and redone in order',()=>{
  let history={past:[],future:[]},state=0;
  for(let i=1;i<=250;i++){history=recordHistory(history,state);state=i;}
  assert.equal(history.past.length,HISTORY_LIMIT);
  for(let i=249;i>=50;i--){const entry=travelHistory(history,state,'undo');history=entry.history;state=entry.state;assert.equal(state,i);}
  assert.equal(travelHistory(history,state,'undo'),null);
  for(let i=51;i<=250;i++){const entry=travelHistory(history,state,'redo');history=entry.history;state=entry.state;assert.equal(state,i);}
  assert.equal(travelHistory(history,state,'redo'),null);
});
test('a new edit after undo starts a new branch and clears redo',()=>{
  const entry=travelHistory(recordHistory(recordHistory({past:[],future:[]},'first'),'second'),'third','undo');
  const history=recordHistory(entry.history,entry.state);
  assert.deepEqual(history,{past:['first','second'],future:[]});
});
