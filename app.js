import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { initializeFirestore, collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp, doc, updateDoc, increment, deleteDoc, setDoc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDJE3mYAvvOyrmL2riktXB-mdt0iH2iN5k",
  authDomain: "laoficina-81e4a.firebaseapp.com",
  projectId: "laoficina-81e4a",
  storageBucket: "laoficina-81e4a.firebasestorage.app",
  messagingSenderId: "733303320739",
  appId: "1:733303320739:web:b24a466bcad169c21c4f16"
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { experimentalForceLongPolling: true });
const auth = getAuth(app);

let currentUser = { uid: "", email: "", name: "", avatar: "", hp: 100, mutedUntil: 0, isAdmin: false, immunity: false };
let appInitialized = false;

const AVATAR_STYLES = ["pixel-art", "pixel-art-neutral", "bottts", "adventurer", "micah", "avataaars"]; 
const AVATAR_SEEDS = ["Felix", "Aneka", "Milo", "Luna", "Leo", "Nina", "Oscar", "Zoe", "Max", "Chloe", "Cristopher", "Esteban", "Carla", "Javi", "Elias", "Lornis"];

function avatarUrl(style, seed) {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=transparent`;
}

// DOM Genérico
const userProfile = document.getElementById("userProfile");
const headerAvatar = document.getElementById("headerAvatar");
const headerName = document.getElementById("headerName");
const logoutBtn = document.getElementById("logoutBtn");
const loginModal = document.getElementById("loginModal");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const chatForm = document.getElementById("chatForm");
const chatWidget = document.getElementById("chatWidget");
const chatHeader = document.getElementById("chatHeader");

// DOM Perfil y Admin
const profileModal = document.getElementById("profileModal");
const editNameInput = document.getElementById("editNameInput");
const avatarGrid = document.getElementById("avatarGrid");
const saveProfileBtn = document.getElementById("saveProfileBtn");
const adminBtn = document.getElementById("adminBtn");
const adminModal = document.getElementById("adminModal");
const adminImmunityBtn = document.getElementById("adminImmunityBtn");
const saveAdminConfigBtn = document.getElementById("saveAdminConfigBtn");
const adminMuteTime = document.getElementById("adminMuteTime");
const adminHpRegen = document.getElementById("adminHpRegen");
const adminMoneyLimit = document.getElementById("adminMoneyLimit");

// DOM Amigo Secreto
const ssContent = document.getElementById("ssContent");
const ssLimitDisplay = document.getElementById("ssLimitDisplay");

// Configuración global del juego (Valores por defecto seguros)
let gameConfig = { muteDuration: 60, hpRegen: 1, moneyLimit: 10000 };

// ============================================================
//  AUTENTICACIÓN Y PERFIL
// ============================================================
document.getElementById("googleLoginBtn")?.addEventListener("click", async () => {
  try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { alert(e.message); }
});
document.getElementById("loginEmailBtn")?.addEventListener("click", async () => {
  const e = document.getElementById("emailInput").value, p = document.getElementById("passwordInput").value;
  if(!e || !p) return alert("Completa los campos");
  try { await signInWithEmailAndPassword(auth, e, p); } catch (err) { alert(err.message); }
});
document.getElementById("registerEmailBtn")?.addEventListener("click", async () => {
  const e = document.getElementById("emailInput").value, p = document.getElementById("passwordInput").value;
  if(!e || !p) return alert("Completa los campos");
  try { await createUserWithEmailAndPassword(auth, e, p); } catch (err) { alert(err.message); }
});
logoutBtn?.addEventListener("click", () => { if(confirm("¿Salir?")) { signOut(auth); window.location.reload(); } });

onAuthStateChanged(auth, async (user) => {
  if (user) {
    loginModal.hidden = true;
    userProfile.hidden = false;
    
    currentUser.isAdmin = (user.email === 'crsph2@gmail.com');
    if(currentUser.isAdmin) adminBtn.hidden = false;

    const userDocRef = doc(db, "users_data", user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      const data = userDoc.data();
      currentUser = { ...currentUser, ...data, uid: user.uid, email: user.email };
      if (currentUser.hp === undefined) currentUser.hp = 100;
    } else {
      currentUser.uid = user.uid;
      currentUser.email = user.email;
      currentUser.name = user.displayName || user.email.split('@')[0];
      currentUser.avatar = user.photoURL || avatarUrl('pixel-art', user.email);
      currentUser.hp = 100;
      currentUser.mutedUntil = 0;
      currentUser.immunity = false;
      await setDoc(userDocRef, currentUser);
    }

    updateProfileUI();
    
    onSnapshot(doc(db, "game_config", "main"), (docSnap) => {
      if(docSnap.exists()) {
        gameConfig = { ...gameConfig, ...docSnap.data() };
        if(adminMuteTime) adminMuteTime.value = gameConfig.muteDuration;
        if(adminHpRegen) adminHpRegen.value = gameConfig.hpRegen;
        if(adminMoneyLimit) adminMoneyLimit.value = gameConfig.moneyLimit;
        if(ssLimitDisplay) ssLimitDisplay.textContent = `Límite: $${(gameConfig.moneyLimit || 10000).toLocaleString('es-CL')}`;
      } else if (currentUser.isAdmin) {
        setDoc(doc(db, "game_config", "main"), gameConfig);
      }
    });

    if (!appInitialized) {
      initRealtime();
      initOffice();
      initSecretSanta();
      appInitialized = true;
    }
  } else {
    loginModal.hidden = false;
    userProfile.hidden = true;
  }
});

function updateProfileUI() {
  if(headerAvatar) headerAvatar.src = currentUser.avatar;
  if(headerName) headerName.textContent = currentUser.name;
}

document.getElementById("changeAvatarBtn")?.addEventListener("click", () => {
  editNameInput.value = currentUser.name;
  buildAvatarPicker();
  profileModal.hidden = false;
});

saveProfileBtn?.addEventListener("click", async () => {
  const newName = editNameInput.value.trim();
  if(!newName) return alert("El nombre no puede estar vacío");
  currentUser.name = newName;
  await updateDoc(doc(db, "users_data", currentUser.uid), { name: newName, avatar: currentUser.avatar });
  updateProfileUI();
  savePosition();
  profileModal.hidden = true;
});

function buildAvatarPicker() {
  if(!avatarGrid) return;
  avatarGrid.innerHTML = "";
  AVATAR_STYLES.forEach((style) => {
    AVATAR_SEEDS.forEach((seed) => {
      const url = avatarUrl(style, seed);
      const img = document.createElement("img");
      img.src = url;
      img.className = "avatar-option";
      if(currentUser.avatar === url) img.classList.add("selected");
      img.addEventListener("click", () => {
        document.querySelectorAll(".avatar-option").forEach((el) => el.classList.remove("selected"));
        img.classList.add("selected");
        currentUser.avatar = url;
        if(headerAvatar) headerAvatar.src = url;
        updateDoc(doc(db, "users_data", currentUser.uid), { avatar: url });
        savePosition();
      });
      avatarGrid.appendChild(img);
    });
  });
}

// ============================================================
//  ADMINISTRACIÓN
// ============================================================
adminImmunityBtn?.addEventListener("click", async () => {
  currentUser.immunity = !currentUser.immunity;
  adminImmunityBtn.textContent = `🛡️ Inmunidad: ${currentUser.immunity ? 'ON' : 'OFF'}`;
  adminImmunityBtn.style.background = currentUser.immunity ? 'var(--success)' : 'var(--accent)';
  await updateDoc(doc(db, "users_data", currentUser.uid), { immunity: currentUser.immunity });
});

saveAdminConfigBtn?.addEventListener("click", async () => {
  const config = {
    muteDuration: parseInt(adminMuteTime.value) || 60,
    hpRegen: parseFloat(adminHpRegen.value) || 1,
    moneyLimit: parseInt(adminMoneyLimit.value) || 10000
  };
  await setDoc(doc(db, "game_config", "main"), config);
  adminModal.hidden = true;
  alert("Configuración guardada");
});

adminBtn?.addEventListener("click", () => {
  adminImmunityBtn.textContent = `🛡️ Inmunidad: ${currentUser.immunity ? 'ON' : 'OFF'}`;
  adminImmunityBtn.style.background = currentUser.immunity ? 'var(--success)' : 'var(--accent)';
  adminModal.hidden = false;
});

// ============================================================
//  AMIGO SECRETO
// ============================================================
let ssDrawn = false;
let mySSList = [];

function initSecretSanta() {
  onSnapshot(doc(db, "ss_config", "main"), (docSnap) => {
    if(docSnap.exists()) ssDrawn = docSnap.data().drawn;
    renderSS();
  }, (error) => { console.error("Error SS Config:", error); renderSS(); });
  
  onSnapshot(doc(db, "ss_lists", currentUser.uid), (docSnap) => {
    if(docSnap.exists()) mySSList = docSnap.data().gifts || [];
    else mySSList = [];
    renderSS();
  }, (error) => { console.error("Error SS List:", error); renderSS(); });
  
  onSnapshot(doc(db, "ss_results", currentUser.uid), (docSnap) => {
    renderSS(docSnap.exists() ? docSnap.data() : null);
  }, (error) => { console.error("Error SS Result:", error); });
}

async function renderSS(myResult = null) {
  if(!ssContent) return;
  try {
    ssContent.innerHTML = "";

    if (ssDrawn) {
      if (myResult) {
        const gifts = myResult.targetGifts || [];
        let giftsHTML = gifts.map(g => `<li>${g}</li>`).join("");
        if(gifts.length === 0) giftsHTML = "<li>No puso ideas de regalo 😢</li>";
        
        ssContent.innerHTML = `
          <div class="ss-card">
            <h3>🎅 Te toca regalar a:</h3>
            <p style="font-size: 1.5rem; font-weight: 800; color: var(--success); margin: 10px 0;">${myResult.targetName}</p>
            <p style="font-size: 0.9rem; color: var(--text-dim);">Límite sugerido: $${(gameConfig.moneyLimit || 10000).toLocaleString('es-CL')}</p>
            <div style="margin-top: 20px; text-align: left;">
              <h4 style="color: var(--accent); margin-bottom: 8px;">Lista de ideas de regalo:</h4>
              <ul class="ss-gift-list">${giftsHTML}</ul>
            </div>
          </div>
        `;
      } else {
        ssContent.innerHTML = `<div class="ss-card"><p>El sorteo ya se realizó. No participaste esta vez.</p></div>`;
      }
      return;
    }

    let giftListHTML = mySSList.map((g, i) => `
      <li><span>${g}</span> <button class="btn-delete-small" onclick="removeGift(${i})">×</button></li>
    `).join("");

    let adminControls = "";
    if (currentUser.isAdmin) {
      adminControls = `
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px dashed var(--border);">
          <p style="color: var(--danger); font-weight: bold; margin-bottom: 10px;">⚠️ Zona Admin</p>
          <button id="drawSSBtn" class="btn btn-primary" style="width: 100%;">🎲 Realizar Sorteo Ahora</button>
        </div>
      `;
    }

    ssContent.innerHTML = `
      <div class="ss-card">
        <h3>¡Participa en el Amigo Secreto!</h3>
        <p style="font-size: 0.9rem; margin-bottom: 15px;">Límite de regalo: <strong>$${(gameConfig.moneyLimit || 10000).toLocaleString('es-CL')}</strong></p>
        <form id="addGiftForm" class="inline-form">
          <input type="text" id="newGiftInput" placeholder="Ej: Taza de café, Chocolate..." maxlength="50" class="text-input" required />
          <button type="submit" class="btn btn-accent">Añadir</button>
        </form>
        <ul class="ss-gift-list" style="margin-top: 15px;">
          ${giftListHTML || '<li style="color:var(--text-dim); justify-content:center;">Aún no has agregado regalos.</li>'}
        </ul>
        ${adminControls}
      </div>
    `;

    document.getElementById("addGiftForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = document.getElementById("newGiftInput");
      if(!input.value.trim()) return;
      mySSList.push(input.value.trim());
      await setDoc(doc(db, "ss_lists", currentUser.uid), { uid: currentUser.uid, name: currentUser.name, gifts: mySSList });
    });

    document.getElementById("drawSSBtn")?.addEventListener("click", drawSecretSanta);
  } catch (err) {
    console.error("Error al renderizar Amigo Secreto:", err);
    ssContent.innerHTML = `<div class="ss-card"><p style="color:var(--danger);">Hubo un problema de conexión con el Amigo Secreto. Revisa los permisos de Firebase o recarga la página.</p></div>`;
  }
}

window.removeGift = async (index) => {
  mySSList.splice(index, 1);
  await setDoc(doc(db, "ss_lists", currentUser.uid), { gifts: mySSList });
};

async function drawSecretSanta() {
  if(!confirm("¿Estás seguro? Se asignarán los amigos secretos y no se podrá deshacer.")) return;
  
  const listsSnap = await getDocs(collection(db, "ss_lists"));
  let participants = [];
  listsSnap.forEach(d => participants.push(d.data()));

  if (participants.length < 3) return alert("Se necesitan al menos 3 personas para sortear.");

  let shuffled = [];
  let success = false;
  while(!success) {
    shuffled = [...participants].sort(() => Math.random() - 0.5);
    success = true;
    for (let i = 0; i < participants.length; i++) {
      if (participants[i].uid === shuffled[i].uid) { success = false; break; }
    }
  }

  for (let i = 0; i < participants.length; i++) {
    const giver = participants[i];
    const receiver = shuffled[i];
    await setDoc(doc(db, "ss_results", giver.uid), {
      targetUid: receiver.uid,
      targetName: receiver.name,
      targetGifts: receiver.gifts || []
    });
  }

  await setDoc(doc(db, "ss_config", "main"), { drawn: true });
  alert("¡Sorteo realizado! Cada persona ya puede ver a quién le regala.");
}

// ============================================================
//  OFICINA VIRTUAL, ARRASTRE Y FIX DE HP
// ============================================================
const officeCanvas = document.getElementById("officeCanvas");
const ctx = officeCanvas ? officeCanvas.getContext("2d") : null;
const canvasContainer = document.getElementById("canvasContainer");
const positionsCollection = collection(db, "positions");

let players = {}; 
let myPosition = { x: 400, y: 200 }; 
let targetPosition = null;
const PLAYER_SIZE = 32;
const MOVE_SPEED = 2.5;
const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
let lastAttackTime = 0;
let punchEffect = null; 

let isDragging = false;
let draggedPlayerId = null;

const avatarImageCache = {};
function getAvatarImage(url) {
  if (!avatarImageCache[url]) { const img = new Image(); img.src = url; avatarImageCache[url] = img; }
  return avatarImageCache[url];
}

function initOffice() {
  if(!officeCanvas) return;
  
  // SOLUCIÓN: Esperar a que el navegador pinte el layout antes de medir
  requestAnimationFrame(() => {
    setTimeout(resizeCanvas, 100);
  });
  window.addEventListener("resize", resizeCanvas);

  onSnapshot(positionsCollection, (snapshot) => {
    players = {}; 
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (docSnap.id === currentUser.uid) {
        if (data.hp !== undefined && data.hp < currentUser.hp && !currentUser.immunity) {
          currentUser.hp = data.hp;
        }
      } else {
        players[docSnap.id] = data;
      }
    });
  });

  setInterval(() => {
    if (currentUser.hp < 100) {
      currentUser.hp = Math.min(100, currentUser.hp + gameConfig.hpRegen);
      updateHP(); 
    }
  }, 1000);

  savePosition();
  setInterval(() => { if (currentUser.name) savePosition(); }, 2000);

  officeCanvas.addEventListener("keydown", (e) => {
    if (keys.hasOwnProperty(e.key)) { keys[e.key] = true; targetPosition = null; e.preventDefault(); }
    if (e.key === " ") { e.preventDefault(); attack(); }
  });
  officeCanvas.addEventListener("keyup", (e) => {
    if (keys.hasOwnProperty(e.key)) { keys[e.key] = false; e.preventDefault(); }
  });

  officeCanvas.addEventListener("pointerdown", (e) => {
    officeCanvas.focus();
    const rect = officeCanvas.getBoundingClientRect();
    const scaleX = officeCanvas.width / rect.width;
    const scaleY = officeCanvas.height / rect.height;
    let clickX = (e.clientX - rect.left) * scaleX;
    let clickY = (e.clientY - rect.top) * scaleY;

    let clickedOnPlayer = null;
    Object.keys(players).forEach(id => {
      const p = players[id];
      const dx = clickX - (p.x + PLAYER_SIZE/2);
      const dy = clickY - (p.y + PLAYER_SIZE/2);
      if (Math.sqrt(dx*dx + dy*dy) < PLAYER_SIZE) clickedOnPlayer = id;
    });

    if (clickedOnPlayer) {
      isDragging = true;
      draggedPlayerId = clickedOnPlayer;
    } else {
      targetPosition = { x: clickX - PLAYER_SIZE / 2, y: clickY - PLAYER_SIZE / 2 };
    }
  });

  officeCanvas.addEventListener("pointermove", (e) => {
    if (!isDragging || !draggedPlayerId) return;
    const rect = officeCanvas.getBoundingClientRect();
    const scaleX = officeCanvas.width / rect.width;
    const scaleY = officeCanvas.height / rect.height;
    let x = (e.clientX - rect.left) * scaleX - PLAYER_SIZE / 2;
    let y = (e.clientY - rect.top) * scaleY - PLAYER_SIZE / 2;
    updateDoc(doc(db, "positions", draggedPlayerId), { x: x, y: y });
  });

  window.addEventListener("pointerup", () => { isDragging = false; draggedPlayerId = null; });
  requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
  if(!officeCanvas || !canvasContainer) return;
  officeCanvas.width = canvasContainer.clientWidth || 800;
  officeCanvas.height = canvasContainer.clientHeight || 300;
}

function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); }

function update() {
  let moved = false;
  if (keys.ArrowUp) { myPosition.y -= MOVE_SPEED; moved = true; }
  if (keys.ArrowDown) { myPosition.y += MOVE_SPEED; moved = true; }
  if (keys.ArrowLeft) { myPosition.x -= MOVE_SPEED; moved = true; }
  if (keys.ArrowRight) { myPosition.x += MOVE_SPEED; moved = true; }

  if (targetPosition) {
    const dx = targetPosition.x - myPosition.x;
    const dy = targetPosition.y - myPosition.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > MOVE_SPEED) {
      myPosition.x += (dx / dist) * MOVE_SPEED;
      myPosition.y += (dy / dist) * MOVE_SPEED;
      moved = true;
    } else {
      myPosition.x = targetPosition.x; myPosition.y = targetPosition.y;
      targetPosition = null; moved = true;
    }
  }

  if(!officeCanvas) return;
  myPosition.x = Math.max(0, Math.min(officeCanvas.width - PLAYER_SIZE, myPosition.x));
  myPosition.y = Math.max(0, Math.min(officeCanvas.height - PLAYER_SIZE, myPosition.y));
  
  if (moved) savePosition();
}

let lastSave = 0, myCurrentBubble = "", myBubbleTime = 0;     

function savePosition() {
  if (!currentUser.name) return;
  const now = Date.now();
  if (now - lastSave < 100) return; 
  lastSave = now;
  const docRef = doc(positionsCollection, currentUser.uid);
  
  let bubbleToSend = myCurrentBubble;
  if (now - myBubbleTime > 5000) { bubbleToSend = ""; myCurrentBubble = ""; }

  setDoc(docRef, {
    x: myPosition.x, y: myPosition.y, name: currentUser.name, avatar: currentUser.avatar,
    bubbleText: bubbleToSend, bubbleTime: myBubbleTime, lastUpdate: serverTimestamp()
  }, { merge: true });
}

function updateHP() {
  const docRef = doc(positionsCollection, currentUser.uid);
  updateDoc(docRef, { hp: currentUser.hp, mutedUntil: currentUser.mutedUntil }).catch(e => {});
}

function attack() {
  const now = Date.now();
  if (now - lastAttackTime < 800 || currentUser.mutedUntil > now) return;
  lastAttackTime = now;
  punchEffect = { x: myPosition.x, y: myPosition.y, time: now };

  let closestPlayer = null, minDistance = 60;
  Object.keys(players).forEach(id => {
    const p = players[id];
    const dx = (p.x + PLAYER_SIZE/2) - (myPosition.x + PLAYER_SIZE/2);
    const dy = (p.y + PLAYER_SIZE/2) - (myPosition.y + PLAYER_SIZE/2);
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < minDistance) { minDistance = dist; closestPlayer = id; }
  });

  if (closestPlayer) {
    const targetData = players[closestPlayer];
    if (targetData.immunity) return; 

    let targetHp = targetData.hp !== undefined ? targetData.hp : 100;
    let newHp = targetHp - 25;
    let newMutedUntil = targetData.mutedUntil || 0;

    if (newHp <= 0) { 
      newHp = 100; 
      newMutedUntil = now + (gameConfig.muteDuration * 1000);
    }
    updateDoc(doc(db, "positions", closestPlayer), { hp: newHp, mutedUntil: newMutedUntil });
  }
}

function triggerBubble(text) { myCurrentBubble = text; myBubbleTime = Date.now(); savePosition(); }

function draw() {
  if(!ctx || !officeCanvas || officeCanvas.width === 0) return;
  ctx.clearRect(0, 0, officeCanvas.width, officeCanvas.height);
  ctx.fillStyle = "#0a1710"; ctx.fillRect(0, 0, officeCanvas.width, officeCanvas.height);
  ctx.strokeStyle = "#14231c"; ctx.lineWidth = 1;
  for (let i = 0; i < officeCanvas.width; i += 32) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, officeCanvas.height); ctx.stroke(); }
  for (let i = 0; i < officeCanvas.height; i += 32) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(officeCanvas.width, i); ctx.stroke(); }

  Object.values(players).forEach((p) => {
    if (p.lastUpdate && (Date.now() - p.lastUpdate.toMillis() < 6000)) {
      drawPlayer(p.x, p.y, p.avatar, p.name, p.bubbleText, p.bubbleTime, p.hp, p.mutedUntil, p.immunity);
    }
  });

  drawPlayer(myPosition.x, myPosition.y, currentUser.avatar, currentUser.name, myCurrentBubble, myBubbleTime, currentUser.hp, currentUser.mutedUntil, currentUser.immunity);

  if (punchEffect && Date.now() - punchEffect.time < 200) {
    ctx.fillStyle = "rgba(255, 50, 50, 0.8)";
    ctx.beginPath(); ctx.arc(punchEffect.x + PLAYER_SIZE/2 + 20, punchEffect.y + PLAYER_SIZE/2, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 16px Arial"; ctx.fillText("¡POW!", punchEffect.x + PLAYER_SIZE, punchEffect.y);
  }
}

function drawPlayer(x, y, avatarUrl, name, bubbleText, bubbleTime, hp = 100, mutedUntil = 0, immunity = false) {
  if(!ctx) return;
  const img = getAvatarImage(avatarUrl);
  if (img.complete) ctx.drawImage(img, x, y, PLAYER_SIZE, PLAYER_SIZE);
  else { ctx.fillStyle = "#dc2626"; ctx.fillRect(x, y, PLAYER_SIZE, PLAYER_SIZE); }

  ctx.fillStyle = "#000"; ctx.fillRect(x, y - 12, PLAYER_SIZE, 5);
  ctx.fillStyle = immunity ? "#fbbf24" : (hp > 50 ? "#22c55e" : (hp > 20 ? "#fbbf24" : "#ef4444")); 
  ctx.fillRect(x, y - 12, (hp / 100) * PLAYER_SIZE, 5);
  
  ctx.fillStyle = "#fff"; ctx.font = "bold 10px Inter, sans-serif"; ctx.textAlign = "center"; 
  ctx.fillText(name, x + PLAYER_SIZE / 2, y - 18);

  if (immunity) { ctx.font = "12px Arial"; ctx.fillText("🛡️", x + PLAYER_SIZE - 5, y - 20); }
  if (mutedUntil > Date.now()) { ctx.font = "14px Arial"; ctx.fillText("🤐", x + PLAYER_SIZE / 2, y - 25); }

  if (bubbleText && bubbleText.trim() !== "") {
    const timeElapsed = Date.now() - bubbleTime;
    if (timeElapsed < 5000) drawBubble(x + PLAYER_SIZE / 2, y - 30, bubbleText, timeElapsed);
  }
}

// ============================================================
//  CONTADORES, CUMPLEAÑOS Y COMPRAS 
// ============================================================
function updateCountdowns() {
  const now = new Date();
  let targetYear = now.getFullYear();
  let jan29 = new Date(targetYear, 0, 29);
  while (jan29 < now || jan29.getDay() !== 5) { targetYear++; jan29 = new Date(targetYear, 0, 29); }
  if(document.getElementById("cd-jan29")) document.getElementById("cd-jan29").innerText = `${Math.floor((jan29 - now) / (1000 * 60 * 60 * 24))} días`;

  const year = now.getFullYear();
  const holidays = [
    { name: "Año Nuevo", date: `${year}-01-01` }, { name: "Viernes Santo", date: `${year}-03-29` },
    { name: "Día del Trabajo", date: `${year}-05-01` }, { name: "Navidad", date: `${year}-12-25` }
  ];
  let nextHoliday = holidays.find(h => new Date(h.date + 'T00:00:00') > now);
  if (!nextHoliday) nextHoliday = { name: "Año Nuevo", date: new Date(year + 1, 0, 1) };
  if(document.getElementById("cd-holiday-name")) document.getElementById("cd-holiday-name").innerText = nextHoliday.name;
  if(document.getElementById("cd-holiday")) document.getElementById("cd-holiday").innerText = `${Math.ceil((new Date(nextHoliday.date + 'T00:00:00') - now) / (1000 * 60 * 60 * 24))} días`;
}
setInterval(updateCountdowns, 60000); updateCountdowns();

const bdayCollection = collection(db, "birthdays");
document.getElementById("bdayDate")?.addEventListener("input", (e) => {
  let val = e.target.value.replace(/\D/g, ''); 
  if (val.length > 2) val = val.substring(0, 2) + '/' + val.substring(2, 4);
  e.target.value = val;
});
document.getElementById("bdayForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("bdayName").value.trim();
  const rawDate = document.getElementById("bdayDate").value.trim(); 
  if (!name || rawDate.length !== 5) return alert("Ingresa nombre y fecha DD/MM.");
  const [day, month] = rawDate.split('/');
  const dummyDate = `2000-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  await addDoc(bdayCollection, { name, date: dummyDate });
  e.target.reset();
});

