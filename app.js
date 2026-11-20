import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  initializeFirestore, collection, addDoc, onSnapshot, query, orderBy, limit,
  serverTimestamp, doc, updateDoc, increment, deleteDoc, setDoc, getDoc, getDocs,
  runTransaction, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
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

// Helper XSS
function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function relativeTime(ms) {
  const diff = Math.max(0, Date.now() - ms);
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 0) return `hace ${day}d`;
  if (hr > 0) return `hace ${hr}h`;
  if (min > 0) return `hace ${min}m`;
  return `hace ${sec}s`;
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

let gameConfig = { muteDuration: 60, hpRegen: 1, moneyLimit: 10000 };

// ============================================================
//  AJUSTES DE AGARRE (persistentes)
// ============================================================
const GRAB_SETTINGS_KEY = "laoficina_grab_settings_v1";
const GRAB_DEFAULTS = { keyCode: "Space", keyLabel: "ESPACIO", mode: "hold", minHoldMs: 120 };
const GRAB_KEY_OPTIONS = [
  { code: "Space", label: "ESPACIO" }, { code: "KeyE", label: "E" }, { code: "KeyQ", label: "Q" },
  { code: "KeyX", label: "X" }, { code: "KeyZ", label: "Z" }, { code: "ShiftLeft", label: "SHIFT IZQ." }
];

let grabSettings = { ...GRAB_DEFAULTS };
function loadGrabSettings() {
  try {
    const raw = localStorage.getItem(GRAB_SETTINGS_KEY);
    if (raw) grabSettings = { ...GRAB_DEFAULTS, ...JSON.parse(raw) };
  } catch (_) {}
}
function saveGrabSettings() {
  try { localStorage.setItem(GRAB_SETTINGS_KEY, JSON.stringify(grabSettings)); } catch (_) {}
  updateGrabHint();
}
loadGrabSettings();

function updateGrabHint() {
  const label = grabSettings.keyLabel;
  const hint = document.getElementById("grabHint");
  if (hint) hint.innerHTML = `<strong>${label}</strong> (mantener) para agarrar · <strong>F</strong> para golpear`;
}

// ============================================================
//  AUTENTICACIÓN Y PERFIL
// ============================================================
document.getElementById("googleLoginBtn")?.addEventListener("click", async () => {
  try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { alert(e.message); }
});
document.getElementById("loginEmailBtn")?.addEventListener("click", async () => {
  const e = document.getElementById("emailInput").value, p = document.getElementById("passwordInput").value;
  if (!e || !p) return alert("Completa los campos");
  try { await signInWithEmailAndPassword(auth, e, p); } catch (err) { alert(err.message); }
});
document.getElementById("registerEmailBtn")?.addEventListener("click", async () => {
  const e = document.getElementById("emailInput").value, p = document.getElementById("passwordInput").value;
  if (!e || !p) return alert("Completa los campos");
  try { await createUserWithEmailAndPassword(auth, e, p); } catch (err) { alert(err.message); }
});
logoutBtn?.addEventListener("click", () => { if (confirm("¿Salir?")) { signOut(auth); window.location.reload(); } });

onAuthStateChanged(auth, async (user) => {
  if (user) {
    loginModal.hidden = true;
    userProfile.hidden = false;

    const userEmail = user.email ? user.email.trim().toLowerCase() : "";
    const isAdminEmail = (userEmail === 'crsph2@gmail.com');
    currentUser.isAdmin = isAdminEmail;
    if (adminBtn) adminBtn.style.display = isAdminEmail ? 'inline-flex' : 'none';

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
      await setDoc(userDocRef, {
        name: currentUser.name, avatar: currentUser.avatar, hp: currentUser.hp,
        mutedUntil: currentUser.mutedUntil, immunity: currentUser.immunity
      });
    }

    currentUser.isAdmin = isAdminEmail;
    if (adminBtn) adminBtn.style.display = isAdminEmail ? 'inline-flex' : 'none';
    updateProfileUI();
    refreshAdminTabVisibility();

    onSnapshot(doc(db, "game_config", "main"), (docSnap) => {
      if (docSnap.exists()) {
        gameConfig = { ...gameConfig, ...docSnap.data() };
        if (adminMuteTime) adminMuteTime.value = gameConfig.muteDuration;
        if (adminHpRegen) adminHpRegen.value = gameConfig.hpRegen;
        if (adminMoneyLimit) adminMoneyLimit.value = gameConfig.moneyLimit;
        if (ssLimitDisplay) ssLimitDisplay.textContent = `Límite: $${(gameConfig.moneyLimit || 10000).toLocaleString('es-CL')}`;
      } else if (currentUser.isAdmin) {
        setDoc(doc(db, "game_config", "main"), gameConfig);
      }
    });

    if (!appInitialized) {
      initRealtime();
      initOffice();
      initSecretSanta();
      initSuggestions();
      appInitialized = true;
    }
  } else {
    loginModal.hidden = false;
    userProfile.hidden = true;
    appInitialized = false;
    if (adminBtn) adminBtn.style.display = 'none';
    refreshAdminTabVisibility();
    currentUser = { uid: "", email: "", name: "", avatar: "", hp: 100, mutedUntil: 0, isAdmin: false, immunity: false };
  }
});

function updateProfileUI() {
  if (headerAvatar) headerAvatar.src = currentUser.avatar;
  if (headerName) headerName.textContent = currentUser.name;
}

document.getElementById("changeAvatarBtn")?.addEventListener("click", () => {
  editNameInput.value = currentUser.name;
  buildAvatarPicker();
  profileModal.hidden = false;
});

saveProfileBtn?.addEventListener("click", async () => {
  const newName = editNameInput.value.trim();
  if (!newName) return alert("El nombre no puede estar vacío");
  currentUser.name = newName;
  await updateDoc(doc(db, "users_data", currentUser.uid), { name: newName, avatar: currentUser.avatar });
  updateProfileUI();
  savePosition();
  profileModal.hidden = true;
});

