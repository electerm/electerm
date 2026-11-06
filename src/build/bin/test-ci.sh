#!/bin/bash
cd `dirname $0`
cd ../../..
git co master
git pull
git pull
git delete-branch test-only
git create-branch test-only
git push origin test-only -u
git co -
