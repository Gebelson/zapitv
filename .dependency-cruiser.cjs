module.exports = {
 forbidden: [
  {name:'no-circular',severity:'error',from:{},to:{circular:true}},
  {name:'core-not-ui',severity:'error',from:{path:'^src/core/'},to:{path:'^(components/|src/components/|src/pages/)'}},
  {name:'server-not-ui',severity:'error',from:{path:'^(server\\.ts$|src/server/)'},to:{path:'^(components/|src/components/|src/pages/)'}}
 ],
 options:{doNotFollow:{path:'node_modules'},exclude:'(^|/)(dist|node_modules|api)/',tsConfig:{fileName:'tsconfig.json'},tsPreCompilationDeps:true}
};
