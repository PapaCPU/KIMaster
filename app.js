document.addEventListener('DOMContentLoaded', () => {
    // DOM ELEMENTE & STATE
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
        incorrectQuestionsList: document.getElementById('incorrect-questions-list')
    };

    const state = {
        allQuestions: [],
        progress: {
            correctlyAnswered: [],
            incorrectlyAnswered: [],
            consecutiveCorrect: 0,
            jokers: 0
        },
        currentQuiz: { questions: [], index: 0 }
    };

    // Fortschritt laden/speichern
    const loadProgress = () => {
        const saved = localStorage.getItem('quizProgress');
        if (saved) state.progress = { ...state.progress, ...JSON.parse(saved) };
    };
    const saveProgress = () => {
        localStorage.setItem('quizProgress', JSON.stringify(state.progress));
    };

    // Screens verwalten
    const showScreen = id => {
        DOM.screens.forEach(s => s.classList.toggle('active', s.id === id));
        if (id === 'start-screen' || id === 'category-selection-screen') updateGlobalProgressDisplay();
        if (id === 'category-selection-screen') renderCategoryList();
        if (id === 'incorrect-list-screen') renderIncorrectList();
    };

    const updateGlobalProgressDisplay = () => {
        if (!state.allQuestions.length) return;
        const text = `Gesamtfortschritt: <span>${state.progress.correctlyAnswered.length} / ${state.allQuestions.length}</span> richtig`;
        DOM.globalProgressElements.forEach(el => el.innerHTML = text);
    };

    // Kategorie-Liste
    const renderCategoryList = () => {
        const cats = state.allQuestions.reduce((acc, q) => {
            const diff = q.difficulty || 'mittel';
            if (!acc[q.category]) acc[q.category] = { total: 0, correct: 0, difficulties: { leicht:[0,0], mittel:[0,0], schwer:[0,0] } };
            acc[q.category].total++;
            acc[q.category].difficulties[diff][1]++;
            if (state.progress.correctlyAnswered.includes(q.id)) {
                acc[q.category].correct++;
                acc[q.category].difficulties[diff][0]++;
            }
            return acc;
        }, {});
        DOM.categoryList.innerHTML = Object.entries(cats).map(([name, data]) =>
            `<div class="category-item" data-category="${name}">
                <h3>${name}</h3>
                <div class="category-progress"><strong>${data.correct}/${data.total}</strong></div>
                <div class="difficulty-progress">
                    <span>L:${data.difficulties.leicht[0]}/${data.difficulties.leicht[1]}</span>
                    <span>M:${data.difficulties.mittel[0]}/${data.difficulties.mittel[1]}</span>
                    <span>S:${data.difficulties.schwer[0]}/${data.difficulties.schwer[1]}</span>
                </div>
            </div>`
        ).join('');
    };

    // Falsch beantwortete Fragen
    const renderIncorrectList = () => {
        const items = state.allQuestions
            .filter(q => state.progress.incorrectlyAnswered.includes(q.id))
            .map(q => `<div class="incorrect-question-item">
                        <p>${q.question}</p>
                        <button class="retry-btn" data-id="${q.id}">Wiederholen</button>
                       </div>`);
        DOM.incorrectQuestionsList.innerHTML = items.length ? items.join('') : '<p>Keine falsch beantworteten Fragen!</p>';
    };

    // Quiz starten
    const startQuiz = category => {
        const answered = new Set([...state.progress.correctlyAnswered, ...state.progress.incorrectlyAnswered]);
        let questions = category
            ? state.allQuestions.filter(q => q.category === category && !answered.has(q.id))
            : state.allQuestions.filter(q => !answered.has(q.id)).sort(() => 0.5 - Math.random()).slice(0, 10);
        if (!questions.length) { alert('Keine neuen Fragen verfügbar.'); return; }

        state.currentQuiz = { questions, index: 0, isMaster: !category };
        DOM.quizCategoryTitle.textContent = category || 'MASTER Quiz';
        DOM.quizBackButton.dataset.target = category ? 'category-selection-screen' : 'start-screen';
        showScreen('quiz-screen');
        displayQuestion();
    };

    // Frage anzeigen
    const displayQuestion = () => {
        const { questions, index } = state.currentQuiz;
        if (index >= questions.length) { alert('Quiz beendet!'); showScreen(state.currentQuiz.isMaster ? 'start-screen' : 'category-selection-screen'); return; }
        DOM.explanationContainer.classList.add('hidden');
        updateJokerDisplay();
        const q = questions[index];
        DOM.quizCounter.textContent = `Frage ${index + 1} / ${questions.length}`;
        DOM.quizProgressBarInner.style.width = `${((index + 1) / questions.length) * 100}%`;
        DOM.questionText.textContent = q.question;
        DOM.optionsContainer.innerHTML = Object.entries(q.options).map(([k,v]) =>
            `<button class="option-btn" data-option="${k}"><strong>${k}</strong> ${v}</button>`
        ).join('');
    };

    // Antwort auswerten
    const handleAnswerSelection = choice => {
        const q = state.currentQuiz.questions[state.currentQuiz.index];
        Array.from(DOM.optionsContainer.children).forEach(b => b.classList.add('disabled'));
        const correctBtn = document.querySelector(`.option-btn[data-option=\"${q.correct}\"]`);
        correctBtn.classList.add('correct');
        if (choice !== q.correct) document.querySelector(`.option-btn[data-option=\"${choice}\"]`).classList.add('incorrect');

        if (![...state.progress.correctlyAnswered, ...state.progress.incorrectlyAnswered].includes(q.id)) {
            if (choice === q.correct) {
                state.progress.correctlyAnswered.push(q.id);
                state.progress.consecutiveCorrect++;
                if (state.progress.consecutiveCorrect === 3 && state.progress.jokers < 3) {
                    state.progress.jokers++;
                    state.progress.consecutiveCorrect = 0;
                }
            } else {
                state.progress.incorrectlyAnswered.push(q.id);
                state.progress.consecutiveCorrect = 0;
            }
            saveProgress();
            updateGlobalProgressDisplay();
        }
        DOM.explanationText.textContent = q.explanation;
        DOM.explanationContainer.classList.remove('hidden');
    };

    // Joker (50/50)
    const updateJokerDisplay = () => {
        DOM.jokerContainer.innerHTML = `
            <span id="joker-count">${state.progress.jokers}</span>
            <button id="use-joker-btn" ${state.progress.jokers > 0 ? '' : 'disabled'}><i class="fas fa-lightbulb"></i> 50/50</button>
        `;
    };
    const useJoker = () => {
        if (state.progress.jokers <= 0) return;
        state.progress.jokers--;
        const q = state.currentQuiz.questions[state.currentQuiz.index];
        const wrongs = Array.from(document.querySelectorAll('.option-btn')).filter(b => b.dataset.option !== q.correct);
        wrongs.sort(() => 0.5 - Math.random());
        wrongs[0].classList.add('hidden');
        wrongs[1].classList.add('hidden');
        document.getElementById('use-joker-btn').disabled = true;
        saveProgress();
        updateJokerDisplay();
    };

    // Event-Listener
    const setupEventListeners = () => {
        document.body.addEventListener('click', e => {
            const t = e.target.closest('[data-target]');
            if (t) showScreen(t.dataset.target);
        });
        DOM.masterQuizBtn.addEventListener('click', () => startQuiz(null));
        DOM.categoryList.addEventListener('click', e => {
            const cat = e.target.closest('.category-item');
            if (cat) startQuiz(cat.dataset.category);
        });
        DOM.incorrectQuestionsList.addEventListener('click', e => {
            const btn = e.target.closest('.retry-btn');
            if (btn) {
                const qid = Number(btn.dataset.id);
                const qobj = state.allQuestions.find(q => q.id === qid);
                state.currentQuiz = { questions: [qobj], index: 0, isMaster: false };
                DOM.quizCategoryTitle.textContent = 'Wiederholung';
                DOM.quizBackButton.dataset.target = 'incorrect-list-screen';
                showScreen('quiz-screen');
                displayQuestion();
            }
        });
        DOM.optionsContainer.addEventListener('click', e => {
            const b = e.target.closest('.option-btn');
            if (b) handleAnswerSelection(b.dataset.option);
        });
        DOM.nextQuestionBtn.addEventListener('click', () => {
            state.currentQuiz.index++;
            displayQuestion();
        });
        DOM.jokerContainer.addEventListener('click', e => {
            if (e.target.closest('#use-joker-btn')) useJoker();
        });
        DOM.resetProgressBtn.addEventListener('click', () => {
            if (confirm('Sicher? Alle Fortschritte werden gelöscht.')) {
                state.progress = { correctlyAnswered: [], incorrectlyAnswered: [], consecutiveCorrect: 0, jokers: 0 };
                saveProgress();
                updateGlobalProgressDisplay();
                showScreen('start-screen');
                alert('Fortschritt zurückgesetzt.');
            }
        });
    };

    // Initialisierung
    const init = async () => {
        try {
            const res = await fetch('./questions.json');
            if (!res.ok) throw new Error('questions.json nicht gefunden');
            state.allQuestions = await res.json();
            loadProgress();
            setupEventListeners();
            showScreen('start-screen');
        } catch (err) {
            console.error('Fehler beim Laden:', err);
            DOM.app.innerHTML = '<p>Fehler beim Laden der App. Bitte Konsole prüfen.</p>';
        }
    };
    init();
});
