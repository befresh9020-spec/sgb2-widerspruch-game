// Phase 2: transparent model of person-level attribution. All amounts are integer cents.
export const RATES_2026=Object.freeze({rbs1:56300,rbs2:50600,rbs3:45100,rbs4:47100,rbs5:39000,rbs6:35700});
export const KINDERGELD_2026=25900;
export const SOFORTZUSCHLAG=2500;

export function assertCents(v,n="Betrag"){if(!Number.isSafeInteger(v)||v<0)throw new TypeError(`${n} muss eine nichtnegative ganze Centzahl sein.`);}
export function roundPercent(base,pct){assertCents(base,"Bemessungsgrundlage");if(!Number.isFinite(pct)||pct<0)throw new TypeError("Prozentsatz ungültig.");return Math.round(base*pct/100);}
export function splitCents(total,count){assertCents(total);if(!Number.isInteger(count)||count<1)throw new RangeError("count muss mindestens 1 sein.");const b=Math.floor(total/count),r=total%count;return Array.from({length:count},(_,i)=>b+(i<r?1:0));}
export function earnedIncomeAllowance(gross,hasMinorChild=false){
 assertCents(gross,"Brutto");const cap=hasMinorChild?150000:120000;
 const a=Math.max(0,Math.min(gross,52000)-10000)*.2;
 const b=Math.max(0,Math.min(gross,100000)-52000)*.3;
 const c=Math.max(0,Math.min(gross,cap)-100000)*.1;
 return Math.round(a+b+c);
}
export function employmentDeduction(e){
 assertCents(e.grossCents,"Brutto");assertCents(e.netCents,"Netto");
 if(e.netCents>e.grossCents)throw new RangeError("Netto darf im Modell nicht höher als Brutto sein.");
 const basic=Math.min(10000,e.netCents);
 const etf=earnedIncomeAllowance(e.grossCents,!!e.hasMinorChild);
 const deduction=Math.min(e.netCents,basic+etf);
 return {basic,etf,deduction,counted:e.netCents-deduction};
}
function validate(input){
 if(!input||!Array.isArray(input.members)||!input.members.length)throw new TypeError("Mindestens ein BG-Mitglied/Fallmitglied erforderlich.");
 const ids=new Set();
 for(const p of input.members){
  if(!p.id||ids.has(p.id))throw new TypeError("Personen-IDs müssen eindeutig sein.");ids.add(p.id);
  if(typeof p.name!=="string"||!p.name.trim())throw new TypeError("Personenname fehlt.");
  assertCents(p.regelbedarfCents,`${p.name}: Regelbedarf`);assertCents(p.kduCents,`${p.name}: KdU`);
  for(const n of p.additionalNeeds||[])assertCents(n.amountCents,`${p.name}: Mehrbedarf`);
  assertCents(p.otherIncomeCents||0,`${p.name}: eigenes Einkommen`);
  if(p.employment) {assertCents(p.employment.grossCents,"Brutto");assertCents(p.employment.netCents,"Netto");}
 }
 for(const p of input.members){
  if(p.kind==="child"&&p.parentId&&!ids.has(p.parentId))throw new TypeError(`Elternteil für ${p.name} fehlt.`);
 }
}
function personNeed(p){return p.regelbedarfCents+p.kduCents+(p.additionalNeeds||[]).reduce((s,n)=>s+n.amountCents,0);}
function getEmploymentCounted(p,hasMinorChild){if(!p.employment)return 0;return employmentDeduction({...p.employment,hasMinorChild}).counted;}

