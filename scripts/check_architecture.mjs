import { ESLint } from 'eslint';
import { cruise } from 'dependency-cruiser';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const baselineFile = 'docs/architecture/violations-baseline.json';
const eslint = new ESLint();
const results = await eslint.lintFiles(['src','components','App.tsx','server.ts']);
const findings = results.flatMap(result => result.messages.filter(m=>m.severity===2).map(m=>({
 kind:'eslint',file:path.relative(process.cwd(),result.filePath).replaceAll('\\','/'),rule:m.ruleId ?? 'parse-error',message:m.message
})));
let graph;
if(!process.argv.includes('--eslint-only')) {
 const config = require('../.dependency-cruiser.cjs');
 graph = (await cruise(['src','components','App.tsx','server.ts'],{...config.options,validate:true,ruleSet:config,outputType:'json'})).output;
 if(typeof graph==='string') graph=JSON.parse(graph);
 for(const v of graph.summary.violations) findings.push({kind:'dependency',rule:v.rule.name,from:v.from,to:v.to,cycle:v.cycle});
}
const counts = Object.create(null);
for(const f of findings){const key=JSON.stringify(f);counts[key]=(counts[key]??0)+1;}
if(process.argv.includes('--initialize-baseline')) {
 if(process.env.ARCHITECTURE_INITIAL_BASELINE!=='1') throw new Error('Explicit initial baseline authorization required');
 writeFileSync(baselineFile,JSON.stringify(counts,null,2)+'\n');
}
const baseline=JSON.parse(readFileSync(baselineFile,'utf8'));
const added=Object.entries(counts).filter(([key,count])=>count>(baseline[key]??0));
if(process.argv.includes('--report')) {
 mkdirSync('docs/architecture/reports',{recursive:true});
 writeFileSync('docs/architecture/reports/dependencies.json',JSON.stringify(graph,null,2)+'\n');
}
console.log(JSON.stringify({findings:findings.length,newViolations:added.length,modules:graph?.modules.length}));
if(added.length){console.error(added.map(([key])=>key).join('\n'));process.exitCode=1;}
