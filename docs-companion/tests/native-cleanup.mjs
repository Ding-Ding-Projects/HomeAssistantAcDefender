import {test} from 'node:test';
import assert from 'node:assert/strict';
import {finishOwnedCleanup} from '../scripts/native-cleanup.mjs';
const never = () => new Promise(() => {});

test('never-resolving CDP and transport close cannot block mandatory owned cleanup', async () => {
  const events = [];
  const result = await finishOwnedCleanup({
    browser: {newBrowserCDPSession: async () => ({send:never}), close:never}, timeout:10,
    stopAndVerify:async()=>{events.push('processes-gone');},
    removeOwnedFiles:async()=>{events.push('files-removed');}
  });
  assert.deepEqual(result, {complete:true, graceful:{cdp:{acknowledged:false}, transport:{acknowledged:false}}});
  assert.deepEqual(events, ['processes-gone', 'files-removed']);
});

test('session creation timeout and rejected process cleanup never delete the profile or pass', async () => {
  let removed = false;
  await assert.rejects(finishOwnedCleanup({
    browser:{newBrowserCDPSession:never,close:async()=>{}}, timeout:10,
    stopAndVerify:async()=>{throw new Error('owned process remains');},
    removeOwnedFiles:async()=>{removed=true;}
  }), /owned process remains/);
  assert.equal(removed,false);
});

test('cleanup completion waits for actual process-exit verification', async () => {
  let release;
  const gone = new Promise(resolve=>{release=resolve;});
  let removed = false;
  const cleanup = finishOwnedCleanup({browser:null,stopAndVerify:()=>gone,removeOwnedFiles:async()=>{removed=true;}});
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(removed,false);
  release();
  assert.equal((await cleanup).complete,true);
  assert.equal(removed,true);
});
