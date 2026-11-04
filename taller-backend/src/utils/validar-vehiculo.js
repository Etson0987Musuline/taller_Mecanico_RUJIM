function validarVehiculo(body, crear) {
  const data={...body};
  for(const field of ['marca','modelo']) {
    if(typeof data[field]!=='string' || !data[field].trim() || data[field].trim().length>60)
      throw new Error('Indica una marca y un modelo válidos.');
    data[field]=data[field].trim();
  }
  if(crear){
    data.cliente_id=Number(data.cliente_id);
    if(!Number.isSafeInteger(data.cliente_id)||data.cliente_id<1)throw new Error('Selecciona un cliente válido.');
    if(typeof data.placa!=='string' || !/^[A-Z0-9 -]{3,12}$/.test(data.placa.trim().toUpperCase()))throw new Error('Indica una placa válida.');
    data.placa=data.placa.trim().toUpperCase();
  }
  data.km_ingreso=Number(data.km_ingreso ?? 0);
  if(!Number.isSafeInteger(data.km_ingreso)||data.km_ingreso<0||data.km_ingreso>10000000)throw new Error('El kilometraje debe ser un entero entre 0 y 10000000.');
  for(const field of ['anio','anio_modelo']) {
    if(data[field]===undefined||data[field]===null||data[field]===''){data[field]=null;continue;}
    data[field]=Number(data[field]);
    if(!Number.isInteger(data[field])||data[field]<1886||data[field]>new Date().getFullYear()+1)throw new Error('Revisa el año del vehículo.');
  }
  return data;
}
module.exports={validarVehiculo};
