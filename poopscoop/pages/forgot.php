<?php
/* Forgot password: issue a token. No SMTP yet, so the reset link is
   shown on screen and labeled demo mode (see README.md follow-up). */
$shownLink = '';
$sent = false;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  require_csrf();
  $email = trim(isset($_POST['email']) ? (string)$_POST['email'] : '');
  $st = $pdo->prepare("SELECT * FROM users WHERE email = ?");
  $st->execute([$email]);
  $user = $st->fetch(PDO::FETCH_ASSOC);
  if ($user) {
    $token = bin2hex(random_bytes(32));
    $hash = hash('sha256', $token);
    $exp = date('Y-m-d H:i:s', time() + 3600);
    // Portable upsert (works on SQLite and MySQL alike).
    $chk = $pdo->prepare("SELECT COUNT(*) FROM password_resets WHERE email = ?");
    $chk->execute([$email]);
    if ((int)$chk->fetchColumn() > 0) {
      $pdo->prepare("UPDATE password_resets SET token_hash = ?, expires_at = ? WHERE email = ?")->execute([$hash, $exp, $email]);
    } else {
      $pdo->prepare("INSERT INTO password_resets (email, token_hash, expires_at) VALUES (?, ?, ?)")->execute([$email, $hash, $exp]);
    }
    $link = 'index.php?p=reset&token=' . $token;
    log_email('password_reset', $email, 'Reset your password — ' . business_name(),
      "Use this link within 1 hour to reset your password:\n" . $link);
    $shownLink = $link;
  }
  $sent = true;
}
page_head('Forgot password');
?>
<h1>Forgot your password?</h1>
<?php if ($sent): ?>
  <div class="flash ok">If that email has an account, a reset link was created (valid 1 hour).</div>
  <?php if ($shownLink): ?>
  <div class="notice"><strong>Demo mode — no email is sent yet.</strong><br>Your reset link:<br>
  <a href="<?php echo e($shownLink); ?>"><?php echo e($shownLink); ?></a></div>
  <?php endif; ?>
<?php else: ?>
<form method="post" action="?p=forgot">
  <?php echo csrf_field(); ?>
  <label for="email">Email</label>
  <input id="email" type="email" name="email" required autocomplete="email">
  <button class="btn" type="submit">Send reset link</button>
</form>
<?php endif; ?>
<p><a href="?p=login">Back to log in</a></p>
<?php page_foot(); ?>
