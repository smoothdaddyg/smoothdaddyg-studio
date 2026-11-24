<?php
/* Customer — My Bills. */
$u = current_user();
$cust = customer_by_user($pdo, (int)$u['id']);
if (!$cust) { flash('No customer record found for this account.', 'err'); redirect('home'); }
$st = $pdo->prepare("SELECT * FROM charges WHERE customer_id = ? ORDER BY created_at DESC, id DESC");
$st->execute([$cust['id']]);
$charges = $st->fetchAll(PDO::FETCH_ASSOC);
page_head('My Bills');
?>
<h1>My Bills</h1>
<?php if ($cust['card_status'] === 'failed'): ?>
<div class="banner">Your card did not go through — <a href="?p=service#update-card">update it here</a>.</div>
<?php endif; ?>
<div class="card">
  <?php if (!$charges): ?>
    <p>No bills yet. Your first receipt will show up here after your first cleanup.</p>
  <?php else: ?>
    <?php foreach ($charges as $ch): ?>
    <a class="rowlink" href="?p=receipt&amp;id=<?php echo (int)$ch['id']; ?>">
      <strong><?php echo fmt_date(substr($ch['created_at'], 0, 10)); ?></strong>
      &nbsp; <?php echo money($ch['amount']); ?>
      &nbsp; <span class="badge <?php echo e($ch['status']); ?>"><?php echo e($ch['status'] === 'paid' ? 'Paid' : 'Failed'); ?></span>
      <br><span class="muted">Receipt <?php echo e($ch['receipt_no']); ?> &middot; <?php echo e($ch['card_last4'] ? '•••• ' . $ch['card_last4'] : ''); ?></span>
    </a>
    <?php endforeach; ?>
  <?php endif; ?>
</div>
<p><a href="?p=service">&larr; Back to My Service</a></p>
<?php page_foot(); ?>
