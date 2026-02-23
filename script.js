// ==================== اتصال به API ====================
const API_BASE = 'https://sabyl.ir/api';

// ==================== داده‌های برنامه ====================
let appData = {
    suras: [],
    currentSura: 1,
    currentVerse: 1,
    totalVerses: 6236,
    memorizedVerses: JSON.parse(localStorage.getItem('memorizedVerses')) || [],
    bookmarks: JSON.parse(localStorage.getItem('bookmarks')) || [],
    notes: JSON.parse(localStorage.getItem('notes')) || {},
    practiceScore: JSON.parse(localStorage.getItem('practiceScore')) || {
        correct: 0,
        wrong: 0,
        total: 0,
        streak: 0
    },
    quizScore: JSON.parse(localStorage.getItem('quizScore')) || {
        total: 0,
        correct: 0,
        wrong: 0,
        history: []
    },
    achievements: JSON.parse(localStorage.getItem('achievements')) || [],
    studyTime: parseInt(localStorage.getItem('studyTime')) || 0,
    lastActive: localStorage.getItem('lastActive') || null,
    currentStreak: parseInt(localStorage.getItem('streak')) || 0,
    points: parseInt(localStorage.getItem('points')) || 0,
    settings: JSON.parse(localStorage.getItem('settings')) || {
        fontSize: 'large',
        theme: 'dark',
        reciter: 'abdulbasit',
        playbackSpeed: 1,
        repeatMode: 'none',
        dailyGoal: 5,
        speechRecognition: 'normal'
    }
};

// ==================== متغیرهای سراسری ====================
let audioPlayer = new Audio();
let isPlaying = false;
let recognition = null;
let isRecording = false;
let practiceVerses = [];
let currentPracticeIndex = 0;
let quizQuestions = [];
let currentQuizIndex = 0;
let quizScore = 0;
let chart = null;
let currentSuraVerses = [];
let autoNextTimeout = null;

// ==================== لودینگ ====================
function updateLoading(progress, status) {
    const progressFill = document.getElementById('loadingProgress');
    const statusEl = document.getElementById('loadingStatus');
    if (progressFill) progressFill.style.width = progress + '%';
    if (statusEl) statusEl.innerText = status;
}

async function loadApp() {
    updateLoading(10, 'در حال اتصال به سرور...');
    
    try {
        updateLoading(30, 'در حال دریافت سوره‌ها...');
        const response = await fetch(`${API_BASE}/suras`);
        const result = await response.json();
        
        if (result.status === 'success') {
            appData.suras = result.data;
            updateLoading(60, 'در حال آماده‌سازی...');
            
            appData.totalVerses = appData.suras.reduce((sum, sura) => sum + parseInt(sura.verse_count), 0);
            
            updateLoading(90, 'در حال راه‌اندازی...');
            
            displaySuras();
            populateSurahSelects();
            updateStreak();
            initSpeechRecognition();
            applySettings();
            updateStats();
            
            updateLoading(100, 'شروع برنامه...');
            
            setTimeout(() => {
                document.getElementById('loadingScreen').style.opacity = '0';
                setTimeout(() => {
                    document.getElementById('loadingScreen').style.display = 'none';
                    document.getElementById('mainApp').style.display = 'block';
                }, 500);
            }, 500);
        }
    } catch (error) {
        console.error('خطا:', error);
        useOfflineData();
    }
}

// ==================== داده‌های آفلاین ====================
function useOfflineData() {
    appData.suras = [
        { id: 1, name: 'الفاتحة', verse_count: 7 },
        { id: 2, name: 'البقرة', verse_count: 286 }
    ];
    
    updateLoading(100, 'حالت آفلاین فعال شد');
    
    setTimeout(() => {
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        displaySuras();
        populateSurahSelects();
        updateStats();
        applySettings();
        showNotification('حالت آفلاین فعال شد', 'warning');
    }, 1000);
}

// ==================== اعمال تنظیمات ====================
function applySettings() {
    if (appData.settings.theme === 'light') {
        document.body.classList.add('light-mode');
    }
    setFontSize(appData.settings.fontSize);
    audioPlayer.playbackRate = appData.settings.playbackSpeed;
}

// ==================== ناوبری ====================
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function(e) {
        e.preventDefault();
        switchPage(this.dataset.page);
    });
});

function switchPage(pageId) {
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    document.querySelector(`[data-page="${pageId}"]`).classList.add('active');
    
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(pageId + 'Page').classList.add('active');
    
    if (pageId === 'memorize') {
        loadSuraVerses(appData.currentSura);
    } else if (pageId === 'practice') {
        updatePracticeSurahSelect();
    } else if (pageId === 'quiz') {
        loadQuizHistory();
    } else if (pageId === 'progress') {
        updateProgressPage();
    } else if (pageId === 'settings') {
        loadSettings();
    }
}

// ==================== نمایش سوره‌ها ====================
function displaySuras() {
    const grid = document.getElementById('surahGrid');
    if (!grid) return;
    
    let html = '';
    appData.suras.forEach((sura, index) => {
        const memorizedCount = appData.memorizedVerses.filter(v => v.suraId === sura.id).length;
        const progress = (memorizedCount / parseInt(sura.verse_count)) * 100;
        
        html += `
            <div class="surah-card" onclick="selectSura(${sura.id})">
                <div class="surah-number">${sura.id}</div>
                <div class="surah-name">${sura.name}</div>
                <div class="surah-info">${sura.verse_count} آیه</div>
                <div class="surah-progress">
                    <div class="surah-progress-bar" style="width: ${progress}%"></div>
                </div>
                ${memorizedCount > 0 ? `<span class="tag">${memorizedCount}</span>` : ''}
            </div>
        `;
    });
    
    grid.innerHTML = html;
}