function buildAvatarPicker() {
  if (!avatarGrid) return;
  avatarGrid.innerHTML = "";
  AVATAR_STYLES.forEach((style) => {
    AVATAR_SEEDS.forEach((seed) => {
      const url = avatarUrl(style, seed);
      const img = document.createElement("img");
      img.src = url;
      img.className = "avatar-option";
      if (currentUser.avatar === url) img.classList.add("selected");
      img.addEventListener("click", () => {
        document.querySelectorAll(".avatar-option").forEach((el) => el.classList.remove("selected"));
        img.classList.add("selected");
        currentUser.avatar = url;
        if (headerAvatar) headerAvatar.src = url;
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
  adminImmunityBtn.style.background = currentUser.immunity ? 'var(--success)' : 'var(--primary)';
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
  adminImmunityBtn.style.background = currentUser.immunity ? 'var(--success)' : 'var(--primary)';
  adminModal.hidden = false;
});

// ============================================================
//  AJUSTES DE AGARRE (modal)
// ============================================================
const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");
const grabKeySelect = document.getElementById("grabKeySelect");
const grabModeHold = document.getElementById("grabModeHold");
const grabModeToggle = document.getElementById("grabModeToggle");
const grabMinHold = document.getElementById("grabMinHold");
const grabMinHoldLabel = document.getElementById("grabMinHoldLabel");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");

function hydrateSettingsUI() {
  if (!grabKeySelect) return;
  grabKeySelect.innerHTML = GRAB_KEY_OPTIONS.map(o => `<option value="${o.code}">${o.label}</option>`).join("");
  grabKeySelect.value = grabSettings.keyCode;
  grabModeHold.checked = grabSettings.mode === "hold";
  grabModeToggle.checked = grabSettings.mode === "toggle";
  grabMinHold.value = grabSettings.minHoldMs;
  grabMinHoldLabel.textContent = `${grabSettings.minHoldMs} ms`;
}

settingsBtn?.addEventListener("click", () => { hydrateSettingsUI(); settingsModal.hidden = false; });
grabMinHold?.addEventListener("input", () => { grabMinHoldLabel.textContent = `${grabMinHold.value} ms`; });
saveSettingsBtn?.addEventListener("click", () => {
  const opt = GRAB_KEY_OPTIONS.find(o => o.code === grabKeySelect.value) || GRAB_KEY_OPTIONS[0];
  grabSettings.keyCode = opt.code;
  grabSettings.keyLabel = opt.label;
  grabSettings.mode = grabModeHold.checked ? "hold" : "toggle";
  grabSettings.minHoldMs = parseInt(grabMinHold.value) || 120;
  saveGrabSettings();
  settingsModal.hidden = true;
});

// ============================================================
//  BUZÓN DE SUGERENCIAS
// ============================================================
function refreshAdminTabVisibility() {
  const tabBtn = document.getElementById("tabBtnSuggestions");
  if (!tabBtn) return;
  tabBtn.hidden = !currentUser.isAdmin;
  const tabContent = document.getElementById("tab-suggestions");
  if (!currentUser.isAdmin && tabContent) {
    tabContent.classList.remove("active");
    // si la pestaña activa era esta, volver a tools
    const activeBtn = document.querySelector(".tab-btn.active");
    if (activeBtn && activeBtn.id === "tabBtnSuggestions") {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      document.querySelector('[data-tab="tools"]').classList.add("active");
      document.getElementById("tab-tools").classList.add("active");
    }
  }
}

function initSuggestions() {
  // Botón "Ideas" siempre disponible
  document.getElementById("ideasBtn")?.addEventListener("click", () => {
    if (!currentUser.uid) return alert("Inicia sesión para enviar ideas.");
    document.getElementById("suggestionTitle").value = "";
    document.getElementById("suggestionBody").value = "";
    document.getElementById("suggestionModal").hidden = false;
  });
  document.getElementById("sendSuggestionBtn")?.addEventListener("click", async () => {
    const title = document.getElementById("suggestionTitle").value.trim();
    const body = document.getElementById("suggestionBody").value.trim();
    if (!title || !body) return alert("Completa el título y la descripción.");
    if (!currentUser.uid) return;
    await addDoc(collection(db, "suggestions"), {
      uid: currentUser.uid,
      name: currentUser.name,
      avatar: currentUser.avatar,
      title, body,
      read: false,
      createdAt: serverTimestamp()
    });
    document.getElementById("suggestionModal").hidden = true;
    alert("¡Gracias! Tu idea fue enviada en privado al admin. 💌");
  });

  if (!currentUser.isAdmin) return;

  onSnapshot(
    query(collection(db, "suggestions"), orderBy("createdAt", "desc")),
    (snap) => {
      renderSuggestions(snap);
      const unread = snap.docs.filter(d => !d.data().read).length;
      const badge = document.getElementById("suggestionBadge");
      if (badge) { badge.textContent = unread || ""; badge.hidden = unread === 0; }
    },
    (err) => {
      console.error("Suggestions:", err);
      const list = document.getElementById("suggestionsList");
      if (list) list.innerHTML = `<p style="color:var(--danger);">Error al cargar el buzón.</p>`;
    }
  );

  document.getElementById("markAllReadBtn")?.addEventListener("click", async () => {
    const list = document.getElementById("suggestionsList");
    if (!list) return;
    const unreadDocs = [...list.querySelectorAll(".suggestion-card.unread")];
    if (unreadDocs.length === 0) return;
    const batch = writeBatch(db);
    unreadDocs.forEach(el => {
      const id = el.dataset.id;
      if (id) batch.update(doc(db, "suggestions", id), { read: true });
    });
    try { await batch.commit(); } catch (e) { console.error(e); alert("Error al marcar como leídas."); }
  });
}

function renderSuggestions(snap) {
  const list = document.getElementById("suggestionsList");
  if (!list) return;
  if (snap.empty) {
    list.innerHTML = `<p style="color:var(--text-dim); text-align:center; padding:20px;">Aún no hay ideas recibidas. 🎅</p>`;
    return;
  }
  list.innerHTML = snap.docs.map(d => {
    const data = d.data();
    const created = data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now();
    return `
      <div class="suggestion-card ${data.read ? 'read' : 'unread'}" data-id="${d.id}"
           onclick="markSuggestionRead('${d.id}')">
        <div class="suggestion-header">
          <img class="suggestion-avatar" src="${escapeHtml(data.avatar || '')}" alt="" />
          <div class="suggestion-meta">
            <strong>${escapeHtml(data.name || 'Anónimo')}</strong>
            <span>${relativeTime(created)}</span>
          </div>
          <button class="btn-delete-small" title="Eliminar"
                  onclick="event.stopPropagation(); deleteSuggestion('${d.id}')">🗑️</button>
        </div>
        <h4 class="suggestion-title">${escapeHtml(data.title || '')}</h4>
        <p class="suggestion-body">${escapeHtml(data.body || '')}</p>
      </div>
    `;
  }).join("");
}

window.markSuggestionRead = async (id) => {
  if (!currentUser.isAdmin) return;
  try { await updateDoc(doc(db, "suggestions", id), { read: true }); } catch (e) { console.error(e); }
};
window.deleteSuggestion = async (id) => {
  if (!currentUser.isAdmin) return;
  if (!confirm("¿Eliminar esta sugerencia?")) return;
  try { await deleteDoc(doc(db, "suggestions", id)); } catch (e) { console.error(e); }
};

// ============================================================
//  HERRAMIENTAS
// ============================================================
function initRealtime() {
  initChat();
  initPolls();
  initTools();
}

function initTools() {
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
    if (!bdayList) return;
    bdayList.innerHTML = "";
    const bdays = [];
    snapshot.forEach(d => {
      const data = d.data(); const bDate = new Date(data.date + 'T00:00:00');
      const now = new Date(); let nextBday = new Date(now.getFullYear(), bDate.getMonth(), bDate.getDate());
      if (nextBday < now) nextBday.setFullYear(now.getFullYear() + 1);
      bdays.push({ id: d.id, ...data, daysDiff: Math.ceil((nextBday - now) / 86400000), bDate });
    });
    bdays.sort((a, b) => a.daysDiff - b.daysDiff).forEach((b, i) => {
      const li = document.createElement("li");
      if (i === 0) li.classList.add("highlight");
      li.innerHTML = `<span>${escapeHtml(b.name)} <small>(${b.bDate.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })})</small></span>
        <div><span style="color:var(--accent); font-size:0.8rem; font-weight:bold;">en ${b.daysDiff}d</span>
        <button class="btn-delete-small" data-id="${b.id}">×</button></div>`;
      bdayList.appendChild(li);
    });
    document.querySelectorAll("#bdayList .btn-delete-small").forEach(btn => btn.onclick = async (e) =>
      await deleteDoc(doc(db, "birthdays", e.target.dataset.id)));
  }, () => {
    document.getElementById("bdayList").innerHTML = "<li style='color:red; font-size:0.8rem;'>Error de conexión.</li>";
  });

  const purchaseCollection = collection(db, "water_logs");
  if (document.getElementById("purchaseDate")) document.getElementById("purchaseDate").valueAsDate = new Date();
  document.getElementById("purchaseForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await addDoc(purchaseCollection, {
      name: document.getElementById("buyerName").value,
      item: document.getElementById("itemBought").value,
      date: document.getElementById("purchaseDate").value
    });
    e.target.reset(); document.getElementById("purchaseDate").valueAsDate = new Date();
  });

  onSnapshot(query(purchaseCollection, orderBy("date", "desc"), limit(15)), (snapshot) => {
    const purchaseLog = document.getElementById("purchaseLog");
    if (!purchaseLog) return;
    purchaseLog.innerHTML = snapshot.empty ? "<p>No hay compras.</p>" : "";
    snapshot.forEach(d => {
      const data = d.data(); const fDate = data.date.split('-').reverse().join('/');
      purchaseLog.innerHTML += `<div class="purchase-item">
        <div class="purchase-item-details">
          <span class="purchase-name">${escapeHtml(data.name)}</span>
          <span class="purchase-thing">🛒 ${escapeHtml(data.item || "Agua")}</span>
          <span class="purchase-date">📅 ${fDate}</span>
        </div>
        <button class="btn-delete-small" onclick="deletePurchase('${d.id}')">🗑️</button>
      </div>`;
    });
  }, () => {
    document.getElementById("purchaseLog").innerHTML = "<p style='color:red; font-size:0.8rem;'>Error de conexión.</p>";
  });
}

