<?php
/* Receipt detail. Customers see only their own; the owner can see any. */
$u = current_user();
if (!$u) redirect('login');
$id = (int)(isset($_GET['id']) ? $_GET['id'] : 0);
$st = $pdo->prepare("SELECT ch.*, c.plan_key, c.price_per_visit, cu.name AS cust_name, cu.email AS cust_email, c.address FROM charges ch JOIN customers c ON c.id = ch.customer_id JOIN users cu ON cu.id = c.user_id WHERE ch.id = ?");
$st->execute([$id]);
$ch = $st->fetch(PDO::FETCH_ASSOC);
if (!$ch) { http_response_code(404); page_head('Receipt'); echo '<h1>Receipt not found</h1>'; page_foot(); return; }
if ($u['role'] === 'customer') {
  $mine = customer_by_user($pdo, (int)$u['id']);
  if (!$mine || (int)$ch['customer_id'] !== (int)$mine['id']) {
    http_response_code(403);
    page_head('Receipt');
    echo '<h1>Receipt not found</h1>';
    page_foot();
    return;
  }
}
$plan = get_plan($ch['plan_key']);
page_head('Receipt ' . $ch['receipt_no']);
?>
<h1>Receipt</h1>
<div class="card">
  <p><strong><?php echo e(business_name()); ?></strong><br>
  <?php echo e(setting('service_area', 'Cedar Park & North Austin')); ?><br>
  <?php echo e(setting('business_phone', '')); ?> &middot; <?php echo e(setting('business_email', '')); ?></p>
  <table>
    <tr><th>Receipt</th><td><?php echo e($ch['receipt_no']); ?></td></tr>
    <tr><th>Date</th><td><?php echo fmt_date(substr($ch['created_at'], 0, 10)); ?></td></tr>
    <tr><th>Customer</th><td><?php echo e($ch['cust_name']); ?> (<?php echo e($ch['cust_email']); ?>)</td></tr>
    <tr><th>Address</th><td><?php echo e($ch['address']); ?></td></tr>
    <tr><th>Plan</th><td><?php echo e($plan ? $plan['name'] : $ch['plan_key']); ?> — <?php echo money($ch['price_per_visit']); ?>/visit</td></tr>
    <tr><th>Amount</th><td><strong><?php echo money($ch['amount']); ?></strong></td></tr>
    <tr><th>Status</th><td><span class="badge <?php echo e($ch['status']); ?>"><?php echo e($ch['status'] === 'paid' ? 'Paid' : 'Failed'); ?></span></td></tr>
    <tr><th>Card</th><td><?php echo e($ch['card_last4'] ? '•••• ' . $ch['card_last4'] : '—'); ?></td></tr>
  </table>
  <?php if ($ch['status'] === 'failed'): ?>
  <div class="banner">This charge did not go through. <a href="?p=service#update-card">Update your card</a> and the owner will retry it.</div>
  <?php endif; ?>
</div>
<p><a href="<?php echo $u['role'] === 'owner' ? '?p=customers' : '?p=bills'; ?>">&larr; Back</a></p>
<?php page_foot(); ?>
