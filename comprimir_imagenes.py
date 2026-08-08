"""
COMPRESOR DE IMAGENES - CATALOGO TATYNET
Comprime automaticamente sin danar la calidad visual

MODOS DE USO:
  1. Comprimir todas las imagenes existentes:
        python comprimir_imagenes.py

  2. Vigilar la carpeta y comprimir automaticamente
     cada imagen nueva que se agregue:
        python comprimir_imagenes.py --watch
"""

import os
import sys
import time
import shutil
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:
    print("Instalando Pillow (necesario una sola vez)...")
    os.system(f"{sys.executable} -m pip install Pillow --quiet")
    from PIL import Image, ImageOps

# CONFIGURACION
CARPETA_IMG    = Path(__file__).parent / "img"
CALIDAD_JPEG   = 82
CALIDAD_PNG    = 9
ANCHO_MAXIMO   = 1200
ALTO_MAXIMO    = 1200
EXTENSIONES    = {".jpg", ".jpeg", ".png", ".webp"}
CARPETA_BACKUP = Path(__file__).parent / "img_backup"


def formato_kb(bytes_val):
    kb = bytes_val / 1024
    if kb >= 1024:
        return f"{kb/1024:.1f} MB"
    return f"{kb:.0f} KB"


def comprimir_imagen(ruta: Path, es_nueva=False):
    if ruta.suffix.lower() not in EXTENSIONES:
        return None
    try:
        peso_original = ruta.stat().st_size
        img = Image.open(ruta)
        img = ImageOps.exif_transpose(img)

        if ruta.suffix.lower() in {".jpg", ".jpeg"}:
            if img.mode in ("RGBA", "P", "LA"):
                fondo = Image.new("RGB", img.size, (255, 255, 255))
                if img.mode == "P":
                    img = img.convert("RGBA")
                fondo.paste(img, mask=img.split()[-1] if img.mode == "RGBA" else None)
                img = fondo
            elif img.mode != "RGB":
                img = img.convert("RGB")

        ancho, alto = img.size
        if ancho > ANCHO_MAXIMO or alto > ALTO_MAXIMO:
            img.thumbnail((ANCHO_MAXIMO, ALTO_MAXIMO), Image.LANCZOS)

        ext = ruta.suffix.lower()
        # Comprimir a buffer primero para comparar tamaños
        import io
        buffer = io.BytesIO()
        if ext in {".jpg", ".jpeg"}:
            img.save(buffer, "JPEG", quality=CALIDAD_JPEG, optimize=True, progressive=True)
        elif ext == ".png":
            img.save(buffer, "PNG", compress_level=CALIDAD_PNG, optimize=True)
        elif ext == ".webp":
            img.save(buffer, "WEBP", quality=CALIDAD_JPEG, method=6)

        datos_comprimidos = buffer.getvalue()

        # Solo reemplazar si el resultado es mas pequeno (nunca aumentar el peso)
        if len(datos_comprimidos) < peso_original:
            ruta.write_bytes(datos_comprimidos)
        
        peso_nuevo = ruta.stat().st_size
        ahorro_pct = ((peso_original - peso_nuevo) / peso_original * 100) if peso_original > 0 else 0

        return {"nombre": ruta.name, "original": peso_original, "nuevo": peso_nuevo, "ahorro": ahorro_pct}

    except Exception as e:
        print(f"   No se pudo comprimir {ruta.name}: {e}")
        return None


