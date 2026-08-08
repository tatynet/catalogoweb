"""
PREPARAR SUBIDA A GITHUB - CATALOGO TATYNET
============================================
Ejecuta este script ANTES de cada git push.
Hace todo automaticamente en 2 pasos:

  PASO 1: Comprime las imagenes nuevas en /img/
  PASO 2: Actualiza la version en index.html

USO:
    python preparar_subida.py
"""

import subprocess
import sys
from pathlib import Path

BASE = Path(__file__).parent

print()
print("=" * 55)
print("  TATYNET - Preparando subida a GitHub")
print("=" * 55)

# PASO 1: Comprimir imagenes
print("\n[PASO 1/2] Comprimiendo imagenes nuevas...")
print("-" * 55)
subprocess.run([sys.executable, str(BASE / "comprimir_imagenes.py")], check=False)

# PASO 2: Actualizar version
print("\n[PASO 2/2] Actualizando version en index.html...")
print("-" * 55)
subprocess.run([sys.executable, str(BASE / "actualizar_version.py")], check=False)

print("=" * 55)
print("  TODO LISTO. Ahora puedes hacer git push.")
print("  Los usuarios veran los cambios sin cache.")
print("=" * 55)
print()
