<?php
/* Signup: one page — account + yard + plan + demo card.
   No real charging. Creates user + customer + first scheduled visit,
   logs welcome + owner-alert emails, auto-logs in. */
$plans = get_plans();
$errors = [];
$vals = ['email' => '', 'name' => '', 'address' => '', 'phone' => '', 'dogs' => 2, 'gate_code' => '', 'dogs_in_yard' => 0, 'pref_day' => 'Tue', 'plan_key' => 'weekly'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  require_csrf();
  foreach (array_keys($vals) as $k) {
    if (isset($_POST[$k])) $vals[$k] = is_string($_POST[$k]) ? trim($_POST[$k]) : $_POST[$k];
  }
  $password = isset($_POST['password']) ? (string)$_POST['password'] : '';
  $card = preg_replace('/\D/', '', isset($_POST['card_number']) ? (string)$_POST['card_number'] : '');
  $vals['dogs'] = max(1, (int)$vals['dogs']);
  $vals['dogs_in_yard'] = isset($_POST['dogs_in_yard']) && $_POST['dogs_in_yard'] === '1' ? 1 : 0;

  if (!filter_var($vals['email'], FILTER_VALIDATE_EMAIL)) $errors[] = 'Enter a valid email address.';
  if (strlen($password) < 8) $errors[] = 'Password must be at least 8 characters.';
  if ($vals['name'] === '') $errors[] = 'Enter your name.';
  if ($vals['address'] === '') $errors[] = 'Enter your service address.';
  if (!in_array($vals['pref_day'], ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], true)) $errors[] = 'Pick a cleanup day.';
  if (!get_plan($vals['plan_key'])) $errors[] = 'Pick a plan.';
  if (strlen($card) < 15 || strlen($card) > 16) $errors[] = 'Enter a 15–16 digit test card number (demo mode — nothing is charged).';
  if (!$errors) {
    $chk = $pdo->prepare("SELECT COUNT(*) FROM users WHERE email = ?");
    $chk->execute([$vals['email']]);
    if ((int)$chk->fetchColumn() > 0) $errors[] = 'That email already has an account. Try logging in.';
  }

  if (!$errors) {
    $plan = get_plan($vals['plan_key']);
    $first = next_occurrence($vals['pref_day']);
    $pdo->beginTransaction();
    try {
      $st = $pdo->prepare("INSERT INTO users (email, password_hash, role, name, phone) VALUES (?, ?, 'customer', ?, ?)");
      $st->execute([$vals['email'], password_hash($password, PASSWORD_DEFAULT), $vals['name'], $vals['phone']]);
      $userId = (int)$pdo->lastInsertId();
      $st = $pdo->prepare("INSERT INTO customers (user_id, address, dogs, gate_code, dogs_in_yard, pref_day, plan_key, price_per_visit, status, is_new, first_visit_date, next_visit_date, card_last4, card_brand, card_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?, ?, ?, 'ok')");
      $st->execute([$userId, $vals['address'], $vals['dogs'], $vals['gate_code'], $vals['dogs_in_yard'], $vals['pref_day'], $vals['plan_key'], (float)$plan['price_per_visit'], $first, $first, substr($card, -4), card_brand_from_number($card)]);
      $custId = (int)$pdo->lastInsertId();
      $pdo->commit();
    } catch (Exception $ex) {
      $pdo->rollBack();
      $errors[] = 'Signup failed — please try again.';
    }
    if (!$errors) {
      ensure_week_visits($pdo, monday_of(today_str()));
      ensure_week_visits($pdo, monday_of(add_days(today_str(), 7)));
      refresh_next_visit($pdo, $custId);
      $cust = customer_with_user($pdo, $custId);
      send_welcome_email($cust);
      send_owner_alert('New customer: ' . $cust['name'],
        $cust['name'] . ' signed up (' . $plan['name'] . ', ' . money($plan['price_per_visit']) . '/visit). First visit ' . fmt_date($cust['first_visit_date']) . '. Address: ' . $cust['address']);
      $user = $pdo->prepare("SELECT * FROM users WHERE id = ?");
      $user->execute([$userId]);
      $user = $user->fetch(PDO::FETCH_ASSOC);
      login_user($user);
      flash('Welcome! Your first cleanup is ' . fmt_date($first) . '.');
      redirect('service');
    }
  }
}

