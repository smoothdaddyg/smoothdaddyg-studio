<?php
/* Cedar Park Poop Scoop — helpers (escaping, CSRF, dates, plans,
   visits, receipts, settings, layout). No output before page_head(). */

function e($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function money($n) { return '$' . number_format((float)$n, 2); }
function today_str() { return date('Y-m-d'); }
function fmt_date($d) {
  if (!$d) return '—';
  $t = strtotime($d);
  return $t ? date('D, M j, Y', $t) : e($d);
}
function fmt_short($d) {
  if (!$d) return '—';
  $t = strtotime($d);
  return $t ? date('D M j', $t) : e($d);
}

/* ---------- flash messages ---------- */
function flash($msg, $type = 'ok') {
  $_SESSION['flash'] = ['msg' => $msg, 'type' => $type];
}
function pop_flash() {
  $f = isset($_SESSION['flash']) ? $_SESSION['flash'] : null;
  unset($_SESSION['flash']);
  return $f;
}

/* ---------- CSRF ---------- */
function csrf_token() {
  if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
  return $_SESSION['csrf'];
}
function csrf_field() {
  return '<input type="hidden" name="csrf" value="' . e(csrf_token()) . '">';
}
function require_csrf() {
  $t = isset($_POST['csrf']) ? (string)$_POST['csrf'] : '';
  if (!hash_equals(csrf_token(), $t)) {
    http_response_code(403);
    exit('Bad request (CSRF). Please go back and try again.');
  }
}

/* ---------- settings / plans ---------- */
function setting($key, $default = '') {
  static $cache = null;
  if ($cache === null) {
    $cache = [];
    try {
      foreach (pdo()->query("SELECT `key`, value FROM settings")->fetchAll(PDO::FETCH_KEY_PAIR) as $k => $v) $cache[$k] = $v;
    } catch (Exception $ex) { /* table may not exist yet during install */ }
  }
  return array_key_exists($key, $cache) ? $cache[$key] : $default;
}
function set_setting($key, $value) {
  $pdo = pdo();
  $exists = $pdo->prepare("SELECT COUNT(*) FROM settings WHERE `key` = ?");
  $exists->execute([$key]);
  if ((int)$exists->fetchColumn() > 0) {
    $st = $pdo->prepare("UPDATE settings SET value = ? WHERE `key` = ?");
    $st->execute([(string)$value, $key]);
  } else {
    $st = $pdo->prepare("INSERT INTO settings (`key`, value) VALUES (?, ?)");
    $st->execute([$key, (string)$value]);
  }
}
function get_plans() {
  return pdo()->query("SELECT * FROM plans ORDER BY sort_order, `key`")->fetchAll(PDO::FETCH_ASSOC);
}
function get_plan($key) {
  $st = pdo()->prepare("SELECT * FROM plans WHERE `key` = ?");
  $st->execute([$key]);
  $p = $st->fetch(PDO::FETCH_ASSOC);
  return $p ? $p : null;
}
function business_name() { return setting('business_name', 'Cedar Park Poop Scoop'); }

/* ---------- cards ---------- */
function card_brand_from_number($num) {
  $d = preg_replace('/\D/', '', (string)$num);
  $first = substr($d, 0, 1);
  if ($first === '4') return 'Visa';
  if ($first === '5') return 'Mastercard';
  if ($first === '3') return 'Amex';
  if ($first === '6') return 'Discover';
  return 'Card';
}

/* ---------- weekday helpers ---------- */
function day_num($day3) {
  $map = ['Mon' => 1, 'Tue' => 2, 'Wed' => 3, 'Thu' => 4, 'Fri' => 5, 'Sat' => 6, 'Sun' => 7];
  return isset($map[$day3]) ? $map[$day3] : 2;
}
function day3_from_num($n) {
  $map = [1 => 'Mon', 2 => 'Tue', 3 => 'Wed', 4 => 'Thu', 5 => 'Fri', 6 => 'Sat', 7 => 'Sun'];
  return isset($map[$n]) ? $map[$n] : 'Tue';
}
function monday_of($date) {
  $t = strtotime($date);
  $dow = (int)date('N', $t); // Mon=1..Sun=7
  return date('Y-m-d', $t - ($dow - 1) * 86400);
}
function add_days($date, $n) { return date('Y-m-d', strtotime($date) + $n * 86400); }
function next_occurrence($day3, $from = null) {
  $from = $from ? $from : today_str();
  $want = day_num($day3);
  $have = (int)date('N', strtotime($from));
  $delta = ($want - $have + 7) % 7;
  return add_days($from, $delta);
}
/* Due dates for one customer inside the week starting $monday. */
function due_dates_in_week($cust, $monday) {
  $plan = $cust['plan_key'];
  $pref = $cust['pref_day'];
  $dates = [];
  if ($plan === 'one-time') {
    if (!empty($cust['first_visit_date'])) {
      $d = $cust['first_visit_date'];
      if ($d >= $monday && $d <= add_days($monday, 6)) $dates[] = $d;
    }
    return $dates;
  }
  if ($plan === 'weekly' || $plan === 'twice') {
    $dates[] = add_days($monday, day_num($pref) - 1);
    if ($plan === 'twice') {
      $second = day_num($pref) + 3;
      if ($second > 7) $second -= 7;
      $dates[] = add_days($monday, $second - 1);
    }
    return $dates;
  }
  if ($plan === 'biweekly') {
    $anchor = !empty($cust['first_visit_date']) ? monday_of($cust['first_visit_date']) : monday_of($cust['created_at'] ? substr($cust['created_at'], 0, 10) : today_str());
    $weeks = (int)round((strtotime($monday) - strtotime($anchor)) / (7 * 86400));
    if ($weeks % 2 === 0) $dates[] = add_days($monday, day_num($pref) - 1);
    return $dates;
  }
  return $dates;
}

/* Create scheduled-visit rows for a week if they do not exist yet.
   Paused customers get status 'paused' so the week view greys them. */
function ensure_week_visits($pdo, $monday) {
  $custs = $pdo->query("SELECT * FROM customers WHERE status != 'cancelled'")->fetchAll(PDO::FETCH_ASSOC);
  foreach ($custs as $c) {
    foreach (due_dates_in_week($c, $monday) as $d) {
      $chk = $pdo->prepare("SELECT COUNT(*) FROM visits WHERE customer_id = ? AND visit_date = ?");
      $chk->execute([$c['id'], $d]);
      if ((int)$chk->fetchColumn() === 0) {
        $st = $pdo->prepare("INSERT INTO visits (customer_id, visit_date, status, amount) VALUES (?, ?, ?, ?)");
        $st->execute([$c['id'], $d, $c['status'] === 'paused' ? 'paused' : 'scheduled', (float)$c['price_per_visit']]);
      }
    }
  }
}
function refresh_next_visit($pdo, $customer_id) {
  ensure_week_visits($pdo, monday_of(today_str()));
  ensure_week_visits($pdo, monday_of(add_days(today_str(), 7)));
  $st = $pdo->prepare("SELECT MIN(visit_date) FROM visits WHERE customer_id = ? AND status = 'scheduled' AND visit_date >= ?");
  $st->execute([$customer_id, today_str()]);
  $next = $st->fetchColumn();
  $up = $pdo->prepare("UPDATE customers SET next_visit_date = ? WHERE id = ?");
  $up->execute([$next ? $next : null, $customer_id]);
  return $next ? $next : null;
}
function customer_by_user($pdo, $user_id) {
  $st = $pdo->prepare("SELECT * FROM customers WHERE user_id = ?");
  $st->execute([$user_id]);
  return $st->fetch(PDO::FETCH_ASSOC);
}
function customer_with_user($pdo, $customer_id) {
  $st = $pdo->prepare("SELECT c.*, u.name, u.email, u.phone FROM customers c JOIN users u ON u.id = c.user_id WHERE c.id = ?");
  $st->execute([$customer_id]);
  return $st->fetch(PDO::FETCH_ASSOC);
}

/* ---------- receipts ---------- */
function next_receipt_no($pdo) {
  $n = (int)$pdo->query("SELECT COUNT(*) FROM charges")->fetchColumn() + 1;
  for ($i = 0; $i < 50; $i++) {
    $no = 'CPS-' . date('Y') . '-' . str_pad($n + $i, 4, '0', STR_PAD_LEFT);
    $chk = $pdo->prepare("SELECT COUNT(*) FROM charges WHERE receipt_no = ?");
    $chk->execute([$no]);
    if ((int)$chk->fetchColumn() === 0) return $no;
  }
  return 'CPS-' . date('YmdHis') . '-' . bin2hex(random_bytes(3));
}

/* ---------- layout ---------- */
function page_head($title) {
  $u = current_user();
  $name = business_name();
  $nav = '';
  if ($u) {
    if ($u['role'] === 'owner') {
      $nav = '<a href="?p=today">Today</a><a href="?p=customers">Customers</a><a href="?p=schedule">Schedule</a><a href="?p=money">Money</a><a href="?p=settings">Settings</a>';
    } else {
      $nav = '<a href="?p=service">My Service</a><a href="?p=bills">My Bills</a>';
    }
    $nav .= '<a href="?p=logout">Log out</a>';
  } else {
    $nav = '<a href="?p=login">Log in</a><a class="btn-small" href="?p=signup">Get Started</a>';
  }
  $f = pop_flash();
  $flashHtml = '';
  if ($f) $flashHtml = '<div class="flash ' . e($f['type']) . '">' . e($f['msg']) . '</div>';
  echo '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
    . '<meta name="viewport" content="width=device-width, initial-scale=1">'
    . '<title>' . e($title) . ' — ' . e($name) . '</title>'
    . '<link rel="stylesheet" href="assets/style.css?v=20261124"></head><body>'
    . '<header class="topbar"><div class="wrap topbar-in">'
    . '<a class="brand" href="?p=home">&#128054; ' . e($name) . '</a>'
    . '<nav class="nav">' . $nav . '</nav>'
    . '</div></header><main class="wrap">'
    . $flashHtml;
}
function page_foot() {
  $name = business_name();
  echo '</main><footer class="footer"><div class="wrap">'
    . '<p>' . e($name) . ' &middot; ' . e(setting('service_area', 'Cedar Park &amp; North Austin'))
    . ' &middot; ' . e(setting('business_phone', '')) . ' &middot; ' . e(setting('business_email', ''))
    . '</p><p class="muted">Demo mode: no real card is ever charged. Contact: bob-sdg@muse.ai</p>'
    . '</div></footer></body></html>';
}
function redirect($p) {
  header('Location: ?p=' . $p);
  exit;
}
