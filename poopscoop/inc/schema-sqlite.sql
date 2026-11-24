-- Cedar Park Poop Scoop — SQLite schema (interim backend)
-- Same tables as inc/schema-mysql.sql, SQLite dialect:
-- AUTO_INCREMENT -> AUTOINCREMENT, ENUM -> TEXT (validated in PHP).

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer',
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS plans (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_per_visit REAL NOT NULL,
  blurb TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  dogs INTEGER NOT NULL DEFAULT 1,
  gate_code TEXT NOT NULL DEFAULT '',
  dogs_in_yard INTEGER NOT NULL DEFAULT 0,
  pref_day TEXT NOT NULL DEFAULT 'Tue',
  plan_key TEXT NOT NULL DEFAULT 'weekly',
  price_per_visit REAL NOT NULL DEFAULT 20.00,
  status TEXT NOT NULL DEFAULT 'active',
  is_new INTEGER NOT NULL DEFAULT 1,
  first_visit_date TEXT NULL,
  next_visit_date TEXT NULL,
  card_last4 TEXT NOT NULL DEFAULT '',
  card_brand TEXT NOT NULL DEFAULT '',
  card_status TEXT NOT NULL DEFAULT 'ok',
  is_demo INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (user_id),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (plan_key) REFERENCES plans (key)
);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers (status);
CREATE INDEX IF NOT EXISTS idx_customers_next ON customers (next_visit_date);

CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  visit_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  amount REAL NOT NULL DEFAULT 0.00,
  charge_id INTEGER NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (customer_id, visit_date),
  FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits (visit_date);

CREATE TABLE IF NOT EXISTS charges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  visit_id INTEGER NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid',
  receipt_no TEXT NOT NULL,
  card_last4 TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (receipt_no),
  FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_charges_customer ON charges (customer_id);
CREATE INDEX IF NOT EXISTS idx_charges_created ON charges (created_at);

CREATE TABLE IF NOT EXISTS email_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_email_log_created ON email_log (created_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS password_resets (
  email TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
