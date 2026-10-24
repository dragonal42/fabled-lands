# Vérification du tutoriel français du tome 1

Source primaire : PDF de six pages fourni par l’utilisateur, intitulé « Explorer le monde de Fabled Lands », pour **Le Royaume déchiré**. Le tableau des professions a été contrôlé sur l’image de la page 1, car l’extraction du texte omettait deux chiffres du Guerrier. Le PDF n’est pas redistribué dans le dépôt.

## Création

Les caractéristiques sont déterminées par la profession, sans tirage. Dans l’ordre Charisme, Combat, Magie, Piété, Exploration, Adresse :

| Profession | Valeurs initiales |
| --- | --- |
| Prêtre | 4, 2, 3, 6, 4, 2 |
| Mage | 2, 2, 6, 1, 5, 3 |
| Voleur | 5, 4, 4, 1, 2, 6 |
| Troubadour | 6, 3, 4, 3, 2, 4 |
| Guerrier | 3, 6, 2, 4, 3, 2 |
| Voyageur | 2, 5, 2, 3, 6, 4 |

Au départ du tome 1, toutes les professions ont **niveau 1, endurance 9/9, 16 chardes, une épée et un gilet en cuir (Défense +1)**. Cela occupe deux emplacements. La carte, les armes propres à chaque profession et l’ancien libellé « Explorateur » venaient de JaFL ; ils ne correspondent pas à cette création française.

Le nouveau jeu de règles est `fr-tome1-v1`. Le nom proposé au hasard et la confirmation définitive sont des fonctionnalités du carnet, pas des règles de création attribuées au livre.

## Mécanismes vérifiés

| Mécanisme | Référence dans le PDF | Fonctionnement du carnet |
| --- | --- | --- |
| Compétences de base entre 1 et 12 | p. 1 et 6 | Bornes des saisies et validation serveur des personnages générés. Les bonus sont saisis séparément. |
| Maximum d’endurance | p. 2 | Sa variation modifie aussi l’endurance actuelle du même montant. 8/13 devient 12/17 pour +4. La saisie progressive de « 17 » conserve bien cet écart. Les valeurs restent dans 0…maximum. |
| Blessures et soins | p. 2 et 6 | Seule l’endurance actuelle change ; le maximum ne change pas. À 0, consulter les possibilités de résurrection. Le carnet n’efface pas automatiquement l’aventure. |
| Défense | p. 3 | Combat naturel actuel + niveau + bonus d’armure. Le bonus d’arme n’est pas ajouté à la Défense. |
| Attaque | p. 3 | 2D6 + Combat ; seul l’excédent sur la Défense inflige des dégâts. Une égalité inflige 0. |
| Exemple du gobelin | p. 3 | Avec Combat 4 et un jet de 8, attaque 12 contre Défense 7 : 5 dégâts. Riposte 6 + Combat 5 = 11 contre Défense 9 : 2 dégâts subis. |
| Tests | p. 4 | Une difficulté facultative peut être saisie. Il faut un total strictement supérieur ; 9 contre 9 échoue et 10 contre 9 réussit. |
| Objets | p. 2–3 | 12 objets, quantités comprises : trois exemplaires réservent trois emplacements. Refus du treizième objet côté serveur, réserves séparées et argent hors inventaire. |
| Bonus et armures | p. 3 et 6 | Rappel explicite : meilleur bonus d’objet par compétence et meilleure armure portée, sans cumul. Leurs effets restent à reporter manuellement dans la fiche. |
| Codes et cases | p. 4–6 | Acquisition/perte selon le texte, conservation lors d’un changement de tome. Le livret de suivi fourni reste la source des listes et cases répétées. |
| Équipage | p. 4 | Mauvais, moyen, bon, hors pair ; choix limité à cette échelle. Les évolutions suivent le texte. |
| Bénédictions | p. 6 | L’aide rappelle l’absence de cumul d’un même type. Les descriptions libres restent un suivi manuel, sans interprétation automatique. |
| Changer de tome | p. 5–6 | Changer le marque-page conserve personnage, possessions, argent, navires, réserves, codes et cases. |
| Nouvelle aventure | p. 5 | La suppression confirmée efface le contenu du carnet et conserve le prénom. Une éventuelle résurrection se gère avant de choisir cette action. |

Le journal de combat laisse le joueur alterner les boutons d’attaque : l’aide précise qu’il attaque en premier, sauf exception indiquée dans le passage. Le carnet ne force pas un ordre qui empêcherait d’appliquer ces exceptions.

Les frais de dépôt de 10 %, les sanctuaires détaillés, les listes de codes et les cases répétées proviennent du **livret de suivi** antérieur ; ils ne sont pas présentés comme des règles déduites du présent tutoriel.

## Compatibilité

Les personnages déjà validés ne sont ni réécrits ni réinitialisés. `creation-rules-jafl.json` conserve les données de l’ancienne version pour vérifier leurs fiches de création immuables. Ils peuvent continuer à enregistrer leur progression et gérer leur équipement. Les nouveaux départs au tome 1 utilisent le tutoriel français. Les inventaires anciens déjà surchargés restent sauvegardables, mais ne peuvent pas augmenter leur surcharge ; le joueur peut réduire les quantités ou stocker des objets.

Les nouveaux départs aux tomes 2 à 6 utilisent encore les valeurs JaFL ; le libellé de profession devient Voyageur, mais **leurs règles françaises ne sont pas certifiées par ce PDF du tome 1**.

## Aide dans le logiciel

Un encart repliable présente les conseils et la source dans chaque rubrique. L’écran « Règles & astuces » regroupe ces conseils et le tableau des six professions. Les textes de ces aides sont des synthèses, pas une reproduction du tutoriel.

## Cartes françaises

Page fournie : https://www.fabledlands.fr/2020/04/carte-du-monde.html?m=1 — monde complet et tomes 1 à 4 selon l’indication de l’utilisateur.

La page n’a pas pu être consultée depuis cet environnement : le proxy réseau a refusé la connexion HTTPS avec une réponse 403. L’accès à `www.fabledlands.fr` a été ajouté au brouillon de configuration réseau, mais sa sauvegarde ne l’applique pas automatiquement à l’instance. Les URL des images ne sont donc pas inventées et aucune carte anglaise n’est étiquetée française.

La carte française complète du monde a ensuite été fournie directement par l’utilisateur. Son image originale de 1280 × 795 pixels est incluse dans `assets/maps/monde-fr.jpg`, sans recompression ni chargement externe. Elle remplace l’aperçu anglais du monde et s’ouvre dans la visionneuse agrandie. La carte française du Sokara (tome 1), également fournie par l’utilisateur, est intégrée dans `assets/maps/sokara-fr.jpg` dans sa résolution originale, sans recompression. La carte française du Golnir (tome 2) est également intégrée dans `assets/maps/golnir-fr.jpg`, dans sa résolution originale et sans recompression. La carte française du tome 3 est intégrée dans `assets/maps/ocean-violet-fr.jpg`, sans recompression ; la nouvelle image fournie remplace la miniature et mesure 977 × 1280 pixels. La carte française du tome 4 est désormais intégrée dans `assets/maps/grandes-steppes-fr.jpg`, sans recompression ; la nouvelle image fournie remplace la miniature et mesure 946 × 1280 pixels. Les cartes françaises demandées du monde et des tomes 1 à 4 sont donc toutes incluses localement. Seules les deux cartes régionales JaFL des tomes 5 et 6 restent **en anglais**. Le lien français et l’import personnel sont conservés.
