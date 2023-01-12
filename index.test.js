const process = require('process');
const cp = require('child_process');
const fs = require('fs');
const path = require('path');

process.env['INPUT_SOURCE_TRANSLATIONS_PATTERN'] = 'locales/source/core_(??).json';
process.env['INPUT_TRANSFORMED_TRANSLATIONS_RELATIVE_PATH_AND_PATTERN'] = '../locale_$language$.json';
process.env['INPUT_DRY_RUN'] = 'true';
const cmd = 'node';
const args = [path.join(__dirname, 'index.js')];
const cwd = path.join(__dirname, 'tests');
const testInputFile =  path.join(cwd, 'locales', 'source', 'core_en.json');
const testData = {"core" : {"testId" : "test"}};
let result = '';
let compare = false;
let otherErrorsCount = 0;
try {
  fs.writeFileSync(testInputFile, JSON.stringify(testData));
  result = cp.execFileSync(cmd, args, {cwd, env: process.env}).toString();
  console.log(result);
  const testTransformedFile =  path.join(cwd, 'locales', 'locale_en.json');
  if (fs.existsSync(testTransformedFile)) {
    try {
      const testTransformedRaw = fs.readFileSync(testTransformedFile);
      const testTransformedData = JSON.parse(testTransformedRaw);
      if (testTransformedData.hasOwnProperty('translation') && (JSON.stringify(testData) === JSON.stringify(testTransformedData['translation']))) {
        compare = true;
        console.log('Result of tests is fully successful!');
      }
      else {
        otherErrorsCount++;
        console.error('Wrong result!');
      }
      try {
        fs.rmSync(testTransformedFile);
        if (fs.existsSync(testInputFile)) fs.rmSync(testInputFile);
      }
      catch (error) {
        otherErrorsCount++;
        console.error(`Can't remove files! Error is ${JSON.stringify(error)}.`);
      }
    }
    catch (error) {
      otherErrorsCount++;
      console.error(`Can't read or parse transformed file'${testTransformedFile}'! Error is ${JSON.stringify(error)}.`);
    }
  }
  else {
    otherErrorsCount++;
    console.error(`Transformed file'${testTransformedFile}' is not created!`);
  }
}
catch (error) {
  console.error(`Can't create test input file '${testInputFile}'! Error is ${JSON.stringify(error)}.`);
}

// shows how the runner will run a javascript action with env / stdout protocol
test('Code runs', () => {
  expect(result.includes('dry_run_is_successful::true')).toBeTruthy();
});

test('Check result', () => {
  expect(compare).toBeTruthy();
});

test('Other checks', () => {
  expect(otherErrorsCount).toEqual(0);
});
