import {calculateHousehold,formatEuro,employmentDeduction} from "./calculator.js";
import {phase2Cases} from "./cases.js";

export const LEVELS=[
 {name:"Einstieg",errors:1,seconds:180,cases:5},
 {name:"Sachbearbeitung",errors:2,seconds:150,cases:5},
 {name:"Prüfdienst",errors:3,seconds:120,cases:5}
];
export const NORMS=[
 "§ 7 Abs. 3 Nr. 4 SGB II","§ 9 Abs. 2 SGB II","§ 11 Abs. 1 SGB II",
 "§ 11 Abs. 1 Satz 5 SGB II","§ 11b Abs. 2 SGB II","§ 11b Abs. 3 SGB II",
 "§ 20 SGB II","§ 21 Abs. 2 SGB II","§ 21 Abs. 3 SGB II","§ 21 Abs. 7 SGB II",
 "§ 22 Abs. 1 SGB II","§ 23 Nr. 1 SGB II","§ 72 SGB II"
];
const pick=a=>a[Math.floor(Math.random()*a.length)];
const shuffle=a=>{const b=a.slice();for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;};
const mk=(id,label,amount,norm,kind,explanation,mutate)=>({id,label,amount,correct:amount,norm,kind,explanation,mutate});

function buildLines(input,out){
 const rows=[],memberById=new Map(input.members.map(p=>[p.id,p]));
 for(const p of out.people){
  const source=memberById.get(p.id);
  rows.push({type:"person",text:p.name+(p.kind==="child"?" · Kind":" · "+(source.role||"Mitglied"))});
  const rbNorm=source.regelbedarfsnorm||(source.kind==="child"?"§ 23 Nr. 1 SGB II":"§ 20 SGB II");
  rows.push(mk(p.id+"_rb", "Regelbedarf (Stufe "+source.regelbedarfsstufe+")",source.regelbedarfCents,rbNorm,"rb",
   "Die ausgewiesene Regelbedarfsstufe und der zugehörige Betrag müssen zum im Fall vorgegebenen Personenstatus passen.",
   v=>pick([v+5000,v-5000,source.regelbedarfCents===v? v+1000:v-1000])));
  for(const n of source.additionalNeeds||[]){
   rows.push(mk(p.id+"_need_"+rows.length,n.label,n.amountCents,n.reference,"need",
    "Der Mehrbedarf muss die im Fall festgelegten Tatbestandsvoraussetzungen und den richtigen Prozentsatz abbilden.",
    v=>Math.max(0,v+pick([-2500,2500,5000]))));
  }
  rows.push(mk(p.id+"_kdu","Unterkunft und Heizung",source.kduCents,"§ 22 Abs. 1 SGB II","kdu",
   "Es ist der im Sachverhalt vorgegebene, bereits zugeordnete berücksichtigungsfähige KdU-Betrag anzusetzen.",
   v=>Math.max(0,v+pick([-5000,5000,10000]))));
  if(p.ownIncome>0){
   rows.push(mk(p.id+"_own","Eigenes Einkommen",p.ownIncome,"§ 11 Abs. 1 SGB II","income",
    "Eigenes Einkommen ist der jeweiligen Person zuzuordnen; Absetzbeträge und Privilegierungen müssen gesondert geprüft werden.",
    v=>Math.max(0,v-5000)));
  }
  if(source.employment){
   const hasMinorChild=out.people.some(x=>x.kind==="child"&&x.inBg&&((memberById.get(x.id)?.age??99)<18));
   const deduction=employmentDeduction({...source.employment,hasMinorChild});
   rows.push(mk(p.id+"_net","Netto-Erwerbseinkommen",source.employment.netCents,"§ 11 Abs. 1 SGB II","income",
    "Das Netto-Erwerbseinkommen ist als Falltatsache vorgegeben und darf nicht aus dem Brutto geschätzt werden.",
    v=>Math.max(0,v-5000)));
   rows.push(mk(p.id+"_basic","abzüglich Grundabsetzbetrag",deduction.basic,"§ 11b Abs. 2 SGB II","deduction",
    "Der Grundabsetzbetrag muss nach § 11b Abs. 2 SGB II berücksichtigt werden; Nachweise und Sonderfälle sind gesondert zu prüfen.",
    v=>0));
   rows.push(mk(p.id+"_etf","abzüglich Erwerbstätigenfreibetrag",deduction.etf,"§ 11b Abs. 3 SGB II","deduction",
    "Der Erwerbstätigenfreibetrag richtet sich nach dem Bruttoeinkommen und der gesetzlichen Staffelung.",
    v=>Math.max(0,v-2500)));
   rows.push(mk(p.id+"_counted","anzurechnendes Erwerbseinkommen",deduction.counted,"§ 11b Abs. 2 und 3 SGB II","income",
    "Anzurechnen ist das Netto nach den einschlägigen Absetzungen. Die Zeile muss mit den ausgewiesenen Abzügen übereinstimmen.",
    v=>v+2500));
  }
  if(p.kind==="child"){
   rows.push(mk(p.id+"_kg","Kindergeld dem Kind zugeordnet",p.childBenefit,"§ 11 Abs. 1 Satz 5 SGB II","kg",
    "Kindergeld ist dem Kind nur soweit als Einkommen zuzuordnen, wie es zur Sicherung seines Lebensunterhalts benötigt wird.",
    v=>v===0?2500:0));
  }
  if(p.sharedIncomeShare>0){
   rows.push(mk(p.id+"_share","Anteil am gemeinsamen Einkommen",p.sharedIncomeShare,"§ 9 Abs. 2 SGB II","share",
    "Das Einkommen der Mitglieder ist nach den gesetzlichen Regeln auf die ungedeckten Bedarfe zu beziehen. Die konkrete Verteilung ist hier ein vereinfachtes Trainingsmodell.",
    v=>Math.max(0,v+2500)));
  }
  rows.push(mk(p.id+"_benefit","Individueller Leistungsbetrag",p.benefit,"§ 9 Abs. 2 SGB II","benefit",
   "Der individuelle Anspruch ergibt sich im Modell aus dem verbleibenden Bedarf nach Berücksichtigung der zugeordneten Einkommen.",
   v=>Math.max(0,v+pick([-5000,5000]))));
  if(p.supplement>0){
   rows.push(mk(p.id+"_supp","Sofortzuschlag",p.supplement,"§ 72 SGB II","supp",
    "Der Sofortzuschlag ist bei Vorliegen der gesetzlichen Voraussetzungen zusätzlich und gesondert zu berücksichtigen.",
    v=>0));
  }
 }
 for(const step of out.steps.filter(s=>s.label==="Kindergeldüberhang")){
  rows.push(mk("kg_surplus_"+rows.length,"Kindergeldüberhang als Einkommen",step.amount,"§ 11 Abs. 1 Satz 5 SGB II","kg",
   "Der nicht zur Deckung des eigenen Lebensunterhalts des Kindes benötigte Kindergeldanteil ist dem konkret berechtigten Elternteil zuzuordnen.",
   v=>v+2500));
 }
 rows.push({type:"section",text:"Zusammenfassung"});
 rows.push(mk("total_need","Gesamtbedarf der Bedarfsgemeinschaft",out.totals.totalNeed,null,"total",
  "Die Gesamtbedarfsumme muss den berücksichtigten individuellen Bedarfen entsprechen.",v=>v+2500));
 rows.push(mk("regular","Regulärer Leistungsanspruch",out.totals.regularBenefit,null,"total",
  "Der Gesamtbetrag muss mit den ausgewiesenen individuellen Leistungsbeträgen übereinstimmen.",v=>Math.max(0,v-2500)));
 rows.push(mk("supp_total","Sofortzuschlag gesamt",out.totals.immediateSupplement,"§ 72 SGB II","supp",
  "Die Summe muss den ausgewiesenen individuellen Sofortzuschlägen entsprechen.",v=>v+2500));
 rows.push(mk("total","Gesamtanspruch einschließlich Sofortzuschlag",out.totals.totalBenefit,null,"total",
  "Gesamtanspruch = regulärer Leistungsanspruch plus Sofortzuschlag.",v=>v+5000));
 return rows;
}

