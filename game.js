const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// РЕСУРСЫ
const IMAGES = {};
const UI_IMAGES = {
    blackhole: 'image/blackhole.png',
    rocket: 'image/rocet.png',
    bigrocket: 'image/bigrocet.png',
    spring1: 'image/spring1.png',
    spring2: 'image/spring2.png',
    bigspring1: 'image/bigspring1.png',
    bigspring2: 'image/bigspring2.png',
    vika: 'vika.png'
};

function loadImages() {
    Object.entries(UI_IMAGES).forEach(([name, src]) => {
        const img = new Image();
        img.src = src;
        IMAGES[name] = img;
    });
}
loadImages();

// ПАРАМЕТРЫ
const PLAT_W = 75, PLAT_H = 15;
const GRAVITY = 0.38, JUMP_FORCE = -12.5;

const PT = { NORMAL: 0, LOOSE: 1, FRAGILE: 2, LIFT: 3, STAR: 4 };
const BT = { SPRING: 0, BIGSPRING: 1, ROCKET: 2, MAGNET: 3, COIN: 4, BLACKHOLE: 5 };

const SKINS = [
    { id: 'red', char: '❤️', title: 'Классика', type: 'emoji', req: 0 },
    { id: 'pink', char: '💕', title: 'Нежность', type: 'emoji', req: 500, reqType: 'best' },
    { id: 'cat', char: '😻', title: 'Котик', type: 'emoji', req: 5000, reqType: 'total' },
    { id: 'sun', char: '☀️', title: 'Солнышко', type: 'emoji', req: 20000, reqType: 'total' },
    { id: 'queen', char: '👑', title: 'Королева', type: 'emoji', req: 100000, reqType: 'total' },
    { id: 'vika', char: 'vika.png', title: 'Лучшая девочка', type: 'image', req: 500000, reqType: 'total' }
];

const BACKGROUNDS = [
    { id: 'default', title: 'Рассвет', class: 'bg-default', price: 0 },
    { id: 'night', title: 'Полночь', class: 'bg-night', price: 50 },
    { id: 'sunset', title: 'Закат', class: 'bg-sunset', price: 150 },
    { id: 'space', title: 'Космос', class: 'bg-space', price: 500 }
];

const ACHIEVEMENTS = [
    { id: 'b100', icon: '🌸', title: 'Первые шаги', desc: '100 метров за раз', req: 100, type: 'best' },
    { id: 'b500', icon: '🌙', title: 'Почти космос', desc: '500 метров за раз', req: 500, type: 'best' },
    { id: 'b1000', icon: '🌌', title: 'Легенда', desc: '1000 метров за раз', req: 1000, type: 'best' },
    { id: 't10k', icon: '🎈', title: 'Прыгучая', desc: '10,000 очков в сумме', req: 10000, type: 'total' },
    { id: 't100k', icon: '🔥', title: 'Огненная', desc: '100,000 очков в сумме', req: 100000, type: 'total' },
    { id: 't500k', icon: '👑', title: 'Моя Вселенная', desc: '500,000 очков в сумме', req: 500000, type: 'total' }
];

const COMPLIMENTS = [
    "Ты умничка! 💕", "Моё солнышко! ☀️", "Ты лучшая! 👑", "Обожаю тебя! ✨"
];

// СОСТОЯНИЕ
let score = 0, currentH = 0, bonusS = 0;
let bestScore = parseInt(localStorage.getItem('hj_best') || '0');
let totalScore = parseInt(localStorage.getItem('hj_total') || '0');
let coins = parseInt(localStorage.getItem('hj_coins') || '0');
let unlockedAchs = JSON.parse(localStorage.getItem('hj_achs') || '[]');
let ownedBgs = JSON.parse(localStorage.getItem('hj_owned_bgs') || '["default"]');
let currentSkin = localStorage.getItem('hj_skin') || 'red';
let currentBg = localStorage.getItem('hj_bg') || 'default';

let gameState = 'menu', cameraY = 0, tilt = 0;
let player, platforms, items, floatingTexts, discardedRockets = [];
let rocketActive = false, rocketTimer = 0;
let magnetTimer = 0, magnetMax = 500;

