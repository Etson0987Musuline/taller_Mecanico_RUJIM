const router = require('express').Router();
const https  = require('https');
const jwt    = require('jsonwebtoken');

const tokenOpcional = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    try { req.usuario = jwt.verify(token, process.env.JWT_SECRET); } catch (_) {}
  }
  next();
};

router.use(tokenOpcional);

router.get('/dni/:numero', (req, res) => {
  const { numero } = req.params;
  if (!/^\d{8}$/.test(numero))
    return res.status(422).json({ mensaje: 'DNI debe tener 8 dígitos' });
  const url = `https://apiperu.dev/api/dni/${numero}?api_token=${process.env.PERU_API_KEY}`;
  llamarApi(url, res, 'dni');
});

router.get('/ruc/:numero', (req, res) => {
  const { numero } = req.params;
  if (!/^\d{11}$/.test(numero))
    return res.status(422).json({ mensaje: 'RUC debe tener 11 dígitos' });
  const url = `https://apiperu.dev/api/ruc/${numero}?api_token=${process.env.PERU_API_KEY}`;
  llamarApi(url, res, 'ruc');
});

router.get('/placa/:placa', (req, res) => {
  const placa = req.params.placa.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (placa.length < 6)
    return res.status(422).json({ mensaje: 'Placa inválida' });
  const url = `https://peruapi.com/api/vehiculo/${placa}?api_token=${process.env.PERU_API_KEY_2}`;
  llamarApi(url, res, 'placa');
});

function llamarApi(url, res, tipo) {
  const request = https.get(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'taller-backend/1.0' },
    timeout: 8000
  }, (apiRes) => {
    let data = '';
    apiRes.on('data', chunk => data += chunk);
    apiRes.on('end', () => {
      try {
        const json = JSON.parse(data);

        if (tipo === 'dni') {
          if (!json.success)
            return res.status(404).json({ mensaje: 'DNI no encontrado' });
          const d = json.data;
          return res.json({
            nombres:         d.nombres         || '',
            apellidoPaterno: d.apellido_paterno || '',
            apellidoMaterno: d.apellido_materno || '',
            nombreCompleto:  d.nombre_completo  || ''
          });
        }

        if (tipo === 'ruc') {
          if (!json.success)
            return res.status(404).json({ mensaje: 'RUC no encontrado' });
          const d = json.data;
          return res.json({
            razonSocial: d.nombre_o_razon_social || '',
            direccion:   d.direccion             || '',
            estado:      d.estado                || '',
            condicion:   d.condicion             || ''
          });
        }

        if (tipo === 'placa') {
          if (json.code && json.code !== '200')
            return res.status(404).json({ mensaje: 'Placa no encontrada' });
          return res.json({
            marca:      json.marca         || '',
            modelo:     json.modelo        || '',
            anio:       json.ano_modelo    || json.ano_fabricacion || '',
            color:      json.color         || '',
            propietario: json.propietario  || '',
            nMotor:     json.numero_motor  || '',
            nSerie:     json.numero_serie  || '',
            estado:     json.estado        || '',
            tipo:       json.tipo_vehiculo || '',
            categoria:  json.categoria     || ''
          });
        }

      } catch (e) {
        if (!res.headersSent) {
          console.error('Error parseando respuesta:', e.message);
          res.status(502).json({ mensaje: 'Respuesta inválida del servicio externo' });
        }
      }
    });
  });

  request.on('timeout', () => {
    request.destroy();
    if (!res.headersSent) {
      res.status(504).json({ mensaje: 'Tiempo de espera agotado con la entidad externa' });
    }
  });

  request.on('error', (err) => {
    if (!res.headersSent) {
      console.error('Error consultando API externa:', err.message);
      res.status(500).json({ mensaje: 'Error al consultar el servicio externo' });
    }
  });
}

module.exports = router;