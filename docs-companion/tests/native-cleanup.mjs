import {test} from 'node:test';
import assert from 'node:assert/strict';
import {finishOwnedCleanup, verifyCleanupResponse, cleanupStage} from '../scripts/native-cleanup.mjs';
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


test('taskkill not-found race is tolerated only after positive process-exit verification', () => {
  const raced = {complete:true,goneVerified:true,stage:'process-exit-verification',killResults:[{pid:123,exitCode:128,timedOut:false}]};
  assert.equal(verifyCleanupResponse(raced),raced);
  assert.throws(()=>verifyCleanupResponse({...raced,goneVerified:false}));
  assert.throws(()=>verifyCleanupResponse({...raced,complete:false,code:'OwnedProcessStillRunning'}),error=>{
    assert.deepEqual(error.cleanupDiagnostic,{stage:'process-exit-verification',code:'OwnedProcessStillRunning',killExitCodes:[128],remainingOwnedPids:[],remainingProfileProcessCount:null});
    return true;
  });
});

test('file-lock diagnostics identify the stage without exposing exception paths', async () => {
  await assert.rejects(cleanupStage('profile-removal',async()=>{
    const error=new Error('sensitive local path or secret text');error.code='EBUSY';throw error;
  }),error=>{
    assert.deepEqual(error.cleanupDiagnostic,{stage:'profile-removal',code:'EBUSY'});
    assert(!JSON.stringify(error.cleanupDiagnostic).includes('sensitive'));
    return true;
  });
});

test('never-resolving cleanup stage produces a bounded typed diagnostic', async () => {
  await assert.rejects(cleanupStage('process-exit-verification',never,10),error=>{
    assert.deepEqual(error.cleanupDiagnostic,{stage:'process-exit-verification',code:'CLEANUP_TIMEOUT'});
    return true;
  });
});
