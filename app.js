import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  initializeFirestore, 
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  doc,
  updateDoc,
  increment,
  deleteDoc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDJE3mYAvvOyrmL2riktXB-mdt0iH2iN5k",
  authDomain: "laoficina-81e4a.firebaseapp.com",
  projectId: "laoficina-81e4a",
  storageBucket: "laoficina-81e4a.firebasestorage.app",
  messagingSenderId: "733303320739",
  appId: "1:733303320739:web:b24a466bcad169c21c4f16",
  measurementId: "G-ER0ZYJ270J"
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false,
});

let currentUser = { name: "", avatar: "", hp: 100, mutedUntil: 0 };
const AVATAR_STYLES = ["pixel-art", "pixel-art-neutral"]; 
const AVATAR_SEEDS = ["Felix", "Aneka", "Milo", "Luna", "Leo", "Nina", "Oscar", "Zoe", "Max", "Chloe"];

// DOM
const loginBtn = document.getElementById("loginBtn");
const userProfile = document.getElementById("userProfile");
const headerAvatar = document.getElementById("headerAvatar");
const headerName = document.getElementById("headerName");
const changeAvatarBtn = document.getElementById("changeAvatarBtn");
const loginModal = document.getElementById("loginModal");
const nameInput = document.getElementById("nameInput");
const avatarGrid = document.getElementById("avatarGrid");
const enterBtn = document.getElementById("enterBtn");
const pollsContainer = document.getElementById("pollsContainer");
const newPollBtn = document.getElementById("newPollBtn");
const pollModal = document.getElementById("pollModal");
const pollQuestion = document.getElementById("pollQuestion");
const pollOptionsContainer = document.getElementById("pollOptionsContainer");
const addOptionBtn = document.getElementById("addOptionBtn");
const createPollBtn = document.getElementById("createPollBtn");
const isYesNoPoll = document.getElementById("isYesNoPoll");
const pollOptionsWrapper = document.getElementById("pollOptionsWrapper");
const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const officeCanvas = document.getElementById("officeCanvas");
const canvasContainer = document.getElementById("canvasContainer");
const pauseToast = document.getElementById("pauseToast");

