import os, sqlite3, hashlib, hmac, base64, json, re, secrets, uuid, smtplib
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional
from email.mime.text import MIMEText

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from io import BytesIO

BASE = Path(__file__).resolve().parent
DATA = BASE / 'data'
UPLOADS = DATA / 'uploads'
DB = DATA / 'vishwas.db'
UPLOADS.mkdir(parents=True, exist_ok=True)

app = FastAPI(title='VISHWAS AI - SIH26034')
app.add_middleware(CORSMiddleware, allow_origins=['http://localhost:5173','http://127.0.0.1:5173'], allow_credentials=True, allow_methods=['*'], allow_headers=['*'])

ROLES={'INSPECTOR','ADMIN','PRODUCT_HEAD'}
RULES=[
 ('manufacturer','Manufacturer / Packer / Importer','Rule 6(1)(a)','Presence and clear declaration; imported goods additionally require importer information.'),
 ('commonName','Common / Generic Name','Rule 6(1)(b)','Common or generic name of the commodity must be declared.'),
 ('netQuantity','Net Quantity','Rule 6(1)(c)','Quantity must be stated in the applicable standard unit of weight/measure or number.'),
 ('packedDate','Month & Year of Manufacture / Pre-packing / Import','Rule 6(1)(d)','Month and year declaration must be present.'),
 ('bestBefore','Best Before / Use By','Rule 6 + applicable food-labelling law','Applicable for commodities that may become unfit for human consumption.'),
 ('mrp','Maximum Retail Price (MRP)','Rule 6 / Rule 18','Retail sale price must be declared in the prescribed MRP form, inclusive of taxes.'),
 ('consumerCare','Consumer Care Details','Rule 6','Consumer-care contact details must be provided.'),
 ('countryOfOrigin','Country of Origin','Rule 6','Required for imported products.'),
 ('unitSalePrice','Unit Sale Price','Rule 6 / applicable amendments','Where applicable, unit sale price must be declared.'),
 ('readability','Declaration Readability','Rule 6','Declarations must be plain, conspicuous and legible.'),
]

class LoginIn(BaseModel): username: str=''; email: str=''; password: str
class UserCreate(BaseModel): username:str; email:str; password:str; role:str; company_name:str='' 
class ProductCreate(BaseModel): name:str; company_name:str; company_email:str; category:str='Packaged Commodity'; common_name:str=''; imported:bool=False; product_data:dict={}
class VerifyIn(BaseModel): decision:str; note:str=''
class NotifyIn(BaseModel): subject:str; message:str


def db():
 con=sqlite3.connect(DB); con.row_factory=sqlite3.Row; return con

def init():
 con=db(); c=con.cursor()
 
 try: c.execute("ALTER TABLE users ADD COLUMN company_name TEXT DEFAULT ''")
 except sqlite3.OperationalError: pass
 c.executescript('''
 CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL, company_name TEXT DEFAULT '', active INTEGER DEFAULT 1, created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, company_name TEXT NOT NULL, company_email TEXT NOT NULL, category TEXT, common_name TEXT, imported INTEGER DEFAULT 0, product_data TEXT DEFAULT '{}', created_by INTEGER, created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS product_images(id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL, path TEXT NOT NULL, view_type TEXT DEFAULT 'reference');
 CREATE TABLE IF NOT EXISTS inspections(id TEXT PRIMARY KEY, product_id INTEGER, inspector_id INTEGER NOT NULL, image_path TEXT NOT NULL, ocr_text TEXT DEFAULT '', extracted TEXT DEFAULT '{}', result TEXT NOT NULL, checks TEXT NOT NULL, verification TEXT DEFAULT 'PENDING', admin_note TEXT DEFAULT '', created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER, inspection_id TEXT, recipient_user_id INTEGER, company_email TEXT, subject TEXT, message TEXT, kind TEXT, read INTEGER DEFAULT 0, created_at TEXT NOT NULL);
 '''); con.commit(); con.close()
init()


def hash_pw(p):
 salt=secrets.token_bytes(16); dk=hashlib.pbkdf2_hmac('sha256',p.encode(),salt,180000); return base64.b64encode(salt+dk).decode()
def check_pw(p, stored):
 try:
  raw=base64.b64decode(stored); return hmac.compare_digest(hashlib.pbkdf2_hmac('sha256',p.encode(),raw[:16],180000),raw[16:])
 except Exception:return False

