#!/usr/bin/env sh

# abort on errors
set -e

npm run build

cd dist

git init
git checkout -b master
git add -A
git commit -m 'deploy'

git push -f git@github.com:Azgaar/Fantasy-Map-Generator.git main:gh-pages

cd -
