'use strict';
let creationRules=null,mapCatalog=[],draftCandidate=null;
const assetsReady=Promise.all([
  fetch('assets/creation-rules.json').then(r=>{if(!r.ok)throw Error('Règles de création indisponibles.');return r.json();}).then(data=>creationRules=data),
  fetch('assets/map-catalog.json').then(r=>{if(!r.ok)throw Error('Bibliothèque de cartes indisponible.');return r.json();}).then(data=>mapCatalog=data)
]);
const identityLocked=()=>state?.adventure?.status!=='draft';
function legacyAdventure(raw){
  return {id:'legacy',status:'legacy',createdAt:'',creation:{ruleset:'legacy',name:raw.hero.name,profession:raw.hero.profession,skills:SKILLS.map(n=>raw.skills[n].initial)}};
}
function enhanceNumbers(root=document){
  root.querySelectorAll('input[type="number"]').forEach(input=>{
    if(input.closest('.number-control'))return;
    const label=input.getAttribute('aria-label')||input.closest('label')?.querySelector('span')?.textContent||input.name||'valeur';
    input.setAttribute('aria-label',label);input.dataset.validValue=input.value;
    const wrap=document.createElement('span');wrap.className='number-control';
    input.before(wrap);wrap.append(input);
    for(const delta of [-1,1]){
      const button=document.createElement('button');button.type='button';button.dataset.numberStep=delta;button.textContent=delta<0?'−':'+';
      button.setAttribute('aria-label',(delta<0?'Diminuer ':'Augmenter ')+label+' de 1');
      if(delta<0)wrap.prepend(button);else wrap.append(button);
    }
    if(input.dataset.field==='gold'||['amount','load','capacity'].includes(input.name)){
      const quick=document.createElement('span');quick.className='number-jumps';
      for(const delta of [-10,10]){const b=document.createElement('button');b.type='button';b.dataset.numberStep=delta;b.textContent=delta>0?'+10':'−10';b.setAttribute('aria-label',(delta>0?'Augmenter ':'Diminuer ')+label+' de 10');quick.append(b);}
      wrap.append(quick);wrap.classList.add('with-jumps');
    }
    input.addEventListener('focus',()=>{if(!input.readOnly)input.select();});
    input.addEventListener('input',()=>{if(input.value!==''&&input.validity.valid&&Number.isSafeInteger(Number(input.value)))input.dataset.validValue=input.value;updateNumberButtons(input);});
    input.addEventListener('blur',()=>{if(input.value===''||!input.validity.valid){input.value=input.dataset.validValue;input.dispatchEvent(new Event('input',{bubbles:true}));}updateNumberButtons(input);});
    updateNumberButtons(input);
  });
}
function updateNumberButtons(input){
 const wrap=input.closest('.number-control');if(!wrap)return;
 const value=Number(input.value),min=input.min===''?-Number.MAX_SAFE_INTEGER:Number(input.min),max=input.max===''?Number.MAX_SAFE_INTEGER:Number(input.max);
 wrap.querySelectorAll('button').forEach(b=>{b.disabled=input.disabled||input.readOnly||(Number(b.dataset.numberStep)<0?value<=min:value>=max);});
}
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-number-step]');if(!button)return;
 event.preventDefault();const input=button.closest('.number-control').querySelector('input');if(input.disabled||input.readOnly)return;
 const min=input.min===''?-Number.MAX_SAFE_INTEGER:Number(input.min),max=input.max===''?Number.MAX_SAFE_INTEGER:Number(input.max);
 const value=input.value===''?Number(input.dataset.validValue):Number(input.value);const next=Math.max(min,Math.min(max,value+Number(button.dataset.numberStep)));
 if(!Number.isSafeInteger(next))return;input.value=String(next);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));updateNumberButtons(input);
});
function creationView(){
 const professions=Object.keys(creationRules.books['1'].professions);
 return pageHead('UNE NOUVELLE AVENTURE','Qui serez-vous cette fois ?','Choisissez votre profession et votre livre de départ. Rien n’est définitif avant votre validation.')+`<section class="panel creation-panel"><form id="creation-form"><div class="form-grid"><label class="field"><span>Profession choisie</span><select name="profession" required>${professions.map(n=>`<option ${draftCandidate?.creation.profession===n?'selected':''}>${esc(n)}</option>`).join('')}</select></label><label class="field"><span>Livre de départ</span><select name="book">${[1,2,3,4,5,6].map(n=>`<option value="${n}" ${draftCandidate?.creation.book===n?'selected':''}>Livre ${n}</option>`).join('')}</select></label></div><p class="hint">Votre profession fixe vos compétences : le tutoriel du tome 1 confirme des valeurs fixes, sans tirage de caractéristiques ni choix de race. Le nom proposé est aléatoire et reste modifiable avant validation.</p><button type="submit" class="primary">✧ ${draftCandidate?'Régénérer le personnage':'Générer mon personnage'}</button></form></section>${draftCandidate?candidateView():empty('♙','Votre personnage attend son histoire','Choisissez une profession, puis générez la fiche de départ.')}<section class="panel rules-reference"><h2>Des valeurs vérifiées dans votre livre</h2><p>Le tome 1 suit votre tutoriel français : profession au choix, niveau 1, endurance 9, 16 chardes, une épée et un gilet en cuir. Les autres tomes utilisent encore les valeurs JaFL, dans l’attente de leurs tutoriels français.</p><button class="text-button" data-nav="rules">Comprendre les règles et les astuces →</button></section><section class="panel"><h2>Vous avez déjà une sauvegarde ?</h2><p>Vous pouvez restaurer un carnet existant avant de créer un nouveau personnage.</p>${button('import','↑ Restaurer un fichier')}<input type="file" id="import-file" accept="application/json,.json" hidden></section>`;
}
function candidateView(){
 const c=draftCandidate.creation;
 return `<section class="panel candidate"><span class="eyebrow">PROPOSITION · LIVRE ${c.book}</span><h2>Un nouveau ${esc(c.profession.toLowerCase())}</h2><label class="field"><span>Nom du personnage</span><input id="candidate-name" maxlength="80" value="${esc(c.name)}" autocomplete="off"></label><div class="candidate-values"><div><span>Niveau</span><b>${c.rank}</b></div><div><span>Endurance</span><b>${c.stamina}</b></div><div><span>Armure</span><b>+${c.armour}</b></div><div><span>Bourse</span><b>${c.gold}</b></div></div><div class="skill-mini">${SKILLS.map((n,i)=>`<div><span>${n}</span><b>${c.skills[i]}</b></div>`).join('')}</div><h3 class="equipment-title">Équipement de départ</h3><ul>${c.inventory.map(r=>`<li>${esc(r.name)}${r.notes?' · '+esc(r.notes):''}</li>`).join('')}</ul><p class="hint">Après validation, le nom, la profession et les compétences initiales seront verrouillés. Les valeurs actuelles continueront à évoluer pendant le jeu.</p><div class="button-row"><button class="secondary" data-action="reroll-character">↻ Régénérer un autre</button><button class="primary" data-action="finalize-character">Sauvegarder définitivement</button></div></section>`;
}
function generateCandidate(profession,book){
 const start=creationRules.books[String(book)];const data=start?.professions[profession];if(!data)throw Error('Cette profession ou ce livre ne possède pas de règles vérifiées.');
 const names=['Aëlys','Soren','Maëla','Eldan','Naëli','Orin','Liora','Tavren','Éline','Kaël','Alwen','Méran'];
 let name;do{name=names[(rollDie()-1)*2+(rollDie()%2)];}while(name===draftCandidate?.creation.name);
 const creation={ruleset:start.ruleset||creationRules.id,book,name,profession,rank:start.rank,stamina:start.stamina,armour:data.armour,gold:start.gold,skills:clone(data.skills),inventory:clone(data.inventory)};
 draftCandidate={creation};render();
}
async function flushSaves(){await save();while(saving)await new Promise(resolve=>setTimeout(resolve,30));if(dirty||conflict)throw Error('Synchronisez le carnet et résolvez tout conflit avant cette opération.');}
async function finalizeCharacter(){
 if(!draftCandidate||identityLocked())return;
 const candidate=clone(draftCandidate.creation);candidate.name=$('#candidate-name').value.trim();if(!candidate.name)return toast('Donnez un nom à ce personnage.');
 const result=await Swal.fire({title:'Commencer cette aventure ?',text:`${candidate.name}, ${candidate.profession}. Le nom, la profession et les valeurs initiales ne pourront plus être modifiés dans cette aventure.`,icon:'question',showCancelButton:true,confirmButtonText:'Sauvegarder définitivement',cancelButtonText:'Revoir mon personnage',reverseButtons:true,focusCancel:true,heightAuto:false,showLoaderOnConfirm:true,allowOutsideClick:()=>!Swal.isLoading(),preConfirm:async()=>{
   try{
     await flushSaves();const next=fresh();next.adventure={...state.adventure,status:'locked',creation:candidate};
     next.hero={...next.hero,name:candidate.name,profession:candidate.profession,rank:candidate.rank,stamina:candidate.stamina,maxStamina:candidate.stamina,armour:candidate.armour};
     next.skills=Object.fromEntries(SKILLS.map((n,i)=>[n,{initial:candidate.skills[i],current:candidate.skills[i],bonus:0,reason:''}]));next.position={book:candidate.book,section:1};next.gold=candidate.gold;next.inventory=candidate.inventory.map(r=>({...r,id:uid()}));
     const result=await api({action:'save',id:profile.id,version,state:next});state=next;version=result.version;dirty=false;cache();draftCandidate=null;return true;
   }catch(e){Swal.showValidationMessage(e.message);return false;}
 }});
 if(result.isConfirmed){view='home';render();toast('Personnage définitif enregistré. Bonne aventure !');}
}
async function deleteAdventure(){
 const result=await Swal.fire({title:'Supprimer cette aventure ?',text:'Tout le contenu du carnet sera effacé : personnage, possessions, quêtes, navires et cartes personnelles. Votre prénom restera disponible. Pensez à exporter une sauvegarde.',icon:'warning',showCancelButton:true,confirmButtonText:'Oui, supprimer l’aventure',cancelButtonText:'Conserver mon aventure',reverseButtons:true,focusCancel:true,heightAuto:false,confirmButtonColor:'#a44736',showLoaderOnConfirm:true,allowOutsideClick:()=>!Swal.isLoading(),preConfirm:async()=>{
   try{await flushSaves();const result=await api({action:'reset',id:profile.id,version,confirmation:'SUPPRIMER'});clearTimeout(saveTimer);state=fresh();version=result.version;dirty=false;conflict=false;draftCandidate=null;local.remove(cacheKey(profile.id));cache();return true;}
   catch(e){Swal.showValidationMessage(e.message);return false;}
 }});
 if(result.isConfirmed){view='home';render();toast('Aventure supprimée. Vous pouvez créer un nouveau personnage.');}
}
function catalogView(){
 return `<section class="panel french-map-source"><span class="eyebrow">VERSION FRANÇAISE · MONDE ET TOMES 1 À 4</span><h2>Les cartes de votre édition</h2><p>Le site que vous avez indiqué réunit les cartes françaises. Ouvrez la page pour les consulter ou importez une image dans votre carnet.</p><a class="primary" href="https://www.fabledlands.fr/2020/04/carte-du-monde.html?m=1" target="_blank" rel="noopener">Consulter les cartes françaises →</a></section><section class="panel"><div class="panel-head"><h2>Cartes complémentaires en anglais</h2><span class="subtle-tag">MONDE + 6 RÉGIONS</span></div><p class="hint">Cartes de l’application JaFL, hébergées sur son dépôt source. Les légendes originales sont en anglais ; leur chargement nécessite Internet.</p><div class="record-grid map-library">${mapCatalog.map(r=>`<article class="record"><button class="map-thumbnail" data-catalog-map="${r.id}" aria-label="Ouvrir ${esc(r.title)}"><img src="${esc(r.image)}" alt="Carte de ${esc(r.title)}" loading="lazy"><span>⤢ Agrandir</span></button><span class="eyebrow">${r.book?'LIVRE '+r.book:'CARTE DU MONDE'}</span><h3>${esc(r.title)}</h3><a class="text-button" href="${esc(r.source)}" target="_blank" rel="noopener">Source JaFL →</a></article>`).join('')}</div><p class="hint">Livres : Dave Morris et Jamie Thomson. Illustrations créditées à Russ Nicholson dans JaFL. Les cartes restent hébergées à la source et ne sont pas copiées dans vos sauvegardes.</p></section>`;
}
document.addEventListener('submit',event=>{
 if(event.target.id!=='creation-form')return;event.preventDefault();const data=new FormData(event.target);generateCandidate(String(data.get('profession')),Number(data.get('book')));
});
