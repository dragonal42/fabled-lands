'use strict';
const $ = (s, root = document) => root.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone = value => JSON.parse(JSON.stringify(value));
const uid = () => crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
const SKILLS = ['Charisme','Combat','Magie','Piété','Exploration','Adresse'];
const NAV = [ ['home','⌂','Mon aventure'], ['hero','♙','Personnage'], ['inventory','◇','Possessions'], ['journal','✎','Journal & quêtes'], ['codes','⌘','Codes'], ['sections','☑','Cases de section'], ['money','◉','Bourse & dépôts'], ['ships','⚓','Mes navires'], ['cults','✧','Cultes & effets'], ['combat','⚔','Combats & dés'], ['maps','◎','Mes cartes'], ['backup','↑','Sauvegardes'], ['rules','?','Règles & astuces'] ];
const TEMPLE_DATA = [['Elnir','Autorité et Loi','Charisme'],['Tyrnai','Guerre','Combat'],['Molhern','Savoir et Magie','Magie'],['Lacuna','Nature','Exploration'],['Sig','Vagabonds','Adresse'],['Alvir et Valmir','Mer','Protection des Tempêtes'],['Maka','Maladie et famine','Immunités aux maladies et poisons'],['Nagil','Mort',''],['Les Trois Fortunes','Chance','Relancer les dés'],['Badogor','Indicible',''],['Ebron','Uttaku','Défense'],['Glimbinki','Esprit','Exploration / Magie'],['Jiarosh','Volcan','Protection des Tempêtes']];
function fresh() {
  return {schema:1,adventure:{id:uid(),status:'draft',createdAt:new Date().toISOString(),creation:null},hero:{name:'',profession:'',rank:1,stamina:9,maxStamina:9,armour:0,titles:''},skills:Object.fromEntries(SKILLS.map(k=>[k,{initial:0,current:0,bonus:0,reason:''}])),position:{book:1,section:1},mapStamps:[],readingHistory:[],gold:0,inventory:[],storage:[],notes:'',quests:[],codes:{},sections:{},investments:[],deposits:[],ships:[],effects:[],temples:TEMPLE_DATA.map(([name,domain,blessing])=>({id:uid(),name,domain,blessing,active:false,location:'',book:1,section:1,notes:''})),resurrections:[],combats:[],maps:[],dice:[]};
}
// Une liste blanche reconstruit les sauvegardes importées et exclut les clés arbitraires.
const RECORDS = {
 inventory:{name:'',quantity:1,notes:''},storage:{location:'',book:1,section:1,items:''},quests:{title:'',book:1,section:1,notes:'',done:false},investments:{location:'',book:1,section:1,amount:0,notes:''},deposits:{location:'',book:1,section:1,amount:0,fee:10,notes:''},ships:{name:'',type:'',crew:'moyen',capacity:0,load:0,cargo:'',port:''},effects:{type:'Bénédiction',origin:'',consequence:''},temples:{name:'',domain:'',blessing:'',active:false,location:'',book:1,section:1,notes:''},resurrections:{origin:'',location:'',book:1,section:1},combats:{name:'',combat:0,defence:0,stamina:0,notes:'',finished:false},maps:{title:'',book:1,image:'',notes:''},dice:{at:'',label:'',rolls:'',total:0}
};
function normalize(raw) {
  if (!raw || raw.schema !== 1 || !raw.hero || !raw.skills || !raw.position || !Array.isArray(raw.inventory)) throw Error('Ce fichier n’est pas une sauvegarde de ce carnet.');
  const base = fresh();
  const match = (v,d) => typeof v === typeof d && (typeof v !== 'number' || Number.isSafeInteger(v)) ? v : d;
  for (const key of ['hero','position']) for (const field in base[key]) base[key][field]=match(raw[key]?.[field],base[key][field]);
  base.position.book=Math.max(1,base.position.book);base.position.section=Math.max(1,base.position.section);
  for (const name of SKILLS) for (const field in base.skills[name]) base.skills[name][field]=match(raw.skills?.[name]?.[field],base.skills[name][field]);
  for (const key of ['gold','notes']) base[key]=match(raw[key],base[key]);
  base.gold=Math.max(0,base.gold);base.hero.rank=Math.max(1,base.hero.rank);base.hero.armour=Math.max(0,base.hero.armour);base.hero.maxStamina=Math.max(0,base.hero.maxStamina);base.hero.stamina=Math.max(0,Math.min(base.hero.stamina,base.hero.maxStamina));
  for (const [key,shape] of Object.entries(RECORDS)) {
    if (!Array.isArray(raw[key]) || (key!=='maps'&&raw[key].length>1000)) throw Error('Liste manquante ou trop longue : '+key);
    base[key]=raw[key].map(entry=>{
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw Error('Entrée invalide : '+key);
      const row={id:typeof entry.id==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(entry.id)?entry.id:uid()};
      for (const field in shape) row[field]=match(entry[field],shape[field]);
      for (const field in shape) if(typeof shape[field]==='number'&&key!=='dice') {
        const minimum=['book','section','quantity'].includes(field)?1:0;
        if(row[field]<minimum)throw Error('Une valeur de '+key+' est inférieure au minimum.');
      }
      if(key==='deposits'&&row.fee>100)throw Error('Les frais de dépôt dépassent 100 %.');
      if(key==='ships'&&(row.load>row.capacity||!['mauvais','moyen','bon','hors pair'].includes(row.crew)))throw Error('Manifeste de navire invalide.');
      if (key==='maps' && row.image && !(/^(data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+|getApi\.php\?photo=[a-f0-9]{32}&owner=[a-f0-9]{32})$/.test(row.image))) throw Error('Image de carte non reconnue.');
      return row;
    });
  }
  if(base.inventory.length>12)throw Error('Le sac dépasse les 12 emplacements du livret.');
  if(base.dice.length>50)throw Error('La sauvegarde contient trop de cartes ou de jets de dés.');
  for (const key of ['codes','sections']) {
    if(!raw[key] || typeof raw[key]!=='object')throw Error('Suivi manquant : '+key);
    for (const [k,v] of Object.entries(raw[key])) if(k.length<150 && typeof v==='boolean') Object.defineProperty(base[key],k,{value:v,writable:true,enumerable:true,configurable:true});
  }
  if(raw.mapStamps!==undefined){
    if(!Array.isArray(raw.mapStamps)||raw.mapStamps.length>10000)throw Error('Tampons de carte invalides.');
    base.mapStamps=raw.mapStamps.map(row=>{
      if(!row||typeof row.id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(row.id)||typeof row.mapId!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(row.mapId)||!STAMP_TYPES.some(type=>type[0]===row.kind)||!Number.isFinite(row.x)||row.x<0||row.x>1||!Number.isFinite(row.y)||row.y<0||row.y>1)throw Error('Tampon de carte invalide.');
      return {id:row.id,mapId:row.mapId,kind:row.kind,x:row.x,y:row.y};
    });
  }
  if(raw.readingHistory!==undefined){
    if(!Array.isArray(raw.readingHistory)||raw.readingHistory.length>10000)throw Error('Historique de lecture invalide.');
    base.readingHistory=raw.readingHistory.map(row=>{
      if(!row||typeof row!=='object'||typeof row.id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(row.id)||!Number.isSafeInteger(row.book)||row.book<1||!Number.isSafeInteger(row.section)||row.section<1||typeof row.at!=='string'||(row.at!==''&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(row.at)||!Number.isFinite(Date.parse(row.at)))))throw Error('Passage invalide dans l’historique de lecture.');
      return {id:row.id,book:row.book,section:row.section,at:row.at};
    });
  }
  if(raw.adventure){
    const a=raw.adventure;
    if(typeof a.id!=='string'||!['draft','locked','legacy'].includes(a.status)||typeof a.createdAt!=='string'||(a.status!=='draft'&&(!a.creation||typeof a.creation!=='object')))throw Error('État de création du personnage invalide.');
    base.adventure={id:a.id,status:a.status,createdAt:a.createdAt,creation:a.creation?clone(a.creation):null};
  }else base.adventure=legacyAdventure(base);
  return base;
}
let profile=null,state=null,version=0,view='home',profiles=[],filter='',sectionBook=1;
let dirty=false,saving=false,conflict=false,saveTimer=null,cacheWarned=false,switching=false;
const cacheKey = id=>'fl.carnet.'+id;
const local = {
  get(key) {try{return JSON.parse(localStorage.getItem(key));}catch{return null;}},
  set(key,value) {try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{if(!cacheWarned){cacheWarned=true;toast('Stockage local plein ou indisponible. Exportez une sauvegarde.');}return false;}},
  remove(key){try{localStorage.removeItem(key);}catch{}}
};
function cache() {if(profile&&state)local.set(cacheKey(profile.id),{state,version,dirty,at:new Date().toISOString()});}
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),4500);}
async function api(body=null,id='') {
  let res;
  try {res=await fetch('getApi.php'+(id?'?id='+encodeURIComponent(id):''),body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});}catch{throw Error('Connexion indisponible. Vos modifications restent sur cet appareil.');}
  const data=await res.json().catch(()=>({error:'Le serveur ne répond pas au format attendu.'}));
  if(!res.ok){const error=Error(data.error||'Erreur du serveur.');error.status=res.status;throw error;}return data;
}
function statusText(){return conflict?'Conflit à résoudre':saving?'Enregistrement…':dirty?'En attente de connexion':'Sauvegardé';}
function updateStatus(){document.querySelectorAll('[data-sync]').forEach(el=>{el.textContent=statusText();el.classList.toggle('pending',dirty||conflict);});}
function changed(){dirty=true;cache();updateStatus();clearTimeout(saveTimer);saveTimer=setTimeout(save,650);}
async function save(){
  if(!profile||!dirty||saving||conflict)return;
  saving=true;updateStatus();
  try {
    while(dirty&&!conflict){
      const snapshot=JSON.stringify(state);
      const result=await api({action:'save',id:profile.id,version,state:JSON.parse(snapshot)});
      version=result.version;dirty=JSON.stringify(state)!==snapshot;cache();
    }
  } catch(e){
    if(e.status===409){conflict=true;toast(e.message);render();}
    else toast(e.message);
  } finally {saving=false;updateStatus();}
}
async function enter(item){
  if(switching)return;switching=true;
  try {
    const saved=local.get(cacheKey(item.id));let remote;
    try{remote=await api(null,item.id);}catch(e){if(!saved)throw e;toast('Mode local : synchronisation à la reconnexion.');}
    let selected=remote?.state;let selectedVersion=remote?.version??saved?.version??0;let pending=false;
    conflict=false;
    if(saved?.dirty){selected=saved.state;pending=true;conflict=!!remote&&remote.version!==saved.version;selectedVersion=saved.version;}
    else if(!remote&&saved){selected=saved.state;selectedVersion=saved.version;}
    const next=selected?normalize(selected):fresh();
    profile={id:item.id,name:remote?.name||item.name};state=next;version=selectedVersion;dirty=pending||!selected;
    local.set('fl.session',profile);cache();view='home';draftCandidate=null;render();
    if(dirty&&!conflict)await save();
  }catch(e){toast(e.message);}finally{switching=false;}
}
async function showProfiles(){
  try{profiles=(await api()).profiles;local.set('fl.profiles',profiles);}catch(e){profiles=local.get('fl.profiles')||[];toast(e.message);}
  renderProfiles();
}
function renderProfiles(){
  $('#app').innerHTML=`<main class="welcome"><div class="welcome-art"><span class="eyebrow">LES TERRES FABULEUSES</span><div class="compass-large">✧</div><h1>Chaque aventure<br>mérite son carnet.</h1><p>Gardez le fil de votre voyage.<br>Le reste appartient à votre imagination.</p><span class="edition">LE COMPAGNON DE VOTRE LIVRE-JEU</span></div><section class="welcome-form"><div class="brand small"><img src="assets/icon.svg" alt=""><span>Terres<br><b>fabuleuses</b></span></div><span class="eyebrow">BIENVENUE À BORD</span><h2>Qui part à l’aventure ?</h2><p>Un prénom suffit. Choisissez votre carnet ou commencez un nouveau voyage.</p><div class="profile-list">${profiles.length?profiles.map(p=>`<button class="profile-card" data-enter="${esc(p.id)}"><span class="avatar">${esc(p.name.slice(0,1))}</span><span><b>${esc(p.name)}</b><small>Reprendre l’aventure</small></span><span>→</span></button>`).join(''):'<div class="empty compact">Votre premier carnet vous attend.</div>'}</div><form id="profile-form"><label for="first-name">Votre prénom</label><div class="input-action"><input id="first-name" name="name" required maxlength="40" autocomplete="given-name" placeholder="Ex. Camille"><button class="primary" type="submit">Créer mon carnet <span>→</span></button></div><p class="form-error" id="profile-error" role="alert"></p></form><p class="privacy">◈ Les profils sont partagés et accessibles sans mot de passe. Le dernier profil s’ouvre automatiquement sur cet appareil.</p></section></main>`;
}
const totalSkill=name=>state.skills[name].current+state.skills[name].bonus;
const defence=()=>state.hero.rank+state.hero.armour+state.skills.Combat.current;
const button=(action,label,cls='secondary')=>`<button class="${cls}" data-action="${action}">${label}</button>`;
function field(path,label,type='text',options={}){
 const value=path.split('.').reduce((o,k)=>o?.[k],state);
 const attrs=`${options.readOnly?'readonly':''} data-field="${esc(path)}" ${options.min!==undefined?`min="${options.min}"`:''} ${options.max!==undefined?`max="${options.max}"`:''}`;
 return `<label class="field ${options.wide?'wide':''}"><span>${label}</span>${type==='textarea'?`<textarea ${attrs} rows="${options.rows||3}">${esc(value)}</textarea>`:`<input type="${type}" ${attrs} value="${esc(value)}" ${type==='number'?'inputmode="numeric" step="1"':''} ${options.placeholder?`placeholder="${esc(options.placeholder)}"`:''}>`}</label>`;
}
const pageHead=(kicker,title,desc,action='')=>`<div class="page-heading"><div><span class="eyebrow">${kicker}</span><h1>${title}</h1><p>${desc}</p></div>${action}</div>`;
const empty=(icon,title,text,action='')=>`<div class="empty"><span class="empty-icon">${icon}</span><h3>${title}</h3><p>${text}</p>${action}</div>`;
const progress=()=>Math.min(100,state.hero.maxStamina?state.hero.stamina/state.hero.maxStamina*100:0);
function render(){
 if(!profile)return renderProfiles();
 const item=NAV.find(x=>x[0]===view)||NAV[0];
 $('#app').innerHTML=`<div class="app-shell"><aside class="sidebar"><a class="brand" href="#home" aria-label="Accueil"><img src="assets/icon.svg" alt=""><span>Terres<br><b>fabuleuses</b></span></a><div class="sidebar-label">VOTRE CARNET D’AVENTURE</div><nav>${NAV.map(([id,icon,title])=>`<a href="#${id}" class="nav-item ${view===id?'active':''}"><span>${icon}</span>${title}${id==='quests'?'':''}</a>`).join('')}</nav><div class="sidebar-footer"><span class="tiny-compass">✧</span><p>Le prochain chapitre<br>n’attend que vous.</p><small>COMPAGNON DE LECTURE · FR</small></div></aside><div class="main-shell"><header class="topbar"><div class="breadcrumb">Carnet d’aventure <span>/</span><b>${item[2]}</b></div><div class="topbar-right"><span class="sync" data-sync>${statusText()}</span><button class="user-button" data-action="profiles" title="Changer de profil"><span class="avatar">${esc(profile.name.slice(0,1))}</span><b>${esc(profile.name)}</b><span>⌄</span></button></div></header><main id="content">${conflict?`<div class="notice danger">Ce carnet a changé ailleurs. Votre copie locale est conservée. <button data-nav="backup">Choisir la sauvegarde à conserver →</button></div>`:''}${renderView()}</main><footer class="page-footer"><span>TERRES FABULEUSES</span><span>Votre livre, vos choix, votre aventure.</span></footer></div><nav class="mobile-nav">${[['home','⌂','Aventure'],['hero','♙','Héros'],['inventory','◇','Sac'],['journal','✎','Journal'],['more','☰','Plus']].map(([id,icon,label])=>`<button data-nav="${id}" class="${view===id?'active':''}"><span>${icon}</span>${label}</button>`).join('')}</nav></div>`;
 updateStatus();enhanceNumbers($('#app'));
}
function renderSection(){
 if(state.adventure.status==='draft'&&view!=='rules')return creationView();
 switch(view){
 case 'home':return homeView();
 case 'rules':return rulesView();
 case 'hero':return heroView();
 case 'inventory':return inventoryView();
 case 'journal':return journalView();
 case 'codes':return codesView();
 case 'sections':return sectionsView();
 case 'money':return moneyView();
 case 'ships':return shipsView();
 case 'cults':return cultsView();
 case 'combat':return combatView();
 case 'maps':return mapsView();
 case 'backup':return backupView()+`<section class="panel adventure-danger"><h2>Une nouvelle aventure</h2><p>Pour changer de personnage, supprimez l’aventure en cours après en avoir exporté une copie. Votre prénom sera conservé.</p>${button('delete-adventure','Supprimer l’aventure en cours','danger-button')}</section>`;
 default:return pageHead('À EXPLORER','Tout votre carnet','Les petits détails font les grandes aventures.')+`<div class="menu-grid">${NAV.slice(1).map(([id,i,t])=>`<button data-nav="${id}"><span>${i}</span><b>${t}</b><span>→</span></button>`).join('')}</div>`;
 }
}
const READING_MOODS={
 1:'Au Sokara, chaque carrefour peut changer votre destin.',
 2:'Au Golnir, les routes dorées cachent mille promesses.',
 3:'L’océan Violet vous appelle : cap sur l’inconnu.',
 4:'Les Grandes Steppes s’étendent devant vous, sauvages et sans fin.',
 5:'Sous les masques d’Uttaku, chaque rencontre garde son secret.',
 6:'Les rivages d’Akatsuraï vous réservent honneur et mystères.',
 7:'Au cœur d’Ankon-Konu, la jungle murmure d’anciens secrets.'
};
function homeView(){
 const h=state.hero;const active=state.quests.filter(q=>!q.done);
 return pageHead('VOTRE VOYAGE CONTINUE',`Bon retour, ${esc(profile.name)}.`,`Ouvrez votre livre. Votre aventure vous attend.`,`<button class="secondary" data-nav="backup" aria-label="Ouvrir les sauvegardes">↑ <span>Ma sauvegarde</span></button>`)+`
 <section class="hero-banner"><div class="banner-content"><div class="tag">✧ CARNET D’EXPLORATION</div><h2>Un monde à découvrir.<br>Une histoire à écrire.</h2><p class="reading-position" aria-label="Position de lecture">Livre ${state.position.book} · Paragraphe ${state.position.section}</p><p class="reading-mood">${esc(READING_MOODS[state.position.book]||'La prochaine page vous ouvre un nouvel horizon.')}</p><button class="light-button" data-action="position">Reprendre ma lecture <span>→</span></button></div><div class="banner-compass" aria-hidden="true"><div class="compass-ring">N<span class="compass-star">✧</span><span class="compass-south">S</span></div><span class="map-caption">L’APPEL DU LARGE</span></div></section>
 <div class="metric-grid"><div class="metric"><span class="metric-icon green">♡</span><span>Endurance</span><div><b>${h.stamina}</b><small>/ ${h.maxStamina}</small></div><progress class="meter" max="100" value="${progress()}" aria-label="Endurance restante"></progress><div class="mini-actions"><button data-adjust="hero.stamina" data-delta="-1" aria-label="Perdre une endurance">−</button><small>Prendre soin de son héros</small><button data-adjust="hero.stamina" data-delta="1" aria-label="Gagner une endurance">+</button></div></div><button class="metric metric-link" data-nav="hero"><span class="metric-icon purple">♜</span><span>Défense</span><div><b>${defence()}</b><small>points</small></div><p>Niveau + armure + combat <span>→</span></p></button><button class="metric metric-link" data-nav="money"><span class="metric-icon gold">◉</span><span>Bourse</span><div><b>${state.gold.toLocaleString('fr-FR')}</b><small>chardes</small></div><p>Votre fortune en voyage <span>→</span></p></button><button class="metric metric-link" data-nav="inventory"><span class="metric-icon brown">◇</span><span>Possessions</span><div><b>${carriedCount()}</b><small>/ 12 emplacements</small></div><p>${Math.max(0,12-carriedCount())} emplacement(s) libre(s) <span>→</span></p></button></div>
 <div class="dashboard-grid"><section class="panel"><div class="panel-head"><h2>Votre personnage</h2><button class="text-button" data-nav="hero">Voir la fiche →</button></div><div class="hero-summary"><div class="portrait">♙<span>✧</span></div><div><h3>${esc(h.name||'Un héros à inventer')}</h3><p>${esc(h.profession||'Profession à choisir')} <span class="dot">·</span> Niveau ${h.rank}</p><span class="subtle-tag">LIVRE ${state.position.book} · SECTION ${state.position.section}</span></div></div><div class="skill-mini">${SKILLS.map(n=>`<div><span>${n}</span><b>${totalSkill(n)}</b></div>`).join('')}</div></section><section class="panel reading-panel"><div class="panel-head"><h2>Marque-page</h2><span class="small-symbol">⚑</span></div><p class="muted">Là où l’histoire s’est arrêtée.</p><div class="bookmark"><div><span>LIVRE</span><strong>${state.position.book}</strong></div><div class="bookmark-divider"></div><div><span>SECTION</span><strong>${state.position.section}</strong></div></div><button class="secondary full" data-action="position">Mettre à jour ma position →</button></section><section class="panel"><div class="panel-head"><h2>Quêtes en cours <span class="count">${active.length}</span></h2><button class="text-button" data-nav="journal">Le journal →</button></div>${active.length?`<div class="quest-preview">${active.slice(0,3).map(q=>`<div><span class="quest-dot"></span><div><b>${esc(q.title)}</b><small>Livre ${q.book} · § ${q.section}</small></div></div>`).join('')}</div>`:empty('⚑','L’aventure commence ici','Une promesse, une piste, une rencontre… gardez-en la trace.',button('add:quests','+ Noter une quête','text-button'))}</section><section class="panel explore-panel"><span class="eyebrow">AU-DELÀ DE L’HORIZON</span><h2>Ne perdez jamais<br>le nord.</h2><p>Vos cartes, vos navires et vos découvertes, réunis au même endroit.</p><div class="explore-links"><button data-nav="maps">◎ Mes cartes →</button><button data-nav="ships">⚓ Mes navires →</button></div></section></div><div class="quote">« Le voyage commence à la prochaine page. » <span>✧</span></div>`;
}
function heroView(){return pageHead('LA FEUILLE DE PERSONNAGE','Votre héros','Le nom, la profession et les valeurs initiales sont verrouillés. Les valeurs actuelles évoluent avec votre aventure.')+`<section class="panel"><div class="form-grid">${field('hero.name','Nom du personnage','text',{readOnly:identityLocked()})}${field('hero.profession','Profession','text',{readOnly:identityLocked()})}${field('hero.rank','Niveau','number',{min:1})}${field('hero.armour','Bonus d’armure','number',{min:0})}${field('hero.maxStamina','Endurance maximale','number',{min:0})}${field('hero.stamina','Endurance actuelle','number',{min:0,max:state.hero.maxStamina})}</div><div class="defence-callout">♜ Défense <strong id="defence-total">${defence()}</strong><span>Niveau + bonus d’armure + Combat actuel sans bonus</span></div></section><section class="panel"><div class="panel-head"><h2>Compétences</h2><span class="muted">Base actuelle + bonus / malus = total</span></div><div class="skill-table"><div class="skill-table-head"><span>Compétence</span><span>Initiale</span><span>Actuelle</span><span>Bonus / malus</span><span>Total</span></div>${SKILLS.map(n=>`<div class="skill-row"><b>${n}</b>${['initial','current','bonus'].map(k=>`<label class="skill-number"><span>${k==='initial'?'Initiale':k==='current'?'Actuelle':'Bonus / malus'}</span><input aria-label="${n} ${k==='initial'?'initiale':k==='current'?'actuelle':'bonus ou malus'}" type="number" step="1" ${k==='initial'&&identityLocked()?'readonly':''} ${k==='current'?'min="1" max="12"':''} data-field="skills.${n}.${k}" value="${state.skills[n][k]}"></label>`).join('')}<strong data-skill-total="${n}">${totalSkill(n)}</strong><label class="skill-reason"><span>Raison du bonus / malus</span><input aria-label="Raison du bonus ou malus de ${n}" data-field="skills.${n}.reason" value="${esc(state.skills[n].reason)}" placeholder="Objet, bénédiction, malédiction…"></label></div>`).join('')}</div></section><section class="panel">${field('hero.titles','Titres et honneurs','textarea',{rows:4})}</section><p class="hint">Les caractéristiques initiales ne changent plus. Ajustez les valeurs actuelles selon le livre ; les compétences de base restent entre 1 et 12.</p>`;}
const listHeading=(title,action,label)=>`<div class="panel-head"><h2>${title}</h2>${button(action,'+ '+label)}</div>`;
function recordActions(key,row){return `<div class="record-actions"><button data-edit="${key}:${esc(row.id)}" class="text-button">Modifier</button><button data-delete="${key}:${esc(row.id)}" class="icon-button" aria-label="Supprimer ${esc(row.name||row.title||row.location||row.origin||'cette entrée')}">×</button></div>`;}
function inventoryView(){return pageHead('CE QUI VOUS ACCOMPAGNE','Vos possessions','12 emplacements pour voyager. Vos réserves restent à l’abri dans les lieux de votre choix.')+`<section class="panel">${listHeading(`Sac de voyage <span class="count">${carriedCount()} / 12</span>`,'add:inventory','Ajouter un objet')}${carriedCount()>12?'<p class="notice">Ce carnet ancien dépasse les 12 objets autorisés. Réduisez les quantités ou stockez des objets ; la surcharge ne peut pas augmenter.</p>':''}<div class="inventory-grid">${inventorySlots().map(({row:r,number})=>{return r?`<article class="inventory-item"><span class="slot-number">${number}</span><span class="item-symbol">◇</span><h3>${esc(r.name)}</h3><p>Quantité : ${r.quantity} · ${r.quantity} emplacement(s)</p><p class="prewrap">${esc(r.notes)}</p>${recordActions('inventory',r)}</article>`:`<button class="inventory-item vacant" data-action="add:inventory"><span class="slot-number">${number}</span><span>+</span><small>Emplacement libre</small></button>`;}).join('')}</div><p class="hint">Chaque exemplaire occupe un emplacement. Trois objets identiques réservent trois emplacements, même si vous les notez sur une seule fiche.</p></section><section class="panel">${listHeading('Possessions stockées','add:storage','Ajouter un lieu')}${state.storage.length?`<div class="record-grid">${state.storage.map(r=>`<article class="record"><span class="eyebrow">LIVRE ${r.book} · § ${r.section}</span><h3>${esc(r.location)}</h3><p class="prewrap">${esc(r.items)}</p>${recordActions('storage',r)}</article>`).join('')}</div>`:empty('⌂','Un lieu pour vos réserves','Maisons, coffres et autres endroits sûrs.')}</section>`;}
function readingHistoryView(){
 const trail=state.readingHistory;
 return `<section class="panel reading-history"><div class="panel-head"><h2>Le chemin parcouru</h2><span class="subtle-tag">${trail.length} passage(s)</span></div><p>D’une page à l’autre, retrouvez le fil de votre voyage.</p>${trail.length?`<ol class="reading-trail">${trail.map((stop,index)=>`<li class="reading-stop"><span class="trail-number" aria-hidden="true">${index+1}</span><div><strong>Livre ${stop.book} · Paragraphe ${stop.section}</strong>${stop.at?`<time datetime="${esc(stop.at)}">${esc(new Date(stop.at).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'}))}</time>`:'<small>Point de départ du suivi</small>'}</div>${index===trail.length-1&&stop.book===state.position.book&&stop.section===state.position.section?'<span class="subtle-tag">Vous êtes ici</span>':''}</li>`).join('')}</ol>`:empty('⚑','Les premières traces de votre voyage','Chaque marque-page confirmé avec « Reprendre ma lecture » rejoint ce chemin. Les étapes antérieures restent dans vos souvenirs.')}</section>`;
}
function journalView(){return pageHead('LE FIL DE L’HISTOIRE','Journal & quêtes','Rencontres, promesses et passages importants : tout ce qui mérite de ne pas être oublié.')+`${readingHistoryView()}<section class="panel">${listHeading('Vos quêtes','add:quests','Nouvelle quête')}${state.quests.length?state.quests.map(r=>`<article class="quest-row"><label class="check"><input type="checkbox" data-toggle="quests:${esc(r.id)}:done" ${r.done?'checked':''}><span class="${r.done?'completed':''}">${esc(r.title)}</span></label><span class="subtle-tag">LIVRE ${r.book} · § ${r.section}</span><p class="prewrap">${esc(r.notes)}</p>${recordActions('quests',r)}</article>`).join(''):empty('⚑','La page est encore blanche','Notez votre prochaine mission et les personnages impliqués.')}</section><section class="panel">${field('notes','Notes de voyage','textarea',{rows:12})}<p class="hint">Les notes sont enregistrées automatiquement pendant la saisie.</p></section>`;}
function codesView(){const selected=Object.values(state.codes).filter(Boolean).length;return pageHead('LES MOTS DE VOTRE AVENTURE','Codes','Cochez uniquement les mots indiqués par le livre. Les codes restent communs à votre voyage.')+`<section class="panel"><div class="search-bar"><label><span class="sr-only">Rechercher un code</span><input type="search" id="code-search" value="${esc(filter)}" placeholder="Rechercher un code…" autocomplete="off"></label><span class="subtle-tag" id="code-count" aria-live="polite">${selected} code(s) acquis</span></div><div id="code-list">${codeList()}</div><form id="custom-code" class="input-action custom-code"><input name="code" aria-label="Nouveau code personnalisé" placeholder="Un code absent du livret ?" required maxlength="80"><button class="secondary" type="submit">+ Ajouter</button></form><p class="hint">Les codes de vos sept premiers tomes sont réunis ici. Retrouvez d’abord vos codes acquis, puis les mots qu’il vous reste à découvrir.</p></section>`;}
function codeList(){const all=[...new Set([...GAME_DATA.codes,...Object.keys(state.codes)])].sort((a,b)=>Number(Boolean(state.codes[b]))-Number(Boolean(state.codes[a]))||a.localeCompare(b,'fr'));const shown=all.filter(n=>n.toLocaleLowerCase('fr').includes(filter.toLocaleLowerCase('fr')));if(!shown.length)return empty('⌘','Aucun code trouvé','Vous pouvez l’ajouter ci-dessous.');return `<div class="code-grid">${shown.map(n=>`<label class="code-chip ${state.codes[n]?'checked':''}"><input type="checkbox" data-code="${esc(n)}" ${state.codes[n]?'checked':''}><span>${esc(n)}</span></label>`).join('')}</div>`;}
function sectionsView(){return pageHead('LES TRACES DU PASSAGE','Cases de section','Les cases et leurs répétitions suivent le livret. Chaque case se coche indépendamment.')+`<section class="panel"><div class="book-tabs" role="group" aria-label="Choisir le livre">${[1,2,3,4,5,6].map(n=>`<button data-book="${n}" class="${n===sectionBook?'active':''}">Livre ${n}</button>`).join('')}</div><div class="section-grid">${GAME_DATA.sections.filter(r=>r.book===sectionBook).map(r=>`<div class="section-item"><b>§ ${esc(r.label)}</b><div>${Array.from({length:r.count},(_,i)=>{const key=`${r.book}:${r.label}:${i}`;return `<label class="section-check"><input type="checkbox" aria-label="Livre ${r.book}, section ${esc(r.label)}, case ${i+1}" data-section="${esc(key)}" ${state.sections[key]?'checked':''}></label>`;}).join('')}</div></div>`).join('')}</div></section>`;}
function moneyView(){return pageHead('VOTRE FORTUNE','Bourse & dépôts','Gardez les sommes transportées, investies et déposées séparément.')+`<section class="panel purse"><span class="metric-icon gold">◉</span><div>${field('gold','Bourse transportée (chardes)','number',{min:0})}</div><button class="secondary" data-action="transaction">+ / − Mouvement</button></section><section class="panel">${listHeading('Investissements','add:investments','Investir')}${state.investments.length?`<div class="record-grid">${state.investments.map(r=>`<article class="record"><span class="eyebrow">LIVRE ${r.book} · § ${r.section}</span><h3>${esc(r.location)}</h3><strong class="amount">${r.amount.toLocaleString('fr-FR')} <small>chardes investis</small></strong><p class="prewrap">${esc(r.notes)}</p>${recordActions('investments',r)}</article>`).join('')}</div>`:empty('→','Faites fructifier votre fortune','Enregistrez vos investissements et modifiez leur valeur selon le livre.')}</section><section class="panel">${listHeading('Dépôts à la guilde et ailleurs','add:deposits','Ajouter un dépôt')}${state.deposits.length?`<div class="record-grid">${state.deposits.map(r=>`<article class="record"><span class="eyebrow">LIVRE ${r.book} · § ${r.section}</span><h3>${esc(r.location)}</h3><strong class="amount">${r.amount.toLocaleString('fr-FR')} <small>chardes déposés</small></strong><p>Frais de retrait : ${r.fee} %</p><p class="prewrap">${esc(r.notes)}</p><button class="secondary" data-withdraw="${esc(r.id)}">Retirer des fonds</button>${recordActions('deposits',r)}</article>`).join('')}</div>`:empty('⌂','Votre or en lieu sûr','Les frais habituels de la guilde sont de 10 % par retrait.')}</section><p class="hint">L’ajout d’un investissement ou d’un dépôt débite votre bourse. Modifier une fiche ne crée aucun transfert. Un retrait crédite le montant net après frais, arrondis au shard supérieur.</p>`;}
function shipsView(){return pageHead('L’APPEL DU LARGE','Vos navires','Noms, équipages, cargaisons et ports d’amarrage : votre manifeste de flotte.',button('add:ships','+ Ajouter un navire','primary'))+`${state.ships.length?`<div class="record-grid ships-grid">${state.ships.map(r=>`<article class="panel ship-card"><div class="ship-illustration">⚓<span>${esc(r.type||'Navire')}</span></div><div class="panel-head"><h2>${esc(r.name)}</h2><span class="subtle-tag">${esc(r.crew)}</span></div><p>⌖ ${esc(r.port||'Port non renseigné')}</p><div class="cargo-line"><span>Cargaison</span><b>${r.load} / ${r.capacity}</b></div><progress class="meter" max="100" value="${Math.min(100,r.capacity?r.load/r.capacity*100:0)}" aria-label="Cargaison du navire"></progress>${r.load>r.capacity?'<p class="error-text">La cargaison dépasse la capacité du navire.</p>':''}<p class="prewrap">${esc(r.cargo||'Cale vide')}</p>${recordActions('ships',r)}</article>`).join('')}</div>`:`<section class="panel">${empty('⚓','L’horizon vous appartient','Ajoutez votre premier navire et préparez votre prochaine traversée.',button('add:ships','+ Mon premier navire','primary'))}</section>`}`;}
function cultsView(){return pageHead('SOUS LE REGARD DES DIEUX','Cultes & effets','Sanctuaires, bénédictions, malédictions, maladies et résurrections.')+`<section class="panel">${listHeading('Bénédictions, maladies et sortilèges','add:effects','Ajouter un effet')}${state.effects.length?`<div class="record-grid">${state.effects.map(r=>`<article class="record"><span class="subtle-tag">${esc(r.type)}</span><h3>${esc(r.origin)}</h3><p class="prewrap">${esc(r.consequence)}</p>${recordActions('effects',r)}</article>`).join('')}</div>`:empty('✧','Aucun effet enregistré','Notez son origine et ses conséquences sur votre héros.')}</section><section class="panel"><div class="panel-head"><h2>Sanctuaires</h2><span class="muted">Cochez les bénédictions reçues</span></div><div class="record-grid">${state.temples.map(r=>`<article class="record temple"><span class="eyebrow">${esc(r.domain)}</span><h3>${esc(r.name)}</h3>${r.blessing?`<label class="check"><input type="checkbox" data-toggle="temples:${esc(r.id)}:active" ${r.active?'checked':''}>${esc(r.blessing)}</label>`:'<p class="muted">Aucune bénédiction indiquée</p>'}<p>${esc(r.location||'Localisation à noter')}${r.location?` · L${r.book}, § ${r.section}`:''}</p><p class="prewrap">${esc(r.notes)}</p><button class="text-button" data-edit="temples:${esc(r.id)}">Noter le sanctuaire →</button></article>`).join('')}</div><p class="hint">Les effets sont consignés ici. Reportez leurs bonus dans la fiche de personnage si le livre vous le demande.</p></section><section class="panel">${listHeading('Résurrections','add:resurrections','Noter une résurrection')}${state.resurrections.map(r=>`<article class="record"><h3>${esc(r.origin)}</h3><p>${esc(r.location)} · Livre ${r.book}, § ${r.section}</p>${recordActions('resurrections',r)}</article>`).join('')||'<p class="muted">Aucun arrangement de résurrection enregistré.</p>'}</section>`;}
function combatView(){return pageHead('QUAND LE DESTIN S’EN MÊLE','Combats & dés','Un journal de combat et des dés à portée de main. Appliquez les règles particulières indiquées dans le livre.')+`<section class="panel dice-panel"><div><span class="eyebrow">LE HASARD FAIT SON CHEMIN</span><h2>Lancer les dés</h2><p>Pour un test, comparez 2D6 + votre compétence à la difficulté du livre.</p></div><form id="dice-form"><label class="field"><span>Jet</span><select name="count"><option value="2">2 dés à 6 faces</option><option value="1">1 dé à 6 faces</option></select></label><label class="field"><span>Compétence (facultative)</span><select name="skill"><option value="">Sans bonus</option>${SKILLS.map(n=>`<option value="${n}">${n} (${totalSkill(n)})</option>`).join('')}</select></label><label class="field"><span>Difficulté (facultative)</span><input type="number" name="difficulty" min="0" step="1" inputmode="numeric" placeholder="Ex. 9"></label><button class="primary" type="submit">⚄ Lancer</button></form><div id="dice-result" class="dice-result" role="status">${state.dice[0]?diceResult(state.dice[0]):'À vous de jouer.'}</div></section><section class="panel">${listHeading('Journal des combats','add:combats','Nouvel adversaire')}<div class="combat-player"><span>Vous</span><b>Combat ${totalSkill('Combat')}</b><b>Défense ${defence()}</b><span>Endurance <button data-adjust="hero.stamina" data-delta="-1" aria-label="Perdre un point d’endurance">−</button> <strong>${state.hero.stamina}</strong> / ${state.hero.maxStamina} <button data-adjust="hero.stamina" data-delta="1" aria-label="Gagner un point d’endurance">+</button></span></div>${state.combats.length?state.combats.map(r=>`<article class="record combat-card"><div class="panel-head"><h3>${esc(r.name)}</h3><label class="check"><input type="checkbox" data-toggle="combats:${esc(r.id)}:finished" ${r.finished?'checked':''}>Terminé</label></div><div class="combat-values"><span>Combat <b>${r.combat}</b></span><span>Défense <b>${r.defence}</b></span><span>Endurance <b>${r.stamina}</b></span></div><div class="combat-actions"><button class="secondary" data-attack="${esc(r.id)}:hero" ${r.finished?'disabled':''}>Vous attaquez</button><button class="secondary" data-attack="${esc(r.id)}:enemy" ${r.finished?'disabled':''}>L’adversaire attaque</button></div><p class="prewrap">${esc(r.notes)}</p>${recordActions('combats',r)}</article>`).join(''):empty('⚔','Un peu de répit','Ajoutez un adversaire pour suivre ses statistiques et les échanges.')}</section>${state.dice.length?`<section class="panel"><h2>Derniers jets</h2>${state.dice.slice(0,10).map(r=>`<div class="history-row"><span>${esc(r.label)}<small>${esc(new Date(r.at).toLocaleString('fr-FR'))}</small></span><b>${esc(r.rolls)} → ${r.total}</b></div>`).join('')}</section>`:''}`;}
function diceResult(r){return `<span>${esc(r.label)}</span><strong>${r.total}</strong><small>${esc(r.rolls)}</small>`;}
function mapsView(){return pageHead('LE MONDE S’OUVRE À VOUS','Vos cartes','Explorez vos cartes et gardez les souvenirs de votre aventure en photos.',button('map-upload','+ Ajouter une photo','primary'))+`${catalogView()}<h2>Vos photos d’aventures</h2><input type="file" id="map-file" accept="image/png,image/jpeg,image/webp" multiple hidden>${state.maps.length?`<div class="record-grid">${state.maps.map(r=>`<article class="panel map-card"><button class="map-thumbnail" data-map="${esc(r.id)}" aria-label="Ouvrir et zoomer sur ${esc(r.title)}"><img src="${esc(r.image)}" alt="${esc(r.title)}" loading="lazy"><span>⤢ Agrandir</span></button><span class="eyebrow">LIVRE ${r.book}</span><h2>${esc(r.title)}</h2><p class="prewrap">${esc(r.notes)}</p>${recordActions('maps',r)}</article>`).join('')}</div>`:`<section class="panel map-empty">${empty('◎','Vos souvenirs prennent vie','Photos, croquis et souvenirs de lecture : composez votre album d’aventures.',button('map-upload','+ Choisir une image','primary'))}</section>`}<p class="hint">Ajoutez autant de photos que vous le souhaitez. Votre album est inclus dans les exports de votre carnet.</p>`;}
function backupView(){return pageHead('POUR LES PROCHAINS CHAPITRES','Sauvegardes','Votre carnet vous suit. Gardez aussi une copie indépendante sur votre iPhone.')+`<section class="panel"><div class="panel-head"><h2>Le carnet de ${esc(profile.name)}</h2><span class="sync" data-sync>${statusText()}</span></div><p>La base SQLite enregistre votre profil sur l’hébergement. Une copie locale protège les dernières modifications pendant une coupure réseau.</p><p class="hint">Sur cet appareil, ce profil se rouvre automatiquement. Les photos peuvent occuper beaucoup de place : l’export est votre copie de secours.</p><div class="button-row">${button('export','↓ Exporter en JSON','primary')}${button('import','↑ Restaurer un fichier')}${button('sync','↻ Synchroniser')}</div><input type="file" id="import-file" accept="application/json,.json" hidden></section>${conflict?`<section class="panel conflict-panel"><h2>Deux versions du même carnet</h2><p>Un autre appareil a enregistré des changements. Exportez votre copie locale avant de choisir. Aucune fusion automatique n’est appliquée.</p><div class="button-row">${button('remote','Conserver la version du serveur')}${button('local','Remplacer le serveur par cette copie','danger-button')}</div></section>`:''}<section class="panel"><h2>Changer d’aventurier</h2><p>La liste des prénoms reste accessible à tous les utilisateurs de cette installation.</p>${button('profiles','Afficher les utilisateurs →')}</section><section class="panel"><h2>Installer sur iPhone ou Android</h2><p><strong>iPhone :</strong> dans Safari, ouvrez Partager puis « Sur l’écran d’accueil » et confirmez Ajouter.</p><p><strong>Android :</strong> dans Chrome, ouvrez le menu ⋮ puis « Installer l’application » ou « Ajouter à l’écran d’accueil ».</p><p class="hint">Ouvrez d’abord le carnet avec une connexion HTTPS. Une fois les fichiers chargés, le profil déjà utilisé sur cet appareil peut se rouvrir hors connexion. La synchronisation des sauvegardes reprend au retour du réseau.</p></section>`;}

const FORMS={
 inventory:{title:'Un objet dans le sac',fields:[['name','Nom de l’objet','text',true],['quantity','Quantité','number',true,1],['notes','Bonus, usage et remarques','textarea']]},
 storage:{title:'Un lieu de stockage',fields:[['location','Lieu','text',true],['book','Livre','number',true,1],['section','Section','number',true,1],['items','Possessions stockées','textarea',true]]},
 quests:{title:'Une quête à suivre',fields:[['title','Nom de la quête','text',true],['book','Livre','number',true,1],['section','Section','number',true,1],['notes','Personnages, codes et détails','textarea']]},
 investments:{title:'Un investissement',fields:[['location','Lieu','text',true],['book','Livre','number',true,1],['section','Section','number',true,1],['amount','Somme investie (chardes)','number',true,0],['notes','Conditions et évolution','textarea']]},
 deposits:{title:'Un dépôt',fields:[['location','Lieu','text',true],['book','Livre','number',true,1],['section','Section','number',true,1],['amount','Somme déposée (chardes)','number',true,0],['fee','Frais au retrait (%)','number',true,0,100],['notes','Conditions du dépôt','textarea']]},
 ships:{title:'Un navire dans votre flotte',fields:[['name','Nom du navire','text',true],['type','Type de navire','text',true],['crew','Qualité de l’équipage','select',true,['mauvais','moyen','bon','hors pair']],['capacity','Cargaison maximale','number',true,0],['load','Cargaison actuelle','number',true,0],['cargo','Manifeste de cargaison','textarea'],['port','Lieu d’amarrage','text']]},
 effects:{title:'Un effet sur votre héros',fields:[['type','Nature','select',true,['Bénédiction','Malédiction','Maladie','Sortilège']],['origin','Divinité / origine','text',true],['consequence','Conséquences et durée','textarea',true]]},
 temples:{title:'Un sanctuaire',fields:[['location','Localisation, temple…','text'],['book','Livre','number',true,1],['section','Section','number',true,1],['notes','Notes','textarea']]},
 resurrections:{title:'Un arrangement de résurrection',fields:[['origin','Divinité / origine','text',true],['location','Lieu','text',true],['book','Livre','number',true,1],['section','Section','number',true,1]]},
 combats:{title:'Un nouvel adversaire',fields:[['name','Nom de l’adversaire','text',true],['combat','Combat','number',true,0],['defence','Défense','number',true,0],['stamina','Endurance','number',true,0],['notes','Règles particulières / journal','textarea']]},
 maps:{title:'Une photo d’aventure',fields:[['title','Titre de la photo','text',true],['book','Livre','number',true,1],['notes','Souvenirs et légende','textarea']]}
};
let modalHandler=null,pendingImage='';
function dialog(title,body,onSubmit=null){
 const el=$('#modal');if(el.open)el.close();
 el.innerHTML=`<div class="modal-head"><h2 id="modal-title">${title}</h2><button class="icon-button" data-close aria-label="Fermer">×</button></div>${body}`;
 modalHandler=onSubmit;el.showModal();enhanceNumbers(el);
}
function confirmDialog(title,text,callback,label='Confirmer'){
 dialog(title,`<p>${esc(text)}</p><form id="modal-form"><div class="modal-actions"><button type="button" class="secondary" data-close>Annuler</button><button class="primary" type="submit">${label}</button></div><p class="form-error" role="alert"></p></form>`,async()=>{await callback();});
}
function modalField(spec,row){
 const [key,label,type,required,min,max]=spec;const v=row[key];
 const attrs=`name="${key}" ${required?'required':''}`;
 return `<label class="field ${type==='textarea'?'wide':''}"><span>${label}</span>${type==='textarea'?`<textarea ${attrs} rows="4" maxlength="20000">${esc(v)}</textarea>`:type==='select'?`<select ${attrs}>${min.map(x=>`<option ${v===x?'selected':''}>${esc(x)}</option>`).join('')}</select>`:`<input ${attrs} type="${type}" value="${esc(v)}" ${type==='number'?`step="1" min="${min??0}" ${max!==undefined?`max="${max}"`:''} inputmode="numeric"`:'maxlength="200"'}>`}</label>`;
}
function editRecord(key,id=''){
 if(key==='inventory'&&!id&&carriedCount()>=12)return toast('Votre sac est plein : les 12 emplacements sont occupés.');
 const config=FORMS[key];if(!config)return;
 const existing=state[key].find(r=>r.id===id);const row=existing?clone(existing):{...clone(RECORDS[key]),id:uid()};
 if(!id&&'book' in row){row.book=state.position.book;row.section=state.position.section;}
 if(!id&&key==='maps')row.image=pendingImage;
 dialog(config.title,`<form id="modal-form"><div class="form-grid">${config.fields.map(f=>modalField(key==='inventory'&&f[0]==='quantity'?[...f.slice(0,5),Math.max(row.quantity,12-carriedCount()+(existing?.quantity||0))]:f,row)).join('')}</div>${!id&&['investments','deposits'].includes(key)?`<p class="hint">La somme sera prélevée sur votre bourse (${state.gold} chardes disponibles).</p>`:''}<p class="form-error" role="alert"></p><div class="modal-actions"><button type="button" class="secondary" data-close>Annuler</button><button class="primary" type="submit">Enregistrer</button></div></form>`,async form=>{
   const data=new FormData(form);for(const [k,,type] of config.fields)row[k]=type==='number'?Number(data.get(k)):String(data.get(k)||'').trim();
   for(const [k,,type] of config.fields)if(type==='number'&&!Number.isSafeInteger(row[k]))throw Error('Saisissez des nombres entiers valides.');
   if(key==='ships'&&row.load>row.capacity)throw Error('La cargaison dépasse la capacité du navire.');
   if(key==='inventory'&&carriedCount()-(existing?.quantity||0)+row.quantity>Math.max(12,carriedCount()))throw Error('Le sac est limité à 12 objets au total, quantités comprises.');
   if(!id&&['investments','deposits'].includes(key)){
     if(row.amount>state.gold)throw Error('Votre bourse ne contient pas assez de chardes.');
     state.gold-=row.amount;
   }
   if(key==='maps'&&row.image.startsWith('data:')){const owner=profile.id,adventure=state.adventure.id;row.image=await storeAdventurePhoto(row.image,owner);ensurePhotoContext(owner,adventure);}
   if(existing)state[key][state[key].findIndex(r=>r.id===id)]=row;else state[key].push(row);
   changed();render();toast('Votre carnet a été mis à jour.');
 });
}
function recordReadingPosition(next){
 const trail=state.readingHistory.slice();
 if(!trail.length)trail.push({id:uid(),...state.position,at:next.book===state.position.book&&next.section===state.position.section?new Date().toISOString():''});
 const last=trail.at(-1);
 if(last.book!==next.book||last.section!==next.section)trail.push({id:uid(),...next,at:new Date().toISOString()});
 if(trail.length>10000)throw Error('L’historique de lecture est plein. Exportez votre carnet avant de poursuivre.');
 state.readingHistory=trail;state.position=next;
}
function positionDialog(){dialog('Où en est votre lecture ?',`<form id="modal-form"><div class="form-grid">${modalField(['book','Livre','number',true,1,20],state.position)}${modalField(['section','Section','number',true,1,9999],state.position)}</div><div class="modal-actions"><button type="button" class="secondary" data-close>Annuler</button><button class="primary">Placer le marque-page</button></div><p class="form-error" role="alert"></p></form>`,async form=>{const data=new FormData(form);recordReadingPosition({book:Number(data.get('book')),section:Number(data.get('section'))});changed();render();});}
function transactionDialog(){dialog('Un mouvement dans votre bourse',`<form id="modal-form"><p>Votre bourse : <b>${state.gold} chardes</b></p><div class="form-grid"><label class="field"><span>Opération</span><select name="direction"><option value="1">Recevoir des chardes</option><option value="-1">Dépenser des chardes</option></select></label>${modalField(['amount','Montant','number',true,1],{amount:1})}</div><p class="form-error" role="alert"></p><div class="modal-actions"><button class="secondary" type="button" data-close>Annuler</button><button class="primary">Valider</button></div></form>`,async form=>{const data=new FormData(form);const next=state.gold+Number(data.get('direction'))*Number(data.get('amount'));if(!Number.isSafeInteger(next)||next<0)throw Error('Fonds insuffisants ou montant invalide.');state.gold=next;changed();render();});}
function withdrawDialog(id){
 const row=state.deposits.find(r=>r.id===id);if(!row)return;
 dialog('Retirer des fonds',`<form id="modal-form"><p>${esc(row.location)} : <b>${row.amount} chardes</b></p><p>Le montant demandé est débité du dépôt. Les frais de ${row.fee} %, arrondis au shard supérieur, sont déduits du versement.</p>${modalField(['amount','Montant à retirer','number',true,1,row.amount],{amount:row.amount})}<p class="form-error" role="alert"></p><div class="modal-actions"><button type="button" class="secondary" data-close>Annuler</button><button class="primary">Retirer</button></div></form>`,async form=>{const amount=Number(new FormData(form).get('amount'));if(!Number.isSafeInteger(amount)||amount<=0||amount>row.amount)throw Error('Montant de retrait invalide.');const fee=Math.ceil(amount*row.fee/100);row.amount-=amount;state.gold+=amount-fee;changed();render();toast(`${amount-fee} chardes reçus ; ${fee} chardes de frais.`);});
}
function rollDie(){const r=new Uint32Array(1);do{crypto.getRandomValues(r);}while(r[0]>=4294967292);return r[0]%6+1;}
function recordRoll(label,dice,bonus,difficulty=null){const r={id:uid(),at:new Date().toISOString(),label,rolls:dice.join(' + ')+(bonus?' + ('+bonus+')':''),total:dice.reduce((a,b)=>a+b,0)+bonus};if(difficulty!==null)r.label+=` · Difficulté ${difficulty} : ${r.total>difficulty?'réussite':'échec'}`;state.dice.unshift(r);state.dice=state.dice.slice(0,50);changed();return r;}
function attack(id,side){
 const enemy=state.combats.find(r=>r.id===id);if(!enemy||enemy.finished)return;
 if(!enemy.stamina||!state.hero.stamina)return toast('Un des combattants est à 0 endurance. Consultez le livre.');
 const player=side==='hero',bonus=player?totalSkill('Combat'):enemy.combat,target=player?enemy.defence:defence();
 const r=recordRoll(player?'Votre attaque':'Attaque de '+enemy.name,[rollDie(),rollDie()],bonus);const damage=Math.max(0,r.total-target);
 if(player)enemy.stamina=Math.max(0,enemy.stamina-damage);else state.hero.stamina=Math.max(0,state.hero.stamina-damage);
 enemy.notes=(enemy.notes?enemy.notes+'\n':'')+`${r.label} : ${r.rolls} = ${r.total} contre défense ${target} ; ${damage} dégât(s).`;
 changed();render();toast(`${r.total} contre ${target} : ${damage} dégât(s).${!enemy.stamina?' Adversaire à 0 endurance.':''}`);
}
function navigate(next){view=next;filter='';history.replaceState(null,'','#'+next);render();window.scrollTo({top:0});}
async function action(name){
 if(name.startsWith('add:'))return editRecord(name.slice(4));
 switch(name){
 case 'position':return positionDialog();
 case 'reroll-character':return generateCandidate(draftCandidate.creation.profession,draftCandidate.creation.book);
 case 'finalize-character':return finalizeCharacter();
 case 'delete-adventure':return deleteAdventure();
 case 'transaction':return transactionDialog();
 case 'profiles':
   await save();if(saving)return toast('Enregistrement en cours, réessayez dans un instant.');
   cache();clearTimeout(saveTimer);profile=null;state=null;local.remove('fl.session');await showProfiles();return;
 case 'export':{
   const exportProfile=clone(profile),exportedState=clone(state);for(const photo of exportedState.maps)photo.image=await adventurePhotoData(photo.image);
   const content={application:'terres-fabuleuses',format:1,profile:exportProfile.name,exportedAt:new Date().toISOString(),state:exportedState};
   const url=URL.createObjectURL(new Blob([JSON.stringify(content,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`carnet-${exportProfile.name.replace(/[^\p{L}\p{N}-]/gu,'-')}-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);return;
 }
 case 'import':return $('#import-file').click();
 case 'map-upload':return $('#map-file').click();
 case 'sync':await save();if(!dirty&&!saving)toast('Votre carnet est à jour.');return;
 case 'remote':return confirmDialog('Conserver la version du serveur ?','Votre copie locale sera remplacée. Exportez-la d’abord si vous voulez la garder.',async()=>{if(saving)throw Error('Attendez la fin de l’enregistrement.');const remote=await api(null,profile.id);state=remote.state?normalize(remote.state):fresh();version=remote.version;conflict=false;dirty=false;cache();render();toast('Version du serveur chargée.');},'Charger cette version');
 case 'local':return confirmDialog('Conserver cette copie locale ?','La sauvegarde présente sur le serveur sera remplacée par le carnet de cet appareil.',async()=>{if(saving)throw Error('Attendez la fin de l’enregistrement.');const remote=await api(null,profile.id);version=remote.version;conflict=false;changed();await save();render();},'Remplacer le serveur');
 }
}
document.addEventListener('click',async event=>{
 const el=event.target.closest('button,a');if(!el||el.disabled)return;
 try{
 if(el.hasAttribute('data-close'))return $('#modal').close();
 if(el.dataset.enter)return await enter(profiles.find(p=>p.id===el.dataset.enter));
 if(el.dataset.nav)return navigate(el.dataset.nav);
 if(el.dataset.action)return await action(el.dataset.action);
 if(el.dataset.edit){const [key,id]=el.dataset.edit.split(':');return editRecord(key,id);}
 if(el.dataset.delete){const [key,id]=el.dataset.delete.split(':');return confirmDialog('Supprimer cette entrée ?','Cette suppression sera enregistrée dans votre carnet. Elle ne déplace aucun objet ni aucune somme dans la bourse.',async()=>{const removed=state[key].find(r=>r.id===id);state[key]=state[key].filter(r=>r.id!==id);if(key==='maps')state.mapStamps=state.mapStamps.filter(stamp=>stamp.mapId!==id);changed();render();if(key==='maps'&&removed?.image.startsWith('getApi.php?photo=')){await flushSaves();await api({action:'delete-photo',id:profile.id,photo:new URL(removed.image,location.href).searchParams.get('photo')});}},'Supprimer');}
 if(el.dataset.book){sectionBook=Number(el.dataset.book);render();return;}
 if(el.dataset.adjust){const [key,field]=el.dataset.adjust.split('.');state[key][field]=Math.max(0,Math.min(state.hero.maxStamina,state[key][field]+Number(el.dataset.delta)));changed();render();return;}
 if(el.dataset.withdraw)return withdrawDialog(el.dataset.withdraw);
 if(el.dataset.attack){const [id,side]=el.dataset.attack.split(':');return attack(id,side);}
 if(el.dataset.map||el.dataset.catalogMap){const row=el.dataset.catalogMap?mapCatalog.find(r=>r.id===el.dataset.catalogMap):state.maps.find(r=>r.id===el.dataset.map);openAdventureMap(row);}
 }catch(e){toast(e.message);}
});
$('#modal').addEventListener('close',()=>{$('#modal').classList.remove('map-dialog');modalHandler=null;});
document.addEventListener('submit',async event=>{
 const form=event.target;event.preventDefault();
 if(form.id==='modal-form'){
   const btn=$('button[type="submit"],button.primary',form);if(btn)btn.disabled=true;
   try{const handler=modalHandler;if(handler)await handler(form);$('#modal').close();}catch(e){$('.form-error',form).textContent=e.message;}finally{if(btn)btn.disabled=false;}return;
 }
 if(form.id==='profile-form'){
   const btn=$('button',form);btn.disabled=true;
   try{const result=await api({action:'create',name:new FormData(form).get('name')});await enter(result);}catch(e){$('#profile-error').textContent=e.message;}finally{btn.disabled=false;}return;
 }
 if(form.id==='custom-code'){
   const code=String(new FormData(form).get('code')).trim();if(!code||['__proto__','constructor','prototype'].includes(code))return toast('Choisissez un autre code.');
   Object.defineProperty(state.codes,code,{value:true,writable:true,enumerable:true,configurable:true});changed();filter='';render();toast('Code ajouté et coché.');return;
 }
 if(form.id==='dice-form'){const data=new FormData(form);const skill=data.get('skill');const rawDifficulty=String(data.get('difficulty')||'').trim();const difficulty=rawDifficulty===''?null:Number(rawDifficulty);if(difficulty!==null&&(!Number.isSafeInteger(difficulty)||difficulty<0))return toast('Indiquez une difficulté entière positive ou nulle.');const r=recordRoll(skill?'Test de '+skill:'Jet de dés',Array.from({length:Number(data.get('count'))},rollDie),skill?totalSkill(skill):0,difficulty);$('#dice-result').innerHTML=diceResult(r);}
});
document.addEventListener('input',event=>{
 const el=event.target;
 if(el.id==='code-search'){filter=el.value;$('#code-list').innerHTML=codeList();return;}
 if(!el.dataset.field||!state||el.readOnly)return;
 const keys=el.dataset.field.split('.');let parent=state;for(const key of keys.slice(0,-1))parent=parent[key];const k=keys.at(-1);
 if(el.type==='number'){
   if(el.value===''||!el.validity.valid)return;
   const value=Number(el.value);if(!Number.isSafeInteger(value))return;
   if(el.dataset.field==='hero.maxStamina')maximumStamina(value,el.staminaBaseline);else parent[k]=value;
 }else parent[k]=el.value;
 const def=$('#defence-total');if(def)def.textContent=defence();
 document.querySelectorAll('[data-skill-total]').forEach(n=>n.textContent=totalSkill(n.dataset.skillTotal));document.querySelectorAll('.number-control input').forEach(updateNumberButtons);changed();
});
document.addEventListener('change',async event=>{
 const el=event.target;
 if(el.dataset.code){Object.defineProperty(state.codes,el.dataset.code,{value:el.checked,writable:true,enumerable:true,configurable:true});changed();$('#code-count').textContent=Object.values(state.codes).filter(Boolean).length+' code(s) acquis';$('#code-list').innerHTML=codeList();Array.from(document.querySelectorAll('[data-code]')).find(input=>input.dataset.code===el.dataset.code)?.focus({preventScroll:true});}
 if(el.dataset.section){state.sections[el.dataset.section]=el.checked;changed();}
 if(el.dataset.toggle){const [key,id,field]=el.dataset.toggle.split(':');const row=state[key].find(r=>r.id===id);if(row){row[field]=el.checked;changed();render();}}
 if(el.id==='import-file'&&el.files[0]){
   try{
     const file=el.files[0];
     const data=JSON.parse(await file.text());if(data.application!=='terres-fabuleuses'||data.format!==1)throw Error('Format de sauvegarde non reconnu.');const restored=normalize(data.state);
     confirmDialog('Restaurer cette sauvegarde ?',`Le carnet de ${data.profile||'cet aventurier'} remplacera le contenu du profil ${profile.name}. Exportez le carnet actuel pour le conserver.`,async()=>{await flushSaves();const owner=profile.id,adventure=state.adventure.id;for(const photo of restored.maps){const image=await adventurePhotoData(photo.image);ensurePhotoContext(owner,adventure);photo.image=await storeAdventurePhoto(image,owner);ensurePhotoContext(owner,adventure);}const result=await api({action:'save',id:owner,version,state:restored});ensurePhotoContext(owner,adventure);state=restored;version=result.version;dirty=false;draftCandidate=null;cache();render();toast('Sauvegarde restaurée dans le profil '+profile.name+'.');},'Restaurer');
   }catch(e){toast(e.message);}finally{el.value='';}
 }
 if(el.id==='map-file'&&el.files[0]){
   try{
     const files=Array.from(el.files);
     if(files.length===1){pendingImage=await optimizeImage(files[0]);editRecord('maps');}
     else{const owner=profile.id,adventure=state.adventure.id;let added=0;try{for(const file of files){const data=await optimizeImage(file);ensurePhotoContext(owner,adventure);const image=await storeAdventurePhoto(data,owner);ensurePhotoContext(owner,adventure);state.maps.push({id:uid(),title:file.name.replace(/\.[^.]+$/,''),book:state.position.book,image,notes:''});added++;changed();}}finally{if(added&&profile?.id===owner&&state.adventure.id===adventure){render();toast(added+' photo(s) ajoutée(s) à votre aventure.');}}}
   }catch(e){toast(e.message);}finally{el.value='';}
 }
});
async function optimizeImage(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choisissez une image JPEG, PNG ou WebP.');
 if(file.size>12*1024*1024)throw Error('L’image dépasse 12 Mo. Exportez-la en JPEG plus léger.');
 const url=URL.createObjectURL(file);
 try{
   const img=new Image();img.src=url;await img.decode();if(img.width*img.height>40000000)throw Error('Image trop grande. Réduisez ses dimensions.');
   const scale=Math.min(1,1600/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
   let image=canvas.toDataURL('image/jpeg',.82);if(image.length>650000)image=canvas.toDataURL('image/jpeg',.6);if(image.length>900000)throw Error('Photo trop volumineuse. Choisissez une image plus petite.');return image;
 }finally{URL.revokeObjectURL(url);}
}
window.addEventListener('hashchange',()=>{if(profile){view=location.hash.slice(1)||'home';render();window.scrollTo({top:0});}});
window.addEventListener('online',()=>{if(profile)save();});
window.addEventListener('pagehide',cache);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){cache();save();}else if(profile)save();});
window.addEventListener('beforeunload',event=>{if(dirty){cache();event.preventDefault();event.returnValue='';}});
(async()=>{try{await assetsReady;}catch(e){$('#app').innerHTML=empty('✧','Chargement impossible',esc(e.message)+' Rechargez la page.');return;}const session=local.get('fl.session');if(session?.id){await enter(session);if(!profile)await showProfiles();}else await showProfiles();})();
