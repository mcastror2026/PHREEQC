# PHREEQC en el navegador

Página web estática que ejecuta **PHREEQC 3.8.6** (USGS) compilado a WebAssembly.
Todo el cálculo ocurre en el navegador de quien la usa; no hay servidor.

## Contenido
- `sitio/` — lo que se publica (carpeta completa):
  - `index.html`, `estilos.css`, `app.js` — la página.
  - `phreeqc.js`, `phreeqc.wasm` — el motor (1,5 MB).
  - `database/` — bases de datos termodinámicas oficiales (`phreeqc.dat`, `wateq4f.dat`,
    `minteq.v4.dat`, `minteq.dat`, `pitzer.dat`, `sit.dat`, `llnl.dat`, `Amm.dat`).
  - `examples/` — ejemplos oficiales 1 a 7 para el modo avanzado.
  - `_headers` — cabeceras de seguridad y caché para Netlify.
- `stage/` — copia de trabajo del compilado completo (todas las bases y ejemplos). No se publica.

## Cómo funciona
1. El navegador descarga `database/<base>.dat` (mismo origen, una vez por sesión).
2. Se abre una instancia de PHREEQC (`createPhreeqc()`), se escribe la base y la entrada en su
   sistema de archivos en memoria y se llama a `main`.
3. La página lee la salida (`/out.pqo`) y el `SELECTED_OUTPUT` (`/sel.out`) y los presenta.

## Modos
- **Muestra de agua:** genera un bloque `SOLUTION` desde el formulario; lee especiación,
  índices de saturación y balance de carga de la salida.
- **Barrido de pH y temperatura:** calcula primero la muestra base, toma el total de cada elemento
  (en mol/kgw) y, para cada punto, fija pH y temperatura conservando esos totales; el balance de
  carga lo hace Cl⁻ (puntos más ácidos) o Na⁺ (más alcalinos), equivalente a agregar HCl o NaOH.
  Si el cálculo conjunto falla, repite punto a punto y omite los que no convergen.
- **Archivo avanzado:** entrada de PHREEQC completa (se ejecuta en el navegador del usuario).

### Parámetros derivados (se calculan en la página a partir de la salida de PHREEQC)
- Ω = 10^SI.
- ΔG de disolución (kJ/mol) = 2,3026·R·T·SI = RT·ln(IAP/K), para la reacción tal como está en la base.
- ΔG° (kJ/mol) = −2,3026·R·T·log K(T), con log K(T) = log IAP − SI (el log K impreso por PHREEQC es el de 298 K).
- Eh (V) = pe · 2,3026·R·T / F.
- En el barrido se agregan `dg_<mineral>` (ΔG) y `eh` como variables del gráfico y la tabla.
- Verificado a mano con el agua de mar (calcita: SI 0,79 → ΔG 4,51 kJ/mol, ΔG° 48,40 kJ/mol).

## Agregar bases de datos, ejemplos o actualizar (sin tocar el código)
La lista de bases, los ejemplos y los minerales habituales están en `sitio/config.json`.

**Agregar una base de datos**
1. Copiar el archivo `.dat` a `sitio/database/`.
2. Agregar una entrada en `bases` de `config.json`, por ejemplo:
   `{ "archivo": "mi_base.dat", "nombre": "mi_base.dat — descripción", "guiada": false }`
   (`guiada: true` la ofrece también en el formulario; sirve si usa los mismos nombres de
   elementos que `phreeqc.dat`).
3. Subir los cambios (`git add`, `git commit`, `git push`); Netlify publica solo.

**Agregar un ejemplo para el modo avanzado**
1. Copiar el archivo de entrada a `sitio/examples/` (sin extensión o con la que quieras).
2. Agregar una entrada en `ejemplos`:
   `{ "archivo": "mi_ejemplo", "nombre": "Título visible", "base": "phreeqc.dat" }`.

**Sin tocar el repositorio:** cada persona puede usar su propia base `.dat` con el selector
"Usar una base propia" de la página; se lee solo en su navegador.

**Actualizar PHREEQC:** recompilar según `COMPILACION.md` y reemplazar `sitio/phreeqc.js` y
`sitio/phreeqc.wasm`; el resto no cambia. Después hay que repetir la validación (ejemplos 1 a 7).

Si `config.json` falta o tiene errores, la página usa una lista incorporada en `app.js`.

## Probar en local
```
cd sitio
python -m http.server 8766 --bind 127.0.0.1
```
y abrir http://127.0.0.1:8766/ (no funciona abriendo `index.html` como archivo: hace falta un servidor).

## Publicar en Netlify
1. Entrar a https://app.netlify.com/drop con tu cuenta.
2. Arrastrar la carpeta `sitio` completa.
3. Netlify entrega una dirección pública. Se puede cambiar el nombre en *Site configuration*.
(No requiere build ni funciones.)

## Validación hecha (2026-10-22)
Se comparó la salida de los ejemplos oficiales 1 a 7 (con `phreeqc.dat`) entre PHREEQC nativo
(compilado en el CT 114, versión 3.8.6) y la versión WebAssembly que se publica, ejecutada en el
navegador, línea por línea y con tolerancia numérica estricta (se ignoran solo rutas y tiempos):
- Ejemplos 1, 4, 5, 6 y 7: todas las líneas idénticas (salvo 2 líneas de guiones del borde de
  "End of Run", cuyo largo depende del texto del tiempo).
- Ejemplos 2 y 3: solo difieren especies de concentración inferior a 1,2e-14 mol/kgw (H2, O2, H2S,
  CH4, etc.), con diferencias relativas de hasta 0,4 %: ruido numérico de las librerías
  matemáticas. Ninguna diferencia significativa (molalidad > 1e-9 y diferencia relativa > 1e-5: 0).
- Formulario guiado con la composición del agua de mar: SI de calcita 0,79, aragonita 0,64,
  dolomita 2,46, yeso −0,80, halita −2,49, pH 8,220 y fuerza iónica 6,704e-01, iguales al ejemplo 1.
- Pendiente recomendado: contrastar algún caso propio de los investigadores con PHREEQC Interactive.
- El barrido de pH y temperatura es lógica propia de la página (no un ejemplo oficial): verificar
  con casos conocidos del grupo.

## Notas
- Las bases de datos tienen rangos de validez (temperatura, fuerza iónica); revisar la documentación.
- Los resultados son un modelo: contrastarlos con mediciones.
- Cómo citar: Parkhurst, D.L., y Appelo, C.A.J., 2013, Description of input and examples for
  PHREEQC version 3: U.S. Geological Survey Techniques and Methods, book 6, chap. A43, 497 p.
- Revisar la "User Rights Notice" de USGS antes de distribuir públicamente el programa.
