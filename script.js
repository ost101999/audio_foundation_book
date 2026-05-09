import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
    doc,
    getDoc,
    getFirestore,
    onSnapshot,
    serverTimestamp,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
    getDownloadURL,
    getStorage,
    ref,
    uploadBytes
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

// Initial Data Structure (Array of pages)
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
    },
    {
        name: "الصفحة الثانية",
        words: [
            { id: "p2_w1", text: "إِ" }, { id: "p2_w2", text: "بِ" },
            { id: "p2_w3", text: "تِ" }, { id: "p2_w4", text: "ثِ" },
            { id: "p2_w5", text: "جِ" }, { id: "p2_w6", text: "حِ" },
            { id: "p2_w7", text: "خِ" }, { id: "p2_w8", text: "دِ" },
            { id: "p2_w9", text: "ذِ" }, { id: "p2_w10", text: "رِ" },
            { id: "p2_w11", text: "زِ" }, { id: "p2_w12", text: "سِ" },
            { id: "p2_w13", text: "شِ" }, { id: "p2_w14", text: "صِ" },
            { id: "p2_w15", text: "ضِ" }, { id: "p2_w16", text: "طِ" }
        ]
    }
];

/** نسخة الكتاب المشتركة مع كل من يفتح الموقع (ملف JSON بجانب index.html على الخادم) */
const BOOK_JSON_FILE = 'readingAppData.json';
const FIRESTORE_COLLECTION = "books";
const FIRESTORE_DOC_ID = "reading-app";

const firebaseConfig = window.FIREBASE_CONFIG || {};
const useFirebaseStorage = window.USE_FIREBASE_STORAGE === true;
const hasFirebaseConfig = Boolean(firebaseConfig.apiKey) &&
    !String(firebaseConfig.apiKey).includes("PUT_YOUR_");

let firebaseDb = null;
let bookDocRef = null;
let firebaseStorage = null;
let stopRealtimeSync = null;

if (hasFirebaseConfig) {
    const firebaseApp = initializeApp(firebaseConfig);
    firebaseDb = getFirestore(firebaseApp);
    if (useFirebaseStorage) {
        firebaseStorage = getStorage(firebaseApp);
    }
    bookDocRef = doc(firebaseDb, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID);
} else {
    console.warn("Firebase config is missing. App is running with local data only.");
}

let bookData;

async function loadBookData() {
    if (bookDocRef) {
        try {
            const snapshot = await getDoc(bookDocRef);
            if (snapshot.exists()) {
                const cloudData = snapshot.data();
                if (Array.isArray(cloudData?.pages) && cloudData.pages.length > 0) {
                    return cloudData.pages;
                }
            }
        } catch (err) {
            console.warn("Could not load from Firestore, trying local fallback.", err);
        }
    }

    try {
        const res = await fetch(BOOK_JSON_FILE, { cache: 'no-store' });
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                return data;
            }
        }
    } catch (_) {
        /* file:// أو لا يوجد ملف على الخادم */
    }
    try {
        const stored = JSON.parse(localStorage.getItem('readingAppData'));
        if (Array.isArray(stored)) return stored;
    } catch (_) {}
    return defaultData;
}

async function saveData() {
    localStorage.setItem('readingAppData', JSON.stringify(bookData));
    await persistBookDataIfTeacher();
}

async function persistBookDataIfTeacher() {
    if (!isTeacherMode) return;

    if (bookDocRef) {
        try {
            await setDoc(bookDocRef, {
                pages: bookData,
                updatedAt: serverTimestamp()
            }, { merge: true });
            return;
        } catch (err) {
            console.warn('Could not save shared book data to Firestore:', err);
            alert("فشل حفظ التعديلات على السحابة. تأكد من اتصال الإنترنت وقواعد Firestore.");
        }
    }

    await persistBookJsonIfTeacher();
}

async function persistBookJsonIfTeacher() {
    if (!isTeacherMode) return;
    try {
        if (!dirHandle) {
            try {
                dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            } catch {
                return;
            }
        }
        const blob = new Blob([JSON.stringify(bookData, null, 2)], {
            type: 'application/json;charset=utf-8'
        });
        await saveToDirectory(blob, BOOK_JSON_FILE, false);
    } catch (err) {
        console.warn('Could not save shared book JSON:', err);
    }
}

// State Management
let currentPageIndex = 0;
let isTeacherMode = false;
let mediaRecorder = null;
let audioChunks = [];
let currentlyRecordingId = null;
let dirHandle = null;

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

