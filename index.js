const core = require('@actions/core');
const path = require('path');
const git = require('isomorphic-git');
const fs = require('fs');


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
      translationSimpleRegExp = new RegExp(/^core_([^._]+)[^.]*\.json$/),
      translationSimpleFilesPath = path.join(process.cwd(),  ...folderWithSimpleJSONs.split('/')),
      translationCoreFilesPath = path.join(process.cwd(),  ...folderWithCoreTranslations.split('/')),
      translationSimpleFilesArray = fs.readdirSync(translationSimpleFilesPath, {withFileTypes: true})
        .filter(item => !item.isDirectory())
        .map(item => item.name);
    for (const translationSimpleFileName of translationSimpleFilesArray) {
      const translationSimpleLanguageFile = translationSimpleRegExp.exec(translationSimpleFileName);
      if (translationSimpleLanguageFile && Array.isArray(translationSimpleLanguageFile) && (translationSimpleLanguageFile[1])) {
        const 
          translationLanguageId = translationSimpleLanguageFile[1],
          translationSimpleGitPath = [folderWithSimpleJSONs, translationSimpleFileName].join('/');
          translationSimpleFileStatus = await git.status({ fs, dir: process.cwd(), filepath: translationSimpleGitPath }),
          translationCoreFileName = `locale_${translationLanguageId}.json`,
          translationCoreGitPath = [folderWithCoreTranslations, folderWithCoreTranslations].join('/'),
          translationCoreFileFullPath = path.join(translationCoreFilesPath, translationCoreFileName);
        console.log(`${translationSimpleGitPath} status = ${translationSimpleFileStatus}`)  
        if ((! fs.existsSync(translationCoreFileFullPath)) || (['*added', '*modified'].includes(translationSimpleFileStatus))) {
          console.log(`File to create/update: '${translationCoreGitPath}'`);
          const  translationSimpleFileFullPath = path.join(translationSimpleFilesPath, translationSimpleFileName);
          try {
            const translationSimpleRaw = fs.readFileSync(translationSimpleFileFullPath);
            try {
              const translationSimple = JSON.parse(translationSimpleRaw);
              if ((typeof(translationSimple) === 'object') && Object.keys(translationSimple).length) {
                Object.keys(translationSimple).forEach(translationId => {
                  if (translationSimple[translationId] === '') {
                    translationSimple[translationId] = `core.${translationId}`;
                  }
                })
                const
                  translationCore = {
                    "type": "telegramMenuTranslation",
                    "language": translationLanguageId,
                    "version": "1.0",
                    "translation": {
                      "core": translationSimple
                    }
                  },
                  translationCoreJSON = JSON.stringify(translationCore, null, 2);
                try {
                  fs.writeFileSync(translationCoreFileFullPath, translationCoreJSON);
                  console.log(`Fully formated core translation file '${translationCoreGitPath}' is created/updated.`);                
                } catch (error) {
                  console.error(`Can't write to file '${translationCoreGitPath}'`);
                }
              }
              else {
                console.warn(`File '${translationSimpleGitPath}' has no data!`)
              }
            } catch (error) {
              console.error(`Can't parse file '${translationSimpleGitPath}'`);
            }
          } catch (error) {
            console.error(`Can't read file '${ftranslationSimpleGitPath}'`);
          }
        }
      }
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
