const supabase = require('../config/supabase');
const XLSX     = require('xlsx');
const sharp    = require('sharp');
const path     = require('path');
const fs       = require('fs');

const getRepuestos = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('repuestos')
      .select('*')
      .order('nombre');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener repuestos' });
  }
};

const getStockBajo = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v_stock_bajo')
      .select('*');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener stock bajo' });
  }
};

const createRepuesto = async (req, res) => {
  const { codigo, nombre, descripcion, categoria, stock, stock_minimo,
          precio_compra, precio_venta, proveedor, unidad_medida, precio_mayor,
          cantidad_mayor, codigo_barra, marca, moneda, marca_oem, proveedor_oem,
          codigo_oem, codigo_original, precio_dist1, precio_dist2, precio_dist3 } = req.body;
  if (!nombre) return res.status(400).json({ mensaje: 'El nombre es requerido' });

  let imagen = null;
  if (req.file) {
    imagen = await procesarImagen(req.file);
  }

  const valCodigo = (codigo && String(codigo).trim()) ? String(codigo).trim() : null;
  const valCodigoBarra = (codigo_barra && String(codigo_barra).trim()) ? String(codigo_barra).trim() : null;

  try {
    const { data, error } = await supabase
      .from('repuestos')
      .insert([{
        codigo: valCodigo,
        nombre,
        descripcion,
        categoria,
        stock: Number(stock) || 0,
        stock_minimo: Number(stock_minimo) || 5,
        precio_compra: Number(precio_compra) || 0,
        precio_venta: Number(precio_venta) || 0,
        proveedor,
        unidad_medida,
        precio_mayor: Number(precio_mayor) || 0,
        cantidad_mayor: Number(cantidad_mayor) || 0,
        codigo_barra: valCodigoBarra,
        marca,
        moneda: moneda || 'PEN',
        marca_oem,
        proveedor_oem,
        codigo_oem,
        codigo_original,
        precio_dist1: Number(precio_dist1) || 0,
        precio_dist2: Number(precio_dist2) || 0,
        precio_dist3: Number(precio_dist3) || 0,
        imagen
      }])
      .select('id')
      .single();

    if (error) throw error;
    res.status(201).json({ mensaje: 'Repuesto creado', id: data.id });
  } catch (err) {
    console.error('Error al crear repuesto:', err);
    res.status(500).json({ mensaje: 'Error al crear repuesto' });
  }
};

const updateRepuesto = async (req, res) => {
  const { codigo, nombre, descripcion, categoria, precio_compra, precio_venta,
          proveedor, unidad_medida, precio_mayor, cantidad_mayor,
          codigo_barra, marca, moneda, marca_oem, proveedor_oem, codigo_oem,
          codigo_original, precio_dist1, precio_dist2, precio_dist3 } = req.body;

  const stock        = parseFloat(req.body.stock)        || 0;
  const stock_minimo = parseFloat(req.body.stock_minimo) || 0;
  const valCodigo = (codigo && String(codigo).trim()) ? String(codigo).trim() : null;
  const valCodigoBarra = (codigo_barra && String(codigo_barra).trim()) ? String(codigo_barra).trim() : null;

  try {
    let imagen = req.body.imagen_actual || null;
    if (req.file) {
      if (req.body.imagen_actual) {
        const rutaAnterior = path.join(__dirname, '../uploads/repuestos',
          path.basename(req.body.imagen_actual));
        if (fs.existsSync(rutaAnterior)) fs.unlinkSync(rutaAnterior);
      }
      imagen = await procesarImagen(req.file);
    }

    const { error } = await supabase
      .from('repuestos')
      .update({
        codigo: valCodigo,
        nombre,
        descripcion,
        categoria,
        stock,
        stock_minimo,
        precio_compra: parseFloat(precio_compra) || 0,
        precio_venta: parseFloat(precio_venta) || 0,
        proveedor,
        unidad_medida,
        precio_mayor: parseFloat(precio_mayor) || 0,
        cantidad_mayor: parseInt(cantidad_mayor) || 0,
        codigo_barra: valCodigoBarra,
        marca,
        moneda: moneda || 'PEN',
        marca_oem,
        proveedor_oem,
        codigo_oem,
        codigo_original,
        precio_dist1: parseFloat(precio_dist1) || 0,
        precio_dist2: parseFloat(precio_dist2) || 0,
        precio_dist3: parseFloat(precio_dist3) || 0,
        imagen,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ mensaje: 'Repuesto actualizado' });
  } catch (err) {
    console.error('Error al actualizar repuesto:', err);
    res.status(500).json({ mensaje: 'Error al actualizar repuesto' });
  }
};

