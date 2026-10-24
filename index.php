<?php
declare(strict_types=1);
header('Content-Type: text/html; charset=utf-8');
header("Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
header('X-Content-Type-Options: nosniff');
?>
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#173b38">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Terres fabuleuses">
  <meta name="description" content="Votre compagnon de lecture et carnet d’aventure pour les Terres fabuleuses.">
  <title>Terres fabuleuses — Carnet d’aventure</title>
  <link rel="icon" href="assets/icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
  <link rel="manifest" href="manifest.webmanifest">
  <link rel="stylesheet" href="assets/style.css">
  <script src="assets/game-data.js" defer></script>
  <script src="assets/app.js" defer></script>
</head>
<body>
  <div id="app"><div class="loading">✧<p>Ouverture du carnet…</p></div></div>
  <div id="toast" role="status" aria-live="polite"></div>
  <dialog id="modal" aria-labelledby="modal-title"></dialog>
  <noscript>Activez JavaScript pour ouvrir votre carnet d’aventure.</noscript>
</body>
</html>
