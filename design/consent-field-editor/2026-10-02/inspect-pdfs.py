import json, subprocess, sys, math
from pathlib import Path
from pypdf import PdfReader
from PIL import Image, ImageDraw
base=Path('design/consent-field-editor/2026-10-02/evidence')
reports=[]
for filename,expected in [('final-qr-download.pdf',4),('final-qr-print.pdf',4),('final-qr-60-print.pdf',10),('tablet-qr-768-download.pdf',1),('tablet-qr-390-print.pdf',1)]:
    reader=PdfReader(base/filename)
    assert len(reader.pages)==expected, (filename,len(reader.pages))
    prefix=base/filename.removesuffix('.pdf')
    subprocess.run([sys.argv[1],'-r','85','-png',str(base/filename),str(prefix)],check=True,capture_output=True)
    pngs=sorted((p for p in base.glob(prefix.name+'-*.png') if p.stem.rsplit('-',1)[1].isdecimal()),key=lambda p:int(p.stem.rsplit('-',1)[1]))
    assert len(pngs)==expected
    rendered=[]
    for png in pngs:
        im=Image.open(png).convert('L'); ink=sum(im.histogram()[:230])/(im.width*im.height)
        assert ink>0.01, (filename,png,'blank')
        rendered.append({'image':png.name,'width':im.width,'height':im.height,'inkRatio':round(ink,4)})
    cols=2 if expected==4 else min(expected,5)
    sheet=Image.new('RGB',(cols*320,math.ceil(expected/cols)*475),'#d6dce3')
    draw=ImageDraw.Draw(sheet)
    for index,png in enumerate(pngs):
        im=Image.open(png).convert('RGB');im.thumbnail((300,440))
        x=(index%cols)*320+10;y=(index//cols)*475+25
        sheet.paste(im,(x,y));draw.text((x,y-18),f'Page {index+1}',fill='black')
    sheet.save(base/(prefix.name+'-all-pages.png'))
    reports.append({'file':filename,'pages':len(reader.pages),'A4':all(abs(float(p.mediabox.width)-595.28)<1 and abs(float(p.mediabox.height)-841.89)<1 for p in reader.pages),'allPagesNonblank':True,'rendered':rendered})
for f in ['final-public-qr.png','final-personal-qr.png']:
    im=Image.open(base/f);assert im.size==(1024,1024),(f,im.size)
(base/'pdf-inspection.json').write_text(json.dumps({'documents':reports,'qrPngs':{'count':2,'width':1024,'height':1024}},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps([{k:v for k,v in r.items() if k!='rendered'} for r in reports]))