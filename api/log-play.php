<?php
/* ============================================================
   SmoothDaddyG — play logger (api/log-play.php)
   ------------------------------------------------------------
   POST {game: "<id>"}  ->  appends {"t": <unix>, "game": "<id>"}
   to api/data/plays.jsonl (one JSON object per line).

   Privacy: no IP, no user agent, no cookies — just the game id
   and a timestamp. Rate-limited per IP (120/min) to stop spam.
   The log file itself is shielded by api/data/.htaccess.
   ============================================================ */
header("Content-Type: application/json");

// read the game id from a form post or a JSON body
$game = "";
if (isset($_POST["game"])) {
  $game = $_POST["game"];
} else {
  $raw = file_get_contents("php://input");
  if ($raw) {
    $j = json_decode($raw, true);
    if (is_array($j) && isset($j["game"])) $game = $j["game"];
  }
}
$game = is_string($game) ? strtolower(trim($game)) : "";
if (!preg_match('/^[a-z0-9-]{1,32}$/', $game)) {
  http_response_code(400);
  echo json_encode(["ok" => false, "err" => "bad game id"]);
  exit;
}

// --- tiny per-IP rate limit (120 logs/minute) ---
$ip = isset($_SERVER["REMOTE_ADDR"]) ? $_SERVER["REMOTE_ADDR"] : "unknown";
$rlFile = sys_get_temp_dir() . "/sdg_rl_" . md5("plays|" . $ip) . ".json";
$now = time();
$rl = ["t" => $now, "n" => 0];
if (is_file($rlFile)) {
  $old = json_decode(@file_get_contents($rlFile), true);
  if (is_array($old) && isset($old["t"], $old["n"]) && ($now - (int)$old["t"]) < 60) {
    $rl = ["t" => (int)$old["t"], "n" => (int)$old["n"]];
  }
}
$rl["n"]++;
@file_put_contents($rlFile, json_encode($rl), LOCK_EX);
if ($rl["n"] > 120) {
  http_response_code(429);
  echo json_encode(["ok" => false, "err" => "slow down"]);
  exit;
}

// --- append to the log ---
$dir = __DIR__ . "/data";
if (!is_dir($dir)) {
  @mkdir($dir, 0755, true);
}
$line = json_encode(["t" => $now, "game" => $game]) . "\n";
$ok = @file_put_contents($dir . "/plays.jsonl", $line, FILE_APPEND | LOCK_EX);
if ($ok === false) {
  http_response_code(500);
  echo json_encode(["ok" => false, "err" => "write failed"]);
  exit;
}
echo json_encode(["ok" => true]);
