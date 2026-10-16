'use strict';
const fs=require('node:fs'),path=require('node:path');
const {packager}=require('@electron/packager');
const root=path.resolve(__dirname,'..'),metadata=require('../package.json');
const argument=process.argv.find(v=>v.startsWith('--arch='))?.slice(7)||process.argv[process.argv.indexOf('--arch')+1];
const arch=argument&&argument!==process.argv[0]?argument:process.arch;
async function packageWindows(target=arch){
 if(process.platform!=='win32')throw Error('Please build Windows packages on Windows.');
 if(!['x64','arm64'].includes(target))throw Error('Supported Windows architectures: x64, arm64.');
 if(!fs.existsSync(path.join(root,'dist-app/index.html')))throw Error('Run npm run build first.');
 const outputs=await packager({dir:path.join(root,'dist-app'),name:metadata.productName,platform:'win32',arch:target,
  out:path.join(root,'outputs/windows'),icon:path.join(root,'dist-app/app.ico'),overwrite:true,prune:true,asar:true,
  electronVersion:metadata.devDependencies.electron,appVersion:metadata.version,appCopyright:'笑食天下项目作者'});
 console.log('Packaged Windows '+target+': '+outputs[0]);return outputs[0];
}
module.exports={packageWindows};
if(require.main===module)packageWindows().catch(e=>{console.error(e.message);process.exitCode=1});