// Utilidades
function avatarUrl(style, seed) {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=transparent`;
}
function formatTime(timestamp) {
  if (!timestamp) return "ahora";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Login
let selectedAvatarUrl = "";
function buildAvatarPicker() {
  avatarGrid.innerHTML = "";
  AVATAR_STYLES.forEach((style) => {
    AVATAR_SEEDS.forEach((seed) => {
      const url = avatarUrl(style, seed);
      const img = document.createElement("img");
      img.src = url;
      img.className = "avatar-option";
      img.addEventListener("click", () => {
        document.querySelectorAll(".avatar-option").forEach((el) => el.classList.remove("selected"));
        img.classList.add("selected");
        selectedAvatarUrl = url;
      });
      avatarGrid.appendChild(img);
    });
  });
  const first = avatarGrid.querySelector(".avatar-option");
  if (first) { first.classList.add("selected"); selectedAvatarUrl = first.src; }
}
function updateProfileUI() {
  headerAvatar.src = currentUser.avatar;
  headerName.textContent = currentUser.name;
  userProfile.hidden = false;
  loginBtn.hidden = true;
}
function enterApp() {
  const name = nameInput.value.trim();
  if (!name) return alert("Por favor, escribe tu nombre.");
  if (!selectedAvatarUrl) return alert("Elige un avatar.");
  
  currentUser.name = name;
  currentUser.avatar = selectedAvatarUrl;
  currentUser.hp = 100;
  currentUser.mutedUntil = 0;
  
  localStorage.setItem("officeLiveUser", JSON.stringify(currentUser));
  
  updateProfileUI();
  loginModal.hidden = true;
  initRealtime();
  initOffice(); 
}
loginBtn.addEventListener("click", () => { buildAvatarPicker(); loginModal.hidden = false; });
changeAvatarBtn.addEventListener("click", () => { buildAvatarPicker(); loginModal.hidden = false; });
enterBtn.addEventListener("click", enterApp);
nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") enterApp(); });

// ============================================================
//  OFICINA VIRTUAL, COMBATE Y MOVIMIENTO
// ============================================================
const ctx = officeCanvas.getContext("2d");
let players = {}; 
let myPosition = { x: 400, y: 200 }; 
const PLAYER_SIZE = 32;
const MOVE_SPEED = 2.5;
const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
const positionsCollection = collection(db, "positions");

let lastAttackTime = 0;
let punchEffect = null; // Para dibujar el efecto del golpe

const avatarImageCache = {};
function getAvatarImage(url) {
  if (!avatarImageCache[url]) {
    const img = new Image();
    img.src = url;
    avatarImageCache[url] = img;
  }
  return avatarImageCache[url];
}

function initOffice() {
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  onSnapshot(positionsCollection, (snapshot) => {
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      
      // Si el documento es mío, actualizo mi estado local (vida y muteo)
      if (docSnap.id === currentUser.name) {
        if (data.hp !== undefined) currentUser.hp = data.hp;
        if (data.mutedUntil !== undefined) currentUser.mutedUntil = data.mutedUntil;
      } else {
        players[docSnap.id] = data;
      }
    });
  });

  savePosition();

  officeCanvas.addEventListener("keydown", (e) => {
    if (keys.hasOwnProperty(e.key)) {
      keys[e.key] = true;
      e.preventDefault(); 
    }
    if (e.key === " ") { // Barra espaciadora para golpear
      e.preventDefault();
      attack();
    }
  });
  officeCanvas.addEventListener("keyup", (e) => {
    if (keys.hasOwnProperty(e.key)) {
      keys[e.key] = false;
      e.preventDefault();
    }
  });
  officeCanvas.addEventListener("click", () => officeCanvas.focus());
  officeCanvas.focus();

  requestAnimationFrame(gameLoop);

  // Temporizador Pausa Activa (2 horas = 7,200,000 ms)
  // Para probar rápido, cámbialo a 10000 (10 segundos)
  setInterval(() => {
    pauseToast.hidden = false;
    // Opcional: sonido
  }, 7200000);
}

function attack() {
  const now = Date.now();
  // Cooldown de 800ms
  if (now - lastAttackTime < 800) return;
  // Si estoy muteado, no puedo atacar
  if (currentUser.mutedUntil > now) {
    alert("Estás muteado por K.O. No puedes golpear.");
    return;
  }

  lastAttackTime = now;
  punchEffect = { x: myPosition.x, y: myPosition.y, time: now };

  // Buscar víctima cercana
  let closestPlayer = null;
  let minDistance = 60; // Rango de golpe

  Object.keys(players).forEach(id => {
    const p = players[id];
    // Distancia euclidiana entre centros
    const dx = (p.x + PLAYER_SIZE/2) - (myPosition.x + PLAYER_SIZE/2);
    const dy = (p.y + PLAYER_SIZE/2) - (myPosition.y + PLAYER_SIZE/2);
    const dist = Math.sqrt(dx*dx + dy*dy);
    
    if (dist < minDistance) {
      minDistance = dist;
      closestPlayer = id;
    }
  });

  if (closestPlayer) {
    const targetData = players[closestPlayer];
    let targetHp = targetData.hp !== undefined ? targetData.hp : 100;
    let newHp = targetHp - 25; // 25 de daño por golpe
    let newMutedUntil = targetData.mutedUntil || 0;

    if (newHp <= 0) {
      // K.O. -> Muteo por 1 minuto y revivir
      newHp = 100;
      newMutedUntil = now + 60000; 
    }

    const targetRef = doc(db, "positions", closestPlayer);
    updateDoc(targetRef, { hp: newHp, mutedUntil: newMutedUntil });
  }
}

function resizeCanvas() {
  officeCanvas.width = canvasContainer.clientWidth;
  officeCanvas.height = canvasContainer.clientHeight;
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

function update() {
  let moved = false;
  if (keys.ArrowUp) { myPosition.y -= MOVE_SPEED; moved = true; }
  if (keys.ArrowDown) { myPosition.y += MOVE_SPEED; moved = true; }
  if (keys.ArrowLeft) { myPosition.x -= MOVE_SPEED; moved = true; }
  if (keys.ArrowRight) { myPosition.x += MOVE_SPEED; moved = true; }

  myPosition.x = Math.max(0, Math.min(officeCanvas.width - PLAYER_SIZE, myPosition.x));
  myPosition.y = Math.max(0, Math.min(officeCanvas.height - PLAYER_SIZE, myPosition.y));

  if (moved) savePosition();
}

let lastSave = 0;
let myCurrentBubble = ""; 
let myBubbleTime = 0;     

function savePosition() {
  const now = Date.now();
  if (now - lastSave < 100) return; 
  lastSave = now;

  const docRef = doc(positionsCollection, currentUser.name);
  
  let bubbleToSend = myCurrentBubble;
  if (now - myBubbleTime > 5000) {
    bubbleToSend = "";
    myCurrentBubble = "";
  }

  setDoc(docRef, {
    x: myPosition.x,
    y: myPosition.y,
    name: currentUser.name,
    avatar: currentUser.avatar,
    bubbleText: bubbleToSend, 
    bubbleTime: myBubbleTime, 
    hp: currentUser.hp,
    mutedUntil: currentUser.mutedUntil,
    lastUpdate: serverTimestamp()
  }, { merge: true });
}

function triggerBubble(text) {
  myCurrentBubble = text;
  myBubbleTime = Date.now();
  savePosition();
}

function draw() {
  ctx.clearRect(0, 0, officeCanvas.width, officeCanvas.height);

  // Fondo
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(0, 0, officeCanvas.width, officeCanvas.height);
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1;
  for (let i = 0; i < officeCanvas.width; i += 32) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, officeCanvas.height); ctx.stroke();
  }
  for (let i = 0; i < officeCanvas.height; i += 32) {
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(officeCanvas.width, i); ctx.stroke();
  }

  // Dibujar otros jugadores
  Object.values(players).forEach((p) => {
    drawPlayer(p.x, p.y, p.avatar, p.name, p.bubbleText, p.bubbleTime, p.hp, p.mutedUntil);
  });

  // Dibujar mi jugador
  drawPlayer(myPosition.x, myPosition.y, currentUser.avatar, currentUser.name, myCurrentBubble, myBubbleTime, currentUser.hp, currentUser.mutedUntil);

  // Dibujar efecto de golpe
  if (punchEffect && Date.now() - punchEffect.time < 200) {
    ctx.fillStyle = "rgba(255, 50, 50, 0.8)";
    ctx.beginPath();
    ctx.arc(punchEffect.x + PLAYER_SIZE/2 + 20, punchEffect.y + PLAYER_SIZE/2, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px Arial";
    ctx.fillText("¡POW!", punchEffect.x + PLAYER_SIZE, punchEffect.y);
  }
}

function drawPlayer(x, y, avatarUrl, name, bubbleText, bubbleTime, hp = 100, mutedUntil = 0) {
  // Dibujar avatar
  const img = getAvatarImage(avatarUrl);
  if (img.complete) {
    ctx.drawImage(img, x, y, PLAYER_SIZE, PLAYER_SIZE);
  } else {
    ctx.fillStyle = "#6366f1";
    ctx.fillRect(x, y, PLAYER_SIZE, PLAYER_SIZE);
  }

  // Barra de Vida (HP)
  const hpBarWidth = PLAYER_SIZE;
  const hpBarHeight = 5;
  const hpBarY = y - 12;
  // Fondo barra
  ctx.fillStyle = "#000";
  ctx.fillRect(x, hpBarY, hpBarWidth, hpBarHeight);
  // Relleno barra (verde si > 50, amarillo si > 20, rojo)
  ctx.fillStyle = hp > 50 ? "#34d399" : (hp > 20 ? "#fbbf24" : "#f87171");
  ctx.fillRect(x, hpBarY, (hp / 100) * hpBarWidth, hpBarHeight);

  // Nombre
  ctx.fillStyle = "#fff";
  ctx.font = "bold 10px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(name, x + PLAYER_SIZE / 2, y - 18);

  // Indicador de Muteado
  if (mutedUntil > Date.now()) {
    ctx.font = "14px Arial";
    ctx.fillText("🤐", x + PLAYER_SIZE / 2, y - 25);
  }

  // Viñeta de chat
  if (bubbleText && bubbleText.trim() !== "") {
    const timeElapsed = Date.now() - bubbleTime;
    if (timeElapsed < 5000) {
      drawBubble(x + PLAYER_SIZE / 2, y - 30, bubbleText, timeElapsed);
    }
  }
}

function drawBubble(cx, cy, text, timeElapsed) {
  ctx.font = "12px Inter, sans-serif";
  let displayText = text;
  if (displayText.length > 30) displayText = displayText.substring(0, 27) + "...";

  const metrics = ctx.measureText(displayText);
  const textWidth = metrics.width;
  const padding = 8;
  const bubbleWidth = textWidth + padding * 2;
  const bubbleHeight = 28;

  let opacity = 1;
  if (timeElapsed < 300) opacity = timeElapsed / 300;
  else if (timeElapsed > 4500) opacity = 1 - (timeElapsed - 4500) / 500;
  
  ctx.globalAlpha = Math.max(0, opacity);

  const bx = cx - bubbleWidth / 2;
  const by = cy - bubbleHeight - 10;

  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#333333";
  ctx.lineWidth = 1.5;
  
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(bx, by, bubbleWidth, bubbleHeight, 6); }
  else { ctx.rect(bx, by, bubbleWidth, bubbleHeight); }
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - 5, by + bubbleHeight);
  ctx.lineTo(cx, by + bubbleHeight + 8);
  ctx.lineTo(cx + 5, by + bubbleHeight);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(displayText, cx, by + bubbleHeight / 2);

  ctx.globalAlpha = 1.0;
}

// ============================================================
//  CHAT
// ============================================================
function initChat() {
  const q = query(collection(db, "messages"), orderBy("createdAt", "asc"), limit(100));
  onSnapshot(q, (snapshot) => {
    chatMessages.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const msg = docSnap.data();
      const div = document.createElement("div");
      div.className = "chat-message";
      div.innerHTML = `
        <img class="msg-avatar" src="${msg.avatar}" alt="${msg.name}" />
        <div class="msg-body">
          <div class="msg-header">
            <span class="msg-name">${escapeHtml(msg.name)}</span>
            <span class="msg-time">${formatTime(msg.createdAt)}</span>
          </div>
          <div class="msg-text">${escapeHtml(msg.text)}</div>
        </div>
      `;
      chatMessages.appendChild(div);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }, (error) => console.error("Error chat:", error));
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  // Verificar si está muteado
  if (currentUser.mutedUntil > Date.now()) {
    const secondsLeft = Math.ceil((currentUser.mutedUntil - Date.now()) / 1000);
    alert(`Estás muteado por K.O. Espera ${secondsLeft} segundos.`);
    return;
  }

  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = "";
  
  triggerBubble(text);

  try {
    await addDoc(collection(db, "messages"), {
      name: currentUser.name, avatar: currentUser.avatar, text, createdAt: serverTimestamp(),
    });
  } catch (error) { alert("Error al enviar mensaje."); }
});

// ============================================================
//  VOTACIONES (Se mantiene igual)
// ============================================================
function initPolls() {
  const q = query(collection(db, "polls"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    pollsContainer.innerHTML = "";
    if (snapshot.empty) {
      pollsContainer.innerHTML = `<p class="empty-state">Aún no hay votaciones. ¡Crea la primera! 🚀</p>`;
      return;
    }
    snapshot.forEach((docSnap) => {
      const poll = { id: docSnap.id, ...docSnap.data() };
      renderPoll(poll);
    });
  }, (error) => console.error("Error votaciones:", error));
}

function renderPoll(poll) {
  const totalVotes = Object.values(poll.votes || {}).reduce((a, b) => a + b, 0);
  const card = document.createElement("div");
  card.className = "poll-card";

  const optionsHtml = (poll.options || []).map((opt, idx) => {
    const count = poll.votes?.[idx] || 0;
    const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
    return `
      <button class="poll-option-btn" data-poll-id="${poll.id}" data-option-idx="${idx}">
        <span class="option-bar" style="width:${percent}%"></span>
        <span class="option-text">${escapeHtml(opt)}</span>
        <span class="option-count">${count} · ${percent}%</span>
      </button>
    `;
  }).join("");

  let mascotHtml = "";
  if (poll.isYesNo) {
    mascotHtml = `
      <div class="mascot-container">
        <div class="mascot-sign" id="sign-${poll.id}">?</div>
        <div class="mascot-avatar">
          <img src="${currentUser.avatar || avatarUrl('pixel-art', 'default')}" alt="Avatar" />
        </div>
      </div>
    `;
  }

  card.innerHTML = `
    <button class="btn-delete-poll" title="Eliminar votación">🗑️</button>
    <div class="poll-question">${escapeHtml(poll.question)}</div>
    ${mascotHtml}
    <div class="poll-options">${optionsHtml}</div>
    <div class="poll-footer">
      <span>${totalVotes} voto${totalVotes !== 1 ? "s" : ""}</span>
      <span>Creada por ${escapeHtml(poll.creator || "alguien")}</span>
    </div>
  `;

  card.querySelector(".btn-delete-poll").addEventListener("click", async (e) => {
    e.stopPropagation();
    if (confirm("¿Estás seguro de que quieres eliminar esta votación?")) {
      try { await deleteDoc(doc(db, "polls", poll.id)); } 
      catch (error) { alert("No se pudo eliminar."); }
    }
  });

  const votedKey = `voted_${poll.id}`;
  const hasVoted = localStorage.getItem(votedKey); 

  if (hasVoted !== null && poll.isYesNo) {
    const sign = card.querySelector(`#sign-${poll.id}`);
    if (sign) {
      if (hasVoted === "0") { sign.textContent = "SÍ"; sign.className = "mascot-sign show green"; }
      else if (hasVoted === "1") { sign.textContent = "NO"; sign.className = "mascot-sign show red"; }
    }
  }

  card.querySelectorAll(".poll-option-btn").forEach((btn) => {
    if (hasVoted !== null) btn.disabled = true;
    btn.addEventListener("click", async () => {
      if (localStorage.getItem(votedKey) !== null) return;
      const idx = btn.dataset.optionIdx;
      try {
        await updateDoc(doc(db, "polls", poll.id), { [`votes.${idx}`]: increment(1) });
        localStorage.setItem(votedKey, idx);
        if (poll.isYesNo) {
          const sign = card.querySelector(`#sign-${poll.id}`);
          if (sign) {
            if (idx === "0") { sign.textContent = "SÍ"; sign.className = "mascot-sign show green"; }
            else { sign.textContent = "NO"; sign.className = "mascot-sign show red"; }
          }
        }
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ["#6366f1", "#f472b6", "#34d399"] });
        card.querySelectorAll(".poll-option-btn").forEach((b) => (b.disabled = true));
      } catch (error) { alert("Error al registrar el voto."); }
    });
  });

  pollsContainer.appendChild(card);
}