window.deletePurchase = async (id) => { if (confirm("¿Eliminar registro?")) await deleteDoc(doc(db, "water_logs", id)); };

// ============================================================
//  AMIGO SECRETO
// ============================================================
let ssDrawn = false;
let mySSList = [];
let hasJoinedSS = false;

function initSecretSanta() {
  if (!ssContent) return;
  onSnapshot(doc(db, "ss_config", "main"), (docSnap) => {
    ssDrawn = docSnap.exists() ? !!docSnap.data().drawn : false;
    renderSS();
  }, () => {
    ssContent.innerHTML = `<div class="ss-card"><p style="color:var(--danger);">Error de conexión.</p></div>`;
  });
  onSnapshot(doc(db, "ss_lists", currentUser.uid), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      hasJoinedSS = data.joined || false;
      mySSList = data.gifts || [];
    } else { hasJoinedSS = false; mySSList = []; }
    renderSS();
  }, () => { mySSList = []; renderSS(); });
  onSnapshot(doc(db, "ss_results", currentUser.uid), (docSnap) => {
    renderSS(docSnap.exists() ? docSnap.data() : null);
  }, () => { renderSS(null); });
}

async function renderSS(myResult = null) {
  if (!ssContent) return;
  try {
    if (!Array.isArray(mySSList)) mySSList = [];
    ssContent.innerHTML = "";

    if (ssDrawn) {
      if (myResult && myResult.targetName) {
        const gifts = myResult.targetGifts || [];
        let giftsHTML = gifts.map(g => `<li>${escapeHtml(g)}</li>`).join("");
        if (gifts.length === 0) giftsHTML = "<li>No puso ideas de regalo 😢</li>";
        ssContent.innerHTML = `
          <div class="ss-card">
            <h3>🎅 Te toca regalar a:</h3>
            <p style="font-size: 1.5rem; font-weight: 800; color: var(--success); margin: 10px 0;">${escapeHtml(myResult.targetName)}</p>
            <p style="font-size: 0.9rem; color: var(--text-dim);">Límite sugerido: $${(gameConfig.moneyLimit || 10000).toLocaleString('es-CL')}</p>
            <div style="margin-top: 20px; text-align: left;">
              <h4 style="color: var(--accent); margin-bottom: 8px;">Lista de ideas de regalo:</h4>
              <ul class="ss-gift-list">${giftsHTML}</ul>
            </div>
          </div>`;
      } else {
        ssContent.innerHTML = `<div class="ss-card"><p>El sorteo ya se realizó. No participaste esta vez.</p></div>`;
      }
      return;
    }

    if (!hasJoinedSS) {
      ssContent.innerHTML = `
        <div class="ss-card" style="padding: 40px 20px;">
          <h3>¿Quieres participar?</h3>
          <p style="font-size: 0.9rem; margin-bottom: 20px; color: var(--text-dim);">Únete al Amigo Secreto para que el sistema te asigne a alguien y puedas poner tu lista de regalos.</p>
          <button id="joinSSBtn" class="btn btn-primary" style="padding: 15px 30px; font-size: 1.1rem;">🎁 Unirme al Amigo Secreto</button>
        </div>`;
      document.getElementById("joinSSBtn")?.addEventListener("click", async () => {
        await setDoc(doc(db, "ss_lists", currentUser.uid), { uid: currentUser.uid, name: currentUser.name, joined: true, gifts: [] });
      });
      return;
    }

    let giftListHTML = mySSList.map((g, i) => `
      <li><span>${escapeHtml(g)}</span> <button class="btn-delete-small" onclick="removeGift(${i})">×</button></li>`).join("");

    let adminControls = "";
    if (currentUser.isAdmin) {
      adminControls = `
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px dashed var(--border);">
          <p style="color: var(--danger); font-weight: bold; margin-bottom: 10px;">⚠️ Zona Admin</p>
          <button id="drawSSBtn" class="btn btn-primary" style="width: 100%;">🎲 Realizar Sorteo Ahora</button>
        </div>`;
    }

    ssContent.innerHTML = `
      <div class="ss-card">
        <h3>¡Estás participando!</h3>
        <p style="font-size: 0.9rem; margin-bottom: 15px;">Límite de regalo: <strong>$${(gameConfig.moneyLimit || 10000).toLocaleString('es-CL')}</strong></p>
        <p style="font-size: 0.85rem; color: var(--text-dim); margin-bottom: 15px;">Agrega ideas de regalos. Solo tu amigo secreto podrá ver esta lista.</p>
        <form id="addGiftForm" class="inline-form">
          <input type="text" id="newGiftInput" placeholder="Ej: Taza de café, Chocolate..." maxlength="50" class="text-input" required />
          <button type="submit" class="btn btn-accent">Añadir</button>
        </form>
        <ul class="ss-gift-list" style="margin-top: 15px;">
          ${giftListHTML || '<li style="color:var(--text-dim); justify-content:center;">Aún no has agregado regalos.</li>'}
        </ul>
        ${adminControls}
      </div>`;

    document.getElementById("addGiftForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = document.getElementById("newGiftInput");
      if (!input.value.trim()) return;
      mySSList.push(input.value.trim());
      await setDoc(doc(db, "ss_lists", currentUser.uid), { uid: currentUser.uid, name: currentUser.name, joined: true, gifts: mySSList });
    });
    document.getElementById("drawSSBtn")?.addEventListener("click", drawSecretSanta);
  } catch (err) { console.error(err); }
}