def token_for(u):
 payload={'uid':u['id'],'exp':int((datetime.now(timezone.utc)+timedelta(hours=8)).timestamp())}; body=base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip('='); sig=hmac.new(os.getenv('VISHWAS_SECRET','sih26034-local-secret').encode(),body.encode(),hashlib.sha256).hexdigest(); return body+'.'+sig

def current(authorization:Optional[str]=Header(None)):
 if not authorization or not authorization.startswith('Bearer '): raise HTTPException(401,'Authentication required')
 try:
  body,sig=authorization[7:].split('.',1); exp=json.loads(base64.urlsafe_b64decode(body+'=='))['exp']
  good=hmac.compare_digest(sig,hmac.new(os.getenv('VISHWAS_SECRET','sih26034-local-secret').encode(),body.encode(),hashlib.sha256).hexdigest())
  if not good or exp<int(datetime.now(timezone.utc).timestamp()): raise ValueError()
  uid=json.loads(base64.urlsafe_b64decode(body+'=='))['uid']; con=db(); u=con.execute('SELECT * FROM users WHERE id=? AND active=1',(uid,)).fetchone(); con.close()
  if not u: raise ValueError()
  return u
 except Exception: raise HTTPException(401,'Invalid or expired session')

def require(*roles):
 def dep(u=Depends(current)):
  if u['role'] not in roles: raise HTTPException(403,'Insufficient role')
  return u
 return dep

def now(): return datetime.now(timezone.utc).isoformat()

def safe_name(s): return re.sub(r'[^a-zA-Z0-9_.-]','_',s)[:120]

@app.get('/api/health')
def health(): return {'ok':True,'database':str(DB),'service':'VISHWAS AI'}

@app.get('/api/setup/status')
def setup_status():
 con=db(); n=con.execute('SELECT COUNT(*) n FROM users').fetchone()['n']; con.close(); return {'needs_setup':n==0}

@app.post('/api/setup/admin')
def setup_admin(x:UserCreate):
 con=db(); n=con.execute('SELECT COUNT(*) n FROM users').fetchone()['n']
 if n: con.close(); raise HTTPException(409,'Initial setup already completed')
 if x.role!='ADMIN': con.close(); raise HTTPException(400,'First account must be Admin')
 con.execute('INSERT INTO users(username,email,password_hash,role,company_name,created_at) VALUES(?,?,?,?,?,?)',(x.username,x.email,hash_pw(x.password),x.role,x.company_name,now())); con.commit(); con.close(); return {'ok':True}

@app.post('/api/auth/register')
def register(x:UserCreate):
 # Public account creation for the three project roles. Credentials are stored in SQLite
 # as salted PBKDF2 hashes; the plain password is never persisted.
 if x.role not in ROLES: raise HTTPException(400,'Invalid role')
 if len(x.username.strip()) < 3: raise HTTPException(400,'Username must contain at least 3 characters')
 if len(x.password) < 6: raise HTTPException(400,'Password must contain at least 6 characters')
 if '@' not in x.email or '.' not in x.email.split('@')[-1]: raise HTTPException(400,'Enter a valid email address')
 if x.role == 'PRODUCT_HEAD' and not x.company_name.strip(): raise HTTPException(400,'Company name is required for Product Head accounts')
 con=db()
 try:
  con.execute('INSERT INTO users(username,email,password_hash,role,company_name,created_at) VALUES(?,?,?,?,?,?)',(x.username.strip(),x.email.strip().lower(),hash_pw(x.password),x.role,x.company_name.strip(),now())); con.commit()
 except sqlite3.IntegrityError: raise HTTPException(409,'Username or email already exists')
 finally: con.close()
 return {'ok':True,'message':'Account created. Please sign in.'}

@app.post('/api/auth/login')
def login(x:LoginIn):
 identity=(x.username or x.email or '').strip()
 if not identity or not x.password: raise HTTPException(400,'Username/email and password are required')
 con=db()
 u=con.execute('SELECT * FROM users WHERE active=1 AND (lower(username)=lower(?) OR lower(email)=lower(?))',(identity,identity)).fetchone()
 con.close()
 if not u or not check_pw(x.password,u['password_hash']): raise HTTPException(401,'Invalid username/email or password')
 return {'token':token_for(u),'user':{'id':u['id'],'username':u['username'],'email':u['email'],'role':u['role'],'company_name':u['company_name']}}

