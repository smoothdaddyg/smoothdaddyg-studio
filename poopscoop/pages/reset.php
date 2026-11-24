<?php
/* Reset password via token (?p=reset&token=...). */
$token = isset($_GET['token']) ? (string)$_GET['token'] : '';
$hash = hash('sha256', $token);
$st = $pdo->prepare("SELECT * FROM password_resets WHERE token_hash = ? AND expires_at > ?");
$st->execute([$hash, date('Y-m-d H:i:s')]);
$row = $st->fetch(PDO::FETCH_ASSOC);
$err = '';
if (!$row) {
  page_head('Reset password');
  echo '<h1>Reset password</h1><div class="flash err">That reset link is invalid or expired. Request a new one.</div><p><a href="?p=forgot">Forgot password</a></p>';
  page_foot();
  return;
}
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  require_csrf();
  $pw = isset($_POST['password']) ? (string)$_POST['password'] : '';
  if (strlen($pw) < 8) {
    $err = 'Password must be at least 8 characters.';
  } else {
    $pdo->prepare("UPDATE users SET password_hash = ? WHERE email = ?")->execute([password_hash($pw, PASSWORD_DEFAULT), $row['email']]);
    $pdo->prepare("DELETE FROM password_resets WHERE email = ?")->execute([$row['email']]);
    flash('Password updated — log in with your new password.');
    redirect('login');
  }
}
page_head('Reset password');
?>
<h1>Choose a new password</h1>
<?php if ($err): ?><div class="flash err"><?php echo e($err); ?></div><?php endif; ?>
<form method="post" action="?p=reset&amp;token=<?php echo e($token); ?>">
  <?php echo csrf_field(); ?>
  <label for="password">New password (8+ characters)</label>
  <input id="password" type="password" name="password" required minlength="8" autocomplete="new-password">
  <button class="btn" type="submit">Set new password</button>
</form>
<?php page_foot(); ?>
