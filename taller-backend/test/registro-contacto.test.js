const {test}=require('node:test');
const assert=require('node:assert/strict');
const dbPath=require.resolve('../src/config/supabase');
const db={};
require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:db};
const {registroContacto}=require('../src/controllers/programa.controller');
const respuesta=()=>({status(n){this.codigo=n;return this},json(data){this.data=data;return this}});

test('teléfono y WhatsApp se guardan solo para el cliente de la sesión sin alterar dirección ni otros canales',async()=>{
  for(const whatsapp of [true,false]){
    let telefonoGuardado,idGuardado,preferencias;
    db.from=tabla=>tabla==='clientes'?{update(data){telefonoGuardado=data;return this},eq:async(k,id)=>{idGuardado=id;return {error:null}}}:{upsert:async(data)=>{preferencias=data;return {error:null}}};
    const res=respuesta();
    await registroContacto({usuario:{rol:'cliente',cliente_id:7},body:{telefono:'987 654 321',whatsapp,cliente_id:999,direccion:'ignorar',email:true}},res);
    assert.deepEqual(telefonoGuardado,{telefono:'+51987654321'});
    assert.equal(idGuardado,7);
    assert.equal(preferencias.cliente_id,7);
    assert.equal(preferencias.whatsapp,whatsapp);
    assert.ok(!('email' in preferencias));
    assert.ok(!('interna' in preferencias));
    assert.ok(res.data.mensaje);
  }
});

test('rechaza teléfono inválido, consentimiento ambiguo y cuentas de personal',async()=>{
  let consultado=false;db.from=()=>{consultado=true;throw new Error('no debe consultar')};
  for(const body of [{telefono:'123',whatsapp:true},{telefono:'987654321',whatsapp:'true'},{telefono:{},whatsapp:false}]){
    const res=respuesta();await registroContacto({usuario:{rol:'cliente',cliente_id:7},body},res);assert.equal(res.codigo,400);
  }
  for(const usuario of [{rol:'admin',cliente_id:7},{rol:'mecanico',cliente_id:7},{rol:'cliente'}]){
    const res=respuesta();await registroContacto({usuario,body:{telefono:'987654321',whatsapp:true}},res);assert.equal(res.codigo,403);
  }
  assert.equal(consultado,false);
});

test('si falla guardar preferencias permite reintentar y no devuelve detalles internos',async()=>{
  db.from=tabla=>tabla==='clientes'?{update(){return this},eq:async()=>({error:null})}:{upsert:async()=>({error:{message:'detalle privado'}})};
  const res=respuesta();await registroContacto({usuario:{rol:'cliente',cliente_id:7},body:{telefono:'+51987654321',whatsapp:true}},res);
  assert.equal(res.codigo,503);assert.ok(!res.data.mensaje.includes('privado'));
});
