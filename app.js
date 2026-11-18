document.addEventListener('DOMContentLoaded', () => {
    // --- LÓGICA DE CONTADORES ---
    function updateCountdowns() {
        const now = new Date();
        
        // 1. Próximo Viernes 29 de Enero
        let targetYear = now.getFullYear();
        let jan29 = new Date(targetYear, 0, 29);
        // Si ya pasó o no es viernes, buscar el próximo año que sea viernes
        while (jan29 < now || jan29.getDay() !== 5) {
            targetYear++;
            jan29 = new Date(targetYear, 0, 29);
        }
        const diff29 = jan29 - now;
        document.getElementById('countdown-29').innerText = formatDiff(diff29);

        // 2. Próximo Feriado (Lista de ejemplo - puedes agregar más)
        const holidays = [
            { name: "Año Nuevo", date: `${now.getFullYear()}-01-01` },
            { name: "Viernes Santo", date: `${now.getFullYear()}-03-29` }, // Ejemplo aproximado
            { name: "Día del Trabajo", date: `${now.getFullYear()}-05-01` },
            { name: "Navidad", date: `${now.getFullYear()}-12-25` }
        ];
        
        let nextHoliday = null;
        for (let h of holidays) {
            let hDate = new Date(h.date + 'T00:00:00');
            if (hDate > now) {
                nextHoliday = { name: h.name, date: hDate };
                break;
            }
        }
        
        if (nextHoliday) {
            const diffHoliday = nextHoliday.date - now;
            document.getElementById('holiday-name').innerText = nextHoliday.name;
            document.getElementById('countdown-holiday').innerText = formatDiff(diffHoliday);
        }
    }

    function formatDiff(ms) {
        const days = Math.floor(ms / (1000 * 60 * 60 * 24));
        const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        return `${days} días, ${hours} hrs, ${mins} min`;
    }

    setInterval(updateCountdowns, 60000); // Actualizar cada minuto
    updateCountdowns();

    // --- LÓGICA DE CUMPLEAÑOS ---
    const bdayForm = document.getElementById('birthday-form');
    const bdayList = document.getElementById('birthday-list');
    let birthdays = JSON.parse(localStorage.getItem('birthdays')) || [];

    function renderBirthdays() {
        bdayList.innerHTML = '';
        // Ordenar por mes/día
        birthdays.sort((a, b) => {
            const dateA = new Date(a.date + 'T00:00:00');
            const dateB = new Date(b.date + 'T00:00:00');
            return dateA - dateB;
        });

        const now = new Date();
        let closestId = null;
        let minDiff = Infinity;

        birthdays.forEach((b, index) => {
            // Calcular días para el próximo cumpleaños
            let bDate = new Date(b.date + 'T00:00:00');
            let nextBday = new Date(now.getFullYear(), bDate.getMonth(), bDate.getDate());
            if (nextBday < now) nextBday.setFullYear(now.getFullYear() + 1);
            
            const diff = nextBday - now;
            if (diff < minDiff) {
                minDiff = diff;
                closestId = index;
            }

            const li = document.createElement('li');
            li.innerHTML = `
                <span contenteditable="true" onblur="updateName(${index}, this.innerText)">${b.name}</span>
                <span>${bDate.toLocaleDateString('es-ES', { month: 'long', day: 'numeric' })}</span>
                <button onclick="deleteBday(${index})" style="background:red; padding:2px 8px;">X</button>
            `;
            if (index === closestId) li.classList.add('highlight');
            bdayList.appendChild(li);
        });

        // Hacer la lista arrastrable (Sortable)
        new Sortable(bdayList, {
            animation: 150,
            onEnd: function (evt) {
                const item = birthdays.splice(evt.oldIndex, 1)[0];
                birthdays.splice(evt.newIndex, 0, item);
                localStorage.setItem('birthdays', JSON.stringify(birthdays));
            }
        });
    }

    window.updateName = (index, newName) => {
        birthdays[index].name = newName;
        localStorage.setItem('birthdays', JSON.stringify(birthdays));
    };

    window.deleteBday = (index) => {
        birthdays.splice(index, 1);
        localStorage.setItem('birthdays', JSON.stringify(birthdays));
        renderBirthdays();
    };

    bdayForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('bday-name').value;
        const date = document.getElementById('bday-date').value;
        birthdays.push({ name, date });
        localStorage.setItem('birthdays', JSON.stringify(birthdays));
        bdayForm.reset();
        renderBirthdays();
    });

    renderBirthdays();

    // --- LÓGICA DEL AGUA ---
    const waterForm = document.getElementById('water-form');
    const waterHistory = document.getElementById('water-history');
    const lastWaterBuyer = document.getElementById('last-water-buyer');
    let waterLogs = JSON.parse(localStorage.getItem('waterLogs')) || [];

    function renderWater() {
        waterHistory.innerHTML = '';
        if (waterLogs.length > 0) {
            lastWaterBuyer.innerText = `Último en comprar: ${waterLogs[waterLogs.length - 1].name} (${waterLogs[waterLogs.length - 1].date})`;
        } else {
            lastWaterBuyer.innerText = 'Último en comprar: Nadie';
        }

        // Mostrar historial (últimos 5)
        waterLogs.slice().reverse().slice(0, 5).forEach(log => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${log.name}</span> <span style="font-size:0.8em; color:#666;">${log.date}</span>`;
            waterHistory.appendChild(li);
        });
    }

    waterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('water-name').value;
        const date = new Date().toLocaleDateString('es-ES');
        waterLogs.push({ name, date });
        localStorage.setItem('waterLogs', JSON.stringify(waterLogs));
        waterForm.reset();
        renderWater();
    });

    renderWater();

    // --- LÓGICA DE AVATAR (CROPPER) ---
    const avatarImg = document.getElementById('avatar-img');
    const avatarInput = document.getElementById('avatar-input');
    const btnEditAvatar = document.getElementById('btn-edit-avatar');
    const modal = document.getElementById('cropper-modal');
    const imageToCrop = document.getElementById('image-to-crop');
    const btnSaveAvatar = document.getElementById('btn-save-avatar');
    const closeModal = document.querySelector('.close');
    let cropper;

    // Cargar avatar guardado
    const savedAvatar = localStorage.getItem('userAvatar');
    if (savedAvatar) avatarImg.src = savedAvatar;

    btnEditAvatar.addEventListener('click', () => avatarInput.click());

    avatarInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            const reader = new FileReader();
            reader.onload = (event) => {
                imageToCrop.src = event.target.result;
                modal.style.display = 'flex';
                if (cropper) cropper.destroy();
                cropper = new Cropper(imageToCrop, {
                    aspectRatio: 1,
                    viewMode: 1,
                    background: false
                });
            };
            reader.readAsDataURL(files[0]);
        }
    });

    btnSaveAvatar.addEventListener('click', () => {
        const canvas = cropper.getCroppedCanvas({ width: 200, height: 200 });
        const base64Image = canvas.toDataURL('image/jpeg');
        localStorage.setItem('userAvatar', base64Image);
        avatarImg.src = base64Image;
        modal.style.display = 'none';
    });

    closeModal.addEventListener('click', () => modal.style.display = 'none');

    // --- PWA (Instalación en celular) ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').catch(err => console.log('SW fallo:', err));
        });
    }
});