// Initialize App
async function init() {
    bookData = await loadBookData();
    if (!Array.isArray(bookData) || bookData.length === 0) {
        bookData = JSON.parse(JSON.stringify(defaultData));
    }
    currentPageIndex = Math.min(currentPageIndex, bookData.length - 1);
    currentPageIndex = Math.max(0, currentPageIndex);
    localStorage.setItem('readingAppData', JSON.stringify(bookData));
    renderPagination();
    renderCards();
    setupEventListeners();
    startRealtimeSync();
}

function startRealtimeSync() {
    if (!bookDocRef) return;

    if (stopRealtimeSync) {
        stopRealtimeSync();
    }

    stopRealtimeSync = onSnapshot(bookDocRef, (snapshot) => {
        if (!snapshot.exists()) return;
        const cloudData = snapshot.data();
        if (!Array.isArray(cloudData?.pages) || cloudData.pages.length === 0) return;

        bookData = cloudData.pages;
        currentPageIndex = Math.min(currentPageIndex, bookData.length - 1);
        currentPageIndex = Math.max(0, currentPageIndex);
        localStorage.setItem('readingAppData', JSON.stringify(bookData));
        renderPagination();
        renderCards();
    }, (err) => {
        console.warn("Realtime sync error:", err);
    });
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

// Render Cards Dynamically
function renderCards() {
    wordsGrid.innerHTML = '';
    const page = bookData[currentPageIndex];
    const words = page.words;
    
    // تطبيق التنسيقات الخاصة
    wordsGrid.classList.remove('vertical-layout', 'central-layout');
    if (page.layout === "vertical") {
        wordsGrid.classList.add('vertical-layout');
    } else if (page.layout === "central") {
        wordsGrid.classList.add('central-layout');
    }
    
    // تأكد إن الصفحة فيها 16 بطاقة على الأقل (فقط في الوضع الطبيعي - شبكي)
    const isSpecialLayout = page.layout === "vertical" || page.layout === "central";
    if (!isSpecialLayout) {
        let needed = 16 - words.length;
        if (needed > 0) {
            for (let i = 0; i < needed; i++) {
                words.push({
                    id: `p${currentPageIndex + 1}_w${words.length + 1}`,
                    text: ""
                });
            }
            saveData();
        }
    }

    if (page.layout === "central") {
        // توزيع مركزي: تجميع الكلمات في صفوف (كل صف 4 كلمات كحد أقصى)
        for (let i = 0; i < words.length; i += 4) {
            const rowWords = words.slice(i, i + 4);
            const hasText = rowWords.some(w => w.text.trim() !== "");
            if (!hasText) continue; // تخطي الصفوف الفارغة تماماً
            
            const rowDiv = document.createElement('div');
            rowDiv.className = 'grid-row-centered';
            
            rowWords.forEach(word => {
                if (word.text.trim() === "") return; // تخطي المربعات الفارغة في هذا الصف
                
                const card = createCardElement(word);
                rowDiv.appendChild(card);
            });
            
            wordsGrid.appendChild(rowDiv);
        }
    } else {
        // الوضع الطبيعي أو التوزيع العمودي
        words.forEach(word => {
            if (page.layout === "vertical" && word.text.trim() === "") {
                return;
            }
            const card = createCardElement(word);
            wordsGrid.appendChild(card);
        });
    }

    // دالة مساعدة لإنشاء البطاقة لتجنب تكرار الكود
    function createCardElement(word) {
        const card = document.createElement('div');
        card.className = 'word-card';
        card.id = word.id;
        card.textContent = word.text;
        
        if (word.highlighted) {
            card.classList.add('highlighted');
        }
        
        card.addEventListener('click', () => handleCardClick(word.id));
        let lastRightClick = 0;
        card.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const now = Date.now();
            const isDoubleClick = (now - lastRightClick < 500);
            lastRightClick = now;

            if (isDoubleClick) {
                if (!isTeacherMode) {
                    isTeacherMode = true;
                    if (modeToggle) modeToggle.checked = true;
                    document.body.classList.add('teacher-mode');
                    renderCards();
                    renderPagination();
                    return;
                }
            }

            editWord(word.id);
        });
        
        return card;
    }
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
            <div class="modal-actions">
                <button class="modal-btn cancel" id="modalCancel">إلغاء</button>
                <button class="modal-btn save" id="modalSave">حفظ</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

