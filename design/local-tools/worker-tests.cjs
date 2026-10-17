// Run with: node design/local-tools/worker-tests.cjs
// Executes the production worker source in an isolated Node context, without app services.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const script=fs.readFileSync('wwwroot/js/local-tools.js','utf8');
const outer={module:{exports:{}},window:{addEventListener(){}},document:{readyState:'loading',addEventListener(){}},Map};
vm.runInNewContext(script,outer);
const source=outer.module.exports.workerMain.toString();
const encoder=new TextEncoder(),decoder=new TextDecoder();
async function run(id,input,options){
    let result;
    const self={postMessage(value){result=value;}};
    const context={self,TextEncoder,TextDecoder,Blob,CompressionStream,DecompressionStream,Uint8Array,DataView,ArrayBuffer,atob,btoa};
    vm.runInNewContext(`(${source})()`,context);
    const bytes=typeof input==='string'?encoder.encode(input):input;
    await self.onmessage({data:{id,bytes:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),options}});
    return result;
}
(async()=>{
    assert.equal(decoder.decode((await run('lf','a\r\nb\rc\n')).bytes),'a\nb\nc\n');
    assert.equal(decoder.decode((await run('crlf','a\nb\rc\r\n')).bytes),'a\r\nb\r\nc\r\n');
    assert.equal((await run('utf8',new Uint8Array([255]),{encoding:'utf-8'})).ok,false);
    assert.equal(decoder.decode((await run('utf8',new Uint8Array([65,0,66,0]),{encoding:'utf-16le'})).bytes),'AB');
    const original=new Uint8Array([0,1,127,128,254,255]);
    for(const [encode,decode] of [['base64','unbase64'],['hex','unhex']]) {
        const encoded=await run(encode,original),decoded=await run(decode,new Uint8Array(encoded.bytes));
        assert.deepEqual([...new Uint8Array(decoded.bytes)],[...original]);
    }
    for(const malformed of ['!bad','a','AB==']) assert.equal((await run('unbase64',malformed)).ok,false);
    assert.equal((await run('unhex','abc')).ok,false);
    assert.equal((await run('json','{"secret":')).error,'Input is not valid JSON.');
    assert.equal((await run('json','['.repeat(65)+'0'+']'.repeat(65))).ok,false);
    assert.equal((await run('json',' '.repeat(512*1024+1))).ok,false);
    assert.equal(decoder.decode((await run('jsoncsv','[{"a":"hello, world","b":2}]')).bytes),'"a","b"\r\n"hello, world","2"');
    for(const data of ['[{"a":"=HYPERLINK(1)"}]','[{"a":{"nested":1}}]']) assert.equal((await run('jsoncsv',data)).ok,false);
    const compressed=await run('gzip',original),restored=await run('gunzip',new Uint8Array(compressed.bytes));
    assert.deepEqual([...new Uint8Array(restored.bytes)],[...original]);
    assert.equal((await run('gunzip','not gzip')).ok,false);
    const large=new Uint8Array(8*1024*1024+1);
    assert.equal((await run('hex',large)).ok,false);
    const bomb=new Uint8Array(await new Response(new Blob([large]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    assert.match((await run('gunzip',bomb)).error,/Expanded output/);
    assert.equal((await run('png','<svg><script>alert(1)</script></svg>')).ok,false);
    assert.equal((await run('unknown','abc')).ok,false);
    console.log('PASS: production-worker assertions (encoding, bounds, malformed input, JSON depth, spreadsheet formulas, gzip round trip and expansion cap).');
})().catch(error=>{console.error(error);process.exitCode=1;});
