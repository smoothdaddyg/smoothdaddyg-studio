<?php
/* Cedar Park Poop Scoop — seed data (all is_demo=1).
   Every date is computed relative to TODAY at seed time — nothing
   here hardcodes a calendar date. Run once, on an empty database. */

function seed_database($pdo) {
  $today = today_str();
  $monday = monday_of($today);

  // Plans (prices from the v1 sketch).
  $plans = [
    ['weekly',   'Weekly',          20.00, 'Every week, same day', 1],
    ['twice',    'Twice-weekly',    18.00, 'Two cleanups a week', 2],
    ['biweekly', 'Every-other-week', 22.00, 'Every two weeks', 3],
    ['one-time', 'One-time cleanup', 25.00, 'Just once, no plan', 4],
  ];
  foreach ($plans as $p) {
    $st = $pdo->prepare("INSERT INTO plans (`key`, name, price_per_visit, blurb, sort_order) VALUES (?, ?, ?, ?, ?)");
    $st->execute($p);
  }

  // Settings.
  $settings = [
    ['business_name', 'Cedar Park Poop Scoop'],
    ['business_phone', '(512) 555-0148'],
    ['business_email', 'owner@poopscoop.demo'],
    ['service_area', 'Cedar Park & North Austin'],
    ['stripe_publishable_key', ''],
    ['stripe_secret_key', ''],
    ['smtp_configured', ''],
  ];
  foreach ($settings as $s) {
    $st = $pdo->prepare("INSERT INTO settings (`key`, value) VALUES (?, ?)");
    $st->execute($s);
  }

  $pass = password_hash('demo1234', PASSWORD_DEFAULT);

  // Owner.
  $st = $pdo->prepare("INSERT INTO users (email, password_hash, role, name, phone, is_demo) VALUES (?, ?, 'owner', ?, ?, 1)");
  $st->execute(['owner@poopscoop.demo', $pass, 'Scoop Owner', '(512) 555-0148']);

  // --- helpers (closures over $pdo) ---
  $mkUser = function ($email, $name, $phone) use ($pdo, $pass) {
    $st = $pdo->prepare("INSERT INTO users (email, password_hash, role, name, phone, is_demo) VALUES (?, ?, 'customer', ?, ?, 1)");
    $st->execute([$email, $pass, $name, $phone]);
    return (int)$pdo->lastInsertId();
  };
  $mkCustomer = function ($userId, $row) use ($pdo) {
    $st = $pdo->prepare("INSERT INTO customers (user_id, address, dogs, gate_code, dogs_in_yard, pref_day, plan_key, price_per_visit, status, is_new, first_visit_date, next_visit_date, card_last4, card_brand, card_status, is_demo, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)");
    $st->execute([$userId, $row['address'], $row['dogs'], $row['gate_code'], $row['dogs_in_yard'], $row['pref_day'], $row['plan_key'], $row['price_per_visit'], $row['status'], $row['is_new'], $row['first_visit_date'], $row['next_visit_date'], $row['card_last4'], $row['card_brand'], $row['card_status'], $row['notes']]);
    return (int)$pdo->lastInsertId();
  };
  $mkVisit = function ($custId, $date, $status, $amount) use ($pdo) {
    $st = $pdo->prepare("INSERT INTO visits (customer_id, visit_date, status, amount) VALUES (?, ?, ?, ?)");
    $st->execute([$custId, $date, $status, $amount]);
    return (int)$pdo->lastInsertId();
  };
  $mkCharge = function ($custId, $visitId, $amount, $status, $last4, $created = null) use ($pdo) {
    $no = next_receipt_no($pdo);
    $st = $pdo->prepare("INSERT INTO charges (customer_id, visit_id, amount, status, receipt_no, card_last4, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $st->execute([$custId, $visitId, $amount, $status, $no, $last4, $created ? $created : date('Y-m-d H:i:s')]);
    return ['id' => (int)$pdo->lastInsertId(), 'receipt_no' => $no, 'amount' => $amount, 'card_last4' => $last4, 'created_at' => $created ? $created : date('Y-m-d H:i:s')];
  };
  // A done visit in a past week + a paid charge for it.
  $pastPaid = function ($custId, $date, $amount, $last4) use ($mkVisit, $mkCharge, $pdo) {
    $vid = $mkVisit($custId, $date, 'done', $amount);
    $ch = $mkCharge($custId, $vid, $amount, 'paid', $last4, $date . ' 10:00:00');
    $pdo->prepare("UPDATE visits SET charge_id = ? WHERE id = ?")->execute([$ch['id'], $vid]);
    return $ch;
  };

  // Demo customer (the login Danny / a buyer tries first).
  $uid = $mkUser('demo@poopscoop.demo', 'Demo Customer', '(512) 555-0100');
  $demoFirst = next_occurrence('Tue', $today);
  $demoId = $mkCustomer($uid, [
    'address' => '123 Maple St, Cedar Park, TX 78613', 'dogs' => 2,
    'gate_code' => 'Side gate, code 1234', 'dogs_in_yard' => 0,
    'pref_day' => 'Tue', 'plan_key' => 'weekly', 'price_per_visit' => 20.00,
    'status' => 'active', 'is_new' => 0,
    'first_visit_date' => add_days($monday, -14), 'next_visit_date' => $demoFirst,
    'card_last4' => '4242', 'card_brand' => 'Visa', 'card_status' => 'ok',
    'notes' => 'Two friendly labs. Leave the gate as you found it.',
  ]);
  $pastPaid($demoId, add_days($monday, -13), 20.00, '4242'); // last Tue
  $pastPaid($demoId, add_days($monday, -6), 20.00, '4242');  // Tue before that... (two past bills)

  // Six fake customers across the week.
  $fakes = [
    // name, email, phone, address, dogs, gate, in_yard, day, plan, price, status, is_new, card_last4, brand, card_status, notes
    ['Tom Rivera', 'tom@poopscoop.demo', '(512) 555-0101', '88 Cypress Creek Rd, Cedar Park, TX 78613', 1, 'Gate unlocked', 0, 'Mon', 'weekly', 20.00, 'active', 0, '5555', 'Mastercard', 'ok', 'One small terrier, usually inside.'],
    ['Emily Zhang', 'emily@poopscoop.demo', '(512) 555-0102', '456 Oak Ridge Dr, Cedar Park, TX 78613', 2, 'Back gate, code 7788', 1, 'Tue', 'weekly', 20.00, 'past_due', 0, '0002', 'Visa', 'failed', 'Dogs stay in the yard — honk when you arrive.'],
    ['Marcus Lee', 'marcus@poopscoop.demo', '(512) 555-0103', '2100 Buttercup Creek Blvd, Cedar Park, TX 78613', 1, 'Side gate latch', 0, 'Wed', 'weekly', 20.00, 'active', 1, '1111', 'Visa', 'ok', 'NEW — first visit this week. One beagle.'],
    ['Sarah Patel', 'sarah@poopscoop.demo', '(512) 555-0104', '77 Silverado Dr, Austin, TX 78726', 3, 'Gate code 4455', 0, 'Thu', 'twice', 18.00, 'paused', 0, '9876', 'Mastercard', 'ok', 'Paused while traveling — three big dogs.'],
    ['Lisa Nguyen', 'lisa@poopscoop.demo', '(512) 555-0105', '910 Sun Chase Pkwy, Cedar Park, TX 78613', 2, 'No gate — open yard', 1, 'Fri', 'biweekly', 22.00, 'active', 0, '2222', 'Visa', 'ok', 'Every other Friday. Dogs friendly.'],
    ['James Carter', 'james@poopscoop.demo', '(512) 555-0106', '33 Vista Ridge Blvd, Cedar Park, TX 78613', 1, 'Front gate, code 9021', 0, 'Sat', 'twice', 18.00, 'active', 0, '3333', 'Discover', 'ok', 'Twice a week: Sat + Tue. One senior lab.'],
  ];
  $ids = [];
  foreach ($fakes as $f) {
    list($name, $email, $phone, $addr, $dogs, $gate, $inYard, $day, $plan, $price, $status, $isNew, $last4, $brand, $cardStatus, $notes) = $f;
    $uid = $mkUser($email, $name, $phone);
    $first = ($isNew ? next_occurrence($day, $today) : add_days($monday, -14));
    $cid = $mkCustomer($uid, [
      'address' => $addr, 'dogs' => $dogs, 'gate_code' => $gate, 'dogs_in_yard' => $inYard,
      'pref_day' => $day, 'plan_key' => $plan, 'price_per_visit' => $price,
      'status' => $status, 'is_new' => $isNew,
      'first_visit_date' => $first, 'next_visit_date' => next_occurrence($day, $today),
      'card_last4' => $last4, 'card_brand' => $brand, 'card_status' => $cardStatus,
      'notes' => $notes,
    ]);
    $ids[$name] = $cid;
  }

  // Past paid visits so Money is non-empty (last week + the week before,
  // on each active customer's day). Emily gets a FAILED charge instead.
  $pastWeeks = [add_days($monday, -7), add_days($monday, -14)];
  $pastByName = [
    'Tom Rivera' => ['Mon', 20.00, '5555'], 'Emily Zhang' => ['Tue', 20.00, '0002'],
    'Sarah Patel' => ['Thu', 18.00, '9876'], 'Lisa Nguyen' => ['Fri', 22.00, '2222'],
    'James Carter' => ['Sat', 18.00, '3333'],
  ];
  foreach ($pastWeeks as $wkMon) {
    foreach ($pastByName as $name => $info) {
      list($day, $amount, $last4) = $info;
      $date = add_days($wkMon, day_num($day) - 1);
      if ($name === 'Emily Zhang' && $wkMon === add_days($monday, -7)) {
        // Most recent Emily visit: done, but the card failed.
        $vid = $mkVisit($ids[$name], $date, 'done', $amount);
        $ch = $mkCharge($ids[$name], $vid, $amount, 'failed', $last4, $date . ' 10:00:00');
        $pdo->prepare("UPDATE visits SET charge_id = ? WHERE id = ?")->execute([$ch['id'], $vid]);
      } else {
        $pastPaid($ids[$name], $date, $amount, $last4);
      }
    }
  }

  // This week's scheduled visits (Mon–Sun) for every non-cancelled customer.
  ensure_week_visits($pdo, $monday);
  // Refresh next-visit dates.
  foreach ($pdo->query("SELECT id FROM customers")->fetchAll(PDO::FETCH_COLUMN) as $cid) {
    refresh_next_visit($pdo, (int)$cid);
  }

  // Seed a couple of email_log rows so receipts/alerts have history.
  $st = $pdo->prepare("INSERT INTO email_log (kind, to_email, subject, body) VALUES (?, ?, ?, ?)");
  $st->execute(['receipt', 'demo@poopscoop.demo', 'Receipt CPS — Demo Customer', 'Demo receipt for a past cleanup ($20.00, Visa •••• 4242).']);
  $st->execute(['owner_alert', 'owner@poopscoop.demo', 'New customer: Marcus Lee', 'Marcus Lee signed up (Weekly, $20/visit). First visit ' . next_occurrence('Wed', $today) . '.']);
}