page_head('Get Started');
?>
<h1>Get Started</h1>
<div class="notice"><strong>TEST MODE — no real card is charged.</strong> Enter any 15–16 digit number as the card (e.g. 4242 4242 4242 4242). Billing is demo-only until Stripe is connected.</div>
<?php if ($errors): ?>
<div class="flash err"><?php echo implode('<br>', array_map('e', $errors)); ?></div>
<?php endif; ?>
<form method="post" action="?p=signup">
  <?php echo csrf_field(); ?>
  <h2>Your account</h2>
  <label for="email">Email</label>
  <input id="email" type="email" name="email" required value="<?php echo e($vals['email']); ?>" autocomplete="email">
  <label for="password">Password (8+ characters)</label>
  <input id="password" type="password" name="password" required minlength="8" autocomplete="new-password">
  <label for="name">Your name</label>
  <input id="name" type="text" name="name" required value="<?php echo e($vals['name']); ?>" autocomplete="name">
  <label for="phone">Phone</label>
  <input id="phone" type="tel" name="phone" value="<?php echo e($vals['phone']); ?>" autocomplete="tel">

  <h2>Your yard</h2>
  <label for="address">Service address</label>
  <input id="address" type="text" name="address" required value="<?php echo e($vals['address']); ?>" autocomplete="street-address">
  <label for="dogs">How many dogs?</label>
  <input id="dogs" type="number" name="dogs" min="1" max="20" value="<?php echo (int)$vals['dogs']; ?>">
  <label for="gate_code">Gate code / lock note</label>
  <input id="gate_code" type="text" name="gate_code" value="<?php echo e($vals['gate_code']); ?>" placeholder="e.g. Side gate, code 1234">
  <label for="dogs_in_yard">Are the dogs usually in the yard?</label>
  <select id="dogs_in_yard" name="dogs_in_yard">
    <option value="0" <?php echo $vals['dogs_in_yard'] ? '' : 'selected'; ?>>No — dogs are inside</option>
    <option value="1" <?php echo $vals['dogs_in_yard'] ? 'selected' : ''; ?>>Yes — dogs in the yard</option>
  </select>
  <label for="pref_day">Preferred cleanup day</label>
  <select id="pref_day" name="pref_day">
    <?php foreach (['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] as $d): ?>
    <option value="<?php echo $d; ?>" <?php echo $vals['pref_day'] === $d ? 'selected' : ''; ?>><?php echo $d; ?></option>
    <?php endforeach; ?>
  </select>

  <h2>Pick a plan</h2>
  <div class="plan-grid">
    <?php foreach ($plans as $pl): ?>
    <label class="plan">
      <input type="radio" name="plan_key" value="<?php echo e($pl['key']); ?>" <?php echo $vals['plan_key'] === $pl['key'] ? 'checked' : ''; ?>>
      <strong><?php echo e($pl['name']); ?></strong><br>
      <span class="price"><?php echo money($pl['price_per_visit']); ?></span><span class="per"> / visit</span><br>
      <span class="muted"><?php echo e($pl['blurb']); ?></span>
    </label>
    <?php endforeach; ?>
  </div>
  <p>Your first cleanup: <strong id="firstVisit">—</strong></p>

  <h2>Card (demo — not charged)</h2>
  <label for="card_number">Card number (any 15–16 digit test number)</label>
  <input id="card_number" type="text" name="card_number" inputmode="numeric" autocomplete="cc-number" placeholder="4242 4242 4242 4242" required>

  <button class="btn" type="submit">Start My Service</button>
  <p class="muted">Already have an account? <a href="?p=login">Log in</a></p>
</form>
<script>
(function () {
  var daySel = document.getElementById('pref_day');
  var out = document.getElementById('firstVisit');
  var names = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  function upd() {
    var want = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].indexOf(daySel.value) + 1; // Mon=1..Sun=7
    var now = new Date();
    var have = now.getDay() === 0 ? 7 : now.getDay();
    var delta = (want - have + 7) % 7;
    var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + delta);
    out.textContent = names[d.getDay()] + ', ' + d.toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'});
  }
  daySel.addEventListener('change', upd);
  upd();
})();
</script>
<?php page_foot(); ?>