window.removeGift = async (index) => {
  mySSList.splice(index, 1);
  await setDoc(doc(db, "ss_lists", currentUser.uid), { gifts: mySSList }, { merge: true });
};

async function drawSecretSanta() {
  if (!confirm("¿Estás seguro? Se asignarán los amigos secretos y no se podrá deshacer.")) return;
  try {
    const listsSnap = await getDocs(collection(db, "ss_lists"));
    let participants = [];
    listsSnap.forEach(d => {
      const data = d.data();
      if (data.joined || (data.gifts && data.gifts.length > 0)) participants.push(data);
    });
    if (participants.length < 3) return alert("Se necesitan al menos 3 personas para sortear.");

    let shuffled = [], success = false;
    while (!success) {
      shuffled = [...participants].sort(() => Math.random() - 0.5);
      success = true;
      for (let i = 0; i < participants.length; i++) {
        if (participants[i].uid === shuffled[i].uid) { success = false; break; }
      }
    }
    for (let i = 0; i < participants.length; i++) {
      const giver = participants[i], receiver = shuffled[i];
      await setDoc(doc(db, "ss_results", giver.uid), {
        targetUid: receiver.uid, targetName: receiver.name, targetGifts: receiver.gifts || []
      });
    }
    await setDoc(doc(db, "ss_config", "main"), { drawn: true });
    alert("¡Sorteo realizado!");
  } catch (error) { console.error(error); alert("Error al realizar el sorteo."); }
}

// ============================================================
//  OFICINA VIRTUAL
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

// Agarre
const GRAB_DISTANCE = 70;
const GRAB_BREAK_DISTANCE = 140;
let isGrabbing = false;
let grabbedPlayerId = null;
let grabOffset = { x: 0, y: 0 };
let grabHoldStart = 0;
let isHoldingGrabKey = false;
let grabToggleActive = false;
let lastGrabbedWrite = { x: 0, y: 0 };
let iAmGrabbed = false;
let grabberUid = null;
let grabReadyTargetId = null;
let grabPulsePhase = 0;

const avatarImageCache = {};
function getAvatarImage(url) {
  if (!avatarImageCache[url]) { const img = new Image(); img.src = url; avatarImageCache[url] = img; }
  return avatarImageCache[url];
}

function initOffice() {
  if (!officeCanvas || !canvasContainer) return;
  const resizeObserver = new ResizeObserver(() => {
    officeCanvas.width = canvasContainer.clientWidth;
    officeCanvas.height = canvasContainer.clientHeight;
  });
  resizeObserver.observe(canvasContainer);
  officeCanvas.width = canvasContainer.clientWidth;
  officeCanvas.height = canvasContainer.clientHeight;

  onSnapshot(positionsCollection, (snapshot) => {
    players = {};
    let myGrabbedBy = null;
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (docSnap.id === currentUser.uid) {
        if (data.hp !== undefined && data.hp < currentUser.hp && !currentUser.immunity) currentUser.hp = data.hp;
        myGrabbedBy = data.grabbedBy || null;
      } else { players[docSnap.id] = data; }
    });
    if (myGrabbedBy && myGrabbedBy !== currentUser.uid) {
      iAmGrabbed = true; grabberUid = myGrabbedBy; targetPosition = null;
      keys.ArrowUp = keys.ArrowDown = keys.ArrowLeft = keys.ArrowRight = false;
    } else { iAmGrabbed = false; grabberUid = null; }
  }, (error) => { console.error("Error Posiciones:", error); });

  setInterval(() => {
    if (currentUser.hp < 100 && !iAmGrabbed) {
      currentUser.hp = Math.min(100, currentUser.hp + gameConfig.hpRegen);
      updateHP();
    }
  }, 1000);

  savePosition();
  setInterval(() => { if (currentUser.name && !iAmGrabbed) savePosition(); }, 2000);

  officeCanvas.addEventListener("keydown", (e) => {
    if (keys.hasOwnProperty(e.key)) { keys[e.key] = true; targetPosition = null; e.preventDefault(); }
    if (e.code === "KeyF") { e.preventDefault(); attack(); return; }
    if (e.code === grabSettings.keyCode) {
      e.preventDefault();
      if (grabSettings.mode === "toggle") {
        if (!grabToggleActive) { grabToggleActive = true; tryStartGrab(); }
        else { grabToggleActive = false; endGrab(); }
      } else {
        if (!isHoldingGrabKey) { isHoldingGrabKey = true; grabHoldStart = Date.now(); }
      }
    }
  });
  officeCanvas.addEventListener("keyup", (e) => {
    if (keys.hasOwnProperty(e.key)) { keys[e.key] = false; e.preventDefault(); }
    if (e.code === grabSettings.keyCode && grabSettings.mode === "hold") {
      isHoldingGrabKey = false;
      if (isGrabbing) endGrab();
    }
  });
  officeCanvas.addEventListener("pointerdown", (e) => {
    officeCanvas.focus();
    const rect = officeCanvas.getBoundingClientRect();
    const scaleX = officeCanvas.width / rect.width, scaleY = officeCanvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX, clickY = (e.clientY - rect.top) * scaleY;
    let clickedOnPlayer = false;
    Object.keys(players).forEach(id => {
      const p = players[id];
      if (Math.hypot(clickX - (p.x + PLAYER_SIZE / 2), clickY - (p.y + PLAYER_SIZE / 2)) < PLAYER_SIZE * 0.8) clickedOnPlayer = true;
    });
    if (!clickedOnPlayer && !iAmGrabbed) targetPosition = { x: clickX - PLAYER_SIZE / 2, y: clickY - PLAYER_SIZE / 2 };
  });

  const grabBtn = document.getElementById("grabTouchBtn");
  const attackBtn = document.getElementById("attackTouchBtn");
  if (grabBtn) {
    const start = (e) => {
      e.preventDefault(); e.stopPropagation(); grabBtn.classList.add("pressed");
      if (grabSettings.mode === "toggle") {
        if (!grabToggleActive) { grabToggleActive = true; tryStartGrab(); }
        else { grabToggleActive = false; endGrab(); }
      } else { isHoldingGrabKey = true; grabHoldStart = Date.now(); }
    };
    const stop = (e) => {
      e.preventDefault(); grabBtn.classList.remove("pressed");
      if (grabSettings.mode === "hold") { isHoldingGrabKey = false; if (isGrabbing) endGrab(); }
    };
    grabBtn.addEventListener("pointerdown", start);
    grabBtn.addEventListener("pointerup", stop);
    grabBtn.addEventListener("pointercancel", stop);
    grabBtn.addEventListener("pointerleave", stop);
  }
  if (attackBtn) attackBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); attack(); });

  requestAnimationFrame(gameLoop);
}