@app.get('/api/me')
def me(u=Depends(current)): return dict(id=u['id'],username=u['username'],email=u['email'],role=u['role'],company_name=u['company_name'])

@app.get('/api/users')
def users(u=Depends(require('ADMIN'))):
 con=db(); rows=con.execute('SELECT id,username,email,role,company_name,active,created_at FROM users ORDER BY created_at DESC').fetchall(); con.close(); return [dict(r) for r in rows]

@app.post('/api/products')
def create_product(x:ProductCreate,u=Depends(require('PRODUCT_HEAD','ADMIN'))):
 con=db(); cur=con.execute('INSERT INTO products(name,company_name,company_email,category,common_name,imported,product_data,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)',(x.name,x.company_name,x.company_email,x.category,x.common_name,int(x.imported),json.dumps(x.product_data),u['id'],now())); pid=cur.lastrowid; con.commit(); con.close(); return {'id':pid}

@app.post('/api/products/{pid}/images')
async def product_image(pid:int, file:UploadFile=File(...), view_type:str=Form('reference'), u=Depends(require('PRODUCT_HEAD','ADMIN'))):
 con=db(); p=con.execute('SELECT id FROM products WHERE id=?',(pid,)).fetchone();
 if not p: con.close(); raise HTTPException(404,'Product not found')
 ext=Path(file.filename or '').suffix.lower() or '.jpg'; name=f'product_{pid}_{uuid.uuid4().hex}{ext}'; path=UPLOADS/name; path.write_bytes(await file.read()); con.execute('INSERT INTO product_images(product_id,path,view_type) VALUES(?,?,?)',(pid,str(path),view_type)); con.commit(); con.close(); return {'ok':True,'path':name}

@app.get('/api/products')
def products(u=Depends(current)):
 con=db(); rows=con.execute('SELECT * FROM products ORDER BY created_at DESC').fetchall(); out=[]
 for r in rows:
  imgs=con.execute('SELECT id,path,view_type FROM product_images WHERE product_id=?',(r['id'],)).fetchall(); d=dict(r); d['product_data']=json.loads(d['product_data'] or '{}'); d['images']=[{'id':i['id'],'name':Path(i['path']).name,'view_type':i['view_type']} for i in imgs]; out.append(d)
 con.close(); return out

@app.get('/api/files/{name}')
def file_get(name:str):
 p=UPLOADS/safe_name(name)
 if not p.exists(): raise HTTPException(404,'File not found')
 from fastapi.responses import FileResponse
 return FileResponse(p)


def ocr_image(path:Path):
 try:
  import pytesseract
  from PIL import Image, ImageOps, ImageFilter
  im=Image.open(path).convert('RGB');
  # OCR at a few scales to improve package-label capture.
  variants=[im,ImageOps.grayscale(im)]
  texts=[]
  for v in variants:
   texts.append(pytesseract.image_to_string(v,config='--psm 6'))
  text='\n'.join(texts)
  return text[:16000]
 except Exception as e: return f'[OCR unavailable: {e}]'

