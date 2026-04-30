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

let bookData;

async function loadBookData() {
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

function saveData() {
    localStorage.setItem('readingAppData', JSON.stringify(bookData));
    persistBookJsonIfTeacher();
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
        await saveToDirectory(blob, BOOK_JSON_FILE);
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
}

// Update Pagination UI
function renderPagination() {
    totalPagesSpan.textContent = bookData.length;
    pageInput.value = currentPageIndex + 1;
    prevPageBtn.disabled = currentPageIndex === 0;
    nextPageBtn.disabled = currentPageIndex === bookData.length - 1;
}

// Render Cards Dynamically
function renderCards() {
    wordsGrid.innerHTML = '';
    const words = bookData[currentPageIndex].words;
    words.forEach(word => {
        const card = document.createElement('div');
        card.className = 'word-card';
        card.id = word.id;
        card.textContent = word.text;
        
        card.addEventListener('click', () => handleCardClick(word.id));
        card.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            editWord(word.id);
        });

        wordsGrid.appendChild(card);
    });
}

function editWord(id) {
    const words = bookData[currentPageIndex].words;
    const wordIndex = words.findIndex(w => w.id === id);
    if (wordIndex === -1) return;

    const newText = prompt("أدخل النص الجديد للكلمة:", words[wordIndex].text);
    if (newText !== null) {
        words[wordIndex].text = newText.trim();
        saveData();
        renderCards();
    }
}
// Handle Navigation & Mode Change
function setupEventListeners() {
    modeToggle.addEventListener('change', (e) => {
        isTeacherMode = e.target.checked;
        document.body.classList.toggle('teacher-mode', isTeacherMode);
        
        if (!isTeacherMode && currentlyRecordingId) {
            stopRecording();
        }
    });

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
        
        const newPageIndex = bookData.length + 1;
        const newPage = {
            name: `الصفحة ${newPageIndex}`,
            words: Array.from({ length: 16 }, (_, i) => ({
                id: `p${newPageIndex}_w${i + 1}`,
                text: "" // Empty words
            }))
        };
        
        bookData.push(newPage);
        saveData();
        currentPageIndex = bookData.length - 1; // Go to new page
        renderPagination();
        renderCards();
    });
}

// Main Interaction Logic
async function handleCardClick(id) {
    if (isTeacherMode) {
        if (!dirHandle) {
            try {
                dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            } catch (err) {
                console.warn("User cancelled directory picker.");
            }
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
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            
            if (dirHandle) {
                await saveToDirectory(audioBlob, `${id}.webm`);
            } else {
                downloadAudio(audioBlob, id);
            }
            
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        currentlyRecordingId = id;
        document.getElementById(id).classList.add('recording');

    } catch (err) {
        console.error("Microphone access denied:", err);
        alert("يرجى السماح بالوصول للميكروفون للتسجيل.");
    }
}

async function saveToDirectory(blob, fileName) {
    try {
        const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        console.log(`Saved successfully to folder: ${fileName}`);
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
function playAudio(id) {
    // Add a timestamp to the URL to force the browser to bypass cache and play the NEW recording
    const audioPath = `./audio/${id}.webm?t=${new Date().getTime()}`;
    const audio = new Audio(audioPath);
    const card = document.getElementById(id);
    
    card.classList.add('playing');
    
    audio.play().catch(err => {
        console.warn(`Audio file not found: ${audioPath}`);
        card.style.borderColor = '#e74c3c';
        setTimeout(() => card.style.borderColor = 'transparent', 500);
        card.classList.remove('playing');
    });

    audio.onended = () => {
        card.classList.remove('playing');
    };
}

init().catch((err) => console.error(err));