function findGrabCandidate() {
  let closest = null, minDist = GRAB_DISTANCE;
  Object.keys(players).forEach(id => {
    const p = players[id];
    if (!p || !p.lastUpdate) return;
    if (p.grabbedBy && p.grabbedBy !== currentUser.uid) return;
    const dx = (p.x + PLAYER_SIZE / 2) - (myPosition.x + PLAYER_SIZE / 2);
    const dy = (p.y + PLAYER_SIZE / 2) - (myPosition.y + PLAYER_SIZE / 2);
    const dist = Math.hypot(dx, dy);
    if (dist < minDist) { minDist = dist; closest = id; }
  });
  return closest;
}

async function tryStartGrab() {
  if (isGrabbing || iAmGrabbed) return false;
  const target = findGrabCandidate();
  if (!target) return false;
  const gp = players[target];
  grabOffset.x = Math.max(-PLAYER_SIZE * 1.5, Math.min(PLAYER_SIZE * 1.5, gp.x - myPosition.x));
  grabOffset.y = Math.max(-PLAYER_SIZE * 1.5, Math.min(PLAYER_SIZE * 1.5, gp.y - myPosition.y));
  isGrabbing = true; grabbedPlayerId = target;
  lastGrabbedWrite = { x: gp.x, y: gp.y };
  try { await updateDoc(doc(db, "positions", target), { grabbedBy: currentUser.uid }); } catch (e) { console.warn(e); }
  return true;
}

function endGrab() {
  if (!isGrabbing || !grabbedPlayerId) { isGrabbing = false; grabbedPlayerId = null; return; }
  const id = grabbedPlayerId;
  isGrabbing = false; grabbedPlayerId = null;
  try { updateDoc(doc(db, "positions", id), { grabbedBy: null }).catch(() => {}); } catch (_) {}
}

function updateGrabState() {
  if (grabSettings.mode === "hold" && isHoldingGrabKey && !isGrabbing) {
    if ((Date.now() - grabHoldStart) >= grabSettings.minHoldMs) tryStartGrab();
  }
  if (isGrabbing && grabbedPlayerId) {
    const gp = players[grabbedPlayerId];
    if (!gp) { endGrab(); return; }
    const dx = (gp.x + PLAYER_SIZE / 2) - (myPosition.x + PLAYER_SIZE / 2);
    const dy = (gp.y + PLAYER_SIZE / 2) - (myPosition.y + PLAYER_SIZE / 2);
    if (Math.hypot(dx, dy) > GRAB_BREAK_DISTANCE) { endGrab(); return; }
    const tx = myPosition.x + grabOffset.x, ty = myPosition.y + grabOffset.y;
    gp.x = tx; gp.y = ty;
    if (Math.abs(lastGrabbedWrite.x - tx) > 3 || Math.abs(lastGrabbedWrite.y - ty) > 3) {
      updateDoc(doc(db, "positions", grabbedPlayerId), { x: tx, y: ty }).catch(() => {});
      lastGrabbedWrite = { x: tx, y: ty };
    }
  }
  grabReadyTargetId = (!isGrabbing && !iAmGrabbed) ? findGrabCandidate() : null;
}

function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); }

function update() {
  if (!iAmGrabbed) {
    let moved = false;
    if (keys.ArrowUp) { myPosition.y -= MOVE_SPEED; moved = true; }
    if (keys.ArrowDown) { myPosition.y += MOVE_SPEED; moved = true; }
    if (keys.ArrowLeft) { myPosition.x -= MOVE_SPEED; moved = true; }
    if (keys.ArrowRight) { myPosition.x += MOVE_SPEED; moved = true; }
    if (targetPosition) {
      const dx = targetPosition.x - myPosition.x, dy = targetPosition.y - myPosition.y;
      const dist = Math.hypot(dx, dy);
      if (dist > MOVE_SPEED) {
        myPosition.x += (dx / dist) * MOVE_SPEED; myPosition.y += (dy / dist) * MOVE_SPEED; moved = true;
      } else { myPosition.x = targetPosition.x; myPosition.y = targetPosition.y; targetPosition = null; moved = true; }
    }
    if (!officeCanvas) return;
    myPosition.x = Math.max(0, Math.min(officeCanvas.width - PLAYER_SIZE, myPosition.x));
    myPosition.y = Math.max(0, Math.min(officeCanvas.height - PLAYER_SIZE, myPosition.y));
    if (moved) savePosition();
  }
  updateGrabState();
}

let lastSave = 0, myCurrentBubble = "", myBubbleTime = 0;

