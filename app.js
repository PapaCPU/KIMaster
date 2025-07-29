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
            incorrectlyAnswered: []
        },
        currentQuiz: {
            questions: [],
            index: 0
        },
        currentExam: {
            questions: [],
            index: 0
        },
        webhookUrl: 'https://papacpun8n.ddns.net/webhook/ab4b120a-a21f-4be2-8c75-708433084a60'
    };

    // --- DOM ELEMENTS ---
    const screens = document.querySelectorAll('.screen');
    const app = document.getElementById('app');

    // Main Menu
    const examButton = document.getElementById('exam-button');

    // Category Screen
    const categoryList = document.getElementById('category-list');

    // Quiz Screen
    const quizScreen = document.getElementById('quiz-screen');
    const quizCategoryTitle = document.getElementById('quiz-category-title');
    const quizCounter = document.getElementById('quiz-counter');
    const questionText = document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');
    const explanationContainer = document.getElementById('explanation-container');
    const explanationText = document.getElementById('explanation-text');
    const nextQuestionBtn = document.getElementById('next-question-btn');
    const quizProgressBarInner = document.getElementById('quiz-progress-bar-inner');


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
            showScreen('start-screen');

        } catch (error) {
            console.error("Fehler beim Laden der Quizdaten:", error);
            app.innerHTML = `<p style="color:red; text-align:center; padding: 20px;">Fehler: Die Quizdaten (questions.json / test.json) konnten nicht geladen werden. Bitte stelle sicher, dass die Dateien im richtigen Ordner liegen.</p>`;
        }
    }

    // --- NAVIGATION ---
    function showScreen(screenId) {
        screens.forEach(screen => {
            screen.classList.toggle('active', screen.id === screenId);
        });

        // Prepare screen content when shown
        switch (screenId) {
            case 'category-selection-screen':
                renderCategoryList();
                break;
            case 'incorrect-list-screen':
                renderIncorrectList();
                break;
            case 'exam-screen':
                if (examButton.disabled) {
                    alert("Bitte beantworte zuerst alle Fragen in den Kategorien korrekt, um die Prüfung freizuschalten.");
                    showScreen('start-screen');
                } else {
                    startExam();
                }
                break;
        }
    }

    // --- EVENT LISTENERS ---
    function setupEventListeners() {
        // Main menu and back buttons
        document.body.addEventListener('click', (e) => {
            if (e.target.matches('[data-target]')) {
                showScreen(e.target.dataset.target);
            }
        });

        // Category selection
        categoryList.addEventListener('click', (e) => {
            const categoryItem = e.target.closest('.category-item');
            if (categoryItem) {
                startQuiz(categoryItem.dataset.category);
            }
        });
        
        // Answer selection in Quiz
        optionsContainer.addEventListener('click', (e) => {
            const optionBtn = e.target.closest('.option-btn');
            if (optionBtn) {
                handleAnswerSelection(optionBtn.dataset.option);
            }
        });
        
        // Next question button
        nextQuestionBtn.addEventListener('click', showNextQuestion);

        // Reset progress
        resetProgressBtn.addEventListener('click', () => {
            if(confirm("Bist du sicher, dass du deinen gesamten Fortschritt löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden.")) {
                resetProgress();
            }
        });

        // Exam logic
        submitExamAnswerBtn.addEventListener('click', submitExamAnswer);
        nextExamQuestionBtn.addEventListener('click', showNextExamQuestion);
        restartExamBtn.addEventListener('click', startExam);
        micButton.addEventListener('click', toggleSpeechRecognition);

        // Incorrect question retry
        incorrectQuestionsList.addEventListener('click', (e) => {
            if (e.target.classList.contains('retry-btn')) {
                const questionId = parseInt(e.target.dataset.id);
                retryIncorrectQuestion(questionId);
            }
        });
    }

    // --- PROGRESS MANAGEMENT ---
    function saveProgress() {
        localStorage.setItem('kiQuizProgress', JSON.stringify(state.progress));
    }

    function loadProgress() {
        const savedProgress = localStorage.getItem('kiQuizProgress');
        if (savedProgress) {
            state.progress = JSON.parse(savedProgress);
        }
    }

    function resetProgress() {
        state.progress = { correctlyAnswered: [], incorrectlyAnswered: [] };
        saveProgress();
        updateExamButtonState();
        showScreen('start-screen');
        alert("Dein Fortschritt wurde zurückgesetzt.");
    }
    
    function updateExamButtonState() {
        const allAnsweredCorrectly = state.allQuestions.length > 0 && state.progress.correctlyAnswered.length === state.allQuestions.length;
        examButton.disabled = !allAnsweredCorrectly;
    }

    // --- CATEGORY SCREEN LOGIC ---
    function renderCategoryList() {
        categoryList.innerHTML = '';
        state.categories.forEach(category => {
            const questionsInCategory = state.allQuestions.filter(q => q.category === category);
            if (questionsInCategory.length === 0) return;

            const correctInCategory = questionsInCategory.filter(q => state.progress.correctlyAnswered.includes(q.id));
            const totalCount = questionsInCategory.length;
            const correctCount = correctInCategory.length;
            
            const correctByDifficulty = { leicht: 0, mittel: 0, schwer: 0 };
            const totalByDifficulty = { leicht: 0, mittel: 0, schwer: 0 };

            questionsInCategory.forEach(q => {
                totalByDifficulty[q.difficulty]++;
                if (state.progress.correctlyAnswered.includes(q.id)) {
                    correctByDifficulty[q.difficulty]++;
                }
            });

            const categoryElement = document.createElement('div');
            categoryElement.className = 'category-item';
            categoryElement.dataset.category = category;
            categoryElement.innerHTML = `
                <h3>${category}</h3>
                <div class="category-progress"><strong>${correctCount} / ${totalCount}</strong> beantwortet</div>
                <div class="difficulty-progress">
                    <span>Leicht: ${correctByDifficulty.leicht}/${totalByDifficulty.leicht}</span>
                    <span>Mittel: ${correctByDifficulty.mittel}/${totalByDifficulty.mittel}</span>
                    <span>Schwer: ${correctByDifficulty.schwer}/${totalByDifficulty.schwer}</span>
                </div>
            `;
            categoryList.appendChild(categoryElement);
        });
    }

    // --- QUIZ LOGIC ---
    function startQuiz(category) {
        state.currentQuiz.questions = state.allQuestions.filter(q => q.category === category);
        state.currentQuiz.index = 0;
        quizCategoryTitle.textContent = category;
        showScreen('quiz-screen');
        displayQuestion();
    }

    function displayQuestion() {
        explanationContainer.classList.add('hidden');
        if (state.currentQuiz.index >= state.currentQuiz.questions.length) {
            alert("Kategorie abgeschlossen!");
            updateExamButtonState();
            showScreen('category-selection-screen');
            return;
        }

        const question = state.currentQuiz.questions[state.currentQuiz.index];
        const progress = state.currentQuiz.index + 1;
        const total = state.currentQuiz.questions.length;

        quizCounter.textContent = `Frage ${progress} / ${total}`;
        quizProgressBarInner.style.width = `${(progress / total) * 100}%`;
        questionText.textContent = question.question;

        optionsContainer.innerHTML = '';
        for (const [key, value] of Object.entries(question.options)) {
            const button = document.createElement('button');
            button.className = 'option-btn';
            button.dataset.option = key;
            button.innerHTML = `<strong>${key}</strong> ${value}`;
            optionsContainer.appendChild(button);
        }
    }
    
    function handleAnswerSelection(selectedOption) {
        const question = state.currentQuiz.questions[state.currentQuiz.index];
        const isCorrect = selectedOption === question.correct;

        // Visual Feedback
        Array.from(optionsContainer.children).forEach(btn => {
            btn.classList.add('disabled');
            if (btn.dataset.option === question.correct) {
                btn.classList.add('correct');
            } else if (btn.dataset.option === selectedOption) {
                btn.classList.add('incorrect');
            }
        });
        
        // Update Progress
        const questionId = question.id;
        state.progress.correctlyAnswered = state.progress.correctlyAnswered.filter(id => id !== questionId);
        state.progress.incorrectlyAnswered = state.progress.incorrectlyAnswered.filter(id => id !== questionId);

        if (isCorrect) {
            state.progress.correctlyAnswered.push(questionId);
        } else {
            state.progress.incorrectlyAnswered.push(questionId);
        }
        saveProgress();
        
        // Show explanation
        explanationText.textContent = question.explanation;
        explanationContainer.classList.remove('hidden');
    }

    function showNextQuestion() {
        state.currentQuiz.index++;
        displayQuestion();
    }
    
    // --- INCORRECT LIST LOGIC ---
    function renderIncorrectList() {
        incorrectQuestionsList.innerHTML = '';
        const incorrectQuestions = state.allQuestions.filter(q => state.progress.incorrectlyAnswered.includes(q.id));
        
        if (incorrectQuestions.length === 0) {
            incorrectQuestionsList.innerHTML = '<p>Super! Du hast bisher alle Fragen richtig beantwortet.</p>';
            return;
        }

        incorrectQuestions.forEach(q => {
            const item = document.createElement('div');
            item.className = 'incorrect-question-item';
            item.innerHTML = `
                <p>${q.question}</p>
                <button class="retry-btn" data-id="${q.id}">Wiederholen</button>
            `;
            incorrectQuestionsList.appendChild(item);
        });
    }

    function retryIncorrectQuestion(questionId) {
        const questionToRetry = state.allQuestions.find(q => q.id === questionId);
        if (questionToRetry) {
            state.currentQuiz.questions = [questionToRetry];
            state.currentQuiz.index = 0;
            quizCategoryTitle.textContent = "Frage wiederholen";
            showScreen('quiz-screen');
            displayQuestion();
        }
    }

    // --- EXAM LOGIC ---
    function startExam() {
        state.currentExam.questions = [...state.testQuestions].sort(() => 0.5 - Math.random()); // Shuffle
        state.currentExam.index = 0;
        
        examContainer.classList.remove('hidden');
        examCompletionScreen.classList.add('hidden');
        submitExamAnswerBtn.classList.remove('hidden');
        examAnswerInput.value = '';
        
        displayExamQuestion();
        showScreen('exam-screen');
    }

    function displayExamQuestion() {
        const question = state.currentExam.questions[state.currentExam.index];
        examCounter.textContent = `Frage ${state.currentExam.index + 1} / ${state.currentExam.questions.length}`;
        examQuestionText.textContent = question.question;

        // Reset UI for the new question
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
        
        // Show loading state
        examLoadingSpinner.classList.remove('hidden');
        submitExamAnswerBtn.disabled = true;
        examAnswerInput.disabled = true;
        micButton.disabled = true;

        try {
            const response = await fetch(state.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: question.question,
                    answer: answer
                })
            });
            
            if (!response.ok) {
                throw new Error(`Webhook error: ${response.statusText}`);
            }

            const feedback = await response.text();
            displayExamFeedback(feedback);

        } catch (error) {
            console.error("Fehler bei der Kommunikation mit dem Webhook:", error);
            displayExamFeedback("Fehler: Die Antwort konnte nicht ausgewertet werden. Bitte versuche es später erneut.");
        } finally {
            examLoadingSpinner.classList.add('hidden');
        }
    }
    
    function displayExamFeedback(feedback) {
        feedbackText.textContent = feedback;
        
        // Simple keyword check for feedback card styling
        if (feedback.toLowerCase().includes('richtig') || feedback.toLowerCase().includes('korrekt')) {
            examFeedbackCard.className = 'exam-feedback-card correct';
            feedbackTitle.textContent = "Richtig!";
        } else {
            examFeedbackCard.className = 'exam-feedback-card check';
            feedbackTitle.textContent = "Antwort-Check";
        }
        
        examFeedbackCard.classList.remove('hidden');
    }

    function showNextExamQuestion() {
        state.currentExam.index++;
        if (state.currentExam.index >= state.currentExam.questions.length) {
            // Exam finished
            examContainer.classList.add('hidden');
            examCompletionScreen.classList.remove('hidden');
        } else {
            displayExamQuestion();
        }
    }
    
    // --- SPEECH RECOGNITION ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'de-DE';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            const speechResult = event.results[0][0].transcript;
            examAnswerInput.value = speechResult;
            micButton.classList.remove('is-listening');
        };

        recognition.onspeechend = () => {
            recognition.stop();
            micButton.classList.remove('is-listening');
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            micButton.classList.remove('is-listening');
        };

    } else {
        micButton.style.display = 'none'; // Hide if not supported
    }

    function toggleSpeechRecognition() {
        if (!recognition) return;

        if (micButton.classList.contains('is-listening')) {
            recognition.stop();
            micButton.classList.remove('is-listening');
        } else {
            recognition.start();
            micButton.classList.add('is-listening');
        }
    }

    // --- START THE APP ---
    init();
});
