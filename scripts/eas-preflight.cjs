const {spawnSync} = require('node:child_process');
const path = require('node:path');

function preflightArguments(env) {
  const platform = ['android','ios'].includes(env.EAS_BUILD_PLATFORM) ? env.EAS_BUILD_PLATFORM : 'all';
  return [path.join(__dirname,'check-release.cjs'), `--platform=${platform}`,
    ...(env.EAS_BUILD_PROFILE === 'production' ? ['--store'] : [])];
}
if (require.main === module) {
  const result=spawnSync(process.execPath,preflightArguments(process.env),{stdio:'inherit',env:process.env});
  process.exitCode=result.status ?? 1;
}
module.exports={preflightArguments};