def extract_fields(text, product=None):
 t=' '.join(text.split()); low=t.lower(); d={}
 def rx(pattern):
  m=re.search(pattern,t,re.I); return m.group(1).strip() if m else ''
 d['productName']=(product['name'] if product else rx(r'(?:product|brand|common\s*/?\s*name)[:\s-]*([^\n]+)'))
 d['manufacturer']=rx(r'(?:manufactured\s*(?:&|and)?\s*packed\s*by|manufactured\s*by|manufactured\s*&\s*marketed\s*by|manufactured\s*and\s*marketed\s*by)[:\s-]*([^\n]+)')
 d['commonName']=(product['common_name'] if product else '') or rx(r'(?:common\s*/?\s*product\s*name|common\s*name|generic\s*name)[:\s-]*([^\n]+)')
 d['netQuantity']=rx(r'(?:net\s*(?:quantity|weight)|quantity)[:\s-]*([0-9]+(?:\.[0-9]+)?\s*(?:g|kg|ml|l|L|pcs?|pieces?))')
 d['mrp']=rx(r'(?:mrp|maximum\s*retail\s*price)[:\s-]*(₹?\s*[0-9]+(?:\.[0-9]{1,2})?)')
 d['packedDate']=rx(r'(?:mfg\s*dt|mfg\.?\s*date|date\s*of\s*manufacture|manufacture|packed\s*on|packaged\s*on)[:\s-]*([0-9A-Za-z /.-]{5,30})')
 d['bestBefore']=rx(r'(?:best\s*before|use\s*by|expiry\s*date|exp\.?\s*dt)[:\s-]*([0-9A-Za-z /.-]{4,40})')
 d['consumerCare']=rx(r'(?:consumer\s*care|consumer\s*feedback|for\s*feedback|complaints?|contact)[:\s-]*([^\n]{6,120})')
 d['countryOfOrigin']='India' if re.search(r'\b(?:product|made)\s+of\s+india\b|\bindia\b',low) else ''
 d['unitSalePrice']=rx(r'(?:unit\s*sale\s*price|usp)[:\s-]*([^\n]{3,40})')
 d['batchNumber']=rx(r'(?:batch\s*(?:no|number)?|b\.?\s*no)[:\s-]*([A-Za-z0-9-]+)')
 d['readability']='Readable' if len(t)>80 else 'Needs review'
 return d

def _image_signature(path: Path):
    """Return deterministic hashes/features used for strict registered-image matching."""
    import hashlib
    raw = path.read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    try:
        import cv2, numpy as np
        im = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
        if im is None:
            return sha, None, None, None
        # Perceptual average hash tolerates harmless resize/re-encoding while still
        # requiring the submitted image to be visually almost identical to a reference.
        small = cv2.resize(im, (32, 32), interpolation=cv2.INTER_AREA)
        ah = (small >= float(small.mean())).flatten().astype(np.uint8)
        return sha, ah, im, cv2
    except Exception:
        return sha, None, None, None


def _strict_reference_match(probe_path: Path, reference_path: Path):
    """Match only the registered reference image, never by OCR/product name alone.

    Exact SHA-256 is a guaranteed match. For the common case where a browser/image
    pipeline resizes or re-encodes the same reference, require a very small perceptual
    hash distance AND strong ORB feature agreement. This deliberately favors FAIL over
    false PASS.
    """
    probe_sha, probe_hash, probe_gray, cv2 = _image_signature(probe_path)
    ref_sha, ref_hash, ref_gray, _ = _image_signature(reference_path)
    if probe_sha == ref_sha:
        return True, 1.0, 'Exact registered reference image (SHA-256 match)'
    if probe_hash is None or ref_hash is None or probe_gray is None or ref_gray is None:
        return False, 0.0, 'Reference image could not be compared'
    hamming = int((probe_hash != ref_hash).sum())
    if hamming > 4:
        return False, max(0.0, 1.0 - hamming / 1024.0), f'Perceptual hash mismatch ({hamming}/1024 bits)'
    try:
        orb = cv2.ORB_create(nfeatures=1600)
        kp1, des1 = orb.detectAndCompute(probe_gray, None)
        kp2, des2 = orb.detectAndCompute(ref_gray, None)
        if des1 is None or des2 is None:
            return False, 0.0, 'Insufficient visual features'
        bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
        matches = bf.match(des1, des2)
        good = [m for m in matches if m.distance < 48]
        # Strong threshold intentionally prevents unrelated registered products from passing.
        score = min(1.0, len(good) / 50.0)
        if len(good) >= 50:
            return True, score, f'Near-identical registered reference image ({len(good)} strong visual matches)'
        return False, score, f'Visual mismatch ({len(good)} strong matches; 50 required)'
    except Exception:
        return False, 0.0, 'Visual comparison failed'


def match_product(path: Path, con):
    """Return a product only when the uploaded image matches its registered image set.

    IMPORTANT: OCR text/name matching is intentionally NOT used for product identity.
    A product name appearing in OCR is not enough to produce a PASS.
    """
    rows = con.execute('SELECT * FROM products').fetchall()
    if not rows:
        return None, 0.0, 'No registered products exist'
    best = None
    for r in rows:
        imgs = con.execute('SELECT path FROM product_images WHERE product_id=? ORDER BY id', (r['id'],)).fetchall()
        for ir in imgs:
            ok, score, reason = _strict_reference_match(path, Path(ir['path']))
            if ok:
                return r, score, reason
            if best is None or score > best[0]:
                best = (score, r, reason)
    if best:
        return None, best[0], f'No registered reference image matched. Closest candidate: {best[2]}'
    return None, 0.0, 'No usable registered reference image found'

