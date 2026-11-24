<?php
/* Customer — My Service. */
$u = current_user();
$cust = customer_by_user($pdo, (int)$u['id']);
if (!$cust) { flash('No customer record found for this account.', 'err'); redirect('home'); }
refresh_next_visit($pdo, (int)$cust['id']);
$cust = customer_by_user($pdo, (int)$u['id']);
$plan = get_plan($cust['plan_key']);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  require_csrf();
  $action = isset($_POST['action']) ? (string)$_POST['action'] : '';
  if ($action === 'skip') {
    $st = $pdo->prepare("SELECT * FROM visits WHERE customer_id = ? AND status = 'scheduled' AND visit_date >= ? ORDER BY visit_date LIMIT 1");
    $st->execute([$cust['id'], today_str()]);
    $v = $st->fetch(PDO::FETCH_ASSOC);
    if ($v) {
      $pdo->prepare("UPDATE visits SET status = 'skipped' WHERE id = ?")->execute([$v['id']]);
      send_owner_alert('Skip: ' . $u['name'] . ' skipped ' . fmt_date($v['visit_date']),
        $u['name'] . ' (' . $cust['address'] . ') skipped the visit on ' . fmt_date($v['visit_date']) . '.');
      flash('Skipped your visit on ' . fmt_date($v['visit_date']) . '.');
    } else {
      flash('No upcoming visit to skip.', 'err');
    }
    refresh_next_visit($pdo, (int)$cust['id']);
    redirect('service');
  }
  if ($action === 'pause' || $action === 'resume') {
    $new = $action === 'pause' ? 'paused' : 'active';
    $pdo->prepare("UPDATE customers SET status = ? WHERE id = ?")->execute([$new, $cust['id']]);
    if ($new === 'paused') {
      $pdo->prepare("UPDATE visits SET status = 'paused' WHERE customer_id = ? AND status = 'scheduled' AND visit_date >= ?")->execute([$cust['id'], today_str()]);
    } else {
      $pdo->prepare("UPDATE visits SET status = 'scheduled' WHERE customer_id = ? AND status = 'paused' AND visit_date >= ?")->execute([$cust['id'], today_str()]);
    }
    send_owner_alert(($new === 'paused' ? 'Paused: ' : 'Resumed: ') . $u['name'],
      $u['name'] . ' ' . ($new === 'paused' ? 'paused' : 'resumed') . ' their service.');
    flash($new === 'paused' ? 'Service paused. We will not come until you resume.' : 'Service resumed — welcome back!');
    refresh_next_visit($pdo, (int)$cust['id']);
    redirect('service');
  }
  if ($action === 'update_card') {
    $card = preg_replace('/\D/', '', isset($_POST['card_number']) ? (string)$_POST['card_number'] : '');
    if (strlen($card) < 15 || strlen($card) > 16) {
      flash('Enter a 15–16 digit test card number.', 'err');
    } else {
      $pdo->prepare("UPDATE customers SET card_last4 = ?, card_brand = ?, card_status = 'ok' WHERE id = ?")
        ->execute([substr($card, -4), card_brand_from_number($card), $cust['id']]);
      flash('Card updated (' . card_brand_from_number($card) . ' •••• ' . substr($card, -4) . '). Demo mode — nothing was charged.');
    }
    redirect('service');
  }
  if ($action === 'update_details') {
    $addr = trim(isset($_POST['address']) ? (string)$_POST['address'] : '');
    $dogs = max(1, (int)(isset($_POST['dogs']) ? $_POST['dogs'] : 1));
    $gate = trim(isset($_POST['gate_code']) ? (string)$_POST['gate_code'] : '');
    $inYard = isset($_POST['dogs_in_yard']) && $_POST['dogs_in_yard'] === '1' ? 1 : 0;
    $notes = trim(isset($_POST['notes']) ? (string)$_POST['notes'] : '');
    if ($addr === '') {
      flash('Address cannot be blank.', 'err');
    } else {
      $pdo->prepare("UPDATE customers SET address = ?, dogs = ?, gate_code = ?, dogs_in_yard = ?, notes = ? WHERE id = ?")
        ->execute([$addr, $dogs, $gate, $inYard, $notes, $cust['id']]);
      flash('Yard details saved.');
    }
    redirect('service');
  }
}

