# Terres fabuleuses — Carnet d’aventure

Compagnon de lecture en français pour les livres-jeux Fabled Lands, réalisé en PHP, HTML, CSS et JavaScript natifs. Interface adaptée à l’iPhone, sans CDN, framework, Composer ou compilation. Les illustrations sont locales.

## Fonctionnalités

- Profils par prénom : liste commune, sélection sans mot de passe, reprise automatique du dernier profil avec `localStorage`.
- Personnage : profession, niveau, endurance, six compétences (initiale, actuelle, bonus/malus et raison), défense calculée sans les bonus de Combat, titres et honneurs.
- 12 emplacements transportés et possessions stockées par lieu, livre et section.
- Journal, quêtes terminables et marque-page.
- 194 codes A à F et 175 entrées de section des six livres, transcrits du livret fourni ; les cases multiples sont indépendantes. Ajout de codes personnalisés.
- Bourse en shards, investissements, dépôts et retraits avec frais configurables. Les nouveaux placements débitent la bourse ; l’édition d’un montant ne simule pas une transaction. Les frais de retrait sont arrondis au shard supérieur.
- Navires : type libre, équipage mauvais / moyen / bon / hors pair, capacité, cargaison et port.
- Cultes, 13 sanctuaires, bénédictions, maladies, malédictions, sortilèges et résurrections.
- Jets de 1D6 ou 2D6, tests de compétences et journal des combats. Une attaque utilise `2D6 + Combat`, puis inflige l’excédent sur la Défense. L’utilisateur applique les exceptions du livre et choisit l’ordre des attaques.
- Import de cartes personnelles PNG, JPEG ou WebP : optimisation en JPEG, zoom dans une fenêtre défilante, notes par carte. Jusqu’à huit cartes par profil. Aucune carte du roman n’est fournie.
- Sauvegarde SQLite, copie locale des modifications en attente, synchronisation à la reconnexion et gestion explicite des conflits entre appareils.
- Export JSON contenant tout le carnet et ses cartes, restauration avec confirmation dans le profil sélectionné.

Les valeurs de départ sont modifiables : recopiez celles de votre profession et de votre livre. Les effets consignés dans Cultes ne modifient pas automatiquement les statistiques ; reportez les bonus dans la fiche. Les applications de référence webfl.rwgs.net et flapp.sourceforge.net étaient inaccessibles depuis l’environnement de développement ; la couverture fonctionnelle repose sur le PDF fourni.

## Déployer sur O2Switch

1. Choisir **PHP 8.1 ou supérieur** dans cPanel et activer **PDO / pdo_sqlite / sqlite3**. PHP 8.2 ou supérieur recommandé. Aucun serveur MySQL nécessaire.
2. Créer un dossier dans `public_html`, par exemple `aventures`.
3. Y déposer **index.php**, **api.php**, **.htaccess**, **manifest.webmanifest** et le dossier **assets** complet. L’archive de déploiement contient uniquement ces fichiers et une notice. Vérifier que le transfert conserve `.htaccess`, qui peut être masqué dans le gestionnaire de fichiers.
4. Le dossier doit être accessible en écriture à PHP : SQLite créera automatiquement `aventures.sqlite` **dans le même dossier** que `api.php`. Des permissions ordinaires de 755 pour les dossiers et 644 pour les fichiers conviennent habituellement quand PHP s’exécute avec votre compte ; ne pas utiliser 777.
5. Ouvrir l’adresse HTTPS du dossier. Créer un profil par prénom, modifier une statistique, attendre « Sauvegardé », puis recharger la page. Tester aussi avec un second navigateur pour vérifier la sauvegarde serveur.
6. **Vérifier impérativement** que l’adresse `…/aventures/aventures.sqlite` renvoie **403** et ne télécharge pas de fichier. La protection Apache `.htaccess` bloque également les journaux SQLite. Si le téléchargement fonctionne, retirer temporairement l’application du Web et faire activer les règles Apache par l’hébergeur avant utilisation.
7. Sur iPhone : Safari → Partager → **Sur l’écran d’accueil**. L’interface reste utilisable dans Safari sans installation.

Le déploiement fonctionne également dans un sous-dossier : toutes les URL sont relatives. Le manifeste et l’icône iPhone sont inclus. Le premier chargement nécessite une connexion ; ce projet ne fournit pas de service worker ni un lancement entièrement hors ligne. Une session déjà chargée peut conserver ses modifications localement jusqu’au retour de la connexion. Si iOS efface le stockage du site, les modifications non synchronisées peuvent disparaître : exporter régulièrement le carnet.

### Accès et sauvegardes

Les prénoms sont des sélecteurs de profils, **pas des identifiants d’authentification**. Toute personne ayant accès à l’installation peut consulter et modifier tous les profils. Pour un usage familial privé, cPanel permet de protéger le dossier entier par mot de passe ; cela ne change pas la sélection par prénom dans l’application.

La base n’est pas incluse dans les sources ni dans l’archive. Une mise à jour doit préserver `aventures.sqlite`. Sauvegarder régulièrement la base côté hébergement et exporter les carnets en JSON. L’export est une copie indépendante qui comprend les cartes. Une restauration remplace le contenu du profil courant après confirmation, sans créer ni changer de prénom.

Les images sont limitées à 12 Mo à l’import, réduites à 1600 pixels au maximum et compressées. Les exports/imports JSON et les requêtes API sont limités à 12 Mo. Pour les images volumineuses, vérifier également la limite du serveur Web de l’hébergeur. Aucun fichier SVG utilisateur n’est accepté. Les sauvegardes ne doivent pas contenir d’informations sensibles.

## Développement local

Avec PHP et l’extension PDO SQLite installés :

```sh
cd /chemin/vers/fabled-lands
php -S 127.0.0.1:8080 dev-router.php
```

Le routeur local protège les fichiers SQLite et les fichiers de développement ; ne pas utiliser un serveur PHP sans ce routeur. Apache en production utilise `.htaccess`. Aucune installation de dépendances applicatives nécessaire.

Dans l’environnement cloud préparé, le binaire de test est `/workspace/tooling/php/php` (PHP 8.4 avec PDO SQLite), extrait de paquets Debian signés sans modifier le système. Chromium est disponible dans `/usr/bin/chromium`. Le dépôt existant est dans `/workspace/fabled-lands` : ne pas créer de worktree pour une nouvelle tâche sauf demande explicite.

## Vérifications

```sh
php -l api.php
php -l index.php
php -l dev-router.php
node --check assets/app.js
# Playwright est nécessaire uniquement pour les tests de navigateur.
PHP_BIN=php CHROMIUM_BIN=/usr/bin/chromium node tests/smoke.cjs
```

Le test navigateur utilise Playwright, une copie temporaire du site et une base isolée. Il vérifie les profils, calculs, listes, transactions, combats, cartes, export/restauration, session automatique, coupures réseau, conflits, validation serveur et largeurs iPhone. Il n’écrit pas de faux profils dans votre base. Des captures sont générées sous `tests/artifacts/` (ignorées par Git).

L’API n’active pas CORS. Les écritures exigent du JSON et rejettent les origines externes. Les mises à jour utilisent un numéro de version pour empêcher l’écrasement silencieux d’une sauvegarde concurrente. La base SQLite utilise les requêtes préparées et un délai d’attente de verrouillage.

L’application a été vérifiée avec PHP 8.4 / SQLite et Chromium. Le serveur O2Switch et un iPhone physique ne sont pas accessibles dans cet environnement : le déploiement et la vérification des règles Apache restent à effectuer sur votre hébergement.
