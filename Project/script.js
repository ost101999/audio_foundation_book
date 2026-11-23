// تطبيق كتاب التأسيس التفاعلي — الاعتماد على الملفات المحلية والنشر عبر Git/Vercel
const defaultData = [
    {
        name: "الصفحة الأولى",
        words: [
            { id: "p1_w1", text: "أَ" }, { id: "p1_w2", text: "بَ" },
            { id: "p1_w3", text: "تَ" }, { id: "p1_w4", text: "ثَ" },
            { id: "p1_w5", text: "جَ" }, { id: "p1_w6", text: "حَ" },
            { id: "p1_w7", text: "خَ" }, { id: "p1_w8", text: "دَ" },
            { id: "p1_w9", text: "ذَ" }, { id: "p1_w10", text: "رَ" },
            { id: "p1_w11", text: "زَ" }, { id: "p1_w12", text: "سَ" },
            { id: "p1_w13", text: "شَ" }, { id: "p1_w14", text: "صَ" },
            { id: "p1_w15", text: "ضَ" }, { id: "p1_w16", text: "طَ" }
        ]
    }
];

const BOOK_JSON_FILE = 'readingAppData.json';
const STORAGE_KEY = 'readingAppData';

// State Management
const urlParams = new URLSearchParams(window.location.search);
const isLocalHost = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);
const hasTeacherParam = urlParams.has('teacher') || urlParams.has('record');
const allowTeacherMode = isLocalHost || hasTeacherParam;
document.body.classList.toggle('can-teach', allowTeacherMode);

const pageParam = parseInt(urlParams.get('page'), 10);
let currentPageIndex = (!isNaN(pageParam) && pageParam > 0) ? pageParam - 1 : 0;
let bookData = [];
let isTeacherMode = false;
let mediaRecorder = null;
let currentlyRecordingId = null;
let dirHandle = null;
let hasLocalServer = false;
const recordedAudioIds = new Set();

// DOM Elements
const wordsGrid = document.getElementById('wordsGrid');
const modeToggle = document.getElementById('modeToggle');
const pageInput = document.getElementById('pageInput');
const totalPagesSpan = document.getElementById('totalPages');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const addPageBtn = document.getElementById('addPageBtn');
const deletePageBtn = document.getElementById('deletePageBtn');
const layoutVerticalBtn = document.getElementById('layoutVerticalBtn');
const layoutCentralBtn = document.getElementById('layoutCentralBtn');

let toastTimer = null;
function showToast(message, isError = false) {
    let el = document.getElementById('localToast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'localToast';
        el.className = 'local-toast';
        document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.toggle('error', isError);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

async function detectLocalServer() {
    if (!isLocalHost) return;
    try {
        const res = await fetch('/api/status', { cache: 'no-store' });
        if (!res.ok) return;
        const info = await res.json();
        if (info?.local) {
            hasLocalServer = true;
            if (Array.isArray(info.audioIds)) {
                for (const id of info.audioIds) recordedAudioIds.add(id);
            }
        }
    } catch {
        // Static server or offline preview
    }
}

async function loadBookData() {
    try {
        const res = await fetch(BOOK_JSON_FILE, { cache: 'no-store' });
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                return data;
            }
        }
    } catch {
        // file:// or missing file fallback
    }

    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (Array.isArray(stored) && stored.length > 0) return stored;
    } catch {
        // ignore parse errors
    }
    return JSON.parse(JSON.stringify(defaultData));
}

async function saveData(silent = false) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookData));
    if (!isTeacherMode) return true;

    if (hasLocalServer) {
        try {
            const res = await fetch('/api/save-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookData)
            });
            if (!res.ok) throw new Error('Save failed');
            if (!silent) showToast('تم الحفظ محلياً ✓');
            return true;
        } catch (err) {
            console.error('Local save failed:', err);
            showToast('تعذّر الحفظ في الملف المحلي', true);
            return false;
        }
    }

    return await persistBookJsonViaPicker();
}

async function persistBookJsonViaPicker() {
    try {
        if (!dirHandle) {
            dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        }
        const blob = new Blob([`${JSON.stringify(bookData, null, 2)}\n`], {
            type: 'application/json;charset=utf-8'
        });
        await saveToDirectory(blob, BOOK_JSON_FILE, false);
        showToast('تم حفظ ملف البيانات ✓');
        return true;
    } catch {
        return false;
    }
}

