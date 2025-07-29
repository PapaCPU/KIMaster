document.addEventListener('DOMContentLoaded', () => {

    // Alle DOM-Elemente sauber definieren
    const DOM = {
        app: document.getElementById('app'),
        screens: document.querySelectorAll('.screen'),
        globalProgressElements: document.querySelectorAll('.global-progress'),
        masterQuizBtn: document.getElementById('master-quiz-btn'),
        examButton: document.getElementById('exam-button'),
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
        incorrectQuestionsList: document.getElementById('incorrect-questions-list'),
        examContainer: document.getElementById('exam-container'),
        examCounter: document.getElementById('exam-counter'),
        examQuestionText: document.getElementById('exam-question-text'),
        examAnswerInput: document.getElementById('exam-answer-input'),
        micButton: document.getElementById('mic-button'),
        submitExamAnswerBtn: document.getElementById('submit-exam-answer-btn'),
        examLoadingSpinner: document.getElementById('exam-loading-spinner'),
        examFeedbackCard: document.getElementById('exam-feedback-card'),
        feedbackTitle: document.getElementById('feedback-title'),
        feedbackText: document.getElementById('feedback-text'),
        nextExamQuestionBtn: document.getElementById('next-exam-question-btn'),
        examCompletionScreen: document.getElementById('exam-completion-screen'),
        examFinalScore: document.getElementById('exam-final-score'),
        restartExamBtn: document.getElementById('restart-exam-btn'),
        resetProgressBtn: document.getElementById('reset-progress-btn'),
        certificateScreen: document.getElementById('certificate-screen'),
        certificateForm: document.getElementById('certificate-form'),
        certificateLoading: document.getElementById('certificate-loading'),
        certificateDisplay: document.getElementById('certificate-display'),
        certificateNameInput: document.getElementById('certificate-name-input'),
        generateCertificateBtn: document.getElementById('generate-certificate-btn'),
        certificateImage: document.getElementById('certificate-image'),
        downloadCertificateBtn: document.getElementById('download-certificate-btn'),
        regenerateCertificateBtn: document.getElementById('regenerate-certificate-btn')
    };

    const state = { /* ... State-Objekt wie gehabt ... */
        allQuestions: [], testQuestions: [],
        progress: { correctlyAnswered: [], incorrectlyAnswered: [], consecutiveCorrect: 0, jokers: 0, certificate: null },
        currentQuiz: { questions: [], index: 0, isMasterQuiz: false },
        currentExam: { questions: [], index: 0, score: 0 },
        examWebhookUrl: 'https://papacpun8n.ddns.net/webhook/ab4b120a-a21f-4be2-8c75-708433084a60',
        certificateWebhookUrl: 'https://papacpun8n.ddns.net/webhook/6dd54038-93da-49fb-a434-511c9fe0f295',
        certificateSecret: 'KI-Master-Super-Secret-2024'
    };
    
    // --- FUNKTIONEN ---

    const loadProgress = () => { const saved = localStorage.getItem('kiQuizProgress'); if(saved) { state.progress = {...state.progress, ...JSON.parse(saved)}; }};
    const saveProgress = () => localStorage.setItem('kiQuizProgress', JSON.stringify(state.progress));

    // ** NEUE, ROBUSTE DOWNLOAD-FUNKTION **
    const downloadCertificate = () => {
        const base64Image = state.progress.certificate;
        if (!base64Image) {
            alert("Fehler: Keine Zertifikat-Daten zum Herunterladen gefunden.");
            return;
        }
        // 1. Temporären Link erstellen
        const link = document.createElement('a');
        link.href = `data:image/png;base64,${base64Image}`;
        link.download = 'KI-Master-Zertifikat.png';

        // 2. Unsichtbar zum Dokument hinzufügen
        document.body.appendChild(link);

        // 3. Klick auslösen
        link.click();

        // 4. Link wieder aus dem Dokument entfernen
        document.body.removeChild(link);
    };

    const displayCertificate = (base64Image) => {
        DOM.certificateImage.src = `data:image/png;base64,${base64Image}`;
        DOM.certificateForm.classList.add('hidden');
        DOM.certificateLoading.classList.add('hidden');
        DOM.certificateDisplay.classList.remove('hidden');
    };

    const generateCertificate = async () => { /* ... wie gehabt ... */ };
    // ... alle anderen Funktionen ...

    // --- SETUP & START ---

    const setupEventListeners = () => {
        // ... alle bisherigen Listener ...
        DOM.regenerateCertificateBtn.addEventListener('click', () => { state.progress.certificate = null; saveProgress(); prepareCertificateScreen(); });
        
        // ** DER NEUE LISTENER FÜR DEN DOWNLOAD-BUTTON **
        DOM.downloadCertificateBtn.addEventListener('click', downloadCertificate);
    };
    
    // -- Kompletter Code zur Vollständigkeit --
    async function generateCertificate() {
        const name = DOM.certificateNameInput.value.trim();
        if (!name) { alert("Bitte gib einen Namen ein."); return; }
        DOM.certificateForm.classList.add('hidden');
        DOM.certificateLoading.classList.remove('hidden');
        try {
            const res = await fetch(state.certificateWebhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, secret: state.certificateSecret }) });
            if (!res.ok) throw new Error(`Webhook Error: ${res.statusText}`);
            const data = await res.json();
            const base64Image = data[0][0];
            if (!base64Image) throw new Error("Keine Bilddaten in der Webhook-Antwort gefunden.");
            state.progress.certificate = base64Image;
            saveProgress();
            displayCertificate(base64Image);
        } catch (e) {
            console.error("Zertifikat-Fehler:", e);
            alert("Das Zertifikat konnte nicht erstellt werden. Prüfe die Konsole (F12) für Details.");
            prepareCertificateScreen();
        }
    }
    const prepareCertificateScreen = () => { if (state.progress.certificate) { displayCertificate(state.progress.certificate); } else { DOM.certificateForm.classList.remove('hidden'); DOM.certificateLoading.classList.add('hidden'); DOM.certificateDisplay.classList.add('hidden'); } };
    const showScreen = (screenId) => { DOM.screens.forEach(screen => screen.classList.toggle('active', screen.id === screenId)); if (screenId === 'start-screen' || screenId === 'category-selection-screen') updateGlobalProgressDisplay(); if (screenId === 'category-selection-screen') renderCategoryList(); if (screenId === 'incorrect-list-screen') renderIncorrectList(); if (screenId === 'certificate-screen') prepareCertificateScreen(); if (screenId === 'exam-screen') { startExam(); } };
    const init = async () => { try { const [questionsRes, testRes] = await Promise.all([ fetch('./questions.json'), fetch('./test.json') ]); if (!questionsRes.ok) throw new Error(`"questions.json" nicht gefunden (Status: ${questionsRes.status})`); if (!testRes.ok) throw new Error(`"test.json" nicht gefunden (Status: ${testRes.status})`); state.allQuestions = await questionsRes.json(); state.testQuestions = await testRes.json(); loadProgress(); setupEventListeners(); updateGlobalProgressDisplay(); showScreen('start-screen'); } catch (error) { console.error("FATALER FEHLER:", error); DOM.app.innerHTML = `<div style="padding: 30px; text-align: center;"><h2>Fehler beim Start</h2><p style="margin-top:15px;">App konnte nicht geladen werden. Bitte Konsole (F12) prüfen.</p></div>`; } };
    const updateGlobalProgressDisplay = () => { DOM.globalProgressElements.forEach(el => el.innerHTML = `Gesamtfortschritt: <span>${state.progress.correctlyAnswered.length} / ${state.allQuestions.length}</span> richtig`); };
    const renderCategoryList = () => { /* ... */ }; // Placeholder
    
    // -- Unveränderte Funktionen hier einfügen für ein komplettes Skript --
    // Dies sind Platzhalter, da sich der Code hier nicht geändert hat, aber für die Ausführung benötigt wird.
    const renderIncorrectList = () => { DOM.incorrectQuestionsList.innerHTML = state.allQuestions.filter(q => state.progress.incorrectlyAnswered.includes(q.id)).map(q => `<div class="incorrect-question-item"><p>${q.question}</p><button class="retry-btn" data-id="${q.id}">Wiederholen</button></div>`).join('') || '<p>Super! Keine falsch beantworteten Fragen.</p>'; };
    const startExam = () => { state.currentExam = { questions: [...state.testQuestions].sort(() => 0.5 - Math.random()), index: 0, score: 0 }; DOM.examContainer.classList.remove('hidden'); DOM.examCompletionScreen.classList.add('hidden'); displayExamQuestion(); };
    const displayExamQuestion = () => { if(state.currentExam.index >= state.currentExam.questions.length) { DOM.examContainer.classList.add('hidden'); DOM.examCompletionScreen.classList.remove('hidden'); DOM.examFinalScore.textContent = `Ergebnis: ${state.currentExam.score} / ${state.currentExam.questions.length} richtig.`; return; } const q = state.currentExam.questions[state.currentExam.index]; DOM.examCounter.textContent = `Frage ${state.currentExam.index + 1} / ${state.currentExam.questions.length} | Richtig: ${state.currentExam.score}`; DOM.examQuestionText.textContent = q.question; DOM.examAnswerInput.value = ''; DOM.examAnswerInput.disabled = false; DOM.micButton.disabled = false; DOM.submitExamAnswerBtn.disabled = false; DOM.examLoadingSpinner.classList.add('hidden'); DOM.examFeedbackCard.classList.add('hidden'); };
    const submitExamAnswer = async () => { /* ... */ };
    const startQuiz = () => { /* ... */ };
    const setupListenersFull = () => { document.body.addEventListener('click', e => { const target = e.target.closest('[data-target]'); if (target) showScreen(target.dataset.target); }); DOM.masterQuizBtn.addEventListener('click', startMasterQuiz); DOM.categoryList.addEventListener('click', e => { const cat = e.target.closest('.category-item'); if(cat) startQuiz(cat.dataset.category); }); DOM.optionsContainer.addEventListener('click', e => { const opt = e.target.closest('.option-btn'); if(opt) handleAnswerSelection(opt.dataset.option); }); DOM.nextQuestionBtn.addEventListener('click', () => { state.currentQuiz.index++; displayQuestion(); }); DOM.resetProgressBtn.addEventListener('click', () => { if(confirm("Sicher?")) { state.progress = { correctlyAnswered: [], incorrectlyAnswered: [], consecutiveCorrect: 0, jokers: 0, certificate: null }; saveProgress(); updateGlobalProgressDisplay(); showScreen('start-screen'); alert("Zurückgesetzt."); } }); DOM.submitExamAnswerBtn.addEventListener('click', submitExamAnswer); DOM.nextExamQuestionBtn.addEventListener('click', () => { state.currentExam.index++; displayExamQuestion(); }); DOM.restartExamBtn.addEventListener('click', startExam); DOM.micButton.addEventListener('click', () => { console.log("Mic button clicked")}); DOM.incorrectQuestionsList.addEventListener('click', e => { const retry = e.target.closest('.retry-btn'); if(retry) { const q = state.allQuestions.find(q => q.id === parseInt(retry.dataset.id)); if(q) { state.currentQuiz = { questions: [q], index: 0, isMasterQuiz: false }; DOM.quizCategoryTitle.textContent = "Frage wiederholen"; DOM.quizBackButton.dataset.target = "incorrect-list-screen"; showScreen('quiz-screen'); displayQuestion(); } } }); DOM.jokerContainer.addEventListener('click', e => { if (e.target.closest('#use-joker-btn')) useJoker(); }); DOM.generateCertificateBtn.addEventListener('click', generateCertificate); DOM.regenerateCertificateBtn.addEventListener('click', () => { state.progress.certificate = null; saveProgress(); prepareCertificateScreen(); }); DOM.downloadCertificateBtn.addEventListener('click', downloadCertificate); };

    setupListenersFull();
    init();
});