function editWord(id) {
    if (!isTeacherMode) return;

    let targetWord = null;
    for (const page of bookData) {
        const word = page.words.find(w => w.id === id);
        if (word) {
            targetWord = word;
            break;
        }
    }
    if (!targetWord) return;

    const modal = document.getElementById('editModal') || createModal();
    const modalInput = document.getElementById('modalInput');
    const modalSave = document.getElementById('modalSave');
    const modalCancel = document.getElementById('modalCancel');
    const modalHighlight = document.getElementById('modalHighlight');

    modalInput.value = targetWord.text;
    modalHighlight.checked = !!targetWord.highlighted;
    modal.classList.add('show');

    // Focus input
    setTimeout(() => modalInput.focus(), 100);

    const handleSave = async () => {
        const newText = modalInput.value.trim();
        targetWord.text = newText;
        targetWord.highlighted = modalHighlight.checked;
        
        const saveBtn = document.getElementById('modalSave');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = "جاري الحفظ...";
        saveBtn.disabled = true;
        
        try {
            await saveData();
            renderCards();
        } catch (e) {
            console.error(e);
        } finally {
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
            modal.classList.remove('show');
            cleanup();
        }
    };

    const handleCancel = () => {
        modal.classList.remove('show');
        cleanup();
    };

    const cleanup = () => {
        modalSave.removeEventListener('click', handleSave);
        modalCancel.removeEventListener('click', handleCancel);
        modal.removeEventListener('click', handleOutsideClick);
        modalInput.removeEventListener('keypress', handleKeyPress);
    };

    const handleOutsideClick = (e) => {
        if (e.target === modal) handleCancel();
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') handleCancel();
    };

    modalSave.addEventListener('click', handleSave);
    modalCancel.addEventListener('click', handleCancel);
    modal.addEventListener('click', handleOutsideClick);
    modalInput.addEventListener('keypress', handleKeyPress);
}
// Handle Navigation & Mode Change
function setupEventListeners() {
    if (layoutVerticalBtn) {
        layoutVerticalBtn.addEventListener('click', () => {
            if (!isTeacherMode) return;
            const page = bookData[currentPageIndex];
            page.layout = page.layout === "vertical" ? "grid" : "vertical";
            saveData();
            renderCards();
            updateLayoutButtons();
        });
    }

    if (layoutCentralBtn) {
        layoutCentralBtn.addEventListener('click', () => {
            if (!isTeacherMode) return;
            const page = bookData[currentPageIndex];
            page.layout = page.layout === "central" ? "grid" : "central";
            saveData();
            renderCards();
            updateLayoutButtons();
        });
    }

    modeToggle.addEventListener('change', (e) => {
        isTeacherMode = e.target.checked;
        document.body.classList.toggle('teacher-mode', isTeacherMode);
        
        if (!isTeacherMode && currentlyRecordingId) {
            stopRecording();
        }
    });

    // التنقل بأزرار الماوس (Back & Forward)
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

    // التنقل بالتاتش (Swipe) في الموبايل
    let touchstartX = 0;
    let touchendX = 0;
    
    const handleTouchStart = (e) => {
        touchstartX = e.changedTouches[0].screenX;
    };
    
    const handleTouchEnd = (e) => {
        touchendX = e.changedTouches[0].screenX;
        const diffX = touchendX - touchstartX;
        
        // التحقق من المسافة (أكبر من 60 بكسل) لتجنب اللمسات العادية
        if (Math.abs(diffX) > 60) {
            if (diffX < 0 && currentPageIndex < bookData.length - 1) {
                // سحب لليسار -> الصفحة التالية
                currentPageIndex++;
                renderPagination();
                renderCards();
            } else if (diffX > 0 && currentPageIndex > 0) {
                // سحب لليمين -> الصفحة السابقة
                currentPageIndex--;
                renderPagination();
                renderCards();
            }
        }
    };
    
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

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
        requestAnimationFrame(() => {
            pageInput.select();
        });
    };

    pageInput.addEventListener('focus', selectPageInputAll);
    pageInput.addEventListener('click', selectPageInputAll);

    pageInput.addEventListener('change', (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val) || val < 1) val = 1;
        if (val > bookData.length) val = bookData.length;
        
        currentPageIndex = val - 1;
        renderPagination();
        renderCards();
    });

    addPageBtn.addEventListener('click', () => {
        if (!isTeacherMode) return;
        
        const newPage = {
            name: `صفحة جديدة`,
            words: Array.from({ length: 16 }, (_, i) => ({
                id: `p${Date.now()}_w${i + 1}`, // معرف فريد باستخدام الوقت
                text: ""
            }))
        };
        
        // إدراج الصفحة بعد الصفحة الحالية
        bookData.splice(currentPageIndex + 1, 0, newPage);
        saveData();
        
        currentPageIndex = currentPageIndex + 1; // الانتقال للصفحة الجديدة
        renderPagination();
        renderCards();
    });

    if (deletePageBtn) {
        deletePageBtn.addEventListener('click', () => {
            if (!isTeacherMode) return;
            
            if (bookData.length <= 1) {
                alert("لا يمكن حذف الصفحة الأخيرة!");
                return;
            }
            
            if (confirm("هل أنت متأكد من حذف هذه الصفحة الحالية؟")) {
                bookData.splice(currentPageIndex, 1);
                saveData();
                
                // تعديل الفهرس الحالي إذا لزم الأمر
                if (currentPageIndex >= bookData.length) {
                    currentPageIndex = bookData.length - 1;
                }
                
                renderPagination();
                renderCards();
            }
        });
    }
}