function resize() {
    canvas.width = Math.min(window.innerWidth, 430);
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

window.addEventListener('deviceorientation', e => {
    if (e.gamma !== null) tilt = Math.max(-1, Math.min(1, e.gamma / 22));
});

function startGame() {
    score = 0; currentH = 0; bonusS = 0; cameraY = 0;
    rocketActive = false; magnetTimer = 0; discardedRockets = [];
    platforms = []; items = []; floatingTexts = [];
    player = { x: canvas.width/2 - 20, y: canvas.height - 150, w: 40, h: 40, vx: 0, vy: JUMP_FORCE };
    platforms.push({ x: canvas.width/2 - PLAT_W/2, y: canvas.height - 100, type: PT.NORMAL, opacity: 1, used: false });
    for (let i = 0; i < 15; i++) spawnPlatform(canvas.height - 200 - (i * 85));
    gameState = 'playing';
    document.body.className = BACKGROUNDS.find(b => b.id === currentBg).class;
    showScreen('none');
    document.getElementById('hud').style.display = 'block';
    document.getElementById('coin-hud').style.display = 'flex';
    updateHUD();
}

function spawnPlatform(y) {
    const x = Math.random() * (canvas.width - PLAT_W - 20) + 10;
    let type = PT.NORMAL;
    if (currentH > 100) {
        const r = Math.random();
        if (r < 0.15) type = PT.LIFT;
        else if (r < 0.25) type = PT.FRAGILE;
        else if (r < 0.35) type = PT.LOOSE;
    }
    if (Math.random() < 0.08) type = PT.STAR;
    const p = { x, y, type, used: false, opacity: 1, side: Math.random() < 0.5 ? 1 : -1, speed: 1.5 + Math.random() };
    platforms.push(p);

    if (Math.random() < 0.25) {
        let itype = BT.COIN;
        const roll = Math.random();
        if (roll < 0.4) {
            const b = Math.random();
            if (b < 0.3) itype = BT.SPRING;
            else if (b < 0.5) itype = BT.BIGSPRING;
            else if (b < 0.8) itype = BT.ROCKET;
            else itype = BT.MAGNET;
        }
        items.push({ parent: p, offX: PLAT_W/2 - 15, offY: -32, type: itype, active: true, state: 1 });
    }
    if (currentH > 350 && Math.random() < 0.04) {
        items.push({ x: Math.random() * (canvas.width - 60), y: y - 120, type: BT.BLACKHOLE, active: true });
    }
}

function update() {
    if (gameState !== 'playing') return;
    player.vx = tilt * 10;

    if (rocketActive) {
        player.vy = -16;
        rocketTimer--;
        if (rocketTimer <= 0) {
            rocketActive = false;
            // Отбрасываем ракету
            discardedRockets.push({ x: player.x - 44, y: player.y - 70, vx: 5, vy: 2, rot: 0 });
            player.vy = JUMP_FORCE; // Небольшой прыжок в конце
        }
    } else {
        player.vy += GRAVITY;
    }

    player.x += player.vx;
    player.y += player.vy;

    if (player.x > canvas.width) player.x = -player.w;
    if (player.x < -player.w) player.x = canvas.width;

    if (player.y < cameraY + canvas.height * 0.4) cameraY = player.y - canvas.height * 0.4;

    let h = Math.floor(Math.abs(cameraY) / 15);
    if (h > currentH) currentH = h;
    score = currentH + bonusS;
    updateHUD();

    if (magnetTimer > 0) {
        magnetTimer--;
        document.getElementById('magnet-bar-container').style.display = 'block';
        document.getElementById('magnet-bar').style.width = (magnetTimer / magnetMax * 100) + '%';
        if (magnetTimer <= 0) document.getElementById('magnet-bar-container').style.display = 'none';
    }

    platforms.forEach(p => {
        if (p.type === PT.LIFT) {
            p.x += p.side * p.speed;
            if (p.x < 5 || p.x > canvas.width - PLAT_W - 5) p.side *= -1;
        }
        if (p.used) {
            if (p.type === PT.FRAGILE) p.opacity -= 0.05;
            if (p.type === PT.LOOSE) p.y += 10;
        }
        if (player.vy > 0 && p.opacity > 0.5 && player.x + 10 < p.x + PLAT_W && player.x + player.w - 10 > p.x && 
            player.y + player.h > p.y && player.y + player.h < p.y + PLAT_H + player.vy) {
            player.y = p.y - player.h; player.vy = JUMP_FORCE;
            if (p.type === PT.STAR && !p.used) addBonus(50, p.x + PLAT_W/2, p.y, "+50 💕");
            p.used = true;
        }
    });

    items.forEach(it => {
        if (!it.active) return;
        if (it.parent) { it.x = it.parent.x + it.offX; it.y = it.parent.y + it.offY; }
        if (magnetTimer > 0 && it.type === BT.COIN) {
            let dx = player.x - it.x, dy = player.y - it.y;
            let dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < 250) { it.parent = null; it.x += dx * 0.2; it.y += dy * 0.2; }
        }
        let hitW = (it.type === BT.BLACKHOLE) ? 60 : 35;
        if (player.x < it.x + hitW && player.x + player.w > it.x && player.y < it.y + hitW && player.y + player.h > it.y) {
            handlePickup(it);
        }
    });

    discardedRockets.forEach((r, i) => { r.x += r.vx; r.y += r.vy; r.rot += 0.1; if (r.y - cameraY > canvas.height + 200) discardedRockets.splice(i, 1); });
    floatingTexts.forEach((t, i) => { t.y -= 2; t.life -= 0.02; if (t.life <= 0) floatingTexts.splice(i, 1); });
    platforms = platforms.filter(p => p.y - cameraY < canvas.height + 100 && p.opacity > 0.05);
    items = items.filter(it => it.active && it.y - cameraY < canvas.height + 100);
    if (platforms.length < 18) spawnPlatform(platforms[platforms.length-1].y - 85);
    if (player.y - cameraY > canvas.height + 100) endGame("Ты умничка! 💕");
}

