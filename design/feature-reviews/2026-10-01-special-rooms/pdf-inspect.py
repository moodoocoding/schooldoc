from pathlib import Path
import json
from PIL import Image
from pypdf import PdfReader
root = Path(__file__).parent / "evidence"
result = {}
for name in ("public", "teacher"):
    reader = PdfReader(root / (name + "-a4.pdf"))
    images = sorted(root.glob(name + "-print-*.png"))
    result[name] = {"pages": len(reader.pages), "text_lengths": [len(p.extract_text() or "") for p in reader.pages], "rendered_pages": [{"file": p.name, "nonwhite_pixels": sum(1 for px in Image.open(p).convert("RGB").getdata() if px != (255, 255, 255))} for p in images]}
(root / "pdf-inspection.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(result, ensure_ascii=False, indent=2))
