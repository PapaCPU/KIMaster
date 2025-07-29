document.addEventListener('DOMContentLoaded', () => {

    // =================================================================================
    // 1. DOM ELEMENTE & STATE
    // =================================================================================

    const DOM = {
        app: document.getElementById('app'),
        screens: document.querySelectorAll('.screen'),
        globalProgressElements: document.querySelectorAll('.global-progress'),
        masterQuizBtn: document.getElementById('master-quiz-btn'),
        categoryList: document.getElementById('category-list'),
        quizCategoryTitle: document.getElementById('quiz-category-title'),
        quizCounter: document.getElementById('quiz-counter'),
        questionText: document.getElementById('question-text'),
        optionsContainer: document.getElementById('options-container'),
        explanationContainer: document.getElementById('explanation-container'),
        explanationText: document.getElementById('explanation-text'),
        nextQuestionBtn: document.getElementById('next-question-btn'),
        quizProgressBarInner: document.getElementById('quiz-progress-bar-inner'),
        jokerContainer: document.getElementById('joker-container'),
        quizBackButton: document.getElementById('quiz-back-button'),
        resetProgressBtn: document.getElementById('reset-progress-btn'),
        incorrectQuestionsList: document.getElementById('incorrect-questions-list'),
        certificateForm: document.getElementById('certificate-form'),
        certificateLoading: document.getElementById('certificate-loading'),
        certificateDisplay: document.getElementById('certificate-display'),
        certificateNameInput: document.getElementById('certificate-name-input'),
        generateCertificateBtn: document.getElementById('generate-certificate-btn'),
        certificateImage: document.getElementById('certificate-image'),
        downloadCertificateBtn: document.getElementById('download-certificate-btn'),
        regenerateCertificateBtn: document.getElementById('regenerate-certificate-btn')
    };

    const state = {
        allQuestions: [],
        progress: {
            correctlyAnswered: [],
            incorrectlyAnswered: [],
            consecutiveCorrect: 0,
            jokers: 0,
            certificate: null
        },
        currentQuiz: { questions: [], index: 0, isMasterQuiz: false },
        certificateWebhookUrl: 'https://papacpun8n.ddns.net/webhook/6dd54038-93da-49fb-a434-511c9fe0f295',
        certificateSecret: 'KI-Master-Super-Secret-2024'
    };

    let blobUrl = null;

    // =================================================================================
    // 2. FUNKTIONEN
    // =================================================================================

    // --- Fortschritt ---
    const loadProgress = () => { const saved = localStorage.getItem('kiQuizProgress'); if(saved) { state.progress = {...state.progress, ...JSON.parse(saved)}; }};
    const saveProgress = () => localStorage.setItem('kiQuizProgress', JSON.stringify(state.progress));

    // --- Navigation & Anzeige ---
    const showScreen = (screenId) => {
        DOM.screens.forEach(screen => screen.classList.toggle('active', screen.id === screenId));
        if (screenId === 'start-screen' || screenId === 'category-selection-screen') updateGlobalProgressDisplay();
        if (screenId === 'category-selection-screen') renderCategoryList();
        if (screenId === 'incorrect-list-screen') renderIncorrectList();
        if (screenId === 'certificate-screen') prepareCertificateScreen();
    };
    const updateGlobalProgressDisplay = () => { if(state.allQuestions.length > 0) { const text = `Gesamtfortschritt: <span>${state.progress.correctlyAnswered.length} / ${state.allQuestions.length}</span> richtig`; DOM.globalProgressElements.forEach(el => el.innerHTML = text); }};
    
    // --- Zertifikat-Logik (Blob-Ansatz) ---
    const base64ToBlob = (base64) => { const byteCharacters = atob(base64); const byteArrays = []; for (let offset = 0; offset < byteCharacters.length; offset += 512) { const slice = byteCharacters.slice(offset, offset + 512); const byteNumbers = new Array(slice.length); for (let i = 0; i < slice.length; i++) { byteNumbers[i] = slice.charCodeAt(i); } byteArrays.push(new Uint8Array(byteNumbers)); } return new Blob(byteArrays, {type: 'image/png'}); };
    const displayCertificate = (base64Image) => {
        try {
            if (blobUrl) URL.revokeObjectURL(blobUrl);
            const blob = base64ToBlob(base64Image);
            blobUrl = URL.createObjectURL(blob);
            DOM.certificateImage.src = blobUrl;
            DOM.certificateForm.classList.add('hidden');
            DOM.certificateLoading.classList.add('hidden');
            DOM.certificateDisplay.classList.remove('hidden');
        } catch (error) {
            console.error("Zertifikat-Anzeigefehler:", error);
            prepareCertificateScreen(true);
        }
    };
    const downloadCertificate = () => { if (!blobUrl) return; const link = document.createElement('a'); link.href = blobUrl; link.download = 'KI-Master-Zertifikat.png'; document.body.appendChild(link); link.click(); document.body.removeChild(link); };
    const generateCertificate = async () => {
        const name = DOM.certificateNameInput.value.trim();
        if (!name) { alert("Bitte gib einen Namen ein."); return; }
        DOM.certificateForm.classList.add('hidden');
        DOM.certificateLoading.classList.remove('hidden');
        try {
            const res = await fetch(state.certificateWebhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, secret: state.certificateSecret }) });
            if (!res.ok) throw new Error(`Webhook Error: ${res.statusText}`);
            const data = await res.json();
            const base64Image = Array.isArray(data) && Array.isArray(data[0]) ? data[0][0] : data;
            if (!base64Image || typeof base64Image !== 'string') throw new Error("Keine validen Bilddaten empfangen.");
            state.progress.certificate = base64Image;
            saveProgress();
            displayCertificate(base64Image);
        } catch (e) {
            console.error("Zertifikat-Generierungsfehler:", e);
            alert("Das Zertifikat konnte nicht erstellt werden.");
            prepareCertificateScreen(true);
        }
    };
    const prepareCertificateScreen = (forceReset = false) => { if (state.progress.certificate && !forceReset) { displayCertificate(state.progress.certificate); } else { DOM.certificateForm.classList.remove('hidden'); DOM.certificateLoading.classList.add('hidden'); DOM.certificateDisplay.classList.add('hidden'); } };

    // --- Quiz-Logik ---
    const renderCategoryList = () => { const cats = state.allQuestions.reduce((a, q) => { const d = q.difficulty||'mittel'; if (!a[q.category]) a[q.category] = { t:0, c:0, diff: { leicht:[0,0], mittel:[0,0], schwer:[0,0]} }; a[q.category].t++; a[q.category].diff[d][1]++; if(state.progress.correctlyAnswered.includes(q.id)) { a[q.category].c++; a[q.category].diff[d][0]++; } return a; }, {}); DOM.categoryList.innerHTML = Object.entries(cats).map(([n,d]) => `<div class="category-item" data-category="${n}"><h3>${n}</h3><div class="category-progress"><strong>${d.c}/${d.t}</strong></div><div class="difficulty-progress"><span>L:${d.diff.leicht[0]}/${d.diff.leicht[1]}</span><span>M:${d.diff.mittel[0]}/${d.diff.mittel[1]}</span><span>S:${d.diff.schwer[0]}/${d.diff.schwer[1]}</span></div></div>`).join(''); };
    const renderIncorrectList = () => { DOM.incorrectQuestionsList.innerHTML = state.allQuestions.filter(q => state.progress.incorrectlyAnswered.includes(q.id)).map(q => `<div class="incorrect-question-item"><p>${q.question}</p><button class="retry-btn" data-id="${q.id}">Wiederholen</button></div>`).join('') || '<p>Super! Keine falsch beantworteten Fragen.</p>'; };
    const startQuiz = (category) => {
        const answered = new Set([...state.progress.correctlyAnswered, ...state.progress.incorrectlyAnswered]);
        let questions, isMaster = false;
        if (category) {
            questions = state.allQuestions.filter(q => q.category === category && !answered.has(q.id));
            isMaster = false;
            DOM.quizCategoryTitle.textContent = category;
            DOM.quizBackButton.dataset.target = "category-selection-screen";
        } else { // Master Quiz
            questions = state.allQuestions.filter(q => !answered.has(q.id));
            questions.sort(() => 0.5 - Math.random());
            questions = questions.slice(0, 10);
            isMaster = true;
            DOM.quizCategoryTitle.textContent = "MASTER Quiz";
            DOM.quizBackButton.dataset.target = "start-screen";
        }
        if (questions.length === 0) { alert(`Alle Fragen in diesem Modus bereits beantwortet.`); return; }
        state.currentQuiz = { questions, index: 0, isMasterQuiz: isMaster };
        showScreen('quiz-screen');
        displayQuestion();
    };
    const displayQuestion = () => {
        if (state.currentQuiz.index >= state.currentQuiz.questions.length) {
            alert("Quizrunde abgeschlossen!");
            showScreen(state.currentQuiz.isMasterQuiz ? 'start-screen' : 'category-selection-screen');
            return;
        }
        DOM.explanationContainer.classList.add('hidden');
        updateJokerDisplay();
        const question = state.currentQuiz.questions[state.currentQuiz.index];
        DOM.quizCounter.textContent = `Frage ${state.currentQuiz.index + 1} / ${state.currentQuiz.questions.length}`;
        DOM.quizProgressBarInner.style.width = `${((state.currentQuiz.index + 1) / state.currentQuiz.questions.length) * 100}%`;
        DOM.questionText.textContent = question.question;
        DOM.optionsContainer.innerHTML = Object.entries(question.options).map(([key, value]) => `<button class="option-btn" data-option="${key}"><strong>${key}</strong> ${value}</button>`).join('');
    };
    const handleAnswerSelection = (selectedOption) => {
        const question = state.currentQuiz.questions[state.currentQuiz.index];
        Array.from(DOM.optionsContainer.children).forEach(btn => btn.classList.add('disabled'));
        const jokerBtn = document.getElementById('use-joker-btn');
        if (jokerBtn) jokerBtn.disabled = true;

        const isCorrect = selectedOption === question.correct;
        document.querySelector(`.option-btn[data-option="${question.correct}"]`).classList.add('correct');
        if (!isCorrect) document.querySelector(`.option-btn[data-option="${selectedOption}"]`).classList.add('incorrect');
        
        const qId = question.id;
        // Speichere den Fortschritt SOFORT und nur, wenn die Frage neu ist
        if (!state.progress.correctlyAnswered.includes(qId) && !state.progress.incorrectlyAnswered.includes(qId)) {
            if (isCorrect) {
                state.progress.correctlyAnswered.push(qId);
                state.progress.consecutiveCorrect++;
                if (state.progress.consecutiveCorrect === 3) {
                    if (state.progress.jokers < 3) state.progress.jokers++;
                    state.progress.consecutiveCorrect = 0;
                }
            } else {
                state.progress.incorrectlyAnswered.push(qId);
                state.progress.consecutiveCorrect = 0;
            }
            saveProgress();
            updateGlobalProgressDisplay();
        }
        DOM.explanationText.textContent = question.explanation;
        DOM.explanationContainer.classList.remove('hidden');
    };
    const updateJokerDisplay = () => { DOM.jokerContainer.innerHTML = `<span id="joker-count">${state.progress.jokers}</span><button id="use-joker-btn" title="50/50 Joker" ${state.progress.jokers > 0 ? '' : 'disabled'}><i class="fas fa-lightbulb"></i> 50/50</button>`; };
    const useJoker = () => { const btn = document.getElementById('use-joker-btn'); if (state.progress.jokers <= 0 || (btn && btn.disabled)) return; state.progress.jokers--; const q = state.currentQuiz.questions[state.currentQuiz.index]; const incorrect = Array.from(DOM.optionsContainer.children).filter(o => o.dataset.option !== q.correct); incorrect.sort(() => Math.random() - .5); incorrect[0].classList.add('hidden'); incorrect[1].classList.add('hidden'); btn.disabled = true; updateJokerDisplay(); saveProgress(); };

    // =================================================================================
    // 3. EVENT LISTENERS & START
    // =================================================================================

    const setupEventListeners = () => {
        document.body.addEventListener('click', e => { const target = e.target.closest('[data-target]'); if (target) showScreen(target.dataset.target); });
        DOM.masterQuizBtn.addEventListener('click', () => startQuiz(null));
        DOM.categoryList.addEventListener('click', e => { const cat = e.target.closest('.category-item'); if(cat) startQuiz(cat.dataset.category); });
        DOM.incorrectQuestionsList.addEventListener('click', e => { const retry = e.target.closest('.retry-btn'); if(retry) { const q = state.allQuestions.find(q => q.id === parseInt(retry.dataset.id)); if(q) { state.currentQuiz = { questions: [q], index: 0, isMasterQuiz: false }; DOM.quizCategoryTitle.textContent = "Frage wiederholen"; DOM.quizBackButton.dataset.target = "incorrect-list-screen"; showScreen('quiz-screen'); displayQuestion(); } } });
        DOM.optionsContainer.addEventListener('click', e => { const opt = e.target.closest('.option-btn'); if(opt) handleAnswerSelection(opt.dataset.option); });
        DOM.nextQuestionBtn.addEventListener('click', () => { state.currentQuiz.index++; displayQuestion(); });
        DOM.jokerContainer.addEventListener('click', e => { if (e.target.closest('#use-joker-btn')) useJoker(); });
        DOM.generateCertificateBtn.addEventListener('click', generateCertificate);
        DOM.downloadCertificateBtn.addEventListener('click', downloadCertificate);
        DOM.regenerateCertificateBtn.addEventListener('click', () => { state.progress.certificate = null; if(blobUrl) URL.revokeObjectURL(blobUrl); blobUrl = null; saveProgress(); prepareCertificateScreen(); });
        DOM.resetProgressBtn.addEventListener('click', () => { if(confirm("Sicher? Alle Fortschritte und das Zertifikat werden gelöscht.")) { state.progress = { correctlyAnswered: [], incorrectlyAnswered: [], consecutiveCorrect: 0, jokers: 0, certificate: null }; saveProgress(); if(blobUrl) URL.revokeObjectURL(blobUrl); blobUrl = null; updateGlobalProgressDisplay(); showScreen('start-screen'); alert("Fortschritt zurückgesetzt."); } });
    };

    const init = async () => {
        try {
            const [questionsRes] = await Promise.all([
                fetch('./questions.json'),
            ]);
            if (!questionsRes.ok) throw new Error(`"questions.json" nicht gefunden (Status: ${questionsRes.status})`);
            state.allQuestions = await questionsRes.json();
            
            loadProgress();
            setupEventListeners();
            showScreen('start-screen');
        } catch (error) {
            console.error("FATALER FEHLER:", error);
            DOM.app.innerHTML = `<div style="padding: 30px; text-align: center;"><h2>Fehler beim Start</h2><p style="margin-top:15px;">Die App konnte nicht geladen werden. Bitte öffne die Entwicklerkonsole (F12) und prüfe die Fehlermeldung.</p></div>`;
        }
    };

    init();
});
