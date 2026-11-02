// Ejecutar desde taller-backend: node scripts/backup_seguro.js
// No genera una copia en claro ni respalda sesiones activas.
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const zlib = require("node:zlib");
const db = require("../src/config/supabase");
async function main() {
  const key = Buffer.from(process.env.BACKUP_ENCRYPTION_KEY || "", "base64");
  if (key.length !== 32)
    throw new Error(
      "Configura BACKUP_ENCRYPTION_KEY con una clave aleatoria de 32 bytes en base64. Consérvala fuera del respaldo.",
    );
  const { data, error } = await db.rpc("exportar_respaldo");
  if (error)
    throw new Error(
      "No se pudo obtener la instantánea. Verifica la migración y la clave privada de Supabase.",
    );
  // Cotizaciones es opcional y se exporta aparte; no forma parte de la instantánea del programa.
  if (process.env.BACKUP_INCLUDE_QUOTES === "true") {
    const quotes = [];
    for (let offset = 0; ; offset += 500) {
      const { data: rows, error: e } = await db
        .from("cotizaciones")
        .select("*")
        .order("id")
        .range(offset, offset + 499);
      if (e) throw new Error("No se pudieron respaldar las cotizaciones.");
      quotes.push(...rows);
      if (rows.length < 500) break;
    }
    data.cotizaciones = quotes;
  }
  const iv = crypto.randomBytes(12),
    cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(zlib.gzipSync(Buffer.from(JSON.stringify(data)))),
    cipher.final(),
  ]);
  const dir = path.resolve(__dirname, "../backups");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(
    dir,
    `rujim-${new Date().toISOString().replace(/[:.]/g, "-")}.json.gz.enc`,
  );
  await fs.writeFile(
    file,
    Buffer.concat([Buffer.from("RUJIM1"), iv, cipher.getAuthTag(), encrypted]),
    { flag: "wx", mode: 0o600 },
  );
  console.log("Respaldo cifrado creado:", file);
}
if (require.main === module)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
module.exports = { main };
