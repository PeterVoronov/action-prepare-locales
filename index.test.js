const process = require('process');
const cp = require('child_process');
const path = require('path');

// shows how the runner will run a javascript action with env / stdout protocol
test('test runs', () => {
  process.env['FOLDER_WITH_SIMPLE_JSONS'] = path.join('dist');
  process.env['FOLDER_WITH_CORE_TRANSLATIONS'] = path.join('dist');
  const ip = path.join(__dirname, 'index.js');
  const testDir = path.join(__dirname, 'tests');
  const result = cp.execSync(`cd ${testDir}; node ${ip}`, {env: process.env}).toString();
  console.log(result);
});