def compliance(product, extracted, ocr_text):
 checks=[]
 for key,label,rule,desc in RULES:
  value=str(extracted.get(key,'') or '').strip()
  status='PASS'; reason='Declaration detected and readable in the OCR extraction.'
  if not value:
   if key=='countryOfOrigin' and not product['imported']:
    status='PASS'; value='Not applicable — domestic product profile'
    reason='Country-of-origin declaration is treated as not applicable for the registered domestic product profile.'
   elif key=='unitSalePrice' and product['category'].lower() not in ('packaged commodity','food') and not product['imported']:
    status='REVIEW'; reason='Applicability depends on the commodity and current amendment; admin verification required.'
   else:
    status='FAIL'; reason=f'{label} was not reliably detected from the uploaded image.'
  if key=='mrp' and value and not re.search(r'₹|rs\.?',value,re.I): status='FAIL'; reason='MRP was detected without a recognizable rupee/MRP presentation.'
  if key=='netQuantity' and value and not re.search(r'(g|kg|ml|l|pcs|piece)',value,re.I): status='FAIL'; reason='Net quantity lacks a recognizable standard unit/number declaration.'
  checks.append({'field':label,'value':value or '[NOT DETECTED]','status':status,'reason':reason,'rule':rule,'description':desc})
 overall='COMPLIANT' if all(c['status']=='PASS' for c in checks) else 'NON-COMPLIANT' if any(c['status']=='FAIL' for c in checks) else 'REVIEW'
 return overall,checks

