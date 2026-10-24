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
async function navigate(page,name){await page.evaluate(v=>{location.hash=v;},name);await page.waitForTimeout(60);}
async function settled(page){await page.waitForFunction(()=>{const n=document.querySelector('[data-sync]');return n&&n.textContent==='Sauvegardé';});}
async function add(page,key,values){await page.locator(`[data-action="add:${key}"]`).first().click();await fillDialog(page,values);}
async function fillDialog(page,values){
 for(const [key,value]of Object.entries(values)){const input=page.locator(`#modal [name="${key}"]`);if(await input.evaluate(el=>el.tagName==='SELECT'))await input.selectOption(String(value));else await input.fill(String(value));}
 await page.locator('#modal button.primary').click();await page.locator('#modal').waitFor({state:'hidden'});
}
async function current(page){return page.evaluate(async()=>{const s=JSON.parse(localStorage.getItem('fl.session'));return(await fetch('api.php?id='+s.id)).json();});}
(async()=>{
 tmp=await fs.mkdtemp(path.join(os.tmpdir(),'fabled-test-'));
 for(const item of ['index.php','api.php','dev-router.php','assets','manifest.webmanifest'])await fs.cp(path.join(root,item),path.join(tmp,item),{recursive:true});
 server=spawn(process.env.PHP_BIN||'php',['-S','127.0.0.1:8089','dev-router.php'],{cwd:tmp,stdio:['ignore','ignore','pipe']});
 let serverLog='';server.stderr.on('data',d=>serverLog+=d);server.on('error',()=>{});
 for(let i=0;i<50;i++){try{if((await fetch(url+'/api.php')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_BIN||'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await context.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/Content Security Policy/.test(m.text()))errors.push(m.text());});
 await check('Accueil français et création du profil par prénom',async()=>{
  await page.goto(url);await page.getByLabel('Votre prénom',{exact:true}).fill('Camille');await page.getByRole('button',{name:/Créer mon carnet/}).click();await page.getByRole('heading',{name:'Bon retour, Camille.'}).waitFor();await settled(page);
 });
 await check('Statistiques, bonus et défense calculée',async()=>{
  await page.locator('.mobile-nav [data-nav="hero"]').click();
  for(const [key,value]of Object.entries({'hero.name':'Aëlys','hero.profession':'Exploratrice','hero.rank':2,'hero.armour':1,'hero.maxStamina':14,'hero.stamina':12,'skills.Combat.initial':6,'skills.Combat.current':8,'skills.Combat.bonus':2}))await page.locator(`[data-field="${key}"]`).fill(String(value));
  assert.equal(await page.locator('#defence-total').textContent(),'11');assert.equal(await page.locator('[data-skill-total="Combat"]').textContent(),'10');await settled(page);
 });
 await check('Possessions transportées et stockées',async()=>{
  await navigate(page,'inventory');await add(page,'inventory',{name:'Épée de marin',quantity:1,notes:'Combat +2'});await add(page,'storage',{location:'Maison de Sokara',book:1,section:100,items:'Corde\nLanterne'});await settled(page);assert.equal((await current(page)).state.inventory[0].name,'Épée de marin');
 });
 await check('Bourse, dépôt et retrait avec frais de 10 %',async()=>{
  await navigate(page,'money');await page.locator('[data-field="gold"]').fill('1000');await add(page,'deposits',{location:'Guilde de Sokara',amount:100,fee:10});
  await page.locator('[data-withdraw]').click();await fillDialog(page,{amount:50});await settled(page);const s=(await current(page)).state;assert.equal(s.gold,945);assert.equal(s.deposits[0].amount,50);
  await add(page,'investments',{location:'Marchands',amount:100});await settled(page);assert.equal((await current(page)).state.gold,845);
 });
 await check('Quêtes, notes et affichage des textes sans HTML exécuté',async()=>{
  await navigate(page,'journal');await add(page,'quests',{title:'Retrouver le capitaine',notes:'<img src=x onerror=alert(1)>',book:1,section:42});await page.locator('[data-field="notes"]').fill('Rendez-vous au port.');assert.equal(await page.locator('.quest-row img').count(),0);await settled(page);
 });
 await check('194 codes du PDF, recherche, code personnalisé et cases répétées',async()=>{
  await navigate(page,'codes');assert.equal(await page.locator('[data-code]').count(),194);await page.locator('#code-search').fill('Balustre');await page.locator('[data-code="Balustre"]').check();
  await page.locator('[name="code"]').fill('Zénith');await page.locator('#custom-code button').click();await navigate(page,'sections');await page.locator('[data-section="1:10:1"]').check();await settled(page);const s=(await current(page)).state;assert.equal(s.codes.Balustre,true);assert.equal(s.codes.Zénith,true);assert.equal(s.sections['1:10:1'],true);assert.ok(!s.sections['1:10:0']);
 });
 await check('Navire, équipage et manifeste de cargaison',async()=>{
  await navigate(page,'ships');await add(page,'ships',{name:'L’Albatros',type:'Brigantin',crew:'bon',capacity:20,load:10,cargo:'Épices : 10 unités',port:'Sokara'});await settled(page);assert.equal((await current(page)).state.ships[0].load,10);
 });
 await check('Cultes, bénédictions, sanctuaires et résurrection',async()=>{
  await navigate(page,'cults');await add(page,'effects',{type:'Bénédiction',origin:'Lacuna',consequence:'Exploration +1'});await page.locator('[data-toggle^="temples:"]').first().check();await add(page,'resurrections',{origin:'Nagil',location:'Temple'});await settled(page);const s=(await current(page)).state;assert.equal(s.temples[0].active,true);assert.equal(s.effects.length,1);assert.equal(s.resurrections.length,1);
 });
 await check('Jets de dés et application des dégâts dans le journal de combat',async()=>{
  await navigate(page,'combat');await page.locator('#dice-form [name="skill"]').selectOption('Combat');await page.locator('#dice-form button').click();assert.ok(Number(await page.locator('#dice-result strong').textContent())>=12);
  await add(page,'combats',{name:'Pirate',combat:0,defence:1,stamina:100});await page.locator('[data-attack$=":hero"]').click();await settled(page);const s=(await current(page)).state;assert.ok(s.combats[0].stamina<100);assert.match(s.combats[0].notes,/dégât/);assert.ok(s.dice.length>=2);
 });
 await check('Import de carte, optimisation et affichage agrandi',async()=>{
  await navigate(page,'maps');await page.locator('#map-file').setInputFiles(path.join(root,'assets/apple-touch-icon.png'));await page.locator('#modal').waitFor({state:'visible'});await fillDialog(page,{title:'Carte de Sokara',notes:'Le port au sud.'});await page.locator('[data-map]').click();assert.equal(await page.locator('.map-viewer img').count(),1);await page.locator('[data-close]').click();await settled(page);assert.match((await current(page)).state.maps[0].image,/^data:image\/jpeg;base64,/);
 });
 let exported;
 await check('Export JSON et restauration du contenu dans le profil courant',async()=>{
  await navigate(page,'backup');const download=page.waitForEvent('download');await page.locator('[data-action="export"]').click();const d=await download;exported=JSON.parse(await fs.readFile(await d.path(),'utf8'));assert.equal(exported.profile,'Camille');assert.equal(exported.state.ships[0].name,'L’Albatros');
  exported.state.notes='Sauvegarde restaurée avec succès';await page.locator('#import-file').setInputFiles({name:'restauration.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});await page.locator('#modal button.primary').click();await page.locator('#modal').waitFor({state:'hidden'});await settled(page);assert.equal((await current(page)).state.notes,'Sauvegarde restaurée avec succès');
 });
 await check('Rechargement : le profil local reprend automatiquement',async()=>{await page.reload();await page.getByRole('heading',{name:'Bon retour, Camille.'}).waitFor();assert.equal((await current(page)).state.hero.name,'Aëlys');});
 await check('Modification hors connexion puis synchronisation',async()=>{
  await navigate(page,'journal');await context.setOffline(true);await page.locator('[data-field="notes"]').fill('Note en mer, sans connexion.');await page.waitForTimeout(900);const cache=await page.evaluate(()=>JSON.parse(localStorage.getItem('fl.carnet.'+JSON.parse(localStorage.getItem('fl.session')).id)));assert.equal(cache.dirty,true);await context.setOffline(false);await settled(page);assert.equal((await current(page)).state.notes,'Note en mer, sans connexion.');
 });
 await check('Détection des modifications concurrentes et choix du serveur',async()=>{
  const p=await current(page);const changed=structuredClone(p.state);changed.notes='Version écrite par un autre appareil.';
  const response=await fetch(url+'/api.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',id:p.id,version:p.version,state:changed})});assert.equal(response.status,200);
  await page.locator('[data-field="notes"]').fill('Modification de cet appareil.');await page.waitForFunction(()=>document.querySelector('.notice')?.textContent.includes('changé ailleurs'));await navigate(page,'backup');await page.locator('[data-action="remote"]').click();await page.locator('#modal button.primary').click();await page.locator('#modal').waitFor({state:'hidden'});assert.equal(await page.locator('.conflict-panel').count(),0);await navigate(page,'journal');assert.equal(await page.locator('[data-field="notes"]').inputValue(),'Version écrite par un autre appareil.');
 });
 await check('Changement de prénom, liste des profils et isolation des carnets',async()=>{
  await page.locator('.user-button').click();await page.getByLabel('Votre prénom',{exact:true}).fill('Jules');await page.getByRole('button',{name:/Créer mon carnet/}).click();await page.getByRole('heading',{name:'Bon retour, Jules.'}).waitFor();await settled(page);assert.equal((await current(page)).state.inventory.length,0);await page.locator('.user-button').click();await page.locator('#profile-form').waitFor();assert.equal(await page.locator('[data-enter]').count(),2);await page.locator('[data-enter]').filter({hasText:'Camille'}).click();await page.getByRole('heading',{name:'Bon retour, Camille.'}).waitFor();
 });
 await check('Doublons de prénoms, validation API et SQLite non téléchargeable',async()=>{
  const post=async body=>fetch(url+'/api.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await post({action:'create',name:'CAMILLE'})).status,409);assert.equal((await post({action:'create',name:'<script>'})).status,422);
  const p=await current(page);assert.equal((await post({action:'save',id:p.id,version:p.version,state:{schema:1}})).status,422);
  assert.equal((await fetch(url+'/api.php',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://other.example'},body:'{}'})).status,403);
  const tooMany=structuredClone(p.state);tooMany.inventory=Array.from({length:13},(_,i)=>({...p.state.inventory[0],id:'slot-'+i}));assert.equal((await post({action:'save',id:p.id,version:p.version,state:tooMany})).status,422);
  const badFee=structuredClone(p.state);badFee.deposits[0].fee=-10;assert.equal((await post({action:'save',id:p.id,version:p.version,state:badFee})).status,422);
  for(const file of ['aventures.sqlite','aventures.sqlite-journal','.git/config','tests/smoke.cjs'])assert.equal((await fetch(url+'/'+file)).status,404);
 });
 await check('Import invalide rejeté sans modifier le carnet',async()=>{
  await navigate(page,'backup');const before=(await current(page)).state;const invalid={...exported,state:{schema:1}};await page.locator('#import-file').setInputFiles({name:'invalide.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))});await page.waitForTimeout(100);assert.equal(await page.locator('#modal[open]').count(),0);assert.deepEqual((await current(page)).state,before);
 });
 await check('Conflit : conserver la copie locale de manière explicite',async()=>{
  await navigate(page,'journal');const p=await current(page);const other=structuredClone(p.state);other.notes='Autre appareil';await fetch(url+'/api.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',id:p.id,version:p.version,state:other})});await page.locator('[data-field="notes"]').fill('La copie locale que je conserve.');await page.waitForFunction(()=>!!document.querySelector('.notice'));await navigate(page,'backup');await page.locator('[data-action="local"]').click();await page.locator('#modal button.primary').click();await page.locator('#modal').waitFor({state:'hidden'});await settled(page);assert.equal((await current(page)).state.notes,'La copie locale que je conserve.');
 });
 await check('Toutes les rubriques restent dans la largeur d’un iPhone',async()=>{
  for(const width of [375,390,430]){await page.setViewportSize({width,height:844});for(const name of ['home','hero','inventory','journal','codes','sections','money','ships','cults','combat','maps','backup','more']){await navigate(page,name);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Débordement à ${width}px : ${name}`);}}
 });
 await check('Vues bureau et mobile sans erreur JavaScript ou CSP',async()=>{
  await fs.mkdir(path.join(__dirname,'artifacts'),{recursive:true});await page.setViewportSize({width:390,height:844});await navigate(page,'home');await page.locator('#toast').evaluate(el=>el.classList.remove('show'));await page.mouse.move(0,0);await page.screenshot({path:path.join(__dirname,'artifacts/iphone.png'),fullPage:true});await page.setViewportSize({width:1440,height:1100});await navigate(page,'home');await page.screenshot({path:path.join(__dirname,'artifacts/desktop.png'),fullPage:true});assert.deepEqual(errors,[]);assert.ok(!/Fatal error|Uncaught/.test(serverLog));
 });
 console.log(`\n${checks} scénarios réussis. Base de test isolée.`);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)server.kill();if(tmp)await fs.rm(tmp,{recursive:true,force:true});});
