<?php
/* Owner — Settings: business details, plan prices, Stripe keys.
   Changing a plan price affects NEW signups only — existing
   customers keep the price_per_visit on their own record. */
$u = require_role('owner');
$plans = get_plans();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  require_csrf();
  set_setting('business_name', trim(isset($_POST['business_name']) ? (string)$_POST['business_name'] : business_name()));
  set_setting('business_phone', trim(isset($_POST['business_phone']) ? (string)$_POST['business_phone'] : ''));
  set_setting('business_email', trim(isset($_POST['business_email']) ? (string)$_POST['business_email'] : ''));
  set_setting('service_area', trim(isset($_POST['service_area']) ? (string)$_POST['service_area'] : ''));
  set_setting('stripe_publishable_key', trim(isset($_POST['stripe_publishable_key']) ? (string)$_POST['stripe_publishable_key'] : ''));
  set_setting('stripe_secret_key', trim(isset($_POST['stripe_secret_key']) ? (string)$_POST['stripe_secret_key'] : ''));
  foreach ($plans as $pl) {
    $k = 'price_' . $pl['key'];
    if (isset($_POST[$k]) && (float)$_POST[$k] > 0) {
      $st = $pdo->prepare("UPDATE plans SET price_per_visit = ? WHERE `key` = ?");
      $st->execute([(float)$_POST[$k], $pl['key']]);
    }
  }
  flash('Settings saved. New prices apply to new signups only.');
  redirect('settings');
}

page_head('Settings');
?>
<h1>Settings</h1>
<form method="post" action="?p=settings">
  <?php echo csrf_field(); ?>
  <div class="card">
    <h2>Business</h2>
    <label for="business_name">Business name</label>
    <input id="business_name" type="text" name="business_name" value="<?php echo e(business_name()); ?>">
    <label for="business_phone">Phone</label>
    <input id="business_phone" type="tel" name="business_phone" value="<?php echo e(setting('business_phone', '')); ?>">
    <label for="business_email">Email (owner alerts go here)</label>
    <input id="business_email" type="email" name="business_email" value="<?php echo e(setting('business_email', '')); ?>">
    <label for="service_area">Service area</label>
    <input id="service_area" type="text" name="service_area" value="<?php echo e(setting('service_area', '')); ?>">
  </div>

  <div class="card">
    <h2>Plan prices (per visit)</h2>
    <p class="muted">Changing a price affects new signups only. Existing customers keep their price until you change it on their record.</p>
    <?php foreach ($plans as $pl): ?>
    <label for="price_<?php echo e($pl['key']); ?>"><?php echo e($pl['name']); ?> ($/visit)</label>
    <input id="price_<?php echo e($pl['key']); ?>" type="number" name="price_<?php echo e($pl['key']); ?>" step="0.01" min="1" value="<?php echo number_format((float)$pl['price_per_visit'], 2, '.', ''); ?>">
    <?php endforeach; ?>
  </div>

  <div class="card">
    <h2>Stripe — connect later</h2>
    <p class="muted"><strong>Demo mode until keys are added:</strong> cards are test numbers only and nothing real is ever charged. When you have a Stripe account, paste your keys here and billing switches to real charges (see README.md).</p>
    <label for="stripe_publishable_key">Stripe publishable key</label>
    <input id="stripe_publishable_key" type="text" name="stripe_publishable_key" value="<?php echo e(setting('stripe_publishable_key', '')); ?>" placeholder="pk_live_... / pk_test_..." autocomplete="off">
    <label for="stripe_secret_key">Stripe secret key</label>
    <input id="stripe_secret_key" type="password" name="stripe_secret_key" value="<?php echo e(setting('stripe_secret_key', '')); ?>" placeholder="sk_live_... / sk_test_..." autocomplete="off">
  </div>

  <button class="btn" type="submit">Save Settings</button>
</form>
<?php page_foot(); ?>