function handlePickup(it) {
    if (it.type === BT.BLACKHOLE) return endGame("Черная дыра засосала... 🌌");
    if (it.type === BT.COIN) { it.active = false; coins++; addBonus(0, it.x, it.y, "+1 💰"); }
    if (it.type === BT.SPRING && player.vy > 0) { player.vy = -18; it.state = 2; setTimeout(()=>it.active=false, 500); }
    if (it.type === BT.BIGSPRING && player.vy > 0) { player.vy = -26; it.state = 2; setTimeout(()=>it.active=false, 500); }
    if (it.type === BT.ROCKET) { it.active = false; rocketActive = true; rocketTimer = 220; }
    if (it.type === BT.MAGNET) { it.active = false; magnetTimer = magnetMax; }
}

function endGame(msg) {
    gameState = 'gameover'; totalScore += score;
    localStorage.setItem('hj_total', totalScore); localStorage.setItem('hj_coins', coins);
    if (score > bestScore) { bestScore = score; localStorage.setItem('hj_best', bestScore); }
    checkAchievements();
    document.getElementById('go-title').textContent = COMPLIMENTS[Math.floor(Math.random() * COMPLIMENTS.length)];
    document.getElementById('go-msg').innerHTML = `Ты пролетела <b>${score}</b> метров!`;
    document.getElementById('hud').style.display = 'none';
    document.getElementById('magnet-bar-container').style.display = 'none';
    showScreen('gameover-screen');
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (gameState === 'playing' || gameState === 'gameover') {
        platforms.forEach(p => {
            ctx.save(); ctx.globalAlpha = p.opacity;
            ctx.fillStyle = ['#ff5fa0', '#f093fb', '#a18cd1', '#4facfe', '#ffd700'][p.type];
            if (p.type === PT.STAR && p.used) ctx.fillStyle = '#555';
            ctx.beginPath(); ctx.roundRect(p.x, p.y - cameraY, PLAT_W, PLAT_H, 8); ctx.fill(); ctx.restore();
        });
        items.forEach(it => {
            let y = it.y - cameraY;
            if (it.type === BT.COIN) { ctx.fillStyle = '#ffd700'; ctx.beginPath(); ctx.arc(it.x + 15, y + 15, 12, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '900 14px Nunito'; ctx.fillText('$', it.x+10, y+20); }
            else if (it.type === BT.BLACKHOLE) ctx.drawImage(IMAGES.blackhole, it.x, y, 70, 70);
            else if (it.type === BT.SPRING) ctx.drawImage(it.state === 1 ? IMAGES.spring1 : IMAGES.spring2, it.x, y, 35, 35);
            else if (it.type === BT.BIGSPRING) ctx.drawImage(it.state === 1 ? IMAGES.bigspring1 : IMAGES.bigspring2, it.x, y, 42, 42);
            else if (it.type === BT.ROCKET) ctx.drawImage(IMAGES.rocket, it.x, y, 35, 35);
            else if (it.type === BT.MAGNET) { ctx.font = '30px serif'; ctx.fillText('🧲', it.x, y + 30); }
        });
        discardedRockets.forEach(r => { ctx.save(); ctx.translate(r.x + 64, r.y - cameraY + 92); ctx.rotate(r.rot); ctx.drawImage(IMAGES.bigrocket, -64, -92, 128, 185); ctx.restore(); });
        ctx.globalAlpha = 1.0;
        let px = player.x + player.w/2, py = player.y - cameraY + player.h/2;
        if (rocketActive) { ctx.drawImage(IMAGES.bigrocket, player.x - 44, player.y - cameraY - 70, 128, 185); drawCharacter(px, py - 18, 0.45); }
        else drawCharacter(px, py, 1.0);
        floatingTexts.forEach(t => { ctx.globalAlpha = t.life; ctx.fillStyle = '#fff'; ctx.font = 'bold 22px Nunito'; ctx.fillText(t.text, t.x - 10, t.y - cameraY); });
    }
    requestAnimationFrame(draw);
}

function drawCharacter(x, y, scale) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    const skin = SKINS.find(s => s.id === currentSkin);
    if (skin.type === 'emoji') { ctx.font = '45px serif'; ctx.textAlign = 'center'; ctx.fillText(skin.char, 0, 15); }
    else { ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI*2); ctx.clip(); ctx.drawImage(IMAGES.vika, -22, -22, 44, 44); }
    ctx.restore();
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    if (id !== 'none') document.getElementById(id).style.display = 'flex';
    if (id === 'skins-screen') renderList('skins-grid', SKINS, 'hj_skin');
    if (id === 'bg-screen') { renderList('bg-grid', BACKGROUNDS, 'hj_bg'); document.getElementById('shop-coin-val').textContent = coins; }
    if (id === 'ach-screen') renderAchievements();
}

