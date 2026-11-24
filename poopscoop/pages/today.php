<?php
/* Owner — Today: route checklist. Check off = done + charge + receipt.
   Skipped = one tap. Only visits due today or earlier, still scheduled. */
$u = require_role('owner');
ensure_week_visits($pdo, monday_of(today_str()));

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  require_csrf();
  $action = isset($_POST['action']) ? (string)$_POST['action'] : '';
  $visitId = (int)(isset($_POST['visit_id']) ? $_POST['visit_id'] : 0);
  // Explicit columns: SELECT v.*, c.* would collide (both have id,
  // status, created_at) and FETCH_ASSOC would keep the wrong one.
  $st = $pdo->prepare("SELECT v.id AS visit_id, v.customer_id, v.visit_date, v.status AS visit_status, v.amount, c.card_last4, c.card_status, u.name, u.email FROM visits v JOIN customers c ON c.id = v.customer_id JOIN users u ON u.id = c.user_id WHERE v.id = ?");
  $st->execute([$visitId]);
  $v = $st->fetch(PDO::FETCH_ASSOC);
  if (!$v) { flash('Visit not found.', 'err'); redirect('today'); }
  if ($action === 'done' && $v['visit_status'] === 'scheduled') {
    $paid = $v['card_status'] === 'ok';
    $pdo->beginTransaction();
    try {
      $no = next_receipt_no($pdo);
      $st = $pdo->prepare("INSERT INTO charges (customer_id, visit_id, amount, status, receipt_no, card_last4) VALUES (?, ?, ?, ?, ?, ?)");
      $st->execute([$v['customer_id'], $v['visit_id'], (float)$v['amount'], $paid ? 'paid' : 'failed', $v['card_last4'], $no]);
      $chargeId = (int)$pdo->lastInsertId();
      $pdo->prepare("UPDATE visits SET status = 'done', charge_id = ? WHERE id = ?")->execute([$chargeId, $v['visit_id']]);
      $pdo->prepare("UPDATE customers SET is_new = 0 WHERE id = ?")->execute([$v['customer_id']]);
      $pdo->commit();
    } catch (Exception $ex) {
      $pdo->rollBack();
      flash('Could not check off that visit — try again.', 'err');
      redirect('today');
    }
    $charge = ['receipt_no' => $no, 'amount' => (float)$v['amount'], 'card_last4' => $v['card_last4'], 'created_at' => date('Y-m-d H:i:s')];
    if ($paid) {
      send_receipt_email($v, $charge);
      flash('Checked off ' . $v['name'] . ' — ' . money($v['amount']) . ' charged, receipt ' . $no . '.');
    } else {
      log_email('receipt_failed', $v['email'], 'Your cleanup charge did not go through — ' . business_name(),
        "Hi " . $v['name'] . ",\n\nYour cleanup on " . fmt_date($v['visit_date']) . " (" . money($v['amount']) . ") could not be charged to the card on file (•••• " . $v['card_last4'] . "). Please update your card in My Service.\n\n" . business_name());
      flash($v['name'] . ' checked off, but the card FAILED — charge recorded as failed, customer notified.', 'err');
    }
    refresh_next_visit($pdo, (int)$v['customer_id']);
    redirect('today');
  }
  if ($action === 'skip' && $v['visit_status'] === 'scheduled') {
    $pdo->prepare("UPDATE visits SET status = 'skipped' WHERE id = ?")->execute([$v['visit_id']]);
    flash('Marked ' . $v['name'] . ' (' . fmt_date($v['visit_date']) . ') skipped.');
    refresh_next_visit($pdo, (int)$v['customer_id']);
    redirect('today');
  }
  redirect('today');
}

$st = $pdo->prepare("SELECT v.*, c.address, c.dogs, c.gate_code, c.dogs_in_yard, c.is_new, u.name, u.email FROM visits v JOIN customers c ON c.id = v.customer_id JOIN users u ON u.id = c.user_id WHERE v.status = 'scheduled' AND v.visit_date <= ? ORDER BY v.visit_date, u.name");
$st->execute([today_str()]);
$due = $st->fetchAll(PDO::FETCH_ASSOC);
$doneToday = (int)$pdo->query("SELECT COUNT(*) FROM visits WHERE status = 'done' AND visit_date = '" . today_str() . "'")->fetchColumn();

page_head('Today');
?>
<h1>Today — <?php echo fmt_date(today_str()); ?></h1>
<p class="muted"><?php echo count($due); ?> yard<?php echo count($due) === 1 ? '' : 's'; ?> left &middot; <?php echo $doneToday; ?> done today</p>
<?php if (!$due): ?>
<div class="card"><p>Nothing due — route is clear. 🎉</p><p><a href="?p=schedule">See the week</a></p></div>
<?php else: ?>
<?php foreach ($due as $v): ?>
<div class="card">
  <div class="checkrow">
    <div class="info">
      <strong><?php echo e($v['name']); ?></strong>
      <?php if ($v['is_new']): ?><span class="badge new">NEW</span><?php endif; ?>
      <?php if ($v['visit_date'] < today_str()): ?><span class="badge past_due">OVERDUE <?php echo fmt_short($v['visit_date']); ?></span><?php endif; ?>
      <br>
      <a href="https://www.google.com/maps/search/?api=1&amp;query=<?php echo urlencode($v['address']); ?>" target="_blank" rel="noopener"><?php echo e($v['address']); ?> ↗</a><br>
      <span class="muted"><?php echo (int)$v['dogs']; ?> dog<?php echo (int)$v['dogs'] === 1 ? '' : 's'; ?><?php echo $v['dogs_in_yard'] ? ' — dogs in yard' : ''; ?> &middot; <?php echo e($v['gate_code']); ?> &middot; <?php echo money($v['amount']); ?></span>
    </div>
  </div>
  <form method="post" action="?p=today" style="display:inline">
    <?php echo csrf_field(); ?>
    <input type="hidden" name="action" value="done">
    <input type="hidden" name="visit_id" value="<?php echo (int)$v['id']; ?>">
    <button class="btn small" type="submit">✓ Check off</button>
  </form>
  <form method="post" action="?p=today" style="display:inline">
    <?php echo csrf_field(); ?>
    <input type="hidden" name="action" value="skip">
    <input type="hidden" name="visit_id" value="<?php echo (int)$v['id']; ?>">
    <button class="btn small secondary" type="submit">Mark Skipped</button>
  </form>
</div>
<?php endforeach; ?>
<?php endif; ?>
<?php page_foot(); ?>
