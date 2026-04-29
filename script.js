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

// DOM Elements
const wordsGrid = document.getElementById('wordsGrid');
const modeToggle = document.getElementById('modeToggle');

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
        
        // Stop any active recording if mode changes
        if (!isTeacherMode && currentlyRecordingId) {
            stopRecording();
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

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            downloadAudio(audioBlob, id);
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
    const card = document.getElementById(id);
    
    // Visual feedback: adding 'playing' class
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
