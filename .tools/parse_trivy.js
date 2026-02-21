const fs = require('fs');
const path = 'trivy_report.json';
if(!fs.existsSync(path)){ console.error('trivy_report.json not found'); process.exit(2); }
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
let vulnCount = 0;
const details = [];
if(data.Results && Array.isArray(data.Results)){
  data.Results.forEach(r=>{
    if(r.Vulnerabilities && Array.isArray(r.Vulnerabilities)){
      vulnCount += r.Vulnerabilities.length;
      r.Vulnerabilities.forEach(v=>{
        details.push({Target: r.Target, Pkg: v.PkgName||v.Package||v.Name||'', ID: v.VulnerabilityID, Severity: v.Severity, Title: v.Title});
      });
    }
  });
}
const out = [];
out.push(`VULN_COUNT:: ${vulnCount}`);
if(vulnCount>0){
  out.push('EXAMPLES::');
  details.slice(0,10).forEach(d=>{
    out.push(`${d.Severity} ${d.ID} @ ${d.Pkg} (${d.Target}) - ${d.Title}`);
  });
}
fs.writeFileSync('trivy_summary.txt', out.join('\n'), 'utf8');
console.log(out.join('\n'));
process.exit(0);
