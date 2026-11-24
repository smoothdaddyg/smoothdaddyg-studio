<?php
/* Cedar Park Poop Scoop — email.
   No SMTP is configured, so nothing is actually sent yet.
   Every receipt / alert is recorded in email_log and shown in-app.
   Real sending (SMTP or a transactional provider) is a documented
   follow-up in README.md — when it lands, only this file changes. */

function mail_enabled() {
  return setting('smtp_configured', '') !== '';
}

function log_email($kind, $to_email, $subject, $body) {
  $st = pdo()->prepare("INSERT INTO email_log (kind, to_email, subject, body) VALUES (?, ?, ?, ?)");
  $st->execute([$kind, $to_email, $subject, $body]);
  return (int)pdo()->lastInsertId();
}

function send_receipt_email($customer, $charge) {
  $subject = 'Receipt ' . $charge['receipt_no'] . ' — ' . business_name();
  $body = "Thanks for your cleanup!\n\n"
    . "Receipt: " . $charge['receipt_no'] . "\n"
    . "Date: " . $charge['created_at'] . "\n"
    . "Amount: " . money($charge['amount']) . "\n"
    . "Card: " . ($charge['card_last4'] ? '•••• ' . $charge['card_last4'] : 'on file') . "\n\n"
    . business_name() . ' — ' . setting('service_area', 'Cedar Park & North Austin');
  return log_email('receipt', $customer['email'], $subject, $body);
}

function send_owner_alert($subject, $body) {
  return log_email('owner_alert', setting('business_email', 'owner@poopscoop.demo'), $subject, $body);
}

function send_welcome_email($customer) {
  $subject = 'Welcome to ' . business_name() . '!';
  $body = "Hi " . $customer['name'] . ",\n\n"
    . "You're signed up! Your first cleanup is " . fmt_date($customer['first_visit_date']) . ".\n"
    . "Plan: " . $customer['plan_key'] . " at " . money($customer['price_per_visit']) . " per visit.\n\n"
    . "Manage or skip visits anytime from My Service.\n\n"
    . business_name();
  return log_email('welcome', $customer['email'], $subject, $body);
}
