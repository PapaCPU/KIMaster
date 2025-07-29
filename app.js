document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    let state = {
        allQuestions: [],
        testQuestions: [],
        categories: [
            "Grundlagen & Begriffe", "Geschichte & Meilensteine", "Mensch–KI im Alltag",
            "Branchen‑Anwendungen", "Text, Sprache & Bilder", "Ethik & Fairness",
            "Recht & Governance (z. B. EU‑AI‑Act, Datenschutz)", "Risiken, Sicherheit & Missbrauch",
            "Mythen, Medien & Popkultur", "Zukunft & Gesellschaft", "Personen, Organisationen & bekannte Modelle"
        ],
        progress: {
            correctlyAnswered: [],
            incorrectlyAnswered: [],
            consecutiveCorrect: 0,
            jokers: 0,
            certificate: null 
        },
        examWebhookUrl: 'https://papacpun8n.ddns.net/webhook/ab4b120a-a21f-4be2-8c75-708433084a60',
        certificateWebhookUrl: 'https://papacpun8n.ddns.net/webhook/6dd54038-93da-49fb-a434-511c9fe0f295',
        certificateSecret: 'MeinSuperGeheimesPasswort123' 
    };

    // --- DOM ELEMENTS (sind alle korrekt) ---
    const screens = document.querySelectorAll('.screen');
    const app = document.getElementById('app');
    // ... alle anderen Elemente werden korrekt per ID gefunden ...

    // --- INITIALIZATION ---
    async function init() {
        loadProgress();
        try {
            // ** DER NEUE, FINALE FIX **
            // Wir verwenden den einfachsten relativen Pfad.
            // Das `./` bedeutet "im selben Verzeichnis wie die index.html".
            const [questionsRes, testRes] = await Promise.all([
                fetch('./questions.json'),
                fetch('./test.json')
            ]);

            // Diese Prüfung ist wichtig, um 404-Fehler abzufangen
            if (!questionsRes.ok) throw new Error(`"questions.json" konnte nicht geladen werden (Status: ${questionsRes.status})`);
            if (!testRes.ok) throw new Error(`"test.json" konnte nicht geladen werden (Status: ${testRes.status})`);
            
            // Wenn der Ladeversuch erfolgreich war, wird versucht, die Daten als JSON zu lesen.
            // Schlägt das fehl (z.B. bei Syntaxfehler in der Datei), wird ebenfalls ein Fehler ausgelöst.
            state.allQuestions = await questionsRes.json();
            state.testQuestions = await testRes.json();
            
            setupEventListeners();
            updateExamButtonState();
            updateGlobalProgressDisplay();
            showScreen('start-screen');
            initSpeechRecognition();

        } catch (error) {
            console.error("Fehler beim Laden der Quizdaten:", error);
            // ** NEUE DIAGNOSE-ANZEIGE **
            // Zeigt den technischen Fehler direkt auf der Seite an.
            app.innerHTML = `<div style="padding: 25px; text-align: center;">
                <h2 style="color: #dc3545;">Fehler beim Laden der Quizdaten</h2>
                <p style="color: #e0e0e0; margin-top: 10px;">Die App konnte die notwendigen Fragedateien nicht abrufen. Bitte erstelle einen Screenshot von dieser Fehlermeldung.</p>
                <div style="color: #ffc107; font-size: 0.9rem; margin-top: 20px; background: #2a2a2a; padding: 10px; border-radius: 5px; text-align: left; font-family: monospace;">
                    <strong>Technische Details:</strong><br><br>${error.toString()}
                </div>
            </div>`;
        }
    }

    // --- Der Rest des Codes bleibt unverändert ---

    const globalProgressElements = document.querySelectorAll('.global-progress');
    const examButton = document.getElementById('exam-button');
    const masterQuizBtn = document.getElementById('master-quiz-btn');
    const categoryList = document.getElementById('category-list');
    const quizCategoryTitle = document.getElementById('quiz-category-title');
    const quizCounter = document.getElementById('quiz-counter');
    const questionText = document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');
    const explanationContainer = document.getElementById('explanation-container');
    const explanationText = document.getElementById('explanation-text');
    const nextQuestionBtn = document.getElementById('next-question-btn');
    const quizProgressBarInner = document.getElementById('quiz-progress-bar-inner');
    const jokerContainer = document.getElementById('joker-container');
    const quizBackButton = document.getElementById('quiz-back-button');
    const incorrectQuestionsList = document.getElementById('incorrect-questions-list');
    const examContainer = document.getElementById('exam-container');
    const examCounter = document.getElementById('exam-counter');
    const examQuestionText = document.getElementById('exam-question-text');
    const examAnswerInput = document.getElementById('exam-answer-input');
    const micButton = document.getElementById('mic-button');
    const submitExamAnswerBtn = document.getElementById('submit-exam-answer-btn');
    const examLoadingSpinner = document.getElementById('exam-loading-spinner');
    const examFeedbackCard = document.getElementById('exam-feedback-card');
    const feedbackTitle = document.getElementById('feedback-title');
    const feedbackText = document.getElementById('feedback-text');
    const nextExamQuestionBtn = document.getElementById('next-exam-question-btn');
    const examCompletionScreen = document.getElementById('exam-completion-screen');
    const examFinalScore = document.getElementById('exam-final-score');
    const restartExamBtn = document.getElementById('restart-exam-btn');
    const resetProgressBtn = document.getElementById('reset-progress-btn');
    const certificateForm = document.getElementById('certificate-form');
    const certificateLoading = document.getElementById('certificate-loading');
    const certificateDisplay = document.getElementById('certificate-display');
    const certificateNameInput = document.getElementById('certificate-name-input');
    const generateCertificateBtn = document.getElementById('generate-certificate-btn');
    const certificateImage = document.getElementById('certificate-image');
    const downloadCertificateBtn = document.getElementById('download-certificate-btn');
    const regenerateCertificateBtn = document.getElementById('regenerate-certificate-btn');

    function loadProgress() { const savedProgress = localStorage.getItem('kiQuizProgress'); if (savedProgress) { const parsed = JSON.parse(savedProgress); state.progress = { correctlyAnswered: [], incorrectlyAnswered: [], consecutiveCorrect: 0, jokers: 0, certificate: null, ...parsed }; } }
    function saveProgress() { localStorage.setItem('kiQuizProgress', JSON.stringify(state.progress)); }
    function resetProgress() { state.progress = { correctlyAnswered: [], incorrectlyAnswered: [], consecutiveCorrect: 0, jokers: 0, certificate: null }; saveProgress(); updateExamButtonState(); updateGlobalProgressDisplay(); showScreen('start-screen'); alert("Dein Fortschritt und dein Zertifikat wurden zurückgesetzt."); }
    function prepareCertificateScreen() { if (state.progress.certificate) { displayCertificate(state.progress.certificate); } else { certificateForm.classList.remove('hidden'); certificateLoading.classList.add('hidden'); certificateDisplay.classList.add('hidden'); } }
    async function generateCertificate() { const userName = certificateNameInput.value.trim(); if (!userName) { alert("Bitte gib einen Namen ein."); return; } certificateForm.classList.add('hidden'); certificateLoading.classList.remove('hidden'); try { const response = await fetch(state.certificateWebhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: userName, secret: state.certificateSecret }) }); if (!response.ok) { throw new Error(`Webhook-Fehler: ${response.statusText}`); } const base64Image = await response.text(); state.progress.certificate = base64Image; saveProgress(); displayCertificate(base64Image); } catch (error) { console.error("Fehler beim Erstellen des Zertifikats:", error); alert("Das Zertifikat konnte leider nicht erstellt werden. Bitte versuche es später erneut."); prepareCertificateScreen(); } }
    function displayCertificate(base64Image) { const imageUrl = `data:image/png;base64,${base64Image}`; certificateImage.src = imageUrl; downloadCertificateBtn.href = imageUrl; certificateForm.classList.add('hidden'); certificateLoading.classList.add('hidden'); certificateDisplay.classList.remove('hidden'); }
    function showScreen(screenId) { screens.forEach(screen => screen.classList.toggle('active', screen.id === screenId)); if (screenId === 'start-screen' || screenId === 'category-selection-screen') { updateGlobalProgressDisplay(); } switch (screenId) { case 'category-selection-screen': renderCategoryList(); break; case 'incorrect-list-screen': renderIncorrectList(); break; case 'certificate-screen': prepareCertificateScreen(); break; case 'exam-screen': if (examButton.disabled) { alert("Bitte beantworte zuerst alle Fragen, um die Prüfung freizuschalten."); showScreen('start-screen'); } else { startExam(); } break; } }
    function setupEventListeners() { document.body.addEventListener('click', e => { const targetButton = e.target.closest('[data-target]'); if (targetButton) showScreen(targetButton.dataset.target); }); masterQuizBtn.addEventListener('click', startMasterQuiz); categoryList.addEventListener('click', e => { const categoryItem = e.target.closest('.category-item'); if (categoryItem) startQuiz(categoryItem.dataset.category); }); optionsContainer.addEventListener('click', e => { const optionBtn = e.target.closest('.option-btn'); if (optionBtn) handleAnswerSelection(optionBtn.dataset.option); }); nextQuestionBtn.addEventListener('click', showNextQuestion); resetProgressBtn.addEventListener('click', () => { if (confirm("Bist du sicher? Alle Fortschritte und dein Zertifikat werden gelöscht.")) { resetProgress(); } }); submitExamAnswerBtn.addEventListener('click', submitExamAnswer); nextExamQuestionBtn.addEventListener('click', showNextExamQuestion); restartExamBtn.addEventListener('click', startExam); micButton.addEventListener('click', toggleSpeechRecognition); incorrectQuestionsList.addEventListener('click', e => { if (e.target.classList.contains('retry-btn')) { retryIncorrectQuestion(parseInt(e.target.dataset.id)); } }); jokerContainer.addEventListener('click', e => { if (e.target.closest('#use-joker-btn')) useJoker(); }); generateCertificateBtn.addEventListener('click', generateCertificate); regenerateCertificateBtn.addEventListener('click', () => { state.progress.certificate = null; saveProgress(); prepareCertificateScreen(); }); }
    function updateExamButtonState() { examButton.disabled = false; }
    function updateGlobalProgressDisplay() { const correctCount = state.progress.correctlyAnswered.length; const totalCount = state.allQuestions.length; const text = `Gesamtfortschritt: <span>${correctCount} / ${totalCount}</span> richtig`; globalProgressElements.forEach(el => el.innerHTML = text); }
    function updateJokerDisplay() { jokerContainer.innerHTML = `<span id="joker-count">${state.progress.jokers}</span><button id="use-joker-btn" title="50/50 Joker" ${state.progress.jokers > 0 ? '' : 'disabled'}><i class="fas fa-lightbulb"></i> 50/50</button>`; }
    function useJoker() { const useJokerBtn = document.getElementById('use-joker-btn'); if (state.progress.jokers <= 0 || (useJokerBtn && useJokerBtn.disabled)) return; state.progress.jokers--; const question = state.currentQuiz.questions[state.currentQuiz.index]; const options = Array.from(optionsContainer.children); const incorrectOptions = options.filter(opt => opt.dataset.option !== question.correct); incorrectOptions.sort(() => Math.random() - 0.5); incorrectOptions[0].classList.add('hidden'); incorrectOptions[1].classList.add('hidden'); useJokerBtn.disabled = true; updateJokerDisplay(); saveProgress(); }
    function startMasterQuiz() { const answeredIds = [...state.progress.correctlyAnswered, ...state.progress.incorrectlyAnswered]; let masterQuestions = state.allQuestions.filter(q => !answeredIds.includes(q.id)); masterQuestions.sort(() => 0.5 - Math.random()); if (masterQuestions.length === 0) { alert("Glückwunsch! Du hast bereits alle Fragen im Quiz beantwortet."); return; } state.currentQuiz = { questions: masterQuestions.slice(0, 10), index: 0, isMasterQuiz: true }; quizCategoryTitle.textContent = "MASTER Quiz"; quizBackButton.dataset.target = "start-screen"; showScreen('quiz-screen'); displayQuestion(); }
    function startQuiz(category) { const answeredIds = [...state.progress.correctlyAnswered, ...state.progress.incorrectlyAnswered]; const categoryQuestions = state.allQuestions.filter(q => q.category === category && !answeredIds.includes(q.id)); if (categoryQuestions.length === 0) { alert(`Du hast bereits alle Fragen in der Kategorie "${category}" beantwortet.`); return; } state.currentQuiz = { questions: categoryQuestions, index: 0, isMasterQuiz: false }; quizCategoryTitle.textContent = category; quizBackButton.dataset.target = "category-selection-screen"; showScreen('quiz-screen'); displayQuestion(); }
    function displayQuestion() { explanationContainer.classList.add('hidden'); if (state.currentQuiz.index >= state.currentQuiz.questions.length) { alert("Quizrunde abgeschlossen!"); updateExamButtonState(); updateGlobalProgressDisplay(); showScreen(state.currentQuiz.isMasterQuiz ? 'start-screen' : 'category-selection-screen'); return; } updateJokerDisplay(); const question = state.currentQuiz.questions[state.currentQuiz.index]; const progress = state.currentQuiz.index + 1; const total = state.currentQuiz.questions.length; quizCounter.textContent = `Frage ${progress} / ${total}`; quizProgressBarInner.style.width = `${(progress / total) * 100}%`; questionText.textContent = question.question; optionsContainer.innerHTML = ''; Object.entries(question.options).forEach(([key, value]) => { optionsContainer.innerHTML += `<button class="option-btn" data-option="${key}"><strong>${key}</strong> ${value}</button>`; }); }
    function handleAnswerSelection(selectedOption) { const question = state.currentQuiz.questions[state.currentQuiz.index]; const isCorrect = selectedOption === question.correct; Array.from(optionsContainer.children).forEach(btn => { btn.classList.add('disabled'); if (btn.dataset.option === question.correct) btn.classList.add('correct'); else if (btn.dataset.option === selectedOption) btn.classList.add('incorrect'); }); document.getElementById('use-joker-btn').disabled = true; const questionId = question.id; state.progress.correctlyAnswered = state.progress.correctlyAnswered.filter(id => id !== questionId); state.progress.incorrectlyAnswered = state.progress.incorrectlyAnswered.filter(id => id !== questionId); if (isCorrect) { state.progress.correctlyAnswered.push(questionId); state.progress.consecutiveCorrect++; if (state.progress.consecutiveCorrect === 3) { if (state.progress.jokers < 3) state.progress.jokers++; state.progress.consecutiveCorrect = 0; } } else { state.progress.incorrectlyAnswered.push(questionId); state.progress.consecutiveCorrect = 0; } saveProgress(); updateGlobalProgressDisplay(); explanationText.textContent = question.explanation; explanationContainer.classList.remove('hidden'); }
    function showNextQuestion() { state.currentQuiz.index++; displayQuestion(); }
    function renderIncorrectList() { incorrectQuestionsList.innerHTML = ''; const incorrectQuestions = state.allQuestions.filter(q => state.progress.incorrectlyAnswered.includes(q.id)); if (incorrectQuestions.length === 0) { incorrectQuestionsList.innerHTML = '<p>Super! Du hast bisher alle Fragen richtig beantwortet.</p>'; return; } incorrectQuestions.forEach(q => { const item = document.createElement('div'); item.className = 'incorrect-question-item'; item.innerHTML = `<p>${q.question}</p><button class="retry-btn" data-id="${q.id}">Wiederholen</button>`; incorrectQuestionsList.appendChild(item); }); }
    function retryIncorrectQuestion(questionId) { const questionToRetry = state.allQuestions.find(q => q.id === questionId); if (questionToRetry) { state.currentQuiz = { questions: [questionToRetry], index: 0, isMasterQuiz: false }; quizCategoryTitle.textContent = "Frage wiederholen"; quizBackButton.dataset.target = "incorrect-list-screen"; showScreen('quiz-screen'); displayQuestion(); } }
    async function submitExamAnswer() { const question = state.currentExam.questions[state.currentExam.index]; const answer = examAnswerInput.value.trim(); if (!answer) { alert("Bitte gib eine Antwort ein."); return; } examLoadingSpinner.classList.remove('hidden'); submitExamAnswerBtn.disabled = true; examAnswerInput.disabled = true; micButton.disabled = true; try { const response = await fetch(state.examWebhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: question.question, answer: answer }) }); if (!response.ok) throw new Error(`Webhook error: ${response.statusText}`); const data = await response.json(); const feedback = data[0]?.output || "Fehler: Unerwartetes Format vom Server."; displayExamFeedback(feedback); } catch (error) { console.error("Fehler bei der Kommunikation mit dem Webhook:", error); displayExamFeedback("Fehler: Die Antwort konnte nicht ausgewertet werden."); } finally { examLoadingSpinner.classList.add('hidden'); } }
    function startExam() { state.currentExam = { questions: [...state.testQuestions].sort(() => 0.5 - Math.random()), index: 0, score: 0 }; examContainer.classList.remove('hidden'); examCompletionScreen.classList.add('hidden'); submitExamAnswerBtn.classList.remove('hidden'); examAnswerInput.value = ''; displayExamQuestion(); showScreen('exam-screen'); }
    function displayExamQuestion() { const question = state.currentExam.questions[state.currentExam.index]; examCounter.textContent = `Frage ${state.currentExam.index + 1} / ${state.currentExam.questions.length} | Richtig: ${state.currentExam.score}`; examQuestionText.textContent = question.question; examAnswerInput.value = ''; examAnswerInput.disabled = false; micButton.disabled = false; submitExamAnswerBtn.disabled = false; examLoadingSpinner.classList.add('hidden'); examFeedbackCard.classList.add('hidden'); }
    function displayExamFeedback(feedback) { const firstWord = feedback.split(' ')[0].toLowerCase().replace(/[^a-zäöüß]/gi, ''); if (firstWord === 'richtig') { state.currentExam.score++; examFeedbackCard.className = 'exam-feedback-card correct'; feedbackTitle.textContent = "Richtig!"; } else { examFeedbackCard.className = 'exam-feedback-card check'; feedbackTitle.textContent = "Antwort-Check"; } feedbackText.innerHTML = feedback.replace(/\n/g, '<br>'); examFeedbackCard.classList.remove('hidden'); }
    function showNextExamQuestion() { state.currentExam.index++; if (state.currentExam.index >= state.currentExam.questions.length) { examContainer.classList.add('hidden'); examCompletionScreen.classList.remove('hidden'); examFinalScore.textContent = `Du hast ${state.currentExam.score} von ${state.currentExam.questions.length} Fragen richtig beantwortet.`; } else { displayExamQuestion(); } }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; let recognition;
    function initSpeechRecognition() { if (SpeechRecognition) { recognition = new SpeechRecognition(); recognition.continuous = false; recognition.lang = 'de-DE'; recognition.interimResults = false; recognition.maxAlternatives = 1; recognition.onresult = (event) => { examAnswerInput.value = event.results[0][0].transcript; }; recognition.onend = () => { micButton.classList.remove('is-listening'); }; recognition.onerror = (event) => { console.error('Speech recognition error', event.error); alert('Fehler bei der Spracherkennung: ' + event.error); micButton.classList.remove('is-listening'); }; } else { console.log("Speech Recognition not supported."); micButton.style.display = 'none'; } }
    function toggleSpeechRecognition() { if (!recognition) return; if (micButton.classList.contains('is-listening')) { recognition.stop(); } else { try { recognition.start(); micButton.classList.add('is-listening'); } catch(e) { console.error("Could not start recognition", e); micButton.classList.remove('is-listening');} } }
    
    // --- START THE APP ---
    init();
});
