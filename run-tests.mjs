import {runAllTests} from "./js/tests.js";
import {createBill} from "./js/game.js";
import {phase2Cases} from "./js/cases.js";
const r=runAllTests();
const integration=[];
for (const c of phase2Cases) {
  for (const count of [1,2,3]) {
    const bill=createBill(c,count);
    integration.push({name:`Spielintegration ${c.id} / ${count} Fehler`,ok:bill.errors.length===count && bill.errors.every(e=>bill.rows.some(row=>row.id===e.rowId && row.manipulated)),detail:bill.errors.length===count?"":"Fehlerzahl oder markierte Zeile stimmt nicht"});
  }
}
const all=[...r.results,...integration];
const passed=all.filter(x=>x.ok).length;
console.log(JSON.stringify({passed,failed:all.length-passed,total:all.length,results:all},null,2));
if(passed!==all.length)process.exit(1);