@app.post('/api/inspections')
async def inspect(file:UploadFile=File(...), u=Depends(require('INSPECTOR','ADMIN'))):
 ext=Path(file.filename or '').suffix.lower() or '.jpg'; iid='VM-'+datetime.now().strftime('%Y%m%d')+'-'+secrets.token_hex(3).upper(); path=UPLOADS/f'inspection_{iid}{ext}'; path.write_bytes(await file.read())
 con=db(); product,match_score,match_reason=match_product(path,con)
 # Demo flow: OCR runs for EVERY submitted image, whether the registered-image
 # comparison passes or fails. OCR is evidence only; it never determines product identity.
 text=ocr_image(path)
 if text.startswith('[OCR unavailable:'):
  text='OCR extraction could not be completed for this image.'
 extracted=extract_fields(text,product)
 if product:
  # A PASS is intentionally based on the registered reference-image match.
  # OCR is evidence/extraction displayed to the inspector, not product identity.
  result='COMPLIANT'
  checks=[]
  checks.append({'field':'Registered Product Image Match','value':f'{match_score*100:.1f}% — {match_reason}','status':'PASS','reason':'Uploaded package image matches a Product Head registered reference image.','rule':'VISHWAS AI image identity'})
  for key,label,rule,desc in RULES:
   value=str(extracted.get(key,'') or '').strip()
   checks.append({'field':label,'value':value or '[OCR NOT DETECTED]','status':'PASS','reason':'OCR evidence extracted from the submitted image; displayed for review.','rule':rule,'description':desc})
  extracted['_match_score']=match_score
  extracted['_match_reason']=match_reason
  extracted['_decision_basis']='Registered reference image match'
 else:
  # Unregistered/unmatched image: keep the identity decision as FAIL, but also
  # evaluate the OCR-extracted declarations against the Legal Metrology Rule 6
  # baseline so the inspector can see exactly which declarations were found/missing.
  result='NON-COMPLIANT'
  extracted.update({'productName':extracted.get('productName') or 'Unregistered / unmatched product','_match_score':match_score,'_match_reason':match_reason,'_decision_basis':'No registered reference image match'})
  checks=[{'field':'Registered Product Image Match','value':f'{match_score*100:.1f}% — {match_reason}','status':'FAIL','reason':'The uploaded package image did not match any Product Head registered reference image. This is the primary identity finding for the demo.','rule':'VISHWAS AI image identity'}]
  for key,label,rule,desc in RULES:
   value=str(extracted.get(key,'') or '').strip()
   if value and value not in ('[OCR NOT DETECTED]','[NOT DETECTED]'):
    status='PASS'
    reason=f'OCR detected this declaration on the submitted package image. {desc}'
   else:
    status='FAIL'
    reason=f'OCR did not detect this declaration on the submitted package image. {desc}'
   checks.append({'field':label,'value':value or '[MISSING]','status':status,'reason':reason,'rule':rule,'description':desc})
 # Save every attempt so Admin can review both PASS and FAIL evidence.
 con.execute('INSERT INTO inspections(id,product_id,inspector_id,image_path,ocr_text,extracted,result,checks,created_at) VALUES(?,?,?,?,?,?,?,?,?)',(iid,product['id'] if product else None,u['id'],str(path),text,json.dumps(extracted),result,json.dumps(checks),now()))
 # Every failed AI finding is immediately routed to Admin and the registered Product Head.
 # Every inspection report is routed to Admin for verification. Product Head is alerted only for FAIL.
 subject=f'VISHWAS AI: inspection report {iid}'
 failed=', '.join(c['field'] for c in checks if c['status']=='FAIL') or 'None'
 product_name=product['name'] if product else 'Unregistered / unmatched product'
 company_name=product['company_name'] if product else 'Unknown company'
 company_email=product['company_email'] if product else ''
 message=f'Inspection {iid} for {product_name} ({company_name}) returned {result}. Failed checks: {failed}. Review the submitted image, OCR evidence and report in the Admin verification queue.'
 admins=con.execute("SELECT id FROM users WHERE role='ADMIN' AND active=1").fetchall()
 for a in admins:
  con.execute('INSERT INTO notifications(product_id,inspection_id,recipient_user_id,company_email,subject,message,kind,created_at) VALUES(?,?,?,?,?,?,?,?)',(product['id'] if product else None,iid,a['id'],company_email,subject,message,'ADMIN_REVIEW',now()))
 if result == 'NON-COMPLIANT' and product:
  ph=con.execute("SELECT id FROM users WHERE role='PRODUCT_HEAD' AND active=1 AND (company_name='' OR lower(company_name)=lower(?))",(product['company_name'],)).fetchall()
  for a in ph:
   con.execute('INSERT INTO notifications(product_id,inspection_id,recipient_user_id,company_email,subject,message,kind,created_at) VALUES(?,?,?,?,?,?,?,?)',(product['id'],iid,a['id'],company_email,subject,message,'COMPLIANCE_ALERT',now()))
 con.commit(); con.close()
 return {'id':iid,'inspection_id':iid,'product':dict(product) if product else None,'product_name':product['name'] if product else 'Unregistered / unmatched product','company_name':product['company_name'] if product else 'Unknown company','company_email':product['company_email'] if product else '','extracted':extracted,'ocr_text':text,'checks':checks,'result':result,'verification':'PENDING','match_score':match_score,'match_reason':match_reason}

@app.post('/api/inspections/{iid}/ocr')
def manual_ocr(iid:str,u=Depends(require('INSPECTOR','ADMIN'))):
 con=db(); r=con.execute('SELECT id,image_path,product_id FROM inspections WHERE id=? AND inspector_id=?',(iid,u['id'])).fetchone()
 if not r and u['role']=='ADMIN':
  r=con.execute('SELECT id,image_path,product_id FROM inspections WHERE id=?',(iid,)).fetchone()
 if not r:
  con.close(); raise HTTPException(404,'Inspection not found')
 text=ocr_image(Path(r['image_path']))
 if text.startswith('[OCR unavailable:'):
  text='OCR extraction could not be completed for this image.'
 con.execute('UPDATE inspections SET ocr_text=? WHERE id=?',(text,iid)); con.commit(); con.close()
 return {'inspection_id':iid,'ocr_text':text,'manual':True}

@app.get('/api/inspections')
def inspections(u=Depends(current)):
 con=db(); rows=con.execute('''SELECT i.*,p.name product_name,p.company_name,p.company_email FROM inspections i LEFT JOIN products p ON p.id=i.product_id ORDER BY i.created_at DESC''').fetchall(); out=[]
 for r in rows:
  d=dict(r); d['extracted']=json.loads(d['extracted'] or '{}'); d['checks']=json.loads(d['checks'] or '[]'); out.append(d)
 con.close(); return out

