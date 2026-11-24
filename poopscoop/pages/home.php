<?php
/* Public home: name, service area, plan prices, how it works, FAQ. */
page_head('Home');
$plans = get_plans();
$recurring = array_values(array_filter($plans, function ($p) { return $p['key'] !== 'one-time'; }));
?>
<div class="hero">
  <div class="poop">&#128054;</div>
  <h1><?php echo e(business_name()); ?></h1>
  <p><strong>Serving <?php echo e(setting('service_area', 'Cedar Park & North Austin')); ?></strong></p>
  <p>We scoop your yard so you don't have to. Sign up tonight, we show up on your day.</p>
  <a class="btn" href="?p=signup">Get Started</a>
  <p class="muted">Already a customer? <a href="?p=login">Log in</a></p>
</div>

<h2>Plans</h2>
<div class="plan-grid">
  <?php foreach ($recurring as $pl): ?>
  <div class="plan">
    <div><strong><?php echo e($pl['name']); ?></strong></div>
    <div class="price"><?php echo money($pl['price_per_visit']); ?><span class="per"> / visit</span></div>
    <div class="muted"><?php echo e($pl['blurb']); ?></div>
  </div>
  <?php endforeach; ?>
</div>
<p class="muted">One-time cleanup also available at signup (<?php echo money(get_plan('one-time')['price_per_visit']); ?>/visit).</p>

<h2>How it works</h2>
<div class="card">
  <p><strong>1.</strong> Pick a plan and tell us about your yard — dogs, gate, best day.</p>
  <p><strong>2.</strong> We scoop on your day, every week (or twice a week).</p>
  <p><strong>3.</strong> You get a receipt after every cleanup. Skip or pause anytime.</p>
</div>

<h2>Questions</h2>
<dl class="faq card">
  <dt>How do you get into my yard?</dt>
  <dd>Tell us your gate code or lock note at signup. We leave the gate exactly as we found it.</dd>
  <dt>Do my dogs need to be inside?</dt>
  <dd>No — just tell us if they are in the yard. Friendly dogs are fine; let us know if yours are not.</dd>
  <dt>What about rain?</dt>
  <dd>Light rain, we still scoop. Heavy storms, we come the next day and let you know.</dd>
</dl>

<p class="muted">Questions? Call <?php echo e(setting('business_phone', '')); ?> or email <?php echo e(setting('business_email', '')); ?>.</p>
<?php page_foot(); ?>
