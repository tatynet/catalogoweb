"""
ACTUALIZADOR DE VERSION - CATALOGO TATYNET
==========================================
Ejecuta este script ANTES de subir cambios a GitHub.
Actualiza automaticamente el numero de version en index.html
para que los navegadores descarguen los archivos nuevos
en lugar de usar la version guardada en cache.

USO:
    python actualizar_version.py

RESULTADO:
    style.css?v=20260807_v3  ->  style.css?v=20260808_v1
    app.js?v=20260807_v3     ->  app.js?v=20260808_v1
    (la fecha cambia al dia de hoy automaticamente)
"""

import re
from pathlib import Path
from datetime import datetime

ARCHIVO_HTML = Path(__file__).parent / "index.html"

# Archivos a los que se les actualiza la version en el HTML
ARCHIVOS_VERSIONADOS = ["style.css", "app.js", "productos.json"]


def obtener_version_actual(contenido):
    """Lee la version actual desde el HTML."""
    patron = r'\?v=(\d{8})_v(\d+)'
    match = re.search(patron, contenido)
    if match:
        return match.group(1), int(match.group(2))
    return None, 0


def calcular_nueva_version(fecha_actual, fecha_html, numero_version):
    """
    Si el dia cambio -> nueva version empieza en v1
    Si es el mismo dia -> incrementa el numero (v1, v2, v3...)
    """
    if fecha_html == fecha_actual:
        return fecha_actual, numero_version + 1
    else:
        return fecha_actual, 1


def actualizar_version():
    if not ARCHIVO_HTML.exists():
        print(f"Error: No se encontro {ARCHIVO_HTML}")
        return

    contenido = ARCHIVO_HTML.read_text(encoding="utf-8")
    hoy = datetime.now().strftime("%Y%m%d")

    # Leer version actual
    fecha_html, numero = obtener_version_actual(contenido)
    if fecha_html:
        print(f"\nVersion actual en index.html: v={fecha_html}_v{numero}")
    else:
        print("\nNo se encontro version previa. Se creara nueva.")
        fecha_html = ""
        numero = 0

    # Calcular nueva version
    nueva_fecha, nuevo_numero = calcular_nueva_version(hoy, fecha_html, numero)
    nueva_version = f"{nueva_fecha}_v{nuevo_numero}"
    version_antigua = f"{fecha_html}_v{numero}" if fecha_html else None

    print(f"Nueva version:    v={nueva_version}")

    # Reemplazar en el HTML todos los archivos versionados
    nuevo_contenido = contenido
    cambios = 0

    for archivo in ARCHIVOS_VERSIONADOS:
        # Patron: archivo.ext?v=XXXXXXXX_vN
        patron_existente = rf'({re.escape(archivo)})\?v=[\w]+'
        nuevo_ref = rf'\1?v={nueva_version}'

        nuevo_contenido_tmp, n = re.subn(patron_existente, nuevo_ref, nuevo_contenido)
        if n > 0:
            print(f"   {archivo}?v={version_antigua or '???'} -> {archivo}?v={nueva_version}")
            nuevo_contenido = nuevo_contenido_tmp
            cambios += n
        else:
            # El archivo no tiene version todavia, agregarsela
            patron_sin_version = rf'({re.escape(archivo)})(?!\?v=)(["\s])'
            nuevo_ref_sin = rf'\1?v={nueva_version}\2'
            nuevo_contenido_tmp, n = re.subn(patron_sin_version, nuevo_ref_sin, nuevo_contenido)
            if n > 0:
                print(f"   {archivo}  ->  {archivo}?v={nueva_version}  (version nueva agregada)")
                nuevo_contenido = nuevo_contenido_tmp
                cambios += n

    if cambios > 0:
        ARCHIVO_HTML.write_text(nuevo_contenido, encoding="utf-8")
        print(f"\nListo! {cambios} referencia(s) actualizadas en index.html")
        print("Ahora puedes subir a GitHub. Los navegadores descargaran")
        print("los archivos frescos sin usar el cache.\n")
    else:
        print("\nNo se encontraron archivos para versionar en el HTML.")
        print("Verifica que style.css o app.js esten referenciados.\n")


if __name__ == "__main__":
    actualizar_version()
