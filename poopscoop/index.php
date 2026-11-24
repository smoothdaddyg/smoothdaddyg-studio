<?php
/* Cedar Park Poop Scoop — front controller.
   Routes ?p=<page> with role checks. Pages live in pages/. */
require_once __DIR__ . '/inc/bootstrap.php';

$routes = [
  'home'      => ['file' => 'home.php',      'role' => null],
  'signup'    => ['file' => 'signup.php',    'role' => null],
  'login'     => ['file' => 'login.php',     'role' => null],
  'forgot'    => ['file' => 'forgot.php',    'role' => null],
  'reset'     => ['file' => 'reset.php',     'role' => null],
  'service'   => ['file' => 'service.php',   'role' => 'customer'],
  'bills'     => ['file' => 'bills.php',     'role' => 'customer'],
  'receipt'   => ['file' => 'receipt.php',   'role' => null], // checks ownership inside
  'today'     => ['file' => 'today.php',     'role' => 'owner'],
  'customers' => ['file' => 'customers.php', 'role' => 'owner'],
  'customer'  => ['file' => 'customer.php',  'role' => 'owner'],
  'schedule'  => ['file' => 'schedule.php',  'role' => 'owner'],
  'money'     => ['file' => 'money.php',     'role' => 'owner'],
  'settings'  => ['file' => 'settings.php',  'role' => 'owner'],
];

$p = isset($_GET['p']) ? preg_replace('/[^a-z]/', '', (string)$_GET['p']) : 'home';

if ($p === 'logout') {
  logout_user();
  redirect('home');
}

if (!isset($routes[$p])) {
  http_response_code(404);
  $p = 'home';
}

$route = $routes[$p];
if ($route['role'] !== null) {
  require_role($route['role']);
}

require __DIR__ . '/pages/' . $route['file'];
