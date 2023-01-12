"use strict";

const core = require('@actions/core');
const path = require('path');
const git = require('isomorphic-git');
const fs = require('fs');
const glob = require('glob');

const
  isAdded = '*added',
  isModified = '*modified',
  isDeleted = '*deleted',
  isOpsSymbol = {
    [isAdded]: '+',
    [isModified]: '*',
    [isDeleted]: '-',
  };

function translationSortAndFill(translationObject, translationPrefix) {
  const sortedTranslation = {};
  Object.keys(translationObject).sort().forEach(translationId => {
    const currentId = translationPrefix ? [translationPrefix, translationId].join('.') : translationId;
    if (typeof translationObject[translationId] === 'object') {
      sortedTranslation[translationId] = translationSortAndFill(translationObject[translationId], currentId);
    }
    else {
      sortedTranslation[translationId] = translationObject[translationId] ? translationObject[translationId] : currentId;
    }
  });
  return sortedTranslation;
}

function translationToPlain(translationObject, translationPrefix) {
  const translationPlain = {};
  Object.keys(translationObject).forEach(translationId => {
    const currentId = translationPrefix ? [translationPrefix, translationId].join('.') : translationId;
    if (typeof translationObject[translationId] === 'object') {
      const inheritedPlain = translationToPlain(translationObject[translationId], currentId);
      Object.keys(inheritedPlain).forEach(inheritedTranslationId => {
        translationPlain[inheritedTranslationId] = inheritedPlain[inheritedTranslationId];
      })
    }
    else {
      translationPlain[currentId] = translationObject[translationId];
    }
  });
}

// most @actions toolkit packages have async methods
async function run() {
  let message = '';
  const dir = process.cwd();
  const
    addToGitFolders = {},
    addToGitFiles = [],
    updatedLanguages = {};
  try {
    let
      folderWithSimpleJSONs, folderWithCoreTranslations,
      sourceTranslationsPattern, transformedTranslationsRelativePathAndPattern,
      gitUserName, gitUserMail;
    try {
      sourceTranslationsPattern = core.getInput('source_translations_pattern', { required: true });
    }
    catch (error) {
      // To have possibility run out of github actions environment (for `index.test.js`)
      sourceTranslationsPattern = 'locales/source/core_(??).json';
    }
    try {
      transformedTranslationsRelativePathAndPattern = core.getInput('transformed_translations_relative_path_and_pattern', { required: true });
    }
    catch (error) {
      // To have possibility run out of github actions environment (for `index.test.js`)
      transformedTranslationsRelativePathAndPattern = '../locale_$language.json';
    }
    gitUserName = core.getInput('git_user_name');
    if (gitUserName === undefined) gitUserName = 'github-actions';
    gitUserMail = core.getInput('git_user_mail');
    if (gitUserMail === undefined) gitUserMail = 'github-actions@github.com';
    console.log(`Source translations pattern = ${sourceTranslationsPattern}!`);
    console.log(`Transformed translation pattern =  ${transformedTranslationsRelativePathAndPattern}!`);
    const sourceFileRegExp = new RegExp(path.basename(sourceTranslationsPattern));
    sourceTranslationsPattern = sourceTranslationsPattern.replace(/[()]/g, '');
    const
      transformedTranslationsRelativePath = path.dirname(transformedTranslationsRelativePathAndPattern),
      transformedTranslationsPattern = path.basename(transformedTranslationsRelativePathAndPattern);
    const sourceFilesArray = glob.sync(sourceTranslationsPattern);
    if (sourceFilesArray && sourceFilesArray.length) {
      for (const sourceFullPath of sourceFilesArray) {
        const 
          sourceFolder = path.dirname(sourceFullPath),
          sourceFileName = path.basename(sourceFullPath);
        if (! addToGitFolders.hasOwnProperty(sourceFolder)) addToGitFolders[sourceFolder] = {files: [], languages: {}};
        const 
          currentFolder = addToGitFolders[sourceFolder],
          sourceFileMask = sourceFileRegExp.exec(sourceFileName);
        if (sourceFileMask && (sourceFileMask.length === 2) && sourceFileMask[1]) {
          const 
            translationLanguageId = sourceFileMask[1],
            transformedFolder = path.join(currentFolder, transformedTranslationsRelativePath),
            transformedFileName = transformedTranslationsPattern.replace('$language', translationLanguageId),
            transformedFullPath= path.join(transformedFolder, transformedFileName),
            sourceFileStatus = await git.status({ fs, dir, filepath: sourceFullPath });
            console.log(`${sourceFileStatus} status = ${sourceFileStatus}`);
            if ((!fs.existsSync(transformedFullPath)) || ([isAdded, isModified].includes())) {
              console.log(`File to create/update: '${transformedFullPath}'`);
              const transformedFileStatus = fs.existsSync(transformedFullPath) ? isModified : isAdded;
              try {
                const translationSourceRaw = fs.readFileSync(sourceFullPath);
                try {
                  const translationSource = JSON.parse(translationSourceRaw);
                  if ((typeof translationSource === 'object') && Object.keys(translationSource).length) {
                    const
                      translationSorted = translationSortAndFill(translationSource, '');
                      translationTransformed = {
                        type: 'telegramMenuTranslation',
                        language: translationLanguageId,
                        version: '1.0',
                        translation: {
                          core: translationSorted
                        }
                      },
                      translationCoreJSON = JSON.stringify(translationCore, null, 2),
                      changedKeys = {};
                    if (fs.existsSync(transformedFullPath)) {
                      const transformedOldJSON = fs.readFileSync(transformedFullPath);
                      try {
                        const translationOld = JSON.parse(transformedOldJSON);
                        if (translationOld && translationOld.hasOwnProperty('translation')) {
                          const 
                            translationOldPlain = translationToPlain(translationOld['translation'], ''),
                            translationPlain = translationToPlain(translationSorted['translation'], '');
                          Object.keys(translationOldPlain).forEach(key => {
                            if (translationPlain.hasOwnProperty(key) && (translationOldPlain[key] !== translationPlain[key])) {
                              changedKeys[key] = isModified;
                            }
                            else if (! translationPlain.hasOwnProperty(key)) {
                              changedKeys[key] = isDeleted;
                            }
                          });
                          Object.keys(translationPlain).forEach(key => {
                            if (! translationOldPlain.hasOwnProperty(key)) {
                              changedKeys[key] = isAdded;
                            }
                          });
                        }
                      }
                      catch (error) {
                        core.error(`Can't parse old core file '${transformedFullPath}'. Error is ${JSON.stringify(error)}.`);
                      }
                    }
                    try {
                      fs.writeFileSync(transformedFullPath, translationCoreJSON);
                      addToGitFiles.push(translationSimpleGitPath);
                      addToGitFiles.push(translationCoreGitPath);
                      console.log(`Fully formatted core translation file '${translationCoreGitPath}' is created/updated.`);
                      message += `\t${transformedFileStatus} ${translationCoreGitPath}\n`;
                      updatedLanguages[translationLanguageId] = {
                        source: sourceFileStatus,
                        sourceName: translationSimpleGitPath,
                        core:  transformedFileStatus,
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
    
          }
      }
    }
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
              name: gitUserName,
              email: gitUserMail
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
