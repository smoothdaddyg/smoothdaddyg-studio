-- Cedar Park Poop Scoop — MySQL schema (Hostinger / hPanel import)
-- Import into an empty MySQL 8 database, then point inc/config.php at it.
-- The SQLite twin of this file is inc/schema-sqlite.sql.

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('customer','owner') NOT NULL DEFAULT 'customer',
  name VARCHAR(255) NOT NULL DEFAULT '',
  phone VARCHAR(40) NOT NULL DEFAULT '',
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS plans (
  `key` VARCHAR(20) NOT NULL,
  name VARCHAR(80) NOT NULL,
  price_per_visit DECIMAL(6,2) NOT NULL,
  blurb VARCHAR(255) NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS customers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  address VARCHAR(255) NOT NULL DEFAULT '',
  dogs INT NOT NULL DEFAULT 1,
  gate_code VARCHAR(255) NOT NULL DEFAULT '',
  dogs_in_yard TINYINT(1) NOT NULL DEFAULT 0,
  pref_day VARCHAR(3) NOT NULL DEFAULT 'Tue',
  plan_key VARCHAR(20) NOT NULL DEFAULT 'weekly',
  price_per_visit DECIMAL(6,2) NOT NULL DEFAULT 20.00,
  status ENUM('active','paused','past_due','cancelled') NOT NULL DEFAULT 'active',
  is_new TINYINT(1) NOT NULL DEFAULT 1,
  first_visit_date DATE NULL,
  next_visit_date DATE NULL,
  card_last4 CHAR(4) NOT NULL DEFAULT '',
  card_brand VARCHAR(20) NOT NULL DEFAULT '',
  card_status ENUM('ok','failed') NOT NULL DEFAULT 'ok',
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customers_user (user_id),
  KEY idx_customers_status (status),
  KEY idx_customers_next (next_visit_date),
  CONSTRAINT fk_customers_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_customers_plan FOREIGN KEY (plan_key) REFERENCES plans (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS visits (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id INT UNSIGNED NOT NULL,
  visit_date DATE NOT NULL,
  status ENUM('scheduled','done','skipped','paused') NOT NULL DEFAULT 'scheduled',
  amount DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  charge_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_visits_customer_date (customer_id, visit_date),
  KEY idx_visits_date (visit_date),
  CONSTRAINT fk_visits_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS charges (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id INT UNSIGNED NOT NULL,
  visit_id INT UNSIGNED NULL,
  amount DECIMAL(6,2) NOT NULL,
  status ENUM('paid','failed') NOT NULL DEFAULT 'paid',
  receipt_no VARCHAR(40) NOT NULL,
  card_last4 CHAR(4) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_charges_receipt (receipt_no),
  KEY idx_charges_customer (customer_id),
  KEY idx_charges_created (created_at),
  CONSTRAINT fk_charges_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS email_log (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  kind VARCHAR(40) NOT NULL,
  to_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_email_log_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS settings (
  `key` VARCHAR(60) NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS password_resets (
  email VARCHAR(255) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  PRIMARY KEY (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
