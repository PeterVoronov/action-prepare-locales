const core = require('@actions/core');
const path = require('path');
const git = require('isomorphic-git');
const fs = require('fs');
// const http = require('isomorphic-git/http/node');

const
  gitFileAdded = '*added',
  gitFileModified = '*modified';

// most @actions toolkit packages have async methods
async function run() {
  let message = 'Update the locales files from the https://simplelocalize.io/\n';
  const dir = process.cwd();
  const addToGitFiles = [];
  try {
    let
      folderWithSimpleJSONs, folderWithCoreTranslations,
      gitUserName, gitUserMail;
    try {
      folderWithSimpleJSONs = core.getInput('folder_with_simple_jsons', { required: true });
    }
    catch (error) {
      folderWithSimpleJSONs = 'locales/source';
    }
    try {
      folderWithCoreTranslations = core.getInput('folder_with_core_translations', { required: true });
    }
    catch (error) {
      folderWithCoreTranslations = 'locales';
    }
    gitUserName = core.getInput('git_user_name');
    if (gitUserName === undefined) gitUserName = 'github-actions';
    gitUserMail = core.getInput('git_user_mail');
    if (gitUserMail === undefined) gitUserMail = 'github-actions@github.com';
    console.log(`folderOfSimpleJSONs ${folderWithSimpleJSONs}!`);
    console.log(`folderOfCoreTranslations ${folderWithCoreTranslations}!`);
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
        if ((!fs.existsSync(translationCoreFileFullPath)) || ([gitFileAdded, gitFileModified].includes(translationSimpleFileStatus))) {
          console.log(`File to create/update: '${translationCoreGitPath}'`);
          const translationCoreFileStatus = fs.existsSync(translationCoreFileFullPath) ? gitFileModified : gitFileAdded;
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
                const
                  translationCore = {
                    type: 'telegramMenuTranslation',
                    language: translationLanguageId,
                    version: '1.0',
                    translation: {
                      core: translationSimple
                    }
                  },
                  translationCoreJSON = JSON.stringify(translationCore, null, 2);
                try {
                  fs.writeFileSync(translationCoreFileFullPath, translationCoreJSON);
                  addToGitFiles.push(translationSimpleGitPath);
                  addToGitFiles.push(translationCoreGitPath);
                  console.log(`Fully formated core translation file '${translationCoreGitPath}' is created/updated.`);
                  message += `\t${translationCoreFileStatus} ${translationCoreGitPath}\n`;
                }
                catch (error) {
                  console.error(`Can't write to file '${translationCoreGitPath}'`);
                }
              }
              else {
                console.warn(`File '${translationSimpleGitPath}' has no data!`);
              }
            }
            catch (error) {
              console.error(`Can't parse file '${translationSimpleGitPath}'`);
            }
          }
          catch (error) {
            console.error(`Can't read file '${translationSimpleGitPath}'`);
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
          const commitResult = await git.commit({
            fs,
            dir,
            author: {
              name: 'github-actions',
              email: 'github-actions@github.com'
            },
            message
          });
          console.log(`Commit result: '${commitResult}'`);
          /* const
            remoteOriginURL = await git.getConfig({ fs, dir, path: 'remote.origin.url' }),
            remoteOriginURLRegExp = /^git@github\.com:([^\/]+)\/([^.]+)\.git$/,
            remoteOriginURLParsed = remoteOriginURLRegExp.exec(remoteOriginURL);
          if (remoteOriginURLParsed && Array.isArray(remoteOriginURLParsed) && remoteOriginURLParsed[1] && remoteOriginURLParsed[2]) {
            const newRemoteOriginUrl = `https://github.com/${remoteOriginURLParsed[1]}/${remoteOriginURLParsed[2]}.git`;
            await git.setConfig({ fs, dir, path: 'remote.origin.url', value: newRemoteOriginUrl });
          }
          try {
            const pushResult = await git.push({
              fs,
              http,
              dir,
              remote: 'origin',
              ref: 'main',
              onAuth: () => ({ username: process.env.GITHUB_TOKEN })
            });
            console.log(pushResult);
          }
          catch (error) {
            console.error(`Can't make push. Erros is '${error}'.`);
          } */
        }
        catch (error) {
          console.error(`Can't make commit. Erros is '${error}'.`);
        }
      }
      catch (error) {
        console.error(`Can't add file to commit. Erros is '${error}'.`);
      }
    }
  }
  catch (error) {
    core.setFailed(error.message);
  }
}

run();