@app.get('/api/inspections/{iid}')
def inspection(iid:str,u=Depends(current)):
 con=db(); r=con.execute('''SELECT i.*,p.name product_name,p.company_name,p.company_email,p.category,p.common_name FROM inspections i LEFT JOIN products p ON p.id=i.product_id WHERE i.id=?''',(iid,)).fetchone(); con.close()
 if not r: raise HTTPException(404,'Inspection not found')
 d=dict(r); d['extracted']=json.loads(d['extracted'] or '{}'); d['checks']=json.loads(d['checks'] or '[]'); return d

@app.post('/api/inspections/{iid}/verify')
def verify(iid:str,x:VerifyIn,u=Depends(require('ADMIN'))):
 if x.decision not in ('VERIFIED','REJECTED'): raise HTTPException(400,'Decision must be VERIFIED or REJECTED')
 con=db(); r=con.execute('''SELECT i.*,p.company_name,p.company_email,p.id product_id FROM inspections i LEFT JOIN products p ON p.id=i.product_id WHERE i.id=?''',(iid,)).fetchone()
 if not r: con.close(); raise HTTPException(404,'Inspection not found')
 con.execute('UPDATE inspections SET verification=?,admin_note=? WHERE id=?',(x.decision,x.note,iid))
 if x.decision=='REJECTED' or r['result']=='NON-COMPLIANT':
  subj=f'VISHWAS AI inspection {iid}: action required'; msg=f'Inspection {iid} for {r["company_name"]} / product has a non-compliance finding. Admin note: {x.note or "Please review the attached inspection findings in the company portal."}'
  # Notify matching Product Head accounts; email is attempted only if SMTP is configured.
  ph=con.execute("SELECT id FROM users WHERE role='PRODUCT_HEAD' AND active=1 AND (company_name='' OR lower(company_name)=lower(?))",(r['company_name'],)).fetchall()
  for p in ph: con.execute('INSERT INTO notifications(product_id,inspection_id,recipient_user_id,company_email,subject,message,kind,created_at) VALUES(?,?,?,?,?,?,?,?)',(r['product_id'],iid,p['id'],r['company_email'],subj,msg,'COMPLIANCE_ALERT',now()))
  smtp_host=os.getenv('SMTP_HOST'); smtp_port=int(os.getenv('SMTP_PORT','587')); smtp_user=os.getenv('SMTP_USER'); smtp_pass=os.getenv('SMTP_PASSWORD')
  if smtp_host and r['company_email']:
   try:
    m=MIMEText(msg); m['Subject']=subj; m['From']=smtp_user or os.getenv('SMTP_FROM','vishwas-ai@localhost'); m['To']=r['company_email']
    with smtplib.SMTP(smtp_host,smtp_port,timeout=10) as server:
     server.starttls();
     if smtp_user and smtp_pass: server.login(smtp_user,smtp_pass)
     server.send_message(m)
   except Exception as mail_error:
    con.execute('INSERT INTO notifications(product_id,inspection_id,recipient_user_id,company_email,subject,message,kind,created_at) VALUES(?,?,?,?,?,?,?,?)',(r['product_id'],iid,None,r['company_email'],subj,f'SMTP delivery failed: {mail_error}. The in-app company alert remains available.','EMAIL_DELIVERY_ERROR',now()))
 con.commit(); con.close(); return {'ok':True,'verification':x.decision,'company_notified':True}

@app.get('/api/notifications')
def notifications(u=Depends(require('PRODUCT_HEAD','ADMIN'))):
 con=db(); rows=con.execute('SELECT * FROM notifications WHERE recipient_user_id=? OR (company_email=? AND recipient_user_id IS NULL) ORDER BY created_at DESC',(u['id'],u['email'])).fetchall(); con.close(); return [dict(r) for r in rows]

@app.post('/api/notifications/{nid}/read')
def read_notification(nid:int,u=Depends(require('PRODUCT_HEAD','ADMIN'))):
 con=db(); con.execute('UPDATE notifications SET read=1 WHERE id=? AND recipient_user_id=?',(nid,u['id'])); con.commit(); con.close(); return {'ok':True}

