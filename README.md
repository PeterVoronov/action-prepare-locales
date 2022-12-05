# Action to adopt the single language translation .JSON files to the format of locales of [ioBroker Auto Telegram Menu script](https://github.com/PeterVoronov/ioBrokerTelegramMenuScript)

## Action functionality and dependencies
It requires download sources of translations (`core_%language%.json`) from the translation management engine on some previous action step. It have to download the single language translation .JSON files to the `folder_with_simple_jsons`.

This `action` checks, if the 'source' translation files is changed (from the last commit), and based on result - produces the new, formatted locales files in the `folder_with_core_translations`.
After that it make a commit with both - sources and results files.

## Action inputs

 - `folder_with_simple_jsons` - The folder in source code hierarchy, where the single language .JSON files are downloaded from the translation management engine on some previous step of action job.
 - `folder_with_core_translations` - The folder in source code hierarchy, to which newly formatted locales files wil be written. These files can be used by [ioBroker Auto Telegram Menu script](https://github.com/PeterVoronov/ioBrokerTelegramMenuScript) directly.
 - `git_user_name` - The user name to make a commit with newly formatted locales.
 - `git_user_mail` - The user e-mail to make a commit with newly formatted locales.

## Action outputs
 - `is_commit_available` - In case of changes in the source translation and successful formatting the locales it will be set to `true`. This variable can be used on the next step of action, to make a push conditionally.

