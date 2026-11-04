const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validarVehiculo}=require('../src/utils/validar-vehiculo');
const base={cliente_id:1,placa:'abc-123',marca:' Toyota ',modelo:'Corolla',km_ingreso:0};
test('normaliza nuevos vehículos y conserva el kilometraje cero',()=>{
  const v=validarVehiculo(base,true);
  assert.equal(v.placa,'ABC-123');assert.equal(v.marca,'Toyota');assert.equal(v.km_ingreso,0);assert.equal(v.anio,null);
});
test('rechaza valores inválidos antes de escribir en la base de datos',()=>{
  for(const cambio of [{placa:42},{placa:'ABC%,id.gt.0'},{cliente_id:0},{km_ingreso:-1},{km_ingreso:'no es número'},{km_ingreso:3.5},{anio:1500},{marca:'   '},{modelo:null}]){
    assert.throws(()=>validarVehiculo({...base,...cambio},true));
  }
});
test('editar no exige reenviar campos inmutables de identificación',()=>{
  const v=validarVehiculo({marca:'Kia',modelo:'Rio',anio:'2020',km_ingreso:'100'},false);
  assert.equal(v.anio,2020);assert.equal(v.km_ingreso,100);
});