onSnapshot(query(bdayCollection, orderBy("date", "asc")), (snapshot) => {
  const bdayList = document.getElementById("bdayList");
  if(!bdayList) return;
  bdayList.innerHTML = "";
  const bdays = [];
  snapshot.forEach(doc => {
    const data = doc.data(); const bDate = new Date(data.date + 'T00:00:00'); 
    const now = new Date(); let nextBday = new Date(now.getFullYear(), bDate.getMonth(), bDate.getDate());
    if (nextBday < now) nextBday.setFullYear(now.getFullYear() + 1);
    bdays.push({ id: doc.id, ...data, daysDiff: Math.ceil((nextBday - now) / 86400000), bDate });
  });
  bdays.sort((a, b) => a.daysDiff - b.daysDiff).forEach((b, i) => {
    const li = document.createElement("li");
    if (i === 0) li.classList.add("highlight");
    li.innerHTML = `<span>${b.name} <small>(${b.bDate.toLocaleDateString('es-ES', {month:'short', day:'numeric'})})</small></span>
      <div><span style="color:var(--accent); font-size:0.8rem; font-weight:bold;">en ${b.daysDiff}d</span> <button class="btn-delete-small" data-id="${b.id}">×</button></div>`;
    bdayList.appendChild(li);
  });
  document.querySelectorAll("#bdayList .btn-delete-small").forEach(btn => btn.onclick = async (e) => await deleteDoc(doc(db, "birthdays", e.target.dataset.id)));
});

