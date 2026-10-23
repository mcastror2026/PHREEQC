"use strict";

/* ====================================================================
   PHREEQC en el navegador — lógica de la página
   El motor (phreeqc.js + phreeqc.wasm) se instancia en cada cálculo.
   ==================================================================== */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- Configuración ---------- */

const BASES_DEF = [
  { f: "phreeqc.dat", n: "phreeqc.dat — general (recomendada)", guiada: true },
  { f: "wateq4f.dat", n: "wateq4f.dat — aguas naturales, muchos minerales", guiada: true },
  { f: "minteq.v4.dat", n: "minteq.v4.dat — MINTEQ v4", guiada: true },
  { f: "minteq.dat", n: "minteq.dat — MINTEQ", guiada: true },
  { f: "pitzer.dat", n: "pitzer.dat — salmueras (Pitzer)", guiada: false },
  { f: "sit.dat", n: "sit.dat — fuerza iónica alta (SIT)", guiada: false },
  { f: "llnl.dat", n: "llnl.dat — LLNL", guiada: false },
  { f: "Amm.dat", n: "Amm.dat — con amoníaco", guiada: false },
];

// Elementos del formulario. 'el' es el nombre que usa PHREEQC.
const ELEMENTOS = [
  { el: "Ca", n: "Calcio (Ca)" },
  { el: "Mg", n: "Magnesio (Mg)" },
  { el: "Na", n: "Sodio (Na)" },
  { el: "K", n: "Potasio (K)" },
  { el: "Cl", n: "Cloruro (Cl)" },
  { el: "S(6)", n: "Sulfato (como SO₄)" },
  { el: "Alkalinity", n: "Alcalinidad", alc: true },
  { el: "N(5)", n: "Nitrato (como NO₃)" },
  { el: "Fe", n: "Hierro (Fe)" },
  { el: "Mn", n: "Manganeso (Mn)" },
  { el: "Si", n: "Sílice (Si)" },
  { el: "Al", n: "Aluminio (Al)" },
  { el: "Ba", n: "Bario (Ba)" },
  { el: "Sr", n: "Estroncio (Sr)" },
  { el: "F", n: "Fluoruro (F)" },
  { el: "B", n: "Boro (B)" },
  { el: "P", n: "Fósforo (como PO₄)" },
  { el: "Zn", n: "Zinc (Zn)" },
];

const MINERALES_HABITUALES_DEF = [
  "Calcite", "Aragonite", "Dolomite", "Magnesite", "Siderite", "Rhodochrosite", "Strontianite",
  "Gypsum", "Anhydrite", "Barite", "Celestite", "Halite", "Fluorite",
  "Quartz", "Chalcedony", "SiO2(a)", "Brucite", "Gibbsite", "Kaolinite",
  "Fe(OH)3(a)", "Goethite", "Hematite", "Pyrite",
];
const MINERALES_BARRIDO_DEFECTO_DEF = ["Calcite", "Aragonite", "Dolomite", "Gypsum", "Siderite", "Fe(OH)3(a)"];

const PRESETS = {
  "": { nombre: "— en blanco —", datos: {} },
  mar: {
    nombre: "Agua de mar (Nordstrom y otros, 1979)",
    u: "ppm", pH: 8.22, pe: 8.451, dens: 1.023, temp: 25,
    datos: { Ca: 412.3, Mg: 1291.8, Na: 10768, K: 399.1, Cl: 19353, "S(6)": 2712, Alkalinity: 141.682, Si: 4.28, Fe: 0.002, Mn: 0.0002 },
  },
  dulce: {
    nombre: "Agua dulce típica (ejemplo)",
    u: "mg/l", pH: 7.6, pe: 4, dens: 1, temp: 15,
    datos: { Ca: 40, Mg: 10, Na: 12, K: 2, Cl: 15, "S(6)": 25, Alkalinity: 150 },
  },
  acida: {
    nombre: "Drenaje ácido de mina (ejemplo)",
    u: "mg/l", pH: 3, pe: 10, dens: 1, temp: 20,
    datos: { Ca: 300, Mg: 50, Na: 20, Fe: 200, Al: 20, "S(6)": 1500 },
  },
};

const EJEMPLOS_DEF = [
  ["ex1", "Ej. 1 — Agregar uranio y especiar agua de mar"],
  ["ex2", "Ej. 2 — Dependencia de la solubilidad con la temperatura"],
  ["ex3", "Ej. 3 — Equilibrio de calcita con CO₂"],
  ["ex4", "Ej. 4 — Evaporación de agua de lluvia"],
  ["ex5", "Ej. 5 — Oxígeno, pirita, calcita y goethita"],
  ["ex6", "Ej. 6 — Reacciones hasta límites de fase"],
  ["ex7", "Ej. 7 — Descomposición de materia orgánica"],
];

// Estos valores pueden reemplazarse desde config.json (sin tocar el código).
let BASES = BASES_DEF;
let EJEMPLOS = EJEMPLOS_DEF;
let MINERALES_HABITUALES = MINERALES_HABITUALES_DEF;
let MINERALES_BARRIDO_DEFECTO = MINERALES_BARRIDO_DEFECTO_DEF;

async function cargarConfig() {
  try {
    const r = await fetch("config.json", { cache: "no-cache" });
    if (!r.ok) return;
    const c = await r.json();
    if (Array.isArray(c.bases) && c.bases.length) BASES = c.bases.filter((b) => b && b.archivo).map((b) => ({ f: b.archivo, n: b.nombre || b.archivo, guiada: !!b.guiada }));
    if (Array.isArray(c.ejemplos)) EJEMPLOS = c.ejemplos.filter((e) => e && e.archivo).map((e) => [e.archivo, e.nombre || e.archivo, e.base || "phreeqc.dat"]);
    if (Array.isArray(c.minerales_habituales)) MINERALES_HABITUALES = c.minerales_habituales;
    if (Array.isArray(c.minerales_barrido_defecto)) MINERALES_BARRIDO_DEFECTO = c.minerales_barrido_defecto;
  } catch (e) { /* si falla, se usan los valores por defecto del código */ }
}

