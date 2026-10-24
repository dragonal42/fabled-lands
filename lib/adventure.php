<?php
declare(strict_types=1);

function legacyAdventure(array $state): array {
    return ['id'=>'legacy', 'status'=>'legacy', 'createdAt'=>'', 'creation'=>[
        'ruleset'=>'legacy', 'name'=>$state['hero']['name'], 'profession'=>$state['hero']['profession'],
        'skills'=>array_map(fn($name) => $state['skills'][$name]['initial'], ['Charisme','Combat','Magie','Piété','Exploration','Adresse'])
    ]];
}

function validateAdventure(array $state, ?array $previous): void {
    $a = $state['adventure'] ?? null;
    if (!is_array($a) || !is_string($a['id'] ?? null) || !preg_match('/^[a-zA-Z0-9-]{1,100}$/', $a['id']) || !in_array($a['status'] ?? null, ['draft','locked','legacy'], true) || !is_string($a['createdAt'] ?? null)) {
        reply(['error'=>'État d’aventure invalide.'], 422);
    }
    $old = $previous ? ($previous['adventure'] ?? legacyAdventure($previous)) : null;
    if ($old && $old['status'] !== 'draft' && $a !== $old) {
        reply(['error'=>'Le personnage est définitif. Commencez une nouvelle aventure pour en changer.'], 422);
    }
    if ($old && $old['status'] === 'draft' && $a['status'] === 'draft' && ($a['id'] !== $old['id'] || $a['createdAt'] !== $old['createdAt'])) {
        reply(['error'=>'Cette sauvegarde appartient à une autre aventure. Supprimez d’abord l’aventure en cours.'], 422);
    }
    if ($a['status'] === 'draft') {
        if (($a['creation'] ?? null) !== null) reply(['error'=>'Un brouillon ne peut pas contenir un personnage définitif.'], 422);
        return;
    }
    $c = $a['creation'] ?? null;
    if (!is_array($c) || !is_string($c['name'] ?? null) || !is_string($c['profession'] ?? null) || !is_array($c['skills'] ?? null) || count($c['skills']) !== 6) {
        reply(['error'=>'Fiche de création invalide.'], 422);
    }
    if ($a['status'] === 'locked') {
        $rules = json_decode(file_get_contents(dirname(__DIR__).'/assets/creation-rules.json'), true, 64, JSON_THROW_ON_ERROR);
        $book = $rules['books'][(string)($c['book'] ?? '')] ?? null;
        $profession = $book['professions'][$c['profession']] ?? null;
        if (($c['ruleset'] ?? '') !== $rules['id'] || !$profession || !is_int($c['book']) || trim($c['name']) === '' || strlen($c['name']) > 320) {
            reply(['error'=>'Profession, nom ou livre de départ invalide.'], 422);
        }
        $expected = ['rank'=>$book['rank'], 'stamina'=>$book['stamina'], 'armour'=>$profession['armour'], 'gold'=>$book['gold'], 'skills'=>$profession['skills'], 'inventory'=>$profession['inventory']];
        foreach ($expected as $key => $value) if (($c[$key] ?? null) !== $value) reply(['error'=>'Les valeurs de départ ne correspondent pas aux règles vérifiées du livre.'], 422);
    } elseif (($c['ruleset'] ?? '') !== 'legacy') {
        reply(['error'=>'Ancien personnage invalide.'], 422);
    }
    if ($state['hero']['name'] !== $c['name'] || $state['hero']['profession'] !== $c['profession']) {
        reply(['error'=>'Le nom et la profession sont verrouillés pour cette aventure.'], 422);
    }
    foreach (['Charisme','Combat','Magie','Piété','Exploration','Adresse'] as $i => $name) {
        if ($state['skills'][$name]['initial'] !== $c['skills'][$i]) reply(['error'=>'Les compétences initiales sont verrouillées. Modifiez uniquement les valeurs actuelles.'], 422);
        if ($a['status'] === 'locked' && ($state['skills'][$name]['current'] < 1 || $state['skills'][$name]['current'] > 12)) reply(['error'=>'Les compétences de base actuelles doivent rester entre 1 et 12.'], 422);
    }
}
