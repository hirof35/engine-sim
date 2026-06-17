// renderer.js

// --- 環境定数＆エンジン諸元 ---
const SEA_LEVEL_DENSITY = 1.225;
const ENGINE_CONFIG = {
    maxMilThrust: 50.0,
    maxAbThrust: 80.0,
    spoolTimeConstant: 0.15,
    milSfc: 0.8,
    abSfc: 1.8
};

// --- 初期状態 ---
let state = {
    throttle: 0.3,
    rpm: 30.0,
    thrust: 15.0,
    fuelFlow: 0.0,
    altitude: 0,
    mach: 0.0,
    isAbActive: false
};

// 履歴グラフ用バッファ
let thrustHistory = new Array(100).fill(0);

// --- UI要素の取得 ---
const inputThrottle = document.getElementById('input-throttle');
const inputAltitude = document.getElementById('input-altitude');
const inputMach = document.getElementById('input-mach');

const txtThrottle = document.getElementById('txt-throttle');
const txtAltitude = document.getElementById('txt-altitude');
const txtMach = document.getElementById('txt-mach');

const valRpm = document.getElementById('val-rpm');
const valThrust = document.getElementById('val-thrust');
const valFf = document.getElementById('val-ff');
const abLamp = document.getElementById('ab-lamp');

const canvas = document.getElementById('mfdCanvas');
const ctx = canvas.getContext('2d');

// --- 物理計算系 ---
function updateSimulation(dt) {
    // 入力値の同期
    state.throttle = inputThrottle.value / 100;
    state.altitude = parseFloat(inputAltitude.value);
    state.mach = parseFloat(inputMach.value);

    // テキスト表示の更新
    txtThrottle.innerText = inputThrottle.value;
    txtAltitude.innerText = inputAltitude.value;
    txtMach.innerText = state.mach.toFixed(2);

    // エンジン計算
    const altitudeEffect = Math.pow(1 - (2.25577e-5 * state.altitude), 4.25588);
    const airDensity = Math.max(0.1, SEA_LEVEL_DENSITY * altitudeEffect);
    const densityRatio = airDensity / SEA_LEVEL_DENSITY;
    const ramEffect = 1.0 + (state.mach * state.mach * 0.5);

    let targetRpm = 0;
    if (state.throttle <= 0.7) {
        targetRpm = (state.throttle / 0.7) * 100;
        state.isAbActive = false;
    } else {
        targetRpm = 100;
        state.isAbActive = true;
    }
    state.rpm += (targetRpm - state.rpm) * ENGINE_CONFIG.spoolTimeConstant;

    let baseThrust = 0;
    if (!state.isAbActive) {
        baseThrust = (state.rpm / 100) * ENGINE_CONFIG.maxMilThrust;
    } else {
        const abFactor = (state.throttle - 0.7) / 0.3;
        const extraThrust = abFactor * (ENGINE_CONFIG.maxAbThrust - ENGINE_CONFIG.maxMilThrust);
        baseThrust = ENGINE_CONFIG.maxMilThrust + extraThrust;
    }

    state.thrust = baseThrust * densityRatio * ramEffect;
    const sfc = state.isAbActive ? ENGINE_CONFIG.abSfc : ENGINE_CONFIG.milSfc;
    state.fuelFlow = (state.thrust * sfc) / 3600;

    // デジタル数値をUIに反映
    valRpm.innerText = state.rpm.toFixed(1);
    valThrust.innerText = state.thrust.toFixed(2);
    valFf.innerText = (state.fuelFlow * 3600).toFixed(0);

    if (state.isAbActive) {
        abLamp.classList.add('ab-active');
    } else {
        abLamp.classList.remove('ab-active');
    }

    // 履歴更新
    thrustHistory.shift();
    thrustHistory.push(state.thrust);
}

// --- Canvas描画系 (MFDグラフィック) ---
function drawMFD() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. 円形RPMゲージの描画
    const cx = 130, cy = 140, r = 80;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 0.8, Math.PI * 2.2);
    ctx.strokeStyle = '#004411';
    ctx.lineWidth = 10;
    ctx.stroke();

    // アクティブな針・目盛り
    const rpmAngle = Math.PI * 0.8 + (state.rpm / 100) * (Math.PI * 1.4);
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 0.8, rpmAngle);
    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 10;
    ctx.stroke();

    ctx.fillStyle = '#00ff66';
    ctx.font = '14px Courier New';
    ctx.fillText("CORE RPM", cx - 35, cy - 15);
    ctx.font = '20px Courier New';
    ctx.fillText(`${state.rpm.toFixed(0)}%`, cx - 20, cy + 15);

    // 2. 推力バー（縦型タコメーター風）
    const bx = 340, by = 50, bw = 40, bh = 180;
    ctx.fillStyle = '#002200';
    ctx.fillRect(bx, by, bw, bh);
    
    const thrustHeight = Math.min(bh, (state.thrust / 100) * bh);
    // アフターバーナー作動時は推力バーをオレンジ/赤系にする
    ctx.fillStyle = state.isAbActive ? '#ff3333' : '#00ffff';
    ctx.fillRect(bx, by + bh - thrustHeight, bw, thrustHeight);

    // 枠線とラベル
    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = '#00ff66';
    ctx.font = '12px Courier New';
    ctx.fillText("THRUST", bx, by - 25);
    ctx.fillText("100kN-", bx + bw + 5, by + 10);
    ctx.fillText(" 50kN-", bx + bw + 5, by + bh/2 + 5);
    ctx.fillText("  0kN-", bx + bw + 5, by + bh);

    // 3. 推力リアルタイム履歴グラフ (下半分)
    const gx = 40, gy = 280, gw = 440, gh = 200;
    ctx.strokeStyle = '#004411';
    ctx.lineWidth = 1;
    ctx.strokeRect(gx, gy, gw, gh);
    // グリッド線（50kNのライン）
    ctx.beginPath();
    ctx.moveTo(gx, gy + gh / 2);
    ctx.lineTo(gx + gw, gy + gh / 2);
    ctx.strokeStyle = 'rgba(0, 255, 102, 0.2)';
    ctx.stroke();

    // 波形の描画
    ctx.beginPath();
    for(let i=0; i<thrustHistory.length; i++) {
        const x = gx + (i / (thrustHistory.length - 1)) * gw;
        const y = gy + gh - (thrustHistory[i] / 100) * gh;
        if(i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = state.isAbActive ? '#ff3333' : '#00ff66';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#00ff66';
    ctx.font = '12px Courier New';
    ctx.fillText("THRUST HISTORY (TIME LOG)", gx, gy - 10);
}

// --- メインループ (60FPSを目指す) ---
let lastTime = performance.now();
function loop() {
    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    updateSimulation(dt);
    drawMFD();

    requestAnimationFrame(loop);
}

// ループ開始
requestAnimationFrame(loop);