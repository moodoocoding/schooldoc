from pathlib import Path
import json, subprocess
from pypdf import PdfReader
from PIL import Image,ImageChops
p=Path('design/feature-reviews/2026-10-01-consent/evidence'); poppler=Path(r'C:/Users/panth/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdftoppm.exe')
result={}
for filename in ['response.pdf','personal-qr-sheet.pdf','personal-qr-browser-print.pdf']:
 file=p/filename
 if not file.exists(): continue
 reader=PdfReader(file)
 result[filename]={'pages':len(reader.pages),'pageSizes':[[round(float(pg.mediabox.width),2),round(float(pg.mediabox.height),2)] for pg in reader.pages]}
 subprocess.run([str(poppler),'-r','90','-png',str(file),str(p/file.stem)],check=True,capture_output=True)
 sizes=[]
 for imgfile in sorted(p.glob(file.stem+'-*.png')):
  img=Image.open(imgfile).convert('RGB'); box=ImageChops.difference(img,Image.new('RGB',img.size,'white')).getbbox();sizes.append({'png':imgfile.name,'size':img.size,'nonWhiteBounds':box})
 result[filename]['rendered']=sizes
for filename in ['public-qr.png','personal-qr.png']:
 if (p/filename).exists():result[filename]={'size':Image.open(p/filename).size}
(p/'pdf-inspection.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8'); print(json.dumps(result,ensure_ascii=False,indent=2))