// Initialize App
async function init() {
    const [, loaded] = await Promise.all([detectLocalServer(), loadBookData()]);
    bookData = loaded;
    if (!Array.isArray(bookData) || bookData.length === 0) {
        bookData = JSON.parse(JSON.stringify(defaultData));
    }
    currentPageIndex = Math.max(0, Math.min(currentPageIndex, bookData.length - 1));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookData));

    renderPagination();
    renderCards();
    setupEventListeners();
}

// Update Pagination UI
function renderPagination() {
    totalPagesSpan.textContent = bookData.length;
    pageInput.value = currentPageIndex + 1;
    prevPageBtn.disabled = currentPageIndex === 0;
    nextPageBtn.disabled = currentPageIndex === bookData.length - 1;
    updateLayoutButtons();
}

function updateLayoutButtons() {
    if (!layoutVerticalBtn || !layoutCentralBtn) return;
    const page = bookData[currentPageIndex];
    layoutVerticalBtn.classList.toggle('active', page?.layout === "vertical");
    layoutCentralBtn.classList.toggle('active', page?.layout === "central");
}

function syncCardAudioClass(id) {
    const card = document.getElementById(id);
    if (!card) return;
    card.classList.toggle('has-audio', recordedAudioIds.has(id));
}

// Render Cards Dynamically
function renderCards() {
    wordsGrid.innerHTML = '';
    const page = bookData[currentPageIndex];
    const words = page.words;

    wordsGrid.classList.remove('vertical-layout', 'central-layout');
    if (page.layout === "vertical") {
        wordsGrid.classList.add('vertical-layout');
    } else if (page.layout === "central") {
        wordsGrid.classList.add('central-layout');
    }

    const isSpecialLayout = page.layout === "vertical" || page.layout === "central";
    if (!isSpecialLayout) {
        const needed = 16 - words.length;
        if (needed > 0) {
            for (let i = 0; i < needed; i++) {
                words.push({
                    id: `p${currentPageIndex + 1}_w${words.length + 1}`,
                    text: ""
                });
            }
            if (isTeacherMode) void saveData(true);
        }
    }

    if (page.layout === "central") {
        for (let i = 0; i < words.length; i += 4) {
            const rowWords = words.slice(i, i + 4);
            if (!rowWords.some(w => w.text.trim() !== "")) continue;

            const rowDiv = document.createElement('div');
            rowDiv.className = 'grid-row-centered';
            rowWords.forEach(word => {
                if (word.text.trim() === "") return;
                rowDiv.appendChild(createCardElement(word));
            });
            wordsGrid.appendChild(rowDiv);
        }
        return;
    }

    words.forEach(word => {
        if (page.layout === "vertical" && word.text.trim() === "") return;
        wordsGrid.appendChild(createCardElement(word));
    });
}

function createCardElement(word) {
    const card = document.createElement('div');
    card.className = 'word-card';
    card.id = word.id;
    card.textContent = word.text;

    if (word.highlighted) card.classList.add('highlighted');
    if (recordedAudioIds.has(word.id)) card.classList.add('has-audio');

    card.addEventListener('click', () => handleCardClick(word.id));

    let lastRightClick = 0;
    card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!allowTeacherMode) return;
        const now = Date.now();
        const isDoubleClick = (now - lastRightClick < 500);
        lastRightClick = now;

        if (isDoubleClick && !isTeacherMode) {
            isTeacherMode = true;
            if (modeToggle) modeToggle.checked = true;
            document.body.classList.add('teacher-mode');
            renderCards();
            renderPagination();
            return;
        }

        editWord(word.id);
    });

    return card;
}

