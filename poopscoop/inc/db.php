<?php
/* Cedar Park Poop Scoop — PDO factory.
   MySQL if inc/config.php defines PS_DB_DSN, otherwise SQLite.
   Swapping to MySQL is a one-line config change (see config.sample.php).
   On first use the schema is created and the demo data seeded. */

function pdo() {
  static $pdo = null;
  if ($pdo) return $pdo;

  $cfg = __DIR__ . '/config.php';
  if (is_file($cfg)) require_once $cfg;

  $driver = 'sqlite';
  if (defined('PS_DB_DSN') && PS_DB_DSN) {
    $driver = (stripos(PS_DB_DSN, 'mysql:') === 0) ? 'mysql' : 'sqlite';
    try {
      $pdo = new PDO(PS_DB_DSN, defined('PS_DB_USER') ? PS_DB_USER : null, defined('PS_DB_PASS') ? PS_DB_PASS : null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
      ]);
    } catch (PDOException $ex) {
      http_response_code(500);
      exit('Database connection failed. Check inc/config.php — see README.md. (' . e($ex->getMessage()) . ')');
    }
  } else {
    $path = defined('PS_SQLITE_PATH') ? PS_SQLITE_PATH : __DIR__ . '/../data/poopscoop.sqlite';
    $dir = dirname($path);
    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) {
      http_response_code(500);
      exit('Cannot create the data directory (' . e($dir) . '). Make it writable by the web server.');
    }
    if (!is_writable($dir)) {
      http_response_code(500);
      exit('The data directory (' . e($dir) . ') is not writable. Make it writable by the web server.');
    }
    try {
      $pdo = new PDO('sqlite:' . $path, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
      ]);
      $pdo->exec("PRAGMA foreign_keys = ON");
    } catch (PDOException $ex) {
      http_response_code(500);
      exit('Cannot open the SQLite database. (' . e($ex->getMessage()) . ')');
    }
  }

  // Create schema on first use.
  $hasUsers = false;
  try {
    if ($driver === 'mysql') {
      $hasUsers = (int)$pdo->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users'")->fetchColumn() > 0;
    } else {
      $hasUsers = (int)$pdo->query("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='users'")->fetchColumn() > 0;
    }
  } catch (Exception $ex) { $hasUsers = false; }
  if (!$hasUsers) {
    run_sql_file($pdo, __DIR__ . ($driver === 'mysql' ? '/schema-mysql.sql' : '/schema-sqlite.sql'));
  }

  // Seed demo data on an empty database.
  try {
    $count = (int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
  } catch (Exception $ex) { $count = 0; }
  if ($count === 0) {
    require_once __DIR__ . '/seed.php';
    seed_database($pdo);
  }

  return $pdo;
}

function run_sql_file($pdo, $path) {
  $sql = file_get_contents($path);
  if ($sql === false) throw new RuntimeException('Cannot read schema file: ' . $path);
  // Strip full-line comments first (otherwise the header comment
  // stays attached to the first statement and it gets skipped).
  $lines = explode("\n", $sql);
  $clean = [];
  foreach ($lines as $ln) {
    if (preg_match('/^\s*--/', $ln)) continue;
    $clean[] = $ln;
  }
  $sql = implode("\n", $clean);
  // Split on semicolon at end of a line; schema files contain no
  // semicolons inside string literals.
  $parts = preg_split('/;\s*\n/', $sql);
  foreach ($parts as $stmt) {
    $stmt = trim($stmt);
    if ($stmt === '') continue;
    $pdo->exec($stmt);
  }
}
