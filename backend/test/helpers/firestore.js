'use strict';
// Serialized atomic transaction mock. Emulator tests separately exercise real concurrency.
function fakeFirestore(){
  const documents=new Map();let tail=Promise.resolve(),fail=false;
  const check=()=>{if(fail)throw new Error('fixture-sensitive-sdk-error');};
  const snapshot=key=>({exists:documents.has(key),data:()=>documents.get(key)});
  const db={collection:name=>({doc:id=>({key:name+'/'+id,
    get:async()=>{check();return snapshot(name+'/'+id);},
    create:async data=>{check();const key=name+'/'+id;if(documents.has(key))throw new Error('already exists');documents.set(key,data);},
    delete:async()=>{check();documents.delete(name+'/'+id);}})}),
    runTransaction:work=>{
      const task=tail.catch(()=>{}).then(async()=>{check();const writes=[];
        const result=await work({get:async ref=>{check();return snapshot(ref.key);},set:(ref,data)=>writes.push(()=>documents.set(ref.key,data)),delete:ref=>writes.push(()=>documents.delete(ref.key))});
        check();writes.forEach(write=>write());return result;});tail=task;return task;
    }};
  return{db,documents,fail(value){fail=value;}};
}
module.exports={fakeFirestore};
