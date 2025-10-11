#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Read configuration
const configPath = path.join(__dirname, 'version-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Read the game.js file
const gameFilePath = path.join(__dirname, 'game.js');
let gameContent = fs.readFileSync(gameFilePath, 'utf8');

// Get current date in YYYY-MM-DD format
const currentDate = new Date().toISOString().split('T')[0];

// Extract current version
const versionMatch = gameContent.match(/this\.version = ["']([^"']+)["']/);
if (!versionMatch) {
    console.error('Could not find version in game.js');
    process.exit(1);
}

const currentVersion = versionMatch[1];
const versionParts = currentVersion.split('.');

let major = parseInt(versionParts[0]) || 1;
let minor = parseInt(versionParts[1]) || 0;
let patch = parseInt(versionParts[2]) || 0;

// Determine version increment strategy
let strategy = config.strategy || 'patch';

// Check commit message for version hints (if available)
try {
    const commitMsg = process.argv[2] || '';
    if (commitMsg.includes('[major]')) {
        strategy = 'major';
    } else if (commitMsg.includes('[minor]')) {
        strategy = 'minor';
    } else if (commitMsg.includes('[patch]')) {
        strategy = 'patch';
    }
} catch (e) {
    // Ignore if commit message not available
}

// Increment version based on strategy
switch (strategy) {
    case 'major':
        major += 1;
        minor = 0;
        patch = 0;
        break;
    case 'minor':
        minor += 1;
        patch = 0;
        break;
    case 'patch':
    default:
        patch += 1;
        break;
}

const newVersion = `${major}.${minor}.${patch}`;

// Update version and build date in the file
gameContent = gameContent.replace(
    /this\.version = ["'][^"']+["']/,
    `this.version = "${newVersion}"`
);

gameContent = gameContent.replace(
    /this\.buildDate = ["'][^"']+["']/,
    `this.buildDate = "${currentDate}"`
);

// Write the updated content back to the file
fs.writeFileSync(gameFilePath, gameContent, 'utf8');

// Update package.json version to stay in sync
const packagePath = path.join(__dirname, 'package.json');
let packageUpdated = false;

try {
    const packageContent = fs.readFileSync(packagePath, 'utf8');
    const packageJson = JSON.parse(packageContent);

    if (packageJson && typeof packageJson === 'object') {
        packageJson.version = newVersion;
        fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
        packageUpdated = true;
    }
} catch (err) {
    if (err.code === 'ENOENT') {
        console.warn('⚠️  Warning: package.json not found; skipped version sync.');
    } else if (err.name === 'SyntaxError') {
        console.warn('⚠️  Warning: Could not parse package.json; skipped version sync.');
    } else {
        console.warn('⚠️  Warning: Could not write to package.json; skipped version sync.');
    }
}

console.log(`🎮 Monster Hunter Game`);
console.log(`📦 Version updated: ${currentVersion} -> ${newVersion} (${strategy})`);
console.log(`📅 Build date updated: ${currentDate}`);
if (packageUpdated) {
    console.log('🧾 package.json version synchronized');
}
console.log(`✨ Ready to commit!`);
