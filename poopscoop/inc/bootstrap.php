<?php
/* Cedar Park Poop Scoop — bootstrap. Loaded by index.php.
   Starts the 30-day session, wires the PDO layer, then auth/helpers. */
date_default_timezone_set('America/Chicago');

session_set_cookie_params([
  'lifetime' => 30 * 86400, // ~30 days, "stay signed in"
  'path' => '/',
  'httponly' => true,
  'samesite' => 'Lax',
]);
ini_set('session.gc_maxlifetime', 30 * 86400);
session_start();

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/mail.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/db.php';

$pdo = pdo();