// ==================== فیلتر سوره‌ها ====================
function filterSurahs() {
    const searchTerm = document.getElementById('surahSearch').value.toLowerCase();
    const cards = document.querySelectorAll('.surah-card');
    
    cards.forEach(card => {
        const name = card.querySelector('.surah-name').innerText.toLowerCase();
        card.style.display = name.includes(searchTerm) || searchTerm === '' ? 'block' : 'none';
    });
}

function toggleFilterMenu() {
    const menu = document.getElementById('filterMenu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

// ==================== انتخاب سوره ====================
function selectSura(suraId) {
    appData.currentSura = suraId;
    appData.currentVerse = 1;
    switchPage('memorize');
    loadSuraVerses(suraId);
}

// ==================== پر کردن سلیکت سوره‌ها ====================
function populateSurahSelects() {
    const select = document.getElementById('practiceSurahSelect');
    if (!select) return;
    
    let options = '<option value="0">انتخاب سوره</option>';
    appData.suras.forEach(sura => {
        options += `<option value="${sura.id}">${sura.id}. ${sura.name}</option>`;
    });
    select.innerHTML = options;
}

function updatePracticeSurahSelect() {
    const select = document.getElementById('practiceSurahSelect');
    if (select) {
        select.value = appData.currentSura;
        updatePracticeVerses();
    }
}

function updatePracticeVerses() {
    const surahId = parseInt(document.getElementById('practiceSurahSelect').value);
    const sura = appData.suras.find(s => s.id === surahId);
    
    if (sura) {
        document.getElementById('practiceToVerse').max = sura.verse_count;
        document.getElementById('practiceToVerse').value = sura.verse_count;
    }
}

// ==================== دریافت آیات سوره ====================
async function loadSuraVerses(suraId) {
    try {
        const response = await fetch(`${API_BASE}/suras/${suraId}/verses`);
        const result = await response.json();
        
        if (result.status === 'success' && result.data) {
            currentSuraVerses = result.data.verses || result.data || [];
            
            const sura = appData.suras.find(s => s.id === suraId);
            document.getElementById('surahNameDisplay').innerText = sura ? sura.name : 'الفاتحة';
            document.getElementById('surahType').innerText = 'مکی';
            document.getElementById('surahVersesCount').innerText = sura ? sura.verse_count : 7;
            document.getElementById('totalInSurah').innerText = sura ? sura.verse_count : 7;
            document.getElementById('currentSurahAudio').innerText = sura ? sura.name : 'الفاتحة';
            
            appData.currentVerse = 1;
            displayVerse(1);
            updateSurahProgress(suraId);
        }
    } catch (error) {
        console.error('خطا:', error);
        showNotification('خطا در دریافت آیات', 'error');
    }
}

// ==================== نمایش آیه ====================
function displayVerse(verseNumber) {
    const verse = currentSuraVerses[verseNumber - 1];
    if (!verse) return;
    
    document.getElementById('verseNumber').innerText = toArabicNumber(verseNumber);
    document.getElementById('currentVerseNum').innerText = verseNumber;
    document.getElementById('totalVersesNum').innerText = currentSuraVerses.length;
    document.getElementById('verseArabic').innerHTML = verse.arabic_text || '';
    document.getElementById('verseTranslation').innerHTML = verse.persian_translation || '';
    document.getElementById('verseTafsir').innerHTML = verse.tafsir || 'تفسیر این آیه...';
    
    displayWordAnalysis(verse);
    
    const verseKey = `${appData.currentSura}:${verseNumber}`;
    const bookmarkIcon = document.getElementById('bookmarkIcon');
    bookmarkIcon.className = appData.bookmarks.includes(verseKey) ? 'fas fa-bookmark' : 'far fa-bookmark';
    
    const note = appData.notes[verseKey];
    document.getElementById('verseNote').value = note || '';
    
    setupAudio(verseNumber);
    updateMasteryButtons(verseKey);
}

// ==================== تحلیل کلمه به کلمه ====================
function displayWordAnalysis(verse) {
    const container = document.getElementById('wordAnalysis');
    if (!container || !verse.arabic_text) return;
    
    const words = verse.arabic_text.split(' ');
    let html = '<div class="words-container">';
    words.forEach((word, index) => {
        html += `<div class="word-chip" onclick="showWordMeaning('${word}', ${index})">${word}</div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

function showWordMeaning(word, index) {
    showNotification(`کلمه ${index + 1}`, 'info');
}

// ==================== سطح تسلط ====================
function updateMasteryButtons(verseKey) {
    const memorized = appData.memorizedVerses.find(v => v.key === verseKey);
    const level = memorized ? memorized.level : 0;
    
    document.querySelectorAll('.mastery-level').forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.dataset.level) === level) {
            btn.classList.add('active');
        }
    });
}

function setMasteryLevel(level) {
    const verseKey = `${appData.currentSura}:${appData.currentVerse}`;
    
    const existingIndex = appData.memorizedVerses.findIndex(v => v.key === verseKey);
    
    if (existingIndex >= 0) {
        appData.memorizedVerses[existingIndex].level = level;
        appData.memorizedVerses[existingIndex].lastReview = new Date().toISOString();
        appData.memorizedVerses[existingIndex].reviewCount = (appData.memorizedVerses[existingIndex].reviewCount || 0) + 1;
    } else {
        appData.memorizedVerses.push({
            key: verseKey,
            suraId: appData.currentSura,
            verseId: appData.currentVerse,
            level: level,
            firstMemorized: new Date().toISOString(),
            lastReview: new Date().toISOString(),
            reviewCount: 1
        });
    }
    
    appData.points += level * 10;
    
    localStorage.setItem('memorizedVerses', JSON.stringify(appData.memorizedVerses));
    localStorage.setItem('points', appData.points);
    
    updateStats();
    updateMasteryButtons(verseKey);
    updateSurahProgress(appData.currentSura);
    
    const messages = ['📖 در حال یادگیری', '🔄 نیاز به مرور', '✅ حفظ شد', '🌟 متقن شد'];
    showNotification(messages[level - 1] || '', 'success');
}

// ==================== بوکمارک ====================
function bookmarkVerse() {
    const verseKey = `${appData.currentSura}:${appData.currentVerse}`;
    const icon = document.getElementById('bookmarkIcon');
    
    if (appData.bookmarks.includes(verseKey)) {
        appData.bookmarks = appData.bookmarks.filter(b => b !== verseKey);
        icon.className = 'far fa-bookmark';
        showNotification('از بوکمارک حذف شد', 'info');
    } else {
        appData.bookmarks.push(verseKey);
        icon.className = 'fas fa-bookmark';
        showNotification('به بوکمارک اضافه شد', 'success');
    }
    
    localStorage.setItem('bookmarks', JSON.stringify(appData.bookmarks));
}

// ==================== اشتراک‌گذاری ====================
function shareVerse() {
    const text = document.getElementById('verseArabic').innerText;
    if (navigator.share) {
        navigator.share({ title: 'آیه قرآن', text: text });
    } else {
        navigator.clipboard.writeText(text);
        showNotification('آیه کپی شد', 'success');
    }
}

// ==================== پخش آیه فعلی ====================
function playCurrentVerse() {
    document.getElementById('playPauseBtn').click();
}

// ==================== یادداشت ====================
function saveNote() {
    const verseKey = `${appData.currentSura}:${appData.currentVerse}`;
    const note = document.getElementById('verseNote').value;
    
    if (note.trim()) {
        appData.notes[verseKey] = note;
        localStorage.setItem('notes', JSON.stringify(appData.notes));
        showNotification('یادداشت ذخیره شد', 'success');
    }
}

// ==================== تنظیمات تکرار ====================
function showRepeatSettings() {
    showNotification('تنظیمات تکرار', 'info');
}

// ==================== ناوبری آیات ====================
document.getElementById('prevVerseBtn')?.addEventListener('click', () => {
    if (appData.currentVerse > 1) {
        appData.currentVerse--;
        displayVerse(appData.currentVerse);
        document.getElementById('flashcard').classList.remove('flipped');
    }
});

document.getElementById('nextVerseBtn')?.addEventListener('click', () => {
    if (appData.currentVerse < currentSuraVerses.length) {
        appData.currentVerse++;
        displayVerse(appData.currentVerse);
        document.getElementById('flashcard').classList.remove('flipped');
    }
});

document.getElementById('prevSurahBtn')?.addEventListener('click', () => {
    if (appData.currentSura > 1) {
        appData.currentSura--;
        loadSuraVerses(appData.currentSura);
    }
});

document.getElementById('nextSurahBtn')?.addEventListener('click', () => {
    if (appData.currentSura < 114) {
        appData.currentSura++;
        loadSuraVerses(appData.currentSura);
    }
});

document.getElementById('prevVerseAudio')?.addEventListener('click', () => {
    document.getElementById('prevVerseBtn').click();
});

document.getElementById('nextVerseAudio')?.addEventListener('click', () => {
    document.getElementById('nextVerseBtn').click();
});

// ==================== فلش کارت ====================
document.getElementById('flashcard')?.addEventListener('click', function() {
    this.classList.toggle('flipped');
});

// ==================== پلیر صوتی ====================
function setupAudio(verseNumber) {
    // اینجا لینک فایل صوتی قرار می‌گیرد
}

document.getElementById('playPauseBtn')?.addEventListener('click', function() {
    if (isPlaying) {
        audioPlayer.pause();
        this.innerHTML = '<i class="fas fa-play"></i>';
    } else {
        audioPlayer.play().catch(() => showNotification('فایل صوتی موجود نیست', 'warning'));
        this.innerHTML = '<i class="fas fa-pause"></i>';
    }
    isPlaying = !isPlaying;
});

document.getElementById('repeatModeBtn')?.addEventListener('click', function() {
    const modes = ['none', 'verse', 'surah'];
    const currentIndex = modes.indexOf(appData.settings.repeatMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    appData.settings.repeatMode = modes[nextIndex];
    localStorage.setItem('settings', JSON.stringify(appData.settings));
    
    const texts = ['بدون تکرار', 'تکرار آیه', 'تکرار سوره'];
    showNotification(`حالت تکرار: ${texts[nextIndex]}`, 'info');
});

document.getElementById('speedBtn')?.addEventListener('click', function() {
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const currentIndex = speeds.indexOf(appData.settings.playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    
    appData.settings.playbackSpeed = speeds[nextIndex];
    audioPlayer.playbackRate = appData.settings.playbackSpeed;
    localStorage.setItem('settings', JSON.stringify(appData.settings));
    this.innerHTML = `<i class="fas fa-tachometer-alt"></i> ${appData.settings.playbackSpeed}x`;
});

audioPlayer.addEventListener('timeupdate', function() {
    const progress = (this.currentTime / this.duration) * 100 || 0;
    document.getElementById('audioProgress').style.width = progress + '%';
    
    document.getElementById('currentTime').innerText = formatTime(this.currentTime);
    document.getElementById('duration').innerText = formatTime(this.duration);
});

audioPlayer.addEventListener('ended', function() {
    if (appData.settings.repeatMode === 'verse') {
        this.currentTime = 0;
        this.play();
    } else if (appData.settings.repeatMode === 'surah') {
        document.getElementById('nextVerseBtn').click();
    } else {
        document.getElementById('playPauseBtn').innerHTML = '<i class="fas fa-play"></i>';
        isPlaying = false;
    }
});

// ==================== تشخیص صدا ====================
function initSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'ar-SA';
        recognition.maxAlternatives = 3;
        
        recognition.onresult = function(event) {
            const results = Array.from(event.results)
                .map(result => result[0].transcript)
                .filter((v, i, a) => a.indexOf(v) === i);
            
            document.getElementById('practiceResult').style.display = 'block';
            document.getElementById('resultDetails').innerHTML = `متن تشخیص داده شده: ${results.join(' یا ')}`;
            document.getElementById('checkBtn').style.display = 'block';
            
            compareWithVerse(results);
        };
        
        recognition.onerror = function(event) {
            console.error('خطای تشخیص صدا:', event.error);
            showNotification('خطا در تشخیص صدا. دوباره تلاش کنید.', 'error');
            stopRecording();
        };
        
        recognition.onend = function() {
            if (isRecording) {
                stopRecording();
            }
        };
    }
}

function toggleRecording() {
    if (!recognition) {
        showNotification('مرورگر شما از تشخیص صدا پشتیبانی نمی‌کند', 'error');
        return;
    }
    
    const recordBtn = document.getElementById('recordBtn');
    const recordingIndicator = document.getElementById('recordingIndicator');
    const checkBtn = document.getElementById('checkBtn');
    const practiceType = document.getElementById('practiceType').value;
    const currentVerse = practiceVerses[currentPracticeIndex];
    
    if (!isRecording) {
        if (practiceType === 'reading') {
            document.getElementById('practiceVerseDisplay').innerHTML = '';
            document.getElementById('practiceQuestion').innerHTML = 'آیه را بخوانید:';
        } else if (practiceType === 'translation') {
            getVerseData(currentVerse.suraId, currentVerse.verseId).then(verseData => {
                if (verseData) {
                    document.getElementById('practiceVerseDisplay').innerHTML = verseData.arabic_text || '';
                    document.getElementById('practiceQuestion').innerHTML = 'ترجمه این آیه را بخوانید:';
                }
            });
        }
        
        try {
            recognition.start();
            isRecording = true;
            recordBtn.innerHTML = '<i class="fas fa-stop"></i> توقف ضبط';
            recordingIndicator.style.display = 'flex';
            checkBtn.style.display = 'none';
        } catch (error) {
            showNotification('خطا در شروع ضبط', 'error');
        }
    } else {
        stopRecording();
    }
}

function stopRecording() {
    if (recognition) {
        try {
            recognition.stop();
        } catch (error) {}
    }
    
    isRecording = false;
    document.getElementById('recordBtn').innerHTML = '<i class="fas fa-microphone"></i> شروع ضبط';
    document.getElementById('recordingIndicator').style.display = 'none';
}

// ==================== نرمال‌سازی متن ====================
function normalizeText(text) {
    if (!text) return '';
    
    // حذف اعراب
    text = text.replace(/[ًٌٍَُِّْ]/g, '');
    
    // نرمال‌سازی حروف
    const normalizations = {
        'أ': 'ا', 'إ': 'ا', 'آ': 'ا',
        'ة': 'ه',
        'ى': 'ي',
        'ؤ': 'و', 'ئ': 'ي'
    };
    
    for (let [key, value] of Object.entries(normalizations)) {
        text = text.replace(new RegExp(key, 'g'), value);
    }
    
    // حذف فاصله‌های اضافی
    text = text.replace(/\s+/g, ' ').trim();
    
    return text;
}

function calculateSimilarity(str1, str2) {
    const s1 = normalizeText(str1);
    const s2 = normalizeText(str2);
    
    if (!s1 || !s2) return 0;
    
    const words1 = s1.split(' ');
    const words2 = s2.split(' ');
    
    let matches = 0;
    for (let word1 of words1) {
        for (let word2 of words2) {
            if (word1 === word2) {
                matches++;
                break;
            }
        }
    }
    
    let similarity = matches / Math.max(words1.length, words2.length);
    
    // اگر متن کوتاه است
    if (words1.length <= 3) {
        const len = Math.max(s1.length, s2.length);
        let charMatches = 0;
        for (let i = 0; i < Math.min(s1.length, s2.length); i++) {
            if (s1[i] === s2[i]) charMatches++;
        }
        similarity = Math.max(similarity, charMatches / len);
    }
    
    return similarity;
}

// ==================== مقایسه و رفتن به آیه بعد ====================
function compareWithVerse(spokenTexts) {
    const currentVerse = practiceVerses[currentPracticeIndex];
    if (!currentVerse) return;
    
    getVerseData(currentVerse.suraId, currentVerse.verseId).then(verseData => {
        const practiceType = document.getElementById('practiceType').value;
        let originalText = '';
        
        if (practiceType === 'reading') {
            originalText = verseData.arabic_text || '';
        } else if (practiceType === 'translation') {
            originalText = verseData.persian_translation || '';
        }
        
        let bestMatch = 0;
        for (let spoken of spokenTexts) {
            const similarity = calculateSimilarity(spoken, originalText);
            if (similarity > bestMatch) {
                bestMatch = similarity;
            }
        }
        
        let threshold = 0.6;
        if (appData.settings.speechRecognition === 'exact') threshold = 0.8;
        else if (appData.settings.speechRecognition === 'flexible') threshold = 0.4;
        
        const isCorrect = bestMatch >= threshold;
        
        document.getElementById('resultScore').innerHTML = `
            <span style="color: ${isCorrect ? 'var(--success)' : 'var(--danger)'}">
                ${Math.round(bestMatch * 100)}% مطابقت
            </span>
        `;
        
        if (isCorrect) {
            appData.practiceScore.correct++;
            document.getElementById('resultFeedback').innerHTML = '✅ صحیح است! آفرین';
            appData.practiceScore.streak++;
        } else {
            appData.practiceScore.wrong++;
            document.getElementById('resultFeedback').innerHTML = `❌ اشتباه. متن صحیح: ${originalText}`;
            appData.practiceScore.streak = 0;
        }
        
        appData.practiceScore.total++;
        updatePracticeStats();
        localStorage.setItem('practiceScore', JSON.stringify(appData.practiceScore));
        
        // رفتن به آیه بعدی بعد از 2 ثانیه
        if (autoNextTimeout) clearTimeout(autoNextTimeout);
        autoNextTimeout = setTimeout(() => {
            nextPractice();
        }, 2000);
    });
}

function checkPractice() {
    // این تابع فقط برای هماهنگی با HTML保留 شده
}

// ==================== تمرین صوتی ====================
function startVoicePractice() {
    const surahId = parseInt(document.getElementById('practiceSurahSelect').value);
    const fromVerse = parseInt(document.getElementById('practiceFromVerse').value);
    const toVerse = parseInt(document.getElementById('practiceToVerse').value);
    
    if (!surahId || surahId === 0) {
        showNotification('لطفاً سوره را انتخاب کنید', 'warning');
        return;
    }
    
    practiceVerses = [];
    for (let i = fromVerse; i <= toVerse; i++) {
        practiceVerses.push({ suraId: surahId, verseId: i });
    }
    
    currentPracticeIndex = 0;
    
    document.querySelector('.practice-settings-card').style.display = 'none';
    document.getElementById('practiceArea').style.display = 'block';
    document.getElementById('practiceStats').style.display = 'grid';
    
    showPracticeQuestion();
}

function showPracticeQuestion() {
    if (currentPracticeIndex >= practiceVerses.length) {
        finishPractice();
        return;
    }
    
    const verse = practiceVerses[currentPracticeIndex];
    const sura = appData.suras.find(s => s.id === verse.suraId);
    
    document.getElementById('practiceSurahName').innerHTML = sura ? sura.name : '';
    document.getElementById('practiceVerseRange').innerHTML = `آیه ${verse.verseId}`;
    document.getElementById('practiceCurrent').innerHTML = currentPracticeIndex + 1;
    document.getElementById('practiceTotal').innerHTML = practiceVerses.length;
    
    getVerseData(verse.suraId, verse.verseId).then(verseData => {
        const practiceType = document.getElementById('practiceType').value;
        
        if (practiceType === 'reading') {
            document.getElementById('practiceQuestion').innerHTML = 'آیه را بخوانید:';
            document.getElementById('practiceVerseDisplay').innerHTML = '';
        } else if (practiceType === 'translation') {
            document.getElementById('practiceQuestion').innerHTML = 'ترجمه این آیه را بخوانید:';
            document.getElementById('practiceVerseDisplay').innerHTML = verseData.arabic_text || '';
        } else {
            const words = (verseData.arabic_text || '').split(' ');
            const half = Math.floor(words.length / 2);
            document.getElementById('practiceQuestion').innerHTML = 'ادامه آیه را بخوانید:';
            document.getElementById('practiceVerseDisplay').innerHTML = `
                <span style="color: var(--accent);">${words.slice(0, half).join(' ')}</span>
            `;
        }
    });
    
    // ریست کردن وضعیت
    document.getElementById('practiceResult').style.display = 'none';
    document.getElementById('recordBtn').innerHTML = '<i class="fas fa-microphone"></i> شروع ضبط';
    document.getElementById('recordingIndicator').style.display = 'none';
    document.getElementById('checkBtn').style.display = 'none';
}

function nextPractice() {
    if (currentPracticeIndex < practiceVerses.length - 1) {
        currentPracticeIndex++;
        showPracticeQuestion();
    } else {
        finishPractice();
    }
}

function stopPractice() {
    stopRecording();
    if (autoNextTimeout) clearTimeout(autoNextTimeout);
    
    document.querySelector('.practice-settings-card').style.display = 'block';
    document.getElementById('practiceArea').style.display = 'none';
    document.getElementById('practiceStats').style.display = 'none';
}

function finishPractice() {
    stopRecording();
    if (autoNextTimeout) clearTimeout(autoNextTimeout);
    
    showNotification('🎉 تمرین به پایان رسید! عالی کار کردی', 'success');
    
    document.querySelector('.practice-settings-card').style.display = 'block';
    document.getElementById('practiceArea').style.display = 'none';
    document.getElementById('practiceStats').style.display = 'grid';
}

// ==================== آزمون ====================
function switchQuizMode(mode) {
    document.querySelectorAll('.quiz-tab').forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');
}

async function startQuiz() {
    const count = parseInt(document.getElementById('quizCount').value);
    
    quizQuestions = [];
    currentQuizIndex = 0;
    quizScore = 0;
    
    for (let i = 0; i < count; i++) {
        const suraId = Math.floor(Math.random() * 114) + 1;
        const sura = appData.suras.find(s => s.id === suraId);
        if (sura) {
            const verseId = Math.floor(Math.random() * sura.verse_count) + 1;
            quizQuestions.push({ suraId: suraId, verseId: verseId });
        }
    }
    
    document.querySelector('.quiz-settings').style.display = 'none';
    document.getElementById('quizArea').style.display = 'block';
    document.getElementById('quizTotalQuestions').innerHTML = quizQuestions.length;
    document.getElementById('quizScore').innerHTML = '0';
    document.getElementById('quizProgressFill').style.width = '0%';
    
    showQuizQuestion();
}

async function showQuizQuestion() {
    if (currentQuizIndex >= quizQuestions.length) {
        finishQuiz();
        return;
    }
    
    const question = quizQuestions[currentQuizIndex];
    document.getElementById('quizCurrentQuestion').innerHTML = currentQuizIndex + 1;
    
    const verseData = await getVerseData(question.suraId, question.verseId);
    if (!verseData) return;
    
    const mode = document.querySelector('.quiz-tab.active')?.innerText || 'ترجمه';
    
    if (mode === 'ترجمه') {
        document.getElementById('quizQuestion').innerHTML = `
            <div style="font-size: 1.5em; margin-bottom: 15px;">${verseData.arabic_text || ''}</div>
            <div>ترجمه صحیح کدام است؟</div>
        `;
        
        const options = [verseData.persian_translation || ''];
        while (options.length < 4) {
            const randomSura = Math.floor(Math.random() * 114) + 1;
            const randomVerse = Math.floor(Math.random() * 50) + 1;
            const randomData = await getVerseData(randomSura, randomVerse);
            if (randomData?.persian_translation && !options.includes(randomData.persian_translation)) {
                options.push(randomData.persian_translation);
            }
        }
        
        options.sort(() => Math.random() - 0.5);
        
        let optionsHtml = '';
        options.forEach(option => {
            optionsHtml += `
                <div class="quiz-option" onclick="selectQuizOption(this, '${option.replace(/'/g, "\\'")}', '${verseData.persian_translation.replace(/'/g, "\\'")}')">
                    ${option}
                </div>
            `;
        });
        
        document.getElementById('quizOptions').innerHTML = optionsHtml;
    }
    
    document.getElementById('nextQuizBtn').disabled = true;
    document.getElementById('quizFeedback').innerHTML = '';
}

function selectQuizOption(element, selected, correct) {
    document.querySelectorAll('.quiz-option').forEach(opt => opt.style.pointerEvents = 'none');
    
    const isCorrect = selected === correct;
    
    if (isCorrect) {
        element.classList.add('correct');
        quizScore++;
        document.getElementById('quizScore').innerHTML = quizScore;
        document.getElementById('quizFeedback').innerHTML = '✅ پاسخ صحیح! آفرین';
    } else {
        element.classList.add('wrong');
        document.getElementById('quizFeedback').innerHTML = `❌ پاسخ صحیح: ${correct}`;
        
        document.querySelectorAll('.quiz-option').forEach(opt => {
            if (opt.innerText === correct) opt.classList.add('correct');
        });
    }
    
    document.getElementById('nextQuizBtn').disabled = false;
    
    appData.quizScore.total++;
    if (isCorrect) appData.quizScore.correct++;
    else appData.quizScore.wrong++;
    
    localStorage.setItem('quizScore', JSON.stringify(appData.quizScore));
}

function nextQuizQuestion() {
    currentQuizIndex++;
    document.getElementById('quizProgressFill').style.width = 
        ((currentQuizIndex) / quizQuestions.length * 100) + '%';
    
    if (currentQuizIndex < quizQuestions.length) {
        showQuizQuestion();
    } else {
        finishQuiz();
    }
}

function finishQuiz() {
    const percent = Math.round((quizScore / quizQuestions.length) * 100);
    
    appData.quizScore.history.push({
        date: new Date().toISOString(),
        score: quizScore,
        total: quizQuestions.length,
        percent: percent
    });
    
    localStorage.setItem('quizScore', JSON.stringify(appData.quizScore));
    
    document.getElementById('quizArea').innerHTML = `
        <div style="text-align: center; padding: 30px;">
            <i class="fas fa-trophy" style="font-size: 4em; color: var(--accent); margin-bottom: 15px;"></i>
            <h2 style="color: var(--accent); margin-bottom: 15px;">آزمون به پایان رسید</h2>
            <div style="font-size: 2em; margin: 15px 0;">${quizScore} از ${quizQuestions.length}</div>
            <div style="font-size: 1.3em; color: ${percent >= 70 ? 'var(--success)' : percent >= 50 ? 'var(--warning)' : 'var(--danger)'}; margin-bottom: 20px;">
                ${percent}%
            </div>
            <button class="start-quiz-btn" onclick="resetQuiz()">
                <i class="fas fa-redo"></i> آزمون جدید
            </button>
        </div>
    `;
}

function resetQuiz() {
    location.reload();
}

function loadQuizHistory() {
    const history = appData.quizScore.history || [];
    const list = document.getElementById('quizHistoryList');
    if (!list) return;
    
    if (history.length === 0) {
        list.innerHTML = '<div style="text-align: center; padding: 15px;">هنوز آزمونی شرکت نکرده‌اید</div>';
        return;
    }
    
    let html = '';
    history.slice(-5).reverse().forEach(item => {
        const date = new Date(item.date).toLocaleDateString('fa-IR');
        html += `
            <div class="history-item">
                <span>${date}</span>
                <span>${item.score}/${item.total}</span>
                <span style="color: ${item.percent >= 70 ? 'var(--success)' : item.percent >= 50 ? 'var(--warning)' : 'var(--danger)'}">
                    ${item.percent}%
                </span>
            </div>
        `;
    });
    
    list.innerHTML = html;
}

// ==================== پیشرفت ====================
function updateProgressPage() {
    const firstMemorized = appData.memorizedVerses.length > 0 ?
        new Date(appData.memorizedVerses[0].firstMemorized) : new Date();
    const daysActive = Math.ceil((new Date() - firstMemorized) / (1000 * 60 * 60 * 24));
    
    document.getElementById('totalDays').innerText = daysActive || 0;
    document.getElementById('currentStreak').innerText = appData.currentStreak;
    document.getElementById('totalHours').innerText = Math.floor(appData.studyTime / 60);
    document.getElementById('totalPoints').innerText = appData.points;
    
    createProgressChart();
    createHeatmap();
    analyzeSurahs();
    checkAchievements();
}

function createProgressChart() {
    const ctx = document.getElementById('progressChart')?.getContext('2d');
    if (!ctx) return;
    
    const labels = [];
    const data = [];
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' }));
        
        const count = appData.memorizedVerses.filter(v => {
            const vDate = new Date(v.firstMemorized).toDateString();
            return vDate === date.toDateString();
        }).length;
        
        data.push(count);
    }
    
    if (chart) chart.destroy();
    
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'آیات حفظ شده',
                data: data,
                borderColor: '#ffd700',
                backgroundColor: 'rgba(255,215,0,0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#fff' } },
                x: { grid: { display: false }, ticks: { color: '#fff' } }
            }
        }
    });
}

function createHeatmap() {
    const heatmap = document.getElementById('heatmap');
    if (!heatmap) return;
    
    let html = '';
    for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        const activity = appData.memorizedVerses.filter(v => {
            const vDate = new Date(v.firstMemorized).toDateString();
            return vDate === date.toDateString();
        }).length;
        
        let level = 0;
        if (activity >= 5) level = 5;
        else if (activity >= 3) level = 4;
        else if (activity >= 2) level = 3;
        else if (activity >= 1) level = 2;
        else if (activity > 0) level = 1;
        
        html += `<div class="heatmap-cell level-${level}" title="${date.toLocaleDateString('fa-IR')}: ${activity} آیه"></div>`;
    }
    
    heatmap.innerHTML = html;
}

function analyzeSurahs() {
    const container = document.getElementById('surahAnalysis');
    if (!container) return;
    
    const topSurahs = appData.memorizedVerses.reduce((acc, v) => {
        acc[v.suraId] = (acc[v.suraId] || 0) + 1;
        return acc;
    }, {});
    
    const sorted = Object.entries(topSurahs).sort((a, b) => b[1] - a[1]).slice(0, 5);
    
    if (sorted.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px;">هنوز سوره‌ای حفظ نکرده‌اید</div>';
        return;
    }
    
    let html = '';
    sorted.forEach(([suraId, count]) => {
        const sura = appData.suras.find(s => s.id === parseInt(suraId));
        const total = sura ? parseInt(sura.verse_count) : 1;
        html += `
            <div class="analysis-item">
                <span>${sura?.name || 'سوره'}</span>
                <span>${count} آیه</span>
                <div class="progress-bar-small">
                    <div class="progress-fill-small" style="width: ${(count / total) * 100}%"></div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ==================== دستاوردها ====================
function checkAchievements() {
    const achievements = [
        { id: 'first', name: 'شروع طلایی', desc: 'اولین آیه را حفظ کردی', icon: 'fa-star', condition: appData.memorizedVerses.length >= 1, points: 10 },
        { id: 'ten', name: 'دهه مبارک', desc: '۱۰ آیه حفظ کردی', icon: 'fa-gem', condition: appData.memorizedVerses.length >= 10, points: 50 },
        { id: 'streak7', name: 'یک هفته پیوسته', desc: '۷ روز متوالی مطالعه', icon: 'fa-calendar-check', condition: appData.currentStreak >= 7, points: 50 }
    ];
    
    const grid = document.getElementById('achievementsGrid');
    if (!grid) return;
    
    let html = '';
    let newPoints = 0;
    
    achievements.forEach(ach => {
        const unlocked = ach.condition;
        
        if (unlocked && !appData.achievements.includes(ach.id)) {
            appData.achievements.push(ach.id);
            newPoints += ach.points;
            showNotification(`🏆 دستاورد جدید: ${ach.name} +${ach.points} امتیاز`, 'success');
        }
        
        html += `
            <div class="achievement-card ${unlocked ? 'unlocked' : ''}">
                <i class="fas ${ach.icon} achievement-icon"></i>
                <div class="achievement-name">${ach.name}</div>
                <div class="achievement-desc">${ach.desc}</div>
                ${unlocked ? '<span class="achievement-points">+' + ach.points + '</span>' : ''}
            </div>
        `;
    });
    
    grid.innerHTML = html;
    
    if (newPoints > 0) {
        appData.points += newPoints;
        localStorage.setItem('points', appData.points);
        localStorage.setItem('achievements', JSON.stringify(appData.achievements));
    }
}

// ==================== تنظیمات ====================
function loadSettings() {
    document.getElementById('fontSize').value = appData.settings.fontSize;
    document.getElementById('defaultReciter').value = appData.settings.reciter;
    document.getElementById('playbackSpeed').value = appData.settings.playbackSpeed;
    document.getElementById('speedValue').innerText = appData.settings.playbackSpeed + 'x';
    document.getElementById('repeatMode').value = appData.settings.repeatMode;
    document.getElementById('speechRecognition').value = appData.settings.speechRecognition;
    document.getElementById('dailyGoal').value = appData.settings.dailyGoal;
    
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.innerText.includes(appData.settings.theme === 'dark' ? 'تیره' : 'روشن')) {
            btn.classList.add('active');
        }
    });
}

