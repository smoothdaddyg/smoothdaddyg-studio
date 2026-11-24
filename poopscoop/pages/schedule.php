<?php
/* Owner — Schedule: Mon–Sun week view. Skipped/paused greyed out. */
$u = require_role('owner');
$week = isset($_GET['week']) ? (string)$_GET['week'] : monday_of(today_str());
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $week)) $week = monday_of(today_str());
$week = monday_of($week);
ensure_week_visits($pdo, $week);

$st = $pdo->prepare("SELECT v.*, c.dogs, u.name FROM visits v JOIN customers c ON c.id = v.customer_id JOIN users u ON u.id = c.user_id WHERE v.visit_date >= ? AND v.visit_date <= ? ORDER BY v.visit_date, u.name");
$st->execute([$week, add_days($week, 6)]);
$byDay = [];
foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $v) $byDay[$v['visit_date']][] = $v;

$prev = add_days($week, -7);
$next = add_days($week, 7);
page_head('Schedule');
?>
<h1>Schedule</h1>
<p class="muted">Week of <?php echo fmt_date($week); ?></p>
<p>
  <a class="btn small secondary" href="?p=schedule&amp;week=<?php echo $prev; ?>">&larr; Prev week</a>
  <a class="btn small secondary" href="?p=schedule&amp;week=<?php echo monday_of(today_str()); ?>">This week</a>
  <a class="btn small secondary" href="?p=schedule&amp;week=<?php echo $next; ?>">Next week &rarr;</a>
</p>
<?php for ($i = 0; $i < 7; $i++):
  $d = add_days($week, $i);
  $rows = isset($byDay[$d]) ? $byDay[$d] : [];
?>
<div class="dayhead"><?php echo fmt_date($d); ?><?php echo $d === today_str() ? ' — TODAY' : ''; ?></div>
<div class="card">
  <?php if (!$rows): ?><p class="muted">Nobody due.</p><?php else: ?>
  <?php foreach ($rows as $v): ?>
  <p class="<?php echo ($v['status'] === 'skipped' || $v['status'] === 'paused') ? 'greyed' : ''; ?>">
    <a href="?p=customer&amp;id=<?php echo (int)$v['customer_id']; ?>"><?php echo e($v['name']); ?></a>
    &middot; <?php echo (int)$v['dogs']; ?> dog<?php echo (int)$v['dogs'] === 1 ? '' : 's'; ?>
    &middot; <?php echo money($v['amount']); ?>
    <span class="badge <?php echo e($v['status']); ?>"><?php echo e($v['status']); ?></span>
  </p>
  <?php endforeach; ?>
  <?php endif; ?>
</div>
<?php endfor; ?>
<?php page_foot(); ?>