function savePosition() {
  if (!currentUser.name || iAmGrabbed) return;
  const now = Date.now();
  if (now - lastSave < 100) return;
  lastSave = now;
  let bubbleToSend = myCurrentBubble;
  if (now - myBubbleTime > 5000) { bubbleToSend = ""; myCurrentBubble = ""; }
  setDoc(doc(positionsCollection, currentUser.uid), {
    x: myPosition.x, y: myPosition.y, name: currentUser.name, avatar: currentUser.avatar,
    bubbleText: bubbleToSend, bubbleTime: myBubbleTime, lastUpdate: serverTimestamp()
  }, { merge: true });
}

function updateHP() {
  if (iAmGrabbed) return;
  updateDoc(doc(db, "positions", currentUser.uid), { hp: currentUser.hp, mutedUntil: currentUser.mutedUntil }).catch(() => {});
}

function attack() {
  if (iAmGrabbed) return;
  const now = Date.now();
  if (now - lastAttackTime < 800 || currentUser.mutedUntil > now) return;
  lastAttackTime = now;
  punchEffect = { x: myPosition.x, y: myPosition.y, time: now };
  let closest = null, minDist = 60;
  Object.keys(players).forEach(id => {
    const p = players[id];
    const dx = (p.x + PLAYER_SIZE / 2) - (myPosition.x + PLAYER_SIZE / 2);
    const dy = (p.y + PLAYER_SIZE / 2) - (myPosition.y + PLAYER_SIZE / 2);
    const d = Math.hypot(dx, dy);
    if (d < minDist) { minDist = d; closest = id; }
  });
  if (closest) {
    const t = players[closest];
    if (t.immunity) return;
    let newHp = (t.hp !== undefined ? t.hp : 100) - 25;
    let newMutedUntil = t.mutedUntil || 0;
    if (newHp <= 0) { newHp = 100; newMutedUntil = now + (gameConfig.muteDuration * 1000); }
    updateDoc(doc(db, "positions", closest), { hp: newHp, mutedUntil: newMutedUntil });
  }
}

function triggerBubble(text) {
  if (iAmGrabbed) return;
  myCurrentBubble = text; myBubbleTime = Date.now(); savePosition();
}

function draw() {
  if (!ctx || !officeCanvas || officeCanvas.width === 0) return;
  ctx.clearRect(0, 0, officeCanvas.width, officeCanvas.height);
  ctx.fillStyle = "#0a1710"; ctx.fillRect(0, 0, officeCanvas.width, officeCanvas.height);
  ctx.strokeStyle = "#14231c"; ctx.lineWidth = 1;
  for (let i = 0; i < officeCanvas.width; i += 32) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, officeCanvas.height); ctx.stroke(); }
  for (let i = 0; i < officeCanvas.height; i += 32) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(officeCanvas.width, i); ctx.stroke(); }

  grabPulsePhase = (grabPulsePhase + 0.05) % (Math.PI * 2);

  Object.keys(players).forEach((id) => {
    const p = players[id];
    if (!p.lastUpdate || (Date.now() - p.lastUpdate.toMillis() < 6000)) {
      drawPlayer(p.x, p.y, p.avatar, p.name, p.bubbleText, p.bubbleTime, p.hp, p.mutedUntil, p.immunity, {
        grabbedByOther: !!(p.grabbedBy && p.grabbedBy !== currentUser.uid),
        isGrabbable: (id === grabReadyTargetId)
      });
    }
  });
  drawPlayer(myPosition.x, myPosition.y, currentUser.avatar, currentUser.name, myCurrentBubble, myBubbleTime,
    currentUser.hp, currentUser.mutedUntil, currentUser.immunity,
    { isMe: true, isGrabbing, iAmGrabbed });

  if (isGrabbing && grabbedPlayerId && players[grabbedPlayerId]) {
    drawGrabConnection(myPosition, players[grabbedPlayerId]);
  }
  if (punchEffect && Date.now() - punchEffect.time < 200) {
    ctx.fillStyle = "rgba(255, 50, 50, 0.8)";
    ctx.beginPath(); ctx.arc(punchEffect.x + PLAYER_SIZE / 2 + 20, punchEffect.y + PLAYER_SIZE / 2, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 16px Arial"; ctx.textAlign = "left";
    ctx.fillText("¡POW!", punchEffect.x + PLAYER_SIZE, punchEffect.y);
  }
  if (isGrabbing) {
    ctx.save();
    ctx.globalAlpha = 0.85 + Math.sin(grabPulsePhase * 2) * 0.15;
    ctx.fillStyle = "rgba(251, 191, 36, 0.95)";
    ctx.font = "bold 11px Inter, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("SUELTA PARA LIBERAR", officeCanvas.width / 2, 18);
    ctx.restore();
  }
}