function setTheme(theme) {
    appData.settings.theme = theme;
    document.body.classList.toggle('light-mode', theme === 'light');
    localStorage.setItem('settings', JSON.stringify(appData.settings));
}

function setFontSize(size) {
    appData.settings.fontSize = size;
    const sizes = { small: '14px', medium: '16px', large: '18px', xlarge: '20px' };
    document.documentElement.style.fontSize = sizes[size] || '16px';
    localStorage.setItem('settings', JSON.stringify(appData.settings));
}

function setArabicFont(font) {
    appData.settings.arabicFont = font;
    localStorage.setItem('settings', JSON.stringify(appData.settings));
}

function setReciter(reciter) {
    appData.settings.reciter = reciter;
    localStorage.setItem('settings', JSON.stringify(appData.settings));
}

function setPlaybackSpeed(speed) {
    appData.settings.playbackSpeed = parseFloat(speed);
    document.getElementById('speedValue').innerText = speed + 'x';
    audioPlayer.playbackRate = appData.settings.playbackSpeed;
    localStorage.setItem('settings', JSON.stringify(appData.settings));
}

function setRepeatMode(mode) {
    appData.settings.repeatMode = mode;
    localStorage.setItem('settings', JSON.stringify(appData.settings));
}

function setSpeechRecognition(mode) {
    appData.settings.speechRecognition = mode;
    localStorage.setItem('settings', JSON.stringify(appData.settings));
}