const purchaseCollection = collection(db, "water_logs");
if(document.getElementById("purchaseDate")) document.getElementById("purchaseDate").valueAsDate = new Date();
document.getElementById("purchaseForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  await addDoc(purchaseCollection, { name: document.getElementById("buyerName").value, item: document.getElementById("itemBought").value, date: document.getElementById("purchaseDate").value });
  e.target.reset(); document.getElementById("purchaseDate").valueAsDate = new Date();
});
onSnapshot(query(purchaseCollection, orderBy("date", "desc"), limit(15)), (snapshot) => {
  const purchaseLog = document.getElementById("purchaseLog");
  if(!purchaseLog) return;
  purchaseLog.innerHTML = snapshot.empty ? "<p>No hay compras.</p>" : "";
  snapshot.forEach(doc => {
    const d = doc.data(); const fDate = d.date.split('-').reverse().join('/');
    purchaseLog.innerHTML += `<div class="purchase-item"><div class="purchase-item-details"><span class="purchase-name">${d.name}</span><span class="purchase-thing">🛒 ${d.item || "Agua"}</span><span class="purchase-date">📅 ${fDate}</span></div><button class="btn-delete-small" onclick="deletePurchase('${doc.id}')">🗑️</button></div>`;
  });
});
window.deletePurchase = async (id) => { if(confirm("¿Eliminar registro?")) await deleteDoc(doc(db, "water_logs", id)); };

