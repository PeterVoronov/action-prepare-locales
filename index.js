const core = require('@actions/core');


// most @actions toolkit packages have async methods
async function run() {
  try {
    const 
    folderWithSimpleJSONs = core.getInput('folder_with_simple_jsons'),
    folderWithCoreTranslations = core.getInput('folder_with_core_translations');
    console.log(`folderOfSimpleJSONs ${folderWithSimpleJSONs}!`);
    console.log(`folderOfCoreTranslations ${folderWithCoreTranslations}!`);
    // Get the JSON webhook payload for the event that triggered the workflow
    // const payload = JSON.stringify(github.context.payload, undefined, 2)
    // console.log(`The event payload: ${payload}`);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
