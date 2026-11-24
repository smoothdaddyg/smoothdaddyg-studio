<?php
/* Owner — Money: this month, computed from state (never hardcoded). */
$u = require_role('owner');
$first = date('Y-m-01');
$last = date('Y-m-t');
$monthLabel = date('F Y');

$st = $pdo->prepare("SELECT COALESCE(SUM(amount),0) FROM charges WHERE status = 'paid' AND substr(created_at,1,10) >= ? AND substr(created_at,1,10) <= ?");
$st->execute([$first, $last]);
$collected = (float)$st->fetchColumn();

$st = $pdo->prepare("SELECT COALESCE(SUM(amount),0) FROM charges WHERE status = 'failed' AND substr(created_at,1,10) >= ? AND substr(created_at,1,10) <= ?");
$st->execute([$first, $last]);
$failed = (float)$st->fetchColumn();

$st = $pdo->prepare("SELECT COALESCE(SUM(amount),0) FROM visits WHERE status = 'scheduled' AND visit_date >= ? AND visit_date <= ?");
$st->execute([$first, $last]);
$pending = (float)$st->fetchColumn();

$active = (int)$pdo->query("SELECT COUNT(*) FROM customers WHERE status = 'active'")->fetchColumn();
$pastDue = (int)$pdo->query("SELECT COUNT(*) FROM customers WHERE status = 'past_due'")->fetchColumn();

$recent = $pdo->query("SELECT ch.*, u.name FROM charges ch JOIN customers c ON c.id = ch.customer_id JOIN users u ON u.id = c.user_id ORDER BY ch.created_at DESC, ch.id DESC LIMIT 15")->fetchAll(PDO::FETCH_ASSOC);

page_head('Money');
?>
<h1>Money — <?php echo e($monthLabel); ?></h1>
<div class="tiles">
  <div class="tile"><div class="num"><?php echo money($collected); ?></div><div class="lbl">Collected this month</div></div>
  <div class="tile"><div class="num"><?php echo money($pending); ?></div><div class="lbl">Pending (scheduled visits)</div></div>
  <div class="tile"><div class="num"><?php echo money($failed); ?></div><div class="lbl">Failed charges</div></div>
  <div class="tile"><div class="num"><?php echo $active; ?></div><div class="lbl">Active customers<?php echo $pastDue ? ' (' . $pastDue . ' past due)' : ''; ?></div></div>
</div>

<div class="card">
  <h2>Recent charges</h2>
  <?php if (!$recent): ?><p>No charges yet.</p><?php else: ?>
  <table>
    <tr><th>Date</th><th>Customer</th><th>Amount</th><th>Status</th></tr>
    <?php foreach ($recent as $ch): ?>
    <tr><td><?php echo fmt_short(substr($ch['created_at'], 0, 10)); ?></td>
    <td><a href="?p=receipt&amp;id=<?php echo (int)$ch['id']; ?>"><?php echo e($ch['name']); ?></a></td>
    <td><?php echo money($ch['amount']); ?></td>
    <td><span class="badge <?php echo e($ch['status']); ?>"><?php echo e($ch['status']); ?></span></td></tr>
    <?php endforeach; ?>
  </table>
  <?php endif; ?>
</div>
<?php page_foot(); ?>