page_head('My Service');
?>
<h1>My Service</h1>
<?php if ($cust['card_status'] === 'failed'): ?>
<div class="banner">Your card did not go through — <a href="#update-card">update it here</a>.</div>
<?php endif; ?>
<?php if ($cust['status'] === 'paused'): ?>
<div class="notice"><strong>Service is paused.</strong> We will not come until you resume below.</div>
<?php endif; ?>

<div class="card">
  <div class="muted">Next cleanup</div>
  <div class="big-date"><?php echo $cust['next_visit_date'] ? fmt_date($cust['next_visit_date']) : 'No visit scheduled'; ?></div>
  <p><strong><?php echo e($plan ? $plan['name'] : $cust['plan_key']); ?></strong> — <?php echo money($cust['price_per_visit']); ?> per visit<br>
  <?php echo e($cust['address']); ?><br>
  <?php echo (int)$cust['dogs']; ?> dog<?php echo (int)$cust['dogs'] === 1 ? '' : 's'; ?> &middot; Card: <?php echo e($cust['card_brand']); ?> &bull;&bull;&bull;&bull; <?php echo e($cust['card_last4']); ?></p>
</div>

<form method="post" action="?p=service">
  <?php echo csrf_field(); ?>
  <input type="hidden" name="action" value="skip">
  <button class="btn secondary" type="submit">Skip Next Visit</button>
</form>
<form method="post" action="?p=service">
  <?php echo csrf_field(); ?>
  <input type="hidden" name="action" value="<?php echo $cust['status'] === 'paused' ? 'resume' : 'pause'; ?>">
  <button class="btn secondary" type="submit"><?php echo $cust['status'] === 'paused' ? 'Resume Service' : 'Pause Service'; ?></button>
</form>
<a class="btn secondary" href="#update-card">Update Card</a>
<p><a class="btn secondary" href="?p=bills">My Bills</a></p>

<div class="card" id="update-card">
  <h2>Update Card</h2>
  <p class="muted">Demo mode — any 15–16 digit test number; nothing is charged.</p>
  <form method="post" action="?p=service">
    <?php echo csrf_field(); ?>
    <input type="hidden" name="action" value="update_card">
    <label for="card_number">New card number</label>
    <input id="card_number" type="text" name="card_number" inputmode="numeric" autocomplete="cc-number" placeholder="4242 4242 4242 4242" required>
    <button class="btn" type="submit">Save Card</button>
  </form>
</div>

<div class="card">
  <h2>Address &amp; yard notes</h2>
  <form method="post" action="?p=service">
    <?php echo csrf_field(); ?>
    <input type="hidden" name="action" value="update_details">
    <label for="address">Service address</label>
    <input id="address" type="text" name="address" required value="<?php echo e($cust['address']); ?>">
    <label for="dogs">Dogs</label>
    <input id="dogs" type="number" name="dogs" min="1" max="20" value="<?php echo (int)$cust['dogs']; ?>">
    <label for="gate_code">Gate code / lock note</label>
    <input id="gate_code" type="text" name="gate_code" value="<?php echo e($cust['gate_code']); ?>">
    <label for="dogs_in_yard">Dogs usually in the yard?</label>
    <select id="dogs_in_yard" name="dogs_in_yard">
      <option value="0" <?php echo $cust['dogs_in_yard'] ? '' : 'selected'; ?>>No — dogs are inside</option>
      <option value="1" <?php echo $cust['dogs_in_yard'] ? 'selected' : ''; ?>>Yes — dogs in the yard</option>
    </select>
    <label for="notes">Yard notes</label>
    <textarea id="notes" name="notes"><?php echo e($cust['notes']); ?></textarea>
    <button class="btn" type="submit">Save Details</button>
  </form>
</div>

<p class="muted">Questions? Call <?php echo e(setting('business_phone', '')); ?> or email <?php echo e(setting('business_email', '')); ?>.</p>
<?php page_foot(); ?>
