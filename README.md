# BN-89

A dependency-free local two-player platform fighter. Open dist/index.html in a desktop browser. Menus and controls fit one screen; text uses original bitmap glyphs and SFX use Web Audio.

## Run and share

Open dist/index.html to play directly. To create a single-file offline version and an email-friendly ZIP, run:

    node scripts/build-download.cjs

The builder writes release/BN-89.html and release/BN-89.zip. Extract the ZIP and open BN-89.html; recipients need no installation or internet connection. Pass an output folder as the first argument to choose another location. The build embeds all game code, styles, and any referenced bundled audio assets. The local Music picker remains available.

Run node test.cjs for regression checks.

## Controls

BN: WASD, B attack, N shield. 89: arrows, physical numpad 8 attack, numpad 9 shield (either Num Lock setting). Jump from the ground, then use one spare jump in the air. Walking or dropping off a platform also leaves exactly one spare jump; being airborne never grants two jumps. Landing resets the budget. Press Down during a voluntary rising jump to immediately start falling for a short hop; this also works on the double jump. A tap preserves normal falling and holding Down fast-falls. Down cannot cancel hit knockback or recovery launches. Down also drops through one-way platforms. Double-tap a horizontal direction within 230 ms to sprint while held. Walking: 335 units/sec; sprinting: 535.

Menus: WASD/arrows navigate, Enter/Space selects, left/right changes settings. Escape pauses/resumes; R restarts during play. Settings persist locally. A lost-focus tab pauses gameplay and music.

## Combat

Lives are adjustable from 1 to 9 with a default of 3. Choose LIVES in the title menu and use left/right (A/D), or Enter to cycle. The chosen value is saved locally. NEXT LIVES in the pause menu applies to the next match/rematch only. Life counters and the HUD use the value captured when the match begins. Going offscreen costs a life. Each damage segment holds 100 damage. Ground weak punches add 5; aerial side punches add 7; strong, dash, up-air and down-air punches add 10; blocked melee and normal pellets add 2. Blocked projectiles add zero. Knockback scales with accumulated damage; at five full segments, only an unguarded strong punch gets the decisive finishing launch boost. Dash punches and charged shots retain normal scaled strong-punch knockback.

Horizontal attacks start on keydown, last at most 100 ms, and end on release. Shields last at most 280 ms and end on release. Minimum punch intervals: ground weak 180 ms; strong, side-air and down-air 240 ms; dash and up-air 420 ms. After the hitbox ends, attack recovery is 80 ms for weak punches, 140 ms for strong/side/down punches and 320 ms for dash/up punches. The minimum interval also applies to early releases. Shield cooldown: 400 ms. Actions are exclusive, with a 45 ms gap after an action ends. Input is not delayed or buffered. The 90 ms attack/shield chord atomically replaces the initial action with shooting. A hit already delivered by an immediate melee is retained.

