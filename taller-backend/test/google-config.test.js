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

const db = require('../src/config/supabase');
const { googleCallback, login } = require('../src/controllers/sesion.controller');

test('Google separa clientes y administradores sin crear cuentas de personal', async () => {
  const casos = [
    ['admin', {rol:'admin',activo:true,google_habilitado:true}, 'admin', true],
    ['admin', null, 'cliente', false],
    ['admin', {rol:'cliente',activo:true}, 'cliente', false],
    ['admin', {rol:'mecanico',activo:true,google_habilitado:true}, 'mecanico', false],
    ['admin', {rol:'admin',activo:true,google_habilitado:false}, 'admin', false],
    ['admin', {rol:'admin',activo:false,google_habilitado:true}, 'admin', false],
    ['cliente', null, 'cliente', true],
    ['cliente', {rol:'cliente',activo:true}, 'cliente', true],
    ['cliente', {rol:'admin',activo:true}, 'admin', false],
    ['cliente', {rol:'mecanico',activo:true}, 'mecanico', false],
    ['cliente', {rol:'cliente',activo:false}, 'cliente', false],
    ['cliente', null, 'admin', false],
  ];
  for (const [tipo, existente, rol, permitido] of casos) {
    let sesiones=0, vinculaciones=0;
    global.fetch=async()=>({ok:true,json:async()=>({access_token:'test-token'})});
    db.auth={getUser:async()=>({data:{user:{id:'uid',email:'cliente@example.com',email_confirmed_at:'2026-01-01',identities:[{provider:'google',identity_data:{email:'cliente@example.com',email_verified:true}}]}},error:null})};
    db.from=tabla=>tabla==='usuarios'?{select(){return this},eq(){return this},maybeSingle:async()=>({data:existente,error:null})}:{insert:async()=>{sesiones++;return {error:null}}};
    db.rpc=async()=>{vinculaciones++;return {data:{id:1,rol},error:null}};
    const state=`${tipo}.${'a'.repeat(64)}`, res=response();
    await googleCallback({headers:{cookie:`rujim_pkce=test; rujim_oauth_state=${state}`},query:{state,code:'code'}},res);
    assert.equal(sesiones, permitido?1:0, JSON.stringify({tipo,existente,rol}));
    if (tipo==='admin' && !permitido) assert.equal(vinculaciones,0);
    assert.equal(new URL(res.url).searchParams.get('google'),permitido?'ok':null);
  }
});

test('no permite cambiar el tipo de acceso durante el callback', async()=>{
  let contacted=false;
  global.fetch=async()=>{contacted=true;throw new Error('no debe llamar')};
  const res=response();
  await googleCallback({headers:{cookie:`rujim_pkce=test; rujim_oauth_state=cliente.${'a'.repeat(64)}`},query:{state:`admin.${'a'.repeat(64)}`,code:'code'}},res);
  assert.equal(contacted,false);
  assert.match(new URL(res.url).searchParams.get('error'),/venció/);
});

test('el personal conserva su acceso por correo y contraseña', async()=>{
  const bcrypt=require('bcryptjs');
  for(const rol of ['admin','mecanico']) {
    const usuario={id:7,nombre:'Personal',email:'personal@example.com',rol,password_hash:await bcrypt.hash('Una contraseña de prueba',4)};
    let sesiones=0;
    db.rpc=async()=>({data:1,error:null});
    db.from=tabla=>tabla==='usuarios'?{select(){return this},eq(){return this},maybeSingle:async()=>({data:usuario,error:null})}:{insert:async()=>{sesiones++;return {error:null}}};
    const res={...response(),status(n){this.codigo=n;return this},json(data){this.data=data;return this}};
    await login({body:{email:usuario.email,password:'Una contraseña de prueba'}},res);
    assert.equal(res.data.usuario.rol,rol);
    assert.equal(sesiones,1);
  }
});
