"""Configuration pytest : garantit que la racine du projet est importable.

Permet `import config` et `from src... import ...` quel que soit le dossier
depuis lequel pytest est lancé.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
