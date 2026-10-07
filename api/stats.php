<?php
/* ============================================================
   SmoothDaddyG — play stats (api/stats.php)
   ------------------------------------------------------------
   GET -> {ok, total, perGame: {id: n} (desc), perDay: {Y-m-d: n},
           since: <unix of first logged play>}
   Reads api/data/plays.jsonl. Days are America/Chicago.
   ============================================================ */
header("Content-Type: application/json");
date_default_timezone_set("America/Chicago");

$file = __DIR__ . "/data/plays.jsonl";
$perGame = [];
$perDay = [];
$total = 0;
$first = null;

if (is_file($file)) {
  $fh = @fopen($file, "r");
  if ($fh) {
    while (($line = fgets($fh)) !== false) {
      $e = json_decode(trim($line), true);
      if (!is_array($e) || !isset($e["game"]) || !isset($e["t"])) continue;
      $g = $e["game"];
      if (!is_string($g) || !preg_match('/^[a-z0-9-]{1,32}$/', $g)) continue;
      $t = (int)$e["t"];
      if (!isset($perGame[$g])) $perGame[$g] = 0;
      $perGame[$g]++;
      $day = date("Y-m-d", $t);
      if (!isset($perDay[$day])) $perDay[$day] = 0;
      $perDay[$day]++;
      $total++;
      if ($first === null || $t < $first) $first = $t;
    }
    fclose($fh);
  }
}
arsort($perGame);
ksort($perDay);

echo json_encode([
  "ok" => true,
  "total" => $total,
  "perGame" => $perGame,
  "perDay" => $perDay,
  "since" => $first,
]);
