import {calculateHousehold,earnedIncomeAllowance,splitCents,RATES_2026,KINDERGELD_2026,SOFORTZUSCHLAG} from "./calculator.js";
import {phase2Cases} from "./cases.js";
function eq(a,b,m){if(a!==b)throw new Error(`${m}: erwartet ${b}, erhalten ${a}`);}
function ok(v,m){if(!v)throw new Error(m);}
function throws(fn,m){let t=false;try{fn();}catch{t=true;}ok(t,m);}
export function runAllTests(){
 const tests=[
 ["Regelbedarfswerte 2026",()=>{eq(RATES_2026.rbs1,56300,"RBS1");eq(RATES_2026.rbs6,35700,"RBS6");}],
 ["Centverteilung erhält Gesamtbetrag",()=>eq(splitCents(10001,3).reduce((a,b)=>a+b,0),10001,"Summe")],
 ["Kopfteil mit null Personen ungültig",()=>throws(()=>splitCents(100,0),"muss Fehler auslösen")],
 ["Freibetrag ohne minderjähriges Kind",()=>eq(earnedIncomeAllowance(150000,false),24800,"ETF")],
 ["Freibetrag mit minderjährigem Kind",()=>eq(earnedIncomeAllowance(150000,true),27800,"ETF")],
 ["Kindergeld wird nur bis zum ungedeckten Bedarf dem Kind zugeordnet",()=>{
  const o=calculateHousehold(phase2Cases.find(x=>x.id==="child-kg-part").input),k=o.people.find(x=>x.id==="k");
  eq(k.childBenefit,24000,"KG-Anteil");eq(k.inBg,false,"Kind muss wegen KG-Deckung aus BG ausscheiden");
 }],
 ["Kindergeldüberhang fließt in den Pool des Berechtigten",()=>{
  const o=calculateHousehold(phase2Cases.find(x=>x.id==="child-kg-part").input);
  ok(o.steps.some(s=>s.label==="Kindergeldüberhang"&&s.amount>0),"Überhang fehlt");
 }],
 ["Kind scheidet bei Eigenmittel plus Kindergeld aus",()=>{
  const o=calculateHousehold(phase2Cases.find(x=>x.id==="child-excluded").input),k=o.people.find(x=>x.id==="k");
  eq(k.inBg,false,"BG-Status");eq(k.benefit,0,"Leistungsbetrag");
 }],
 ["Sofortzuschlag bei alleiniger Kindergelddeckung",()=>{
  const o=calculateHousehold(phase2Cases.find(x=>x.id==="child-excluded").input),k=o.people.find(x=>x.id==="k");
  eq(k.supplement,SOFORTZUSCHLAG,"§72");
 }],
 ["Sofortzuschlag bei ausschließlichem BuT-Anspruch",()=>{
  const o=calculateHousehold(phase2Cases.find(x=>x.id==="sofort-but").input),k=o.people.find(x=>x.id==="k");
  eq(k.supplement,SOFORTZUSCHLAG,"§72 BuT");
 }],
 ["Gemeinsamer Einkommenspool verteilt sich auf BG-Mitglieder",()=>{
  const o=calculateHousehold(phase2Cases.find(x=>x.id==="couple-work").input);
  ok(o.people.every(p=>p.sharedIncomeShare>=0),"negative Verteilung");
  eq(o.people.reduce((s,p)=>s+p.sharedIncomeShare,0),Math.min(o.totals.sharedIncome,o.totals.totalResidualNeed),"Poolsumme");
 }],
 ["Sofortzuschlag ist auf unter 25-Jährige begrenzt",()=>{
  const base=phase2Cases.find(x=>x.id==="sofort-but").input;
  const modified={members:base.members.map(p=>p.id==="k"?{...p,age:25}:p)};
  const o=calculateHousehold(modified);eq(o.people.find(p=>p.id==="k").supplement,0,"kein Zuschlag ab 25");
 }],
 ["Gesamtanspruch ist regulärer Anspruch plus Sofortzuschlag",()=>{
  for(const c of phase2Cases){const o=calculateHousehold(c.input);eq(o.totals.totalBenefit,o.totals.regularBenefit+o.totals.immediateSupplement,c.title);}
 }]
 ];
 const results=tests.map(([name,fn])=>{try{fn();return{name,ok:true,detail:""};}catch(e){return{name,ok:false,detail:e.message};}});
 const passed=results.filter(x=>x.ok).length;return{results,passed,failed:results.length-passed,total:results.length};
}