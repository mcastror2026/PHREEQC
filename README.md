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
