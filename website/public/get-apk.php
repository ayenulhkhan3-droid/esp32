<?php
/**
 * Serves the APK for download.
 * File Manager path to replace later:
 *   domains/esp32.digicopy.online/public_html/apk/DriveLink.apk
 * Fallback:
 *   .../public_html/downloads/DriveLink.apk
 */
$candidates = [
  __DIR__ . '/apk/DriveLink.apk',
  __DIR__ . '/downloads/DriveLink.apk',
];

$file = null;
foreach ($candidates as $path) {
  if (is_file($path)) {
    $file = $path;
    break;
  }
}

$name = 'DriveLink.apk';

if ($file === null) {
  http_response_code(404);
  header('Content-Type: text/plain; charset=utf-8');
  echo "APK not found. Upload DriveLink.apk to /apk/ via File Manager.";
  exit;
}

$size = filesize($file);
header('Content-Type: application/vnd.android.package-archive');
header('Content-Disposition: attachment; filename="' . $name . '"');
header('Content-Length: ' . $size);
header('Accept-Ranges: bytes');
header('Cache-Control: no-cache, must-revalidate');
header('X-Content-Type-Options: nosniff');

$start = 0;
$end = $size - 1;
if (isset($_SERVER['HTTP_RANGE']) && preg_match('/bytes=(\d+)-(\d*)/', $_SERVER['HTTP_RANGE'], $m)) {
  $start = (int)$m[1];
  if ($m[2] !== '') {
    $end = (int)$m[2];
  }
  if ($start > $end || $start >= $size) {
    http_response_code(416);
    header("Content-Range: bytes */$size");
    exit;
  }
  http_response_code(206);
  header("Content-Range: bytes $start-$end/$size");
  header('Content-Length: ' . ($end - $start + 1));
}

$fp = fopen($file, 'rb');
if ($start > 0) {
  fseek($fp, $start);
}
$remaining = $end - $start + 1;
while ($remaining > 0 && !feof($fp)) {
  $chunk = min(1024 * 256, $remaining);
  echo fread($fp, $chunk);
  $remaining -= $chunk;
  if (ob_get_level()) {
    ob_flush();
  }
  flush();
}
fclose($fp);
exit;
