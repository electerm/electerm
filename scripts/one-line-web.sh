#!/bin/bash

# Function to check if a command exists
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ $1 is not installed."
        case $1 in
            git)
                echo "To install git:"
                echo "- For Ubuntu/Debian: sudo apt-get install git"
                echo "- For MacOS: brew install git (or install Xcode)"
                echo "- For CentOS/RHEL: sudo yum install git"
                ;;
            node)
                echo "To install Node.js (recommended method):"
                echo "1. Install fnm (Fast Node Manager):"
                echo "   curl -fsSL https://fnm.vercel.app/install | bash"
                echo "2. Then install Node.js:"
                echo "   fnm install 20"
                echo "   fnm use 20"
                ;;
            npm)
                echo "npm comes with Node.js installation. Please install Node.js first."
                ;;
            python)
                echo "To install Python:"
                echo "- For Ubuntu/Debian: sudo apt-get install python3"
                echo "- For MacOS: brew install python"
                echo "- For CentOS/RHEL: sudo yum install python3"
                ;;
        esac
        exit 1
    fi
}

# Function to check system requirements
check_requirements() {
    echo "📋 Checking system requirements..."
    
    # Check for required commands
    check_command git
    check_command node
    check_command npm
    check_command python3
    
    # Check Node.js version
    NODE_VERSION=$(node -v | cut -d'v' -f2)
    if [ $(echo "$NODE_VERSION 20.0.0" | awk '{print ($1 < $2)}') -eq 1 ]; then
        echo "❌ Node.js version must be 20 or higher. Current version: $NODE_VERSION"
        echo "Please upgrade Node.js using fnm or your preferred method."
        exit 1
    fi

    # Check for build essentials based on OS
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if ! dpkg -l | grep -q build-essential; then
            echo "❌ Build essential tools not found."
            echo "Please install build tools:"
            echo "sudo apt install -y make python g++ build-essential"
            exit 1
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        if ! xcode-select -p &> /dev/null; then
            echo "❌ Xcode Command Line Tools not found."
            echo "Please install Xcode Command Line Tools:"
            echo "xcode-select --install"
            exit 1
        fi
    fi

    echo "✅ All requirements met!"
}

# Main script
echo "🚀 Starting electerm-web installation..."

# Check requirements first
check_requirements

echo "📥 Cloning repository..."
git clone --depth 1 https://github.com/electerm/electerm-web.git || { echo "❌ Failed to clone repository"; exit 1; }

cd electerm-web || { echo "❌ Failed to enter project directory"; exit 1; }

echo "📦 Installing dependencies..."
npm install || { echo "❌ Failed to install dependencies"; exit 1; }

echo "🏗️ Building project..."
npm run build || { echo "❌ Failed to build project"; exit 1; }

echo "⚙️ Setting up configuration..."
cp .sample.env .env || { echo "❌ Failed to create .env file"; exit 1; }

# Generate a random alphanumeric string of length 30
SERVER_SECRET=$(openssl rand -base64 30 | tr -dc 'a-zA-Z0-9')

# Get current username
current_user_name=$(whoami)

# Get OS type and set DB_PATH
if [[ "$OSTYPE" == "darwin"* ]]; then
    DB_PATH="/Users/${current_user_name}/Library/Application Support/electerm"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    DB_PATH="/home/${current_user_name}/.config/electerm"
fi

# Update .env file
sed -i.bak "s/SERVER_SECRET=.*/SERVER_SECRET=${SERVER_SECRET}/" .env
echo "DB_PATH=\"${DB_PATH}\"" >> .env

echo "🚀 Starting application..."
NODE_ENV=production node ./src/app/app.js