// Main Interaction Logic
async function handleCardClick(id) {
    if (isTeacherMode) {
        let targetWord = null;
        for (const page of bookData) {
            const word = page.words.find(w => w.id === id);
            if (word) {
                targetWord = word;
                break;
            }
        }

        // إذا كانت الكلمة فارغة، افتح نافذة التعديل بدلاً من التسجيل
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
    } else {
        playAudio(id);
    }
}

// --- Teacher Mode: Recording Logic ---
async function startRecording(id) {
    try {
        if (!firebaseStorage && !dirHandle) {
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

        let options = { audioBitsPerSecond: 256000 };
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            options.mimeType = 'audio/webm;codecs=opus';
        }
        const recorder = new MediaRecorder(stream, options);
        const chunks = [];

        recorder.ondataavailable = (event) => {
            chunks.push(event.data);
        };

        recorder.onstop = async () => {
            const audioBlob = new Blob(chunks, { type: options.mimeType || 'audio/webm' });
            await saveAudioForWord(audioBlob, id);
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder = recorder;
        mediaRecorder.start();
        currentlyRecordingId = id;
        document.getElementById(id).classList.add('recording');

    } catch (err) {
        console.error("Microphone access denied:", err);
        alert("يرجى السماح بالوصول للميكروفون للتسجيل.");
    }
}

async function saveAudioForWord(audioBlob, id) {
    if (firebaseStorage) {
        try {
            const storageRef = ref(firebaseStorage, `audio/${id}.webm`);
            await uploadBytes(storageRef, audioBlob, { contentType: 'audio/webm' });
            console.log(`Uploaded successfully to Firebase Storage: ${id}.webm`);
            return;
        } catch (err) {
            console.error("Firebase audio upload failed, trying local save:", err);
            alert("فشل رفع التسجيل للسحابة. سيتم حفظ نسخة محلية مؤقتًا.");
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
        console.log(`Saved successfully to folder: ${inAudioFolder ? `audio/${fileName}` : fileName}`);
    } catch (err) {
        console.error("Direct save failed, falling back to download:", err);
        downloadAudio(blob, fileName.replace('.webm', ''));
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        document.getElementById(currentlyRecordingId).classList.remove('recording');
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

// --- Student Mode: Playback Logic ---
async function playAudio(id) {
    const card = document.getElementById(id);
    card.classList.add('playing');

    const cacheBuster = `t=${new Date().getTime()}`;
    const localPrimaryPath = `./audio/${id}.webm?${cacheBuster}`;
    const localLegacyNestedPath = `./audio/audio/${id}.webm?${cacheBuster}`;
    let audioPath = localPrimaryPath;

    if (firebaseStorage) {
        try {
            const storageRef = ref(firebaseStorage, `audio/${id}.webm`);
            audioPath = await getDownloadURL(storageRef);
        } catch (err) {
            console.warn(`Cloud audio not found, using local fallback for ${id}.`, err);
        }
    }

    const audio = new Audio(audioPath);

    audio.play().catch(async () => {
        if (!firebaseStorage && audioPath === localPrimaryPath) {
            const fallbackAudio = new Audio(localLegacyNestedPath);
            try {
                await fallbackAudio.play();
                fallbackAudio.onended = () => {
                    card.classList.remove('playing');
                };
                fallbackAudio.onerror = () => {
                    card.classList.remove('playing');
                };
                return;
            } catch {
                // Continue to UI error state below.
            }
        }

        card.style.borderColor = '#e74c3c';
        setTimeout(() => {
            card.style.borderColor = 'transparent';
        }, 500);
        card.classList.remove('playing');
    });

    audio.onended = () => {
        card.classList.remove('playing');
    };

    audio.onerror = () => {
        card.classList.remove('playing');
    };
}

init().catch((err) => console.error(err));
