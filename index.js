const core = require('@actions/core');
const path = require('path')
const git = require('isomorphic-git')
const fs = require('fs')


// most @actions toolkit packages have async methods
async function run() {
  try {
    let  folderWithSimpleJSONs, folderWithCoreTranslations;
    try {
      folderWithSimpleJSONs = core.getInput('folder_with_simple_jsons', { required: true });
    } catch (error) {
      folderWithSimpleJSONs = 'locales/source'
    }
    try {
      folderWithCoreTranslations = core.getInput('folder_with_core_translations', { required: true });
    } catch (error) {
      folderWithCoreTranslations = 'locales'
    }
    console.log(`folderOfSimpleJSONs ${folderWithSimpleJSONs}!`);
    console.log(`folderOfCoreTranslations ${folderWithCoreTranslations}!`);

    const 
      sourcesPath = path.join(process.cwd(),  ...folderWithSimpleJSONs.split('/')),
      sourcesArray = fs.readdirSync(sourcesPath, {withFileTypes: true})
        .filter(item => !item.isDirectory())
        .map(item => item.name);
    for (const sourceTranslationFile of sourcesArray) {
      let status = await git.status({ fs, dir: process.cwd(), filepath: [folderWithSimpleJSONs, sourceTranslationFile].join('/') })
      console.log(`${sourceTranslationFile} status = ${status}`)  
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
