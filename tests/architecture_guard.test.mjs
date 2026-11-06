import {ESLint} from 'eslint';
import assert from 'node:assert/strict';
import {writeFileSync,unlinkSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const probe=`src/core/__architecture_probe_${process.pid}.ts`;
let created=false;
try {
 writeFileSync(probe,"import SortDropdown from '../../components/SortDropdown';\nexport const forbiddenUi = SortDropdown;\n",{flag:'wx'});
 created=true;
 const serverResults=await new ESLint().lintText("import View from './components/SortDropdown';\nexport default View;",{filePath:'server.ts'});
 assert.ok(serverResults.some(r=>r.messages.some(m=>m.ruleId==='no-restricted-imports')), 'Root server must reject UI imports');
 const eslintResults=await new ESLint().lintFiles([probe]);
 assert.ok(eslintResults.some(r=>r.messages.some(m=>m.ruleId==='boundaries/dependencies')), 'ESLint must reject extensionless TypeScript UI imports');
 const result=spawnSync(process.execPath,['scripts/check_architecture.mjs'],{encoding:'utf8',timeout:60000});
 assert.equal(result.status,1,result.stderr);
 assert.match(result.stderr,/core-not-ui/);
 console.log('Architecture guard rejects a real new core -> UI dependency');
} finally {if(created)unlinkSync(probe);}