Punch sequence: the first clean hit is a weak punch (5 damage, knockback scale 0.36 versus a pellet's 0.20). Another consecutive melee started within 2 seconds of that hit is strong (10 damage, full knockback), then the sequence resets. Misses, blocked punches, taking a clean hit, shielding, shooting, recovery, and respawning reset the sequence. A grounded sprint attack is a dash punch with strong-punch damage/knockback and a longer cooldown. Aerial attacks have fixed strengths and reset the ground sequence: side air is 7 damage at 0.50 knockback scale; up and down air are 10 damage at full knockback. Up air shares dash-punch recovery and adds 15% upward knockback without changing damage. Aerials do not receive the ground strong-punch finishing boost.

Vertical aerials: hold up/down and press attack in the air. Up aerials last at least 1.4 sec even after a tap, then persist while direction+attack are held. Down aerials commit for 250 ms; after that release either attack or down, or press shield or an available jump, to cancel. Holding both keeps the down aerial active. While holding down during a down aerial, fast-fall starts at 600 and caps at 1050 units/sec (normal fall cap 850; regular fast-fall cap 1700). Landing or an unblocked hit ends the aerial. Horizontal movement is capped at 85 units/sec. Each swing can hit the opponent once.

Projectiles: press attack+shield within 90 ms, with both keys held. Pellet cooldown: 200 ms. Holding the combo while grounded and stationary, or while freely falling, charges a large shot after 1.2 sec; it deals 10 damage and full melee knockback. Moving on the ground, releasing, or taking a clean hit interrupts charging. In the air, charging halves horizontal momentum once. Downward speed, falling gravity and fall-speed cap use 45% of normal (slightly gentler than the shield's 50%); the charge fall cap is 382.5 units/sec. Drift is preserved rather than stopped. Left/right changes which way the shot faces without steering the falling trajectory. Jumping and voluntary fall-speed changes stay locked while charging; landing preserves accumulated charge and allows existing momentum to ease away. Ground movement input after landing cancels charging, just like normal grounded charging; passive drift alone does not. Switching from an air shield into charging preserves half horizontal momentum and adjusts downward motion to the 45% charge scale without repeatedly halving it. Once charging has been held beyond the initial 90 ms chord window, pressing up cannot convert it into a recovery. Only one large shot fires per hold. The initial pellet still fires immediately. Two consecutive unblocked projectiles within 1.2 sec produce 600 ms hitstun. The second, stunning shot has only 15% of its normal knockback (an 85% reduction), while damage is unchanged. A blocked shot or melee hit resets the streak.

Dash shield: starting a shield while sprinting captures counter eligibility for that shield while preserving momentum. On the ground it decelerates with the same easing as releasing movement. In the air it halves horizontal momentum and downward speed once, then uses half falling gravity/cap until the shield ends. It does not repeatedly halve velocity each frame. Shields block voluntary movement, jumping and platform dropping. Releasing a direction does not remove the captured counter; releasing or expiring the shield does. Blocking melee adds the usual 2 damage but redirects blocked-hit knockback to the attacker, with zero attacker damage. The dash melee counter is separate from the pellet reflection rule.

Recovery: in the air, hold up and press the shoot combo (up can also be the last of the three keys). A dot appears above the character. Aim left/right for 500 ms while falling momentum, gravity and fall-speed cap are reduced by 20%, then launch automatically at speed 690 with an 80 ms burst. Landing during aiming cancels recovery and resets its availability. A recovery can be interrupted by hits, consuming it. Launch locks melee, shields, shots, jumps, air steering and fall-speed changes until landing. Landing or respawning resets recovery availability.

Air dash: double-tap left/right within 230 ms and press shield within 90 ms of the second tap while airborne. Shield may be pressed just before or after the second tap. Launch is immediate, horizontal at speed 640, with a fixed 140 ms burst followed by gravity. It shares recovery lockout: no melee, shield, shots, jump, second dash, recovery, steering or fall-speed change until landing. The 140 ms horizontal burst is invincible to melee and all projectiles. Protection ends exactly when gravity resumes, or sooner on landing. Projectiles pass through during invincibility. Hits during the subsequent freefall do not restore actions. This protection applies to air dash, not the aimed recovery. Ground double-tap plus shield remains a sliding dash shield.

Pellet reflection: the first shielded uncharged shot is absorbed. The second consecutive shielded uncharged shot within 1.2 sec returns toward its original shooter at 1.5 times its original speed (normally 1200 units/sec). Ownership transfers to the reflector. Damage remains 2 and later reflections do not compound speed. A clean incoming hit, melee, a shielded charged shot, or a timeout breaks the pair. Charged shots are absorbed and never reflected. Reflection causes no shield damage or recoil.

## Stage

The main platform has a solid 576-unit center and grey 72-unit one-way sections on both ends. The center blocks rising through its underside and lateral entry; it cannot be dropped through. Grey ends and the three upper platforms allow jumping up and dropping down. Landing works on every section. The arena camera is zoomed to 90% to show more outside space in every direction. The view is shifted down by 35 world units for additional room beneath the stage, with the lower knockout boundary extended to match and the upper knockout boundary preserved. HUD, menus and controls retain their size. Playable blast boundaries and projectile culling extend beyond the wider visible region.

## Palettes

Paper, Pocket, Amber, Ice, Berry, Sunset and Hell can be selected in the keyboard menu, with inversion available for every palette. Sunset pairs peach with plum silhouettes; Hell uses hot vermilion with deep red silhouettes. Existing palette selections retain their indices.

## Your own music

Select CHOOSE MUSIC on the title or pause screen, press Enter/Space, and choose a browser-supported audio file such as MP3 or WAV. The file loops through a dedicated music gain channel. MUSIC and SFX have separate toggles and 0-100 volume settings, adjusted in steps of 10 using left/right (A/D). Defaults are Music 25 and SFX 80. Both share a compressor; music briefly ducks during effects so they remain audible together. Volumes persist locally. The chosen file is saved with IndexedDB on this device/browser when storage is available; otherwise it lasts for this session. It is not uploaded to the hosted site or shared with other visitors. A keyboard interaction unlocks playback after reloading.

## Validation

Run `.tools/node.exe test.cjs` for combat/menu regression checks. The `.tools` directory is ignored and contains local development runtimes and browser QA artifacts only. Gameplay constants are in dist/game.js. No external font/audio assets or dependencies are needed.
