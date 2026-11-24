# Cedar Park Poop Scoop — setup sheet

Real app, demo billing. PHP 8.3 + PDO. MySQL on Hostinger for production,
SQLite file as the interim backend so it works today with zero setup.

## Run it now (SQLite, no setup)

1. Put this `poopscoop/` folder on the server (or run locally):
   `php -S 127.0.0.1:8080 -t poopscoop` and open http://127.0.0.1:8080/
2. First page load creates `data/poopscoop.sqlite` and seeds demo data.
3. Log in:
   - **Owner:** owner@poopscoop.demo / demo1234
   - **Customer:** demo@poopscoop.demo / demo1234 (2 dogs, Tue, Weekly $20)
   - More seeded customers: tom@ / emily@ / marcus@ / sarah@ / lisa@ / james@
     @poopscoop.demo, all password `demo1234`.
4. `data/` is blocked from the web by `data/.htaccess` (`Require all denied`).

## Switch to MySQL (Hostinger, later)

1. In hPanel, create a MySQL database + user (e.g. `u123_poopscoop`).
2. In phpMyAdmin, import `inc/schema-mysql.sql` into the empty database.
   (Seeding: the app seeds demo data automatically on first run against an
   empty database. Delete the demo rows afterwards, or ask for a clean seed.)
3. Copy `inc/config.sample.php` to `inc/config.php` and fill in the real
   DSN/user/password. Never commit `config.php` (gitignored).
4. Delete `data/poopscoop.sqlite` if you no longer want the demo data.
5. Swapping back is the same one-line change: remove/rename `config.php`.

## Stripe (real charging) — follow-up, not done

No Stripe account or keys exist yet. Right now every card step is clearly
labeled **TEST MODE — no real card is charged**: signup accepts any 15–16
digit test number, stores only last-4 + brand, and check-offs record a
charge + receipt in the database only.

To go live: create a Stripe account, paste the publishable + secret keys
into Owner → Settings → Stripe, and wire `inc/mail.php`'s charge step to
Stripe's PHP SDK (create a Customer + PaymentMethod from the card, charge
it on check-off, store the Stripe charge id). Never invent or paste test
keys into the code — keys live in Settings, not in files.

## Email (real sending) — follow-up, not done

No SMTP is configured. Every receipt, welcome, skip/pause alert, and
password-reset is recorded in the `email_log` table and receipts are shown
in-app (My Bills → receipt). To send for real, add SMTP credentials and
make `inc/mail.php` send via SMTP / a transactional provider — only that
one file needs to change. Until then, the forgot-password page shows the
reset link on screen, labeled demo mode.

## What is where

- `index.php` — front controller (`?p=home|signup|login|forgot|reset|service|bills|receipt|today|customers|customer|schedule|money|settings`)
- `inc/bootstrap.php`, `inc/auth.php`, `inc/helpers.php`, `inc/mail.php`, `inc/db.php`, `inc/seed.php`
- `inc/schema-mysql.sql`, `inc/schema-sqlite.sql`, `inc/config.sample.php`
- `pages/` — one file per screen; `assets/style.css` — phone-first green/white
- `data/poopscoop.sqlite` — created at runtime, gitignored

## Flows (all verified locally with curl — see handoff report)

- **A.** Signup → customer appears on owner Today on their first date, flagged NEW in Customers.
- **B.** Owner checks off a yard → charge + receipt visible in customer My Bills.
- **C.** Skip/pause greys the visit out on owner Schedule; owner "Mark card failed" → banner on customer My Service + Bills.