/* ---------- Constantes termodinámicas ---------- */
const R_KJ = 8.314462618e-3;   // kJ/(mol·K)
const F_CONST = 96485.33212;   // C/mol
const LN10 = Math.LN10;
// ΔG de la reacción de disolución (kJ/mol) = RT·ln(IAP/K) = 2,3026·R·T·SI
const dG = (si, T) => LN10 * R_KJ * T * si;
// Eh (V) = pe · 2,3026·R·T / F
const Eh = (pe, T) => (pe * LN10 * R_KJ * 1000 * T) / F_CONST;

/* ---------- Utilidades ---------- */

const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

function numero(sel, nombre, min, max) {
  const t = String($(sel).value).trim().replace(",", ".");
  const v = Number(t);
  if (t === "" || !Number.isFinite(v)) throw new Error(`"${nombre}" debe ser un número.`);
  if (min !== undefined && v < min) throw new Error(`"${nombre}" no puede ser menor que ${min}.`);
  if (max !== undefined && v > max) throw new Error(`"${nombre}" no puede ser mayor que ${max}.`);
  return v;
}

function fmt(x, dig = 3) {
  if (x === null || x === undefined || x === "" || Number.isNaN(Number(x))) return "—";
  const v = Number(x);
  if (v === 0) return "0";
  const a = Math.abs(v);
  if (a >= 1e4 || a < 1e-3) return v.toExponential(dig - 1);
  return v.toPrecision(dig + 1).replace(/\.?0+$/, "");
}