function createModal() {
    const modal = document.createElement('div');
    modal.id = 'editModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>تعديل الكلمة</h3>
            <input type="text" id="modalInput" placeholder="أدخل النص الجديد" autocomplete="off" spellcheck="false">
            <div class="modal-options">
                <label><input type="checkbox" id="modalHighlight"> تمييز الكلمة (إطار فخم)</label>
            </div>
            <div class="modal-audio-row">
                <button type="button" class="modal-btn audio-play" id="modalPlayAudio">استماع للصوت</button>
                <button type="button" class="modal-btn danger" id="modalDeleteAudio">حذف الصوت</button>
                <button type="button" class="modal-btn danger" id="modalClearWord">تفريغ المربع</button>
            </div>
            <div class="modal-actions">
                <button type="button" class="modal-btn cancel" id="modalCancel">إلغاء</button>
                <button type="button" class="modal-btn save" id="modalSave">حفظ</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

function findWordById(id) {
    for (const page of bookData) {
        const word = page.words.find(w => w.id === id);
        if (word) return word;
    }
    return null;
}

function editWord(id) {
    if (!isTeacherMode) return;
    const targetWord = findWordById(id);
    if (!targetWord) return;

    const modal = document.getElementById('editModal') || createModal();
    const modalInput = document.getElementById('modalInput');
    const modalSave = document.getElementById('modalSave');
    const modalCancel = document.getElementById('modalCancel');
    const modalHighlight = document.getElementById('modalHighlight');
    const modalPlayAudio = document.getElementById('modalPlayAudio');
    const modalDeleteAudio = document.getElementById('modalDeleteAudio');
    const modalClearWord = document.getElementById('modalClearWord');

    modalInput.value = targetWord.text;
    modalHighlight.checked = !!targetWord.highlighted;

    const refreshAudioButtons = () => {
        const hasAudio = recordedAudioIds.has(id);
        modalPlayAudio.disabled = !hasAudio && hasLocalServer;
        modalDeleteAudio.disabled = !hasAudio;
        modalClearWord.disabled = targetWord.text.trim() === "" && !targetWord.highlighted;
    };
    refreshAudioButtons();

    modal.classList.add('show');
    setTimeout(() => modalInput.focus(), 100);

    const handleSave = async () => {
        targetWord.text = modalInput.value.trim();
        targetWord.highlighted = modalHighlight.checked;

        const originalText = modalSave.textContent;
        modalSave.textContent = "جاري الحفظ...";
        modalSave.disabled = true;

        try {
            await saveData();
            renderCards();
        } finally {
            modalSave.textContent = originalText;
            modalSave.disabled = false;
            closeModal();
        }
    };

    const handlePlayAudio = () => {
        playAudio(id);
    };

    const handleDeleteAudio = async () => {
        if (!confirm('هل تريد حذف التسجيل الصوتي لهذه الكلمة؟')) return;
        modalDeleteAudio.disabled = true;
        const ok = await deleteAudioForWord(id);
        if (ok) refreshAudioButtons();
    };

    const handleClearWord = async () => {
        if (!confirm('تفريغ نص هذه الخانة؟')) return;
        targetWord.text = "";
        targetWord.highlighted = false;
        await saveData();
        renderCards();
        closeModal();
    };

    const closeModal = () => {
        modal.classList.remove('show');
        cleanup();
    };

    const handleOutsideClick = (e) => {
        if (e.target === modal) closeModal();
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') closeModal();
    };

    const cleanup = () => {
        modalSave.removeEventListener('click', handleSave);
        modalCancel.removeEventListener('click', closeModal);
        modalPlayAudio.removeEventListener('click', handlePlayAudio);
        modalDeleteAudio.removeEventListener('click', handleDeleteAudio);
        modalClearWord.removeEventListener('click', handleClearWord);
        modal.removeEventListener('click', handleOutsideClick);
        modalInput.removeEventListener('keydown', handleKeyPress);
    };

    modalSave.addEventListener('click', handleSave);
    modalCancel.addEventListener('click', closeModal);
    modalPlayAudio.addEventListener('click', handlePlayAudio);
    modalDeleteAudio.addEventListener('click', handleDeleteAudio);
    modalClearWord.addEventListener('click', handleClearWord);
    modal.addEventListener('click', handleOutsideClick);
    modalInput.addEventListener('keydown', handleKeyPress);
}

// Handle Navigation & Mode Change
function setupEventListeners() {
    if (layoutVerticalBtn) {
        layoutVerticalBtn.addEventListener('click', async () => {
            if (!isTeacherMode) return;
            const page = bookData[currentPageIndex];
            page.layout = page.layout === "vertical" ? "grid" : "vertical";
            await saveData();
            renderCards();
            updateLayoutButtons();
        });
    }

    if (layoutCentralBtn) {
        layoutCentralBtn.addEventListener('click', async () => {
            if (!isTeacherMode) return;
            const page = bookData[currentPageIndex];
            page.layout = page.layout === "central" ? "grid" : "central";
            await saveData();
            renderCards();
            updateLayoutButtons();
        });
    }

    if (hasTeacherParam && modeToggle) {
        isTeacherMode = true;
        modeToggle.checked = true;
        document.body.classList.add('teacher-mode');
    }

    modeToggle.addEventListener('change', (e) => {
        if (!allowTeacherMode) {
            e.target.checked = false;
            isTeacherMode = false;
            document.body.classList.remove('teacher-mode');
            return;
        }
        isTeacherMode = e.target.checked;
        document.body.classList.toggle('teacher-mode', isTeacherMode);

        if (!isTeacherMode && currentlyRecordingId) {
            stopRecording();
        }
    });

    const handleMouseNav = (e) => {
        if (e.button === 3 || e.button === 4) {
            e.preventDefault();
            if (e.type === 'mouseup') {
                if (e.button === 3 && currentPageIndex < bookData.length - 1) {
                    currentPageIndex++;
                } else if (e.button === 4 && currentPageIndex > 0) {
                    currentPageIndex--;
                }
                renderPagination();
                renderCards();
            }
        }
    };
    window.addEventListener('mousedown', handleMouseNav);
    window.addEventListener('mouseup', handleMouseNav);

    let touchstartX = 0;
    window.addEventListener('touchstart', (e) => {
        touchstartX = e.changedTouches[0].screenX;
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
        const diffX = e.changedTouches[0].screenX - touchstartX;
        if (Math.abs(diffX) <= 60) return;

        if (diffX < 0 && currentPageIndex < bookData.length - 1) {
            currentPageIndex++;
        } else if (diffX > 0 && currentPageIndex > 0) {
            currentPageIndex--;
        } else {
            return;
        }
        renderPagination();
        renderCards();
    }, { passive: true });

    prevPageBtn.addEventListener('click', () => {
        if (currentPageIndex > 0) {
            currentPageIndex--;
            renderPagination();
            renderCards();
        }
    });

    nextPageBtn.addEventListener('click', () => {
        if (currentPageIndex < bookData.length - 1) {
            currentPageIndex++;
            renderPagination();
            renderCards();
        }
    });

    const selectPageInputAll = () => {
        requestAnimationFrame(() => pageInput.select());
    };
    pageInput.addEventListener('focus', selectPageInputAll);
    pageInput.addEventListener('click', selectPageInputAll);

    pageInput.addEventListener('change', (e) => {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val) || val < 1) val = 1;
        if (val > bookData.length) val = bookData.length;
        currentPageIndex = val - 1;
        renderPagination();
        renderCards();
    });

    addPageBtn.addEventListener('click', async () => {
        if (!isTeacherMode) return;
        const stamp = Date.now();
        const newPage = {
            name: "صفحة جديدة",
            words: Array.from({ length: 16 }, (_, i) => ({
                id: `p${stamp}_w${i + 1}`,
                text: ""
            }))
        };
        bookData.splice(currentPageIndex + 1, 0, newPage);
        currentPageIndex += 1;
        await saveData();
        renderPagination();
        renderCards();
    });

    if (deletePageBtn) {
        deletePageBtn.addEventListener('click', async () => {
            if (!isTeacherMode) return;
            if (bookData.length <= 1) {
                alert("لا يمكن حذف الصفحة الأخيرة!");
                return;
            }
            if (!confirm("هل أنت متأكد من حذف هذه الصفحة الحالية؟")) return;

            bookData.splice(currentPageIndex, 1);
            if (currentPageIndex >= bookData.length) {
                currentPageIndex = bookData.length - 1;
            }
            await saveData();
            renderPagination();
            renderCards();
        });
    }
}

