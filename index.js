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
      const inheritedPlain = translationToPlain(translationObject[translationId], translationId);
      Object.keys(inheritedPlain).forEach(inheritedTranslationId => {
        translationPlain[inheritedTranslationId] = inheritedPlain[inheritedTranslationId];
      });
    }
    else {
      translationPlain[currentId] = translationObject[translationId];
    }
  });
  return translationPlain;
}

// most @actions toolkit packages have async methods
async function run() {
  const dir = process.cwd();
  const foldersToAddToGit = {};
  try {
    let
      sourceTranslationsPattern, transformedTranslationsRelativePathAndPattern;
    try {
      sourceTranslationsPattern = core.getInput('source_translations_pattern', { required: true });
      try {
        transformedTranslationsRelativePathAndPattern = core.getInput('transformed_translations_relative_path_and_pattern', { required: true });
        let gitUserName = core.getInput('git_user_name');
        if (! gitUserName) gitUserName = 'github-actions';
        let gitUserMail = core.getInput('git_user_mail');
        if (! gitUserMail) gitUserMail = 'github-actions@github.com';
        let isDryRun = core.getInput('dry_run');
        if ((! isDryRun) || (isDryRun !== 'true')) {
          isDryRun = false;
        }
        else {
          isDryRun = true;
        }
        console.log(`Source translations pattern = ${sourceTranslationsPattern}!`);
        console.log(`Transformed translation pattern =  ${transformedTranslationsRelativePathAndPattern}!`);
        const sourceFileRegExp = new RegExp(path.basename(sourceTranslationsPattern).replace(/\?/g,'.'));
        sourceTranslationsPattern = sourceTranslationsPattern.replace(/[()]/g, '');
        const
          transformedTranslationsRelativePath = path.dirname(transformedTranslationsRelativePathAndPattern),
          transformedTranslationsPattern = path.basename(transformedTranslationsRelativePathAndPattern);
        const sourceFilesArray = glob.sync(sourceTranslationsPattern);
        if (sourceFilesArray && sourceFilesArray.length) {
          for (const sourceFullPath of sourceFilesArray) {
            const
              sourceFolder = path.dirname(sourceFullPath),
              sourceFileName = path.basename(sourceFullPath),
              sourceFileMask = sourceFileRegExp.exec(sourceFileName);
            if (sourceFileMask && (sourceFileMask.length === 2) && sourceFileMask[1]) {
              const
                translationLanguageId = sourceFileMask[1],
                transformedFolder = path.join(sourceFolder, transformedTranslationsRelativePath),
                transformedFileName = transformedTranslationsPattern.replace('$language$', translationLanguageId),
                transformedFullPath= path.join(transformedFolder, transformedFileName),
                sourceFileStatus = await git.status({ fs, dir, filepath: sourceFullPath });
                console.log(`${sourceFullPath} status = ${sourceFileStatus}`);
                if ((!fs.existsSync(transformedFullPath)) || ([isAdded, isModified].includes(sourceFileStatus))) {
                  console.log(`File to create/update: '${transformedFullPath}'`);
                  const transformedFileStatus = fs.existsSync(transformedFullPath) ? isModified : isAdded;
                  try {
                    const translationSourceRaw = fs.readFileSync(sourceFullPath);
                    try {
                      const translationSource = JSON.parse(translationSourceRaw);
                      if ((typeof translationSource === 'object') && Object.keys(translationSource).length) {
                        const
                          translationSorted = translationSortAndFill(translationSource, ''),
                          translationTransformed = {
                            type: 'telegramMenuTranslation',
                            language: translationLanguageId,
                            version: '1.0',
                            translation: translationSorted
                          },
                          translationTransformedJSON = JSON.stringify(translationTransformed, null, 2),
                          changedKeys = {};
                        if (fs.existsSync(transformedFullPath)) {
                          const transformedOldRaw = fs.readFileSync(transformedFullPath);
                          try {
                            const translationOld = JSON.parse(transformedOldRaw);
                            if (translationOld && translationOld.hasOwnProperty('translation')) {
                              const
                                translationOldPlain = translationToPlain(translationOld['translation'], ''),
                                translationPlain = translationToPlain(translationSorted, '');
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
                          fs.writeFileSync(transformedFullPath, translationTransformedJSON);
                          console.log(`Transformed translation file '${transformedFullPath}' is created/updated.`);
                          if (! foldersToAddToGit.hasOwnProperty(sourceFolder)) foldersToAddToGit[sourceFolder] = {};
                          foldersToAddToGit[sourceFolder][translationLanguageId] = {
                            source: {path: sourceFullPath, status: sourceFileStatus},
                            transformed: {path: transformedFullPath, status: transformedFileStatus},
                            changedKeys: changedKeys
                          };
                        }
                        catch (error) {
                          core.error(`Can't write to file '${transformedFullPath}'`);
                        }
                      }
                      else {
                        core.warning(`File '${sourceFileStatus}' has no data!`);
                      }
                    }
                    catch (error) {
                      core.error(`Can't parse file '${sourceFileStatus}'. Error is ${JSON.stringify(error)}.`);
                    }
                  }
                  catch (error) {
                    core.error(`Can't read file '${sourceFileStatus}'`);
                  }
                }
            }
          }
        }
        if (Object.keys(foldersToAddToGit).length) {
          try {
            let message = `Update of locale files by pattern ${sourceTranslationsPattern}.`;
            for (const [gitFolderToAdd, currentLanguages] of Object.entries(foldersToAddToGit)) {
              message += `\n In folder ${gitFolderToAdd} for languages: ${Object.keys(currentLanguages).join(', ')}`;
              for (const [languageId, currentLanguage] of Object.entries(currentLanguages)) {
                message += `\n  ${currentLanguage.source === isAdded &&  currentLanguage.core === isAdded ? '+' : '*'} Language '${languageId}':`;
                message += `\n   Changes in files:`;
                message += `\n    ${isOpsSymbol[currentLanguage.source.status]} ${currentLanguage.source.path},`;
                message += `\n    ${isOpsSymbol[currentLanguage.transformed.status]} ${currentLanguage.transformed.path}.`;
                const changedKeys = currentLanguage.changedKeys;
                if (changedKeys && Object.keys(changedKeys).length) {
                  message += `\n   Changes in translation keys:`;
                  const lastIndex = Object.keys(changedKeys).length - 1;
                  Object.keys(changedKeys).sort().forEach((key, index) => {
                    message += `\n    ${isOpsSymbol[changedKeys[key]]} ${key}${index === lastIndex ? '.' : ','}`;
                  });
                }
                if (! isDryRun) await git.add({ fs, dir, filepath: currentLanguage.source.path });
                if (! isDryRun) await git.add({ fs, dir, filepath: currentLanguage.transformed.path });
              }
            }
            try {
              if (isDryRun) {
                console.log(message);
                core.setOutput('dry_run_is_successful', 'true');
              }
              else {
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
            }
            catch (error) {
              core.error(`Can't make commit. Error is '${error}'.`);
              core.setFailed(`Can't make commit. Error is '${error}'.`);
            }
          }
          catch (error) {
            core.error(`Can't add files to commit. Error is '${error}'.`);
            core.setFailed(`Can't add files commit. Error is '${error}'.`);
          }
        }
      }
      catch (error) {
        core.error(error.message);
        core.setFailed(error.message);
      }
    }
    catch (error) {
      core.error(error.message);
      core.setFailed(error.message);
    }
  }
  catch (error) {
    core.setFailed(error.message);
  }
}

run();
