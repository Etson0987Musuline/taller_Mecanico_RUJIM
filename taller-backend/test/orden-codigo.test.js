const {test}=require('node:test');
const assert=require('node:assert/strict');
const codigos=new Set();
const dbPath=require.resolve('../src/config/supabase');
require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{from(tabla){
  const q={insert(rows){
    if(tabla==='seguimiento')return Promise.resolve({error:null});
    const codigo=rows[0].codigo;
    const repetido=codigos.has(codigo);codigos.add(codigo);
    return {select(){return {single:async()=>({data:repetido?null:{id:codigos.size},error:repetido?{code:'23505'}:null})};}};
  },select(){return Promise.resolve({count:0});}};
  return q;
}}};
const {createOrden}=require('../src/controllers/ordenes.controller');
const response=()=>({statusCode:200,status(n){this.statusCode=n;return this;},json(data){this.data=data;return this;}});
test('órdenes creadas en paralelo no reutilizan códigos al vaciar el historial',async()=>{
  const responses=await Promise.all(Array.from({length:20},async()=>{
    const res=response();
    await createOrden({usuario:{id:1,rol:'admin'},body:{vehiculo_id:1,descripcion_problema:'Revisión'}},res);
    return res;
  }));
  assert.equal(codigos.size,20);
  for(const res of responses){assert.equal(res.statusCode,201);assert.ok(res.data.codigo.length<=20);}
});
