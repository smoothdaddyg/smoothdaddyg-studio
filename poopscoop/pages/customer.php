<?php
/* Owner — Customer detail: yard notes, billing history, edit day /
   price / status, mark card failed / OK. */
$u = require_role('owner');
$id = (int)(isset($_GET['id']) ? $_GET['id'] : 0);
$cust = customer_with_user($pdo, $id);
if (!$cust) { http_response_code(404); page_head('Customer'); echo '<h1>Customer not found</h1>'; page_foot(); return; }

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  require_csrf();
  $action = isset($_POST['action']) ? (string)$_POST['action'] : '';
  if ($action === 'save') {
    $day = isset($_POST['pref_day']) ? (string)$_POST['pref_day'] : $cust['pref_day'];
    $price = (float)(isset($_POST['price_per_visit']) ? $_POST['price_per_visit'] : $cust['price_per_visit']);
    $status = isset($_POST['status']) ? (string)$_POST['status'] : $cust['status'];
    $notes = trim(isset($_POST['notes']) ? (string)$_POST['notes'] : '');
    if (!in_array($day, ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], true)) $day = $cust['pref_day'];
    if (!in_array($status, ['active','paused','past_due','cancelled'], true)) $status = $cust['status'];
    if ($price <= 0) $price = (float)$cust['price_per_visit'];
    $pdo->prepare("UPDATE customers SET pref_day = ?, price_per_visit = ?, status = ?, notes = ? WHERE id = ?")
      ->execute([$day, $price, $status, $notes, $id]);
    if ($status === 'paused') {
      $pdo->prepare("UPDATE visits SET status = 'paused' WHERE customer_id = ? AND status = 'scheduled' AND visit_date >= ?")->execute([$id, today_str()]);
    } elseif ($cust['status'] === 'paused') {
      $pdo->prepare("UPDATE visits SET status = 'scheduled' WHERE customer_id = ? AND status = 'paused' AND visit_date >= ?")->execute([$id, today_str()]);
    }
    ensure_week_visits($pdo, monday_of(today_str()));
    refresh_next_visit($pdo, $id);
    flash('Saved ' . $cust['name'] . '.');
    redirect('customer&id=' . $id);
  }
  if ($action === 'card_failed' || $action === 'card_ok') {
    $new = $action === 'card_failed' ? 'failed' : 'ok';
    $pdo->prepare("UPDATE customers SET card_status = ? WHERE id = ?")->execute([$new, $id]);
    if ($new === 'failed') {
      $pdo->prepare("UPDATE customers SET status = 'past_due' WHERE id = ? AND status = 'active'")->execute([$id]);
    } elseif ($cust['status'] === 'past_due') {
      $pdo->prepare("UPDATE customers SET status = 'active' WHERE id = ?")->execute([$id]);
    }
    flash('Card marked ' . ($new === 'failed' ? 'FAILED — customer now sees the banner.' : 'OK.'));
    redirect('customer&id=' . $id);
  }
}

$cust = customer_with_user($pdo, $id);
$plan = get_plan($cust['plan_key']);
$st = $pdo->prepare("SELECT * FROM charges WHERE customer_id = ? ORDER BY created_at DESC, id DESC LIMIT 20");
$st->execute([$id]);
$charges = $st->fetchAll(PDO::FETCH_ASSOC);
$st = $pdo->prepare("SELECT * FROM visits WHERE customer_id = ? ORDER BY visit_date DESC LIMIT 12");
$st->execute([$id]);
$visits = $st->fetchAll(PDO::FETCH_ASSOC);
$totalPaid = 0.0;
foreach ($charges as $ch) if ($ch['status'] === 'paid') $totalPaid += (float)$ch['amount'];

page_head($cust['name']);
?>
<h1><?php echo e($cust['name']); ?>
  <?php if ($cust['is_new']): ?><span class="badge new">NEW</span><?php endif; ?>
  <span class="badge <?php echo e($cust['status']); ?>"><?php echo e($cust['status']); ?></span>
