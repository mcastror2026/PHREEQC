# Cómo se compiló el motor (phreeqc.js + phreeqc.wasm)

Registro de los pasos reales, para poder reproducirlos o actualizar PHREEQC.
Entorno: contenedor Debian 12 (Proxmox) con 2 núcleos y 2 GB de RAM.

## 1. Código fuente oficial
USGS, PHREEQC versión 3.8.6 (build 17100), publicado el 7 de enero de 2025:
https://water.usgs.gov/water-resources/software/PHREEQC/phreeqc-3.8.6-17100.tar.gz

```
wget https://water.usgs.gov/water-resources/software/PHREEQC/phreeqc-3.8.6-17100.tar.gz
tar xzf phreeqc-3.8.6-17100.tar.gz
```

## 2. Versión nativa (referencia para validar)
```
apt install -y build-essential
cd phreeqc-3.8.6-17100 && mkdir build && cd build
../configure && make -j2
./src/phreeqc ../examples/ex1 /tmp/ex1.out ../database/phreeqc.dat
```

## 3. Versión WebAssembly para el navegador
Con Emscripten (emsdk "latest" instalado desde https://github.com/emscripten-core/emsdk):
```
source /root/emsdk/emsdk_env.sh
cd phreeqc-3.8.6-17100 && mkdir build-web && cd build-web
emconfigure ../configure CFLAGS='-O2' CXXFLAGS='-O2'
emmake make -j2 LDFLAGS='-O2 -sMODULARIZE=1 -sEXPORT_NAME=createPhreeqc \
  -sENVIRONMENT=web,worker -sALLOW_MEMORY_GROWTH=1 -sINVOKE_RUN=0 \
  -sEXPORTED_RUNTIME_METHODS=FS,callMain -sFORCE_FILESYSTEM=1'
```
Resultado: `src/phreeqc` (JavaScript, se publica como `phreeqc.js`) y `src/phreeqc.wasm`.
Se copian a `sitio/` junto con las carpetas `database/` y `examples/` del paquete original.

## 4. Validación
Ver README.md (comparación de los ejemplos 1 a 7 contra la versión nativa).

## Licencia y créditos
PHREEQC es software del Servicio Geológico de Estados Unidos (USGS). Revisar su
"User Rights Notice" (enlazada desde https://www.usgs.gov/software/phreeqc-version-3)
antes de redistribuir el programa o las bases de datos.
Parkhurst, D.L., y Appelo, C.A.J., 2013, Description of input and examples for PHREEQC
version 3: U.S. Geological Survey Techniques and Methods, book 6, chap. A43, 497 p.
