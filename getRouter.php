<?php
// Routeur pour le serveur PHP de développement ; Apache utilise .htaccess.
if (PHP_SAPI !== 'cli-server') { http_response_code(404); exit; }
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/');
if ($path === '/' || $path === '/index.php') { require __DIR__ . '/index.php'; return true; }
if ($path === '/getApi.php') { require __DIR__ . '/getApi.php'; return true; }
$file = realpath(__DIR__ . $path);
if ($path === '/manifest.webmanifest') return false;
if (str_starts_with($path, '/assets/') && $file && str_starts_with($file, __DIR__ . '/assets/') && is_file($file) && preg_match('/\.(css|js|json|svg|png|jpg|jpeg|webp)$/i', $file)) return false;
http_response_code(404);
echo 'Introuvable';
return true;