const eliminarRepuesto = async (req, res) => {
  try {
    const { data: rows } = await supabase
      .from('repuestos')
      .select('imagen')
      .eq('id', req.params.id);

    await supabase.from('detalle_ventas').update({ repuesto_id: null }).eq('repuesto_id', req.params.id);
    await supabase.from('orden_repuestos').update({ repuesto_id: null }).eq('repuesto_id', req.params.id);
    const { error } = await supabase.from('repuestos').delete().eq('id', req.params.id);

    if (error) throw error;
    if (rows && rows.length && rows[0].imagen) eliminarImagenDisco(rows[0].imagen);

    res.json({ mensaje: 'Repuesto eliminado correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al eliminar repuesto' });
  }
};

const eliminarGrupal = async (req, res) => {
  const { ids, categoria } = req.body;
  try {
    let repuestos = [];

    if (categoria) {
      const { data } = await supabase.from('repuestos').select('id, imagen').eq('categoria', categoria);
      repuestos = data || [];
    } else if (ids && ids.length > 0) {
      const { data } = await supabase.from('repuestos').select('id, imagen').in('id', ids);
      repuestos = data || [];
    } else {
      return res.status(400).json({ mensaje: 'Debes enviar ids o categoria' });
    }

    if (repuestos.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontraron productos' });
    }

    const idsEliminar = repuestos.map(r => r.id);

    await supabase.from('detalle_ventas').update({ repuesto_id: null }).in('repuesto_id', idsEliminar);
    await supabase.from('orden_repuestos').update({ repuesto_id: null }).in('repuesto_id', idsEliminar);
    const { error } = await supabase.from('repuestos').delete().in('id', idsEliminar);

    if (error) throw error;
    repuestos.forEach(r => { if (r.imagen) eliminarImagenDisco(r.imagen); });

    res.json({ mensaje: `${repuestos.length} producto(s) eliminados`, eliminados: repuestos.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al eliminar productos' });
  }
};

const previewEliminar = async (req, res) => {
  const { ids, categoria } = req.body;
  try {
    let rows = [];
    if (categoria) {
      const { data } = await supabase.from('repuestos').select('id, nombre, categoria').eq('categoria', categoria);
      rows = data || [];
    } else if (ids && ids.length > 0) {
      const { data } = await supabase.from('repuestos').select('id, nombre, categoria').in('id', ids);
      rows = data || [];
    }
    res.json({ total: rows.length, productos: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener preview' });
  }
};

// ── Helpers para importación de Excel ──
function normalizarClave(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function getValor(filaNorm, aliasList) {
  for (const alias of aliasList) {
    const clave = normalizarClave(alias);
    if (filaNorm[clave] !== undefined && filaNorm[clave] !== null) {
      const val = String(filaNorm[clave]).trim();
      if (val !== '') return val;
    }
  }
  return '';
}

function getNumero(filaNorm, aliasList, defecto = 0) {
  const val = getValor(filaNorm, aliasList);
  if (val === '') return defecto;
  const num = parseFloat(String(val).replace(/,/g, ''));
  return isNaN(num) ? defecto : num;
}

const importarExcel = async (req, res) => {
  if (!req.file) return res.status(400).json({ mensaje: 'No se envió ningún archivo' });

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    let filas = [];
    for (const name of workbook.SheetNames) {
      const hoja = workbook.Sheets[name];
      const data = XLSX.utils.sheet_to_json(hoja, { defval: '' });
      if (data && data.length > 0) {
        filas = data;
        break;
      }
    }

    if (filas.length === 0) {
      return res.status(400).json({ mensaje: 'El archivo Excel no contiene datos o está vacío' });
    }

    // Precargar repuestos existentes para búsqueda rápida en memoria
    const { data: existentes } = await supabase.from('repuestos').select('id, codigo, codigo_barra, nombre');
    const mapCodigo = new Map();
    const mapBarra  = new Map();
    const mapNombre = new Map();

    for (const r of (existentes || [])) {
      if (r.codigo && String(r.codigo).trim()) {
        mapCodigo.set(String(r.codigo).trim().toUpperCase(), r.id);
      }
      if (r.codigo_barra && String(r.codigo_barra).trim()) {
        mapBarra.set(String(r.codigo_barra).trim().toUpperCase(), r.id);
      }
      if (r.nombre && String(r.nombre).trim()) {
        mapNombre.set(String(r.nombre).trim().toLowerCase(), r.id);
      }
    }

    let insertados = 0, actualizados = 0, errores = 0;
    const detalleErrores = [];

    for (let i = 0; i < filas.length; i++) {
      const fila = filas[i];
      const tieneValores = Object.values(fila).some(v => String(v || '').trim() !== '');
      if (!tieneValores) continue;

      const filaNorm = {};
      for (const [k, v] of Object.entries(fila)) {
        filaNorm[normalizarClave(k)] = v;
      }

      const nombre = getValor(filaNorm, [
        'nombre', 'producto', 'articulo', 'descripcion', 'descripcion producto',
        'repuesto', 'tablet descripcion', 'item'
      ]);

      if (!nombre) {
        errores++;
        detalleErrores.push(`Fila ${i + 2}: Sin nombre de repuesto`);
        continue;
      }

      const rawCodigo = getValor(filaNorm, [
        'ubicacion', 'codigo', 'cod', 'codigo ubicacion', 'cod interno',
        'codigo interno', 'ubicacion codigo'
      ]);
      const codigo = rawCodigo ? rawCodigo : null;

      const rawBarra = getValor(filaNorm, [
        'codigo barra', 'codigo de barra', 'codigo de barras', 'barcode',
        'cod barra', 'codigo_barra'
      ]);
      const codigo_barra = rawBarra ? rawBarra : null;

      const stock          = getNumero(filaNorm, ['stock', 'cantidad', 'cant', 'existencias', 'stock actual'], 0);
      const precio_venta   = getNumero(filaNorm, ['precio unidad', 'precio venta', 'p venta', 'p. venta', 'precio', 'pvp', 'precio unitario'], 0);
      const precio_compra  = getNumero(filaNorm, ['costo unidad', 'precio compra', 'costo', 'p compra', 'p. compra', 'costo unitario', 'precio costo'], 0);
      const unidad_medida  = getValor(filaNorm, ['unidad de medida', 'unidad', 'medida', 'um', 'u.m.', 'und']) || 'UND';
      const precio_mayor   = getNumero(filaNorm, ['precio por mayor', 'precio mayor', 'p mayor', 'p. mayor'], 0);
      const cantidad_mayor = Math.round(getNumero(filaNorm, ['cantidad por mayor', 'cantidad mayor', 'cant mayor', 'cant. mayor'], 0));
      const categoria      = getValor(filaNorm, ['categoria', 'rubro', 'familia', 'linea', 'grupo']) || null;
      const marca          = getValor(filaNorm, ['marca', 'brand', 'fabricante']) || null;
      const moneda         = getValor(filaNorm, ['tipo de moneda', 'moneda', 'divisa']) || 'PEN';
      const marca_oem      = getValor(filaNorm, ['marca oem', 'marca_oem', 'oem marca']) || null;
      const proveedor_oem  = getValor(filaNorm, ['proveedor oem', 'provedor oem', 'proveedor_oem', 'provedor_oem']) || null;
      const proveedor      = getValor(filaNorm, ['proveedor', 'provedor']) || proveedor_oem || null;
      const codigo_oem     = getValor(filaNorm, ['codigo oem', 'codigo_oem', 'cod oem']) || null;
      const codigo_original= getValor(filaNorm, ['codigo original', 'codigo_original', 'cod original']) || null;
      const precio_dist1   = getNumero(filaNorm, ['precio distribuidor 1', 'precio dist 1', 'p dist 1', 'precio dist1', 'distribuidor 1'], 0);
      const precio_dist2   = getNumero(filaNorm, ['precio distribuidor 2', 'precio dist 2', 'p dist 2', 'precio dist2', 'distribuidor 2'], 0);
      const precio_dist3   = getNumero(filaNorm, ['precio distribuidor 3', 'precio dist 3', 'p dist 3', 'precio dist3', 'distribuidor 3'], 0);
      const imagen         = getValor(filaNorm, ['imagen', 'foto', 'img', 'url imagen']) || null;

      try {
        let targetId = null;
        if (codigo && mapCodigo.has(codigo.toUpperCase())) {
          targetId = mapCodigo.get(codigo.toUpperCase());
        } else if (codigo_barra && mapBarra.has(codigo_barra.toUpperCase())) {
          targetId = mapBarra.get(codigo_barra.toUpperCase());
        } else if (mapNombre.has(nombre.toLowerCase())) {
          targetId = mapNombre.get(nombre.toLowerCase());
        }

        const repuestoPayload = {
          nombre,
          codigo,
          stock,
          precio_venta,
          precio_compra,
          unidad_medida,
          precio_mayor,
          cantidad_mayor,
          codigo_barra,
          categoria,
          marca,
          moneda,
          marca_oem,
          proveedor_oem,
          proveedor,
          codigo_oem,
          codigo_original,
          precio_dist1,
          precio_dist2,
          precio_dist3,
          ...(imagen ? { imagen } : {})
        };

        if (targetId) {
          await supabase.from('repuestos').update(repuestoPayload).eq('id', targetId);
          if (codigo) mapCodigo.set(codigo.toUpperCase(), targetId);
          if (codigo_barra) mapBarra.set(codigo_barra.toUpperCase(), targetId);
          mapNombre.set(nombre.toLowerCase(), targetId);
          actualizados++;
        } else {
          const { data: newRow, error: insErr } = await supabase.from('repuestos').insert([repuestoPayload]).select('id').single();
          if (insErr) throw insErr;
          const newId = newRow.id;
          if (codigo) mapCodigo.set(codigo.toUpperCase(), newId);
          if (codigo_barra) mapBarra.set(codigo_barra.toUpperCase(), newId);
          mapNombre.set(nombre.toLowerCase(), newId);
          insertados++;
        }
      } catch (rowErr) {
        errores++;
        detalleErrores.push(`${nombre}: ${rowErr.message}`);
      }
    }

    res.json({ mensaje: 'Importación completada', insertados, actualizados, errores, detalleErrores });
  } catch (err) {
    console.error('Error al importar Excel:', err);
    res.status(500).json({ mensaje: 'Error al procesar el archivo Excel: ' + (err.message || 'Error interno') });
  }
};

// ── Helpers ──
async function procesarImagen(file) {
  const nombreOptimizado = `opt_${Date.now()}.webp`;
  const rutaSalida = path.join(__dirname, '../uploads/repuestos', nombreOptimizado);
  
  await sharp(file.path)
    .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(rutaSalida);

  setTimeout(() => {
    try {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    } catch (e) {}
  }, 500);

  return `/uploads/repuestos/${nombreOptimizado}`;
}

function eliminarImagenDisco(imagenUrl) {
  try {
    const nombre = path.basename(imagenUrl);
    const ruta   = path.join(__dirname, '../uploads/repuestos', nombre);
    if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
  } catch (e) {}
}

module.exports = {
  getRepuestos, getStockBajo, createRepuesto, updateRepuesto,
  eliminarRepuesto, eliminarGrupal, previewEliminar, importarExcel
};