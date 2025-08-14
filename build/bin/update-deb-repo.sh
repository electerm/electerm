#!/bin/bash

# Manual Debian Repository Update Script
# Use this to manually update the repository when needed

set -e

cd `dirname $0`
cd ../../

REPO_DIR="deb"
POOL_DIR="$REPO_DIR/pool/main"
DISTS_DIR="$REPO_DIR/dists/stable"

echo "Updating Electerm Debian Repository..."

# Create directory structure
mkdir -p "$POOL_DIR"
mkdir -p "$DISTS_DIR/main/binary-amd64" 
mkdir -p "$DISTS_DIR/main/source"

# Function to download latest DEB files
download_latest_debs() {
    echo "Downloading latest DEB files from GitHub releases..."
    
    # Get latest release tag
    LATEST_TAG=$(gh api repos/electerm/electerm/releases/latest --jq '.tag_name')
    echo "Latest release: $LATEST_TAG"
    
    # Clean old files
    rm -f "$POOL_DIR"/*.deb

    # Download DEB files
    gh release download "$LATEST_TAG" --pattern "*.deb" --dir "$POOL_DIR/" || {
        echo "Error downloading DEB files. Make sure GitHub CLI is authenticated."
        exit 1
    }
    
    echo "Downloaded DEB files:"
    ls -la "$POOL_DIR"/*.deb
}

# Function to generate package files
generate_packages() {
    echo "Generating Packages files..."
    
    cd "$REPO_DIR"
    
    # Generate for amd64 architecture
    echo "Generating Packages for amd64..."
    dpkg-scanpackages --arch amd64 pool/main/ > "dists/stable/main/binary-amd64/Packages"
    gzip -c "dists/stable/main/binary-amd64/Packages" > "dists/stable/main/binary-amd64/Packages.gz"
    
    cd ..
}

# Function to generate Release file
generate_release() {
    echo "Generating Release file..."
    
    cd "$DISTS_DIR"
    
    cat > Release << EOF
Architectures: amd64
Codename: stable
Components: main
Date: $(date -Ru)
Description: Electerm Debian Repository
Label: Electerm
Origin: Electerm
Suite: stable
Version: 1.0
EOF

    # Add file hashes
    echo "MD5Sum:" >> Release
    find . -name "Packages*" -type f | while read file; do
        echo " $(md5sum "$file" | cut -d' ' -f1) $(stat -c%s "$file") $file" >> Release
    done
    
    echo "SHA1:" >> Release  
    find . -name "Packages*" -type f | while read file; do
        echo " $(sha1sum "$file" | cut -d' ' -f1) $(stat -c%s "$file") $file" >> Release
    done
    
    echo "SHA256:" >> Release
    find . -name "Packages*" -type f | while read file; do
        echo " $(sha256sum "$file" | cut -d' ' -f1) $(stat -c%s "$file") $file" >> Release
    done
    
    cd - > /dev/null
}

# Function to sign release
sign_release() {
    echo "Signing Release file..."
    
    cd "$DISTS_DIR"
    
    # Check if GPG key exists
    if ! gpg --list-secret-keys | grep -q "electerm"; then
        echo "Error: GPG key not found. Run setup-deb-repo.sh first."
        exit 1
    fi
    
    # Sign the release
    gpg --armor --detach-sig --sign Release
    mv Release.asc Release.gpg
    
    cd - > /dev/null
}

# Function to export public key
export_public_key() {
    echo "Exporting GPG public key..."
    
    GPG_KEY_ID=$(gpg --list-secret-keys --with-colons | grep "electerm" -A1 | grep "^sec" | cut -d: -f5)
    gpg --armor --export "$GPG_KEY_ID" > "$REPO_DIR/public.key"
}

# Function to create index page
create_index() {
    echo "Creating repository index page..."
    
    # Try to copy the comprehensive HTML file from the repository
    if [ -f "../deb/index.html" ]; then
        echo "Copying comprehensive repository homepage from ../deb/index.html"
        cp "../deb/index.html" "$REPO_DIR/index.html"
    else
        echo "Warning: Comprehensive index.html not found at ../deb/index.html, creating basic version"
        cat > "$REPO_DIR/index.html" << 'EOF'
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
        
        <h2>Repository Information</h2>
        <p>Last updated: $(date)</p>
        <p>Available packages:</p>
        <ul>
EOF

        # Add package list
        for deb in "$POOL_DIR"/*.deb; do
            if [ -f "$deb" ]; then
                basename=$(basename "$deb")
                echo "            <li>$basename</li>" >> "$REPO_DIR/index.html"
            fi
        done
        
        cat >> "$REPO_DIR/index.html" << 'EOF'
        </ul>
    </div>
</body>
</html>
EOF
    fi
}

# Main execution
main() {
    # Check dependencies
    if ! command -v gh &> /dev/null; then
        echo "Error: GitHub CLI is required. Install it from https://cli.github.com/"
        exit 1
    fi
    
    if ! command -v dpkg-scanpackages &> /dev/null; then
        echo "Error: dpkg-dev is required. Install it with: sudo apt install dpkg-dev"
        exit 1
    fi
    
    # Store current branch and switch to gh-pages
    CURRENT_BRANCH=$(git branch --show-current)
    echo "Switching to gh-pages branch..."
    git checkout gh-pages
    git pull origin gh-pages || true
    
    # Execute steps
    download_latest_debs
    generate_packages  
    generate_release
    sign_release
    export_public_key
    create_index
    
    echo
    echo "Repository update complete!"
    echo "Repository structure:"
    find "$REPO_DIR" -type f | sort
    echo
    echo "To publish:"
    echo "git add deb/ && git commit -m 'Update Debian repository' && git push origin gh-pages"
    echo
    echo "Repository will be available at: https://electerm.github.io/electerm/deb"
    
    # Return to original branch
    git checkout "$CURRENT_BRANCH"
}

# Run main function
main "$@"
