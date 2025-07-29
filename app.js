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
            jokers: 0
        },
        currentQuiz: {
            questions: [],
            index: 0,
            isMasterQuiz: false
        },
        currentExam: {
            questions: [],
            index: 0,
            score: 0
        },
        webhookUrl: 'https://papacpun8n.ddns.net/webhook/ab4b120a-a21f-4be2-8c75-708433084a60'
    };

    // --- DOM ELEMENTS ---
    const screens = document.querySelectorAll('.screen');
    const app = document.getElementById('app');
    const globalProgressElements = document.querySelectorAll('.global-progress');

    // Main Menu
    const examButton = document.getElementById('exam-button');
    const masterQuizBtn = document.getElementById('master-quiz-btn');

    // Quiz Screen
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

    // Incorrect List Screen
    const incorrectQuestionsList = document.getElementById('incorrect-questions-list');

    // Exam Screen
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

    // Settings
    const resetProgressBtn = document.getElementById('reset-progress-btn');

    // --- INITIALIZATION ---
    async function init() {
        loadProgress();
        try {
            const [questionsRes, testRes] = await Promise.all([
                fetch('questions.json'),
                fetch('test.json')
            ]);
            state.allQuestions = await questionsRes.json();
            state.testQuestions = await testRes.json();
            
            setupEventListeners();
            updateExamButtonState();
            updateGlobalProgressDisplay();
            showScreen('start-screen');
            initSpeechRecognition();

        } catch (error) {
            console.error("Fehler beim Laden der Quizdaten:", error);
            app.innerHTML = `<p style="color:red; text-align:center; padding: 20px;">Fehler: Die Quizdaten (questions.json / test.json) konnten nicht geladen werden.</p>`;
        }
    }

    // --- NAVIGATION ---
    function showScreen(screenId) {
        screens.forEach(screen => screen.classList.toggle('active', screen.id === screenId));
        if (screenId === 'start-screen' || screenId === 'category-selection-screen') {
            updateGlobalProgressDisplay();
        }
        switch (screenId) {
            case 'category-selection-screen': renderCategoryList(); break;
            case 'incorrect-list-screen': renderIncorrectList(); break;
            case 'exam-screen':
                if (examButton.disabled) {
                    alert("Bitte beantworte zuerst alle Fragen, um die Prüfung freizuschalten.");
                    showScreen('start-screen');
                } else {
                    startExam();
                }
                break;
        }
    }

    // --- EVENT LISTENERS ---
    function setupEventListeners() {
        document.body.addEventListener('click', e => {
            const targetButton = e.target.closest('[data-target]');
            if (targetButton) showScreen(targetButton.dataset.target);
        });
        masterQuizBtn.addEventListener('click', startMasterQuiz);
        categoryList.addEventListener('click', e => {
            const categoryItem = e.target.closest('.category-item');
            if (categoryItem) startQuiz(categoryItem.dataset.category);
        });
        optionsContainer.addEventListener('click', e => {
            const optionBtn = e.target.closest('.option-btn');
            if (optionBtn) handleAnswerSelection(optionBtn.dataset.option);
        });
        nextQuestionBtn.addEventListener('click', showNextQuestion);
        resetProgressBtn.addEventListener('click', () => {
            if (confirm("Bist du sicher? Alle Fortschritte und Joker werden gelöscht.")) {
                resetProgress();
            }
        });
        submitExamAnswerBtn.addEventListener('click', submitExamAnswer);
        nextExamQuestionBtn.addEventListener('click', showNextExamQuestion);
        restartExamBtn.addEventListener('click', startExam);
        micButton.addEventListener('click', toggleSpeechRecognition);
        incorrectQuestionsList.addEventListener('click', e => {
            if (e.target.classList.contains('retry-btn')) {
                retryIncorrectQuestion(parseInt(e.target.dataset.id));
            }
        });
        jokerContainer.addEventListener('click', e => {
            if (e.target.closest('#use-joker-btn')) useJoker();
        });
    }

    // --- PROGRESS MANAGEMENT ---
    function saveProgress() {
        localStorage.setItem('kiQuizProgress', JSON.stringify(state.progress));
    }

    function loadProgress() {
        const savedProgress = localStorage.getItem('kiQuizProgress');
        if (savedProgress) {
            const parsed = JSON.parse(savedProgress);
            // Sicherstellen, dass alle Felder vorhanden sind
            state.progress = {
                correctlyAnswered: [],
                incorrectlyAnswered: [],
                consecutiveCorrect: 0,
                jokers: 0,
                ...parsed
            };
        }
    }
    
    function resetProgress() {
        state.progress = { correctlyAnswered: [], incorrectlyAnswered: [], consecutiveCorrect: 0, jokers: 0 };
        saveProgress();
        updateExamButtonState();
        updateGlobalProgressDisplay();
        showScreen('start-screen');
        alert("Dein Fortschritt wurde zurückgesetzt.");
    }
    
    function updateExamButtonState() {
        // const allAnsweredCorrectly = state.allQuestions.length > 0 && state.progress.correctlyAnswered.length === state.allQuestions.length;
        // examButton.disabled = !allAnsweredCorrectly;
        examButton.disabled = false; // Für Testzwecke immer aktiv
    }

    function updateGlobalProgressDisplay() {
        const correctCount = state.progress.correctlyAnswered.length;
        const totalCount = state.allQuestions.length;
        const text = `Gesamtfortschritt: <span>${correctCount} / ${totalCount}</span> richtig`;
        globalProgressElements.forEach(el => el.innerHTML = text);
    }

    // --- JOKER LOGIC ---
    function updateJokerDisplay() {
        jokerContainer.innerHTML = `
            <span id="joker-count">${state.progress.jokers} <i class="fa-solid fa-lightbulb"></i></span>
            <button id="use-joker-btn" title="50/50 Joker einsetzen" ${state.progress.jokers > 0 ? '' : 'disabled'}>
                50/50
            </button>
        `;
    }

    function useJoker() {
        if (state.progress.jokers <= 0) return;

        state.progress.jokers--;
        const question = state.currentQuiz.questions[state.currentQuiz.index];
        const options = Array.from(optionsContainer.children);
        const correctOptionKey = question.correct;
        
        const incorrectOptions = options.filter(opt => opt.dataset.option !== correctOptionKey);
        incorrectOptions.sort(() => Math.random() - 0.5); // Mischen
        
        // Zwei falsche Optionen ausblenden
        incorrectOptions[0].classList.add('hidden');
        incorrectOptions[1].classList.add('hidden');
        
        const jokerButton = document.getElementById('use-joker-btn');
        if (jokerButton) jokerButton.disabled = true;

        updateJokerDisplay();
        saveProgress();
    }


    // --- QUIZ LOGIC ---
    function startMasterQuiz() {
        const answeredIds = [...state.progress.correctlyAnswered, ...state.progress.incorrectlyAnswered];
        let masterQuestions = state.allQuestions.filter(q => !answeredIds.includes(q.id));
        masterQuestions.sort(() => 0.5 - Math.random()); // Mischen

        if (masterQuestions.length === 0) {
            alert("Glückwunsch! Du hast bereits alle Fragen im Quiz beantwortet.");
            return;
        }

        state.currentQuiz = {
            questions: masterQuestions,
            index: 0,
            isMasterQuiz: true
        };

        quizCategoryTitle.textContent = "MASTER Quiz";
        quizBackButton.dataset.target = "start-screen";
        showScreen('quiz-screen');
        displayQuestion();
    }

    function startQuiz(category) {
        const answeredIds = [...state.progress.correctlyAnswered, ...state.progress.incorrectlyAnswered];
        const categoryQuestions = state.allQuestions.filter(q => 
            q.category === category && !answeredIds.includes(q.id)
        );
        
        if (categoryQuestions.length === 0) {
            alert(`Du hast bereits alle Fragen in der Kategorie "${category}" beantwortet.`);
            return;
        }

        state.currentQuiz = {
            questions: categoryQuestions,
            index: 0,
            isMasterQuiz: false
        };

        quizCategoryTitle.textContent = category;
        quizBackButton.dataset.target = "category-selection-screen";
        showScreen('quiz-screen');
        displayQuestion();
    }

    function displayQuestion() {
        explanationContainer.classList.add('hidden');
        if (state.currentQuiz.index >= state.currentQuiz.questions.length) {
            alert("Quizrunde abgeschlossen!");
            updateExamButtonState();
            updateGlobalProgressDisplay();
            showScreen(state.currentQuiz.isMasterQuiz ? 'start-screen' : 'category-selection-screen');
            return;
        }

        updateJokerDisplay();
        const question = state.currentQuiz.questions[state.currentQuiz.index];
        const progress = state.currentQuiz.index + 1;
        const total = state.currentQuiz.questions.length;

        quizCounter.textContent = `Frage ${progress} / ${total}`;
        quizProgressBarInner.style.width = `${(progress / total) * 100}%`;
        questionText.textContent = question.question;

        optionsContainer.innerHTML = '';
        Object.entries(question.options).forEach(([key, value]) => {
            const button = document.createElement('button');
            button.className = 'option-btn';
            button.dataset.option = key;
            button.innerHTML = `<strong>${key}</strong> ${value}`;
            optionsContainer.appendChild(button);
        });
    }
    
    function handleAnswerSelection(selectedOption) {
        const question = state.currentQuiz.questions[state.currentQuiz.index];
        const isCorrect = selectedOption === question.correct;

        Array.from(optionsContainer.children).forEach(btn => {
            btn.classList.add('disabled');
            if (btn.dataset.option === question.correct) btn.classList.add('correct');
            else if (btn.dataset.option === selectedOption) btn.classList.add('incorrect');
        });
        
        const questionId = question.id;
        // Sicherstellen, dass die ID nicht doppelt vorkommt
        state.progress.correctlyAnswered = state.progress.correctlyAnswered.filter(id => id !== questionId);
        state.progress.incorrectlyAnswered = state.progress.incorrectlyAnswered.filter(id => id !== questionId);
        
        if (isCorrect) {
            state.progress.correctlyAnswered.push(questionId);
            state.progress.consecutiveCorrect++;
            if (state.progress.consecutiveCorrect === 3) {
                if (state.progress.jokers < 3) {
                    state.progress.jokers++;
                }
                state.progress.consecutiveCorrect = 0; // Reset after earning
            }
        } else {
            state.progress.incorrectlyAnswered.push(questionId);
            state.progress.consecutiveCorrect = 0; // Reset on incorrect
        }
        
        saveProgress();
        updateGlobalProgressDisplay();
        
        explanationText.textContent = question.explanation;
        explanationContainer.classList.remove('hidden');
    }

    function showNextQuestion() {
        state.currentQuiz.index++;
        displayQuestion();
    }
    
    function renderIncorrectList() { /*...*/ }
    function retryIncorrectQuestion(questionId) { /*...*/ }

    // --- EXAM LOGIC ---
    function startExam() {
        state.currentExam = {
            questions: [...state.testQuestions].sort(() => 0.5 - Math.random()),
            index: 0,
            score: 0
        };
        examContainer.classList.remove('hidden');
        examCompletionScreen.classList.add('hidden');
        submitExamAnswerBtn.classList.remove('hidden');
        examAnswerInput.value = '';
        displayExamQuestion();
        showScreen('exam-screen');
    }

    function displayExamQuestion() {
        const question = state.currentExam.questions[state.currentExam.index];
        const total = state.currentExam.questions.length;
        examCounter.textContent = `Frage ${state.currentExam.index + 1} / ${total} | Richtig: ${state.currentExam.score}`;
        examQuestionText.textContent = question.question;
        examAnswerInput.value = '';
        examAnswerInput.disabled = false;
        micButton.disabled = false;
        submitExamAnswerBtn.disabled = false;
        examLoadingSpinner.classList.add('hidden');
        examFeedbackCard.classList.add('hidden');
    }

    async function submitExamAnswer() {
        const question = state.currentExam.questions[state.currentExam.index];
        const answer = examAnswerInput.value.trim();
        if (!answer) {
            alert("Bitte gib eine Antwort ein.");
            return;
        }
        examLoadingSpinner.classList.remove('hidden');
        submitExamAnswerBtn.disabled = true;
        examAnswerInput.disabled = true;
        micButton.disabled = true;

        try {
            const response = await fetch(state.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: question.question, answer: answer })
            });
            if (!response.ok) throw new Error(`Webhook error: ${response.statusText}`);
            
            // NEU: Antwort als JSON parsen
            const data = await response.json();
            const feedback = data[0]?.output || "Fehler: Unerwartetes Format vom Server erhalten.";
            displayExamFeedback(feedback);

        } catch (error) {
            console.error("Fehler bei der Kommunikation mit dem Webhook:", error);
            displayExamFeedback("Fehler: Die Antwort konnte nicht ausgewertet werden. Bitte versuche es später erneut.");
        } finally {
            examLoadingSpinner.classList.add('hidden');
        }
    }
    
    function displayExamFeedback(feedback) {
        const firstWord = feedback.split(' ')[0].toLowerCase().replace(/[^a-zäöüß]/gi, '');
        
        if (firstWord === 'richtig') {
            state.currentExam.score++;
            examFeedbackCard.className = 'exam-feedback-card correct';
            feedbackTitle.textContent = "Richtig!";
        } else {
            examFeedbackCard.className = 'exam-feedback-card check';
            feedbackTitle.textContent = "Antwort-Check";
        }
        
        // \n mit <br> ersetzen für die Anzeige im HTML
        const formattedFeedback = feedback.replace(/\n/g, '<br>');
        feedbackText.innerHTML = formattedFeedback;
        
        examFeedbackCard.classList.remove('hidden');
    }

    function showNextExamQuestion() {
        state.currentExam.index++;
        if (state.currentExam.index >= state.currentExam.questions.length) {
            examContainer.classList.add('hidden');
            examCompletionScreen.classList.remove('hidden');
            examFinalScore.textContent = `Du hast ${state.currentExam.score} von ${state.currentExam.questions.length} Fragen richtig beantwortet.`;
        } else {
            displayExamQuestion();
        }
    }
    
    // --- SPEECH RECOGNITION ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;

    function initSpeechRecognition() {
        if (SpeechRecognition) {
            recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.lang = 'de-DE';
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;

            recognition.onresult = (event) => {
                const speechResult = event.results[0][0].transcript;
                examAnswerInput.value = speechResult;
            };

            recognition.onend = () => {
                micButton.classList.remove('is-listening');
            };

            recognition.onerror = (event) => {
                console.error('Speech recognition error', event.error);
                alert('Fehler bei der Spracherkennung: ' + event.error);
            };

        } else {
            console.log("Speech Recognition not supported.");
            micButton.style.display = 'none';
        }
    }

    function toggleSpeechRecognition() {
        if (!recognition) return;
        if (micButton.classList.contains('is-listening')) {
            recognition.stop();
        } else {
            try {
                recognition.start();
                micButton.classList.add('is-listening');
            } catch(e) {
                console.error("Could not start recognition", e);
            }
        }
    }

    // --- START THE APP ---
    init();
});
