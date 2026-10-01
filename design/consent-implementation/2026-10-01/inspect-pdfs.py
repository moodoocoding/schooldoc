import json,subprocess,sys
from pathlib import Path
from pypdf import PdfReader
from PIL import Image
base=Path('design/consent-implementation/2026-10-01/evidence')
reports=[]
for filename in ['response.pdf','long-response-with-signature.pdf','qr-browser-print.pdf']:
    reader=PdfReader(base/filename)
    prefix=base/filename.removesuffix('.pdf')
    subprocess.run([sys.argv[1],'-r','80','-png',str(base/filename),str(prefix)],check=True,capture_output=True)
    pages=[]
    for png in sorted(base.glob(prefix.name+'-*.png')):
        im=Image.open(png).convert('L');hist=im.histogram();ink=sum(hist[:230])/(im.width*im.height)
        assert ink>0.001, f'blank page: {png}'
        pages.append({'image':png.name,'width':im.width,'height':im.height,'inkRatio':round(ink,4)})
    reports.append({'file':filename,'pages':len(reader.pages),'rendered':pages,'allPagesNonblank':True})
assert reports[0]['pages']==2
assert reports[1]['pages']>2
assert reports[2]['pages']==3
(base/'pdf-inspection.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps([{k:v for k,v in r.items() if k!='rendered'} for r in reports],ensure_ascii=False))