// Main Interaction Logic
async function handleCardClick(id) {
    if (!isTeacherMode) {
        playAudio(id);
        return;
    }

    const targetWord = findWordById(id);
    if (targetWord && targetWord.text.trim() === "") {
        editWord(id);
        return;
    }

    if (currentlyRecordingId === id) {
        stopRecording();
    } else {
        if (currentlyRecordingId) stopRecording();
        startRecording(id);
    }
}

// --- Teacher Mode: Recording & Deleting Audio ---
async function startRecording(id) {
    try {
        if (!hasLocalServer && !dirHandle) {
            try {
                dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            } catch {
                alert("لازم تختار فولدر المشروع علشان نحفظ الصوت داخل audio.");
                return;
            }
        }

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });

        const options = { audioBitsPerSecond: 256000 };
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            options.mimeType = 'audio/webm;codecs=opus';
        }
        const recorder = new MediaRecorder(stream, options);
        const chunks = [];

        recorder.ondataavailable = (event) => chunks.push(event.data);
        recorder.onstop = async () => {
            const audioBlob = new Blob(chunks, { type: options.mimeType || 'audio/webm' });
            await saveAudioForWord(audioBlob, id);
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder = recorder;
        mediaRecorder.start();
        currentlyRecordingId = id;
        document.getElementById(id)?.classList.add('recording');
    } catch (err) {
        console.error("Microphone access denied:", err);
        alert("يرجى السماح بالوصول للميكروفون للتسجيل.");
    }
}

