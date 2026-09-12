# VISHWAS AI — SIH26034 Legal Metrology Compliance Checker

A full-stack college prototype for image-led packaged-commodity inspection. It uses real server-side accounts, Product Head product registration, OCR, visual reference matching, a Legal Metrology (Packaged Commodities) Rules 2011 baseline, admin verification, company alerts and unique PDF inspection reports.

## Roles
- **Admin** — creates real accounts, reviews OCR/rule evidence, verifies or rejects findings, triggers company alerts.
- **Inspector** — uploads/captures package evidence and runs inspection.
- **Product Head** — registers a product/company, stores front/back/side/reference images and receives company alerts.

## No hard-coded demo login
On first run the login screen automatically becomes **one-time administrator setup**. Create the first real administrator. Then sign in and create the Inspector/Product Head accounts from User Administration.

## Dataset
The supplied `Dataset(1).zip` images are included under `public/dataset/` for testing. They are not treated as authoritative commercial packaging. Register the real images in Product Registry so the Product Head profile becomes the visual reference used for matching.

## Legal basis
The compliance baseline follows the Legal Metrology (Packaged Commodities) Rules, 2011, especially Rule 6 declaration checks. The Department of Consumer Affairs also publishes later amendments, so this prototype explicitly treats its output as preliminary support and not a statutory enforcement decision.

## Run
### Frontend
```powershell
cd sih
npm install
npm run dev
```

### Backend
```powershell
cd sih/backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

Linux/macOS:
```bash
cd sih/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

Frontend expects backend at `http://localhost:8001`. Override with `VITE_API_URL` if needed.

## OCR
The backend uses Tesseract through `pytesseract`. Install the Tesseract executable on the machine if it is not already available and ensure it is on PATH.

## Email
Company alerts are always stored in the Product Head dashboard. Real SMTP delivery is optional and only occurs when `SMTP_HOST` is configured. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` and optionally `SMTP_FROM` in the backend environment.

## Important prototype boundary
An image-only OCR system cannot prove every legal requirement (for example, physical quantity verification or facts not visible in the image). The system therefore records AI/OCR findings, routes them to Admin verification, and labels the result as preliminary. Current amendments and commodity-specific rules must be verified by the competent Legal Metrology authority before real-world action.


## Strict registered-image inspection behavior

For the requested demo workflow, product identity is determined **only from Product Head reference images**. OCR text is evidence shown from the submitted inspection image; it is not used to identify a product.

- Exact SHA-256 match to any registered reference image -> **COMPLIANT / PASS**.
- A near-identical re-encoded/resized copy must also satisfy a strict perceptual + ORB threshold.
- A different or unregistered image -> **NON-COMPLIANT / FAIL** and is saved for Admin review.
- Every inspection report is routed to Admin. Product Head/company notifications are created only when the finding is FAIL.
- No product is fabricated from an OCR name match.
