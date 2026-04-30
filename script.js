// Data Structure: Multi-page support
const bookData = {
    "الحروف بالفتح": [
        { id: "p1_w1", text: "أَ" }, { id: "p1_w2", text: "بَ" },
        { id: "p1_w3", text: "تَ" }, { id: "p1_w4", text: "ثَ" },
        { id: "p1_w5", text: "جَ" }, { id: "p1_w6", text: "حَ" },
        { id: "p1_w7", text: "خَ" }, { id: "p1_w8", text: "دَ" },
        { id: "p1_w9", text: "ذَ" }, { id: "p1_w10", text: "رَ" },
        { id: "p1_w11", text: "زَ" }, { id: "p1_w12", text: "سَ" },
        { id: "p1_w13", text: "شَ" }, { id: "p1_w14", text: "صَ" },
        { id: "p1_w15", text: "ضَ" }, { id: "p1_w16", text: "طَ" }
    ],
    "الحروف بالكسر": [
        { id: "p2_w1", text: "إِ" }, { id: "p2_w2", text: "بِ" },
        { id: "p2_w3", text: "تِ" }, { id: "p2_w4", text: "ثِ" },
        { id: "p2_w5", text: "جِ" }, { id: "p2_w6", text: "حِ" },
        { id: "p2_w7", text: "خِ" }, { id: "p2_w8", text: "دِ" },
        { id: "p2_w9", text: "ذِ" }, { id: "p2_w10", text: "رِ" },
        { id: "p2_w11", text: "زِ" }, { id: "p2_w12", text: "سِ" },
        { id: "p2_w13", text: "شِ" }, { id: "p2_w14", text: "صِ" },
        { id: "p2_w15", text: "ضِ" }, { id: "p2_w16", text: "طِ" }
    ],
    "الحروف بالضم": [
        { id: "p3_w1", text: "أُ" }, { id: "p3_w2", text: "بُ" },
        { id: "p3_w3", text: "تُ" }, { id: "p3_w4", text: "ثُ" },
        { id: "p3_w5", text: "جُ" }, { id: "p3_w6", text: "حُ" },
        { id: "p3_w7", text: "خُ" }, { id: "p3_w8", text: "دُ" },
        { id: "p3_w9", text: "ذُ" }, { id: "p3_w10", text: "رُ" },
        { id: "p3_w11", text: "زُ" }, { id: "p3_w12", text: "سُ" },
        { id: "p3_w13", text: "شُ" }, { id: "p3_w14", text: "صُ" },
        { id: "p3_w15", text: "ضُ" }, { id: "p3_w16", text: "طُ" }
    ]
};

// State Management
let currentPage = Object.keys(bookData)[0];
let isTeacherMode = false;
let mediaRecorder = null;
let audioChunks = [];
let currentlyRecordingId = null;
let dirHandle = null;

// DOM Elements
const wordsGrid = document.getElementById('wordsGrid');
const pageTabs = document.getElementById('pageTabs');
const modeToggle = document.getElementById('modeToggle');

// Initialize App
function init() {
    renderTabs();
    renderCards();
    setupEventListeners();
}

// Render Page Navigation Tabs
function renderTabs() {
    pageTabs.innerHTML = '';
    Object.keys(bookData).forEach(pageName => {
        const btn = document.createElement('button');
        btn.className = `nav-btn ${pageName === currentPage ? 'active' : ''}`;
        btn.textContent = pageName;
        btn.onclick = () => {
            currentPage = pageName;
            renderTabs();
            renderCards();
        };
        pageTabs.appendChild(btn);
    });
}

// Render Cards Dynamically
function renderCards() {
    wordsGrid.innerHTML = '';
    const words = bookData[currentPage];
    words.forEach(word => {
        const card = document.createElement('div');
        card.className = 'word-card';
        card.id = word.id;
        card.textContent = word.text;
        card.addEventListener('click', () => handleCardClick(word.id));
        wordsGrid.appendChild(card);
    });
}

// Handle Mode Change
function setupEventListeners() {
    modeToggle.addEventListener('change', (e) => {
        isTeacherMode = e.target.checked;
        document.body.classList.toggle('teacher-mode', isTeacherMode);
        
        if (!isTeacherMode && currentlyRecordingId) {
            stopRecording();
        }
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

// Start the app
init();