newPollBtn.addEventListener("click", () => {
  pollQuestion.value = "";
  isYesNoPoll.checked = false;
  pollOptionsWrapper.style.display = "block";
  pollOptionsContainer.innerHTML = `
    <input type="text" class="text-input poll-option" placeholder="Opción 1" maxlength="60" />
    <input type="text" class="text-input poll-option" placeholder="Opción 2" maxlength="60" />
  `;
  pollModal.hidden = false;
});

isYesNoPoll.addEventListener("change", (e) => {
  pollOptionsWrapper.style.display = e.target.checked ? "none" : "block";
});

addOptionBtn.addEventListener("click", (e) => {
  e.preventDefault();
  const count = pollOptionsContainer.querySelectorAll(".poll-option").length;
  if (count >= 6) return alert("Máximo 6 opciones.");
  const input = document.createElement("input");
  input.type = "text";
  input.className = "text-input poll-option";
  input.placeholder = `Opción ${count + 1}`;
  input.maxLength = 60;
  pollOptionsContainer.appendChild(input);
});

createPollBtn.addEventListener("click", async (e) => {
  e.preventDefault(); 
  const question = pollQuestion.value.trim();
  const isYesNo = isYesNoPoll.checked;
  let options = [];
  if (isYesNo) { options = ["Sí", "No"]; }
  else {
    const optionInputs = [...pollOptionsContainer.querySelectorAll(".poll-option")];
    options = optionInputs.map(i => i.value.trim()).filter(Boolean);
  }
  if (!question) return alert("Escribe una pregunta.");
  if (options.length < 2) return alert("Necesitas al menos 2 opciones.");
  const votes = {};
  options.forEach((_, i) => (votes[i] = 0));
  try {
    await addDoc(collection(db, "polls"), {
      question, options, votes, isYesNo, creator: currentUser.name || "Anónimo", createdAt: serverTimestamp(),
    });
    pollModal.hidden = true;
  } catch (error) { alert("Error de Firebase al crear la votación."); }
});

// Inicio
function initRealtime() { initChat(); initPolls(); }
function checkSavedUser() {
  const saved = localStorage.getItem("officeLiveUser");
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      if (currentUser.name && currentUser.avatar) {
        if (!currentUser.hp) currentUser.hp = 100;
        if (!currentUser.mutedUntil) currentUser.mutedUntil = 0;
        
        updateProfileUI();
        initRealtime();
        initOffice(); 
        return;
      }
    } catch (_) {}
  }
  buildAvatarPicker();
  loginModal.hidden = false;
}
checkSavedUser();
