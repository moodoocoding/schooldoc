from pathlib import Path
import json,re,subprocess,logging
logging.getLogger("pdfminer").setLevel(logging.ERROR)
from pypdf import PdfReader
import pdfplumber
root=Path('design/feature-reviews/2026-10-01-special-rooms/implementation-evidence')
poppler=Path('C:/Users/panth/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdftoppm.exe')
results={}
for name in ['public','teacher','boundary','roles-regression']:
 path=root/(name+'-a4.pdf');reader=PdfReader(path);pages=[]
 with pdfplumber.open(path) as pdf:
  for page in pdf.pages:
   words=page.extract_words();outside=[w for w in words if w['x0']<-1 or w['top']<-1 or w['x1']>page.width+1 or w['bottom']>page.height+1]
   pages.append({'sizePt':[page.width,page.height],'textLength':len(page.extract_text() or ''),'outsidePage':outside})
 text=''.join(p.extract_text() or '' for p in reader.pages)
 results[name]={'pages':pages,'text':text}
 subprocess.run([str(poppler),'-scale-to','1600','-png',str(path),str(root/(name+'-print'))],check=True,stderr=subprocess.PIPE)
 assert all(not p['outsidePage'] for p in pages),name+' outside page'
 if name!='roles-regression':assert all(p['sizePt'][0]>p['sizePt'][1] for p in pages),name+' landscape'
 else:assert len(pages)==1 and pages[0]['sizePt'][0]<pages[0]['sizePt'][1],name+' portrait'
markers=set(re.findall(r'R\d{2}',results['boundary']['text']));assert len(markers)==54,('printed markers',len(markers))
for n in ['public','teacher']:assert len(results[n]['pages'])==1 and '9교시' in results[n]['text'],n
(root/'pdf-inspection.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({n:{'pages':len(v['pages']),'sizes':[p['sizePt'] for p in v['pages']],'outside':sum(len(p['outsidePage']) for p in v['pages'])} for n,v in results.items()},ensure_ascii=False));print('boundary markers',len(markers))
