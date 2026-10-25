<?php
declare(strict_types=1);
header('Content-Type: text/html; charset=utf-8');
header("Content-Security-Policy: default-src 'self'; img-src 'self' data: blob: https://raw.githubusercontent.com; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
header('X-Content-Type-Options: nosniff');
?>
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
  <meta name="theme-color" content="#173b38">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Terres fabuleuses">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="description" content="Votre compagnon de lecture et carnet d’aventure pour les Terres fabuleuses.">
  <title>Terres fabuleuses — Carnet d’aventure</title>
  <link rel="icon" href="assets/favicon.ico?v=20261024" sizes="any">
  <link rel="icon" href="assets/favicon-32.png?v=20261024" type="image/png" sizes="32x32">
  <link rel="apple-touch-icon" href="assets/apple-touch-icon.png?v=20261024" sizes="180x180">
  <link rel="manifest" href="manifest.webmanifest?v=20261024">
  <link rel="stylesheet" href="assets/style.css?v=20261024-lecture">
  <link rel="stylesheet" href="assets/vendor/sweetalert2.min.css">
  <link rel="stylesheet" href="assets/controls.css?v=20261025-cases">
  <script src="assets/vendor/sweetalert2.min.js" defer></script>
  <script src="assets/game-data.js?v=20261025-codes" defer></script>
  <script src="assets/adventure.js?v=20261025-cases" defer></script>
  <script src="assets/rules.js?v=20261025-regions" defer></script>
  <script src="assets/photos.js" defer></script>
  <script src="assets/stamps.js" defer></script>
  <script src="assets/map-viewer.js?v=20261025-cases" defer></script>
  <script src="assets/app.js?v=20261025-cases" defer></script>
  <script src="assets/install.js" defer></script>
</head>
<body>
  <div id="app"><div class="loading">✧<p>Ouverture du carnet…</p></div></div>
  <div id="toast" role="status" aria-live="polite"></div>
  <dialog id="modal" aria-labelledby="modal-title"></dialog>
  <noscript>Activez JavaScript pour ouvrir votre carnet d’aventure.</noscript>
</body>
</html>