// ============================================================
//  CHAT Y PESTAÑAS
// ============================================================
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
  });
});

document.getElementById("chatHeader")?.addEventListener("click", () => {
  const w = document.getElementById("chatWidget");
  w.classList.toggle("minimized"); w.classList.toggle("expanded");
});

onSnapshot(query(collection(db, "messages"), orderBy("createdAt", "asc"), limit(100)), (snapshot) => {
  const chatMessages = document.getElementById("chatMessages");
  if(!chatMessages) return;
  chatMessages.innerHTML = "";
  snapshot.forEach(doc => {
    const m = doc.data();
    chatMessages.innerHTML += `<div class="chat-message"><img class="msg-avatar" src="${m.avatar}"><div><div class="msg-name">${m.name}</div><div class="msg-text">${m.text}</div></div></div>`;
  });
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

document.getElementById("chatForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = document.getElementById("chatInput").value.trim();
  if(!text) return;
  document.getElementById("chatInput").value = "";
  triggerBubble(text);
  await addDoc(collection(db, "messages"), { name: currentUser.name, avatar: currentUser.avatar, text, createdAt: serverTimestamp() });
});

// ============================================================
//  VOTACIONES Y MINIJUEGOS
// ============================================================
document.getElementById("newPollBtn")?.addEventListener("click", () => {
  document.getElementById("pollQuestion").value = ""; document.getElementById("isYesNoPoll").checked = false;
  document.getElementById("pollOptionsWrapper").style.display = "block";
  document.getElementById("pollOptionsContainer").innerHTML = `<input type="text" class="text-input poll-option" placeholder="Opción 1"><input type="text" class="text-input poll-option" placeholder="Opción 2">`;
  document.getElementById("pollModal").hidden = false;
});
document.getElementById("addOptionBtn")?.addEventListener("click", (e) => {
  e.preventDefault(); const c = document.querySelectorAll(".poll-option").length;
  if(c < 6) document.getElementById("pollOptionsContainer").innerHTML += `<input type="text" class="text-input poll-option" placeholder="Opción ${c+1}">`;
});
document.getElementById("createPollBtn")?.addEventListener("click", async (e) => {
  e.preventDefault();
  const q = document.getElementById("pollQuestion").value.trim();
  let opts = [...document.querySelectorAll(".poll-option")].map(i => i.value.trim()).filter(Boolean);
  if(!q || opts.length < 2) return alert("Faltan datos");
  if(document.getElementById("isYesNoPoll").checked) opts = ["Sí", "No"];
  const votes = {}; opts.forEach((_, i) => votes[i] = 0);
  await addDoc(collection(db, "polls"), { question: q, options: opts, votes, isYesNo: document.getElementById("isYesNoPoll").checked, creator: currentUser.name, createdAt: serverTimestamp() });
  document.getElementById("pollModal").hidden = true;
});

onSnapshot(query(collection(db, "polls"), orderBy("createdAt", "desc")), (snapshot) => {
  const pollsContainer = document.getElementById("pollsContainer");
  if(!pollsContainer) return;
  pollsContainer.innerHTML = snapshot.empty ? "<p>No hay votaciones</p>" : "";
  snapshot.forEach(docSnap => {
    const p = docSnap.data(); const id = docSnap.id;
    const total = Object.values(p.votes||{}).reduce((a,b)=>a+b,0);
    let optsHTML = p.options.map((o, i) => {
      const count = p.votes[i] || 0; const pct = total > 0 ? Math.round((count/total)*100) : 0;
      return `<button class="poll-option-btn" onclick="vote('${id}', ${i})"><span class="option-bar" style="width:${pct}%"></span><span class="option-text">${o}</span><span class="option-count">${count} (${pct}%)</span></button>`;
    }).join("");
    pollsContainer.innerHTML += `<div class="poll-card"><button class="btn-delete-poll" onclick="delPoll('${id}')">🗑️</button><div class="poll-question">${p.question}</div><div class="poll-options">${optsHTML}</div></div>`;
  });
});
window.vote = async (id, idx) => { await updateDoc(doc(db, "polls", id), { [`votes.${idx}`]: increment(1) }); confetti(); };
window.delPoll = async (id) => { if(confirm("¿Borrar?")) await deleteDoc(doc(db, "polls", id)); };

document.getElementById("gamesBtn")?.addEventListener("click", () => document.getElementById("gameModal").hidden = false);
document.getElementById("closeGameBtn")?.addEventListener("click", () => document.getElementById("gameModal").hidden = true);

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
