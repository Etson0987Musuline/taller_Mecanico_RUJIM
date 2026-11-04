const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const originalFetch=global.fetch;
const names=['SUPABASE_URL','SUPABASE_PUBLIC_KEY','AUTH_PUBLIC_URL','FRONTEND_URL'];
const original=Object.fromEntries(names.map(n=>[n,process.env[n]]));
Object.assign(process.env,{SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLIC_KEY:'public-test-key',AUTH_PUBLIC_URL:'https://taller.example/api',FRONTEND_URL:'https://taller.example'});
after(()=>{global.fetch=originalFetch;for(const n of names){if(original[n]===undefined)delete process.env[n];else process.env[n]=original[n];}});
const dbPath=require.resolve('../src/config/supabase');
require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{}};
const {google}=require('../src/controllers/sesion.controller');
const response=()=>({headers:{},set(k,v){this.headers[k]=v;return this;},append(k,v){(this.headers[k]??=[]).push(v);return this;},redirect(url){this.url=url;return this;}});
test('Google deshabilitado muestra un mensaje en el login y no inicia OAuth',async()=>{
  global.fetch=async()=>({ok:true,json:async()=>({external:{google:false}})});
  const res=response();await google({},res);
  const url=new URL(res.url);
  assert.equal(url.origin,'https://taller.example');assert.equal(url.pathname,'/login');
  assert.match(url.searchParams.get('error'),/no está habilitado/);
  assert.equal(res.headers['Set-Cookie'],undefined);
  assert.equal(res.headers['Cache-Control'],'no-store');
});
test('Google habilitado conserva el desafío PKCE y el estado privado',async()=>{
  global.fetch=async(url,options)=>{assert.match(url,/auth\/v1\/settings$/);assert.equal(options.headers.apikey,'public-test-key');return {ok:true,json:async()=>({external:{google:true}})};};
  const res=response();await google({},res);
  const url=new URL(res.url);
  assert.equal(url.origin,'https://example.supabase.co');assert.equal(url.searchParams.get('provider'),'google');
  assert.equal(url.searchParams.get('code_challenge_method'),'s256');
  assert.equal(new URL(url.searchParams.get('redirect_to')).pathname,'/api/auth/google/callback');
  assert.equal(res.headers['Set-Cookie'].length,2);
  assert.ok(res.headers['Set-Cookie'].every(c=>c.includes('HttpOnly')));
});
test('un fallo del proveedor no muestra una página técnica ni detalles internos',async()=>{
  for(const fetcher of [async()=>({ok:false}),async()=>{throw new Error('detalle privado');}]){
    global.fetch=fetcher;
    const res=response();await google({},res);
    assert.equal(new URL(res.url).pathname,'/login');assert.ok(!res.url.includes('privado'));
  }
});