async function saveAudioForWord(audioBlob, id) {
    if (hasLocalServer) {
        try {
            const res = await fetch(`/api/save-audio?id=${encodeURIComponent(id)}`, {
                method: 'POST',
                headers: { 'Content-Type': audioBlob.type || 'audio/webm' },
                body: audioBlob
            });
            if (!res.ok) throw new Error('Audio save failed');
            recordedAudioIds.add(id);
            syncCardAudioClass(id);
            showToast('تم حفظ التسجيل ✓');
            return;
        } catch (err) {
            console.error("Local server audio save failed:", err);
            showToast('تعذّر حفظ التسجيل محلياً', true);
            return;
        }
    }

    if (!dirHandle) {
        try {
            dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        } catch {
            downloadAudio(audioBlob, id);
            return;
        }
    }
    await saveToDirectory(audioBlob, `${id}.webm`, true);
    recordedAudioIds.add(id);
    syncCardAudioClass(id);
    showToast('تم حفظ التسجيل ✓');
}

async function deleteAudioForWord(id) {
    if (hasLocalServer) {
        try {
            const res = await fetch(`/api/delete-audio?id=${encodeURIComponent(id)}`, { method: 'POST' });
            if (!res.ok) throw new Error('Audio delete failed');
            recordedAudioIds.delete(id);
            syncCardAudioClass(id);
            showToast('تم حذف الصوت');
            return true;
        } catch (err) {
            console.error('Local audio delete failed:', err);
            showToast('تعذّر حذف الصوت', true);
            return false;
        }
    }

    if (dirHandle) {
        try {
            const targetDir = String(dirHandle.name || '').toLowerCase() === 'audio'
                ? dirHandle
                : await dirHandle.getDirectoryHandle('audio', { create: false });
            await targetDir.removeEntry(`${id}.webm`);
            recordedAudioIds.delete(id);
            syncCardAudioClass(id);
            showToast('تم حذف الصوت');
            return true;
        } catch (err) {
            console.error('Directory audio delete failed:', err);
        }
    }

    showToast('حذف الصوت متاح عبر المعاينة المحلية', true);
    return false;
}

async function saveToDirectory(blob, fileName, inAudioFolder = false) {
    try {
        let targetHandle = dirHandle;
        if (inAudioFolder) {
            const selectedFolderName = String(dirHandle?.name || '').toLowerCase();
            if (selectedFolderName !== 'audio') {
                targetHandle = await dirHandle.getDirectoryHandle('audio', { create: true });
            }
        }

        const fileHandle = await targetHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
    } catch (err) {
        console.error("Direct save failed, falling back to download:", err);
        downloadAudio(blob, fileName.replace('.webm', ''));
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        document.getElementById(currentlyRecordingId)?.classList.remove('recording');
        currentlyRecordingId = null;
    }
}

function downloadAudio(blob, id) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${id}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// --- Playback Logic ---
async function playAudio(id) {
    const card = document.getElementById(id);
    if (card) card.classList.add('playing');

    const cacheBuster = `t=${Date.now()}`;
    const localPrimaryPath = `./audio/${id}.webm?${cacheBuster}`;
    const localLegacyNestedPath = `./audio/audio/${id}.webm?${cacheBuster}`;
    const audio = new Audio(localPrimaryPath);

    audio.play().catch(async () => {
        const fallbackAudio = new Audio(localLegacyNestedPath);
        try {
            await fallbackAudio.play();
            fallbackAudio.onended = () => card?.classList.remove('playing');
            fallbackAudio.onerror = () => card?.classList.remove('playing');
            return;
        } catch {
            // Audio not found in either path
        }

        if (card) {
            card.style.borderColor = '#e74c3c';
            setTimeout(() => { card.style.borderColor = ''; }, 500);
            card.classList.remove('playing');
        }
    });

    audio.onended = () => card?.classList.remove('playing');
    audio.onerror = () => card?.classList.remove('playing');
}

init().catch((err) => console.error(err));
