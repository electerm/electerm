# Electerm Debian Repository

This document explains how to set up and maintain the Debian repository for Electerm using GitHub releases and GitHub Pages.

## Overview

The Debian repository is automatically maintained using GitHub Actions and serves packages through GitHub Pages. When a new release is published with DEB files, the repository is automatically updated.

## Repository Structure

```
deb/
├── index.html              # Repository homepage
├── public.key             # GPG public key for verification
├── pool/main/             # DEB package files
│   ├── electerm-*.deb
└── dists/stable/          # Repository metadata
    ├── Release            # Signed release file
    ├── Release.gpg        # GPG signature
    └── main/
        └── binary-amd64/
            ├── Packages
            └── Packages.gz
```
        ├── binary-amd64/
        │   ├── Packages
        │   └── Packages.gz
        ├── binary-arm64/
        │   ├── Packages  
        │   └── Packages.gz
        └── binary-armhf/
            ├── Packages
            └── Packages.gz
```

## Setup

### 1. Initial Setup

Run the setup script to create GPG keys and configure the repository:

```bash
npm run setup-deb-repo
```

This will:

- Generate a GPG key pair for package signing
- Switch to existing `gh-pages` branch (or create if needed)
- Create the `deb/` folder structure for the repository
- Output GitHub secrets that need to be configured

### 2. Configure GitHub Secrets

Add these secrets to your GitHub repository at `https://github.com/electerm/electerm/settings/secrets/actions`:

- `GPG_PRIVATE_KEY`: Base64-encoded private GPG key
- `GPG_PASSPHRASE`: Passphrase for the GPG key
- `GPG_KEY_ID`: GPG key ID for signing

### 3. Enable GitHub Pages

1. Go to repository Settings → Pages
2. Set source to "Deploy from a branch"
3. Select `gh-pages` branch
4. The repository will be available at `https://electerm.github.io/electerm/deb`

**Note**: If you already have GitHub Pages set up for other content, the Debian repository will be created in the `deb/` folder without affecting your existing files.

## Automatic Updates

The repository is automatically updated when:

1. A new release is published on GitHub
2. The release contains DEB files (`.deb` extension)
3. The GitHub Action downloads the DEB files and updates the repository metadata
4. Changes are committed to the `gh-pages` branch

## Manual Updates

To manually update the repository:

```bash
npm run update-deb-repo
```

This script will:

- Download latest DEB files from GitHub releases
- Generate Packages files for all architectures
- Create and sign the Release file
- Update the repository index page

## Using the Repository

Users can add the repository to their systems:

```bash
# Add the GPG key
curl -fsSL https://electerm.github.io/electerm/deb/public.key | sudo gpg --dearmor -o /usr/share/keyrings/electerm.gpg

# Add the repository
echo "deb [signed-by=/usr/share/keyrings/electerm.gpg] https://electerm.github.io/electerm/deb stable main" | sudo tee /etc/apt/sources.list.d/electerm.list

# Update package list
sudo apt update

# Install Electerm
sudo apt install electerm
```

## Supported Architectures

- `amd64` (x86_64)

## Troubleshooting

### GitHub Action Fails

1. Check that all required secrets are configured
2. Verify the GPG key is valid and not expired
3. Ensure the release contains DEB files

### Manual Update Issues

1. Make sure GitHub CLI is installed and authenticated: `gh auth login`
2. Install required dependencies: `sudo apt install dpkg-dev`
3. Verify GPG key exists: `gpg --list-secret-keys`

### Repository Not Accessible

1. Check GitHub Pages is enabled and configured correctly
2. Verify the `gh-pages` branch exists and has content
3. Allow time for GitHub Pages to deploy (up to 10 minutes)

## Maintenance

### GPG Key Renewal

GPG keys expire after 2 years. To renew:

1. Extend key expiration: `gpg --edit-key <key-id>` then `expire`
2. Re-export the key: `gpg --armor --export-secret-keys <key-id>`
3. Update GitHub secrets with the new key
4. Re-run the setup script if needed

### Repository Cleanup

To remove old package versions:

1. Manually edit the pool directory to remove old DEB files
2. Run the update script to regenerate metadata
3. Commit changes to the `gh-pages` branch

## Security

- GPG keys are used to sign repository metadata
- Private keys are stored as GitHub secrets (encrypted)
- Users verify packages using the public key
- All communications use HTTPS

## Files

- `.github/workflows/update-deb-repo.yml` - GitHub Action for automatic updates
- `build/bin/setup-deb-repo.sh` - Initial repository setup script  
- `build/bin/update-deb-repo.sh` - Manual repository update script
- `docs/DEBIAN_REPOSITORY.md` - This documentation file
