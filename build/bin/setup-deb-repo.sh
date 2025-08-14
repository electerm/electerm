#!/bin/bash

# Electerm Debian Repository Setup Script
# This script helps set up the Debian repository and generate GPG keys

set -e

echo "Setting up Electerm Debian Repository..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if GPG is installed
if ! command -v gpg &> /dev/null; then
    print_error "GPG is not installed. Please install it first:"
    echo "  Ubuntu/Debian: sudo apt install gnupg"
    echo "  macOS: brew install gnupg"
    exit 1
fi

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    print_warning "GitHub CLI is not installed. Install it for easier secret management:"
    echo "  https://cli.github.com/"
fi

print_status "Generating GPG key for package signing..."

# Generate GPG key if it doesn't exist
GPG_KEY_EMAIL="${GPG_EMAIL:-electerm@github.com}"
GPG_KEY_NAME="${GPG_NAME:-Electerm Repository}"

# Check if key already exists
if gpg --list-secret-keys | grep -q "$GPG_KEY_EMAIL"; then
    print_status "GPG key already exists for $GPG_KEY_EMAIL"
    GPG_KEY_ID=$(gpg --list-secret-keys --with-colons | grep "$GPG_KEY_EMAIL" -B1 | grep "^sec" | cut -d: -f5)
else
    print_status "Creating new GPG key..."
    
    # Create GPG key configuration
    cat > gpg-key-config << EOF
%echo Generating GPG key for Debian repository
Key-Type: RSA
Key-Length: 4096
Subkey-Type: RSA
Subkey-Length: 4096
Name-Real: $GPG_KEY_NAME
Name-Email: $GPG_KEY_EMAIL
Expire-Date: 2y
Passphrase: ${GPG_PASSPHRASE:-electerm-repo-key}
%commit
%echo done
EOF

    gpg --batch --generate-key gpg-key-config
    rm gpg-key-config
    
    GPG_KEY_ID=$(gpg --list-secret-keys --with-colons | grep "$GPG_KEY_EMAIL" -B1 | grep "^sec" | cut -d: -f5)
fi

print_status "GPG Key ID: $GPG_KEY_ID"

# Export keys
print_status "Exporting GPG keys..."
gpg --armor --export-secret-keys "$GPG_KEY_ID" > gpg-private-key.asc
gpg --armor --export "$GPG_KEY_ID" > gpg-public-key.asc

# Base64 encode private key for GitHub secrets
GPG_PRIVATE_KEY_B64=$(base64 -i gpg-private-key.asc)

print_status "Setting up deb folder in gh-pages branch..."
# Store current branch
CURRENT_BRANCH=$(git branch --show-current)

# Check if gh-pages branch exists
if ! git show-ref --verify --quiet refs/heads/gh-pages; then
    print_status "Creating gh-pages branch..."
    git checkout --orphan gh-pages
    git rm -rf .
    echo "# GitHub Pages" > README.md
    git add README.md
    git commit -m "Initial commit for GitHub Pages"
    git push origin gh-pages
else
    print_status "Switching to existing gh-pages branch..."
    git checkout gh-pages
    git pull origin gh-pages || true
fi

# Create deb directory structure (without affecting other files)
print_status "Creating deb repository structure..."
mkdir -p deb/pool/main
mkdir -p deb/dists/stable/main/binary-amd64
mkdir -p deb/dists/stable/main/source

# Create initial deb repository files if they don't exist
if [ ! -f "deb/index.html" ]; then
    cat > deb/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Electerm Debian Repository</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .container { max-width: 800px; margin: 0 auto; }
        .code { background: #f4f4f4; padding: 10px; border-radius: 5px; margin: 10px 0; }
        pre { white-space: pre-wrap; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Electerm Debian Repository</h1>
        <p>Official Debian repository for Electerm terminal application.</p>
        
        <h2>Installation</h2>
        <p>Add the repository to your system:</p>
        
        <div class="code">
            <pre># Add the GPG key
curl -fsSL https://electerm.github.io/electerm/deb/public.key | sudo gpg --dearmor -o /usr/share/keyrings/electerm.gpg

# Add the repository
echo "deb [signed-by=/usr/share/keyrings/electerm.gpg] https://electerm.github.io/electerm/deb stable main" | sudo tee /etc/apt/sources.list.d/electerm.list

# Update package list
sudo apt update

# Install Electerm
sudo apt install electerm</pre>
        </div>
        
        <h2>Manual Download</h2>
        <p>You can also download DEB packages directly from our <a href="https://github.com/electerm/electerm/releases">GitHub releases</a>.</p>
        
        <h2>Supported Architectures</h2>
        <ul>
            <li>amd64 (x86_64)</li>
        </ul>
    </div>
</body>
</html>
EOF
fi

# Add GPG public key to deb folder
if [ -f "../gpg-public-key.asc" ]; then
    cp ../gpg-public-key.asc deb/public.key
elif [ -f "gpg-public-key.asc" ]; then
    cp gpg-public-key.asc deb/public.key
else
    # Export public key directly to deb folder
    gpg --armor --export "$GPG_KEY_ID" > deb/public.key
fi

# Commit deb folder changes
git add deb/
if git diff --staged --quiet; then
    print_status "No changes to commit in deb folder"
else
    git commit -m "Initialize Debian repository structure"
    git push origin gh-pages
fi

# Return to original branch
git checkout "$CURRENT_BRANCH"

# Create secrets configuration file
cat > github-secrets.txt << EOF
GitHub Secrets Configuration
============================

You need to add the following secrets to your GitHub repository:
Go to: https://github.com/electerm/electerm/settings/secrets/actions

1. GPG_PRIVATE_KEY
   Value: $GPG_PRIVATE_KEY_B64

2. GPG_PASSPHRASE  
   Value: ${GPG_PASSPHRASE:-electerm-repo-key}

3. GPG_KEY_ID
   Value: $GPG_KEY_ID

To add secrets using GitHub CLI (if installed):
gh secret set GPG_PRIVATE_KEY --body "$GPG_PRIVATE_KEY_B64"
gh secret set GPG_PASSPHRASE --body "${GPG_PASSPHRASE:-electerm-repo-key}"
gh secret set GPG_KEY_ID --body "$GPG_KEY_ID"
EOF

print_status "Setup complete!"
echo
echo "Next steps:"
echo "1. Add the GitHub secrets (see github-secrets.txt)"
echo "2. Enable GitHub Pages in your repository settings"
echo "3. Set GitHub Pages source to 'gh-pages' branch"
echo "4. The repository will be available at: https://electerm.github.io/electerm/deb"
echo
print_warning "Keep the GPG private key secure and backed up!"
print_warning "The github-secrets.txt file contains sensitive information - delete it after use"

# Clean up
rm gpg-private-key.asc
echo
print_status "GPG public key saved as: gpg-public-key.asc"
print_status "GitHub secrets configuration saved as: github-secrets.txt"
