# VUE

We are using are VueJS as a build tool to help create a modular version of the Fantasy Map Generator so that individual contributors can work with more manageable files.

## Goal

We could divide and conquer in steps.

* Quarter the codebase - take the 10K line codebase and create 4 script files containing 2.5K each
* repeat with each 2.5K file so that we're down to many 500 line or less files - about 16 files
* Create 1 main component which imports in all these functions.

Run the project and it should appear exactly like the 10K original script file except everything is modularized.
Once the codebase is divided into folders and sub folders and we're now leveraging import/export pattern to rebuild the main component by importing all the functions.

Then we could begin looking a candidates for other components such the editor overlay and also begin refactoring and modernizing the code to es6/7 standards.

## Tests

We need to figure out how to run the tests.
