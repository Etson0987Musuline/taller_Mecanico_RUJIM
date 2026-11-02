const {test} = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
let usuario, accepted=false, saved=0;
const dbPath=require.resolve('../src/config/supabase');
require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{
  rpc:async()=>({data:1,error:null}),
  from(table){
    const q={select(){return q;},eq(){return q;},maybeSingle:async()=>({data:usuario,error:null}),insert:async()=>{assert.equal(table,'sesiones');saved++;return {error:null};}};
    return q;
  }
}};
const authPath=require.resolve('../src/services/password-auth.service');
require.cache[authPath]={id:authPath,filename:authPath,loaded:true,exports:{verificarPasswordSupabase:async(email,password,uid)=>{assert.equal(uid,'uid-asignado');return accepted;}}};
const {login}=require('../src/controllers/sesion.controller');
const response=()=>({statusCode:200,status(n){this.statusCode=n;return this;},json(data){this.data=data;return this;},set(){return this;},append(){return this;}});
test('una identidad vinculada no puede entrar con la contraseña heredada',async()=>{
  usuario={id:1,email:'admin@test.invalid',rol:'admin',supabase_uid:'uid-asignado',password_hash:await bcrypt.hash('anterior',4)};
  const res=response();
  await login({body:{email:usuario.email,password:'anterior'}},res);
  assert.equal(res.statusCode,401); assert.equal(saved,0);
});
test('la identidad validada conserva el rol y devuelve solo usuario público',async()=>{
  accepted=true;
  const res=response();
  await login({body:{email:usuario.email,password:'nueva'}},res);
  assert.equal(res.statusCode,200); assert.equal(saved,1);
  assert.equal(res.data.usuario.rol,'admin');
  assert.equal(res.data.usuario.password_hash,undefined);
  assert.equal(res.data.usuario.supabase_uid,undefined);
});
test('las cuentas no vinculadas conservan el login anterior',async()=>{
  usuario={id:2,email:'mecanico@test.invalid',rol:'mecanico',password_hash:await bcrypt.hash('vigente',4)};
  const res=response();
  await login({body:{email:usuario.email,password:'vigente'}},res);
  assert.equal(res.statusCode,200); assert.equal(res.data.usuario.rol,'mecanico');
});
