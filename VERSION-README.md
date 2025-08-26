# 🚀 Automatic Version System

This project includes an automatic versioning system that updates the game version and build date on every commit.

## 📋 How It Works

- **Pre-commit Hook**: Automatically runs before each commit
- **Version Update**: Increments version number based on strategy
- **Build Date**: Updates to current date
- **Auto-add**: Automatically stages the updated `game.js` file

## 🎯 Version Strategies

### Default Strategy (Patch)
```bash
git commit -m "Fix bug in monster spawning"
# 1.2.3 -> 1.2.4
```

### Minor Version Update
```bash
git commit -m "Add new weapon [minor]"
# 1.2.4 -> 1.3.0
```

### Major Version Update
```bash
git commit -m "Complete game overhaul [major]"
# 1.3.0 -> 2.0.0
```

### Force Patch Update
```bash
git commit -m "Small tweak [patch]"
# 2.0.0 -> 2.0.1
```

## ⚙️ Configuration

Edit `version-config.json` to change the default strategy:

```json
{
  "strategy": "patch",
  "comment": "Options: 'patch', 'minor', 'major', 'auto'"
}
```

## 🛠️ Files

- **`.git/hooks/pre-commit`**: Git hook that runs on commit
- **`update-version.py`**: Python script that updates version/date
- **`update-version.js`**: Node.js alternative (fallback)
- **`version-config.json`**: Configuration file
- **`game.js`**: Contains version info (lines 12-13)

## 🎮 In-Game Display

The version appears in the bottom-right corner of the game:
```
v1.2.4
Build: 2025-08-27
```

## 🔧 Manual Version Update

To manually update version without committing:
```bash
python3 update-version.py
# or
node update-version.js
```

## 🚫 Disable Auto-Versioning

To temporarily disable:
```bash
chmod -x .git/hooks/pre-commit
```

To re-enable:
```bash
chmod +x .git/hooks/pre-commit
```

## 🐛 Troubleshooting

- **"Neither Python3 nor Node.js found"**: Install Python 3 or Node.js
- **"Could not find version in game.js"**: Check version format in constructor
- **Hook not running**: Ensure `.git/hooks/pre-commit` is executable

## 📝 Example Workflow

```bash
# Make changes to your game
vim game.js

# Commit (version auto-updates)
git commit -m "Add new monster type [minor]"

# Push to GitHub
git push origin main
```

The version will automatically increment and the build date will update! 🎉