function updateHUD() {
    document.getElementById('score-val').textContent = score;
    document.getElementById('best-val').textContent = bestScore;
    document.getElementById('sum-val').textContent = totalScore.toLocaleString();
    document.getElementById('coin-val').textContent = coins;
}

function renderList(containerId, list, storageKey) {
    const container = document.getElementById(containerId); container.innerHTML = '';
    list.forEach(item => {
        let locked = (item.reqType === 'best' && bestScore < item.req) || (item.reqType === 'total' && totalScore < item.req);
        let owned = (containerId === 'bg-grid') ? ownedBgs.includes(item.id) : !locked;
        const div = document.createElement('div');
        div.className = `card ${locked ? 'locked' : ''} ${(item.id === currentSkin || item.id === currentBg) ? 'selected' : ''}`;
        let icon = locked ? '🔒' : (item.type === 'image' || containerId === 'bg-grid' ? '🖼️' : item.char);
        div.innerHTML = `<div class="card-icon">${icon}</div><div class="card-title">${locked ? '???' : item.title}</div><div class="card-price">${owned ? 'Получено' : item.price + ' 💰'}</div>`;
        div.onclick = () => {
            if (containerId === 'skins-grid' && !locked) { currentSkin = item.id; localStorage.setItem(storageKey, item.id); }
            else if (containerId === 'bg-grid') {
                if (owned) { currentBg = item.id; localStorage.setItem(storageKey, item.id); }
                else if (coins >= item.price) { coins -= item.price; ownedBgs.push(item.id); localStorage.setItem('hj_coins', coins); localStorage.setItem('hj_owned_bgs', JSON.stringify(ownedBgs)); }
            }
            renderList(containerId, list, storageKey); updateHUD();
        };
        container.appendChild(div);
    });
}

function renderAchievements() {
    const container = document.getElementById('ach-list'); container.innerHTML = '';
    ACHIEVEMENTS.forEach(a => {
        const unlocked = unlockedAchs.includes(a.id);
        container.innerHTML += `<div class="ach-item ${unlocked?'unlocked':''}"><div>${unlocked?a.icon:'❓'}</div><div><b>${unlocked?a.title:'???'}</b><br><small>${unlocked?a.desc:'Секрет'}</small></div></div>`;
    });
}

function checkAchievements() {
    ACHIEVEMENTS.forEach(a => {
        if (!unlockedAchs.includes(a.id) && ((a.type==='best'&&score>=a.req)||(a.type==='total'&&totalScore>=a.req))) {
            unlockedAchs.push(a.id); localStorage.setItem('hj_achs', JSON.stringify(unlockedAchs));
            const t = document.getElementById('ach-toast'); t.innerHTML = `🏆 <b>${a.title}</b>`; t.classList.add('show');
            setTimeout(() => t.classList.remove('show'), 3500);
        }
    });
}

function addBonus(pts, x, y, text) { bonusS += pts; floatingTexts.push({ x, y, text, life: 1 }); updateHUD(); }

setInterval(update, 1000/60); draw();
