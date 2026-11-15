import {LEVELS,createBill,normOptions,euro} from "./game.js";
import {phase2Cases} from "./cases.js";

const $=s=>document.querySelector(s);
const state={screen:"start",level:0,caseIndex:0,score:0,found:0,totalErrors:0,falseAlarms:0,bill:null,marked:[],questions:[],qIndex:0,answers:[],remaining:0,deadline:0,timer:null,overlay:false,focusReturn:null,caseOrder:[]};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function stopTimer(){if(state.timer){clearInterval(state.timer);state.timer=null;}}
function timerText(){const n=Math.max(0,state.remaining);return `${Math.floor(n/60)}:${String(n%60).padStart(2,"0")}`;}
function startTimer(){
 stopTimer();state.deadline=Date.now()+state.remaining*1000;
 state.timer=setInterval(()=>{
  state.remaining=Math.max(0,Math.ceil((state.deadline-Date.now())/1000));
  const el=$("#timer"),bar=$("#progressFill");if(el){el.textContent=timerText();el.classList.toggle("warn",state.remaining<=20);}
  if(bar)bar.style.width=(state.remaining/LEVELS[state.level].seconds*100)+"%";
  if(state.remaining<=0){stopTimer();submitBill();}
 },250);
}
function startRun(){
 state.caseIndex=0;state.score=0;state.found=0;state.totalErrors=0;state.falseAlarms=0;state.caseOrder=phase2Cases.map((_,i)=>i).sort(()=>Math.random()-.5).slice(0,LEVELS[state.level].cases);nextBill();
}
function nextBill(){
 const level=LEVELS[state.level];state.caseIndex++;
 if(state.caseIndex>level.cases){stopTimer();state.screen="end";render();return;}
 const def=phase2Cases[state.caseOrder[state.caseIndex-1]];
 state.bill=createBill(def,level.errors,state.caseIndex);
 state.totalErrors+=state.bill.errors.length;state.marked=[];state.remaining=level.seconds;state.screen="bill";render();startTimer();
}
function toggleRow(id){
 const i=state.marked.indexOf(id);if(i>=0)state.marked.splice(i,1);else state.marked.push(id);
 const row=$("#row_"+CSS.escape(id));if(row){const selected=state.marked.includes(id);row.classList.toggle("selected",selected);row.setAttribute("aria-checked",String(selected));}
 const c=$("#markedCount");if(c)c.textContent=state.marked.length+" markiert";
}
function submitBill(){
 if(state.screen!=="bill")return;stopTimer();state.questions=[];state.answers=[];
 for(const e of state.bill.errors){e.found=state.marked.includes(e.rowId);if(e.found){state.found++;state.score+=10;if(e.norm)state.questions.push(e);}}
 for(const id of state.marked){if(!state.bill.errors.some(e=>e.rowId===id)){state.falseAlarms++;state.score-=5;}}
 if(state.bill.errors.every(e=>e.found)&&state.marked.length===state.bill.errors.length&&state.remaining>0)state.score+=Math.floor(state.remaining/10);
 state.qIndex=0;state.screen=state.questions.length?"question":"review";render();
}
function answer(norm){
 const q=state.questions[state.qIndex],correct=norm===q.norm;if(correct)state.score+=5;
 state.answers.push({title:q.title,chosen:norm,correct,norm:q.norm});state.qIndex++;
 state.screen=state.qIndex>=state.questions.length?"review":"question";render();
}
function render(){
 const app=$("#app");
 if(state.screen==="start")app.innerHTML=renderStart();
 else if(state.screen==="bill")app.innerHTML=renderBill();
 else if(state.screen==="question")app.innerHTML=renderQuestion();
 else if(state.screen==="review")app.innerHTML=renderReview();
 else app.innerHTML=renderEnd();
 if(state.overlay)renderOverlay();
}
function renderStart(){
 return `<main class="screen"><div class="logo">Widerspruch!</div><div class="sub">Bescheidprüfung · SGB II</div>
 <p class="intro">Prüfe den monatlichen Berechnungsbogen. Markiere fehlerhafte Positionen und ordne anschließend die verletzte Rechtsnorm zu. Die Bescheide werden aus dem Phase-2-Rechenkern erzeugt; Fehler werden erst danach gezielt eingebaut.</p>
 <div class="levels" role="radiogroup" aria-label="Schwierigkeitsstufe">${LEVELS.map((l,i)=>`<button class="level" role="radio" aria-checked="${state.level===i}" data-level="${i}"><b>${l.name}</b><small>${l.errors} Fehler · ${Math.round(l.seconds/60)} min · ${l.cases} Bescheide</small></button>`).join("")}</div>
 <button class="primary" id="startRun">Prüfung beginnen</button><button class="secondary" style="margin-top:11px" id="showRules">Rechenmodell und Regeln</button>
 <p class="intro" style="font-size:.76rem;margin-top:20px">Trainingssoftware – kein echter Bewilligungsbescheid und keine Rechtsberatung.</p></main>`;
}
function renderBill(){
 const b=state.bill,level=LEVELS[state.level];let h=`<div class="wrap"><header class="top"><span class="count">Bescheid ${state.caseIndex}/${level.cases}</span><span id="timer" class="timer">${timerText()}</span><span class="count">${state.score} Punkte</span></header><div class="progress"><div id="progressFill" style="width:${state.remaining/level.seconds*100}%"></div></div><div class="paper-scroll"><article class="paper"><div class="letterhead">Jobcenter<br><small style="font-size:.65rem;font-weight:500">Trainingssimulation</small></div><div class="meta"><span>Fall: ${esc(b.caseDef.id.toUpperCase())}</span><span>Berechnungsbogen · monatlich</span></div><h1>Berechnung des Grundsicherungsanspruchs</h1><p class="lead">Markiere jede Position, die im Vergleich zum zugrunde liegenden Sachverhalt oder zur Berechnung fachlich bzw. rechnerisch falsch ist.</p>`;
 for(const r of b.rows){
  if(r.type==="person"){h+=`<div class="person">${esc(r.text)}</div>`;continue;}
  if(r.type==="section"){h+=`<div class="section">${esc(r.text)}</div>`;continue;}
  const selected=state.marked.includes(r.id),cls="rowline"+(r.kind==="total"?" total":"")+(selected?" selected":"");
  h+=`<div class="${cls}" id="row_${esc(r.id)}" role="checkbox" tabindex="0" aria-checked="${selected}" aria-label="${esc(r.label)}, ${euro(r.amount)}" data-row="${esc(r.id)}"><span class="label">${esc(r.label)}</span><span class="dots"></span><span class="amount">${euro(r.amount)}</span></div>`;
 }
 h+=`<div class="footnote"><b>Trainingsfall – kein echter Bescheid.</b><br>${esc(b.caseDef.description)}<br>Das Rechenmodell setzt die rechtlichen Vorfragen und Falltatsachen voraus. Es bildet keine vollständige Anspruchsprüfung ab. Insbesondere sind Vermögen, alle Einkommensprivilegierungen, Unterhalt, BuT-Einzelbedarfe und Sonderfälle nicht vollständig modelliert. Die Einkommensverteilung ist ein vereinfachtes Lernmodell.</div></article></div><footer class="bottom"><span class="count" id="markedCount">${state.marked.length} markiert</span><span class="grow"></span><button class="primary" id="submitBill">Prüfung abgeben</button></footer></div>`;
 return h;
}
function renderQuestion(){
 const q=state.questions[state.qIndex],opts=normOptions(q.norm);
 return `<div class="wrap"><header class="top"><span class="count">Normzuordnung</span><b>${state.qIndex+1}/${state.questions.length}</b><span class="count">${state.score} Punkte</span></header><div class="content-scroll"><div class="card"><h2>${esc(q.title)}</h2><p>Welche Rechtsnorm ist für diesen Fehler maßgeblich?</p>${opts.map((n,i)=>`<button class="option" data-norm="${esc(n)}">${esc(n)}</button>`).join("")}</div></div></div>`;
}
function renderReview(){
 let h=`<div class="wrap"><header class="top"><span class="count">Bescheid ${state.caseIndex}</span><b>Auswertung</b><span class="count">${state.score} Punkte</span></header><div class="content-scroll">`;
 for(const e of state.bill.errors){h+=`<section class="result ${e.found?"good":"bad"}"><span class="tag">${e.found?"Gefunden · +10 Punkte":"Übersehen"}</span><h3>${esc(e.title)}</h3>${e.norm?`<p><b>${esc(e.norm)}</b></p>`:""}<p>${esc(e.text)}</p><p><b>Richtiger Betrag:</b> ${euro(e.correct)}</p></section>`;}
 for(const a of state.answers){h+=`<section class="result ${a.correct?"good":"bad"}"><span class="tag">${a.correct?"Norm richtig · +5 Punkte":"Norm falsch"}</span><h3>${esc(a.title)}</h3><p>Deine Zuordnung: ${esc(a.chosen)}${a.correct?"":" · Richtig wäre "+esc(a.norm)}</p></section>`;}
 if(state.falseAlarms)h+=`<section class="result bad"><span class="tag">Fehlalarme</span><p>${state.falseAlarms} korrekte Position(en) markiert · je −5 Punkte.</p></section>`;
 h+=`</div><footer class="bottom"><button class="primary" id="nextBill">Weiter zum nächsten Bescheid</button></footer></div>`;return h;
}
function renderEnd(){
 const pct=state.totalErrors?Math.round(state.found/state.totalErrors*100):0,verdict=pct>=90?"Sehr gute Prüfungsleistung.":pct>=65?"Solide Prüfung.":"Weitere Übung empfohlen.";
 return `<main class="screen"><div class="logo">${state.score}</div><div class="sub">Punkte · ${LEVELS[state.level].name}</div><h2>${verdict}</h2><div class="endbox"><div class="endrow"><span>Gefundene Fehler</span><b>${state.found}/${state.totalErrors}</b></div><div class="endrow"><span>Trefferquote</span><b>${pct} %</b></div><div class="endrow"><span>Fehlalarme</span><b>${state.falseAlarms}</b></div></div><button class="primary" id="backStart">Neuer Durchgang</button></main>`;
}
function renderOverlay(){
 $("#overlay")?.remove();const layer=document.createElement("div");layer.id="overlay";layer.className="overlay";
 layer.innerHTML=`<section class="dialog" role="dialog" aria-modal="true" aria-labelledby="rulesTitle"><h2 id="rulesTitle">Rechenmodell und Grenzen</h2>
 <p><b>Aufbau:</b> Der Bescheid wird zunächst mit dem Phase-2-Rechenkern berechnet. Erst danach verändert der Fehlergenerator einzelne Positionen. Die Musterberechnung bleibt unverändert erhalten und dient als Referenz für die Auflösung.</p>
 <p><b>Kindergeld:</b> Zurechnung zum Kind nur bis zur Höhe des ungedeckten Lebensunterhaltsbedarfs; ein Überhang wird dem konkret hinterlegten Kindergeldberechtigten zugerechnet. Die gesetzliche Zuordnung und die BG-Mitgliedschaft hängen von den Falltatsachen ab.</p>
 <p><b>Einkommensverteilung:</b> Der gemeinsame Einkommenspool wird im Simulator proportional auf ungedeckte Bedarfe verteilt. Das ist ein vereinfachtes Lernmodell und keine vollständige Abbildung sämtlicher Zuordnungs- und Berechnungsschritte des SGB II.</p>
 <p><b>Sofortzuschlag:</b> Wird als separate Position nach § 72 SGB II behandelt. Die Fallobjekte geben Alter, Regelbedarfsstufe und Anspruchsvoraussetzungen vor.</p>
 <p><b>Grenzen:</b> Vermögen, Unterhalt, sämtliche Einkommensprivilegierungen, individuelle Absetzbeträge, BuT-Einzelbedarfe, Ausbildungssonderfälle, temporäre BG, Sanktionen, Aufrechnungen und vollständige KdU-Angemessenheitsprüfung sind nicht abgebildet.</p>
 <p>Der Simulator ist ein Trainingswerkzeug. Er ersetzt weder die vollständige Sachverhaltsaufklärung noch eine rechtliche Einzelfallprüfung.</p><button class="primary" style="width:100%;margin-top:10px" id="closeRules">Schließen</button></section>`;
 document.body.append(layer);$("#closeRules").focus();
}
function closeRules(){state.overlay=false;$("#overlay")?.remove();$("#showRules")?.focus();}
$("#app").addEventListener("click",e=>{
 const level=e.target.closest("[data-level]");if(level){state.level=Number(level.dataset.level);render();return;}
 if(e.target.closest("#startRun")){startRun();return;}
 if(e.target.closest("#showRules")){state.overlay=true;renderOverlay();return;}
 if(e.target.closest("#closeRules")){closeRules();return;}
 const row=e.target.closest("[data-row]");if(row){toggleRow(row.dataset.row);return;}
 if(e.target.closest("#submitBill")){submitBill();return;}
 const norm=e.target.closest("[data-norm]");if(norm){answer(norm.dataset.norm);return;}
 if(e.target.closest("#nextBill")){nextBill();return;}
 if(e.target.closest("#backStart")){stopTimer();state.screen="start";render();return;}
});
$("#app").addEventListener("keydown",e=>{
 const row=e.target.closest("[data-row]");if(row&&(e.key==="Enter"||e.key===" ")){e.preventDefault();toggleRow(row.dataset.row);}
});
document.addEventListener("keydown",e=>{if(state.overlay&&e.key==="Escape"){state.overlay=false;$("#overlay")?.remove();}});
render();