def comprimir_todas():
    print("\n" + "="*58)
    print("  COMPRESOR TATYNET - Procesando todas las imagenes")
    print("="*58)

    if not CARPETA_IMG.exists():
        print(f"\nNo se encontro la carpeta: {CARPETA_IMG}")
        return

    if not CARPETA_BACKUP.exists():
        print(f"\nCreando copia de seguridad en /img_backup/ ...")
        shutil.copytree(CARPETA_IMG, CARPETA_BACKUP)
        print("   Backup creado correctamente\n")
    else:
        print(f"\nBackup ya existe en /img_backup/ (no se sobreescribe)\n")

    imagenes = [f for f in CARPETA_IMG.rglob("*") if f.is_file() and f.suffix.lower() in EXTENSIONES]

    if not imagenes:
        print("   No se encontraron imagenes para comprimir.")
        return

    print(f"   {len(imagenes)} imagenes encontradas\n")

    total_original = 0
    total_nuevo = 0
    procesadas = 0

    for i, ruta in enumerate(imagenes, 1):
        resultado = comprimir_imagen(ruta)
        if resultado:
            total_original += resultado["original"]
            total_nuevo    += resultado["nuevo"]
            procesadas     += 1
            print(f"   [{i:03d}/{len(imagenes)}] {resultado['nombre'][:42]:<42} "
                  f"{formato_kb(resultado['original']):>8} -> {formato_kb(resultado['nuevo']):>8}  "
                  f"(-{resultado['ahorro']:.0f}%)")

    ahorro_total = total_original - total_nuevo
    ahorro_pct   = (ahorro_total / total_original * 100) if total_original > 0 else 0

    print("\n" + "="*58)
    print(f"  LISTO - {procesadas} imagenes comprimidas")
    print(f"  Antes:    {formato_kb(total_original)}")
    print(f"  Despues:  {formato_kb(total_nuevo)}")
    print(f"  Ahorrado: {formato_kb(ahorro_total)} ({ahorro_pct:.0f}% mas liviano)")
    print("="*58 + "\n")


def modo_vigilancia():
    try:
        from watchdog.observers import Observer
        from watchdog.events import FileSystemEventHandler
    except ImportError:
        os.system(f"{sys.executable} -m pip install watchdog --quiet")
        try:
            from watchdog.observers import Observer
            from watchdog.events import FileSystemEventHandler
        except:
            _vigilancia_simple()
            return

    class ManejadorImagenes(FileSystemEventHandler):
        def on_created(self, event):
            if event.is_directory:
                return
            ruta = Path(event.src_path)
            if ruta.suffix.lower() not in EXTENSIONES:
                return
            time.sleep(1.5)
            print(f"\nNueva imagen detectada: {ruta.name}")
            resultado = comprimir_imagen(ruta, es_nueva=True)
            if resultado:
                print(f"   Comprimida: {formato_kb(resultado['original'])} -> "
                      f"{formato_kb(resultado['nuevo'])} (-{resultado['ahorro']:.0f}%)")

    print("\n" + "="*58)
    print("  MODO VIGILANCIA ACTIVO - TATYNET Compresor")
    print(f"  Monitoreando: {CARPETA_IMG}")
    print("  Cada imagen nueva se comprimira automaticamente")
    print("  Presiona Ctrl+C para detener")
    print("="*58 + "\n")

    observer = Observer()
    observer.schedule(ManejadorImagenes(), str(CARPETA_IMG), recursive=True)
    observer.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        print("\nVigilancia detenida.\n")
    observer.join()


def _vigilancia_simple():
    print("\n" + "="*58)
    print("  MODO VIGILANCIA (sondeo cada 10 seg)")
    print(f"  Monitoreando: {CARPETA_IMG}")
    print("  Presiona Ctrl+C para detener")
    print("="*58 + "\n")

    archivos_conocidos = set(
        f for f in CARPETA_IMG.rglob("*")
        if f.is_file() and f.suffix.lower() in EXTENSIONES
    )

    try:
        while True:
            time.sleep(10)
            actuales = set(
                f for f in CARPETA_IMG.rglob("*")
                if f.is_file() and f.suffix.lower() in EXTENSIONES
            )
            nuevos = actuales - archivos_conocidos
            for ruta in nuevos:
                time.sleep(1)
                print(f"\nNueva imagen: {ruta.name}")
                resultado = comprimir_imagen(ruta, es_nueva=True)
                if resultado:
                    print(f"   {formato_kb(resultado['original'])} -> "
                          f"{formato_kb(resultado['nuevo'])} (-{resultado['ahorro']:.0f}%)")
            archivos_conocidos = actuales
    except KeyboardInterrupt:
        print("\nVigilancia detenida.\n")


if __name__ == "__main__":
    if "--watch" in sys.argv or "-w" in sys.argv:
        modo_vigilancia()
    else:
        comprimir_todas()
