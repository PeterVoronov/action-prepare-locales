const process = require('process');
const cp = require('child_process');
const path = require('path');

// shows how the runner will run a javascript action with env / stdout protocol
test('test runs', () => {
  process.env['FOLDER_WITH_SIMPLE_JSONS'] = path.join('dist');
  process.env['FOLDER_WITH_CORE_TRANSLATIONS'] = path.join('dist');
  const cmd = 'node';
  const args = [path.join(__dirname, 'index.js')];
  const cwd = path.join(__dirname, 'tests');
  const result = cp.execFileSync(cmd, args, {cwd, env: process.env}).toString();
  console.log(result);
});
