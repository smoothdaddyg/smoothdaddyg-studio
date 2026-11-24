<?php
/* Cedar Park Poop Scoop — auth. Sessions last ~30 days ("stay signed in"). */

function current_user() {
  if (empty($_SESSION['user_id'])) return null;
  $st = pdo()->prepare("SELECT * FROM users WHERE id = ?");
  $st->execute([(int)$_SESSION['user_id']]);
  $u = $st->fetch(PDO::FETCH_ASSOC);
  return $u ? $u : null;
}

function login_user($user) {
  session_regenerate_id(true);
  $_SESSION['user_id'] = (int)$user['id'];
  $_SESSION['role'] = $user['role'];
}

function logout_user() {
  $_SESSION = [];
  if (ini_get('session.use_cookies')) {
    $p = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
  }
  session_destroy();
}

function require_login() {
  if (!current_user()) { redirect('login'); }
}

function require_role($role) {
  $u = current_user();
  if (!$u) redirect('login');
  if ($u['role'] !== $role) {
    http_response_code(403);
    exit('This page is for ' . e($role) . 's only.');
  }
  return $u;
}
