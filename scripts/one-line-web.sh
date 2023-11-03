#!/bin/bash
git clone --depth 1 https://github.com/electerm/electerm-web.git
cd electerm-web
npm install
npm run build
cp .sample.env .env

# Generate a random alphanumeric string of length 30
SERVER_SECRET=$(openssl rand -base64 30 | tr -dc 'a-zA-Z0-9')

# Get current username
current_user_name=$(whoami)

# Get OS type
os_type=$(uname)

# Depending on the OS, set the DB_PATH
if [[ "$os_type" == "Darwin" ]]; then
    DB_PATH="/Users/${current_user_name}/Library/Application Support/electerm"
elif [[ "$os_type" == "Linux" ]]; then
    DB_PATH="/home/${current_user_name}/.config/electerm"
fi

# Update .env file
sed -i "s/SERVER_SECRET=.*/SERVER_SECRET=${SERVER_SECRET}/" .env
echo "DB_PATH=\"${DB_PATH}\"" >> .env

# run app
NODE_ENV=production node ./src/app/app.js
