/* npm install --no-save --prefix /tmp/fl-test-tools playwright
 * NODE_PATH=/tmp/fl-test-tools/node_modules PHP_BIN=php node tests/smoke.cjs
 * Chromium installé requis (CHROMIUM_BIN ou /usr/bin/chromium).
 * Chaque exécution utilise une copie temporaire et une base SQLite jetable.
 */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const url='http://127.0.0.1:8089';
let tmp,server,browser,checks=0;
async function check(name,fn){await fn();checks++;console.log('PASS',name);}
async function chooseMapEdition(page,id,mode,scope='.french-library'){
 const button=page.locator(`${scope} [data-map-edition="${id}"]`);
 if(await button.getAttribute('value')!==mode)await button.click();
 assert.equal(await button.getAttribute('value'),mode);
}
async function navigate(page,name){await page.evaluate(v=>{location.hash=v;},name);await page.waitForTimeout(60);}
async function settled(page){await page.waitForFunction(()=>{const n=document.querySelector('[data-sync]');return n&&n.textContent==='Sauvegardé';});}
async function add(page,key,values){await page.locator(`[data-action="add:${key}"]`).first().click();await fillDialog(page,values);}
async function fillDialog(page,values){
 for(const [key,value]of Object.entries(values)){const input=page.locator(`#modal [name="${key}"]`);if(await input.evaluate(el=>el.tagName==='SELECT'))await input.selectOption(String(value));else await input.fill(String(value));}
 await page.locator('#modal button.primary').click();await page.locator('#modal').waitFor({state:'hidden'});
}
async function finishCharacter(page,profile,name){
 await page.locator('#creation-form').waitFor();await page.locator('#creation-form [name="profession"]').selectOption('Guerrier');await page.locator('#creation-form .primary').click();await page.locator('#candidate-name').fill(name);await page.locator('[data-action="finalize-character"]').click();await page.locator('.swal2-confirm').click();await page.locator('.swal2-container').waitFor({state:'hidden'});await page.getByRole('heading',{name:'Bon retour, '+profile+'.'}).waitFor();
}
async function current(page){return page.evaluate(async()=>{const s=JSON.parse(localStorage.getItem('fl.session'));return(await fetch('getApi.php?id='+s.id)).json();});}
(async()=>{
 tmp=await fs.mkdtemp(path.join(os.tmpdir(),'fabled-test-'));
 for(const item of ['index.php','getApi.php','getRouter.php','sw.js','assets','lib','manifest.webmanifest'])await fs.cp(path.join(root,item),path.join(tmp,item),{recursive:true});
 server=spawn(process.env.PHP_BIN||'php',['-S','127.0.0.1:8089','getRouter.php'],{cwd:tmp,stdio:['ignore','ignore','pipe']});
 let serverLog='';server.stderr.on('data',d=>serverLog+=d);server.on('error',()=>{});
 for(let i=0;i<50;i++){try{if((await fetch(url+'/getApi.php')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_BIN||'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await context.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/Content Security Policy/.test(m.text()))errors.push(m.text());});
 await check('Accueil français et création du profil par prénom',async()=>{
  await page.goto(url);await page.getByLabel('Votre prénom',{exact:true}).fill('Camille');await page.getByRole('button',{name:/Créer mon carnet/}).click();await finishCharacter(page,'Camille','Aëlys');await settled(page);
 });
 await check('Installation : manifeste, icônes et réouverture hors ligne sans cache API',async()=>{
  const response=await page.request.get(url+'/manifest.webmanifest');assert.ok(response.ok());const manifest=await response.json();assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,'./');assert.equal(manifest.start_url,'./');
  for(const icon of manifest.icons){assert.ok((await page.request.get(url+'/'+icon.src)).ok());const dimensions=await page.evaluate(async src=>{const img=new Image();img.src=src;await img.decode();return `${img.naturalWidth}x${img.naturalHeight}`;},icon.src);assert.equal(dimensions,icon.sizes);}
  assert.ok(manifest.icons.some(i=>i.sizes==='192x192'));assert.ok(manifest.icons.some(i=>i.sizes==='512x512'&&i.purpose==='maskable'));
  for(const rel of ['icon','apple-touch-icon'])assert.ok((await page.request.get(new URL(await page.locator(`link[rel="${rel}"]`).first().getAttribute('href'),url).href)).ok());
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const before=await current(page);await context.setOffline(true);await page.reload();await page.getByRole('heading',{name:'Bon retour, Camille.'}).waitFor();assert.equal(await page.locator('.user-button b').textContent(),'Camille');
  const cachedApi=await page.evaluate(async()=>{const keys=await caches.keys();const urls=(await Promise.all(keys.map(async key=>(await(await caches.open(key)).keys()).map(r=>r.url)))).flat();return urls.filter(u=>u.includes('getApi.php'));});assert.deepEqual(cachedApi,[]);
  await context.setOffline(false);await page.reload();await page.getByRole('heading',{name:'Bon retour, Camille.'}).waitFor();assert.deepEqual((await current(page)).state,before.state);
 });
 await check('Personnage définitif : identité et valeurs initiales protégées côté serveur',async()=>{
  const p=await current(page);assert.equal(p.state.adventure.status,'locked');assert.equal(p.state.hero.rank,1);assert.equal(p.state.hero.maxStamina,9);assert.equal(p.state.gold,16);assert.equal(p.state.hero.armour,1);assert.deepEqual(Object.values(p.state.skills).map(s=>s.initial),[3,6,2,4,3,2]);
  const post=state=>fetch(url+'/getApi.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',id:p.id,version:p.version,state})});
  for(const mutate of [s=>s.hero.profession='Mage',s=>s.hero.name='Autre nom',s=>s.skills.Combat.initial=12,s=>s.adventure.status='draft',s=>delete s.adventure]){const changed=structuredClone(p.state);mutate(changed);assert.equal((await post(changed)).status,422);}
 });
 await check('PDF français : les six professions partagent épée, gilet et valeurs exactes',async()=>{
  const candidates=await page.evaluate(()=>Object.keys(creationRules.books['1'].professions).map(name=>{generateCandidate(name,1);return clone(draftCandidate.creation);}));
  const expected={'Prêtre':[4,2,3,6,4,2],'Mage':[2,2,6,1,5,3],'Voleur':[5,4,4,1,2,6],'Troubadour':[6,3,4,3,2,4],'Guerrier':[3,6,2,4,3,2],'Voyageur':[2,5,2,3,6,4]};
  assert.equal(candidates.length,6);for(const c of candidates){assert.equal(c.ruleset,'fr-tome1-v1');assert.deepEqual(c.skills,expected[c.profession]);assert.equal(c.rank,1);assert.equal(c.stamina,9);assert.equal(c.gold,16);assert.deepEqual(c.inventory,[{name:'Épée',quantity:1,notes:''},{name:'Gilet en cuir',quantity:1,notes:'Défense +1'}]);}
  const p=await current(page);assert.equal(p.state.inventory.length,2);assert.equal(p.state.adventure.creation.ruleset,'fr-tome1-v1');
 });
 await check('Statistiques, bonus et défense calculée',async()=>{
  await page.locator('.mobile-nav [data-nav="hero"]').click();
  for(const [key,value]of Object.entries({'hero.rank':2,'hero.armour':1,'hero.maxStamina':14,'hero.stamina':12,'skills.Combat.current':8,'skills.Combat.bonus':2}))await page.locator(`[data-field="${key}"]`).fill(String(value));
  assert.equal(await page.locator('#defence-total').textContent(),'11');assert.equal(await page.locator('[data-skill-total="Combat"]').textContent(),'10');await settled(page);
 });
 await check('PDF français : variation du maximum appliquée à l’endurance actuelle',async()=>{
  const maximum=page.locator('[data-field="hero.maxStamina"]'),currentHp=page.locator('[data-field="hero.stamina"]');await maximum.fill('13');await currentHp.fill('8');
  await maximum.fill('');await maximum.pressSequentially('17');await maximum.blur();assert.equal(await maximum.inputValue(),'17');assert.equal(await currentHp.inputValue(),'12');
  await maximum.fill('14');await maximum.blur();assert.equal(await currentHp.inputValue(),'9');await currentHp.fill('8');await currentHp.blur();assert.equal(await maximum.inputValue(),'14');
  await settled(page);const p=await current(page);assert.equal(p.state.hero.maxStamina,14);assert.equal(p.state.hero.stamina,8);
 });
 await check('Possessions transportées et stockées',async()=>{
  await navigate(page,'inventory');await add(page,'inventory',{name:'Épée de marin',quantity:1,notes:'Combat +2'});await add(page,'storage',{location:'Maison de Sokara',book:1,section:100,items:'Corde\nLanterne'});await settled(page);assert.equal((await current(page)).state.inventory.find(r=>r.name==='Épée de marin').name,'Épée de marin');
 });
 await check('PDF français : les quantités occupent autant d’emplacements et le serveur refuse le treizième objet',async()=>{
  const before=await current(page);const item=before.state.inventory.find(r=>r.name==='Épée de marin');await page.locator(`[data-edit="inventory:${item.id}"]`).click();await fillDialog(page,{quantity:3});await settled(page);assert.equal(await page.locator('.panel-head .count').first().textContent(),'5 / 12');assert.equal(await page.locator('.slot-number').filter({hasText:'03–05'}).count(),1);
  const p=await current(page);const tooMany=structuredClone(p.state);tooMany.inventory.find(r=>r.id===item.id).quantity=11;const response=await fetch(url+'/getApi.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',id:p.id,version:p.version,state:tooMany})});assert.equal(response.status,422);assert.equal((await current(page)).state.inventory.find(r=>r.id===item.id).quantity,3);
  await page.locator(`[data-edit="inventory:${item.id}"]`).click();await fillDialog(page,{quantity:1});await settled(page);
 });
 await check('Bourse, dépôt et retrait avec frais de 10 %',async()=>{
  await navigate(page,'money');await page.locator('[data-field="gold"]').fill('1000');await add(page,'deposits',{location:'Guilde de Sokara',amount:100,fee:10});
  await page.locator('[data-withdraw]').click();await fillDialog(page,{amount:50});await settled(page);const s=(await current(page)).state;assert.equal(s.gold,945);assert.equal(s.deposits[0].amount,50);
  await add(page,'investments',{location:'Marchands',amount:100});await settled(page);assert.equal((await current(page)).state.gold,845);
 });
 await check('Quêtes, notes et affichage des textes sans HTML exécuté',async()=>{
  await navigate(page,'journal');await add(page,'quests',{title:'Retrouver le capitaine',notes:'<img src=x onerror=alert(1)>',book:1,section:42});await page.locator('[data-field="notes"]').fill('Rendez-vous au port.');assert.equal(await page.locator('.quest-row img').count(),0);await settled(page);
 });
 await check('Journal : parcours chronologique, retours, annulation et sauvegarde hors ligne',async()=>{
  const before=(await current(page)).state;const start=before.readingHistory;assert.equal(start.length,1);assert.deepEqual([start[0].book,start[0].section],[1,1]);
  const move=async(book,section)=>{await navigate(page,'home');await page.locator('.hero-banner [data-action="position"]').click();await fillDialog(page,{book,section});};
  await move(1,42);await settled(page);const count=(await current(page)).state.readingHistory.length;await move(1,42);await settled(page);assert.equal((await current(page)).state.readingHistory.length,count);
  await move(2,9);await settled(page);await move(1,42);await settled(page);
  const trail=(await current(page)).state.readingHistory;assert.deepEqual(trail.map(row=>[row.book,row.section]),[[1,1],[1,42],[2,9],[1,42]]);for(const row of trail)assert.ok(Number.isFinite(Date.parse(row.at)));
  await page.locator('.hero-banner [data-action="position"]').click();await page.locator('#modal [name="section"]').fill('500');await page.getByRole('button',{name:'Annuler',exact:true}).click();assert.deepEqual((await current(page)).state.readingHistory,trail);
  await context.setOffline(true);await move(3,11);await page.reload();await page.getByRole('heading',{name:'Bon retour, Camille.'}).waitFor();assert.deepEqual(await page.evaluate(()=>state.readingHistory.at(-1).section),11);await navigate(page,'home');await navigate(page,'journal');assert.equal(await page.locator('.reading-stop').count(),5);assert.match(await page.locator('.reading-stop').last().textContent(),/Livre 3 · Paragraphe 11/);
  await context.setOffline(false);await settled(page);const saved=(await current(page)).state.readingHistory;assert.equal(saved.length,5);await page.locator('#toast').evaluate(el=>el.classList.remove('show'));await page.screenshot({path:path.join(__dirname,'artifacts/parcours-iphone.png'),fullPage:true});
  await move(before.position.book,before.position.section);await settled(page);const after=(await current(page)).state;assert.deepEqual({...after,readingHistory:before.readingHistory},before);
 });
 await check('Ancien carnet sans parcours : départ connu et rejet des historiques invalides',async()=>{
  const source=(await current(page)).state;const old=structuredClone(source);delete old.readingHistory;const clean=await page.evaluate(raw=>normalize(raw),old);assert.deepEqual(clean.readingHistory,[]);
  const created=await(await fetch(url+'/getApi.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',name:'Ancien parcours'})})).json();const write=await fetch(url+'/getApi.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',id:created.id,version:0,state:old})});assert.equal(write.status,200);
  const other=await browser.newContext();const oldPage=await other.newPage();await oldPage.goto(url);await oldPage.locator('[data-enter]').filter({hasText:'Ancien parcours'}).click();await oldPage.getByRole('heading',{name:'Bon retour, Ancien parcours.'}).waitFor();await navigate(oldPage,'journal');assert.equal(await oldPage.locator('.reading-stop').count(),0);
  await navigate(oldPage,'home');await oldPage.locator('.hero-banner [data-action="position"]').click();await fillDialog(oldPage,{book:7,section:100});await settled(oldPage);const result=await current(oldPage);assert.deepEqual(result.state.readingHistory.map(row=>[row.book,row.section]),[[old.position.book,old.position.section],[7,100]]);assert.equal(result.state.readingHistory[0].at,'');assert.ok(Number.isFinite(Date.parse(result.state.readingHistory[1].at)));
  for(const change of [s=>s.readingHistory='invalide',s=>s.readingHistory[0].book=-1,s=>s.readingHistory[0].at='<script>']){const invalid=structuredClone(result.state);change(invalid);assert.equal((await fetch(url+'/getApi.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',id:result.id,version:result.version,state:invalid})})).status,422);assert.equal(await page.evaluate(raw=>{try{normalize(raw);return false;}catch{return true;}},invalid),true);}
  assert.deepEqual((await current(oldPage)).state,result.state);await other.close();const {execFileSync}=require('node:child_process');execFileSync(process.env.PHP_BIN||'php',['-r','$d=new PDO("sqlite:".$argv[1]);$q=$d->prepare("DELETE FROM profiles WHERE id=?");$q->execute([$argv[2]]);',path.join(tmp,'aventures.sqlite'),created.id]);
 });
 await check('269 codes des livres, recherche, code personnalisé et cases répétées',async()=>{
  await navigate(page,'codes');assert.equal(await page.locator('[data-code]').count(),269);await page.locator('#code-search').fill('Balustre');await page.locator('[data-code="Balustre"]').check();
  await page.locator('[name="code"]').fill('Zénith');await page.locator('#custom-code button').click();await navigate(page,'sections');await page.locator('[data-section="1:10:1"]').check();await settled(page);const s=(await current(page)).state;assert.equal(s.codes.Balustre,true);assert.equal(s.codes.Zénith,true);assert.equal(s.sections['1:10:1'],true);assert.ok(!s.sections['1:10:0']);
 });
 await check('Codes F et G vérifiés, acquis en premier, recherche et décochage sans perte',async()=>{
  await navigate(page,'codes');const catalog=await page.evaluate(()=>GAME_DATA.codes);assert.equal(new Set(catalog).size,269);assert.equal(catalog.filter(n=>n.startsWith('F')).length,27);assert.equal(catalog.filter(n=>n.startsWith('G')).length,75);for(const name of ['Face','Fuligin','Gageure','Gaieté','Génuflexion','Gargouillis','Gré','Guise'])assert.ok(catalog.includes(name));
  const ordered=async()=>{const rows=await page.locator('[data-code]').evaluateAll(nodes=>nodes.map(n=>({name:n.dataset.code,checked:n.checked})));let unchecked=false;for(const row of rows){if(!row.checked)unchecked=true;else assert.equal(unchecked,false,'Code acquis placé après un code non acquis');}const acquired=rows.filter(r=>r.checked).map(r=>r.name);assert.deepEqual(acquired,[...acquired].sort((a,b)=>a.localeCompare(b,'fr')));};
  await ordered();await page.locator('[data-code="Gré"]').check();await page.locator('[data-code="Géode"]').check();await ordered();assert.equal(await page.locator('[data-code="Géode"]').evaluate(el=>document.activeElement===el),true);
  await page.locator('[data-code="Balustre"]').uncheck();await ordered();assert.equal(await page.locator('[data-code]').first().getAttribute('data-code'),'Géode');await page.locator('#code-search').fill('g');await ordered();assert.equal(await page.locator('[data-code="Zénith"]').count(),0);assert.equal(await page.locator('[data-code="Gré"]').isChecked(),true);
  await page.locator('#code-search').fill('');await settled(page);await page.reload();await page.getByRole('heading',{name:'Bon retour, Camille.'}).waitFor();await navigate(page,'home');await navigate(page,'codes');await ordered();assert.equal(await page.locator('[data-code="Gré"]').isChecked(),true);assert.equal(await page.locator('[data-code="Zénith"]').isChecked(),true);
  await page.locator('[data-code="Balustre"]').check();await page.locator('[data-code="Gré"]').uncheck();await page.locator('[data-code="Géode"]').uncheck();await settled(page);
 });
 await check('Navire, équipage et manifeste de cargaison',async()=>{
  await navigate(page,'ships');await add(page,'ships',{name:'L’Albatros',type:'Brigantin',crew:'bon',capacity:20,load:10,cargo:'Épices : 10 unités',port:'Sokara'});await settled(page);assert.equal((await current(page)).state.ships[0].load,10);
 });
 await check('Cultes, bénédictions, sanctuaires et résurrection',async()=>{
  await navigate(page,'cults');await add(page,'effects',{type:'Bénédiction',origin:'Lacuna',consequence:'Exploration +1'});await page.locator('[data-toggle^="temples:"]').first().check();await add(page,'resurrections',{origin:'Nagil',location:'Temple'});await settled(page);const s=(await current(page)).state;assert.equal(s.temples[0].active,true);assert.equal(s.effects.length,1);assert.equal(s.resurrections.length,1);
 });
 await check('Jets de dés et application des dégâts dans le journal de combat',async()=>{
  await navigate(page,'combat');await page.locator('#dice-form [name="skill"]').selectOption('Combat');await page.locator('#dice-form button.primary').click();assert.ok(Number(await page.locator('#dice-result strong').textContent())>=12);
  await add(page,'combats',{name:'Pirate',combat:0,defence:1,stamina:100});await page.locator('[data-attack$=":hero"]').click();await settled(page);const s=(await current(page)).state;assert.ok(s.combats[0].stamina<100);assert.match(s.combats[0].notes,/dégât/);assert.ok(s.dice.length>=2);
 });
 await check('PDF français : difficulté stricte et exemple du gobelin',async()=>{
  await navigate(page,'hero');for(const [key,value]of Object.entries({'hero.rank':3,'hero.armour':2,'hero.maxStamina':20,'hero.stamina':20,'skills.Combat.current':4,'skills.Combat.bonus':0,'skills.Adresse.current':4,'skills.Adresse.bonus':0}))await page.locator(`[data-field="${key}"]`).fill(String(value));await settled(page);await navigate(page,'combat');
  await page.evaluate(()=>{window.savedRuleRoll=rollDie;window.ruleRolls=[];rollDie=()=>window.ruleRolls.shift();});
  await page.locator('#dice-form [name="skill"]').selectOption('Adresse');await page.locator('#dice-form [name="difficulty"]').fill('9');await page.evaluate(()=>window.ruleRolls=[2,3]);await page.locator('#dice-form .primary').click();assert.match(await page.locator('#dice-result').textContent(),/échec/);assert.equal(await page.locator('#dice-result strong').textContent(),'9');
  await page.evaluate(()=>window.ruleRolls=[3,3]);await page.locator('#dice-form .primary').click();assert.match(await page.locator('#dice-result').textContent(),/réussite/);assert.equal(await page.locator('#dice-result strong').textContent(),'10');
  await add(page,'combats',{name:'Gobelin du tutoriel',combat:5,defence:7,stamina:6});const enemyId=(await page.evaluate(()=>state.combats.find(r=>r.name==='Gobelin du tutoriel').id));
  await page.evaluate(()=>window.ruleRolls=[4,4]);await page.locator(`[data-attack="${enemyId}:hero"]`).click();await settled(page);assert.equal((await current(page)).state.combats.find(r=>r.id===enemyId).stamina,1);
  await page.evaluate(()=>window.ruleRolls=[3,3]);await page.locator(`[data-attack="${enemyId}:enemy"]`).click();await settled(page);assert.equal((await current(page)).state.hero.stamina,18);
  await page.evaluate(()=>window.ruleRolls=[1,2]);await page.locator(`[data-attack="${enemyId}:hero"]`).click();await settled(page);assert.equal((await current(page)).state.combats.find(r=>r.id===enemyId).stamina,1);await page.evaluate(()=>{rollDie=window.savedRuleRoll;delete window.savedRuleRoll;});
 });
 await check('Import de carte, optimisation et affichage agrandi',async()=>{
  await navigate(page,'maps');await page.locator('#map-file').setInputFiles(path.join(root,'assets/apple-touch-icon.png'));await page.locator('#modal').waitFor({state:'visible'});await fillDialog(page,{title:'Carte de Sokara',notes:'Le port au sud.'});await page.locator('[data-map]').click();assert.equal(await page.locator('.map-viewer img').count(),1);await page.locator('[data-close]').click();await settled(page);assert.match((await current(page)).state.maps[0].image,/^getApi\.php\?photo=/);
 });
 await check('Album : dix photos, stockage séparé et absence de plafond de nombre',async()=>{
  await navigate(page,'maps');assert.equal(await page.getByRole('heading',{name:'Vos photos d’aventures'}).count(),1);
  const bytes=await fs.readFile(path.join(root,'assets/apple-touch-icon.png'));await page.locator('#map-file').setInputFiles(Array.from({length:9},(_,i)=>({name:`souvenir-${i}.png`,mimeType:'image/png',buffer:bytes})));await page.waitForFunction(()=>state.maps.length===10);await settled(page);assert.equal(await page.locator('[data-map]').count(),10);const original=await current(page);assert.ok(original.state.maps.every(row=>row.image.startsWith('getApi.php?photo=')));assert.ok(JSON.stringify(original.state).length<300000);
  const post=async body=>fetch(url+'/getApi.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const created=await(await post({action:'create',name:'Album test'})).json();const upload=await post({action:'upload-photo',id:created.id,image:'data:image/png;base64,'+bytes.toString('base64')});assert.equal(upload.status,201);const image=(await upload.json()).image;
  const large=structuredClone(original.state);large.maps=Array.from({length:1001},(_,i)=>({id:'photo-'+i,title:'Souvenir '+i,book:1,image,notes:''}));large.mapStamps=[];assert.equal((await post({action:'save',id:created.id,version:0,state:large})).status,200);assert.equal(await page.evaluate(raw=>normalize(raw).maps.length,large),1001);
  const foreign=structuredClone(original.state);foreign.maps[0].image=image;assert.equal((await post({action:'save',id:original.id,version:original.version,state:foreign})).status,422);assert.equal((await post({action:'upload-photo',id:created.id,image:'data:image/png;base64,SGVsbG8='})).status,422);
  const removed=original.state.maps.at(-1);await page.locator(`[data-delete="maps:${removed.id}"]`).click();await page.locator('#modal .primary').click();await page.locator('#modal').waitFor({state:'hidden'});await settled(page);await page.waitForFunction(url=>fetch(url,{cache:'no-store'}).then(r=>r.status===404),removed.image);
  const refs=original.state.maps.slice(1,-1).map(row=>row.image);await page.evaluate(()=>{state.maps=state.maps.slice(0,1);changed();render();});await settled(page);for(const ref of refs)assert.equal((await post({action:'delete-photo',id:original.id,photo:new URL(ref,url).searchParams.get('photo')})).status,200);
  const {execFileSync}=require('node:child_process');execFileSync(process.env.PHP_BIN||'php',['-r','$d=new PDO("sqlite:".$argv[1]);$d->exec("PRAGMA foreign_keys=ON");$q=$d->prepare("DELETE FROM profiles WHERE id=?");$q->execute([$argv[2]]);',path.join(tmp,'aventures.sqlite'),created.id]);assert.equal((await current(page)).state.maps.length,1);
 });
 await check('Tampons : poser, déplacer, changer la couleur, isoler les cartes et supprimer',async()=>{
  await navigate(page,'maps');await page.locator('[data-catalog-map="book-1"]').click();await page.locator('.map-viewer img').evaluate(img=>img.decode());await page.locator('[data-stamp-tools]').click();assert.equal(await page.locator('[data-stamp-kind]').count(),26);await page.locator('[data-stamp-kind="skull"]').click();
  const box=await page.locator('.map-viewer img').boundingBox();const x=box.x+box.width*.4,y=box.y+Math.min(box.height*.3,220);await page.mouse.click(x,y);assert.equal(await page.locator('.map-stamp').count(),1);await settled(page);const first=(await current(page)).state.mapStamps[0];assert.equal(first.kind,'skull');assert.equal(first.mapId,'book-1');assert.ok(Math.abs(first.x-.4)<.01);
  await page.locator('[data-stamp-kind=""]').click();let mark=await page.locator('.map-stamp').boundingBox();await page.mouse.move(mark.x+mark.width/2,mark.y+mark.height/2);await page.mouse.down();await page.mouse.move(mark.x+mark.width/2+25,mark.y+mark.height/2+20,{steps:4});await page.mouse.up();await settled(page);const moved=(await current(page)).state.mapStamps[0];assert.ok(moved.x>first.x);assert.ok(moved.y>first.y);
  await page.locator('[data-map-zoom="in"]').click();const location=await page.locator('.map-stamp').evaluate(el=>[el.style.left,el.style.top]);await page.locator('#modal [data-map-edition]').click();await page.locator('.map-viewer img').evaluate(img=>img.decode());assert.deepEqual(await page.locator('.map-stamp').evaluate(el=>[el.style.left,el.style.top]),location);assert.deepEqual((await current(page)).state.mapStamps[0],moved);
  await page.locator('[data-close]').click();await page.waitForFunction(()=>!document.documentElement.classList.contains('map-open'));await page.locator('[data-catalog-map="book-2"]').click();assert.equal(await page.locator('.map-stamp').count(),0);await page.locator('[data-close]').click();await page.waitForFunction(()=>!document.documentElement.classList.contains('map-open'));
  await page.reload();await page.getByRole('heading',{name:'Bon retour, Camille.'}).waitFor();await navigate(page,'home');await navigate(page,'maps');await page.locator('[data-catalog-map="book-1"]').click();await page.locator('.map-viewer img').evaluate(img=>img.decode());assert.equal(await page.locator('.map-stamp').count(),1);await page.locator('.map-stamp').click();await page.locator('[data-stamp-delete]').click();await settled(page);assert.deepEqual((await current(page)).state.mapStamps,[]);
  await page.locator('[data-stamp-kind="digit-7"]').click();const bounds=await page.locator('.map-viewer img').boundingBox();await page.mouse.click(bounds.x+bounds.width*.5,bounds.y+Math.min(bounds.height*.3,200));await settled(page);assert.equal((await current(page)).state.mapStamps[0].kind,'digit-7');await page.screenshot({path:path.join(__dirname,'artifacts/tampons-iphone.png')});await page.locator('[data-close]').click();await page.waitForFunction(()=>!document.documentElement.classList.contains('map-open'));
  const p=await current(page);for(const change of [s=>s.mapStamps[0].x=-1,s=>s.mapStamps[0].kind='<script>']){const invalid=structuredClone(p.state);change(invalid);assert.equal((await fetch(url+'/getApi.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',id:p.id,version:p.version,state:invalid})})).status,422);assert.equal(await page.evaluate(raw=>{try{normalize(raw);return false;}catch{return true;}},invalid),true);}
 });
 await check('Photos et tampons hors connexion, reprise puis synchronisation',async()=>{
  await navigate(page,'maps');const photo=(await current(page)).state.maps[0];await context.setOffline(true);await page.locator(`[data-map="${photo.id}"]`).click();await page.locator('.map-viewer img').evaluate(img=>img.decode());await page.locator('[data-stamp-tools]').click();await page.locator('[data-stamp-kind="chest"]').click();const box=await page.locator('.map-viewer img').boundingBox();await page.mouse.click(box.x+box.width*.5,box.y+Math.min(box.height*.5,200));assert.equal(await page.locator('.map-stamp').count(),1);await page.locator('[data-close]').click();await page.waitForFunction(()=>!document.documentElement.classList.contains('map-open'));
  await page.reload();await page.getByRole('heading',{name:'Bon retour, Camille.'}).waitFor();await navigate(page,'home');await navigate(page,'maps');await page.locator(`[data-map="${photo.id}"]`).click();await page.locator('.map-viewer img').evaluate(img=>img.decode());assert.equal(await page.locator('.map-stamp').count(),1);assert.equal(await page.evaluate(id=>state.mapStamps.find(stamp=>stamp.mapId===id)?.kind,photo.id),'chest');await page.locator('[data-close]').click();await page.waitForFunction(()=>!document.documentElement.classList.contains('map-open'));await context.setOffline(false);await settled(page);assert.ok((await current(page)).state.mapStamps.some(stamp=>stamp.mapId===photo.id&&stamp.kind==='chest'));
 });
 let exported;
 await check('Export JSON et restauration du contenu dans le profil courant',async()=>{
  await navigate(page,'backup');const download=page.waitForEvent('download');await page.locator('[data-action="export"]').click();const d=await download;exported=JSON.parse(await fs.readFile(await d.path(),'utf8'));assert.equal(exported.profile,'Camille');assert.match(exported.state.maps[0].image,/^data:image\/jpeg;base64,/);assert.equal(exported.state.ships[0].name,'L’Albatros');assert.deepEqual(exported.state.readingHistory,(await current(page)).state.readingHistory);assert.deepEqual(exported.state.mapStamps,(await current(page)).state.mapStamps);
  exported.state.notes='Sauvegarde restaurée avec succès';await page.locator('#import-file').setInputFiles({name:'restauration.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});await page.locator('#modal button.primary').click();await page.locator('#modal').waitFor({state:'hidden'});await settled(page);assert.equal((await current(page)).state.notes,'Sauvegarde restaurée avec succès');const restored=(await current(page)).state;assert.deepEqual(restored.mapStamps,exported.state.mapStamps);const image=await fetch(url+'/'+restored.maps[0].image);assert.equal(image.status,200);assert.deepEqual(Buffer.from(await image.arrayBuffer()),Buffer.from(exported.state.maps[0].image.split(',')[1],'base64'));
 });
 await check('Rechargement : le profil local reprend automatiquement',async()=>{await page.reload();await page.getByRole('heading',{name:'Bon retour, Camille.'}).waitFor();assert.equal((await current(page)).state.hero.name,'Aëlys');});
 await check('Modification hors connexion puis synchronisation',async()=>{
  await navigate(page,'journal');await context.setOffline(true);await page.locator('[data-field="notes"]').fill('Note en mer, sans connexion.');await page.waitForTimeout(900);const cache=await page.evaluate(()=>JSON.parse(localStorage.getItem('fl.carnet.'+JSON.parse(localStorage.getItem('fl.session')).id)));assert.equal(cache.dirty,true);await context.setOffline(false);await settled(page);assert.equal((await current(page)).state.notes,'Note en mer, sans connexion.');
 });
 await check('Détection des modifications concurrentes et choix du serveur',async()=>{
  const p=await current(page);const changed=structuredClone(p.state);changed.notes='Version écrite par un autre appareil.';
  const response=await fetch(url+'/getApi.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',id:p.id,version:p.version,state:changed})});assert.equal(response.status,200);
  await page.locator('[data-field="notes"]').fill('Modification de cet appareil.');await page.waitForFunction(()=>document.querySelector('.notice')?.textContent.includes('changé ailleurs'));await navigate(page,'backup');await page.locator('[data-action="remote"]').click();await page.locator('#modal button.primary').click();await page.locator('#modal').waitFor({state:'hidden'});assert.equal(await page.locator('.conflict-panel').count(),0);await navigate(page,'journal');assert.equal(await page.locator('[data-field="notes"]').inputValue(),'Version écrite par un autre appareil.');
 });
 await check('Changement de prénom, liste des profils et isolation des carnets',async()=>{
  await page.locator('.user-button').click();await page.getByLabel('Votre prénom',{exact:true}).fill('Jules');await page.getByRole('button',{name:/Créer mon carnet/}).click();await finishCharacter(page,'Jules','Orin');await settled(page);assert.equal((await current(page)).state.inventory.length,2);assert.deepEqual((await current(page)).state.mapStamps,[]);assert.equal((await current(page)).state.maps.length,0);assert.ok(!(await current(page)).state.inventory.some(r=>r.name==='Épée de marin'));await page.locator('.user-button').click();await page.locator('#profile-form').waitFor();assert.equal(await page.locator('[data-enter]').count(),2);await page.locator('[data-enter]').filter({hasText:'Camille'}).click();await page.getByRole('heading',{name:'Bon retour, Camille.'}).waitFor();
 });
 await check('Import en cours : changer de profil ne mélange pas les albums',async()=>{
  await navigate(page,'maps');const before=await current(page),bytes=await fs.readFile(path.join(root,'assets/apple-touch-icon.png'));let release,started;const gate=new Promise(resolve=>release=resolve),uploadStarted=new Promise(resolve=>started=resolve);let intercepted=false;
  const handler=async route=>{const request=route.request();let data;try{data=request.postDataJSON();}catch{}if(data?.action==='upload-photo'&&!intercepted){intercepted=true;started();await gate;}await route.continue();};
  await page.route('**/getApi.php',handler);await page.locator('#map-file').setInputFiles([1,2].map(i=>({name:'import-retarde-'+i+'.png',mimeType:'image/png',buffer:bytes})));await uploadStarted;
  await page.locator('.user-button').click();await page.locator('[data-enter]').filter({hasText:'Jules'}).click();await page.getByRole('heading',{name:'Bon retour, Jules.'}).waitFor();release();await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('Le carnet ouvert a changé'));assert.equal((await current(page)).state.maps.length,0);await page.unroute('**/getApi.php',handler);
  await page.locator('.user-button').click();await page.locator('[data-enter]').filter({hasText:'Camille'}).click();await page.getByRole('heading',{name:'Bon retour, Camille.'}).waitFor();assert.deepEqual((await current(page)).state.maps,before.state.maps);
 });
 await check('Doublons de prénoms, validation API et SQLite non téléchargeable',async()=>{
  const post=async body=>fetch(url+'/getApi.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await post({action:'create',name:'CAMILLE'})).status,409);assert.equal((await post({action:'create',name:'<script>'})).status,422);
  const p=await current(page);assert.equal((await post({action:'save',id:p.id,version:p.version,state:{schema:1}})).status,422);
  assert.equal((await fetch(url+'/getApi.php',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://other.example'},body:'{}'})).status,403);
  const tooMany=structuredClone(p.state);tooMany.inventory=Array.from({length:13},(_,i)=>({...p.state.inventory[0],id:'slot-'+i}));assert.equal((await post({action:'save',id:p.id,version:p.version,state:tooMany})).status,422);
  const badFee=structuredClone(p.state);badFee.deposits[0].fee=-10;assert.equal((await post({action:'save',id:p.id,version:p.version,state:badFee})).status,422);
  for(const file of ['aventures.sqlite','aventures.sqlite-journal','.git/config','tests/smoke.cjs'])assert.equal((await fetch(url+'/'+file)).status,404);
 });
 await check('Import invalide rejeté sans modifier le carnet',async()=>{
  await navigate(page,'backup');const before=(await current(page)).state;const invalid={...exported,state:{schema:1}};await page.locator('#import-file').setInputFiles({name:'invalide.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))});await page.waitForTimeout(100);assert.equal(await page.locator('#modal[open]').count(),0);assert.deepEqual((await current(page)).state,before);
 });
 await check('Conflit : conserver la copie locale de manière explicite',async()=>{
  await navigate(page,'journal');const p=await current(page);const other=structuredClone(p.state);other.notes='Autre appareil';await fetch(url+'/getApi.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',id:p.id,version:p.version,state:other})});await page.locator('[data-field="notes"]').fill('La copie locale que je conserve.');await page.waitForFunction(()=>!!document.querySelector('.notice'));await navigate(page,'backup');await page.locator('[data-action="local"]').click();await page.locator('#modal button.primary').click();await page.locator('#modal').waitFor({state:'hidden'});await settled(page);assert.equal((await current(page)).state.notes,'La copie locale que je conserve.');
 });
 await check('Saisies numériques : boutons, grands pas, limites et champs verrouillés',async()=>{
  await navigate(page,'money');const gold=page.locator('[data-field="gold"]');const before=Number(await gold.inputValue());const control=gold.locator('..');await control.locator('[data-number-step="10"]').click();assert.equal(Number(await gold.inputValue()),before+10);await control.locator('[data-number-step="-1"]').click();assert.equal(Number(await gold.inputValue()),before+9);await gold.fill('');await gold.blur();assert.equal(Number(await gold.inputValue()),before+9);await settled(page);
  await navigate(page,'hero');assert.equal(await page.locator('[data-field="hero.profession"]').getAttribute('readonly'),'');const initial=page.locator('[data-field="skills.Combat.initial"]');assert.equal(await initial.locator('..').locator('[data-number-step="1"]').isDisabled(),true);
  const stamina=page.locator('[data-field="hero.stamina"]');await stamina.fill('0');await stamina.locator('..').locator('[data-number-step="-1"]').click({force:true});assert.equal(await stamina.inputValue(),'0');await settled(page);await fs.mkdir(path.join(__dirname,'artifacts'),{recursive:true});await page.locator('#toast').evaluate(el=>el.classList.remove('show'));await page.screenshot({path:path.join(__dirname,'artifacts/saisies-iphone.png'),fullPage:true});
 });
 await check('Bibliothèque : huit cartes, cartes françaises locales et import personnel conservé',async()=>{
  await navigate(page,'maps');assert.equal(await page.locator('[data-catalog-map]').count(),8);
  const expected=[['world','monde-fr.jpg',1280,795],['book-1','sokara-fr.jpg?v=20261024-hd',1000,1197],['book-2','golnir-fr.jpg?v=20261024-hd',1060,1280],['book-3','ocean-violet-fr.jpg',977,1280],['book-4','grandes-steppes-fr.jpg',946,1280],['book-5','uttaku-fr-couleur.jpg',853,1280],['book-7','ankon-konu-fr-couleur.jpg',1280,905]];
  for(const [id,file,width,height]of expected){if(['world','book-1','book-2','book-3','book-4'].includes(id))await chooseMapEdition(page,id,'bw');await page.locator(`[data-catalog-map="${id}"]`).click();const image=page.locator('.map-viewer img');assert.equal(await image.getAttribute('src'),'assets/maps/'+file);await image.evaluate(img=>img.decode());assert.equal(await image.evaluate(img=>img.naturalWidth),width);assert.equal(await image.evaluate(img=>img.naturalHeight),height);await page.locator('[data-close]').click();}
  assert.equal(await page.locator('.french-library [data-catalog-map]').count(),7);assert.equal(await page.locator('.map-library:not(.french-library) [data-catalog-map]').count(),1);assert.equal(await page.locator('[data-map]').count(),1);
 });
 await check('Cartes couleur et noir et blanc : choix par carte, persistance et accès hors ligne',async()=>{
  const before=await current(page);
  await page.evaluate(()=>{for(const id of ['world','book-1','book-2','book-3','book-4'])local.remove(mapPreferenceKey(mapCatalog.find(row=>row.id===id)));});await navigate(page,'home');await navigate(page,'maps');
  for(const [id,file,width,height]of [['world','monde-fr-couleur.jpg',1280,853],['book-1','sokara-fr-couleur.jpg',1069,1280],['book-2','golnir-fr-couleur.jpg',1060,1280],['book-3','ocean-violet-fr-couleur.jpg',977,1280],['book-4','grandes-steppes-fr-couleur.jpg',947,1280]]){
   const selector=page.locator(`.french-library [data-map-edition="${id}"]`);assert.equal(await selector.getAttribute('value'),'color');await page.locator(`[data-catalog-map="${id}"]`).click();const image=page.locator('.map-viewer img');await image.evaluate(img=>img.decode());assert.equal(await image.getAttribute('src'),'assets/maps/'+file);assert.deepEqual(await image.evaluate(img=>[img.naturalWidth,img.naturalHeight]),[width,height]);
   await page.locator('[data-map-zoom="in"]').click();await chooseMapEdition(page,id,'bw','#modal');await image.evaluate(img=>img.decode());assert.equal(await page.locator('[data-map-scale]').textContent(),'100 %');assert.equal(await selector.getAttribute('value'),'bw');await page.locator('[data-close]').click();await page.waitForFunction(()=>!document.documentElement.classList.contains('map-open'));
  }
  await page.reload();await page.getByRole('heading',{name:'Bon retour, Camille.'}).waitFor();await navigate(page,'home');await navigate(page,'maps');for(const id of ['world','book-1','book-2','book-3','book-4'])assert.equal(await page.locator(`.french-library [data-map-edition="${id}"]`).getAttribute('value'),'bw');
  await context.setOffline(true);
  for(const id of ['world','book-1','book-2','book-3','book-4']){await chooseMapEdition(page,id,'color');await page.locator(`[data-catalog-map="${id}"]`).click();await page.locator('.map-viewer img').evaluate(img=>img.decode());await chooseMapEdition(page,id,'bw','#modal');await page.locator('.map-viewer img').evaluate(img=>img.decode());await page.locator('[data-close]').click();await page.waitForFunction(()=>!document.documentElement.classList.contains('map-open'));}
  await context.setOffline(false);assert.deepEqual((await current(page)).state,before.state);assert.equal(await page.locator('[data-map]').count(),1);
 });
 await check('Uttaku et Ankon-Konu : cartes locales hors ligne, Akatsuraï conservée au tome 6',async()=>{
  const sixth=await page.evaluate(()=>mapCatalog.find(row=>row.id==='book-6'));assert.equal(sixth.title,'Akatsuraï');assert.equal(sixth.language,'en');assert.match(sixth.image,/book6\/Akatsurai.JPG$/);
  await context.setOffline(true);
  for(const [id,width,height]of [['book-5',853,1280],['book-7',1280,905]]){await page.locator(`[data-catalog-map="${id}"]`).click();const image=page.locator('.map-viewer img');await image.evaluate(img=>img.decode());assert.deepEqual(await image.evaluate(img=>[img.naturalWidth,img.naturalHeight]),[width,height]);await page.locator('[data-close]').click();await page.waitForFunction(()=>!document.documentElement.classList.contains('map-open'));}
  await context.setOffline(false);
 });
 await check('Cartes : gestes isolés, bascule compacte et en-tête fixe sur toute la hauteur',async()=>{
  await navigate(page,'maps');await page.locator('[data-catalog-map="book-1"]').click();const viewer=page.locator('.map-viewer');await viewer.locator('img').evaluate(img=>img.decode());
  assert.equal(await page.locator('#modal select').count(),0);assert.equal(await page.locator('[data-map-zoom="reset"]').count(),0);
  assert.ok((await page.locator('#modal').boundingBox()).height>=844*.98);
  const header=await page.locator('#modal .modal-head').boundingBox();assert.ok(header.y>=0&&header.y<30);
  const help=await page.locator('.map-help').evaluate(el=>({size:parseFloat(getComputedStyle(el).fontSize),style:getComputedStyle(el).fontStyle}));assert.ok(help.size<=12);assert.equal(help.style,'italic');
  const edition=page.locator('#modal [data-map-edition]');const icon=await edition.textContent();await edition.click();assert.notEqual(await edition.textContent(),icon);await edition.click();
  assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).userSelect),'none');
  const before=await page.evaluate(()=>({scroll:scrollY,scale:visualViewport.scale}));assert.equal(before.scale,1);assert.match(await page.locator('meta[name="viewport"]').getAttribute('content'),/user-scalable=no/);
  await page.locator('[data-map-zoom="in"]').click();assert.equal(await page.locator('[data-map-scale]').textContent(),'140 %');while(!await page.locator('[data-map-zoom="out"]').isDisabled())await page.locator('[data-map-zoom="out"]').click();assert.equal(await page.locator('[data-map-scale]').textContent(),'100 %');
  const box=await viewer.boundingBox(),x=box.x+box.width/2,y=box.y+100;const cdp=await context.newCDPSession(page);
  const touch=(id,x,y)=>({id,x,y,radiusX:5,radiusY:5});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(1,x-35,y),touch(2,x+35,y)]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(1,x-75,y),touch(2,x+75,y)]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.ok(parseInt(await page.locator('[data-map-scale]').textContent())>150);assert.equal(await page.evaluate(()=>visualViewport.scale),1);
  const start=await viewer.evaluate(el=>({left:el.scrollLeft,top:el.scrollTop}));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(1,x,y)]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(1,x-45,y-50)]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const end=await viewer.evaluate(el=>({left:el.scrollLeft,top:el.scrollTop}));assert.ok(end.left>start.left||end.top>start.top);assert.equal(await page.evaluate(()=>scrollY),before.scroll);assert.deepEqual(await page.locator('#modal .modal-head').boundingBox(),header);assert.equal(await page.locator('#modal [data-close]').isVisible(),true);assert.equal(await page.locator('#modal').evaluate(el=>el.scrollTop),0);await page.screenshot({path:path.join(__dirname,'artifacts/carte-plein-ecran-iphone.png')});
  while(!await page.locator('[data-map-zoom="out"]').isDisabled())await page.locator('[data-map-zoom="out"]').click();assert.equal(await page.locator('[data-map-scale]').textContent(),'100 %');assert.equal(await viewer.evaluate(el=>el.scrollLeft+el.scrollTop),0);await cdp.detach();await page.locator('[data-close]').click();await page.waitForFunction(()=>!document.documentElement.classList.contains('map-open'));assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('map-open')),false);
 });
 await check('Restaurer un autre personnage est refusé sans altérer le carnet courant',async()=>{
  await navigate(page,'backup');const before=await current(page);const changed=structuredClone(before.state);changed.hero.name='Autre personnage';changed.adventure.creation.name='Autre personnage';await page.locator('#import-file').setInputFiles({name:'autre-personnage.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...exported,state:changed}))});await page.locator('#modal button.primary').click();await page.locator('#modal .form-error').filter({hasText:'définitif'}).waitFor();assert.deepEqual((await current(page)).state,before.state);await page.locator('#modal [data-close]').first().click();await page.reload();await page.getByRole('heading',{name:'Bon retour, Camille.'}).waitFor();assert.equal((await current(page)).state.hero.name,'Aëlys');
 });
 await check('Ancienne sauvegarde sans métadonnées : migration et identité conservées',async()=>{
  const p=await current(page);const old=structuredClone(p.state);old.maps=structuredClone(exported.state.maps);delete old.mapStamps;delete old.adventure;
  // Injection d’un format historique dans la base isolée : simule une mise à jour du site.
  const created=await(await fetch(url+'/getApi.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',name:'Ancien profil'})})).json();
  const {execFileSync}=require('node:child_process');execFileSync(process.env.PHP_BIN||'php',['-r','$d=new PDO("sqlite:".$argv[1]);$q=$d->prepare("UPDATE profiles SET state=? WHERE id=?");$q->execute([$argv[2],$argv[3]]);',path.join(tmp,'aventures.sqlite'),JSON.stringify(old),created.id]);
  const other=await browser.newContext();const oldPage=await other.newPage();await oldPage.goto(url);await oldPage.locator('[data-enter]').filter({hasText:'Ancien profil'}).click();await oldPage.getByRole('heading',{name:'Bon retour, Ancien profil.'}).waitFor();await navigate(oldPage,'journal');await oldPage.locator('[data-field="notes"]').fill('Ancienne aventure préservée.');await settled(oldPage);const migrated=await current(oldPage);assert.equal(migrated.state.adventure.status,'legacy');assert.equal(migrated.state.hero.name,'Aëlys');await navigate(oldPage,'hero');assert.equal(await oldPage.locator('[data-field="hero.name"]').getAttribute('readonly'),'');await other.close();
 });
 await check('Conseils du tutoriel dans chaque rubrique et guide complet',async()=>{
  for(const name of ['home','hero','inventory','journal','codes','sections','money','ships','cults','combat','maps','backup']){await navigate(page,name);const help=page.locator(`[data-help="${name}"]`);await help.locator('summary').click();assert.equal(await help.locator('li').count()>0,true);}
  await navigate(page,'rules');assert.equal(await page.locator('.rules-table tbody tr').count(),6);assert.equal(await page.locator('[data-help]').count(),13);assert.match(await page.locator('#content').textContent(),/Voyageur/);await page.locator('[data-help="hero"] summary').click();await page.screenshot({path:path.join(__dirname,'artifacts/guide-fr-iphone.png'),fullPage:true});
  await navigate(page,'maps');assert.equal(await page.locator('.french-map-source a[href="https://www.fabledlands.fr/2020/04/carte-du-monde.html?m=1"]').count(),1);
 });
 await check('Changer de tome conserve le personnage, les codes, les cases et les possessions',async()=>{
  await navigate(page,'home');const before=(await current(page)).state;await page.locator('[data-action="position"]').first().click();await fillDialog(page,{book:2,section:71});await settled(page);const after=(await current(page)).state;assert.deepEqual({...after,readingHistory:before.readingHistory},{...before,position:{book:2,section:71}});assert.deepEqual(after.readingHistory.slice(0,-1),before.readingHistory);assert.deepEqual([after.readingHistory.at(-1).book,after.readingHistory.at(-1).section],[2,71]);
 });
 await check('Carnet d’exploration : position réelle et ambiance de chaque tome au lancement',async()=>{
  await navigate(page,'home');const before=(await current(page)).state;const moods=[];
  for(const [book,region]of [[1,'Sokara'],[2,'Golnir'],[3,'océan Violet'],[4,'Grandes Steppes'],[5,'Uttaku'],[6,'Akatsuraï'],[7,'Ankon-Konu']]){
   await page.locator('.hero-banner [data-action="position"]').click();await fillDialog(page,{book,section:book*10+4});await settled(page);assert.equal(await page.locator('.reading-position').textContent(),`Livre ${book} · Paragraphe ${book*10+4}`);const mood=await page.locator('.reading-mood').textContent();assert.ok(mood.includes(region));moods.push(mood);assert.match(await page.locator('.hero-summary .subtle-tag').textContent(),new RegExp(`LIVRE ${book} · SECTION ${book*10+4}`));
  }
  assert.equal(new Set(moods).size,7);await page.reload();await page.getByRole('heading',{name:'Bon retour, Camille.'}).waitFor();assert.equal(await page.locator('.reading-position').textContent(),'Livre 7 · Paragraphe 74');assert.match(await page.locator('.reading-mood').textContent(),/Ankon-Konu/);await page.locator('#toast').evaluate(el=>el.classList.remove('show'));await page.screenshot({path:path.join(__dirname,'artifacts/carnet-tome7-iphone.png'),fullPage:true});
  await page.locator('.hero-banner [data-action="position"]').click();await fillDialog(page,before.position);await settled(page);const after=(await current(page)).state;assert.deepEqual({...after,readingHistory:before.readingHistory},before);
 });
 await check('Une fiche JaFL déjà verrouillée conserve sa création et son équipement',async()=>{
  const p=await current(page);const previous=structuredClone(p.state);previous.maps=structuredClone(exported.state.maps);previous.hero.name='Voyageur de la version précédente';previous.hero.profession='Explorateur';const values=[2,5,2,3,6,4];Object.keys(previous.skills).forEach((key,i)=>previous.skills[key].initial=values[i]);
  const inventory=[{name:'Armure de cuir',quantity:1,notes:'Défense +1'},{name:'Lance',quantity:1,notes:''},{name:'Carte',quantity:1,notes:''}];previous.inventory=inventory.map((r,i)=>({...r,id:'jafl-slot-'+i}));previous.adventure.creation={ruleset:'jafl-original',book:1,name:previous.hero.name,profession:'Explorateur',rank:1,stamina:9,armour:1,gold:16,skills:values,inventory};
  const created=await(await fetch(url+'/getApi.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',name:'Ancien JaFL'})})).json();const {execFileSync}=require('node:child_process');execFileSync(process.env.PHP_BIN||'php',['-r','$d=new PDO("sqlite:".$argv[1]);$q=$d->prepare("UPDATE profiles SET state=? WHERE id=?");$q->execute([$argv[2],$argv[3]]);',path.join(tmp,'aventures.sqlite'),JSON.stringify(previous),created.id]);
  const other=await browser.newContext();const oldPage=await other.newPage();await oldPage.goto(url);await oldPage.locator('[data-enter]').filter({hasText:'Ancien JaFL'}).click();await oldPage.getByRole('heading',{name:'Bon retour, Ancien JaFL.'}).waitFor();await navigate(oldPage,'journal');await oldPage.locator('[data-field="notes"]').fill('Progression conservée après correction française.');await settled(oldPage);const migrated=await current(oldPage);assert.deepEqual(migrated.state.adventure,previous.adventure);assert.deepEqual(migrated.state.inventory,previous.inventory);await other.close();
 });
 await check('Ancien inventaire surchargé : sauvegarde possible, augmentation refusée',async()=>{
  const p=await current(page);const old=structuredClone(p.state);old.maps=structuredClone(exported.state.maps);old.inventory[0].quantity=20;const created=await(await fetch(url+'/getApi.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',name:'Ancien sac'})})).json();const {execFileSync}=require('node:child_process');execFileSync(process.env.PHP_BIN||'php',['-r','$d=new PDO("sqlite:".$argv[1]);$q=$d->prepare("UPDATE profiles SET state=? WHERE id=?");$q->execute([$argv[2],$argv[3]]);',path.join(tmp,'aventures.sqlite'),JSON.stringify(old),created.id]);
  const post=(state,version)=>fetch(url+'/getApi.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',id:created.id,version,state})});old.notes='Une note préservée dans un ancien carnet';const kept=await post(old,0);assert.equal(kept.status,200);const version=(await kept.json()).version;old.inventory[0].quantity=21;assert.equal((await post(old,version)).status,422);old.inventory[0].quantity=19;assert.equal((await post(old,version)).status,200);
 });
 await check('Toutes les rubriques restent dans la largeur d’un iPhone',async()=>{
  for(const width of [375,390,430]){await page.setViewportSize({width,height:844});for(const name of ['home','hero','inventory','journal','codes','sections','money','ships','cults','combat','maps','backup','rules','more']){await navigate(page,name);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Débordement à ${width}px : ${name}`);const unreadable=await page.locator('#content p,#content .hint,#content .field>span,#content .rule-help li,#content input,#content select,#content textarea').evaluateAll(nodes=>nodes.filter(el=>el.getClientRects().length&&el.type!=='checkbox').filter(el=>{const s=getComputedStyle(el);return parseFloat(s.fontSize)<16||Number(s.fontWeight)<500;}).map(el=>el.textContent.slice(0,60)));assert.deepEqual(unreadable,[],`Texte trop petit ou trop fin à ${width}px : ${name}`);}}
 });
 await check('Vues bureau et mobile sans erreur JavaScript ou CSP',async()=>{
  await fs.mkdir(path.join(__dirname,'artifacts'),{recursive:true});await page.setViewportSize({width:390,height:844});await navigate(page,'home');await page.locator('#toast').evaluate(el=>el.classList.remove('show'));await page.mouse.move(0,0);await page.screenshot({path:path.join(__dirname,'artifacts/iphone.png'),fullPage:true});await page.setViewportSize({width:1440,height:1100});await navigate(page,'home');await page.screenshot({path:path.join(__dirname,'artifacts/desktop.png'),fullPage:true});await navigate(page,'hero');assert.equal(await page.locator('[data-field="skills.Combat.current"]').isVisible(),true);await page.screenshot({path:path.join(__dirname,'artifacts/saisies-desktop.png'),fullPage:true});assert.deepEqual(errors,[]);assert.ok(!/Fatal error|Uncaught/.test(serverLog));
 });
 await check('Suppression SweetAlert : annulation, confirmation, prénom conservé et nouvelle aventure',async()=>{
  await navigate(page,'backup');const before=await current(page);await page.locator('[data-action="delete-adventure"]').click();await page.locator('.swal2-cancel').click();assert.equal((await current(page)).version,before.version);
  await page.locator('[data-action="delete-adventure"]').click();await page.locator('.swal2-confirm').click();await page.locator('.swal2-container').waitFor({state:'hidden'});await page.locator('#creation-form').waitFor();assert.doesNotMatch(await page.locator('#content').textContent(),/JaFL|PDF|tutoriel|version anglaise|valeurs vérifiées/i);const reset=await current(page);assert.equal(reset.name,'Camille');assert.equal(reset.state,null);if(before.state.maps[0]?.image.startsWith('getApi.php?photo='))assert.equal((await fetch(url+'/'+before.state.maps[0].image,{cache:'no-store'})).status,404);
  const stale=await fetch(url+'/getApi.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',id:before.id,version:before.version,state:before.state})});assert.equal(stale.status,409);
  await page.setViewportSize({width:390,height:844});await page.locator('#creation-form [name="profession"]').selectOption('Mage');await page.locator('#creation-form [name="book"]').selectOption('6');await page.locator('#creation-form .primary').click();await page.locator('[data-action="reroll-character"]').click();assert.equal((await current(page)).state,null);await page.screenshot({path:path.join(__dirname,'artifacts/creation-iphone.png'),fullPage:true});await page.locator('[data-action="finalize-character"]').click();await page.locator('.swal2-popup').waitFor({state:'visible'});await page.waitForTimeout(300);await page.screenshot({path:path.join(__dirname,'artifacts/confirmation-iphone.png')});await page.locator('.swal2-cancel').click();assert.equal((await current(page)).state,null);await page.locator('[data-action="finalize-character"]').click();await page.locator('.swal2-confirm').click();await page.locator('.swal2-container').waitFor({state:'hidden'});const next=await current(page);assert.equal(next.state.hero.profession,'Mage');assert.equal(next.state.hero.rank,6);assert.equal(next.state.hero.stamina,27);assert.equal(next.state.gold,0);assert.equal(next.state.inventory[0].name,'Boucle d’oreille en platine');assert.notEqual(next.state.adventure.id,before.state.adventure.id);assert.deepEqual(next.state.mapStamps,[]);assert.equal(next.state.maps.length,0);assert.equal(next.state.readingHistory.length,1);assert.deepEqual([next.state.readingHistory[0].book,next.state.readingHistory[0].section],[6,1]);
 });
 assert.deepEqual(errors,[]);
 console.log(`\n${checks} scénarios réussis. Base de test isolée.`);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)server.kill();if(tmp)await fs.rm(tmp,{recursive:true,force:true});});
