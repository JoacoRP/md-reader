#!/usr/bin/env node
// Descarga/copia los binarios de Piper (modo lector — voz neuronal "alta calidad")
// a web/public/piper/, que Vite empaqueta en web/dist y el instalador de Electron
// distribuye. Así los usuarios finales tienen TTS neuronal 100% offline desde el
// primer play, sin versionar ~90 MB de binarios en git (esta carpeta está en
// .gitignore). Buildear requiere internet UNA vez; después es idempotente y saltea
// lo ya presente.
//
//   - motor ONNX Runtime Web  -> se copia de node_modules (dependencia instalada)
//   - phonemizer piper (espeak) -> se baja de jsdelivr (@diffusionstudio/piper-wasm)
//   - modelo de voz es_ES-davefx-medium -> se baja de HuggingFace (rhasspy/piper, MIT)
//
// Uso: `node scripts/fetch-piper-assets.mjs` (o `npm run fetch:piper`). Corre solo
// como `prebuild` antes de `vite build`.

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PIPER_DIR = path.join(ROOT, 'web', 'public', 'piper');

// Voz por defecto bundleada. Castellano, calidad "medium" (~60 MB). El id debe
// existir en el PATH_MAP de @mintplex-labs/piper-tts-web y coincidir con el que
// usa PiperProvider (web/src/lib/piper.ts).
const VOICE_ID = 'es_ES-davefx-medium';
const HF_BASE = 'https://huggingface.co/diffusionstudio/piper-voices/resolve/main';
const HF_MODEL_PATH = 'es/es_ES/davefx/medium/es_ES-davefx-medium.onnx';
const PHONEMIZE_BASE =
  'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize';

// Motor ONNX que efectivamente carga ort-web 1.18. El entry por defecto de
// onnxruntime-web (`ort.bundle.min.mjs`, con soporte WebGPU/JSEP) referencia la
// variante JSEP del wasm — es la que hay que servir, no la plana, o ort da 404.
// El .mjs es el glue de emscripten; lo copiamos al lado por si ort lo resuelve
// desde wasmPaths además del bundle.
const ORT_FILES = ['ort-wasm-simd-threaded.jsep.wasm', 'ort-wasm-simd-threaded.jsep.mjs'];

function hum(n) {
  return n >= 1024 * 1024 ? `${(n / 1048576).toFixed(1)} MB` : `${(n / 1024).toFixed(0)} KB`;
}

async function exists(p) {
  try {
    const st = await fsp.stat(p);
    return st.size > 0;
  } catch {
    return false;
  }
}

async function download(url, dest) {
  if (await exists(dest)) {
    console.log(`  ✓ ya presente: ${path.relative(ROOT, dest)}`);
    return;
  }
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  process.stdout.write(`  ↓ bajando ${path.basename(dest)} … `);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} al bajar ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // Escritura atómica: a un .part y luego rename, para no dejar archivos a medias
  // que el chequeo idempotente daría por válidos.
  const tmp = `${dest}.part`;
  await fsp.writeFile(tmp, buf);
  await fsp.rename(tmp, dest);
  console.log(hum(buf.length));
}

async function copyFromNodeModules(relFromDist, dest) {
  if (await exists(dest)) {
    console.log(`  ✓ ya presente: ${path.relative(ROOT, dest)}`);
    return;
  }
  const ortDist = path.dirname(require.resolve('onnxruntime-web'));
  // require.resolve devuelve el .mjs/.cjs de entrada; el dist real está en /dist.
  const distDir = fs.existsSync(path.join(ortDist, relFromDist))
    ? ortDist
    : path.join(ortDist, 'dist');
  const src = path.join(distDir, relFromDist);
  if (!fs.existsSync(src)) throw new Error(`No encontré ${relFromDist} en onnxruntime-web/dist`);
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.copyFile(src, dest);
  const st = await fsp.stat(dest);
  console.log(`  ⧉ copiado ${path.basename(dest)} (${hum(st.size)})`);
}

async function main() {
  console.log(`\n  Piper assets → ${path.relative(ROOT, PIPER_DIR)}\n`);

  // 1) Motor ONNX Runtime Web
  for (const f of ORT_FILES) {
    await copyFromNodeModules(f, path.join(PIPER_DIR, 'ort', f));
  }

  // 2) Phonemizer (wasm + data con espeak-ng embebido)
  await download(`${PHONEMIZE_BASE}.wasm`, path.join(PIPER_DIR, 'phonemize', 'piper_phonemize.wasm'));
  await download(`${PHONEMIZE_BASE}.data`, path.join(PIPER_DIR, 'phonemize', 'piper_phonemize.data'));

  // 3) Modelo de voz (.onnx + config .onnx.json). Los nombres de archivo deben
  //    quedar tal cual para que el pre-sembrado de OPFS del PiperProvider los
  //    encuentre por su último segmento de URL.
  await download(`${HF_BASE}/${HF_MODEL_PATH}`, path.join(PIPER_DIR, 'models', `${VOICE_ID}.onnx`));
  await download(
    `${HF_BASE}/${HF_MODEL_PATH}.json`,
    path.join(PIPER_DIR, 'models', `${VOICE_ID}.onnx.json`)
  );

  console.log('\n  ✅ Piper listo para bundle offline.\n');
}

main().catch((err) => {
  console.error(`\n  ❌ ${err.message}\n`);
  process.exit(1);
});