function drawPlayer(x, y, avatarUrl, name, bubbleText, bubbleTime, hp = 100, mutedUntil = 0, immunity = false, opts = {}) {
  if (!ctx) return;
  if (opts.isGrabbable) {
    ctx.save(); ctx.strokeStyle = "rgba(127, 211, 255, 0.85)"; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
    const r = PLAYER_SIZE / 2 + 8 + Math.sin(grabPulsePhase) * 2;
    ctx.beginPath(); ctx.arc(x + PLAYER_SIZE / 2, y + PLAYER_SIZE / 2, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  if (opts.iAmGrabbed) {
    ctx.save(); ctx.strokeStyle = "rgba(251, 191, 36, 0.85)"; ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
    const r = PLAYER_SIZE / 2 + 10;
    ctx.beginPath(); ctx.arc(x + PLAYER_SIZE / 2, y + PLAYER_SIZE / 2, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  const img = getAvatarImage(avatarUrl);
  if (img.complete) ctx.drawImage(img, x, y, PLAYER_SIZE, PLAYER_SIZE);
  else { ctx.fillStyle = opts.grabbedByOther ? "#7a8fae" : "#dc2626"; ctx.fillRect(x, y, PLAYER_SIZE, PLAYER_SIZE); }

  ctx.fillStyle = "#000"; ctx.fillRect(x, y - 12, PLAYER_SIZE, 5);
  ctx.fillStyle = immunity ? "#fbbf24" : (hp > 50 ? "#22c55e" : (hp > 20 ? "#fbbf24" : "#ef4444"));
  ctx.fillRect(x, y - 12, (hp / 100) * PLAYER_SIZE, 5);
  ctx.fillStyle = "#fff"; ctx.font = "bold 10px Inter, sans-serif"; ctx.textAlign = "center";
  ctx.fillText(name, x + PLAYER_SIZE / 2, y - 18);
  if (immunity) { ctx.font = "12px Arial"; ctx.fillText("🛡️", x + PLAYER_SIZE - 5, y - 20); }
  if (mutedUntil > Date.now()) { ctx.font = "14px Arial"; ctx.fillText("🤐", x + PLAYER_SIZE / 2, y - 25); }
  if (opts.grabbedByOther) { ctx.font = "16px Arial"; ctx.textAlign = "center"; ctx.fillText("🔒", x + PLAYER_SIZE / 2, y + PLAYER_SIZE / 2 + 6); }
  if (opts.isGrabbing) { ctx.font = "14px Arial"; ctx.textAlign = "center"; ctx.fillText("✋", x + PLAYER_SIZE / 2, y - 32); }

  if (bubbleText && bubbleText.trim() !== "") {
    const timeElapsed = Date.now() - bubbleTime;
    if (timeElapsed < 5000) drawBubble(x + PLAYER_SIZE / 2, y - 30, bubbleText, timeElapsed);
  }
}

function drawGrabConnection(a, b) {
  if (!ctx) return;
  const ax = a.x + PLAYER_SIZE / 2, ay = a.y + PLAYER_SIZE / 2;
  const bx = b.x + PLAYER_SIZE / 2, by = b.y + PLAYER_SIZE / 2;
  const grad = ctx.createLinearGradient(ax, ay, bx, by);
  grad.addColorStop(0, "rgba(127, 211, 255, 0.9)");
  grad.addColorStop(1, "rgba(127, 211, 255, 0.05)");
  ctx.save(); ctx.strokeStyle = grad; ctx.lineWidth = 3; ctx.setLineDash([6, 4]);
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.restore();
}

function drawBubble(cx, cy, text, timeElapsed) {
  if (!ctx) return;
  ctx.font = "12px Inter, sans-serif";
  let displayText = text; if (displayText.length > 30) displayText = displayText.substring(0, 27) + "...";
  const metrics = ctx.measureText(displayText); const textWidth = metrics.width;
  const padding = 8; const bubbleWidth = textWidth + padding * 2; const bubbleHeight = 28;
  let opacity = 1; if (timeElapsed < 300) opacity = timeElapsed / 300; else if (timeElapsed > 4500) opacity = 1 - (timeElapsed - 4500) / 500;
  ctx.globalAlpha = Math.max(0, opacity);
  const bx = cx - bubbleWidth / 2; const by = cy - bubbleHeight - 10;
  ctx.fillStyle = "#fff"; ctx.strokeStyle = "#333"; ctx.lineWidth = 1.5;
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx, by, bubbleWidth, bubbleHeight, 6); else ctx.rect(bx, by, bubbleWidth, bubbleHeight);
  ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 5, by + bubbleHeight); ctx.lineTo(cx, by + bubbleHeight + 8); ctx.lineTo(cx + 5, by + bubbleHeight);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#000"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(displayText, cx, by + bubbleHeight / 2);
  ctx.globalAlpha = 1.0; ctx.textBaseline = "alphabetic";
}

// ============================================================
//  CONTADORES
// ============================================================
function updateCountdowns() {
  const now = new Date();
  let targetYear = now.getFullYear();
  let jan29 = new Date(targetYear, 0, 29);
  while (jan29 < now || jan29.getDay() !== 5) { targetYear++; jan29 = new Date(targetYear, 0, 29); }
  if (document.getElementById("cd-jan29")) document.getElementById("cd-jan29").innerText = `${Math.floor((jan29 - now) / 86400000)} días`;

  const year = now.getFullYear();
  const holidays = [
    { name: "Año Nuevo", date: `${year}-01-01` }, { name: "Viernes Santo", date: `${year}-03-29` },
    { name: "Día del Trabajo", date: `${year}-05-01` }, { name: "Navidad", date: `${year}-12-25` }
  ];
  let nextHoliday = holidays.find(h => new Date(h.date + 'T00:00:00') > now);
  if (!nextHoliday) nextHoliday = { name: "Año Nuevo", date: new Date(year + 1, 0, 1) };
  if (document.getElementById("cd-holiday-name")) document.getElementById("cd-holiday-name").innerText = nextHoliday.name;
  if (document.getElementById("cd-holiday")) document.getElementById("cd-holiday").innerText = `${Math.ceil((new Date(nextHoliday.date + 'T00:00:00') - now) / 86400000)} días`;
}
setInterval(updateCountdowns, 60000); updateCountdowns();

// ============================================================
//  CHAT
// ============================================================
function initChat() {
  onSnapshot(query(collection(db, "messages"), orderBy("createdAt", "asc"), limit(100)), (snapshot) => {
    const el = document.getElementById("chatMessages");
    if (!el) return;
    el.innerHTML = "";
    snapshot.forEach(d => {
      const m = d.data();
      el.innerHTML += `<div class="chat-message"><img class="msg-avatar" src="${escapeHtml(m.avatar)}"><div><div class="msg-name">${escapeHtml(m.name)}</div><div class="msg-text">${escapeHtml(m.text)}</div></div></div>`;
    });
    el.scrollTop = el.scrollHeight;
  });
}
document.getElementById("chatHeader")?.addEventListener("click", () => {
  const w = document.getElementById("chatWidget");
  w.classList.toggle("minimized"); w.classList.toggle("expanded");
});
document.getElementById("chatForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = document.getElementById("chatInput").value.trim();
  if (!text) return;
  document.getElementById("chatInput").value = "";
  triggerBubble(text);
  await addDoc(collection(db, "messages"), { name: currentUser.name, avatar: currentUser.avatar, text, createdAt: serverTimestamp() });
});

// ============================================================
//  VOTACIONES (1 voto por persona, público)
// ============================================================
function isLegacyPoll(poll) {
  if (!poll.votes) return false;
  return Object.values(poll.votes).some(v => typeof v === 'number');
}

function getPollCounts(poll) {
  const result = {};
  if (!poll.options) return result;
  poll.options.forEach((_, i) => result[i] = 0);
  if (!poll.votes) return result;
  for (const key in poll.votes) {
    const val = poll.votes[key];
    if (typeof val === 'number') {
      const idx = parseInt(key, 10);
      if (result[idx] !== undefined) result[idx] += val;
    } else if (val && typeof val === 'object' && typeof val.option === 'number') {
      if (result[val.option] !== undefined) result[val.option]++;
    }
  }
  return result;
}

function getPollVoters(poll) {
  const result = {};
  if (!poll.options) return result;
  poll.options.forEach((_, i) => result[i] = []);
  if (!poll.votes) return result;
  for (const key in poll.votes) {
    const val = poll.votes[key];
    if (val && typeof val === 'object' && typeof val.option === 'number') {
      if (result[val.option]) result[val.option].push({ uid: key, name: val.name || "?", avatar: val.avatar || "" });
    }
  }
  return result;
}

function hasUserVoted(poll, uid) {
  if (!poll.votes || !uid) return false;
  const v = poll.votes[uid];
  return !!(v && typeof v === 'object' && typeof v.option === 'number');
}

function getUserVote(poll, uid) {
  if (!poll.votes || !uid) return -1;
  const v = poll.votes[uid];
  if (v && typeof v === 'object' && typeof v.option === 'number') return v.option;
  return -1;
}

function initPolls() {
  document.getElementById("newPollBtn")?.addEventListener("click", () => {
    document.getElementById("pollQuestion").value = "";
    document.getElementById("isYesNoPoll").checked = false;
    document.getElementById("pollOptionsWrapper").style.display = "block";
    document.getElementById("pollOptionsContainer").innerHTML =
      `<input type="text" class="text-input poll-option" placeholder="Opción 1"><input type="text" class="text-input poll-option" placeholder="Opción 2">`;
    document.getElementById("pollModal").hidden = false;
  });
  document.getElementById("addOptionBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    const c = document.querySelectorAll(".poll-option").length;
    if (c < 6) document.getElementById("pollOptionsContainer").innerHTML +=
      `<input type="text" class="text-input poll-option" placeholder="Opción ${c + 1}">`;
  });
  document.getElementById("createPollBtn")?.addEventListener("click", async (e) => {
    e.preventDefault();
    const q = document.getElementById("pollQuestion").value.trim();
    let opts = [...document.querySelectorAll(".poll-option")].map(i => i.value.trim()).filter(Boolean);
    if (!q || opts.length < 2) return alert("Faltan datos");
    if (document.getElementById("isYesNoPoll").checked) opts = ["Sí", "No"];
    await addDoc(collection(db, "polls"), {
      question: q, options: opts,
      votes: {},                    // nuevo formato: votes[uid] = { option, name, avatar, timestamp }
      isYesNo: document.getElementById("isYesNoPoll").checked,
      creator: currentUser.name,
      creatorUid: currentUser.uid,
      createdAt: serverTimestamp()
    });
    document.getElementById("pollModal").hidden = true;
  });

  onSnapshot(query(collection(db, "polls"), orderBy("createdAt", "desc")), (snapshot) => {
    const container = document.getElementById("pollsContainer");
    if (!container) return;
    container.innerHTML = snapshot.empty ? "<p>No hay votaciones</p>" : "";
    snapshot.forEach(docSnap => {
      const p = docSnap.data();
      const id = docSnap.id;
      container.innerHTML += renderPollCard(p, id);
    });
  }, (error) => {
    console.error(error);
    const c = document.getElementById("pollsContainer");
    if (c) c.innerHTML = "<p style='color:var(--danger);'>Error de conexión.</p>";
  });
}

