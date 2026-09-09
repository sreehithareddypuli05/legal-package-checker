CREATE TABLE IF NOT EXISTS users (
 id UUID PRIMARY KEY,
 name TEXT NOT NULL,
 email TEXT UNIQUE NOT NULL,
 password_hash TEXT,
 google_id TEXT UNIQUE,
 role TEXT NOT NULL CHECK (role IN ('INSPECTOR','SUPERVISOR','ADMIN')) DEFAULT 'INSPECTOR',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS inspections (
 id UUID PRIMARY KEY,
 user_id UUID REFERENCES users(id) ON DELETE SET NULL,
 brand TEXT, product_name TEXT, category TEXT, sku TEXT, barcode TEXT,
 manufacturer TEXT, retailer TEXT, location TEXT, notes TEXT,
 status TEXT NOT NULL, score NUMERIC NOT NULL, analysis JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS inspection_images (
 id UUID PRIMARY KEY,
 inspection_id UUID REFERENCES inspections(id) ON DELETE CASCADE,
 original_name TEXT NOT NULL, path TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inspections_created_at ON inspections(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inspections_status ON inspections(status);