function descargar(nombre, texto, tipo = "text/plain") {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo + ";charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nombre });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Deja que el navegador pinte el mensaje "Calculando…" antes del cálculo.
// (setTimeout, no requestAnimationFrame: éste se detiene si la pestaña pasa a segundo plano)
const pausa = () => new Promise((r) => setTimeout(r, 30));

/* ---------- Motor PHREEQC ---------- */

const cacheBases = {};
async function cargarBase(f) {
  if (!cacheBases[f]) {
    const r = await fetch("database/" + f);
    if (!r.ok) throw new Error("No se pudo cargar la base de datos " + f);
    cacheBases[f] = await r.text();
  }
  return cacheBases[f];
}

async function abrirMotor(base) {
  const consola = [];
  const M = await createPhreeqc({
    print: (t) => consola.push(t),
    printErr: (t) => consola.push("[err] " + t),
  });
  M.FS.writeFile("/db.dat", await cargarBase(base));
  return { M, consola };
}

// Ejecuta una entrada en un motor ya abierto (se puede reutilizar para muchos cálculos).
function correr(motor, entrada) {
  const { M, consola } = motor;
  consola.length = 0;
  for (const f of ["/out.pqo", "/sel.out"]) { try { M.FS.unlink(f); } catch (e) { /* no existía */ } }
  M.FS.writeFile("/in.pqi", entrada);
  let excepcion = null;
  try {
    M.callMain(["/in.pqi", "/out.pqo", "/db.dat"]);
  } catch (e) {
    excepcion = e;
  }
  const leer = (p) => { try { return M.FS.readFile(p, { encoding: "utf8" }); } catch (e) { return ""; } };
  const out = leer("/out.pqo");
  const sel = leer("/sel.out");
  const todoTexto = out + "\n" + consola.join("\n");
  const errores = [...todoTexto.matchAll(/^\s*(?:\[err\]\s*)?(ERROR:.*)$/gm)].map((m) => m[1].trim());
  const unicos = [...new Set(errores)];
  // PHREEQC avisa de problemas no fatales con WARNING (p. ej. elemento inexistente: queda en cero).
  const advertencias = extraerAdvertencias(todoTexto);
  let fallo = false;
  if (excepcion && !(excepcion && excepcion.status === 0)) {
    const msg = excepcion.message || String(excepcion);
    if (!/^Program terminated with exit/.test(msg)) { fallo = true; if (!unicos.length) unicos.push("ERROR: " + msg); }
  }
  return { out, sel, consola: consola.join("\n"), errores: unicos, advertencias, fallo };
}

async function ejecutar(base, entrada) {
  return correr(await abrirMotor(base), entrada);
}

function extraerAdvertencias(texto) {
  const lineas = texto.replace(/\[err\]\s?/g, "").split(/\r?\n/);
  const lista = [];
  for (let i = 0; i < lineas.length; i++) {
    const m = lineas[i].match(/^\s*WARNING:\s*(.*)$/);
    if (!m) continue;
    let msg = m[1].trim();
    // línea(s) de continuación: empiezan con espacio o tabulación
    for (let k = 1; k <= 2 && i + k < lineas.length; k++) {
      const c = lineas[i + k];
      if (/^[ \t]+\S/.test(c) && !/^\s*(WARNING|ERROR):/.test(c)) msg += " " + c.trim();
      else break;
    }
    lista.push("WARNING: " + msg.replace(/\s+/g, " "));
  }
  return [...new Set(lista)];
}

function textoAdvertencias(r) {
  return r.advertencias.length ? "Advertencias de PHREEQC: " + r.advertencias.map((a) => a.replace(/^WARNING:\s*/, "")).join(" · ") : "";
}

/* ---------- Lectura de la base de datos (minerales disponibles) ---------- */

const PALABRAS_CLAVE = new Set([
  "SOLUTION_MASTER_SPECIES", "SOLUTION_SPECIES", "PHASES", "EXCHANGE_MASTER_SPECIES", "EXCHANGE_SPECIES",
  "SURFACE_MASTER_SPECIES", "SURFACE_SPECIES", "MEAN_GAMMAS", "RATES", "GAS_BINARY_PARAMETERS", "END",
  "LLNL_AQUEOUS_MODEL_PARAMETERS", "PITZER", "SIT", "NAMED_EXPRESSIONS", "KNOBS", "TITLE", "SOLUTION",
  "DATABASE", "CALCULATE_VALUES", "ISOTOPES", "ISOTOPE_RATIOS", "ISOTOPE_ALPHAS", "SELECTED_OUTPUT",
]);

function fasesDeBase(texto) {
  const lineas = texto.split(/\r?\n/);
  const fases = new Set();
  let dentro = false;
  for (const l of lineas) {
    if (!l.trim() || /^\s/.test(l) || l.startsWith("#")) continue;
    const t = l.trim().split(/\s+/)[0];
    if (PALABRAS_CLAVE.has(t)) { dentro = t === "PHASES"; continue; }
    if (dentro) fases.add(t);
  }
  return fases;
}

function especiesDeBase(texto) {
  // Nombres que aparecen en SOLUTION_SPECIES (lado izquierdo y derecho de las reacciones).
  const lineas = texto.split(/\r?\n/);
  const sp = new Set();
  let dentro = false;
  for (const l of lineas) {
    const t = l.trim().split(/\s+/)[0] || "";
    if (/^[A-Z_]{4,}$/.test(t) && !/^\s/.test(l)) { dentro = t === "SOLUTION_SPECIES"; continue; }
    if (!dentro || !l.includes("=")) continue;
    const sinCom = l.split("#")[0];
    sinCom.split("=").join("+").split(/\s\+\s|\s+/).forEach((x) => {
      const n = x.replace(/^\d*\.?\d*(?=[A-Za-z(])/, "").trim();
      if (n && n !== "+") sp.add(n);
    });
  }
  return sp;
}

/* ---------- Formulario de muestra ---------- */

function construirFormulario() {
  const rej = $("#rejilla-elem");
  rej.innerHTML = "";
  ELEMENTOS.forEach((e) => {
    const div = document.createElement("div");
    div.className = "celda";
    div.dataset.el = e.el;
    const par = e.alc
      ? `<div class="par"><input type="text" inputmode="decimal" aria-label="${e.n}"><select aria-label="Expresada como"><option value="HCO3">como HCO₃⁻</option><option value="CaCO3">como CaCO₃</option></select></div>`
      : `<div class="par"><input type="text" inputmode="decimal" aria-label="${e.n}"></div>`;
    div.innerHTML = `<span>${e.n}</span>${par}`;
    rej.appendChild(div);
  });

  const selPre = $("#preset");
  Object.entries(PRESETS).forEach(([k, p]) => selPre.add(new Option(p.nombre, k)));
  selPre.addEventListener("change", () => aplicarPreset(selPre.value));

  const selBase = $("#base");
  const guiadas = BASES.filter((b) => b.guiada);
  (guiadas.length ? guiadas : BASES).forEach((b) => selBase.add(new Option(b.n, b.f)));
  const selBaseA = $("#a-base");
  BASES.forEach((b) => selBaseA.add(new Option(b.n, b.f)));
}

function aplicarPreset(clave) {
  const p = PRESETS[clave];
  if (!p) return;
  $$("#rejilla-elem .celda input").forEach((i) => (i.value = ""));
  if (clave === "") return;
  $("#unidades").value = p.u;
  $("#ph").value = p.pH;
  $("#pe").value = p.pe;
  $("#dens").value = p.dens;
  $("#temp").value = p.temp;
  $("#carga").value = "none";
  Object.entries(p.datos).forEach(([el, v]) => {
    const celda = $(`#rejilla-elem .celda[data-el="${el}"] input`);
    if (celda) celda.value = v;
  });
  const alc = $('#rejilla-elem .celda[data-el="Alkalinity"] select');
  if (alc) alc.value = "HCO3";
}

function leerMuestra() {
  const u = $("#unidades").value;
  const m = {
    u,
    pH: numero("#ph", "pH", 0, 14),
    temp: numero("#temp", "Temperatura", 0, 300),
    pe: numero("#pe", "pe", -20, 30),
    dens: numero("#dens", "Densidad", 0.5, 2),
    carga: $("#carga").value,
    elems: [],
  };
  const masa = ["mg/l", "ug/l", "ppm", "ppb"].includes(u);
  $$("#rejilla-elem .celda").forEach((c) => {
    const txt = c.querySelector("input").value.trim().replace(",", ".");
    if (txt === "") return;
    const v = Number(txt);
    if (!Number.isFinite(v) || v < 0) throw new Error(`Concentración no válida para ${c.dataset.el}.`);
    if (v === 0) return;
    let como = "";
    if (c.dataset.el === "Alkalinity" && masa) como = " as " + c.querySelector("select").value;
    m.elems.push({ el: c.dataset.el, v, como });
  });
  if (!m.elems.length) throw new Error("Ingresa al menos una concentración.");
  if (["Cl", "Na"].includes(m.carga) && !m.elems.some((e) => e.el === m.carga)) {
    throw new Error(`Para ajustar ${m.carga} por balance de carga, ese elemento debe tener una concentración.`);
  }
  return m;
}

function bloqueSolucion(n, m, o = {}) {
  const pH = o.pH ?? m.pH;
  const T = o.temp ?? m.temp;
  const L = [
    `SOLUTION ${n}`,
    `  units ${m.u}`,
    `  temp ${T}`,
    `  pH ${pH}${!o.sinCarga && m.carga === "pH" ? " charge" : ""}`,
    `  pe ${m.pe}`,
    `  density ${m.dens}`,
  ];
  m.elems.forEach((e) => L.push(`  ${e.el} ${e.v}${e.como}${!o.sinCarga && m.carga === e.el ? " charge" : ""}`));
  return L.join("\n");
}

function mostrarAviso(msg) {
  const a = $("#aviso-muestra");
  a.hidden = !msg;
  a.textContent = msg || "";
}

function agregarAviso(msg) {
  if (!msg) return;
  const a = $("#aviso-muestra");
  mostrarAviso(a.hidden || !a.textContent ? msg : a.textContent + "  " + msg);
}

/* ---------- Análisis de la salida de PHREEQC ---------- */

function parsearResumen(txt) {
  const g = (re) => { const m = txt.match(re); return m ? m[1] : null; };
  return {
    pH: g(/^\s*pH\s+=\s+([-\d.]+)/m),
    pe: g(/^\s*pe\s+=\s+([-\d.]+)/m),
    mu: g(/Ionic strength \(mol\/kgw\)\s+=\s+([\d.eE+-]+)/),
    aw: g(/Activity of water\s+=\s+([\d.eE+-]+)/),
    temp: g(/Temperature \((?:deg C|°C)\)\s+=\s+([\d.eE+-]+)/),
    alk: g(/Total alkalinity \(eq\/kg\)\s+=\s+([\d.eE+-]+)/),
    cond: g(/Specific Conductance[^=\n]*=\s*([\d.eE+-]+)/),
    dens: g(/Density \(g\/cm.\)\s+=\s+([\d.eE+-]+)/),
    ctot: g(/Total carbon \(mol\/kg\)\s+=\s+([\d.eE+-]+)/),
    err: g(/Percent error[^=\n]*=\s*([-\d.eE+]+)/),
  };
}

function parsearEspecies(txt) {
  const i = txt.search(/Distribution of species/);
  if (i < 0) return [];
  const lin = txt.slice(i).split(/\r?\n/);
  const j0 = lin.findIndex((l) => /Species\s+Molality\s+Activity/.test(l));
  if (j0 < 0) return [];
  const filas = [];
  const esNum = (s) => /^[-+]?\d*\.?\d+([eE][-+]?\d+)?$/.test(s);
  for (let k = j0 + 1; k < lin.length; k++) {
    const l = lin[k];
    if (/Saturation indices|End of simulation|Reading input data/.test(l)) break;
    const t = l.trim().split(/\s+/);
    if (t.length === 2 && esNum(t[1])) filas.push({ tipo: "elem", nombre: t[0], total: +t[1] });
    else if (t.length >= 6 && t.slice(1, 6).every(esNum)) {
      filas.push({ tipo: "esp", nombre: t[0], mol: +t[1], act: +t[2], logm: +t[3], loga: +t[4], logg: +t[5] });
    }
  }
  return filas;
}

function parsearSI(txt) {
  const i = txt.search(/Saturation indices/);
  if (i < 0) return [];
  const lin = txt.slice(i).split(/\r?\n/).slice(1);
  const re = /^\s*(\S+)\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s*(.*)$/;
  const filas = [];
  let empezo = false;
  for (const l of lin) {
    const m = l.match(re);
    if (m) { empezo = true; filas.push({ fase: m[1], si: +m[2], iap: +m[3], k: +m[4], formula: m[5].trim() }); }
    else if (empezo && l.trim() && !/^\s*\*\*/.test(l)) break;
  }
  return filas.filter((f) => Math.abs(f.si) < 900);
}

function parsearTSV(txt) {
  const lin = txt.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lin.length < 2) return { cols: [], filas: [] };
  const todas = lin[0].split("\t").map((s) => s.trim());
  const cols = todas.filter(Boolean);
  const filas = lin.slice(1).map((l) => {
    const c = l.split("\t").map((s) => s.trim());
    return Object.fromEntries(
      todas.map((n, k) => [n, n === "state" ? c[k] : c[k] === undefined || c[k] === "" ? NaN : Number(c[k])])
        .filter(([n]) => n)
        // PHREEQC escribe -999.999 (o -1000) cuando una fase no se puede calcular
        .map(([n, v]) => [n, n.startsWith("si_") && v <= -999 ? NaN : v])
    );
  });
  return { cols: cols.filter((c) => c !== "state"), filas };
}

/* ====================================================================
   PESTAÑA 1 — Especiación y saturación
   ==================================================================== */

let ultimo = { entrada: "", out: "", si: [], esp: [] };

async function calcularMuestra() {
  const est = $("#estado-muestra");
  est.className = "estado";
  mostrarAviso("");
  let m;
  try { m = leerMuestra(); } catch (e) { mostrarAviso(e.message); return; }
  const base = $("#base").value;
  const entrada = `TITLE Muestra ingresada en la página\n${bloqueSolucion(1, m)}\nEND\n`;
  $("#btn-calcular").disabled = true;
  est.textContent = "Calculando…";
  await pausa();
  try {
    const t0 = performance.now();
    const r = await ejecutar(base, entrada);
    if (r.errores.length) {
      est.className = "estado error";
      est.textContent = r.errores.join(" · ");
      $("#resultados-muestra").hidden = true;
      return;
    }
    ultimo = { entrada, out: r.out, si: parsearSI(r.out), esp: parsearEspecies(r.out), T: Number(parsearResumen(r.out).temp) + 273.15 };
    pintarResumen(parsearResumen(r.out));
    pintarSI();
    pintarEspecies();
    agregarAviso(textoAdvertencias(r));
    $("#resultados-muestra").hidden = false;
    $("#entrada-generada").textContent = entrada;
    $("#btn-ver-entrada").disabled = false;
    $("#btn-bajar-salida").disabled = false;
    est.textContent = `Listo en ${Math.round(performance.now() - t0)} ms con ${base}.`;
  } catch (e) {
    est.className = "estado error";
    est.textContent = "No se pudo calcular: " + (e.message || e);
  } finally {
    $("#btn-calcular").disabled = false;
  }
}

function pintarResumen(r) {
  const errNum = r.err === null ? null : Math.abs(Number(r.err));
  const datos = [
    ["pH", fmt(r.pH, 3)],
    ["pe", fmt(r.pe, 3)],
    ["Eh (V)", fmt(Eh(Number(r.pe), Number(r.temp) + 273.15), 3), false, !Number.isFinite(Eh(Number(r.pe), Number(r.temp) + 273.15))],
    ["Temperatura (°C)", fmt(r.temp, 3)],
    ["Fuerza iónica (mol/kgw)", fmt(r.mu, 3)],
    ["Actividad del agua", fmt(r.aw, 4)],
    ["Alcalinidad total (eq/kg)", fmt(r.alk, 3), false, r.alk === null],
    ["Carbono total (mol/kg)", fmt(r.ctot, 3), false, r.ctot === null],
    ["Conductividad (µS/cm)", r.cond === null ? "—" : Math.round(Number(r.cond)).toLocaleString("es-CL"), false, r.cond === null],
    ["Densidad calculada (g/cm³)", fmt(r.dens, 4), false, r.dens === null],
    ["Error del balance de carga (%)", r.err === null ? "—" : fmt(r.err, 2), errNum !== null && errNum > 5],
  ];
  $("#tarjetas").innerHTML = datos
    .filter((d) => !d[3])
    .map(([et, v, mal]) => `<div class="dato${mal ? " mal" : ""}"><div class="et">${et}</div><div class="val">${esc(v)}</div></div>`)
    .join("");
  if (errNum !== null && errNum > 5) {
    mostrarAviso(`El error del balance de carga es ${fmt(r.err, 2)} %. Un valor tan alto sugiere que falta algún ion o que hay un dato mal ingresado; revisa la composición.`);
  }
}

function pintarSI() {
  const solo = $("#solo-interes").checked;
  const q = $("#buscar-si").value.trim().toLowerCase();
  const habit = new Set(MINERALES_HABITUALES.map((x) => x.toLowerCase()));
  let filas = ultimo.si.filter((f) => (!solo || habit.has(f.fase.toLowerCase())) && (!q || f.fase.toLowerCase().includes(q)));
  filas = [...filas].sort((a, b) => b.si - a.si);
  const estado = (si) => (si > 0.05 ? ["sobre", "Sobresaturado"] : si < -0.05 ? ["sub", "Subsaturado"] : ["eq", "En equilibrio"]);
  $("#tabla-si").innerHTML =
    `<thead><tr><th>Fase</th><th>SI</th><th>Ω = 10^SI</th><th>ΔG disolución (kJ/mol)</th><th>ΔG° (kJ/mol)</th><th>log IAP</th><th>log K (298 K)</th><th>Estado</th><th>Fórmula</th></tr></thead><tbody>` +
    (filas.length
      ? filas.map((f) => { const [c, t] = estado(f.si); const T = ultimo.T; const dg = dG(f.si, T); const dg0 = -LN10 * R_KJ * T * (f.iap - f.si); return `<tr><td>${esc(f.fase)}</td><td>${f.si.toFixed(2)}</td><td>${fmt(Math.pow(10, f.si), 3)}</td><td>${dg.toFixed(2)}</td><td>${dg0.toFixed(2)}</td><td>${f.iap.toFixed(2)}</td><td>${f.k.toFixed(2)}</td><td><span class="badge ${c}">${t}</span></td><td>${esc(f.formula)}</td></tr>`; }).join("")
      : `<tr><td colspan="9">No hay fases para mostrar con ese filtro.</td></tr>`) +
    `</tbody>`;
}

function pintarEspecies() {
  const todas = $("#todas-esp").checked;
  let filas = ultimo.esp;
  if (!todas) {
    const visto = new Set();
    filas = filas
      .filter((f) => f.tipo === "esp" && !visto.has(f.nombre) && visto.add(f.nombre))
      .sort((a, b) => b.mol - a.mol)
      .slice(0, 25);
  }
  const cab = `<thead><tr><th>Especie</th><th>Molalidad</th><th>Actividad</th><th>log molalidad</th><th>log actividad</th><th>log γ</th></tr></thead>`;
  const cuerpo = filas.map((f) => f.tipo === "elem"
    ? `<tr class="elem"><td>${esc(f.nombre)}</td><td>${fmt(f.total)}</td><td colspan="4">total del elemento</td></tr>`
    : `<tr><td class="${todas ? "esp" : ""}">${esc(f.nombre)}</td><td>${fmt(f.mol)}</td><td>${fmt(f.act)}</td><td>${f.logm.toFixed(3)}</td><td>${f.loga.toFixed(3)}</td><td>${f.logg.toFixed(3)}</td></tr>`).join("");
  $("#tabla-esp").innerHTML = cab + `<tbody>${cuerpo}</tbody>`;
}

/* ====================================================================
   PESTAÑA 2 — Barrido de pH y temperatura
   ==================================================================== */

let barrido = { cols: [], filas: [], entrada: "" };

async function prepararMineralesBarrido() {
  const base = $("#base").value;
  const texto = await cargarBase(base);
  const fases = fasesDeBase(texto);
  const cont = $("#b-minerales");
  const previos = new Set($$("input:checked", cont).map((i) => i.value));
  cont.innerHTML = "";
  const disp = MINERALES_HABITUALES.filter((x) => fases.has(x));
  disp.forEach((x) => {
    const marcado = previos.size ? previos.has(x) : MINERALES_BARRIDO_DEFECTO.includes(x);
    const l = document.createElement("label");
    l.className = "chk";
    l.innerHTML = `<input type="checkbox" value="${esc(x)}"${marcado ? " checked" : ""}> ${esc(x)}`;
    cont.appendChild(l);
  });
  if (!disp.length) cont.textContent = "Esta base no incluye los minerales habituales.";
}

function rango(min, max, paso, nombre) {
  if (paso <= 0) throw new Error(`El paso de ${nombre} debe ser mayor que 0.`);
  if (max < min) throw new Error(`El máximo de ${nombre} debe ser mayor o igual que el mínimo.`);
  const v = [];
  for (let x = min; x <= max + paso * 1e-9; x += paso) v.push(Math.round(x * 1e6) / 1e6);
  return v;
}

async function calcularBarrido() {
  const est = $("#estado-barrido");
  est.className = "estado";
  mostrarAviso("");
  let m, phs, ts;
  try {
    m = leerMuestra();
    phs = rango(numero("#b-phmin", "pH mínimo", 0, 14), numero("#b-phmax", "pH máximo", 0, 14), numero("#b-phstep", "Paso de pH", 0.001), "pH");
    ts = rango(numero("#b-tmin", "T mínima", 0, 300), numero("#b-tmax", "T máxima", 0, 300), numero("#b-tstep", "Paso de T", 0.001), "temperatura");
  } catch (e) { mostrarAviso(e.message); return; }
  if (phs.length * ts.length > 600) { mostrarAviso(`El barrido tiene ${phs.length * ts.length} puntos; el máximo es 600. Aumenta los pasos o reduce los rangos.`); return; }

  const base = $("#base").value;
  const texto = await cargarBase(base);
  const minerales = $$("#b-minerales input:checked").map((i) => i.value);
  const conocidas = especiesDeBase(texto);
  const pedidas = $("#b-especies").value.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
  const especies = pedidas.filter((s) => conocidas.has(s));
  const desconocidas = pedidas.filter((s) => !conocidas.has(s));
  if (desconocidas.length) mostrarAviso(`Estas especies no existen en ${base} y se omitieron: ${desconocidas.join(", ")}.`);
  if (!minerales.length && !especies.length) { mostrarAviso("Elige al menos un mineral o una especie para calcular."); return; }

  // Cada punto conserva la composición total de la muestra (incluido el carbono inorgánico
  // total) y fija el pH. El balance de carga lo hace Cl- (puntos más ácidos que la muestra) o
  // Na+ (más alcalinos), lo que equivale a agregar HCl o NaOH sin iteraciones adicionales.
  // Para no mezclar unidades, la muestra base se calcula primero y sus totales se leen en mol/kgw.
  const elementos = [...new Set([...m.elems.map((e) => e.el).filter((e) => e !== "Alkalinity"), "C", "Cl", "Na"])];
  const entradaBase = `TITLE Solución base\nPRINT\n  -reset false\nSELECTED_OUTPUT\n  -file /sel.out\n  -reset false\n  -pH true\n  -totals ${elementos.join(" ")}\n${bloqueSolucion(1, m)}\nEND\n`;
  const cab = ["SELECTED_OUTPUT", "  -file /sel.out", "  -reset false", "  -temperature true", "  -pH true", "  -pe true", "  -ionic_strength true", "  -totals Cl Na"];
  if (minerales.length) cab.push("  -saturation_indices " + minerales.join(" "));
  if (especies.length) cab.push("  -molalities " + especies.join(" "));

  $("#btn-barrer").disabled = true;
  est.textContent = `Calculando ${phs.length * ts.length} puntos…`;
  await pausa();
  try {
    const t0 = performance.now();
    const motor = await abrirMotor(base);
    const rb = correr(motor, entradaBase);
    if (rb.errores.length) { est.className = "estado error"; est.textContent = "La muestra base no se pudo calcular: " + rb.errores.join(" · "); $("#resultados-barrido").hidden = true; return; }
    const b0 = parsearTSV(rb.sel).filas[0] || {};
    const pH0 = b0.pH;
    if (!Number.isFinite(pH0)) { est.className = "estado error"; est.textContent = "No se pudo determinar el pH de la muestra base."; return; }
    const tot = (el) => (Number.isFinite(b0[el]) ? b0[el] : 0);
    const dic = tot("C"), cl0 = tot("Cl"), na0 = tot("Na");

    const bloque = (n, T, pH) => {
      const ion = pH < pH0 ? "Cl" : "Na";
      const L = [`SOLUTION ${n}`, "  units mol/kgw", `  temp ${T}`, `  pH ${pH}`, `  pe ${m.pe}`, `  density ${m.dens}`];
      elementos.forEach((el) => {
        const v = tot(el);
        const lleva = el === ion;
        if (el === "C") { if (v > 1e-12) L.push(`  C(4) ${v}`); return; }
        if (v > 1e-15 || lleva) L.push(`  ${el} ${v > 1e-15 ? v : 1e-12}${lleva ? " charge" : ""}`);
      });
      return L.join("\n") + "\nEND";
    };
    const lista = [];
    ts.forEach((T) => phs.forEach((pH) => lista.push({ T, pH })));
    const encabezado = `PRINT\n  -reset false\n${cab.join("\n")}\n`;

    // 1) Intento rápido: todos los puntos en una sola ejecución.
    const entrada = `TITLE Barrido de pH y temperatura (composición total constante)\n${encabezado}${lista.map((p, i) => bloque(i + 1, p.T, p.pH)).join("\n")}\n`;
    const rr = correr(motor, entrada);
    let filas = [], colsTSV = [], fallidos = [], advert = rr.advertencias;
    if (!rr.errores.length) {
      const t = parsearTSV(rr.sel);
      if (t.filas.length === lista.length) { filas = t.filas; colsTSV = t.cols; }
    }
    // 2) Si algún punto no converge, se repite punto a punto para no perder los demás.
    if (!filas.length) {
      est.textContent = "Algún punto no convergió; calculando punto a punto…";
      await pausa();
      let mot = await abrirMotor(base);
      advert = [];
      for (let i = 0; i < lista.length; i++) {
        const p = lista[i];
        const r1 = correr(mot, `TITLE Punto\n${encabezado}${bloque(1, p.T, p.pH)}\n`);
        if (r1.fallo) mot = await abrirMotor(base);
        const t1 = r1.errores.length ? { filas: [], cols: [] } : parsearTSV(r1.sel);
        if (t1.filas.length) { filas.push(t1.filas[0]); colsTSV = t1.cols; } else fallidos.push(p);
        advert = advert.concat(r1.advertencias);
        if (i % 25 === 24) { est.textContent = `Calculando punto ${i + 1} de ${lista.length}…`; await pausa(); }
      }
    }
    if (!filas.length) {
      est.className = "estado error";
      est.textContent = "Ningún punto del barrido convergió. " + (rr.errores[0] || "").replace(/\s+/g, " ").slice(0, 200);
      $("#resultados-barrido").hidden = true;
      return;
    }
    // Ácido (−) o base (+) agregado = variación del Cl (o del Na) respecto de la muestra base.
    const colsSI = colsTSV.filter((c) => c.startsWith("si_"));
    filas = filas.map((f) => {
      const T = f.temp + 273.15;
      const g = { ...f, titrante: (f.pH < pH0 ? -(f.Cl - cl0) : f.Na - na0) * 1000, eh: Eh(f.pe, T) };
      colsSI.forEach((c) => { g["dg_" + c.slice(3)] = dG(f[c], T); });
      return g;
    });
    const cols = [...colsTSV.filter((c) => c !== "Cl" && c !== "Na"), "titrante", ...colsSI.map((c) => "dg_" + c.slice(3)), "eh"];
    barrido = { cols, filas, entrada, pH0, dic };
    pintarBarrido();
    agregarAviso(textoAdvertencias({ advertencias: [...new Set(advert)] }));
    if (fallidos.length) {
      agregarAviso(`No convergió ${fallidos.length} de ${lista.length} puntos (T °C / pH): ${fallidos.slice(0, 8).map((p) => `${p.T}/${p.pH}`).join(", ")}${fallidos.length > 8 ? "…" : ""}. Esos puntos se omitieron.`);
    }
    $("#resultados-barrido").hidden = false;
    $("#btn-csv").disabled = false;
    est.textContent = `Listo: ${filas.length} puntos en ${Math.round(performance.now() - t0)} ms con ${base}. Muestra base: pH ${fmt(pH0, 3)}` + (dic > 0 ? `, carbono total ${fmt(dic, 3)} mol/kgw.` : ".");
  } catch (e) {
    est.className = "estado error";
    est.textContent = "No se pudo calcular: " + (e.message || e);
  } finally {
    $("#btn-barrer").disabled = false;
  }
}

const etiquetaVar = (c) => (c === "mu" ? "Fuerza iónica (mol/kgw)" : c === "titrante" ? "Ácido (−) o base (+) agregado (mmol/kgw)" : c === "eh" ? "Eh (V)" : c === "pe" ? "pe" : c.startsWith("dg_") ? "ΔG de disolución de " + c.slice(3) + " (kJ/mol)" : c.startsWith("si_") ? "SI " + c.slice(3) : c.startsWith("m_") ? "Molalidad de " + c.slice(2) + " (mol/kgw)" : c);

function variablesBarrido() {
  return barrido.cols.filter((c) => c !== "pH" && c !== "temp" && barrido.filas.some((f) => Number.isFinite(f[c])));
}

function pintarBarrido() {
  const vars = variablesBarrido();
  const omitidas = barrido.cols.filter((c) => c !== "pH" && c !== "temp" && !vars.includes(c)).map((c) => c.replace(/^(si_|m_|dg_)/, ""));
  if (omitidas.length) mostrarAviso(`No se pudieron calcular: ${omitidas.join(", ")}. La muestra no contiene los elementos necesarios para esas fases o especies.`);
  const sel = $("#b-variable");
  const actual = sel.value;
  sel.innerHTML = "";
  vars.forEach((c) => sel.add(new Option(etiquetaVar(c), c)));
  sel.value = actual && vars.includes(actual) ? actual : vars.find((c) => c.startsWith("si_")) || vars[0];
  dibujar();

  const colsTabla = ["temp", "pH", ...vars];
  $("#tabla-barrido").innerHTML =
    `<thead><tr>${colsTabla.map((c) => `<th>${esc(c === "temp" ? "T (°C)" : etiquetaVar(c))}</th>`).join("")}</tr></thead><tbody>` +
    barrido.filas.map((f) => `<tr>${colsTabla.map((c) => `<td>${c === "pH" || c === "temp" ? fmt(f[c], 3) : fmt(f[c], 4)}</td>`).join("")}</tr>`).join("") +
    `</tbody>`;
}

function dibujar() {
  const v = $("#b-variable").value;
  const porT = new Map();
  barrido.filas.forEach((f) => { if (!porT.has(f.temp)) porT.set(f.temp, []); porT.get(f.temp).push([f.pH, f[v]]); });
  const series = [...porT.entries()].map(([T, pts], k) => ({ nombre: `${fmt(T, 3)} °C`, pts: pts.filter((p) => Number.isFinite(p[1])), color: `var(--c${(k % 8) + 1})` }));
  graficar($("#grafico"), series, "pH", etiquetaVar(v), v.startsWith("si_"));
  $("#leyenda").innerHTML = series.map((s) => `<span class="it"><span class="sw" style="border-color:${s.color}"></span>${esc(s.nombre)}</span>`).join("");
}

function ticks(min, max, n = 6) {
  if (min === max) { min -= 1; max += 1; }
  const bruto = (max - min) / n;
  const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
  const paso = [1, 2, 5, 10].map((x) => x * mag).find((x) => x >= bruto) || mag * 10;
  const ini = Math.floor(min / paso) * paso;
  const t = [];
  for (let x = ini; x <= max + paso * 0.5; x += paso) t.push(Math.round(x / paso * 1e6) / 1e6 * paso);
  return t;
}

function graficar(svg, series, xl, yl, cero) {
  const NS = "http://www.w3.org/2000/svg";
  const W = 760, H = 440, ml = 70, mr = 20, mt = 20, mb = 55;
  const todos = series.flatMap((s) => s.pts);
  svg.innerHTML = "";
  if (!todos.length) return;
  let xmin = Math.min(...todos.map((p) => p[0])), xmax = Math.max(...todos.map((p) => p[0]));
  let ymin = Math.min(...todos.map((p) => p[1])), ymax = Math.max(...todos.map((p) => p[1]));
  if (cero) { ymin = Math.min(ymin, 0); ymax = Math.max(ymax, 0); }
  const pad = (ymax - ymin) * 0.05 || 0.5;
  ymin -= pad; ymax += pad;
  if (xmin === xmax) { xmin -= 0.5; xmax += 0.5; }
  const X = (x) => ml + ((x - xmin) / (xmax - xmin)) * (W - ml - mr);
  const Y = (y) => H - mb - ((y - ymin) / (ymax - ymin)) * (H - mt - mb);
  const el = (n, a, t) => { const e = document.createElementNS(NS, n); Object.entries(a || {}).forEach(([k, v]) => e.setAttribute(k, v)); if (t !== undefined) e.textContent = t; svg.appendChild(e); return e; };

  ticks(ymin, ymax, 6).filter((t) => t >= ymin && t <= ymax).forEach((t) => {
    el("line", { x1: ml, x2: W - mr, y1: Y(t), y2: Y(t), class: "rejilla-g" });
    el("text", { x: ml - 8, y: Y(t) + 4, "text-anchor": "end" }, fmt(t, 3));
  });
  ticks(xmin, xmax, 8).filter((t) => t >= xmin - 1e-9 && t <= xmax + 1e-9).forEach((t) => {
    el("line", { x1: X(t), x2: X(t), y1: mt, y2: H - mb, class: "rejilla-g" });
    el("text", { x: X(t), y: H - mb + 18, "text-anchor": "middle" }, fmt(t, 3));
  });
  el("line", { x1: ml, x2: ml, y1: mt, y2: H - mb, class: "eje" });
  el("line", { x1: ml, x2: W - mr, y1: H - mb, y2: H - mb, class: "eje" });
  if (cero && ymin < 0 && ymax > 0) el("line", { x1: ml, x2: W - mr, y1: Y(0), y2: Y(0), class: "cero" });
  el("text", { x: (ml + W - mr) / 2, y: H - 12, "text-anchor": "middle" }, xl);
  const ty = el("text", { x: 16, y: (mt + H - mb) / 2, "text-anchor": "middle", transform: `rotate(-90 16 ${(mt + H - mb) / 2})` }, yl);
  ty.setAttribute("font-size", "12");

  series.forEach((s) => {
    const pts = [...s.pts].sort((a, b) => a[0] - b[0]);
    el("polyline", { points: pts.map((p) => `${X(p[0])},${Y(p[1])}`).join(" "), fill: "none", stroke: s.color, "stroke-width": 2.2, "stroke-linejoin": "round" });
    pts.forEach((p) => { const c = el("circle", { cx: X(p[0]), cy: Y(p[1]), r: 3, fill: s.color }); const t = document.createElementNS(NS, "title"); t.textContent = `${s.nombre} · pH ${fmt(p[0], 3)} · ${fmt(p[1], 4)}`; c.appendChild(t); });
  });
}

function bajarCSV() {
  const vars = variablesBarrido();
  const cols = ["temp", "pH", ...vars];
  const csv = [cols.join(","), ...barrido.filas.map((f) => cols.map((c) => (Number.isFinite(f[c]) ? f[c] : "")).join(","))].join("\n");
  descargar("barrido_phreeqc.csv", csv, "text/csv");
}

/* ====================================================================
   PESTAÑA 3 — Archivo avanzado
   ==================================================================== */

let ultimaAvanzada = "";

async function ejecutarAvanzado() {
  const est = $("#a-estado");
  est.className = "estado";
  const entrada = $("#a-entrada").value;
  if (!entrada.trim()) { est.className = "estado error"; est.textContent = "Escribe o carga un archivo de entrada."; return; }
  $("#a-ejecutar").disabled = true;
  est.textContent = "Calculando…";
  await pausa();
  try {
    const t0 = performance.now();
    const r = await ejecutar($("#a-base").value, entrada);
    ultimaAvanzada = r.out;
    const pre = $("#a-salida");
    pre.hidden = false;
    pre.textContent = r.out || r.consola;
    $("#a-bajar").disabled = !r.out;
    if (r.errores.length) { est.className = "estado error"; est.textContent = r.errores.join(" · "); }
    else est.textContent = `Listo en ${Math.round(performance.now() - t0)} ms. ${textoAdvertencias(r)}`.trim();
  } catch (e) {
    est.className = "estado error";
    est.textContent = "No se pudo calcular: " + (e.message || e);
  } finally {
    $("#a-ejecutar").disabled = false;
  }
}

/* ---------- Pestañas y arranque ---------- */

function activarPestana(id) {
  const mapa = { "t-muestra": "p-muestra", "t-barrido": "p-barrido", "t-avanzado": "p-avanzado", "t-acerca": "p-acerca" };
  Object.entries(mapa).forEach(([t, p]) => {
    $("#" + t).setAttribute("aria-selected", String(t === id));
    $("#" + p).hidden = t !== id;
  });
  $("#form-muestra").hidden = id === "t-avanzado" || id === "t-acerca";
  mostrarAviso("");
}

async function iniciar() {
  await cargarConfig();
  construirFormulario();
  aplicarPreset("mar");
  $("#preset").value = "mar";

  $$(".pestanas button").forEach((b) => b.addEventListener("click", () => activarPestana(b.id)));
  $("#btn-calcular").addEventListener("click", calcularMuestra);
  $("#btn-ver-entrada").addEventListener("click", () => { const p = $("#entrada-generada"); p.hidden = !p.hidden; });
  $("#btn-bajar-salida").addEventListener("click", () => descargar("salida_phreeqc.out", ultimo.out));
  $("#solo-interes").addEventListener("change", pintarSI);
  $("#buscar-si").addEventListener("input", pintarSI);
  $("#todas-esp").addEventListener("change", pintarEspecies);

  $("#base").addEventListener("change", prepararMineralesBarrido);
  $("#btn-barrer").addEventListener("click", calcularBarrido);
  $("#btn-csv").addEventListener("click", bajarCSV);
  $("#b-variable").addEventListener("change", dibujar);

  EJEMPLOS.forEach(([k, n]) => $("#a-ejemplo").add(new Option(n, k)));
  $("#a-ejemplo").addEventListener("change", async (e) => {
    if (!e.target.value) return;
    const r = await fetch("examples/" + e.target.value);
    $("#a-entrada").value = r.ok ? await r.text() : "";
    const ej = EJEMPLOS.find((x) => x[0] === e.target.value);
    const baseEj = ej && ej[2] ? ej[2] : "phreeqc.dat";
    if ([...$("#a-base").options].some((o) => o.value === baseEj)) $("#a-base").value = baseEj;
  });
  $("#a-archivo").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (f) $("#a-entrada").value = await f.text();
  });
  $("#a-ejecutar").addEventListener("click", ejecutarAvanzado);
  $("#a-bajar").addEventListener("click", () => descargar("salida_phreeqc.out", ultimaAvanzada));

  $("#base-propia").addEventListener("change", cargarBasePropia);

  prepararMineralesBarrido().catch(() => {});
}

// Permite usar una base de datos .dat propia, leída solo en este navegador (no se sube a ningún lado).
async function cargarBasePropia(e) {
  const f = e.target.files[0];
  if (!f) return;
  const texto = await f.text();
  if (!/SOLUTION_MASTER_SPECIES|SOLUTION_SPECIES/.test(texto)) {
    mostrarAviso("Ese archivo no parece una base de datos de PHREEQC (no contiene SOLUTION_MASTER_SPECIES ni SOLUTION_SPECIES).");
    e.target.value = "";
    return;
  }
  const clave = "local:" + f.name;
  cacheBases[clave] = texto;
  const nombre = "Mi base: " + f.name;
  ["#base", "#a-base"].forEach((sel) => {
    const s = $(sel);
    if (![...s.options].some((o) => o.value === clave)) s.add(new Option(nombre, clave));
    s.value = clave;
  });
  mostrarAviso("");
  prepararMineralesBarrido().catch(() => {});
}

document.addEventListener("DOMContentLoaded", iniciar);