export function createBill(caseDef, errorCount, seedIndex=0){
 const out=calculateHousehold(caseDef.input);
 const rows=buildLines(caseDef.input,out);
 const candidates=shuffle(rows.filter(r=>r.type!=="person"&&r.type!=="section"&&r.kind!=="total"&&typeof r.mutate==="function"));
 const errors=[];
 for(const row of candidates){
  if(errors.length>=errorCount)break;
  const altered=row.mutate(row.amount);
  if(!Number.isSafeInteger(altered)||altered<0||altered===row.amount)continue;
  row.correct=row.amount;row.amount=altered;row.manipulated=true;
  errors.push({rowId:row.id,title:"Fehlerhafte Position: "+row.label,norm:row.norm,text:row.explanation,correct:row.correct});
 }
 // The summary total is a safe fallback when the case has too few eligible line items.
 if(errors.length<errorCount){
  const row=rows.find(r=>r.id==="total");
  if(row&&!row.manipulated){
   row.correct=row.amount;row.amount+=2500;row.manipulated=true;
   errors.push({rowId:row.id,title:"Rechenfehler in der Gesamtsumme",norm:null,
    text:"Der Gesamtanspruch stimmt nicht mit regulärem Leistungsanspruch plus Sofortzuschlag überein.",correct:row.correct});
  }
 }
 return {caseDef,output:out,rows,errors:errors.slice(0,errorCount)};
}

export function normOptions(correct){
 const distractors=shuffle(NORMS.filter(n=>n!==correct)).slice(0,3);
 return shuffle([correct,...distractors]);
}
export function euro(c){return formatEuro(c);}