export function calculateHousehold(input){
 validate(input);
 const people=input.members.map(p=>({...p,need:personNeed(p),ownIncome:p.otherIncomeCents||0,childBenefit:0,sharedIncomeShare:0,benefit:0,supplement:0,inBg:true}));
 const byId=new Map(people.map(p=>[p.id,p]));
 const steps=[];
 // Child's own income is assigned to the child. Child benefit is assigned to the child
 // only up to the uncovered non-BuT livelihood need; the excess remains with the beneficiary.
 let childBenefitSurplusByParent=new Map();
 for(const child of people.filter(p=>p.kind==="child")){
  const kg=child.kindergeldCents??input.kindergeldCents??KINDERGELD_2026;
  assertCents(kg,`${child.name}: Kindergeld`);
  const ownUsed=Math.min(child.ownIncome,child.need);
  const gapAfterOwn=Math.max(0,child.need-ownUsed);
  const kgToChild=Math.min(kg,gapAfterOwn);
  const surplus=kg-kgToChild;
  child.ownIncome=ownUsed;
  child.childBenefit=kgToChild;
  child.inBg=(ownUsed+kgToChild)<child.need;
  child.excludedSolelyByKindergeld=!child.inBg && ownUsed<child.need && kgToChild>0;
  if(surplus>0){
   if(!child.parentId)throw new TypeError(`Kindergeldüberhang für ${child.name}: parentId fehlt.`);
   const parent=byId.get(child.parentId);
   if(!parent||parent.kind==="child")throw new TypeError(`Kindergeldberechtigte Person für ${child.name} ist ungültig.`);
   childBenefitSurplusByParent.set(parent.id,(childBenefitSurplusByParent.get(parent.id)||0)+surplus);
  }
  steps.push({label:"Eigenes Einkommen des Kindes",detail:child.name,amount:ownUsed});
  steps.push({label:"Kindergeld dem Kind zugeordnet (§ 11 Abs. 1 Satz 5)",detail:child.name,amount:kgToChild});
  if(surplus)steps.push({label:"Kindergeldüberhang",detail:`Einkommen von ${byId.get(child.parentId).name}`,amount:surplus});
 }
 // Shared pool: adult members' countable income plus child-benefit surplus assigned to the beneficiary.
 // Child-specific own income and child-assigned KG have already been applied only to that child.
 const hasMinorChild=people.some(p=>p.kind==="child"&&(p.age??99)<18&&p.inBg);
 let sharedIncome=0;
 for(const p of people.filter(p=>p.kind!=="child")){
  const ownOther=p.ownIncome;
  const employment=p.employment?getEmploymentCounted(p,hasMinorChild):0;
  const surplus=childBenefitSurplusByParent.get(p.id)||0;
  p.sharedPoolContribution=ownOther+employment+surplus;
  sharedIncome+=p.sharedPoolContribution;
  if(p.employment){
   const d=employmentDeduction({...p.employment,hasMinorChild});
   steps.push({label:"Netto-Erwerbseinkommen",detail:p.name,amount:p.employment.netCents});
   steps.push({label:"Grundabsetzbetrag (§ 11b Abs. 2)",detail:p.name,amount:-d.basic});
   steps.push({label:"Erwerbstätigenfreibetrag (§ 11b Abs. 3)",detail:p.name,amount:-d.etf});
   steps.push({label:"Anrechenbares Erwerbseinkommen",detail:p.name,amount:d.counted});
  }
  if(ownOther)steps.push({label:"Weiteres eigenes Einkommen im Modell",detail:p.name,amount:ownOther});
 }
 const inBg=people.filter(p=>p.inBg);
 const residualNeeds=inBg.map(p=>Math.max(0,p.need-p.ownIncome-p.childBenefit));
 const totalResidual=residualNeeds.reduce((a,b)=>a+b,0);
 const poolUsed=Math.min(sharedIncome,totalResidual);
 let allocated=0;
 const shares=inBg.map((p,i)=>{
  if(i===inBg.length-1)return poolUsed-allocated;
  const v=totalResidual?Math.floor(poolUsed*residualNeeds[i]/totalResidual):0;
  allocated+=v;return v;
 });
 inBg.forEach((p,i)=>{
  p.sharedIncomeShare=shares[i];
  p.benefit=Math.max(0,residualNeeds[i]-shares[i]);
 });
 // Excluded child has no regular BG entitlement; its eligibility for §72 may still arise
 // if the sole reason for no entitlement is the KG attribution.
 for(const child of people.filter(p=>p.kind==="child"&&!p.inBg)){child.benefit=0;child.sharedIncomeShare=0;}
 // §72: RBS 3–6 plus (a) entitlement to Grundsicherungsgeld, (b) only BuT entitlement,
 // or (c) no entitlement solely because Kindergeld was counted.
 let immediateSupplement=0;
 for(const p of people){
  const rbs=Number(p.regelbedarfsstufe||0);
  const ageEligible=Number.isInteger(p.age)&&p.age<25;
  const qualifyingStage=[3,4,5,6].includes(rbs)&&ageEligible;
  const entitled=p.inBg&&p.benefit>0;
  const butOnly=!!p.onlyBuTClaim;
  const solelyKg=!p.inBg&&p.excludedSolelyByKindergeld;
  if(qualifyingStage&&(entitled||butOnly||solelyKg)){
   p.supplement=SOFORTZUSCHLAG;immediateSupplement+=p.supplement;
  }
 }
 const totalNeed=inBg.reduce((s,p)=>s+p.need,0);
 const regularBenefit=inBg.reduce((s,p)=>s+p.benefit,0);
 const totalBenefit=regularBenefit+immediateSupplement;
 const countedIncome=people.reduce((s,p)=>s+p.ownIncome+p.childBenefit,0)+sharedIncome-poolUsed;
 for(const p of people){
  steps.push({label:"Ungedeckter Bedarf nach eigenem Einkommen und Kindergeld",detail:p.name+(p.inBg?" · BG-Mitglied":" · außerhalb der BG"),amount:p.inBg?Math.max(0,p.need-p.ownIncome-p.childBenefit):0});
  if(p.sharedIncomeShare)steps.push({label:"Anteil am gemeinsamen Einkommenspool (§ 9 Abs. 2 Modell)",detail:p.name,amount:p.sharedIncomeShare});
  if(p.supplement)steps.push({label:"Sofortzuschlag (§ 72)",detail:p.name,amount:p.supplement});
 }
 return {
  people:people.map(p=>({id:p.id,name:p.name,kind:p.kind,need:p.need,ownIncome:p.ownIncome,childBenefit:p.childBenefit,sharedIncomeShare:p.sharedIncomeShare,benefit:p.benefit,inBg:p.inBg,supplement:p.supplement,excludedSolelyByKindergeld:p.excludedSolelyByKindergeld||false})),
  steps,
  totals:{totalNeed,countedIncome,sharedIncome,totalResidualNeed:totalResidual,regularBenefit,immediateSupplement,totalBenefit}
 };
}
export function formatEuro(cents){return new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(cents/100);}