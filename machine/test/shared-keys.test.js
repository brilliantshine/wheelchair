'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs/promises'), path=require('node:path');
const {makeTemp}=require('../../test-support/run-dir');
const {sharedKeysPath,readSharedKeys,writeSharedKeys}=require('../lib/shared-keys');
test('private revisioned shared store and safe errors',async()=>{
 const dir=await makeTemp(); let store=await readSharedKeys(dir); assert.equal(store.revision,0); assert.equal(Object.getPrototypeOf(store.keys),null);
 store=await writeSharedKeys(dir,{set:{A:'secret'}}); assert.equal(store.revision,1); assert.equal(store.keys.A,'secret');
 store=await writeSharedKeys(dir,{set:{B:'other'},remove:['A']}); assert.equal(store.revision,2); assert.deepEqual({...store.keys},{B:'other'});
 const file=sharedKeysPath(dir); assert.equal((await fs.stat(file)).mode&0o777,0o600); assert.equal((await fs.stat(path.dirname(file))).mode&0o777,0o700);
 assert.deepEqual(JSON.parse(await fs.readFile(file)),{shared:true,revision:2,keys:{B:'other'}});
 await fs.writeFile(file,'broken'); await assert.rejects(readSharedKeys(dir),{message:"the shared key store on this machine can't be read"}); await assert.rejects(writeSharedKeys(dir,{}),{message:"the shared key store on this machine can't be written"});
});
