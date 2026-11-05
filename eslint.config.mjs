import parser from '@typescript-eslint/parser';
import boundaries from 'eslint-plugin-boundaries';
export default [
 {ignores:['node_modules/**','dist/**','api/**','tests/**','scripts/**']},
 {files:['**/*.ts','**/*.tsx'],languageOptions:{parser,parserOptions:{ecmaVersion:'latest',sourceType:'module',ecmaFeatures:{jsx:true}}},plugins:{boundaries},settings:{
  'import/resolver':{typescript:{project:'tsconfig.json'}},
  'boundaries/elements':[
   {type:'server',pattern:'src/server/**',partialMatch:false},
   {type:'core',pattern:'src/core/**',partialMatch:false},
   {type:'ui',pattern:['src/components/**','src/pages/**','components/**'],partialMatch:false}
  ]
 },rules:{'no-debugger':'error','boundaries/dependencies':['error',{default:'allow',policies:[{from:{element:{type:['core','server']}},disallow:[{to:{element:{type:'ui'}}}]}]}]}},
 {files:['server.ts'],rules:{'no-restricted-imports':['error',{patterns:[{group:['./components/*','./src/components/*','./src/pages/*'],message:'Backend must not import UI'}]}]}}
];
