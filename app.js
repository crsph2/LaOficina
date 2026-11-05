// ============================================================
//  OFFICE LIVE · Votaciones y Chat en tiempo real
//  Backend: Firebase Firestore (serverless para GitHub Pages)
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  doc,
  updateDoc,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Configuración de Firebase del usuario
const firebaseConfig = {
  apiKey: "AIzaSyDJE3mYAvvOyrmL2riktXB-mdt0iH2iN5k",
  authDomain: "laoficina-81e4a.firebaseapp.com",
  projectId: "laoficina-81e4a",
  storageBucket: "laoficina-81e4a.firebasestorage.app",
  messagingSenderId: "733303320739",
  appId: "1:733303320739:web:b24a466bcad169c21c4f16",
  measurementId: "G-ER0ZYJ270J"
};

// Inicializar Firebase y Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app); // <-- ESTA LÍNEA ES VITAL Y FALTABA EN TU CÓDIGO

// ============================================================
//  ESTADO LOCAL
// ============================================================
let currentUser = {
  name: "",
  avatar: "",
};

// Semillas para los avatares (estilos DiceBear)
const AVATAR_STYLES = ["fun-emoji", "bottts", "adventurer", "lorelei"];
const AVATAR_SEEDS = ["Felix", "Aneka", "Milo", "Luna", "Leo", "Nina", "Oscar", "Zoe", "Max", "Chloe"];

// ============================================================
//  ELEMENTOS DEL DOM
// ============================================================
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

const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");

