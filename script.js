// Data Structure: 16 cards (4x4 Grid)
const words = [
    { id: "word_1", text: "أَ" }, { id: "word_2", text: "بَ" },
    { id: "word_3", text: "تَ" }, { id: "word_4", text: "ثَ" },
    { id: "word_5", text: "جَ" }, { id: "word_6", text: "حَ" },
    { id: "word_7", text: "خَ" }, { id: "word_8", text: "دَ" },
    { id: "word_9", text: "ذَ" }, { id: "word_10", text: "رَ" },
    { id: "word_11", text: "زَ" }, { id: "word_12", text: "سَ" },
    { id: "word_13", text: "شَ" }, { id: "word_14", text: "صَ" },
    { id: "word_15", text: "ضَ" }, { id: "word_16", text: "طَ" }
];

// State Management
let isTeacherMode = false;
let mediaRecorder = null;
let audioChunks = [];
let currentlyRecordingId = null;
let dirHandle = null; // To store the directory handle for direct saving

// DOM Elements
const wordsGrid = document.getElementById('wordsGrid');
const modeToggle = document.getElementById('modeToggle');
const selectFolderBtn = document.getElementById('selectFolderBtn');

// Initialize App
function init() {
    renderCards();
    setupEventListeners();
}

// Render Cards Dynamically
function renderCards() {
    wordsGrid.innerHTML = '';
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
        selectFolderBtn.classList.toggle('hidden', !isTeacherMode);
        
        // Stop any active recording if mode changes
        if (!isTeacherMode && currentlyRecordingId) {
            stopRecording();
        }
    });

    selectFolderBtn.addEventListener('click', async () => {
        try {
            dirHandle = await window.showDirectoryPicker({
                mode: 'readwrite'
            });
            selectFolderBtn.textContent = 'تم ضبط المجلد ✅';
            selectFolderBtn.style.backgroundColor = '#2ecc71';
            selectFolderBtn.style.color = 'white';
        } catch (err) {
            console.error("Directory selection cancelled or failed:", err);
        }
    });
}

// Main Interaction Logic
async function handleCardClick(id) {
    if (isTeacherMode) {
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

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        document.getElementById(currentlyRecordingId).classList.remove('recording');
        currentlyRecordingId = null;
    }
}

// Direct save using File System Access API
async function saveToDirectory(blob, fileName) {
    try {
        const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        console.log(`Saved directly: ${fileName}`);
    } catch (err) {
        console.error("Failed to save directly, falling back to download:", err);
        // Fallback to normal download if direct save fails
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
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
    const audioPath = `./audio/${id}.webm`;
    const audio = new Audio(audioPath);
    
    audio.play().catch(err => {
        console.warn(`Audio file not found: ${audioPath}`);
        // Visual feedback for missing file
        const card = document.getElementById(id);
        card.style.borderColor = '#e74c3c';
        setTimeout(() => card.style.borderColor = 'transparent', 500);
    });
}

// Start the app
init();