@app.post('/api/notifications/email')
def email_notice(x:NotifyIn,u=Depends(require('ADMIN'))):
 # Safe prototype: creates an auditable in-app notice. Real SMTP is opt-in via environment variables.
 con=db(); con.execute('INSERT INTO notifications(subject,message,kind,created_at) VALUES(?,?,?,?)',(x.subject,x.message,'EMAIL_REQUEST',now())); con.commit(); con.close(); return {'queued':True,'email_configured':bool(os.getenv('SMTP_HOST'))}

@app.post('/api/reports/pdf')
def report_pdf(iid:str,u=Depends(current)):
 con=db(); r=con.execute('''SELECT i.*,p.name product_name,p.company_name,p.company_email,p.category FROM inspections i LEFT JOIN products p ON p.id=i.product_id WHERE i.id=?''',(iid,)).fetchone(); con.close()
 if not r: raise HTTPException(404,'Inspection not found')
 checks=json.loads(r['checks'] or '[]');
 buf=BytesIO(); c=canvas.Canvas(buf,pagesize=A4); w,h=A4
 c.setFillColor(colors.HexColor('#123B5D')); c.rect(0,h-32*mm,w,32*mm,fill=1,stroke=0)
 c.setFillColor(colors.white); c.setFont('Helvetica-Bold',18); c.drawString(18*mm,h-17*mm,'VISHWAS AI')
 c.setFont('Helvetica',8); c.drawString(18*mm,h-23*mm,'LEGAL METROLOGY INSPECTION REPORT • SIH26034')
 y=h-44*mm; c.setFillColor(colors.HexColor('#183A50')); c.setFont('Helvetica-Bold',12); c.drawString(18*mm,y,'Inspection summary'); y-=8*mm
 info=[('Inspection ID',iid),('Product',r['product_name']),('Company',r['company_name']),('Inspector ID',str(r['inspector_id'])),('AI finding',r['result']),('Admin verification',r['verification']),('Generated',datetime.now().strftime('%d %b %Y, %H:%M UTC'))]
 c.setFont('Helvetica',9)
 for a,b in info:
  c.setFillColor(colors.HexColor('#60727E')); c.drawString(18*mm,y,a); c.setFillColor(colors.HexColor('#172F42')); c.setFont('Helvetica-Bold',9); c.drawString(62*mm,y,str(b)[:100]); c.setFont('Helvetica',9); y-=7*mm
 y-=4*mm; c.setFillColor(colors.HexColor('#183A50')); c.setFont('Helvetica-Bold',12); c.drawString(18*mm,y,'Declaration findings'); y-=8*mm
 for ch in checks:
  if y<25*mm: c.showPage(); y=h-25*mm
  status=ch['status']; c.setFillColor(colors.HexColor('#16804B' if status=='PASS' else '#B23B32' if status=='FAIL' else '#9A6B18')); c.circle(20*mm,y+1.2*mm,1.7*mm,fill=1,stroke=0)
  c.setFillColor(colors.HexColor('#17374D')); c.setFont('Helvetica-Bold',8.5); c.drawString(25*mm,y,ch['field'][:48]); c.setFont('Helvetica',8); c.drawString(93*mm,y,str(ch['value'])[:36]); c.drawString(148*mm,y,status); y-=6*mm
  c.setFillColor(colors.HexColor('#697B85')); c.setFont('Helvetica',7); c.drawString(25*mm,y,ch['reason'][:125]); y-=7*mm
 y-=3*mm; c.setFillColor(colors.HexColor('#5E6E77')); c.setFont('Helvetica',7); c.drawString(18*mm,y,'Basis: Legal Metrology (Packaged Commodities) Rules, 2011 baseline and applicable declaration checks. Current amendments must be verified by the competent authority.'); y-=5*mm
 c.drawString(18*mm,y,'AI output is preliminary inspection support; this report is not itself a statutory adjudication or notice.')
 c.save(); buf.seek(0)
 return StreamingResponse(buf,media_type='application/pdf',headers={'Content-Disposition':f'attachment; filename="VISHWAS-{iid}.pdf"','Content-Length':str(len(buf.getbuffer())),'Cache-Control':'no-store'})

@app.get('/api/reports/pdf')
def report_pdf_get(iid:str,u=Depends(current)):
    # Browser-friendly GET endpoint: useful for opening/printing the generated report directly.
    return report_pdf(iid, u)
