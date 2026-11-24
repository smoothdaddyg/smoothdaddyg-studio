<?php
/* Owner — Customers list (searchable). */
$u = require_role('owner');
$q = trim(isset($_GET['q']) ? (string)$_GET['q'] : '');
$sql = "SELECT c.*, u.name, u.email, u.phone,
  (SELECT COALESCE(SUM(amount),0) FROM charges WHERE customer_id = c.id AND status = 'paid') AS total_paid
  FROM customers c JOIN users u ON u.id = c.user_id";
$params = [];
if ($q !== '') {
  $sql .= " WHERE u.name LIKE ? OR u.email LIKE ? OR c.address LIKE ?";
  $params = ["%$q%", "%$q%", "%$q%"];
}
$sql .= " ORDER BY u.name";
$st = $pdo->prepare($sql);
$st->execute($params);
$list = $st->fetchAll(PDO::FETCH_ASSOC);
page_head('Customers');
?>
<h1>Customers (<?php echo count($list); ?>)</h1>
<form method="get" action="index.php">
  <input type="hidden" name="p" value="customers">
  <label for="q">Search</label>
  <input id="q" type="text" name="q" value="<?php echo e($q); ?>" placeholder="Name, email, or address">
  <button class="btn" type="submit">Search</button>
</form>
<div class="card">
  <?php if (!$list): ?>
    <p>No customers match.</p>
  <?php else: ?>
    <?php foreach ($list as $c): ?>
    <a class="rowlink" href="?p=customer&amp;id=<?php echo (int)$c['id']; ?>">
      <strong><?php echo e($c['name']); ?></strong>
      <?php if ($c['is_new']): ?><span class="badge new">NEW</span><?php endif; ?>
      <span class="badge <?php echo e($c['status']); ?>"><?php echo e($c['status']); ?></span><br>
      <span class="muted"><?php echo e(get_plan($c['plan_key'])['name'] ?? $c['plan_key']); ?> &middot; <?php echo money($c['price_per_visit']); ?>/visit &middot; Next: <?php echo $c['next_visit_date'] ? fmt_short($c['next_visit_date']) : '—'; ?> &middot; Paid to date: <?php echo money($c['total_paid']); ?></span>
    </a>
    <?php endforeach; ?>
  <?php endif; ?>
</div>
<?php page_foot(); ?>
