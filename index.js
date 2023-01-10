const core = require('@actions/core');
const path = require('path');
const git = require('isomorphic-git');
const fs = require('fs');

const
  isAdded = '*added',
  isModified = '*modified',
  isDeleted = '*deleted',
  isOpsSymbol = {
    [isAdded]: '+',
    [isModified]: '*',
    [isDeleted]: '-',
  };

// most @actions toolkit packages have async methods
async function run() {
  let message = '';
  const dir = process.cwd();
  const
    addToGitFiles = [],
    updatedLanguages = {};
  try {
    let
      folderWithSimpleJSONs, folderWithCoreTranslations,
      gitUserName, gitUserMail;
    try {
      folderWithSimpleJSONs = core.getInput('folder_with_simple_jsons', { required: true });
    }
    catch (error) {
      // To have possibility run out of github actions environment (for `index.test.js`)
      folderWithSimpleJSONs = 'locales/source';
    }
    try {
      folderWithCoreTranslations = core.getInput('folder_with_core_translations', { required: true });
    }
    catch (error) {
      // To have possibility run out of github actions environment (for `index.test.js`)
      folderWithCoreTranslations = 'locales';
    }
    gitUserName = core.getInput('git_user_name');
    if (gitUserName === undefined) gitUserName = 'github-actions';
    gitUserMail = core.getInput('git_user_mail');
    if (gitUserMail === undefined) gitUserMail = 'github-actions@github.com';
    console.log(`Folder with source translation files ${folderWithSimpleJSONs}!`);
    console.log(`Folder with finally formatted locales ${folderWithCoreTranslations}!`);
    const
      translationSimpleRegExp = /^core_([^._]+)[^.]*\.json$/,
      translationSimpleFilesPath = path.join(process.cwd(), ...folderWithSimpleJSONs.split('/')),
      translationCoreFilesPath = path.join(process.cwd(), ...folderWithCoreTranslations.split('/')),
      translationSimpleFilesArray = fs.readdirSync(translationSimpleFilesPath, { withFileTypes: true })
        .filter(item => !item.isDirectory())
        .map(item => item.name);
    for (const translationSimpleFileName of translationSimpleFilesArray) {
      const translationSimpleLanguageFile = translationSimpleRegExp.exec(translationSimpleFileName);
      if (translationSimpleLanguageFile && Array.isArray(translationSimpleLanguageFile) && (translationSimpleLanguageFile[1])) {
        const
          translationLanguageId = translationSimpleLanguageFile[1],
          translationSimpleGitPath = [folderWithSimpleJSONs, translationSimpleFileName].join('/'),
          translationSimpleFileStatus = await git.status({ fs, dir, filepath: translationSimpleGitPath }),
          translationSimpleFileFullPath = path.join(translationSimpleFilesPath, translationSimpleFileName),
          translationCoreFileName = `locale_${translationLanguageId}.json`,
          translationCoreGitPath = [folderWithCoreTranslations, translationCoreFileName].join('/'),
          translationCoreFileFullPath = path.join(translationCoreFilesPath, translationCoreFileName);
        console.log(`${translationSimpleGitPath} status = ${translationSimpleFileStatus}`);
        if ((!fs.existsSync(translationCoreFileFullPath)) || ([isAdded, isModified].includes(translationSimpleFileStatus))) {
          console.log(`File to create/update: '${translationCoreGitPath}'`);
          const translationCoreFileStatus = fs.existsSync(translationCoreFileFullPath) ? isModified : isAdded;
          try {
            const translationSimpleRaw = fs.readFileSync(translationSimpleFileFullPath);
            try {
              const translationSimple = JSON.parse(translationSimpleRaw);
              if ((typeof translationSimple === 'object') && Object.keys(translationSimple).length) {
                Object.keys(translationSimple).forEach(translationId => {
                  if (translationSimple[translationId] === '') {
                    translationSimple[translationId] = `core.${translationId}`;
                  }
                });
                const sortedTranslation = {};
                Object.keys(translationSimple).sort().forEach(translationId => {
                  sortedTranslation[translationId] = translationSimple[translationId];
                });
                const
                  translationCore = {
                    type: 'telegramMenuTranslation',
                    language: translationLanguageId,
                    version: '1.0',
                    translation: {
                      core: sortedTranslation
                    }
                  },
                  translationCoreJSON = JSON.stringify(translationCore, null, 2),
                  changedKeys = {};
                if (fs.existsSync(translationCoreFileFullPath)) {
                  const translationOldCoreJSON = fs.readFileSync(translationCoreFileFullPath);
                  try {
                    const translationOldCore = JSON.parse(translationOldCoreJSON);
                    if (translationOldCore && translationOldCore.hasOwnProperty('translation')) {
                      const translationOldSimple = translationOldCore['translation']['core'];
                      Object.keys(translationOldSimple).forEach(key => {
                        if (translationSimple.hasOwnProperty(key) && (translationOldSimple[key] !== translationSimple[key])) {
                          changedKeys[key] = isModified;
                        }
                        else if (! translationSimple.hasOwnProperty(key)) {
                          changedKeys[key] = isDeleted;
                        }
                      });
                      Object.keys(translationSimple).forEach(key => {
                        if (! translationOldSimple.hasOwnProperty(key)) {
                          changedKeys[key] = isAdded;
                        }
                      });
                    }
                  }
                  catch (error) {
                    core.error(`Can't parse old core file '${translationCoreFileFullPath}'. Error is ${JSON.stringify(error)}.`);
                  }
                }
                try {
                  fs.writeFileSync(translationCoreFileFullPath, translationCoreJSON);
                  addToGitFiles.push(translationSimpleGitPath);
                  addToGitFiles.push(translationCoreGitPath);
                  console.log(`Fully formatted core translation file '${translationCoreGitPath}' is created/updated.`);
                  message += `\t${translationCoreFileStatus} ${translationCoreGitPath}\n`;
                  updatedLanguages[translationLanguageId] = {
                    source: translationSimpleFileStatus,
                    sourceName: translationSimpleGitPath,
                    core:  translationCoreFileStatus,
                    coreName: translationCoreGitPath,
                    changedKeys: changedKeys
                  };
                }
                catch (error) {
                  core.error(`Can't write to file '${translationCoreGitPath}'`);
                }
              }
              else {
                core.warning(`File '${translationSimpleGitPath}' has no data!`);
              }
            }
            catch (error) {
              core.error(`Can't parse file '${translationSimpleGitPath}'. Error is ${JSON.stringify(error)}.`);
            }
          }
          catch (error) {
            core.error(`Can't read file '${translationSimpleGitPath}'`);
          }
        }
      }
    }
    if (addToGitFiles.length) {
      try {
        for (const gitFileToAdd of addToGitFiles) {
          await git.add({ fs, dir, filepath: gitFileToAdd });
        }
        try {
          message = `Update of locale files for languages: ${Object.keys(updatedLanguages).join(', ')}`;
          Object.keys(updatedLanguages).forEach(languageId => {
            message += `\n  ${updatedLanguages[languageId].source === isAdded &&  updatedLanguages[languageId].core === isAdded ? '+' : '*'} language '${languageId}':`;
            message += `\n   Changes in files:`;
            message += `\n    ${isOpsSymbol[updatedLanguages[languageId].source]} ${updatedLanguages[languageId].sourceName},`;
            message += `\n    ${isOpsSymbol[updatedLanguages[languageId].core]} ${updatedLanguages[languageId].coreName}.`;
            const changedKeys = updatedLanguages[languageId].changedKeys;
            if (changedKeys && Object.keys(changedKeys).length) {
              message += `\n   Changes in translation keys:`;
              const lastIndex = Object.keys(changedKeys).length - 1;
              Object.keys(changedKeys).sort().forEach((key, index) => {
                message += `\n    ${isOpsSymbol[changedKeys[key]]} ${key}${index === lastIndex ? '.' : ','}`;
              });
            }
          });
          const commitResult = await git.commit({
            fs,
            dir,
            author: {
              name: 'github-actions',
              email: 'github-actions@github.com'
            },
            message
          });
          if (commitResult) {
            core.notice(`Commit is successfully made.`);
            core.setOutput('is_commit_available', 'true');
          }
        }
        catch (error) {
          core.error(`Can't make commit. Error is '${error}'.`);
          core.setFailed(`Can't make commit. Error is '${error}'.`);
        }
      }
      catch (error) {
        core.error(`Can't add file to commit. Error is '${error}'.`);
        core.setFailed(`Can't add file commit. Error is '${error}'.`);
      }
    }
  }
  catch (error) {
    core.setFailed(error.message);
  }
}

run();