function renderPollCard(poll, id) {
  const counts = getPollCounts(poll);
  const voters = getPollVoters(poll);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const legacy = isLegacyPoll(poll);
  const hasVoted = hasUserVoted(poll, currentUser.uid);
  const userVote = getUserVote(poll, currentUser.uid);

  const headerBadges = [
    hasVoted ? `<span class="poll-badge my-vote-badge">✅ Ya votaste</span>` : "",
    legacy ? `<span class="poll-badge legacy">📜 Antigua (solo lectura)</span>` : "",
    !legacy && !hasVoted ? `<span class="poll-badge open">🗳️ Abierta</span>` : ""
  ].filter(Boolean).join("");

  const optsHTML = poll.options.map((opt, i) => {
    const count = counts[i] || 0;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const optVoters = voters[i] || [];
    const isMyVote = userVote === i;
    const disabled = legacy || hasVoted;

    const visibleVoters = optVoters.slice(0, 8);
    const more = optVoters.length - visibleVoters.length;
    const avatarsHTML = visibleVoters.map(v =>
      `<img class="voter-avatar" src="${escapeHtml(v.avatar)}" alt="" title="${escapeHtml(v.name)}" />`
    ).join("") + (more > 0 ? `<span class="voter-more">+${more}</span>` : "");

    return `
      <button
        class="poll-option-btn ${isMyVote ? 'my-vote' : ''} ${disabled ? 'disabled' : ''}"
        ${disabled ? 'disabled' : `onclick="vote('${id}', ${i})"`}
        aria-label="Votar por ${escapeHtml(opt)}"
      >
        <span class="option-bar" style="width:${pct}%"></span>
        <span class="option-row">
          <span class="option-text">${escapeHtml(opt)}${isMyVote ? ' ✅' : ''}</span>
          <span class="option-count">${count} (${pct}%)</span>
        </span>
        ${optVoters.length > 0 ? `<span class="voter-list">${avatarsHTML}</span>` : ''}
      </button>
    `;
  }).join("");

  return `
    <div class="poll-card">
      <button class="btn-delete-poll" onclick="delPoll('${id}')" title="Eliminar votación">🗑️</button>
      <div class="poll-question">${escapeHtml(poll.question)}</div>
      <div class="poll-meta">
        <span>${total} voto${total === 1 ? '' : 's'} · por ${escapeHtml(poll.creator || "?")}</span>
        ${headerBadges}
      </div>
      <div class="poll-options">${optsHTML}</div>
    </div>
  `;
}

window.vote = async (id, idx) => {
  if (!currentUser.uid) return alert("Inicia sesión para votar.");
  try {
    let alreadyVoted = false;
    await runTransaction(db, async (tx) => {
      const ref = doc(db, "polls", id);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("Votación no existe.");
      const poll = snap.data();
      if (isLegacyPoll(poll)) { alreadyVoted = "legacy"; return; }
      if (hasUserVoted(poll, currentUser.uid)) { alreadyVoted = true; return; }
      tx.update(ref, {
        [`votes.${currentUser.uid}`]: {
          option: idx,
          name: currentUser.name,
          avatar: currentUser.avatar,
          timestamp: Date.now()
        }
      });
    });
    if (alreadyVoted === "legacy") return alert("Esta votación es antigua y ya no acepta votos.");
    if (alreadyVoted) return alert("Ya votaste en esta votación.");
    confetti();
  } catch (err) {
    console.error(err);
    alert("Error al votar: " + err.message);
  }
};

window.delPoll = async (id) => { if (confirm("¿Borrar votación?")) await deleteDoc(doc(db, "polls", id)); };

// ============================================================
//  MINIJUEGOS + TABS
// ============================================================
document.getElementById("gamesBtn")?.addEventListener("click", () => document.getElementById("gameModal").hidden = false);
document.getElementById("closeGameBtn")?.addEventListener("click", () => document.getElementById("gameModal").hidden = true);

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    if (btn.hidden) return;
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
  });
});

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