function setAutoRepeatWrong(checked) {
    appData.settings.autoRepeatWrong = checked;
    localStorage.setItem('settings', JSON.stringify(appData.settings));
}

function setQuizType(type) {
    appData.settings.quizType = type;
    localStorage.setItem('settings', JSON.stringify(appData.settings));
}

function setSRS(srs) {
    appData.settings.srsSystem = srs;
    localStorage.setItem('settings', JSON.stringify(appData.settings));
}

// ==================== پشتیبان‌گیری ====================
function backupData() {
    const data = {
        memorizedVerses: appData.memorizedVerses,
        bookmarks: appData.bookmarks,
        notes: appData.notes,
        practiceScore: appData.practiceScore,
        quizScore: appData.quizScore,
        achievements: appData.achievements,
        points: appData.points,
        settings: appData.settings
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quran-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    showNotification('پشتیبان با موفقیت ساخته شد', 'success');
}

function restoreData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = function(e) {
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                
                appData.memorizedVerses = data.memorizedVerses || [];
                appData.bookmarks = data.bookmarks || [];
                appData.notes = data.notes || {};
                appData.practiceScore = data.practiceScore || appData.practiceScore;
                appData.quizScore = data.quizScore || appData.quizScore;
                appData.achievements = data.achievements || [];
                appData.points = data.points || 0;
                appData.settings = data.settings || appData.settings;
                
                localStorage.setItem('memorizedVerses', JSON.stringify(appData.memorizedVerses));
                localStorage.setItem('bookmarks', JSON.stringify(appData.bookmarks));
                localStorage.setItem('notes', JSON.stringify(appData.notes));
                localStorage.setItem('practiceScore', JSON.stringify(appData.practiceScore));
                localStorage.setItem('quizScore', JSON.stringify(appData.quizScore));
                localStorage.setItem('achievements', JSON.stringify(appData.achievements));
                localStorage.setItem('points', appData.points);
                localStorage.setItem('settings', JSON.stringify(appData.settings));
                
                showNotification('بازیابی با موفقیت انجام شد', 'success');
                setTimeout(() => location.reload(), 2000);
            } catch (error) {
                showNotification('خطا در بازیابی فایل', 'error');
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

function resetData() {
    if (confirm('آیا از بازنشانی همه اطلاعات اطمینان دارید؟')) {
        localStorage.clear();
        showNotification('همه اطلاعات پاک شد', 'info');
        setTimeout(() => location.reload(), 2000);
    }
}

// ==================== توابع کمکی ====================
function toArabicNumber(num) {
    const arabicNumbers = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return num.toString().split('').map(d => arabicNumbers[parseInt(d)]).join('');
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

async function getVerseData(suraId, verseId) {
    try {
        const response = await fetch(`${API_BASE}/suras/${suraId}/verses`);
        const result = await response.json();
        
        if (result.status === 'success' && result.data) {
            const verses = result.data.verses || result.data;
            return verses[verseId - 1] || null;
        }
    } catch (error) {
        console.error('خطا:', error);
    }
    return null;
}

function updateStats() {
    const memorizedCount = appData.memorizedVerses.length;
    const masteryPercent = appData.totalVerses > 0 ? Math.round((memorizedCount / appData.totalVerses) * 100) : 0;
    
    document.getElementById('totalVersesHome').innerText = appData.totalVerses.toLocaleString();
    document.getElementById('memorizedVersesHome').innerText = memorizedCount;
    document.getElementById('studyHoursHome').innerText = Math.floor(appData.studyTime / 60);
    document.getElementById('masteryPercentHome').innerText = masteryPercent + '%';
    document.getElementById('streakCount').innerText = appData.currentStreak;
    document.getElementById('pointsCount').innerText = appData.points;
    
    let level = 'مبتدی';
    if (appData.points >= 1000) level = 'استاد';
    else if (appData.points >= 500) level = 'پیشرفته';
    else if (appData.points >= 200) level = 'متوسط';
    
    document.getElementById('levelName').innerText = level;
}

function updateStreak() {
    const today = new Date().toDateString();
    
    if (appData.lastActive) {
        const lastDate = new Date(appData.lastActive).toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        
        if (lastDate === yesterday) {
            appData.currentStreak++;
        } else if (lastDate !== today) {
            appData.currentStreak = 1;
        }
    } else {
        appData.currentStreak = 1;
    }
    
    appData.lastActive = new Date().toISOString();
    localStorage.setItem('streak', appData.currentStreak);
    localStorage.setItem('lastActive', appData.lastActive);
}

function updateSurahProgress(suraId) {
    const memorizedInSurah = appData.memorizedVerses.filter(v => v.suraId === suraId).length;
    const totalInSurah = appData.suras.find(s => s.id === suraId)?.verse_count || 0;
    
    document.getElementById('memorizedInSurah').innerText = memorizedInSurah;
    document.getElementById('surahProgressFill').style.width = totalInSurah > 0 ? (memorizedInSurah / totalInSurah * 100) + '%' : '0%';
}

function updatePracticeStats() {
    const total = appData.practiceScore.correct + appData.practiceScore.wrong;
    const accuracy = total > 0 ? Math.round((appData.practiceScore.correct / total) * 100) : 0;
    
    document.getElementById('correctCount').innerText = appData.practiceScore.correct;
    document.getElementById('wrongCount').innerText = appData.practiceScore.wrong;
    document.getElementById('accuracyPercent').innerText = accuracy + '%';
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = 'notification';
    
    const colors = { success: 'var(--success)', error: 'var(--danger)', warning: 'var(--warning)', info: 'var(--accent)' };
    notification.style.backgroundColor = colors[type] || colors.info;
    notification.innerText = message;
    
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// ==================== افزایش زمان مطالعه ====================
setInterval(() => {
    const activeNav = document.querySelector('.nav-item.active');
    if (activeNav && ['home', 'memorize', 'practice', 'quiz'].includes(activeNav.dataset.page)) {
        appData.studyTime += 1/60;
        localStorage.setItem('studyTime', appData.studyTime);
    }
}, 60000);

// ==================== راه‌اندازی ====================
document.addEventListener('DOMContentLoaded', loadApp);

// ==================== بستن منوی فیلتر ====================
document.addEventListener('click', function(e) {
    const filterMenu = document.getElementById('filterMenu');
    const filterBtn = document.querySelector('.filter-btn');
    
    if (filterMenu && filterBtn && !filterMenu.contains(e.target) && !filterBtn.contains(e.target)) {
        filterMenu.style.display = 'none';
    }
});