</h1>
<div class="card">
  <p><strong><?php echo e($plan ? $plan['name'] : $cust['plan_key']); ?></strong> — <?php echo money($cust['price_per_visit']); ?>/visit &middot; Next: <?php echo $cust['next_visit_date'] ? fmt_date($cust['next_visit_date']) : '—'; ?> &middot; First visit: <?php echo $cust['first_visit_date'] ? fmt_date($cust['first_visit_date']) : '—'; ?><br>
  <a href="https://www.google.com/maps/search/?api=1&amp;query=<?php echo urlencode($cust['address']); ?>" target="_blank" rel="noopener"><?php echo e($cust['address']); ?> ↗</a><br>
  <?php echo e($cust['email']); ?> &middot; <?php echo e($cust['phone']); ?><br>
  <?php echo (int)$cust['dogs']; ?> dog<?php echo (int)$cust['dogs'] === 1 ? '' : 's'; ?><?php echo $cust['dogs_in_yard'] ? ' — dogs in yard' : ''; ?> &middot; Gate: <?php echo e($cust['gate_code']); ?><br>
  Card: <?php echo e($cust['card_brand']); ?> &bull;&bull;&bull;&bull; <?php echo e($cust['card_last4']); ?> — <span class="badge <?php echo $cust['card_status'] === 'failed' ? 'failed' : 'paid'; ?>"><?php echo e($cust['card_status']); ?></span><br>
  Total paid: <strong><?php echo money($totalPaid); ?></strong></p>
  <?php if ($cust['notes'] !== ''): ?><p><strong>Yard notes:</strong> <?php echo e($cust['notes']); ?></p><?php endif; ?>
  <form method="post" action="?p=customer&amp;id=<?php echo $id; ?>" style="display:inline">
    <?php echo csrf_field(); ?>
    <input type="hidden" name="action" value="<?php echo $cust['card_status'] === 'failed' ? 'card_ok' : 'card_failed'; ?>">
    <button class="btn small <?php echo $cust['card_status'] === 'failed' ? '' : 'secondary'; ?>" type="submit">
      <?php echo $cust['card_status'] === 'failed' ? 'Mark card OK' : 'Mark card failed'; ?>
    </button>
  </form>
</div>

<div class="card">
  <h2>Edit</h2>
  <form method="post" action="?p=customer&amp;id=<?php echo $id; ?>">
    <?php echo csrf_field(); ?>
    <input type="hidden" name="action" value="save">
    <label for="pref_day">Cleanup day</label>
    <select id="pref_day" name="pref_day">
      <?php foreach (['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] as $d): ?>
      <option value="<?php echo $d; ?>" <?php echo $cust['pref_day'] === $d ? 'selected' : ''; ?>><?php echo $d; ?></option>
      <?php endforeach; ?>
    </select>
    <label for="price_per_visit">Price per visit ($)</label>
    <input id="price_per_visit" type="number" name="price_per_visit" step="0.01" min="1" value="<?php echo number_format((float)$cust['price_per_visit'], 2, '.', ''); ?>">
    <label for="status">Status</label>
    <select id="status" name="status">
      <?php foreach (['active','paused','past_due','cancelled'] as $s): ?>
      <option value="<?php echo $s; ?>" <?php echo $cust['status'] === $s ? 'selected' : ''; ?>><?php echo $s; ?></option>
      <?php endforeach; ?>
    </select>
    <label for="notes">Yard notes</label>
    <textarea id="notes" name="notes"><?php echo e($cust['notes']); ?></textarea>
    <button class="btn" type="submit">Save Changes</button>
  </form>
</div>

<div class="card">
  <h2>Billing history</h2>
  <?php if (!$charges): ?><p>No charges yet.</p><?php else: ?>
  <table>
    <tr><th>Date</th><th>Amount</th><th>Status</th><th></th></tr>
    <?php foreach ($charges as $ch): ?>
    <tr><td><?php echo fmt_short(substr($ch['created_at'], 0, 10)); ?></td><td><?php echo money($ch['amount']); ?></td>
    <td><span class="badge <?php echo e($ch['status']); ?>"><?php echo e($ch['status']); ?></span></td>
    <td><a href="?p=receipt&amp;id=<?php echo (int)$ch['id']; ?>"><?php echo e($ch['receipt_no']); ?></a></td></tr>
    <?php endforeach; ?>
  </table>
  <?php endif; ?>
</div>

<div class="card">
  <h2>Recent visits</h2>
  <?php if (!$visits): ?><p>No visits yet.</p><?php else: ?>
  <table>
    <tr><th>Date</th><th>Amount</th><th>Status</th></tr>
    <?php foreach ($visits as $v): ?>
    <tr><td><?php echo fmt_short($v['visit_date']); ?></td><td><?php echo money($v['amount']); ?></td>
    <td><span class="badge <?php echo e($v['status']); ?>"><?php echo e($v['status']); ?></span></td></tr>
    <?php endforeach; ?>
  </table>
  <?php endif; ?>
</div>
<p><a href="?p=customers">&larr; All customers</a></p>
<?php page_foot(); ?>
