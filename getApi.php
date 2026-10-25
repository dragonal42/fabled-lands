<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
require __DIR__ . '/lib/getAdventure.php';

function reply(array $data, int $status = 200): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}
function validateState(mixed $state): void {
    if (!is_array($state) || ($state['schema'] ?? null) !== 1) {
        reply(['error' => 'Format de sauvegarde non reconnu.'], 422);
    }
    foreach (['hero', 'skills', 'position'] as $key) {
        if (!isset($state[$key]) || !is_array($state[$key])) reply(['error' => 'Sauvegarde incomplète : ' . $key], 422);
    }
    foreach (['inventory', 'storage', 'quests', 'investments', 'deposits', 'ships', 'effects', 'temples', 'resurrections', 'combats', 'maps', 'dice'] as $key) {
        if (!isset($state[$key]) || !is_array($state[$key]) || !array_is_list($state[$key]) || ($key !== 'maps' && count($state[$key]) > 1000)) {
            reply(['error' => 'Liste invalide : ' . $key], 422);
        }
        foreach ($state[$key] as $entry) if (!is_array($entry)) reply(['error' => 'Entrée invalide : ' . $key], 422);
    }
    if (!is_string($state['notes'] ?? null) || !is_int($state['gold'] ?? null) || $state['gold'] < 0 || count($state['inventory']) > 12) reply(['error' => 'Bourse, notes ou inventaire invalide.'], 422);
    foreach (['codes', 'sections'] as $key) if (!isset($state[$key]) || !is_array($state[$key])) reply(['error' => 'Suivi invalide.'], 422);
    foreach (['name', 'profession', 'titles'] as $key) if (!is_string($state['hero'][$key] ?? null)) reply(['error' => 'Personnage invalide.'], 422);
    foreach (['rank', 'stamina', 'maxStamina', 'armour'] as $key) if (!is_int($state['hero'][$key] ?? null) || $state['hero'][$key] < 0) reply(['error' => 'Statistiques invalides.'], 422);
    if ($state['hero']['stamina'] > $state['hero']['maxStamina']) reply(['error' => 'Endurance supérieure au maximum.'], 422);
    foreach (['Charisme', 'Combat', 'Magie', 'Piété', 'Exploration', 'Adresse'] as $key) {
        $skill = $state['skills'][$key] ?? null;
        if (!is_array($skill) || !is_int($skill['initial'] ?? null) || !is_int($skill['current'] ?? null) || !is_int($skill['bonus'] ?? null) || !is_string($skill['reason'] ?? null)) reply(['error' => 'Compétence invalide.'], 422);
    }
    foreach (['book', 'section'] as $key) if (!is_int($state['position'][$key] ?? null) || $state['position'][$key] < 1) reply(['error' => 'Marque-page invalide.'], 422);
    $shapes = [
        'inventory' => ['name'=>'s','quantity'=>'n','notes'=>'s'],
        'storage' => ['location'=>'s','book'=>'p','section'=>'p','items'=>'s'],
        'quests' => ['title'=>'s','book'=>'p','section'=>'p','notes'=>'s','done'=>'b'],
        'investments' => ['location'=>'s','book'=>'p','section'=>'p','amount'=>'n','notes'=>'s'],
        'deposits' => ['location'=>'s','book'=>'p','section'=>'p','amount'=>'n','fee'=>'n','notes'=>'s'],
        'ships' => ['name'=>'s','type'=>'s','crew'=>'s','capacity'=>'n','load'=>'n','cargo'=>'s','port'=>'s'],
        'effects' => ['type'=>'s','origin'=>'s','consequence'=>'s'],
        'temples' => ['name'=>'s','domain'=>'s','blessing'=>'s','active'=>'b','location'=>'s','book'=>'p','section'=>'p','notes'=>'s'],
        'resurrections' => ['origin'=>'s','location'=>'s','book'=>'p','section'=>'p'],
        'combats' => ['name'=>'s','combat'=>'n','defence'=>'n','stamina'=>'n','notes'=>'s','finished'=>'b'],
        'maps' => ['title'=>'s','book'=>'p','image'=>'s','notes'=>'s'],
        'dice' => ['at'=>'s','label'=>'s','rolls'=>'s','total'=>'i'],
    ];
    foreach ($shapes as $list => $shape) foreach ($state[$list] as $row) {
        if (!is_string($row['id'] ?? null) || !preg_match('/^[a-zA-Z0-9-]{1,100}$/', $row['id'])) reply(['error' => 'Identifiant d’entrée invalide.'], 422);
        foreach ($shape as $key => $type) {
            $value = $row[$key] ?? null;
            $valid = match ($type) {
                's' => is_string($value),
                'b' => is_bool($value),
                'i' => is_int($value),
                'n' => is_int($value) && $value >= 0,
                'p' => is_int($value) && $value >= 1,
            };
            if (!$valid) reply(['error' => 'Valeur invalide : ' . $list . '/' . $key], 422);
        }
        if ($list === 'deposits' && $row['fee'] > 100) reply(['error' => 'Les frais ne peuvent pas dépasser 100 %.'], 422);
        if ($list === 'inventory' && $row['quantity'] < 1) reply(['error'=>'Chaque objet doit avoir une quantité d’au moins 1.'], 422);
        if ($list === 'ships' && (!in_array($row['crew'], ['mauvais','moyen','bon','hors pair'], true) || $row['load'] > $row['capacity'])) reply(['error' => 'Manifeste de navire invalide.'], 422);
        if ($list === 'maps' && !preg_match('~^(data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+|getApi\.php\?photo=[a-f0-9]{32}&owner=[a-f0-9]{32})$~D', $row['image'])) reply(['error' => 'Image de carte invalide.'], 422);
    }
    if (array_key_exists('mapStamps',$state)) {
        if (!is_array($state['mapStamps']) || !array_is_list($state['mapStamps']) || count($state['mapStamps'])>10000) reply(['error'=>'Tampons invalides.'],422);
        foreach ($state['mapStamps'] as $stamp) {
            if (!is_array($stamp) || !is_string($stamp['id'] ?? null) || !preg_match('/^[a-zA-Z0-9-]{1,100}$/',$stamp['id']) || !is_string($stamp['mapId'] ?? null) || !preg_match('/^[a-zA-Z0-9-]{1,100}$/',$stamp['mapId']) || !is_string($stamp['kind'] ?? null) || !preg_match('/^(skull|chest|shop|burger|home|cross|moon|star|arrow-up|arrow-down|arrow-left|arrow-right|bow|swords|shield|digit-[0-9])$/',$stamp['kind'])) reply(['error'=>'Tampon invalide.'],422);
            foreach (['x','y'] as $axis) if ((!is_int($stamp[$axis] ?? null) && !is_float($stamp[$axis] ?? null)) || !is_finite((float)$stamp[$axis]) || $stamp[$axis]<0 || $stamp[$axis]>1) reply(['error'=>'Position de tampon invalide.'],422);
        }
    }
    // Older saves may omit the reading trail; keep them valid without inventing visits.
    if (array_key_exists('readingHistory', $state)) {
        $trail = $state['readingHistory'];
        if (!is_array($trail) || !array_is_list($trail) || count($trail) > 10000) reply(['error'=>'Historique de lecture invalide.'], 422);
        foreach ($trail as $stop) {
            if (!is_array($stop) || !is_string($stop['id'] ?? null) || !preg_match('/^[a-zA-Z0-9-]{1,100}$/', $stop['id']) || !is_int($stop['book'] ?? null) || $stop['book'] < 1 || !is_int($stop['section'] ?? null) || $stop['section'] < 1 || !is_string($stop['at'] ?? null)) reply(['error'=>'Passage de lecture invalide.'], 422);
            if ($stop['at'] !== '' && (!preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/D', $stop['at']) || strtotime($stop['at']) === false)) reply(['error'=>'Date du passage invalide.'], 422);
        }
    }
    if (count($state['dice']) > 50) reply(['error' => 'Trop de jets de dés.'], 422);
    foreach (['codes', 'sections'] as $key) foreach ($state[$key] as $value) if (!is_bool($value)) reply(['error' => 'Case à cocher invalide.'], 422);
}

try {
    if (!extension_loaded('pdo_sqlite')) reply(['error' => 'Activez l’extension PHP pdo_sqlite dans votre hébergement.'], 503);
    $db = new PDO('sqlite:' . __DIR__ . '/aventures.sqlite', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $db->exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
    $db->exec('CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE, state TEXT, version INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)');
    $db->exec('CREATE TABLE IF NOT EXISTS adventure_photos (id TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, mime TEXT NOT NULL, image BLOB NOT NULL)');
    $method = $_SERVER['REQUEST_METHOD'];
    if ($method === 'GET') {
        if (isset($_GET['photo'])) {
            if (!is_string($_GET['photo']) || !is_string($_GET['owner'] ?? null) || !preg_match('/^[a-f0-9]{32}$/',$_GET['photo']) || !preg_match('/^[a-f0-9]{32}$/',$_GET['owner'])) reply(['error'=>'Photo introuvable.'],404);
            $q=$db->prepare('SELECT mime, image FROM adventure_photos WHERE id=? AND profile_id=?');
            $q->execute([$_GET['photo'], $_GET['owner'] ?? '']);$photo=$q->fetch(PDO::FETCH_ASSOC);
            if (!$photo) reply(['error'=>'Photo introuvable.'],404);
            header('Content-Type: '.$photo['mime']);header('Cache-Control: private, max-age=31536000, immutable');
            echo $photo['image'];exit;
        }

        $id = $_GET['id'] ?? '';
        if ($id === '') reply(['profiles' => $db->query('SELECT id, name, updated_at FROM profiles ORDER BY name COLLATE NOCASE')->fetchAll(PDO::FETCH_ASSOC)]);
        $query = $db->prepare('SELECT * FROM profiles WHERE id = ?');
        $query->execute([$id]);
        $profile = $query->fetch(PDO::FETCH_ASSOC);
        if (!$profile) reply(['error' => 'Profil introuvable.'], 404);
        reply(['id' => $profile['id'], 'name' => $profile['name'], 'version' => (int)$profile['version'], 'updated_at' => $profile['updated_at'], 'state' => $profile['state'] === null ? null : json_decode($profile['state'], true, 64, JSON_THROW_ON_ERROR)]);
    }
    if ($method !== 'POST') reply(['error' => 'Méthode non autorisée.'], 405);
    if (strtolower(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]) !== 'application/json') reply(['error' => 'Une requête JSON est nécessaire.'], 415);
    if (isset($_SERVER['HTTP_ORIGIN'])) {
        $origin = parse_url($_SERVER['HTTP_ORIGIN']);
        $expected = ($_SERVER['HTTPS'] ?? '') === 'on' ? 'https' : 'http';
        $authority = ($origin['host'] ?? '') . (isset($origin['port']) ? ':' . $origin['port'] : '');
        if ($authority !== ($_SERVER['HTTP_HOST'] ?? '') || ($origin['scheme'] ?? '') !== $expected) reply(['error' => 'Origine non autorisée.'], 403);
    }
    $raw = file_get_contents('php://input', false, null, 0, 12 * 1024 * 1024 + 1);
    if (strlen($raw) > 12 * 1024 * 1024) reply(['error' => 'Sauvegarde trop volumineuse (12 Mo maximum).'], 413);
    $body = json_decode($raw, true, 64, JSON_THROW_ON_ERROR);
    if (!is_array($body)) reply(['error' => 'Requête invalide.'], 400);
    $action = $body['action'] ?? '';
    $now = gmdate('c');
    if ($action === 'create') {
        if (!is_string($body['name'] ?? null)) reply(['error' => 'Un prénom est nécessaire.'], 422);
        $name = trim(preg_replace('/\s+/u', ' ', $body['name']) ?? '');
        if (!preg_match("/^[\p{L}\p{M}][\p{L}\p{M} '\x{2019}-]{0,39}$/u", $name)) reply(['error' => 'Saisissez un prénom de 1 à 40 caractères.'], 422);
        $key = strtolower(strtr($name, ['À'=>'à','Â'=>'â','Ä'=>'ä','Ç'=>'ç','É'=>'é','È'=>'è','Ê'=>'ê','Ë'=>'ë','Î'=>'î','Ï'=>'ï','Ô'=>'ô','Ö'=>'ö','Ù'=>'ù','Û'=>'û','Ü'=>'ü','Ÿ'=>'ÿ','Œ'=>'œ']));
        $id = bin2hex(random_bytes(16));
        try {
            $query = $db->prepare('INSERT INTO profiles (id, name, name_key, updated_at) VALUES (?, ?, ?, ?)');
            $query->execute([$id, $name, $key, $now]);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') reply(['error' => 'Ce prénom existe déjà. Choisissez-le dans la liste.'], 409);
            throw $e;
        }
        reply(['id' => $id, 'name' => $name, 'version' => 0, 'state' => null], 201);
    }
    if ($action === 'upload-photo' || $action === 'delete-photo') {
        $q=$db->prepare('SELECT state FROM profiles WHERE id=?');$q->execute([$body['id'] ?? '']);$owner=$q->fetch(PDO::FETCH_ASSOC);
        if (!$owner) reply(['error'=>'Profil introuvable.'],404);
        if ($action === 'upload-photo') {
            $data=$body['image'] ?? null;
            if (!is_string($data) || !preg_match('~^data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$~D',$data,$match)) reply(['error'=>'Photo invalide.'],422);
            $bytes=base64_decode($match[2],true);$info=$bytes===false?false:@getimagesizefromstring($bytes);
            if ($bytes===false || strlen($bytes)>2*1024*1024 || !$info || !in_array($info['mime'],['image/jpeg','image/png','image/webp'],true)) reply(['error'=>'Photo invalide ou trop volumineuse.'],422);
            $photoId=bin2hex(random_bytes(16));$q=$db->prepare('INSERT INTO adventure_photos (id,profile_id,mime,image) VALUES (?,?,?,?)');
            $q->bindValue(1,$photoId);$q->bindValue(2,$body['id']);$q->bindValue(3,$info['mime']);$q->bindValue(4,$bytes,PDO::PARAM_LOB);$q->execute();
            reply(['image'=>'getApi.php?photo='.$photoId.'&owner='.$body['id']],201);
        }
        $current=$owner['state']===null?[]:json_decode($owner['state'],true,64,JSON_THROW_ON_ERROR);
        $url='getApi.php?photo='.($body['photo'] ?? '').'&owner='.$body['id'];
        foreach ($current['maps'] ?? [] as $photo) if ($photo['image']===$url) reply(['error'=>'Cette photo est encore dans le carnet.'],409);
        $q=$db->prepare('DELETE FROM adventure_photos WHERE id=? AND profile_id=?');$q->execute([$body['photo'] ?? '',$body['id']]);reply(['deleted'=>true]);
    }
    if ($action === 'save') {
        validateState($body['state'] ?? null);
        if (!is_int($body['version'] ?? null)) reply(['error' => 'Version manquante.'], 422);
        $previousQuery = $db->prepare('SELECT state, version FROM profiles WHERE id = ?');
        $previousQuery->execute([$body['id'] ?? '']);
        $previous = $previousQuery->fetch(PDO::FETCH_ASSOC);
        if (!$previous || (int)$previous['version'] !== $body['version']) reply(['error'=>'Ce profil a changé sur un autre appareil. Choisissez la sauvegarde à conserver.'], 409);
        $previousState = $previous['state'] === null ? null : json_decode($previous['state'], true, 64, JSON_THROW_ON_ERROR);
        validateAdventure($body['state'], $previousState);
        foreach ($body['state']['maps'] as $photo) if (str_starts_with($photo['image'],'getApi.php?photo=')) {
            preg_match('/photo=([a-f0-9]{32})&owner=([a-f0-9]{32})$/',$photo['image'],$ref);
            $q=$db->prepare('SELECT 1 FROM adventure_photos WHERE id=? AND profile_id=?');$q->execute([$ref[1],$body['id']]);
            if ($ref[2]!==$body['id'] || !$q->fetchColumn()) reply(['error'=>'Une photo ne fait pas partie de ce carnet.'],422);
        }

        $carried = array_sum(array_column($body['state']['inventory'], 'quantity'));
        $previousCarried = $previousState ? array_sum(array_column($previousState['inventory'], 'quantity')) : 0;
        // Les anciens carnets surchargés restent utilisables, sans pouvoir aggraver la surcharge.
        if ($carried > max(12, $previousCarried)) reply(['error'=>'Le sac est limité à 12 objets, quantités comprises.'], 422);
        $query = $db->prepare('UPDATE profiles SET state = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?');
        $query->execute([json_encode($body['state'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), $now, $body['id'] ?? '', $body['version']]);
        if ($query->rowCount() !== 1) reply(['error' => 'Ce profil a changé sur un autre appareil. Choisissez la sauvegarde à conserver.'], 409);
        reply(['version' => $body['version'] + 1, 'updated_at' => $now]);
    }
    if ($action === 'reset') {
        if (($body['confirmation'] ?? '') !== 'SUPPRIMER' || !is_int($body['version'] ?? null)) reply(['error'=>'Confirmation de suppression requise.'], 422);
        $query = $db->prepare('UPDATE profiles SET state = NULL, version = version + 1, updated_at = ? WHERE id = ? AND version = ?');
        $query->execute([$now, $body['id'] ?? '', $body['version']]);
        if ($query->rowCount() !== 1) reply(['error'=>'Ce profil a changé. Rechargez le carnet avant de supprimer l’aventure.'], 409);
        $q=$db->prepare('DELETE FROM adventure_photos WHERE profile_id=?');$q->execute([$body['id']]);
        reply(['version'=>$body['version'] + 1, 'updated_at'=>$now]);
    }
    reply(['error' => 'Action inconnue.'], 400);
} catch (JsonException $e) {
    reply(['error' => 'Le fichier JSON est invalide.'], 400);
} catch (Throwable $e) {
    error_log('Carnet : ' . $e->getMessage());
    reply(['error' => 'Sauvegarde indisponible. Vérifiez les droits d’écriture du dossier et SQLite.'], 500);
}
