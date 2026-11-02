const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const {verificarPasswordSupabase} = require('../src/services/password-auth.service');
const originalFetch = global.fetch;
const originalUrl = process.env.SUPABASE_URL;
const originalKey = process.env.SUPABASE_PUBLIC_KEY;
after(()=>{ global.fetch=originalFetch; if(originalUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=originalUrl; if(originalKey===undefined)delete process.env.SUPABASE_PUBLIC_KEY;else process.env.SUPABASE_PUBLIC_KEY=originalKey; });
process.env.SUPABASE_URL='https://example.invalid';
process.env.SUPABASE_PUBLIC_KEY='test-public-key';
const user={id:'uid-autorizado',email:'admin@test.invalid',email_confirmed_at:'2026-11-02'};
test('solo acepta la identidad vinculada, con correo confirmado y sin devolver tokens',async()=>{
  global.fetch=async(url,options)=>{
    assert.equal(url,'https://example.invalid/auth/v1/token?grant_type=password');
    assert.deepEqual(JSON.parse(options.body),{email:user.email,password:'clave-de-prueba'});
    return {ok:true,status:200,json:async()=>({user,access_token:'token-no-expuesto'})};
  };
  assert.equal(await verificarPasswordSupabase(user.email,'clave-de-prueba',user.id),true);
  assert.equal(await verificarPasswordSupabase(user.email,'clave-de-prueba','otra-identidad'),false);
});
test('no admite un correo sin confirmar ni otro correo con el mismo uid',async()=>{
  for(const change of [{email_confirmed_at:null},{email:'otro@test.invalid'}]){
    global.fetch=async()=>({ok:true,status:200,json:async()=>({user:{...user,...change},access_token:'token'})});
    assert.equal(await verificarPasswordSupabase(user.email,'prueba',user.id),false);
  }
});
test('distingue credenciales rechazadas de caídas o límites del proveedor',async()=>{
  global.fetch=async()=>({ok:false,status:400});
  assert.equal(await verificarPasswordSupabase(user.email,'incorrecta',user.id),false);
  for(const status of [429,500]){
    global.fetch=async()=>({ok:false,status});
    await assert.rejects(verificarPasswordSupabase(user.email,'prueba',user.id),/AUTH_UNAVAILABLE/);
  }
  global.fetch=async()=>{throw new Error('network');};
  await assert.rejects(verificarPasswordSupabase(user.email,'prueba',user.id),/AUTH_UNAVAILABLE/);
});
