<?php
/* Login. */
$err = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  require_csrf();
  $email = trim(isset($_POST['email']) ? (string)$_POST['email'] : '');
  $password = isset($_POST['password']) ? (string)$_POST['password'] : '';
  $st = $pdo->prepare("SELECT * FROM users WHERE email = ?");
  $st->execute([$email]);
  $user = $st->fetch(PDO::FETCH_ASSOC);
  if ($user && password_verify($password, $user['password_hash'])) {
    login_user($user);
    redirect($user['role'] === 'owner' ? 'today' : 'service');
  }
  $err = 'Email or password did not match. Try again.';
}
page_head('Log in');
?>
<h1>Log in</h1>
<?php if ($err): ?><div class="flash err"><?php echo e($err); ?></div><?php endif; ?>
<form method="post" action="?p=login">
  <?php echo csrf_field(); ?>
  <label for="email">Email</label>
  <input id="email" type="email" name="email" required autocomplete="email">
  <label for="password">Password</label>
  <input id="password" type="password" name="password" required autocomplete="current-password">
  <button class="btn" type="submit">Log in</button>
</form>
<p><a href="?p=forgot">Forgot your password?</a></p>
<p class="muted">New here? <a href="?p=signup">Get started</a></p>
<div class="card">
  <h3>Demo logins</h3>
  <p><strong>Owner:</strong> owner@poopscoop.demo / demo1234</p>
  <p><strong>Customer:</strong> demo@poopscoop.demo / demo1234</p>
</div>
<?php page_foot(); ?>