// ============================================================
//  UTILIDADES
// ============================================================
function avatarUrl(style, seed) {
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=transparent`;
}

function formatTime(timestamp) {
  if (!timestamp) return "ahora";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function showModal(modal) {
  modal.hidden = false;
}
function hideModal(modal) {
  modal.hidden = true;
}

// ============================================================
//  LOGIN / SELECCIÓN DE AVATAR
// ============================================================
let selectedAvatarUrl = "";

function buildAvatarPicker() {
  avatarGrid.innerHTML = "";
  AVATAR_STYLES.forEach((style) => {
    AVATAR_SEEDS.forEach((seed) => {
      const url = avatarUrl(style, seed);
      const img = document.createElement("img");
      img.src = url;
      img.className = "avatar-option";
      img.alt = `Avatar ${seed}`;
      img.addEventListener("click", () => {
        document.querySelectorAll(".avatar-option").forEach((el) => el.classList.remove("selected"));
        img.classList.add("selected");
        selectedAvatarUrl = url;
      });
      avatarGrid.appendChild(img);
    });
  });

  // Seleccionar el primero por defecto
  const first = avatarGrid.querySelector(".avatar-option");
  if (first) {
    first.classList.add("selected");
    selectedAvatarUrl = first.src;
  }
}

function enterApp() {
  const name = nameInput.value.trim();
  if (!name) {
    alert("Por favor, escribe tu nombre.");
    return;
  }
  if (!selectedAvatarUrl) {
    alert("Elige un avatar.");
    return;
  }

  currentUser.name = name;
  currentUser.avatar = selectedAvatarUrl;

  // Persistencia local (para recargar sin volver a entrar)
  localStorage.setItem("officeLiveUser", JSON.stringify(currentUser));

  updateProfileUI();
  hideModal(loginModal);
  loadChat();
  loadPolls();
}

function updateProfileUI() {
  headerAvatar.src = currentUser.avatar;
  headerName.textContent = currentUser.name;
  userProfile.hidden = false;
  loginBtn.hidden = true;
}

function checkSavedUser() {
  const saved = localStorage.getItem("officeLiveUser");
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      if (currentUser.name && currentUser.avatar) {
        updateProfileUI();
        loadChat();
        loadPolls();
        return;
      }
    } catch (_) {}
  }
  // Si no hay usuario guardado, abrir modal
  buildAvatarPicker();
  showModal(loginModal);
}

// Eventos de login
loginBtn.addEventListener("click", () => {
  buildAvatarPicker();
  showModal(loginModal);
});

changeAvatarBtn.addEventListener("click", () => {
  buildAvatarPicker();
  showModal(loginModal);
});

enterBtn.addEventListener("click", enterApp);

nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") enterApp();
});

// ============================================================
//  CHAT EN VIVO
// ============================================================
let chatUnsubscribe = null;

function loadChat() {
  if (chatUnsubscribe) chatUnsubscribe();

  const q = query(collection(db, "messages"), orderBy("createdAt", "asc"), limit(200));
  chatUnsubscribe = onSnapshot(q, (snapshot) => {
    chatMessages.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const msg = docSnap.data();
      renderChatMessage(msg);
    });
    // Scroll al final
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}

function renderChatMessage(msg) {
  const div = document.createElement("div");
  div.className = "chat-message";
  div.innerHTML = `
    <img class="msg-avatar" src="${msg.avatar || avatarUrl("fun-emoji", "default")}" alt="${msg.name}" />
    <div class="msg-body">
      <div class="msg-header">
        <span class="msg-name">${escapeHtml(msg.name)}</span>
        <span class="msg-time">${formatTime(msg.createdAt)}</span>
      </div>
      <div class="msg-text">${escapeHtml(msg.text)}</div>
    </div>
  `;
  chatMessages.appendChild(div);
}

async function sendChatMessage(text) {
  if (!text.trim() || !currentUser.name) return;

  await addDoc(collection(db, "messages"), {
    name: currentUser.name,
    avatar: currentUser.avatar,
    text: text.trim(),
    createdAt: serverTimestamp(),
  });
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = chatInput.value;
  chatInput.value = "";
  await sendChatMessage(text);
});

// ============================================================
//  VOTACIONES
// ============================================================
let pollsUnsubscribe = null;

function loadPolls() {
  if (pollsUnsubscribe) pollsUnsubscribe();

  const q = query(collection(db, "polls"), orderBy("createdAt", "desc"));
  pollsUnsubscribe = onSnapshot(q, (snapshot) => {
    pollsContainer.innerHTML = "";
    if (snapshot.empty) {
      pollsContainer.innerHTML = `<p class="empty-state">Aún no hay votaciones. ¡Crea la primera! 🚀</p>`;
      return;
    }
    snapshot.forEach((docSnap) => {
      const poll = { id: docSnap.id, ...docSnap.data() };
      renderPoll(poll);
    });
  });
}

function renderPoll(poll) {
  const totalVotes = Object.values(poll.votes || {}).reduce((a, b) => a + b, 0);

  const card = document.createElement("div");
  card.className = "poll-card";

  const optionsHtml = (poll.options || [])
    .map((opt, idx) => {
      const count = poll.votes?.[idx] || 0;
      const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
      return `
        <button class="poll-option-btn" data-poll-id="${poll.id}" data-option-idx="${idx}">
          <span class="option-bar" style="width:${percent}%"></span>
          <span class="option-text">${escapeHtml(opt)}</span>
          <span class="option-count">${count} · ${percent}%</span>
        </button>
      `;
    })
    .join("");

  card.innerHTML = `
    <div class="poll-question">${escapeHtml(poll.question)}</div>
    <div class="poll-options">${optionsHtml}</div>
    <div class="poll-footer">
      <span>${totalVotes} voto${totalVotes !== 1 ? "s" : ""}</span>
      <span>Creada por ${escapeHtml(poll.creator || "alguien")}</span>
    </div>
  `;

  // Deshabilitar si ya votó (localStorage)
  const votedKey = `voted_${poll.id}`;
  const hasVoted = localStorage.getItem(votedKey);

  card.querySelectorAll(".poll-option-btn").forEach((btn) => {
    if (hasVoted) btn.disabled = true;

    btn.addEventListener("click", async () => {
      if (localStorage.getItem(votedKey)) return;

      const idx = btn.dataset.optionIdx;
      const pollRef = doc(db, "polls", poll.id);

      // Incremento atómico (evita condiciones de carrera)
      await updateDoc(pollRef, {
        [`votes.${idx}`]: increment(1),
      });

      localStorage.setItem(votedKey, "true");

      // 🎉 Confetti
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#6366f1", "#f472b6", "#34d399", "#fbbf24"],
      });

      // Deshabilitar todos los botones de esta tarjeta
      card.querySelectorAll(".poll-option-btn").forEach((b) => (b.disabled = true));
    });
  });

  pollsContainer.appendChild(card);
}

// ============================================================
//  CREAR VOTACIÓN
// ============================================================
newPollBtn.addEventListener("click", () => {
  pollQuestion.value = "";
  pollOptionsContainer.innerHTML = `
    <input type="text" class="text-input poll-option" placeholder="Opción 1" maxlength="60" />
    <input type="text" class="text-input poll-option" placeholder="Opción 2" maxlength="60" />
  `;
  showModal(pollModal);
});

addOptionBtn.addEventListener("click", () => {
  const count = pollOptionsContainer.querySelectorAll(".poll-option").length;
  if (count >= 6) {
    alert("Máximo 6 opciones.");
    return;
  }
  const input = document.createElement("input");
  input.type = "text";
  input.className = "text-input poll-option";
  input.placeholder = `Opción ${count + 1}`;
  input.maxLength = 60;
  pollOptionsContainer.appendChild(input);
});

createPollBtn.addEventListener("click", async () => {
  const question = pollQuestion.value.trim();
  const optionInputs = [...pollOptionsContainer.querySelectorAll(".poll-option")];
  const options = optionInputs.map((i) => i.value.trim()).filter(Boolean);

  if (!question) {
    alert("Escribe una pregunta.");
    return;
  }
  if (options.length < 2) {
    alert("Necesitas al menos 2 opciones.");
    return;
  }

  const votes = {};
  options.forEach((_, i) => (votes[i] = 0));

  await addDoc(collection(db, "polls"), {
    question,
    options,
    votes,
    creator: currentUser.name,
    createdAt: serverTimestamp(),
  });

  hideModal(pollModal);
});

// ============================================================
//  ESCAPE HTML (seguridad básica)
// ============================================================
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================
//  INICIALIZACIÓN
// ============================================================
checkSavedUser();
