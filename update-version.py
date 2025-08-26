#!/usr/bin/env python3

import os
import re
import json
import sys
from datetime import datetime

def main():
    # Get the directory of this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Read configuration
    config_path = os.path.join(script_dir, 'version-config.json')
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
    except FileNotFoundError:
        config = {"strategy": "patch"}
    
    # Read the game.js file
    game_file_path = os.path.join(script_dir, 'game.js')
    
    try:
        with open(game_file_path, 'r', encoding='utf-8') as f:
            game_content = f.read()
    except FileNotFoundError:
        print("❌ Error: game.js not found")
        sys.exit(1)
    
    # Get current date in YYYY-MM-DD format
    current_date = datetime.now().strftime('%Y-%m-%d')
    
    # Extract current version
    version_match = re.search(r'this\.version = ["\']([^"\']+)["\']', game_content)
    if not version_match:
        print("❌ Error: Could not find version in game.js")
        sys.exit(1)
    
    current_version = version_match.group(1)
    version_parts = current_version.split('.')
    
    try:
        major = int(version_parts[0]) if len(version_parts) > 0 else 1
        minor = int(version_parts[1]) if len(version_parts) > 1 else 0
        patch = int(version_parts[2]) if len(version_parts) > 2 else 0
    except ValueError:
        print("❌ Error: Invalid version format")
        sys.exit(1)
    
    # Determine version increment strategy
    strategy = config.get('strategy', 'patch')
    
    # Check commit message for version hints (if provided as argument)
    if len(sys.argv) > 1:
        commit_msg = sys.argv[1]
        if '[major]' in commit_msg:
            strategy = 'major'
        elif '[minor]' in commit_msg:
            strategy = 'minor'
        elif '[patch]' in commit_msg:
            strategy = 'patch'
    
    # Increment version based on strategy
    if strategy == 'major':
        major += 1
        minor = 0
        patch = 0
    elif strategy == 'minor':
        minor += 1
        patch = 0
    else:  # patch or default
        patch += 1
    
    new_version = f"{major}.{minor}.{patch}"
    
    # Update version and build date in the file
    game_content = re.sub(
        r'this\.version = ["\'][^"\']+["\']',
        f'this.version = "{new_version}"',
        game_content
    )
    
    game_content = re.sub(
        r'this\.buildDate = ["\'][^"\']+["\']',
        f'this.buildDate = "{current_date}"',
        game_content
    )
    
    # Write the updated content back to the file
    try:
        with open(game_file_path, 'w', encoding='utf-8') as f:
            f.write(game_content)
    except IOError:
        print("❌ Error: Could not write to game.js")
        sys.exit(1)
    
    print("🎮 Monster Hunter Game")
    print(f"📦 Version updated: {current_version} -> {new_version} ({strategy})")
    print(f"📅 Build date updated: {current_date}")
    print("✨ Ready to commit!")

if __name__ == "__main__":
    main()
