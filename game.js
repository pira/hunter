class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.score = 0;
        this.monstersKilled = 0;
        this.gameOver = false;
        this.level = 1;
        this.killedByMonster = null; // Track which monster killed the player
        
        // Version system
        this.version = "1.2.16";
        this.buildDate = "2025-08-28";
        
        // Mobile support
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.touchControls = {
            joystick: {
                active: false,
                startX: 0,
                startY: 0,
                currentX: 0,
                currentY: 0,
                centerX: 0,
                centerY: 0,
                maxDistance: 50
            },
            movement: { x: 0, y: 0 }
        };
        
        // Player
        this.player = {
            x: this.canvas.width / 2,
            y: this.canvas.height / 2,
            size: 15, // Reduced from 20
            speed: 5,
            color: '#4CAF50',
            emoji: '🧙‍♂️', // Wizard emoji
            health: 3,
            maxHealth: 3
        };
        
        // Game objects
        this.bullets = [];
        this.monsters = [];
        this.powerups = [];
        this.keys = {};
        this.missiles = [];
        this.grenades = [];
        this.swordSwings = [];
        this.explosions = [];
        
        // Game settings
        this.monsterSpawnRate = 110; // frames
        this.monsterSpawnCounter = 0;
        this.bulletSpeed = 8;
        this.autoShootRate = 60; // 1 shot per second (60 FPS)
        this.autoShootCounter = 0;
        this.manualShootCooldown = 0; // Cooldown for manual shooting
        this.monsterTurnBackChance = 0.75; // Chance for monster to turn back when leaving screen
        this.monsterChaseChance = 0.3; // Chance for monster to chase player
        this.bombDamage = 8;

        // Powerup states
        this.multiShot = false;
        this.rapidFire = false;
        this.invincible = false;
        this.freeze = false;
        this.powerupTimers = {
            multiShot: 0,
            rapidFire: 0,
            invincible: 0,
            freeze: 0
        };
        
        // Weapon system
        this.weapons = ['bullets', 'sword', 'missiles', 'grenades'];
        this.currentWeapon = 0; // Index into weapons array
        this.weaponCooldowns = {
            bullets: 0,
            sword: 0,
            missiles: 0,
            grenades: 0
        };
        this.weaponTimers = {
            sword: 0,
            missiles: 0,
            grenades: 0
        };
        this.swordRotation = 0; // Rotation angle for sword visual
        this.swordBlades = {
            active: false,
            rotation: 0,
            baseRadius: 45,
            bladeLength: 45,
            baseBladeCount: 1,
            spinSpeed: 0.07, // Base spin speed
            lastSwooshRotation: 0 // Track rotation for sound timing
        };
        
        // Flash effect for bomb
        this.flashEffect = {
            active: false,
            timer: 0,
            duration: 45
        };
        
        // Sound effects
        this.sounds = {};
        this.loadSounds();
        
        this.setupEventListeners();
        this.setupCanvas();
        this.gameLoop();
    }
    
    loadSounds() {
        // Check if CreateJS SoundJS is available
        if (typeof createjs !== 'undefined' && createjs.Sound) {
            // Register sounds once during initialization
            createjs.Sound.registerSound({
                src: "sfx/gunshot.mp3", 
                id: "shootSound"
            });            
            createjs.Sound.registerSound({
                src: "sfx/sword-slice.mp3", 
                id: "swooshSound"
            });
            
            createjs.Sound.registerSound({
                src: "sfx/monster-death.mp3", 
                id: "monsterDeathSound"
            });

            createjs.Sound.registerSound({
                src: "sfx/monster-cry.mp3", 
                id: "monsterBossDeathSound"
            });
            
            createjs.Sound.registerSound({
                src: "sfx/man-scream-ahh.mp3", 
                id: "playerHitSound"
            });

            createjs.Sound.registerSound({
                src: "sfx/powerup.mp3", 
                id: "powerupSound"
            });
            
            createjs.Sound.registerSound({
                src: "sfx/boom.mp3", 
                id: "boomSound"
            });
            
            createjs.Sound.registerSound({
                src: "sfx/grenade.mp3", 
                id: "grenadeSound"
            });

            createjs.Sound.registerSound({
                src: "sfx/missile.mp3", 
                id: "missileSound"
            });

            createjs.Sound.registerSound({
                src: "sfx/game-over.mp3", 
                id: "gameOverSound"
            });
            
            createjs.Sound.registerSound({
                src: "sfx/level-up.mp3", 
                id: "levelUpSound"
            });

            // Define sound functions that play registered sounds
            this.sounds.shoot = () => {
                const instance = createjs.Sound.play("shootSound", {duration: 500});
                if (instance) {
                    instance.volume = 0.7;
                }
            };
            
            this.sounds.swoosh = () => {
                const instance = createjs.Sound.play("swooshSound", {duration: 400});
                instance.volume = 0.5;
                instance.playbackRate = 3;
            };
            
            this.sounds.monsterDeath = () => {
                const instance = createjs.Sound.play("monsterDeathSound");
                instance.volume = 0.8;
                instance.playbackRate = 1.5;
            };
            
            this.sounds.powerup = () => {
                const instance = createjs.Sound.play("powerupSound");
                if (instance) {
                    instance.volume = 0.6;
                }
            };
            
            this.sounds.boom = () => {
                const instance = createjs.Sound.play("boomSound");
                if (instance) {
                    instance.volume = 0.9;
                }
            };
            
            this.sounds.grenade = () => {
                const instance = createjs.Sound.play("grenadeSound");
                if (instance) {
                    instance.volume = 0.8;
                }
            };

            this.sounds.missile = () => {
                const instance = createjs.Sound.play("missileSound");
                instance.volume = 0.8;
            };

            this.sounds.gameOver = () => {
                const instance = createjs.Sound.play("gameOverSound");
                instance.volume = 0.95;
            };

            this.sounds.playerHit = () => {
                const instance = createjs.Sound.play("playerHitSound");
                instance.volume = 0.8;
            };

            this.sounds.monsterBossDeath = () => {
                const instance = createjs.Sound.play("monsterBossDeathSound");
                instance.volume = 0.8;
            };

            this.sounds.levelUp = () => {
                const instance = createjs.Sound.play("levelUpSound");
                instance.volume = 0.8;
            };


        } else {
            // Fallback to empty functions if SoundJS is not available
            this.sounds.grenade = () => {};
            this.sounds.shoot = () => {};
            this.sounds.monsterDeath = () => {};
            this.sounds.powerup = () => {};
            this.sounds.boom = () => {};
            this.sounds.swoosh = () => {};
            this.sounds.gameOver = () => {};
            this.sounds.playerHit = () => {};
            this.sounds.missile = () => {};
            this.sounds.monsterBossDeath = () => {};
            this.sounds.levelUp = () => {};
        }
    }
    
    setupCanvas() {
        // Make canvas responsive for mobile
        if (this.isMobile) {
            const resizeCanvas = () => {
                const container = this.canvas.parentElement;
                const rect = container.getBoundingClientRect();
                
                // Set canvas size to fit mobile screen
                this.canvas.width = Math.min(window.innerWidth, 800);
                this.canvas.height = Math.min(window.innerHeight * 0.6, 600);
                
                // Update player position if needed (keep centered)
                if (this.player.x > this.canvas.width - this.player.size) {
                    this.player.x = this.canvas.width / 2;
                }
                if (this.player.y > this.canvas.height - this.player.size) {
                    this.player.y = this.canvas.height / 2;
                }
            };
            
            resizeCanvas();
            window.addEventListener('resize', resizeCanvas);
            window.addEventListener('orientationchange', () => {
                setTimeout(resizeCanvas, 100); // Delay for orientation change
            });
        }
    }
    
    setupEventListeners() {
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            // Prevent default behavior for arrow keys and spacebar to stop window scrolling
            if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' '].includes(e.key.toLowerCase())) {
                e.preventDefault();
            }
            
            // Handle weapon switching with Space key
            if (e.key === ' ') {
                this.switchWeapon();
                return;
            }
            
            this.keys[e.key.toLowerCase()] = true;
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
        
        // Mouse controls for shooting (manual override) and restart button
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Check for restart button click when game is over
            if (this.gameOver && this.restartButton) {
                if (mouseX >= this.restartButton.x && 
                    mouseX <= this.restartButton.x + this.restartButton.width &&
                    mouseY >= this.restartButton.y && 
                    mouseY <= this.restartButton.y + this.restartButton.height) {
                    // Restart the game
                    window.location.reload();
                    return;
                }
            }
            
            // Normal shooting when game is active
            if (!this.gameOver) {
            this.shootAtTarget(mouseX, mouseY);
            }
        });
        
        // Mobile touch controls
        if (this.isMobile) {
            this.setupMobileControls();
        }
    }
    
    setupMobileControls() {
        // Virtual joystick setup
        const joystick = document.getElementById('virtualJoystick');
        const joystickKnob = document.getElementById('joystickKnob');
        const weaponBtn = document.getElementById('weaponSwitchBtn');
        
        if (!joystick || !joystickKnob || !weaponBtn) return;
        
        // Get joystick center position
        const joystickRect = joystick.getBoundingClientRect();
        this.touchControls.joystick.centerX = joystickRect.left + joystickRect.width / 2;
        this.touchControls.joystick.centerY = joystickRect.top + joystickRect.height / 2;
        
        // Virtual joystick touch events
        joystick.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.touchControls.joystick.active = true;
            this.touchControls.joystick.startX = touch.clientX;
            this.touchControls.joystick.startY = touch.clientY;
        });
        
        document.addEventListener('touchmove', (e) => {
            if (!this.touchControls.joystick.active) return;
            e.preventDefault();
            
            const touch = e.touches[0];
            const deltaX = touch.clientX - this.touchControls.joystick.centerX;
            const deltaY = touch.clientY - this.touchControls.joystick.centerY;
            
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            const maxDistance = this.touchControls.joystick.maxDistance;
            
            if (distance <= maxDistance) {
                this.touchControls.joystick.currentX = deltaX;
                this.touchControls.joystick.currentY = deltaY;
            } else {
                const angle = Math.atan2(deltaY, deltaX);
                this.touchControls.joystick.currentX = Math.cos(angle) * maxDistance;
                this.touchControls.joystick.currentY = Math.sin(angle) * maxDistance;
            }
            
            // Update knob position
            joystickKnob.style.transform = `translate(-50%, -50%) translate(${this.touchControls.joystick.currentX}px, ${this.touchControls.joystick.currentY}px)`;
            
            // Calculate movement values (-1 to 1)
            this.touchControls.movement.x = this.touchControls.joystick.currentX / maxDistance;
            this.touchControls.movement.y = this.touchControls.joystick.currentY / maxDistance;
        });
        
        document.addEventListener('touchend', (e) => {
            if (this.touchControls.joystick.active) {
                this.touchControls.joystick.active = false;
                this.touchControls.joystick.currentX = 0;
                this.touchControls.joystick.currentY = 0;
                this.touchControls.movement.x = 0;
                this.touchControls.movement.y = 0;
                
                // Reset knob position
                joystickKnob.style.transform = 'translate(-50%, -50%)';
            }
        });
        
        // Weapon switch button
        weaponBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.switchWeapon();
            this.updateWeaponButtonIcon();
        });
        
        // Initialize weapon button icon
        this.updateWeaponButtonIcon();
        
        // Handle restart button touch on mobile
        this.canvas.addEventListener('touchstart', (e) => {
            if (this.gameOver && this.restartButton) {
                const touch = e.touches[0];
                const rect = this.canvas.getBoundingClientRect();
                const touchX = touch.clientX - rect.left;
                const touchY = touch.clientY - rect.top;
                
                if (touchX >= this.restartButton.x && 
                    touchX <= this.restartButton.x + this.restartButton.width &&
                    touchY >= this.restartButton.y && 
                    touchY <= this.restartButton.y + this.restartButton.height) {
                    e.preventDefault();
                    window.location.reload();
                    return;
                }
            }
        });
        
        // Prevent default touch behaviors
        document.addEventListener('touchstart', (e) => {
            if (e.target.closest('.mobile-controls')) {
                e.preventDefault();
            }
        }, { passive: false });
        
        document.addEventListener('touchmove', (e) => {
            if (e.target.closest('.mobile-controls') || e.target === this.canvas) {
                e.preventDefault();
            }
        }, { passive: false });
    }
    
    updateWeaponButtonIcon() {
        const weaponBtn = document.getElementById('weaponSwitchBtn');
        if (!weaponBtn) return;
        
        const availableWeapons = this.getAvailableWeapons();
        const currentIndex = availableWeapons.indexOf(this.weapons[this.currentWeapon]);
        const nextIndex = (currentIndex + 1) % availableWeapons.length;
        const nextWeapon = availableWeapons[nextIndex];
        
        // Map weapon names to emojis
        const weaponIcons = {
            'bullets': '🔫',
            'sword': '⚔️',
            'grenades': '💣',
            'missiles': '🚀'
        };
        
        weaponBtn.textContent = weaponIcons[nextWeapon] || '🔫';
    }
    
    shootAtTarget(targetX, targetY) {
        // Check if manual shooting is on cooldown
        if (this.manualShootCooldown > 0) {
            return; // Can't shoot yet
        }
        
        // Set cooldown based on current fire rate
        const shootRate = this.rapidFire ? this.autoShootRate / 3 : this.autoShootRate;
        this.manualShootCooldown = shootRate;
        
        this.useWeapon(targetX, targetY);
    }
    
    shootBullets(targetX, targetY) {
        this.sounds.shoot(); // Play shooting sound
        
        // Set cooldown
        const shootRate = this.rapidFire ? 20 : 60; // 3 shots/sec vs 1 shot/sec
        this.weaponCooldowns.bullets = shootRate;
        
        const dx = targetX - this.player.x;
        const dy = targetY - this.player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            if (this.multiShot) {
                // Multi-shot: shoot in 16 directions
                for (let i = 0; i < 16; i++) {
                    const angle = (i * Math.PI * 2) / 16;
                    const bullet = {
                        x: this.player.x,
                        y: this.player.y,
                        vx: Math.cos(angle) * this.bulletSpeed,
                        vy: Math.sin(angle) * this.bulletSpeed,
                        size: 5,
                        color: '#FFD700',
                        damage: 1
                    };
                    this.bullets.push(bullet);
                }
            } else {
                // Single shot
                const bullet = {
                    x: this.player.x,
                    y: this.player.y,
                    vx: (dx / distance) * this.bulletSpeed,
                    vy: (dy / distance) * this.bulletSpeed,
                    size: 5,
                    color: '#FFD700',
                    damage: 1
                };
                this.bullets.push(bullet);
            }
        }
    }
    
    getAvailableWeapons() {
        let availableWeapons = ['bullets', 'sword']; // Always available
        
        if (this.level >= 20) {
            availableWeapons.push('grenades');
        }
        if (this.level >= 40) {
            availableWeapons.push('missiles');
        }
        
        return availableWeapons;
    }
    
    switchWeapon() {
        const availableWeapons = this.getAvailableWeapons();
        
        // Find current weapon index in available weapons
        let currentIndex = availableWeapons.indexOf(this.weapons[this.currentWeapon]);
        if (currentIndex === -1) {
            currentIndex = 0; // Default to first weapon if current isn't available
        }
        
        // Switch to next available weapon
        const nextIndex = (currentIndex + 1) % availableWeapons.length;
        this.currentWeapon = this.weapons.indexOf(availableWeapons[nextIndex]);
        
        // Activate sword blades if sword is selected, deactivate otherwise
        this.swordBlades.active = (this.weapons[this.currentWeapon] === 'sword');
        
        this.updateUI(); // Update weapon display in status bar
        
        // Update mobile weapon button icon if on mobile
        if (this.isMobile) {
            this.updateWeaponButtonIcon();
        }
    }
    
    autoShoot() {
        if (this.monsters.length === 0) return;
        
        // Find closest monster
        let closestMonster = null;
        let closestDistance = Infinity;
        
        this.monsters.forEach(monster => {
            const distance = Math.sqrt(
                Math.pow(this.player.x - monster.x, 2) + 
                Math.pow(this.player.y - monster.y, 2)
            );
            if (distance < closestDistance) {
                closestDistance = distance;
                closestMonster = monster;
            }
        });
        
        if (closestMonster) {
            this.useWeapon(closestMonster.x, closestMonster.y);
        }
    }
    
    useWeapon(targetX, targetY) {
        const weaponName = this.weapons[this.currentWeapon];
        const availableWeapons = this.getAvailableWeapons();
        
        // Check if weapon is unlocked
        if (!availableWeapons.includes(weaponName)) {
            return;
        }
        
        // Check weapon cooldown
        if (this.weaponCooldowns[weaponName] > 0) {
            return;
        }
        
        switch(weaponName) {
            case 'bullets':
                this.shootBullets(targetX, targetY);
                break;
            case 'sword':
                this.useSword();
                break;
            case 'missiles':
                this.fireMissiles();
                break;
            case 'grenades':
                this.throwGrenades(targetX, targetY);
                break;
        }
    }
    
    useSword() {
        // No cooldown - sword blades are always active when sword is selected
        this.swordBlades.active = true;
    }
    
    fireMissiles() {
        const fireRate = this.rapidFire ? 40 : 120; // 60fps = 1 sec
        this.weaponCooldowns.missiles = fireRate;
        
        // Find up to 3 closest monsters for homing
        const targets = this.monsters
            .map(monster => ({
                monster,
                distance: Math.sqrt(
                    Math.pow(this.player.x - monster.x, 2) + 
                    Math.pow(this.player.y - monster.y, 2)
                )
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, this.multiShot ? 4 : 1) // Triple missiles with multishot
            .map(item => item.monster);
        
        // Create missiles for each target
        targets.forEach(target => {
            const missile = {
                x: this.player.x,
                y: this.player.y,
                target: target,
                speed: 4,
                damage: 3,
                size: 3,
                color: '#FF4500',
                angle: 0, // Direction missile is pointing
                trail: [] // Store trail positions for dotted effect
            };
            this.missiles.push(missile);
            this.sounds.missile();
        });
        
    }
    
    throwGrenades(targetX, targetY) {
        // Set cooldown - 2 seconds normally
        const throwRate = this.rapidFire ? 40 : 120;
        this.weaponCooldowns.grenades = throwRate;
        
        const dx = targetX - this.player.x;
        const dy = targetY - this.player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            const grenadeCount = this.multiShot ? 4 : 1;
            
            // Fixed distance: 1/4 of screen width
            const fixedDistance = this.canvas.width / 4;
            
            for (let i = 0; i < grenadeCount; i++) {
                // Add some spread for multiple grenades
                const spread = grenadeCount > 1 ? (i - 0.5) * 0.3 : 0;
                const angle = Math.atan2(dy, dx) + spread;
                
                const grenade = {
                    x: this.player.x,
                    y: this.player.y,
                    vx: Math.cos(angle) * 6,
                    vy: Math.sin(angle) * 6,
                    size: 4,
                    color: '#228B22',
                    timer: 90,
                    fixedDistance: fixedDistance, // Store for reference
                    startX: this.player.x, // Track starting position
                    startY: this.player.y
                };
                this.grenades.push(grenade);
            }
        }
        
        this.sounds.grenade();
    }
    
    spawnMonster() {
        const side = Math.floor(Math.random() * 4);
        let x, y;
        
        switch(side) {
            case 0: // top
                x = Math.random() * this.canvas.width;
                y = -30;
                break;
            case 1: // right
                x = this.canvas.width + 30;
                y = Math.random() * this.canvas.height;
                break;
            case 2: // bottom
                x = Math.random() * this.canvas.width;
                y = this.canvas.height + 30;
                break;
            case 3: // left
                x = -30;
                y = Math.random() * this.canvas.height;
                break;
        }
        
        // Monster tier system
        const tier = this.getMonsterTier();
        const monsterTypes = this.getMonsterTypes(tier);
        const type = monsterTypes[Math.floor(Math.random() * monsterTypes.length)];
        
        const monster = {
            x: x,
            y: y,
            size: type.size + Math.random() * (type.size * 0.25), // 25% size variation
            speed: type.speed + Math.random() * type.speedVariation,
            color: type.color,
            shape: type.shape,
            name: type.name,
            health: type.health,
            maxHealth: type.health,
            tier: tier,
            points: type.points,
            behavior: Math.random() < this.monsterChaseChance ? 'chase' : 'random',
            direction: Math.random() * Math.PI * 2, // Random initial direction
            directionChangeCounter: 0,
            directionChangeRate: 100 + Math.random() * 100, // Change direction every 1.8-3.5 seconds
            healingTimer: 0, // Timer for healing when damaged
            spawnSafetyTimer: 120, // 2 seconds of safety at 60fps
            isDangerous: false, // Not dangerous during spawn safety period
            isBoss: tier === 'large' || tier === 'elite' || tier === 'legendary' || tier === 'mythic' || tier === 'ancient' || tier === 'ultimate'
        };
        
        this.monsters.push(monster);
    }
    
    getMonsterTier() {
        const rand = Math.random();
        
        // Introduce harder monsters based on level
        if (this.level >= 70 && rand < 0.05) return 'ultimate';      // 5% chance - ultimate monsters
        if (this.level >= 50 && rand < 0.08) return 'ancient';        // 8% chance - ancient monsters
        if (this.level >= 30 && rand < 0.10) return 'mythic';         // 10% chance - mythic monsters
        if (this.level >= 20 && rand < 0.12) return 'legendary';      // 12% chance - legendary monsters
        if (this.level >= 10 && rand < 0.15) return 'elite';          // 15% chance - elite monsters
        if (rand < 0.65) return 'small';                              // 65% chance - small monsters
        if (rand < 0.90) return 'medium';                             // 25% chance - medium monsters  
        return 'large';                                                // 10% chance - large monsters
    }
    
    // All monster definitions
    getMonsterTypes(tier) {
        const monsterTypes = {
            small: [
                { shape: 'circle', color: '#8B0000', size: 11, speed: 1.5, speedVariation: 0.5, health: 1, name: 'Imp', points: 10 },
                { shape: 'square', color: '#4B0082', size: 8, speed: 1.6, speedVariation: 0.4, health: 1, name: 'Shadow', points: 10 },
                { shape: 'triangle', color: '#006400', size: 9, speed: 1.6, speedVariation: 0.5, health: 1, name: 'Goblin', points: 10 },
                { shape: 'diamond', color: '#8B4513', size: 10, speed: 1.4, speedVariation: 0.4, health: 1, name: 'Kobold', points: 10 }
            ],
            medium: [
                { shape: 'star', color: '#DC143C', size: 14, speed: 1.2, speedVariation: 0.3, health: 2, name: 'Demon', points: 25 },
                { shape: 'hexagon', color: '#8A2BE2', size: 12, speed: 1.3, speedVariation: 0.4, health: 2, name: 'Wraith', points: 25 },
                { shape: 'cross', color: '#228B22', size: 13, speed: 1.1, speedVariation: 0.3, health: 3, name: 'Troll', points: 25 }
            ],
            large: [
                { shape: 'boss', color: '#FF4500', size: 15, speed: 0.8, speedVariation: 0.2, health: 5, name: 'Dragon Lord', points: 100 },
                { shape: 'giant', color: '#800080', size: 19, speed: 1.0, speedVariation: 0.2, health: 4, name: 'Ancient One', points: 80 },
                { shape: 'behemoth', color: '#2F4F4F', size: 17, speed: 0.7, speedVariation: 0.2, health: 6, name: 'Behemoth', points: 120 }
            ]
        };
        
        // Add harder monsters every 10 levels
        if (this.level >= 10) {
            monsterTypes.elite = [
                { shape: 'elite', color: '#FFD700', size: 20, speed: 1.4, speedVariation: 0.5, health: 3, name: 'Elite Guard', points: 50 }
            ];
        }
        
        if (this.level >= 20) {
            monsterTypes.legendary = [
                { shape: 'legendary', color: '#FF1493', size: 24, speed: 1.5, speedVariation: 0.3, health: 10, name: 'Legendary Beast', points: 150 }
            ];
        }
        
        if (this.level >= 30) {
            monsterTypes.mythic = [
                { shape: 'mythic', color: '#00FFFF', size: 28, speed: 1.8, speedVariation: 0.4, health: 14, name: 'Mythic Titan', points: 250 }
            ];
        }
        
        if (this.level >= 50) {
            monsterTypes.ancient = [
                { shape: 'ancient', color: '#FF00FF', size: 34, speed: 2.2, speedVariation: 0.5, health: 20, name: 'Ancient Horror', points: 400 }
            ];
        }
        
        if (this.level >= 70) {
            monsterTypes.ultimate = [
                { shape: 'ultimate', color: '#FFFFFF', size: 40, speed: 2.4, speedVariation: 0.8, health: 50, name: 'Ultimate Destroyer', points: 1000 }
            ];
        }
        
        return monsterTypes[tier] || monsterTypes.small;
    }
    
    spawnPowerup(x, y) {
        const powerupTypes = [
            { type: 'multiShot', color: '#FF69B4', symbol: '🏹', emoji: '🏹', name: 'Multi-Shot' },
            { type: 'rapidFire', color: '#00CED1', symbol: '⚡', emoji: '⚡', name: 'Rapid Fire' },
            { type: 'invincible', color: '#90EE90', symbol: '🛡️', emoji: '🛡️', name: 'Invincible' },
            { type: 'freeze', color: '#87CEEB', symbol: '❄️', emoji: '❄️', name: 'Freeze' },
            { type: 'heart', color: '#FF1493', symbol: '❤️', emoji: '❤️', name: 'Extra Life' },
            { type: 'bomb', color: '#FF0000', symbol: '💣', emoji: '💣', name: 'Bomb' }
        ];
        
        const powerup = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
        
        const powerupObj = {
            x: x !== undefined ? x : Math.random() * (this.canvas.width - 40) + 20,
            y: y !== undefined ? y : Math.random() * (this.canvas.height - 40) + 20,
            size: 15,
            color: powerup.color,
            type: powerup.type,
            symbol: powerup.symbol,
            emoji: powerup.emoji,
            name: powerup.name
        };
        
        this.powerups.push(powerupObj);
    }
    
    updatePlayer() {
        // Keyboard controls
        if (this.keys['w'] || this.keys['arrowup']) {
            this.player.y = Math.max(this.player.size, this.player.y - this.player.speed);
        }
        if (this.keys['s'] || this.keys['arrowdown']) {
            this.player.y = Math.min(this.canvas.height - this.player.size, this.player.y + this.player.speed);
        }
        if (this.keys['a'] || this.keys['arrowleft']) {
            this.player.x = Math.max(this.player.size, this.player.x - this.player.speed);
        }
        if (this.keys['d'] || this.keys['arrowright']) {
            this.player.x = Math.min(this.canvas.width - this.player.size, this.player.x + this.player.speed);
        }
        
        // Mobile touch controls
        if (this.isMobile && this.touchControls.joystick.active) {
            const moveX = this.touchControls.movement.x * this.player.speed;
            const moveY = this.touchControls.movement.y * this.player.speed;
            
            this.player.x = Math.max(this.player.size, 
                Math.min(this.canvas.width - this.player.size, this.player.x + moveX));
            this.player.y = Math.max(this.player.size, 
                Math.min(this.canvas.height - this.player.size, this.player.y + moveY));
        }
    }
    
    updateBullets() {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            bullet.x += bullet.vx;
            bullet.y += bullet.vy;
            
            // Remove bullets that are off screen
            if (bullet.x < 0 || bullet.x > this.canvas.width || 
                bullet.y < 0 || bullet.y > this.canvas.height) {
                this.bullets.splice(i, 1);
            }
        }
    }
    
    updateMissiles() {
        for (let i = this.missiles.length - 1; i >= 0; i--) {
            const missile = this.missiles[i];
            
            // Check if target still exists
            if (!this.monsters.includes(missile.target)) {
                this.missiles.splice(i, 1);
                continue;
            }
            
            // Add current position to trail (every few frames for dotted effect)
            if (missile.trail.length === 0 || 
                (missile.trail.length > 0 && 
                 Math.sqrt(Math.pow(missile.x - missile.trail[missile.trail.length - 1].x, 2) + 
                          Math.pow(missile.y - missile.trail[missile.trail.length - 1].y, 2)) > 8)) {
                missile.trail.push({x: missile.x, y: missile.y});
                
                // Limit trail length
                if (missile.trail.length > 15) {
                    missile.trail.shift();
                }
            }
            
            // Home in on target
            const dx = missile.target.x - missile.x;
            const dy = missile.target.y - missile.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
                // Update missile angle for pointing direction
                missile.angle = Math.atan2(dy, dx);
                
                missile.x += (dx / distance) * missile.speed;
                missile.y += (dy / distance) * missile.speed;
            }
            
            // Check collision with target
            if (distance < missile.size + missile.target.size) {
                missile.target.health -= missile.damage;
                missile.target.healingTimer = 0; // Reset healing timer when damaged
                this.missiles.splice(i, 1);
                
            }
            
            // Remove missiles that are too far off screen
            if (missile.x < -100 || missile.x > this.canvas.width + 100 || 
                missile.y < -100 || missile.y > this.canvas.height + 100) {
                this.missiles.splice(i, 1);
            }
        }
    }
    
    updateGrenades() {
        for (let i = this.grenades.length - 1; i >= 0; i--) {
            const grenade = this.grenades[i];
            
            // Check if grenade has traveled the fixed distance before moving
            const distanceTraveled = Math.sqrt(
                Math.pow(grenade.x - grenade.startX, 2) + 
                Math.pow(grenade.y - grenade.startY, 2)
            );
            
            // Stop grenade if it has reached the fixed distance
            if (distanceTraveled >= grenade.fixedDistance) {
                grenade.vx = 0;
                grenade.vy = 0;
            } else {
                // Move grenade only if it hasn't reached fixed distance
                grenade.x += grenade.vx;
                grenade.y += grenade.vy;
            }
            
            // Check collision with monsters
            let hitMonster = false;
            for (let j = this.monsters.length - 1; j >= 0; j--) {
                const monster = this.monsters[j];
                const distance = Math.sqrt(
                    Math.pow(grenade.x - monster.x, 2) + 
                    Math.pow(grenade.y - monster.y, 2)
                );
                
                if (distance < grenade.size + monster.size) {
                    // Grenade hits monster - stop moving immediately
                    grenade.vx = 0;
                    grenade.vy = 0;
                    break;
                }
            }
            
            grenade.timer--;
            
            // Explode when timer reaches 0
            if (grenade.timer <= 0) {
                this.explodeGrenade(grenade);
                this.grenades.splice(i, 1);
            }
            
            // Remove grenades that are off screen
            else if (grenade.x < -50 || grenade.x > this.canvas.width + 50 || 
                     grenade.y < -50 || grenade.y > this.canvas.height + 50) {
                this.grenades.splice(i, 1);
            }
        }
    }
    
    updateSwordSwings() {
        for (let i = this.swordSwings.length - 1; i >= 0; i--) {
            const swing = this.swordSwings[i];
            swing.timer--;
            
            if (swing.timer <= 0) {
                this.swordSwings.splice(i, 1);
            }
        }
    }
    
    updateSwordBlades() {
        if (!this.swordBlades.active) return;
        
        // Update rotation speed based on rapid fire
        const spinSpeed = this.rapidFire ? this.swordBlades.spinSpeed * 3 : this.swordBlades.spinSpeed;
        this.swordBlades.rotation += spinSpeed;
        
        // Play swoosh sound on each complete rotation
        const currentRotationCycle = Math.floor(this.swordBlades.rotation / (Math.PI * 2));
        const lastRotationCycle = Math.floor(this.swordBlades.lastSwooshRotation / (Math.PI * 2));
        
        if (currentRotationCycle > lastRotationCycle) {
            this.sounds.swoosh();
            this.swordBlades.lastSwooshRotation = this.swordBlades.rotation;
        }
        
        // Get current blade properties - 1 blade becomes 3 with multishot
        const bladeCount = this.multiShot ? 3 : this.swordBlades.baseBladeCount;
        const radius = this.multiShot ? this.swordBlades.baseRadius * 1.25 : this.swordBlades.baseRadius;
        
        // Check collision with monsters
        this.monsters.forEach(monster => {
            for (let i = 0; i < bladeCount; i++) {
                const angle = this.swordBlades.rotation + (i * Math.PI * 2) / bladeCount;
                const bladeStartX = this.player.x + Math.cos(angle) * (radius - this.swordBlades.bladeLength);
                const bladeStartY = this.player.y + Math.sin(angle) * (radius - this.swordBlades.bladeLength);
                const bladeEndX = this.player.x + Math.cos(angle) * radius;
                const bladeEndY = this.player.y + Math.sin(angle) * radius;
                
                // Check if monster intersects with blade line
                const distanceToLine = this.distancePointToLineSegment(
                    monster.x, monster.y,
                    bladeStartX, bladeStartY,
                    bladeEndX, bladeEndY
                );
                
                if (distanceToLine <= monster.size + 2) { // 2 pixel blade width
                    monster.health -= 1; // Each blade hit does 1 damage
                    monster.healingTimer = 0; // Reset healing timer when damaged
                    // Add a small knockback effect
                    const knockbackAngle = Math.atan2(monster.y - this.player.y, monster.x - this.player.x);
                    monster.x += Math.cos(knockbackAngle) * 2;
                    monster.y += Math.sin(knockbackAngle) * 2;
                }
            }
        });
    }
    
    distancePointToLineSegment(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) {
            param = dot / lenSq;
        }
        
        let xx, yy;
        
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }
        
        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    updateExplosions() {
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const explosion = this.explosions[i];
            
            // Expand the explosion radius over time
            const progress = (explosion.maxTimer - explosion.timer) / explosion.maxTimer;
            explosion.currentRadius = explosion.maxRadius * progress;
            
            explosion.timer--;
            
            if (explosion.timer <= 0) {
                this.explosions.splice(i, 1);
            }
        }
    }
    
    explodeGrenade(grenade) {
        const explosionRadius = 40;
        
        // Damage all monsters within explosion radius
        this.monsters.forEach(monster => {
            const distance = Math.sqrt(
                Math.pow(grenade.x - monster.x, 2) + 
                Math.pow(grenade.y - monster.y, 2)
            );
            
            if (distance <= explosionRadius + monster.size) {
                monster.health -= this.bombDamage;
                monster.healingTimer = 0; // Reset healing timer when damaged
            }
        });
        
        // Create visual explosion effect
        const explosion = {
            x: grenade.x,
            y: grenade.y,
            maxRadius: explosionRadius,
            currentRadius: 0,
            timer: 18, // 0.3 seconds at 60fps
            maxTimer: 36
        };
        this.explosions.push(explosion);
        
        // Play boom sound
        this.sounds.boom();
    }
    
    updateMonsters() {
        for (let i = this.monsters.length - 1; i >= 0; i--) {
            const monster = this.monsters[i];
            
            // Update spawn safety timer
            if (monster.spawnSafetyTimer > 0) {
                monster.spawnSafetyTimer--;
                if (monster.spawnSafetyTimer === 0) {
                    monster.isDangerous = true;
                }
            }
            
            // Update healing timer if monster is damaged
            if (monster.health < monster.maxHealth) {
                monster.healingTimer++;
                if (monster.healingTimer >= 180) { // 3 seconds at 60fps
                    monster.health = Math.min(monster.health + 1, monster.maxHealth);
                    monster.healingTimer = 0;
                }
            } else {
                monster.healingTimer = 0; // Reset timer if at full health
            }
            
            // Update monster movement based on behavior
            this.updateMonsterMovement(monster);
            
            // Check collision with player
            const playerDistance = Math.sqrt(
                Math.pow(this.player.x - monster.x, 2) + 
                Math.pow(this.player.y - monster.y, 2)
            );
            
            if (playerDistance < this.player.size + monster.size) {
                if (!this.invincible && monster.isDangerous) {
                    this.player.health--;
                    this.invincible = true;
                    this.powerupTimers.invincible = 100;
                    
                    if (this.player.health <= 0) {
                        this.killedByMonster = monster; // Track which monster killed the player
                        this.gameOver = true;
                        this.sounds.gameOver();
                    } else {
                        this.sounds.playerHit();
                    }
                }
            }
            
            // Remove monsters that are fully outside the screen
            if (monster.x + monster.size < -50 || 
                monster.x - monster.size > this.canvas.width + 50 || 
                monster.y + monster.size < -50 || 
                monster.y - monster.size > this.canvas.height + 50) {
                const shouldChangeDirection = Math.random() < this.monsterTurnBackChance;
                
                if (shouldChangeDirection) {
                        // Change direction to move back toward screen center
                        const centerX = this.canvas.width / 2;
                        const centerY = this.canvas.height / 2;
                        const toCenterX = centerX - monster.x;
                        const toCenterY = centerY - monster.y;
                        monster.direction = Math.atan2(toCenterY, toCenterX) + (Math.random() - 0.5) * Math.PI; // Add some randomness
                        monster.directionChangeCounter = 0;
                } else {                    
                    this.monsters.splice(i, 1);
                }
            }
        }
    }
    
    updateMonsterMovement(monster) {
        monster.directionChangeCounter++;
        
        // Apply freeze effect - monsters move 50% slower when frozen
        const speedMultiplier = this.freeze ? 0.5 : 1.0;
        
        switch(monster.behavior) {
            case 'chase':
                // Chase player
                const dx = this.player.x - monster.x;
                const dy = this.player.y - monster.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > 0) {
                    monster.x += (dx / distance) * monster.speed * speedMultiplier;
                    monster.y += (dy / distance) * monster.speed * speedMultiplier;
                }
                break;
                
            case 'random':
                // Random movement with direction changes
                if (monster.directionChangeCounter >= monster.directionChangeRate) {
                    monster.direction = Math.random() * Math.PI * 2;
                    monster.directionChangeCounter = 0;
                    monster.directionChangeRate = 60 + Math.random() * 120;
                }
                
                monster.x += Math.cos(monster.direction) * monster.speed * speedMultiplier;
                monster.y += Math.sin(monster.direction) * monster.speed * speedMultiplier;
                break;
        }
        
        // Allow monsters to leave the screen (no boundary restrictions)
    }
    
    updatePowerups() {
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const powerup = this.powerups[i];
            
            // Check collision with player
            const distance = Math.sqrt(
                Math.pow(this.player.x - powerup.x, 2) + 
                Math.pow(this.player.y - powerup.y, 2)
            );
            
            if (distance < this.player.size + powerup.size) {
                // Collect powerup
                if (powerup.type === 'multiShot') {
                    this.multiShot = true;
                    this.powerupTimers.multiShot += 600; // 10 seconds
                    this.sounds.powerup();
                } else if (powerup.type === 'rapidFire') {
                    this.rapidFire = true;
                    this.powerupTimers.rapidFire += 600; // 10 seconds
                    this.sounds.powerup();
                } else if (powerup.type === 'invincible') {
                    this.invincible = true;
                    this.powerupTimers.invincible += 600;
                    this.sounds.powerup();
                } else if (powerup.type === 'freeze') {
                    this.freeze = true;
                    this.powerupTimers.freeze += 600;
                    this.sounds.powerup();
                } else if (powerup.type === 'heart') {
                    // Add extra life (max 3 hearts)
                    if (this.player.health < this.player.maxHealth) {
                        this.player.health++;
                        this.sounds.powerup();
                    }
                } else if (powerup.type === 'bomb') {
                    this.activateBomb(); // Activate bomb immediately
                }
                
                this.powerups.splice(i, 1);
            }
        }
        
        // Update powerup timers
        if (this.powerupTimers.multiShot > 0) {
            this.powerupTimers.multiShot--;
            if (this.powerupTimers.multiShot === 0) {
                this.multiShot = false;
            }
        }
        
        if (this.powerupTimers.rapidFire > 0) {
            this.powerupTimers.rapidFire--;
            if (this.powerupTimers.rapidFire === 0) {
                this.rapidFire = false;
            }
        }

        if (this.powerupTimers.invincible > 0) {
            this.powerupTimers.invincible--;
            if (this.powerupTimers.invincible === 0) {
                this.invincible = false;
            }
        }
        
        if (this.powerupTimers.freeze > 0) {
            this.powerupTimers.freeze--;
            if (this.powerupTimers.freeze === 0) {
                this.freeze = false;
            }
        }
    }
    
    checkCollisions() {
        // Check bullet collisions
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            
            for (let j = this.monsters.length - 1; j >= 0; j--) {
                const monster = this.monsters[j];
                
                const distance = Math.sqrt(
                    Math.pow(bullet.x - monster.x, 2) + 
                    Math.pow(bullet.y - monster.y, 2)
                );
                
                if (distance < bullet.size + monster.size) {
                    // Hit! Remove bullet and reduce monster health
                    this.bullets.splice(i, 1);
                    monster.health -= bullet.damage || 1;
                    monster.healingTimer = 0; // Reset healing timer when damaged
                    
                    if (monster.health <= 0) {
                        this.killMonster(monster, j);
                    }
                    break;
                }
            }
        }
        
        // Check for dead monsters from other weapons (sword, missiles, grenades)
        for (let j = this.monsters.length - 1; j >= 0; j--) {
            const monster = this.monsters[j];
            if (monster.health <= 0) {
                this.killMonster(monster, j);
            }
        }
    }
    
    killMonster(monster, index) {
        // Monster dies
        this.monsters.splice(index, 1);
        this.score += monster.points;
        this.monstersKilled++;
        this.updateUI();
         // Play monster death sounds
        if (monster.isBoss) {
            this.sounds.monsterBossDeath();
        } else {
            this.sounds.monsterDeath(); 
        }
        
        // Check if boss aura monster drops powerup
        this.checkBossPowerupDrop(monster);
    }
    
    updateUI() {
        // Update top border bar
        document.getElementById('levelDisplay').textContent = this.level;
        document.getElementById('scoreDisplay').textContent = this.score;
        document.getElementById('killsDisplay').textContent = this.monstersKilled;
        
        // Update weapons display
        const weaponEmojis = ['🔫', '⚔️', '🚀', '💣'];
        const availableWeapons = this.getAvailableWeapons();
        let weaponsDisplay = '';
        
        for (let i = 0; i < this.weapons.length; i++) {
            const weaponName = this.weapons[i];
            const emoji = weaponEmojis[i];
            
            if (availableWeapons.includes(weaponName)) {
                // Available weapon
                if (i === this.currentWeapon) {
                    // Active weapon - full color
                    weaponsDisplay += emoji + ' ';
                } else {
                    // Available but not active - slightly dimmed
                    weaponsDisplay += '<span style="opacity: 0.6;">' + emoji + '</span> ';
                }
            } else {
                // Locked weapon - very dimmed
                weaponsDisplay += '<span style="opacity: 0.2;">' + emoji + '</span> ';
            }
        }
        
        document.getElementById('weaponsDisplay').innerHTML = weaponsDisplay.trim();
        
        // Update powerups display with time remaining
        let powerupText = 'None';
        if (this.multiShot || this.rapidFire || this.invincible || this.freeze) {
            powerupText = '';
            if (this.multiShot) {
                const timeLeft = Math.ceil(this.powerupTimers.multiShot / 60);
                powerupText += `🏹${timeLeft}s `;
            }
            if (this.rapidFire) {
                const timeLeft = Math.ceil(this.powerupTimers.rapidFire / 60);
                powerupText += `⚡${timeLeft}s `;
            }
            if (this.invincible) {
                const timeLeft = Math.ceil(this.powerupTimers.invincible / 60);
                powerupText += `🛡️${timeLeft}s `;
            }
            if (this.freeze) {
                const timeLeft = Math.ceil(this.powerupTimers.freeze / 60);
                powerupText += `❄️${timeLeft}s `;
            }
            powerupText = powerupText.trim();
        }
        document.getElementById('powerupsDisplay').textContent = powerupText;
    }
    
    drawMonster(monster) {
        this.ctx.fillStyle = monster.color;
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        
        switch(monster.shape) {
            case 'circle':
                this.ctx.beginPath();
                this.ctx.arc(monster.x, monster.y, monster.size, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.stroke();
                break;
                
            case 'square':
                this.ctx.fillRect(monster.x - monster.size, monster.y - monster.size, monster.size * 2, monster.size * 2);
                this.ctx.strokeRect(monster.x - monster.size, monster.y - monster.size, monster.size * 2, monster.size * 2);
                break;
                
            case 'triangle':
                this.ctx.beginPath();
                this.ctx.moveTo(monster.x, monster.y - monster.size);
                this.ctx.lineTo(monster.x - monster.size, monster.y + monster.size);
                this.ctx.lineTo(monster.x + monster.size, monster.y + monster.size);
                this.ctx.closePath();
                this.ctx.fill();
                this.ctx.stroke();
                break;
                
            case 'diamond':
                this.ctx.beginPath();
                this.ctx.moveTo(monster.x, monster.y - monster.size);
                this.ctx.lineTo(monster.x + monster.size, monster.y);
                this.ctx.lineTo(monster.x, monster.y + monster.size);
                this.ctx.lineTo(monster.x - monster.size, monster.y);
                this.ctx.closePath();
                this.ctx.fill();
                this.ctx.stroke();
                break;
                
            case 'star':
                this.drawStar(monster.x, monster.y, monster.size);
                break;
                
            case 'hexagon':
                this.drawHexagon(monster.x, monster.y, monster.size);
                break;
                
            case 'cross':
                this.drawCross(monster.x, monster.y, monster.size);
                break;
                
            case 'boss':
                this.drawBoss(monster.x, monster.y, monster.size);
                break;
                
            case 'giant':
                this.drawGiant(monster.x, monster.y, monster.size);
                break;
                
            case 'behemoth':
                this.drawBehemoth(monster.x, monster.y, monster.size);
                break;
                
            case 'elite':
                this.drawElite(monster.x, monster.y, monster.size);
                break;
                
            case 'legendary':
                this.drawLegendary(monster.x, monster.y, monster.size);
                break;
                
            case 'mythic':
                this.drawMythic(monster.x, monster.y, monster.size);
                break;
                
            case 'ancient':
                this.drawAncient(monster.x, monster.y, monster.size);
                break;
                
            case 'ultimate':
                this.drawUltimate(monster.x, monster.y, monster.size);
                break;
        }
        
        // Draw freeze effect if freeze powerup is active
        if (this.freeze) {
            this.drawFreezeEffect(monster);
        }
        
        // Draw health bar for all monsters
        this.drawHealthBar(monster);
        
        // Monster eyes
        const eyeSize = monster.isBoss ? 3 : 4;
        const eyeOffset = monster.isBoss ? 8 : 6;
        
        if (monster.spawnSafetyTimer > 0) {
            // Draw closed eyes (horizontal lines) during spawn safety period
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            // Left eye (closed)
            this.ctx.moveTo(monster.x - eyeOffset - eyeSize, monster.y - eyeOffset);
            this.ctx.lineTo(monster.x - eyeOffset + eyeSize, monster.y - eyeOffset);
            // Right eye (closed)
            this.ctx.moveTo(monster.x + eyeOffset - eyeSize, monster.y - eyeOffset);
            this.ctx.lineTo(monster.x + eyeOffset + eyeSize, monster.y - eyeOffset);
            this.ctx.stroke();
        } else {
            // Draw normal open eyes
            this.ctx.fillStyle = '#FFF';
            this.ctx.beginPath();
            this.ctx.arc(monster.x - eyeOffset, monster.y - eyeOffset, eyeSize, 0, Math.PI * 2);
            this.ctx.arc(monster.x + eyeOffset, monster.y - eyeOffset, eyeSize, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.fillStyle = '#000';
            this.ctx.beginPath();
            this.ctx.arc(monster.x - eyeOffset, monster.y - eyeOffset, eyeSize * 0.6, 0, Math.PI * 2);
            this.ctx.arc(monster.x + eyeOffset, monster.y - eyeOffset, eyeSize * 0.6, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
    
    drawFreezeEffect(monster) {
        // Save current context
        this.ctx.save();
        
        // Create ice-blue tint overlay
        this.ctx.globalAlpha = 0.3;
        this.ctx.fillStyle = '#87CEEB'; // Light blue ice color
        
        // Draw ice overlay matching monster shape
        switch(monster.shape) {
            case 'circle':
                this.ctx.beginPath();
                this.ctx.arc(monster.x, monster.y, monster.size, 0, Math.PI * 2);
                this.ctx.fill();
                break;
                
            case 'square':
                this.ctx.fillRect(monster.x - monster.size, monster.y - monster.size, monster.size * 2, monster.size * 2);
                break;
                
            case 'triangle':
                this.ctx.beginPath();
                this.ctx.moveTo(monster.x, monster.y - monster.size);
                this.ctx.lineTo(monster.x - monster.size, monster.y + monster.size);
                this.ctx.lineTo(monster.x + monster.size, monster.y + monster.size);
                this.ctx.closePath();
                this.ctx.fill();
                break;
                
            case 'diamond':
                this.ctx.beginPath();
                this.ctx.moveTo(monster.x, monster.y - monster.size);
                this.ctx.lineTo(monster.x + monster.size, monster.y);
                this.ctx.lineTo(monster.x, monster.y + monster.size);
                this.ctx.lineTo(monster.x - monster.size, monster.y);
                this.ctx.closePath();
                this.ctx.fill();
                break;
                
            default:
                // For complex shapes (star, hexagon, boss, etc.), draw a circular ice overlay
                this.ctx.beginPath();
                this.ctx.arc(monster.x, monster.y, monster.size, 0, Math.PI * 2);
                this.ctx.fill();
                break;
        }
        
        // Draw ice crystals/frost patterns
        this.ctx.globalAlpha = 0.6;
        this.ctx.strokeStyle = '#B0E0E6'; // Powder blue
        this.ctx.lineWidth = 1;
        
        // Draw frost lines radiating from center
        const numLines = 6;
        for (let i = 0; i < numLines; i++) {
            const angle = (i / numLines) * Math.PI * 2;
            const startRadius = monster.size * 0.3;
            const endRadius = monster.size * 0.8;
            
            const startX = monster.x + Math.cos(angle) * startRadius;
            const startY = monster.y + Math.sin(angle) * startRadius;
            const endX = monster.x + Math.cos(angle) * endRadius;
            const endY = monster.y + Math.sin(angle) * endRadius;
            
            this.ctx.beginPath();
            this.ctx.moveTo(startX, startY);
            this.ctx.lineTo(endX, endY);
            this.ctx.stroke();
        }
        
        // Draw small ice crystals around the monster
        this.ctx.globalAlpha = 0.8;
        this.ctx.fillStyle = '#E0F6FF'; // Very light blue
        const crystalCount = 8;
        
        for (let i = 0; i < crystalCount; i++) {
            const angle = (i / crystalCount) * Math.PI * 2 + (Date.now() * 0.001); // Slowly rotating
            const distance = monster.size * 1.2;
            const crystalX = monster.x + Math.cos(angle) * distance;
            const crystalY = monster.y + Math.sin(angle) * distance;
            const crystalSize = 2;
            
            // Draw small diamond-shaped ice crystals
            this.ctx.beginPath();
            this.ctx.moveTo(crystalX, crystalY - crystalSize);
            this.ctx.lineTo(crystalX + crystalSize, crystalY);
            this.ctx.lineTo(crystalX, crystalY + crystalSize);
            this.ctx.lineTo(crystalX - crystalSize, crystalY);
            this.ctx.closePath();
            this.ctx.fill();
        }
        
        // Restore context
        this.ctx.restore();
    }
    
    drawHealthBar(monster) {
        const pixelsPerHP = 6;
        const barHeight = 4;
        const barY = monster.y - monster.size - 10;
        const maxBarWidth = monster.size * 2.2; // Maximum width before using stars
        
        // Calculate ideal bar width (5 pixels per max HP)
        const idealBarWidth = monster.maxHealth * pixelsPerHP;
        
        if (idealBarWidth <= maxBarWidth) {
            // Single bar fits within monster bounds
            const barWidth = idealBarWidth;
            const currentBarWidth = monster.health * pixelsPerHP;
            
            // Background
            this.ctx.fillStyle = '#333';
            this.ctx.fillRect(monster.x - barWidth/2, barY, barWidth, barHeight);
            
            // Health
            const healthPercent = monster.health / monster.maxHealth;
            this.ctx.fillStyle = healthPercent > 0.5 ? '#00FF00' : healthPercent > 0.25 ? '#FFFF00' : '#FF0000';
            this.ctx.fillRect(monster.x - barWidth/2, barY, currentBarWidth, barHeight);
            
            // Border
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(monster.x - barWidth/2, barY, barWidth, barHeight);
            
        } else {
            // Multiple bars needed - use star system
            const hpPerBar = Math.floor(maxBarWidth / pixelsPerHP);
            const totalBars = Math.ceil(monster.maxHealth / hpPerBar);
            const currentBars = Math.ceil(monster.health / hpPerBar);
            const remainingHP = monster.health % hpPerBar;
            
            // Calculate active bar width - special handling for full health and full bars
            let activeBarWidth;
            if (monster.health === monster.maxHealth || remainingHP === 0) {
                // Undamaged monster or exactly full bar
                activeBarWidth = maxBarWidth;
            } else {
                // Partial bar - show remaining HP in current bar
                activeBarWidth = remainingHP * pixelsPerHP;
            }
            
            // Background for current bar
            this.ctx.fillStyle = '#333';
            this.ctx.fillRect(monster.x - maxBarWidth/2, barY, maxBarWidth, barHeight);
            
            // Current health in active bar
            const healthPercent = monster.health / monster.maxHealth;
            this.ctx.fillStyle = healthPercent > 0.5 ? '#00FF00' : healthPercent > 0.25 ? '#FFFF00' : '#FF0000';
            this.ctx.fillRect(monster.x - maxBarWidth/2, barY, activeBarWidth, barHeight);
            
            // Border for current bar
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(monster.x - maxBarWidth/2, barY, maxBarWidth, barHeight);
            
            // Draw stars for additional full bars
            const additionalFullBars = Math.floor((monster.health - 1) / hpPerBar);
            if (additionalFullBars > 0) {
                this.ctx.fillStyle = '#FFD700'; // Gold color for stars
                this.ctx.font = '12px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                
                // Position stars above the health bar
                const starY = barY - 8;
                const starSpacing = 8;
                const totalStarWidth = additionalFullBars * starSpacing;
                const startX = monster.x - totalStarWidth/2 + starSpacing/2;
                
                for (let i = 0; i < additionalFullBars; i++) {
                    const starX = startX + i * starSpacing;
                    this.ctx.fillText('★', starX, starY);
                }
            }
        }
    }
    
    drawStar(x, y, size) {
        this.ctx.fillStyle = '#DC143C';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        
        this.ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
            const x1 = x + Math.cos(angle) * size;
            const y1 = y + Math.sin(angle) * size;
            
            if (i === 0) {
                this.ctx.moveTo(x1, y1);
            } else {
                this.ctx.lineTo(x1, y1);
            }
            
            const innerAngle = angle + Math.PI / 5;
            const x2 = x + Math.cos(innerAngle) * (size * 0.5);
            const y2 = y + Math.sin(innerAngle) * (size * 0.5);
            this.ctx.lineTo(x2, y2);
        }
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
    }
    
    drawHexagon(x, y, size) {
        this.ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const x1 = x + Math.cos(angle) * size;
            const y1 = y + Math.sin(angle) * size;
            
            if (i === 0) {
                this.ctx.moveTo(x1, y1);
            } else {
                this.ctx.lineTo(x1, y1);
            }
        }
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
    }
    
    drawCross(x, y, size) {
        const halfSize = size * 0.6;
        this.ctx.fillRect(x - halfSize, y - size, halfSize * 2, size * 2);
        this.ctx.fillRect(x - size, y - halfSize, size * 2, halfSize * 2);
    }
    
    drawBoss(x, y, size) {
        // Dragon-like boss with spikes
        this.ctx.fillStyle = '#FF4500';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 3;
        
        // Main body
        this.ctx.beginPath();
        this.ctx.arc(x, y, size, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Spikes around the body
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI * 2) / 8;
            const spikeX = x + Math.cos(angle) * (size + 5);
            const spikeY = y + Math.sin(angle) * (size + 5);
            
            this.ctx.beginPath();
            this.ctx.moveTo(spikeX, spikeY);
            this.ctx.lineTo(spikeX + Math.cos(angle + 0.3) * 8, spikeY + Math.sin(angle + 0.3) * 8);
            this.ctx.lineTo(spikeX + Math.cos(angle - 0.3) * 8, spikeY + Math.sin(angle - 0.3) * 8);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
        }
    }
    
    drawGiant(x, y, size) {
        // Ancient giant with mystical aura
        this.ctx.fillStyle = '#800080';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        
        // Main body
        this.ctx.beginPath();
        this.ctx.arc(x, y, size, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Mystical symbols around the body
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI * 2) / 6;
            const symbolX = x + Math.cos(angle) * (size + 3);
            const symbolY = y + Math.sin(angle) * (size + 3);
            
            this.ctx.strokeStyle = '#FFD700';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(symbolX, symbolY, 3, 0, Math.PI * 2);
            this.ctx.stroke();
        }
    }
    
    drawBehemoth(x, y, size) {
        // Massive behemoth with armor plates
        this.ctx.fillStyle = '#2F4F4F';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 3;
        
        // Main body
        this.ctx.beginPath();
        this.ctx.arc(x, y, size, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Armor plates
        for (let i = 0; i < 4; i++) {
            const angle = (i * Math.PI * 2) / 4;
            const plateX = x + Math.cos(angle) * (size * 0.7);
            const plateY = y + Math.sin(angle) * (size * 0.7);
            
            this.ctx.fillStyle = '#444';
            this.ctx.beginPath();
            this.ctx.arc(plateX, plateY, size * 0.3, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        }
        
        // Reset fill color
        this.ctx.fillStyle = '#2F4F4F';
    }
    
    drawElite(x, y, size) {
        // Elite monster with golden aura
        this.ctx.fillStyle = '#FFD700';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        
        // Main body
        this.ctx.beginPath();
        this.ctx.arc(x, y, size, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Golden aura
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(x, y, size * 1.5, 0, Math.PI * 2);
        this.ctx.stroke();
    }
    
    drawLegendary(x, y, size) {
        // Legendary monster with purple aura
        this.ctx.fillStyle = '#FF1493';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        
        // Main body
        this.ctx.beginPath();
        this.ctx.arc(x, y, size, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Purple aura
        this.ctx.strokeStyle = '#FF1493';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(x, y, size * 1.5, 0, Math.PI * 2);
        this.ctx.stroke();
    }
    
    drawMythic(x, y, size) {
        // Mythic monster with cyan aura
        this.ctx.fillStyle = '#00FFFF';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        
        // Main body
        this.ctx.beginPath();
        this.ctx.arc(x, y, size, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Cyan aura
        this.ctx.strokeStyle = '#00FFFF';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(x, y, size * 1.5, 0, Math.PI * 2);
        this.ctx.stroke();
    }
    
    drawAncient(x, y, size) {
        // Ancient monster with pink aura
        this.ctx.fillStyle = '#FF00FF';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        
        // Main body
        this.ctx.beginPath();
        this.ctx.arc(x, y, size, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Pink aura
        this.ctx.strokeStyle = '#FF00FF';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(x, y, size * 1.5, 0, Math.PI * 2);
        this.ctx.stroke();
    }
    
    drawUltimate(x, y, size) {
        // Ultimate monster with white aura
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        
        // Main body
        this.ctx.beginPath();
        this.ctx.arc(x, y, size, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // White aura
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(x, y, size * 1.5, 0, Math.PI * 2);
        this.ctx.stroke();
    }
    
    draw() {
        // Clear canvas with level-based background color
        this.ctx.fillStyle = this.getBackgroundColor();
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw red flash effect if bomb was used
        if (this.flashEffect.active) {
            const flashIntensity = this.flashEffect.timer / this.flashEffect.duration;
            
            // Draw red flash fill
            this.ctx.fillStyle = `rgba(255, 0, 0, ${flashIntensity * 0.3})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Draw red outline border
            this.ctx.strokeStyle = `rgba(255, 0, 0, ${flashIntensity * 0.8})`;
            this.ctx.lineWidth = 8;
            this.ctx.strokeRect(4, 4, this.canvas.width - 8, this.canvas.height - 8);
            
            // Draw inner red outline for more intensity
            this.ctx.strokeStyle = `rgba(255, 100, 100, ${flashIntensity * 0.6})`;
            this.ctx.lineWidth = 4;
            this.ctx.strokeRect(12, 12, this.canvas.width - 24, this.canvas.height - 24);
        }
        
        // Draw player as wizard emoji (double size if invincible from powerup, flashing when invincible)
        const playerSize = (this.invincible && this.powerupTimers.invincible > 60) ? this.player.size * 4 : this.player.size * 2;
        this.ctx.font = `${playerSize}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // Flash player when invincible
        if (this.invincible && Math.floor(this.powerupTimers.invincible / 5) % 2 === 0) {
            // Skip drawing (flashing effect)
        } else {
            this.ctx.fillText(this.player.emoji, this.player.x, this.player.y);
        }
        
        // Draw health hearts above player
        this.drawPlayerHealth();
        
        // Draw bullets
        this.bullets.forEach(bullet => {
            this.ctx.fillStyle = bullet.color;
            this.ctx.beginPath();
            this.ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        // Draw missiles
        this.missiles.forEach(missile => {
            // Draw dotted trail
            if (missile.trail && missile.trail.length > 1) {
                this.ctx.strokeStyle = '#FF6600';
                this.ctx.lineWidth = 2;
                this.ctx.setLineDash([3, 3]); // Dotted line
                
                for (let i = 0; i < missile.trail.length - 1; i++) {
                    const alpha = (i + 1) / missile.trail.length; // Fade trail
                    this.ctx.globalAlpha = alpha * 0.7;
                    
                    this.ctx.beginPath();
                    this.ctx.moveTo(missile.trail[i].x, missile.trail[i].y);
                    this.ctx.lineTo(missile.trail[i + 1].x, missile.trail[i + 1].y);
                    this.ctx.stroke();
                }
                
                this.ctx.globalAlpha = 1.0; // Reset alpha
                this.ctx.setLineDash([]); // Reset line dash
            }
            
            // Draw pointed missile body
            this.ctx.save();
            this.ctx.translate(missile.x, missile.y);
            this.ctx.rotate(missile.angle);
            
            // Missile body (elongated oval)
            this.ctx.fillStyle = missile.color;
            this.ctx.beginPath();
            this.ctx.ellipse(0, 0, missile.size * 2, missile.size, 0, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Missile tip (pointed)
            this.ctx.fillStyle = '#FF0000';
            this.ctx.beginPath();
            this.ctx.moveTo(missile.size * 2, 0);
            this.ctx.lineTo(missile.size * 2.5, -missile.size * 0.5);
            this.ctx.lineTo(missile.size * 2.5, missile.size * 0.5);
            this.ctx.closePath();
            this.ctx.fill();
            
            // Missile fins
            this.ctx.fillStyle = '#CC3300';
            this.ctx.beginPath();
            this.ctx.moveTo(-missile.size * 1.5, 0);
            this.ctx.lineTo(-missile.size * 2, -missile.size * 0.8);
            this.ctx.lineTo(-missile.size * 1.8, 0);
            this.ctx.lineTo(-missile.size * 2, missile.size * 0.8);
            this.ctx.closePath();
            this.ctx.fill();
            
            this.ctx.restore();
        });
        
        // Draw grenades
        this.grenades.forEach(grenade => {
            this.ctx.fillStyle = grenade.color;
            this.ctx.beginPath();
            this.ctx.arc(grenade.x, grenade.y, grenade.size, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Draw grenade fuse indicator
            const fusePercent = grenade.timer / 60;
            this.ctx.strokeStyle = fusePercent > 0.5 ? '#00FF00' : fusePercent > 0.25 ? '#FFFF00' : '#FF0000';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(grenade.x, grenade.y, grenade.size + 2, 0, Math.PI * 2);
            this.ctx.stroke();
        });
        
        // Draw explosions
        this.explosions.forEach(explosion => {
            const alpha = explosion.timer / explosion.maxTimer; // Fade out over time
            
            // Draw expanding star explosion
            this.ctx.save();
            this.ctx.translate(explosion.x, explosion.y);
            
            // Draw multiple star layers for more dramatic effect
            for (let layer = 0; layer < 3; layer++) {
                const layerRadius = explosion.currentRadius * (1 - layer * 0.2);
                const layerAlpha = alpha * (0.8 - layer * 0.2);
                
                this.ctx.fillStyle = `rgba(255, ${50 + layer * 50}, 0, ${layerAlpha})`;
                this.ctx.strokeStyle = `rgba(255, ${100 + layer * 50}, 0, ${layerAlpha})`;
                this.ctx.lineWidth = 3 - layer;
                
                // Draw star shape
                this.ctx.beginPath();
                const spikes = 8;
                const outerRadius = layerRadius;
                const innerRadius = layerRadius * 0.4;
                
                for (let i = 0; i < spikes * 2; i++) {
                    const angle = (i * Math.PI) / spikes;
                    const radius = i % 2 === 0 ? outerRadius : innerRadius;
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    
                    if (i === 0) {
                        this.ctx.moveTo(x, y);
                    } else {
                        this.ctx.lineTo(x, y);
                    }
                }
                this.ctx.closePath();
                this.ctx.fill();
                this.ctx.stroke();
            }
            
            this.ctx.restore();
        });
        
        // Draw constantly spinning sword blades
        if (this.swordBlades.active) {
            const bladeCount = this.multiShot ? 3 : this.swordBlades.baseBladeCount;
            const radius = this.multiShot ? this.swordBlades.baseRadius * 1.25 : this.swordBlades.baseRadius;
            
            for (let i = 0; i < bladeCount; i++) {
                const angle = this.swordBlades.rotation + (i * Math.PI * 2) / bladeCount;
                const bladeStartX = this.player.x + Math.cos(angle) * (radius - this.swordBlades.bladeLength);
                const bladeStartY = this.player.y + Math.sin(angle) * (radius - this.swordBlades.bladeLength);
                const bladeEndX = this.player.x + Math.cos(angle) * radius;
                const bladeEndY = this.player.y + Math.sin(angle) * radius;
                
                // Calculate points for sharp-ended blade
                const bladeWidth = 3;
                const perpAngle = angle + Math.PI / 2;
                const sharpTipX = this.player.x + Math.cos(angle) * (radius + 3); // Extend past radius for sharp point
                const sharpTipY = this.player.y + Math.sin(angle) * (radius + 3);
                
                // Draw blade body with gunmetal gray
                this.ctx.fillStyle = 'rgba(96, 108, 117, 0.9)'; // Gunmetal gray
                this.ctx.strokeStyle = 'rgba(128, 138, 145, 0.9)'; // Lighter gunmetal for edge
                this.ctx.lineWidth = 1;
                
                this.ctx.beginPath();
                // Create sharp-ended blade shape
                this.ctx.moveTo(bladeStartX + Math.cos(perpAngle) * bladeWidth, bladeStartY + Math.sin(perpAngle) * bladeWidth);
                this.ctx.lineTo(bladeStartX - Math.cos(perpAngle) * bladeWidth, bladeStartY - Math.sin(perpAngle) * bladeWidth);
                this.ctx.lineTo(bladeEndX - Math.cos(perpAngle) * (bladeWidth * 0.3), bladeEndY - Math.sin(perpAngle) * (bladeWidth * 0.3));
                this.ctx.lineTo(sharpTipX, sharpTipY); // Sharp point
                this.ctx.lineTo(bladeEndX + Math.cos(perpAngle) * (bladeWidth * 0.3), bladeEndY + Math.sin(perpAngle) * (bladeWidth * 0.3));
                this.ctx.closePath();
                this.ctx.fill();
                this.ctx.stroke();
                
                // Draw sword hilt/guard with darker gunmetal
                const guardAngle = angle + Math.PI / 2;
                const guardSize = 6;
                const guardX1 = bladeStartX + Math.cos(guardAngle) * guardSize;
                const guardY1 = bladeStartY + Math.sin(guardAngle) * guardSize;
                const guardX2 = bladeStartX - Math.cos(guardAngle) * guardSize;
                const guardY2 = bladeStartY - Math.sin(guardAngle) * guardSize;
                
                this.ctx.strokeStyle = 'rgba(64, 72, 77, 0.9)'; // Darker gunmetal
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.moveTo(guardX1, guardY1);
                this.ctx.lineTo(guardX2, guardY2);
                this.ctx.stroke();
                
                // Add blade highlight
                this.ctx.strokeStyle = 'rgba(160, 170, 177, 0.7)'; // Light gunmetal highlight
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.moveTo(bladeStartX, bladeStartY);
                this.ctx.lineTo(sharpTipX, sharpTipY);
                this.ctx.stroke();
            }
        }
        
        // Draw sword swings (legacy effects)
        this.swordSwings.forEach(swing => {
            const alpha = swing.timer / swing.maxTimer;
            
            // Draw swing radius indicator (faded)
            this.ctx.strokeStyle = `rgba(255, 255, 0, ${alpha * 0.3})`;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(swing.x, swing.y, swing.radius, 0, Math.PI * 2);
            this.ctx.stroke();
        });
        
        // Draw monsters
        this.monsters.forEach(monster => {
            this.drawMonster(monster);
        });
        
        // Draw powerups
        this.powerups.forEach(powerup => {
            // Draw emoji directly without background circle
            this.ctx.font = '24px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(powerup.emoji, powerup.x, powerup.y);
        });
        
        // Powerup status now shown in top bar instead of on playing field
        
        // Draw game over screen
        if (this.gameOver) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.fillStyle = '#FF4444';
            this.ctx.font = '48px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('GAME OVER!', this.canvas.width / 2, this.canvas.height / 2 - 80);
            
            // Display which monster killed the player
            if (this.killedByMonster) {
                // Draw the monster that killed the player
                this.ctx.save();
                this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2 - 10);
                this.ctx.scale(1.5, 1.5); // Make it bigger for visibility
                const tempMonster = {
                    ...this.killedByMonster,
                    x: 0,
                    y: 0
                };
                this.drawMonster(tempMonster);
                this.ctx.restore();
            }
            
            this.ctx.fillStyle = 'white';
            this.ctx.font = '24px Arial';
            this.ctx.fillText(`Killed by: ${this.killedByMonster.name}`, this.canvas.width / 2, this.canvas.height / 2 - 40);
            
            // Draw restart button
            this.drawRestartButton();
        }
        
        // Draw version info at bottom of screen
        this.drawVersionInfo();
    }
    
    drawTopBorderBar() {
        // Draw top border bar (this will be called from HTML)
        const barHeight = 60;
        const barWidth = this.canvas.width;
        
        // Create a separate canvas for the top bar
        const topBarCanvas = document.createElement('canvas');
        topBarCanvas.width = barWidth;
        topBarCanvas.height = barHeight;
        const topBarCtx = topBarCanvas.getContext('2d');
        
        // Background
        topBarCtx.fillStyle = '#2C3E50';
        topBarCtx.fillRect(0, 0, barWidth, barHeight);
        
        // Border
        topBarCtx.strokeStyle = '#34495E';
        topBarCtx.lineWidth = 3;
        topBarCtx.strokeRect(0, 0, barWidth, barHeight);
        
        // Level
        topBarCtx.fillStyle = '#ECF0F1';
        topBarCtx.font = 'bold 20px Arial';
        topBarCtx.textAlign = 'left';
        topBarCtx.fillText(`Level: ${this.level}`, 20, 25);
        
        // Score
        topBarCtx.fillStyle = '#F39C12';
        topBarCtx.font = 'bold 18px Arial';
        topBarCtx.textAlign = 'center';
        topBarCtx.fillText(`Score: ${this.score}`, barWidth / 2, 25);
        
        // Monsters Killed
        topBarCtx.fillStyle = '#E74C3C';
        topBarCtx.font = 'bold 18px Arial';
        topBarCtx.textAlign = 'center';
        topBarCtx.fillText(`Kills: ${this.monstersKilled}`, barWidth / 2, 45);
        
        // Active Powerups
        let powerupText = '';
        if (this.multiShot) powerupText += 'M ';
        if (this.rapidFire) powerupText += 'R ';
        if (this.invincible) powerupText += 'I ';
        
        if (powerupText) {
            topBarCtx.fillStyle = '#9B59B6';
            topBarCtx.font = 'bold 16px Arial';
            topBarCtx.textAlign = 'right';
            topBarCtx.fillText(`Powerups: ${powerupText}`, barWidth - 20, 35);
        }
        
        return topBarCanvas;
    }
    
    drawPowerupStatus() {
        // Draw powerup status in-game
        if (this.multiShot || this.rapidFire || this.invincible || this.freeze) {
            const activePowerups = [this.multiShot, this.rapidFire, this.invincible, this.freeze].filter(Boolean).length;
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(10, 10, 200, 20 + activePowerups * 20);
            
            this.ctx.fillStyle = '#FFF';
            this.ctx.font = '14px Arial';
            this.ctx.textAlign = 'left';
            
            let y = 30;
            if (this.multiShot) {
                this.ctx.fillText(`Multi-Shot: ${Math.ceil(this.powerupTimers.multiShot / 60)}s`, 20, y);
                y += 20;
            }
            if (this.rapidFire) {
                this.ctx.fillText(`Rapid Fire: ${Math.ceil(this.powerupTimers.rapidFire / 60)}s`, 20, y);
                y += 20;
            }
            if (this.invincible) {
                this.ctx.fillText(`Invincible: ${Math.ceil(this.powerupTimers.invincible / 60)}s`, 20, y);
                y += 20;
            }
            if (this.freeze) {
                this.ctx.fillText(`Freeze: ${Math.ceil(this.powerupTimers.freeze / 60)}s`, 20, y);
            }
        }
    }
    

    
    drawPlayerHealth() {
        // Draw hearts above the player
        const heartSize = 8;
        const heartSpacing = 12;
        const startX = this.player.x - (this.player.maxHealth - 1) * heartSpacing / 2;
        const heartY = this.player.y - 30;
        
        this.ctx.font = `${heartSize}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        for (let i = 0; i < this.player.maxHealth; i++) {
            const heartX = startX + i * heartSpacing;
            if (i < this.player.health) {
                // Full heart
                this.ctx.fillText('❤️', heartX, heartY);
            } else {
                // Empty heart
                this.ctx.fillText('🤍', heartX, heartY);
            }
        }
    }
    
    drawVersionInfo() {
        // Draw version information at the bottom of the screen
        this.ctx.save();
        
        // Set up text style
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'right';
        this.ctx.textBaseline = 'bottom';
        
        // Draw version and build date
        const versionText = `v${this.version}`;
        const buildText = `Build: ${this.buildDate}`;
        
        // Position at bottom right corner
        const padding = 10;
        const lineHeight = 14;
        
        this.ctx.fillText(versionText, this.canvas.width - padding, this.canvas.height - padding - lineHeight);
        this.ctx.fillText(buildText, this.canvas.width - padding, this.canvas.height - padding);
        
        this.ctx.restore();
    }
    
    drawRestartButton() {
        const buttonWidth = 150;
        const buttonHeight = 50;
        const buttonX = this.canvas.width / 2 - buttonWidth / 2;
        const buttonY = this.canvas.height / 2 + 50;
        
        // Store button bounds for click detection
        this.restartButton = {
            x: buttonX,
            y: buttonY,
            width: buttonWidth,
            height: buttonHeight
        };
        
        // Draw button background
        this.ctx.fillStyle = '#4CAF50';
        this.ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
        
        // Draw button border
        this.ctx.strokeStyle = '#45a049';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);
        
        // Draw button text
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('Restart', buttonX + buttonWidth / 2, buttonY + buttonHeight / 2);
    }
    
    update() {
        if (this.gameOver) return;
        
        this.updatePlayer();
        this.updateBullets();
        this.updateMissiles();
        this.updateGrenades();
        this.updateSwordSwings();
        this.updateSwordBlades();
        this.updateExplosions();
        this.updateMonsters();
        this.updatePowerups();
        this.updateFlashEffect(); // Update flash effect
        this.checkCollisions();
        this.checkLevelUp(); // Check for level up
        
        // Update weapon cooldowns
        Object.keys(this.weaponCooldowns).forEach(weapon => {
            if (this.weaponCooldowns[weapon] > 0) {
                this.weaponCooldowns[weapon]--;
            }
        });
        
        // Update sword rotation for visual effect
        this.swordRotation += 0.2;
        
        // Update manual shooting cooldown
        if (this.manualShootCooldown > 0) {
            this.manualShootCooldown--;
        }
        
        // Auto-shoot
        this.autoShootCounter++;
        const shootRate = this.rapidFire ? this.autoShootRate / 3 : this.autoShootRate;
        if (this.autoShootCounter >= shootRate) {
            this.autoShoot();
            this.autoShootCounter = 0;
        }
        
        // Spawn monsters
        this.monsterSpawnCounter++;
        
        // Always maintain at least 2 monsters - spawn immediately if below threshold
        if (this.monsters.length < 2) {
            this.spawnMonster();

        } else if (this.monsterSpawnCounter >= this.monsterSpawnRate) {
            // Normal timer-based spawning when we have enough monsters
            this.spawnMonster();
            this.monsterSpawnCounter = 0;
        }
        
        // Spawn powerups occasionally
        if (Math.random() < 0.001) { // 0.1% chance per frame
            this.spawnPowerup();
        }
    }
    
    gameLoop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }

    activateBomb() {
        // Deal damage to all monsters on screen
        for (let i = this.monsters.length - 1; i >= 0; i--) {
            const monster = this.monsters[i];
            monster.health -= this.bombDamage;
            monster.healingTimer = 0; // Reset healing timer when damaged
            
            // Remove monster if it dies from bomb damage
            if (monster.health <= 0) {
                this.score += monster.points;
                this.monstersKilled++;
                this.sounds.monsterDeath();
                this.monsters.splice(i, 1);
                
                // Check if boss monster drops powerup
                this.checkBossPowerupDrop(monster);
            }
        }
        this.updateUI();
        
        // Activate red flash effect
        this.flashEffect.active = true;
        this.flashEffect.timer = this.flashEffect.duration;
        
        // Play boom sound
        this.sounds.boom();
    }
    
    updateFlashEffect() {
        if (this.flashEffect.active) {
            this.flashEffect.timer--;
            if (this.flashEffect.timer <= 0) {
                this.flashEffect.active = false;
            }
        }
    }
    
    checkLevelUp() {
        // Calculate required score for current level
        // Level 2: 20 points, Level 3: 50 points (20+30), Level 4: 90 points (20+30+40), etc.
        let requiredScore = 0;
        for (let i = 2; i <= this.level + 1; i++) {
            requiredScore += (i - 1) * 10; // 20, 30, 40, 50, etc.
        }
        
        if (this.score >= requiredScore) {
            this.level++;
            // Increase difficulty
            this.monsterSpawnRate = 110 - this.level;

            this.sounds.levelUp();
        }
    }
    
    checkBossPowerupDrop(monster) {
        // Only boss aura monsters drop powerups
        const bossTypes = ['elite', 'legendary', 'mythic', 'ancient', 'ultimate'];
        if (!bossTypes.includes(monster.shape)) {
            return; // Not a boss monster
        }
        
        // Different drop chances based on boss tier
        let dropChance = 0;
        switch(monster.shape) {
            case 'elite':
                dropChance = 0.20;
                break;
            case 'legendary':
                dropChance = 0.40;
                break;
            case 'mythic':
                dropChance = 0.60;
                break;
            case 'ancient':
                dropChance = 0.80;
                break;
            case 'ultimate':
                dropChance = 1.0; 
                break;
        }
        
        if (Math.random() < dropChance) {
            // Drop a powerup at monster's location
            this.spawnPowerup(monster.x, monster.y);
        }
    }
    
    getBackgroundColor() {
        // Gradual color transitions from level 1 to 100
        const baseHue = (this.level - 1) * 3.6; // 360 degrees / 100 levels = 3.6 degrees per level
        const saturation = Math.min(50 + (this.level - 1) * 0.5, 100); // Increase saturation gradually
        const lightness = Math.max(70 - (this.level - 1) * 0.3, 20); // Decrease lightness gradually
        
        return `hsl(${baseHue}, ${saturation}%, ${lightness}%)`;
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new Game();
});
