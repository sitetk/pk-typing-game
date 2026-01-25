/**
 * アプリケーション・エントリーポイント
 * UI更新と入力制御の統括
 */
const SAVE_SLOT_IDS = ['1', '2', '3'];

const App = {
    loader: null,
    typing: null,
    battle: null,
    audio: null,
    moveConfig: null,
    audioSettingsStorageKey: 'pokemon_typing_audio_settings',

    // 定数: 1ページあたり25体 (5列×5行) のポケモンリスト
    ITEMS_PER_PAGE: 25,
    ITEMS_PER_PAGE_CUSTOM: 25,
    ITEMS_PER_BOX_PAGE_STORY: 24, // 6x4
    STORY_BOX_CAPACITY: 999, // 実質無制限 (ページネーションで対応)

    menuInputBuffer: "",
    itemInputBuffer: "",
    pokemonInputBuffer: "",
    numberInputBuffer: "",
    numberInputTimeout: null,

    saveManager: null,
    currentSlotId: '1',
    playerName: 'プレイヤー',
    accumulatedPlayTime: 0,
    playStartTimestamp: Date.now(),
    pendingSlotForName: null,
    pendingImport: null,

    currentMode: null,
    storyRegion: null,
    storySelectedStageId: null,
    storyStageList: [],
    storyRegionDisplayName: '',
    storyRegionImageUrl: '',
    clearedStages: new Set(),
    defeatedPokemonIds: new Set(),
    capturedPokemonIds: new Set(),
    storyItems: new Set(),
    getStageModalData: null,
    selectedGetStageRewardIndex: null,
    currentPage: 1, // 相手選択用ページ
    currentCustomPage: 1, // 自分選択用ページ
    battleCommandLocked: true,
    battleCommandLocked: true,
    commandLocked: true,

    currentParty: [],
    customPartySelection: [],
    customParties: [],
    selectedEnemyIds: [],
    partyCardPage: 1,
    partyCardsPerPage: 4,
    activePartyIndex: null,
    enemyParty: [],
    battleSettings: { playerLevel: 50, enemyLevel: 50 },
    commandList: ['tatakau', 'dougu', 'pokemon', 'nigeru'],
    isFirstBattle: true,
    storyPartySlots: Array.from({ length: 6 }, () => null),
    storyBoxSlots: [],
    storyPokemonBoxSelection: null,
    storyPartyInitialized: false,
    modalLockCount: 0,
    modalScrollPosition: 0,
    storyCapturedPokemonIds: new Set(),
    storyOwnedPokemonDetails: [],
    storyBoxViewActive: false,
    storyBoxSortMode: false,
    storyBoxSortSelection: null,
    storyBoxPage: 1,
    storyBoxSortType: 'id', // 'id', 'level', 'name'
    storyBoxSwapSourceUuid: null,
    storyBoxSearchQuery: '',
    storyBoxOrganizeMode: false,
    storyCollectionInitialized: false,
    enemySelectTitleDefault: 'あいてのポケモンをえらぶ',
    enemySelectBackDefaultText: '',
    enemySelectConfirmDefaultText: '',
    enemySelectBackDefaultHandler: null,
    enemySelectConfirmDefaultHandler: null,

    // プリセットパーティ
    presetParties: [
        { name: "パルデア・オールスターズ", ids: ['908', '911', '914', '923', '959', '998'] },
        { name: "古代の咆哮", ids: ['1007', '1005', '987', '985', '984', '989'] },
        { name: "未来へのドライブ", ids: ['1008', '1006', '991', '992', '993', '994'] },
        { name: "災厄と黄金", ids: ['1002', '1004', '1001', '1003', '1000', '983'] },
        { name: "ブイズ・ファンタジー", ids: ['700', '197', '196', '470', '471', '134'] },
        { name: "パルデア・ニューウェーブ", ids: ['980', '979', '128', '981', '949', '982'] },
        { name: "ガチ対戦メタ", ids: ['149', '887', '1000', '934', '983', '637'] },
        { name: "ヒーロー＆ヴィラン", ids: ['964', '937', '936', '977', '954', '861'] },
        { name: "キュート＆スモール", ids: ['925', '25', '778', '927', '549', '939'] },
        { name: "600族・怪獣大決戦", ids: ['445', '998', '373', '635', '248', '706'] },
        { name: "真夜中のファントム", ids: ['94', '979', '1000', '887', '778', '937'] }
    ],

    dom: {},
    screenHistory: [],

    async init() {
        this.cacheDOM();
        this.bindEvents();

        this.loader = new DataLoader();
        this.typing = new TypingEngine();
        this.audio = new AudioManager();
        this.saveManager = new SaveManager();
        this.storyManager = new StoryManager(this); // Initialize StoryManager
        this.loadAudioPreferences();

        try {
            await this.loader.load();
            this.dom.loadStatus.classList.add('hidden');

            // MoveConfigScreenの初期化
            if (typeof MoveConfigScreen !== 'undefined') {
                this.moveConfig = new MoveConfigScreen(this);
            }

            this.showStartScreen();
        } catch (e) {
            this.dom.loadStatus.textContent = "データの よみこみに しっぱいしました。";
            console.error(e);
        }
    },

    cacheDOM() {
        this.dom = {
            titleScreen: document.getElementById('title-screen'),
            partySelectScreen: document.getElementById('party-select-screen'),
            customPartyScreen: document.getElementById('custom-party-screen'),
            enemySelectScreen: document.getElementById('enemy-select-screen'),
            moveConfigScreen: document.getElementById('move-config-screen'),
            battleScreen: document.getElementById('battle-screen'),
            levelModal: document.getElementById('level-modal'),

            loadStatus: document.getElementById('load-status'),
            startPanel: document.getElementById('start-panel'),
            gameStartBtn: document.getElementById('game-start-btn'),
            modeBtns: document.querySelectorAll('.mode-btn'),
            muteBtn: document.getElementById('mute-btn'),
            muteIcon: document.getElementById('mute-icon'),
            partyGrid: document.getElementById('party-grid'),
            playerLevelInput: document.getElementById('player-level-input'),
            enemyLevelInput: document.getElementById('enemy-level-input'),
            saveSelectScreen: document.getElementById('save-select-screen'),
            saveSlotGrid: document.getElementById('save-slot-grid'),
            saveReturnBtn: document.getElementById('save-return-btn'),
            saveToFileBtn: document.getElementById('save-to-file-btn'),
            importFromFileBtn: document.getElementById('import-from-file-btn'),
            saveFileInput: document.getElementById('save-file-input'),
            nameInputModal: document.getElementById('name-input-modal'),
            nameInputField: document.getElementById('name-input-field'),
            playerExpBar: document.getElementById('player-exp-bar'),
            nameInputConfirm: document.getElementById('name-input-confirm'),
            nameInputCancel: document.getElementById('name-input-cancel'),
            importTargetModal: document.getElementById('import-target-modal'),
            importDataSummary: document.getElementById('import-data-summary'),
            importSlotButtons: document.querySelectorAll('#import-target-modal .import-slot-btn'),
            importCancelBtn: document.getElementById('import-cancel-btn'),

            // 技構成画面
            moveConfigTabs: document.getElementById('move-config-tabs'),
            learnableMovesList: document.getElementById('learnable-moves-list'),
            currentMovesList: document.getElementById('current-moves-list'),

            // スロット (自分)
            memberSlots: document.querySelectorAll('#player-slots-container .member-slot'),
            customPokemonList: document.getElementById('custom-pokemon-list'),
            customConfirmBtn: document.getElementById('custom-confirm-btn'),

            // スロット (相手)
            enemySlots: document.querySelectorAll('#enemy-slots-container .member-slot'),
            enemyPokemonList: document.getElementById('enemy-pokemon-list'),
            enemyConfirmBtn: document.getElementById('enemy-confirm-btn'),

            // バトルUI
            pName: document.getElementById('player-name'),
            eName: document.getElementById('enemy-name'),
            pLv: document.getElementById('player-level-display'),
            eLv: document.getElementById('enemy-level-display'),
            pHpCur: document.getElementById('player-hp-cur'),
            pHpMax: document.getElementById('player-hp-max'),
            pHpBar: document.getElementById('player-hp-bar'),
            eHpBar: document.getElementById('enemy-hp-bar'),
            playerSpriteContainer: document.getElementById('player-sprite'),
            enemySpriteContainer: document.getElementById('enemy-sprite'),
            msgText: document.getElementById('battle-message'),
            typingKana: document.getElementById('typing-kana'),
            typingRoman: document.getElementById('typing-roman'),
            typingPanel: document.getElementById('typing-panel'),
            cmdMenu: document.getElementById('command-menu'),
            moveMenu: document.getElementById('move-menu'),
            itemMenu: document.getElementById('item-menu'),
            pokemonMenu: document.getElementById('pokemon-menu'),
            itemList: document.getElementById('item-list'),
            partyList: document.getElementById('party-list'),
            moveList: document.getElementById('move-list'),
            keyboard: document.getElementById('onscreen-keyboard'),
            keyboardColumn: document.getElementById('keyboard-column'),
            keys: document.querySelectorAll('.kb-key'),
            battleArea: document.querySelector('.battle-area'),
            storyRegionSelectScreen: document.getElementById('story-region-select-screen'),
            storyRegionBackBtn: document.getElementById('story-region-back-btn'),
            storyRegionCards: document.querySelectorAll('#story-region-select-screen .region-card'),
            storyStageScreen: document.getElementById('story-stage-screen'),
            storyStageGrid: document.getElementById('story-stage-grid'),
            storyStageBackBtn: document.getElementById('story-stage-back-btn'),
            storyStageTitle: document.getElementById('story-stage-current-name'),
            storyStageDesc: document.getElementById('story-stage-current-description'),
            storyStageBannerImage: document.getElementById('story-stage-banner-img'),
            pokemonBoxBtn: document.getElementById('pokemon-box-btn'),
            friendlyShopBtn: document.getElementById('friendly-shop-btn'),
            storyPokemonBoxOverlay: document.getElementById('story-pokemon-box-overlay'),
            storyPokemonBoxCloseBtn: document.getElementById('story-pokemon-box-close-btn'),
            storyPokemonParty: document.getElementById('story-pokemon-party'),
            storyPokemonBoxGrid: document.getElementById('story-pokemon-box-grid'),
            getStageModal: document.getElementById('get-stage-modal'),
            getStageTitle: document.getElementById('get-stage-title'),
            getStageDescription: document.getElementById('get-stage-description'),
            getStageInstructions: document.getElementById('get-stage-instructions'),
            getStageRewardList: document.getElementById('get-stage-reward-list'),
            getStageConfirmBtn: document.getElementById('get-stage-confirm-btn'),
            getStageCancelBtn: document.getElementById('get-stage-cancel-btn'),
            getStageTypeLabel: document.getElementById('get-stage-type-label'),
            trainerBattleModal: document.getElementById('trainer-battle-modal'),
            trainerBattleTitle: document.getElementById('trainer-battle-title'),
            trainerBattleStageName: document.getElementById('trainer-battle-stage-name'),
            trainerBattleMessage: document.getElementById('trainer-battle-message'),
            trainerPokemonList: document.getElementById('trainer-pokemon-list'),
            trainerBattleStartBtn: document.getElementById('trainer-battle-start-btn'),
            trainerBattleCancelBtn: document.getElementById('trainer-battle-cancel-btn'),

            // システムモーダル
            systemMessageModal: document.getElementById('system-message-modal'),
            systemModalTitle: document.getElementById('system-modal-title'),
            systemModalMessage: document.getElementById('system-modal-message'),
            systemModalInputContainer: document.getElementById('system-modal-input-container'),
            systemModalInput: document.getElementById('system-modal-input'),
            systemModalOkBtn: document.getElementById('system-modal-ok-btn'),
            systemModalCancelBtn: document.getElementById('system-modal-cancel-btn')
        };
    },

    bindEvents() {
        this.dom.gameStartBtn.onclick = () => this.handleGameStart();
        this.dom.modeBtns.forEach(btn => btn.onclick = () => this.handleModeSelect(btn.dataset.mode));
        document.querySelectorAll('.mode-switch-btn').forEach(btn => btn.onclick = () => this.showTitleScreen());
        if (this.dom.saveReturnBtn) this.dom.saveReturnBtn.onclick = () => this.showTitleScreen();
        if (this.dom.saveToFileBtn) this.dom.saveToFileBtn.onclick = () => this.handleSaveToFile();
        if (this.dom.importFromFileBtn) this.dom.importFromFileBtn.onclick = () => this.dom.saveFileInput?.click();
        if (this.dom.saveFileInput) this.dom.saveFileInput.onchange = (e) => this.handleImportFileChange(e);
        if (this.dom.nameInputConfirm) this.dom.nameInputConfirm.onclick = () => this.handleNameInputConfirm();
        if (this.dom.nameInputCancel) this.dom.nameInputCancel.onclick = () => this.hideNameInputModal();
        if (this.dom.nameInputField) this.dom.nameInputField.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleNameInputConfirm();
            }
        };
        if (this.dom.importSlotButtons) {
            this.dom.importSlotButtons.forEach(btn => {
                btn.onclick = () => this.handleImportTargetSelect(btn.dataset.slotId);
            });
        }
        if (this.dom.importCancelBtn) this.dom.importCancelBtn.onclick = () => this.cancelImport();
        if (this.dom.muteBtn) {
            this.dom.muteBtn.onclick = () => this.handleMuteButtonClick();
        }

        // 戻るボタン
        document.getElementById('party-back-btn').onclick = () => this.showModeSelectScreen();
        document.getElementById('custom-back-btn').onclick = () => this.showPartySelectScreen();
        const enemySelectBackBtn = document.getElementById('enemy-select-back-btn');
        if (enemySelectBackBtn) {
            const enemyBackHandler = () => this.showPartySelectScreen();
            enemySelectBackBtn.onclick = enemyBackHandler;
            this.enemySelectBackDefaultHandler = enemyBackHandler;
            this.enemySelectBackDefaultText = enemySelectBackBtn.textContent;
        }

        // 決定ボタン
        this.dom.customConfirmBtn.onclick = () => this.handleCustomPartyConfirm();
        if (this.dom.enemyConfirmBtn) {
            const enemyConfirmHandler = () => this.showLevelModal();
            this.dom.enemyConfirmBtn.onclick = enemyConfirmHandler;
            this.enemySelectConfirmDefaultHandler = enemyConfirmHandler;
            this.enemySelectConfirmDefaultText = this.dom.enemyConfirmBtn.textContent;
        }
        document.getElementById('modal-confirm-btn').onclick = () => this.handleLevelConfirm();
        document.getElementById('modal-cancel-btn').onclick = () => this.dom.levelModal.classList.add('hidden');

        const moveConfigBackBtn = document.getElementById('move-config-back-btn');
        if (moveConfigBackBtn) {
            moveConfigBackBtn.onclick = () => {
                if (this.storyMoveConfigContext) {
                    this.closeStoryMoveConfig();
                } else {
                    this.showEnemySelectScreen(false, false);
                }
            };
        }

        document.getElementById('battle-start-final-btn').onclick = () => this.handleFinalBattleStart();

        // ページネーション
        document.querySelectorAll('#custom-party-screen .prev-btn').forEach(b => b.onclick = () => this.changeCustomPage(-1));
        document.querySelectorAll('#custom-party-screen .next-btn').forEach(b => b.onclick = () => this.changeCustomPage(1));
        document.querySelectorAll('#enemy-select-screen .prev-btn').forEach(b => b.onclick = () => this.changeEnemyPage(-1));
        document.querySelectorAll('#enemy-select-screen .next-btn').forEach(b => b.onclick = () => this.changeEnemyPage(1));

        const partyPrevBtn = document.getElementById('party-prev-page');
        const partyNextBtn = document.getElementById('party-next-page');
        if (partyPrevBtn) partyPrevBtn.onclick = () => this.changePartyCardPage(-1);
        if (partyNextBtn) partyNextBtn.onclick = () => this.changePartyCardPage(1);

        document.addEventListener('keydown', (e) => this.handleGlobalKeyDown(e));

        const levelInputs = [this.dom.playerLevelInput, this.dom.enemyLevelInput].filter(Boolean);
        levelInputs.forEach(input => {
            input.setAttribute('inputmode', 'numeric');
            input.addEventListener('keydown', (event) => this.handleLevelInputKeyDown(event));
            input.addEventListener('input', (event) => this.keepDigitsOnly(event?.target));
            input.addEventListener('blur', () => {
                input.value = String(this.normalizeLevelInputValue(input.value));
            });
        });

        // 仮想キーボードのクリックイベント
        this.dom.keys.forEach(key => {
            key.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const k = key.dataset.key;
                this.handleGlobalKeyDown({ key: k, preventDefault: () => { } });
            });
        });

        // コマンドボタン
        document.querySelectorAll('#command-menu .cmd-btn').forEach(btn => {
            btn.addEventListener('click', (e) => e.preventDefault());
        });
        if (this.dom.storyRegionCards) {
            this.dom.storyRegionCards.forEach(card => card.onclick = null);
        }
        if (this.dom.storyRegionBackBtn) {
            this.dom.storyRegionBackBtn.onclick = () => {
                this.audio.playSe('select');
                this.showModeSelectScreen();
            };
        }
        if (this.dom.storyStageBackBtn) {
            this.dom.storyStageBackBtn.onclick = () => {
                this.audio.playSe('select');
                this.showStoryRegionSelectScreen();
            };
        }

        if (this.dom.getStageConfirmBtn) this.dom.getStageConfirmBtn.onclick = () => this.confirmGetStageReward();
        if (this.dom.getStageCancelBtn) this.dom.getStageCancelBtn.onclick = () => this.closeGetStageModal();

        if (this.dom.trainerBattleStartBtn) this.dom.trainerBattleStartBtn.onclick = () => this.startTrainerBattle();
        if (this.dom.trainerBattleCancelBtn) this.dom.trainerBattleCancelBtn.onclick = () => this.closeTrainerBattleModal();

        if (this.dom.pokemonBoxBtn) {
            this.dom.pokemonBoxBtn.onclick = () => this.openPokemonBoxOverlay();
        }
        if (this.dom.storyPokemonBoxCloseBtn) {
            this.dom.storyPokemonBoxCloseBtn.onclick = () => this.closePokemonBoxOverlay();
        }
        const sortBtn = document.getElementById('story-box-sort-btn');
        if (sortBtn) {
            sortBtn.onclick = () => this.toggleStoryBoxSortMode();
        }
        const organizeBtn = document.getElementById('story-box-organize-btn');
        if (organizeBtn) {
            organizeBtn.onclick = () => this.toggleStoryBoxOrganizeMode();
        }
        if (this.dom.storyPokemonBoxOverlay) {
            this.dom.storyPokemonBoxOverlay.addEventListener('click', (e) => {
                if (e.target === this.dom.storyPokemonBoxOverlay) this.closePokemonBoxOverlay();
            });
        }
        const searchInput = document.getElementById('story-box-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.storyBoxSearchQuery = e.target.value.trim().toLowerCase();
                this.storyBoxPage = 1;
                this.renderStoryPokemonBox();
            });
        }

        // Pokemon Action Modal
        const pokemonActionToParty = document.getElementById('pokemon-action-to-party');
        const pokemonActionMoveConfig = document.getElementById('pokemon-action-move-config');
        const pokemonActionRename = document.getElementById('pokemon-action-rename');
        const pokemonActionRelease = document.getElementById('pokemon-action-release');
        const pokemonActionCancel = document.getElementById('pokemon-action-cancel');
        const pokemonActionModal = document.getElementById('pokemon-action-modal');

        if (pokemonActionToParty) pokemonActionToParty.onclick = () => this.handlePokemonActionToParty();
        if (pokemonActionMoveConfig) pokemonActionMoveConfig.onclick = () => this.handlePokemonActionMoveConfig();
        if (pokemonActionRename) pokemonActionRename.onclick = () => this.handlePokemonActionRename();
        if (pokemonActionRelease) pokemonActionRelease.onclick = () => this.handlePokemonActionRelease();
        if (pokemonActionCancel) pokemonActionCancel.onclick = () => this.closePokemonActionModal();
        if (pokemonActionModal) {
            pokemonActionModal.addEventListener('click', (e) => {
                if (e.target === pokemonActionModal) this.closePokemonActionModal();
            });
        }

        // System Modal
        if (this.dom.systemModalOkBtn) {
            this.dom.systemModalOkBtn.onclick = () => this.handleSystemModalResolve(true);
            if (this.dom.systemModalCancelBtn) {
                this.dom.systemModalCancelBtn.onclick = () => this.handleSystemModalResolve(false);
            }

            // Global Enter key for System Modal
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && this.dom.systemMessageModal && !this.dom.systemMessageModal.classList.contains('hidden')) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleSystemModalResolve(true);
                }
            });
        }
    },

    systemModalResolver: null,

    showSystemMessage(message, title = 'お知らせ') {
        return new Promise(resolve => {
            if (!this.dom.systemMessageModal) {
                alert(message);
                resolve();
                return;
            }
            this.dom.systemModalTitle.textContent = title;
            this.dom.systemModalMessage.textContent = message;
            this.dom.systemModalInputContainer.classList.add('hidden');
            this.dom.systemModalCancelBtn.classList.add('hidden');
            this.dom.systemModalOkBtn.textContent = 'Enter';
            this.dom.systemMessageModal.classList.remove('hidden');

            this.systemModalResolver = (result) => {
                this.closeSystemModal();
                resolve();
            };
        });
    },

    showSystemConfirm(message, title = '確認') {
        return new Promise(resolve => {
            if (!this.dom.systemMessageModal) {
                resolve(confirm(message));
                return;
            }
            this.dom.systemModalTitle.textContent = title;
            this.dom.systemModalMessage.textContent = message;
            this.dom.systemModalInputContainer.classList.add('hidden');
            this.dom.systemModalCancelBtn.classList.remove('hidden');
            this.dom.systemModalOkBtn.textContent = 'Enter';
            this.dom.systemMessageModal.classList.remove('hidden');

            this.systemModalResolver = (result) => {
                this.closeSystemModal();
                resolve(result);
            };
        });
    },

    showSystemPrompt(message, defaultValue = '', title = '入力') {
        return new Promise(resolve => {
            if (!this.dom.systemMessageModal) {
                resolve(prompt(message, defaultValue));
                return;
            }
            this.dom.systemModalTitle.textContent = title;
            this.dom.systemModalMessage.textContent = message;
            this.dom.systemModalInputContainer.classList.remove('hidden');
            if (this.dom.systemModalInput) {
                this.dom.systemModalInput.value = defaultValue;
                setTimeout(() => this.dom.systemModalInput.focus(), 50);
            }
            this.dom.systemModalCancelBtn.classList.remove('hidden');
            this.dom.systemModalOkBtn.textContent = 'Enter';
            this.dom.systemMessageModal.classList.remove('hidden');

            this.systemModalResolver = (result) => {
                const value = result ? (this.dom.systemModalInput ? this.dom.systemModalInput.value : '') : null;
                this.closeSystemModal();
                resolve(value);
            };
        });
    },

    closeSystemModal() {
        if (this.dom.systemMessageModal) {
            this.dom.systemMessageModal.classList.add('hidden');
        }
        this.systemModalResolver = null;
    },

    handleSystemModalResolve(result) {
        if (this.systemModalResolver) {
            this.systemModalResolver(result);
        }
    },

    handleMuteButtonClick() {
        if (!this.audio) return;
        const isMuted = this.audio.toggleMute();
        this.updateMuteButtonState(isMuted);
        this.saveAudioPreferences(isMuted);
    },

    updateMuteButtonState(isMuted) {
        const btn = this.dom.muteBtn;
        if (!btn) return;
        const icon = this.dom.muteIcon;
        if (icon) icon.textContent = isMuted ? '🔇' : '🔊';
        btn.setAttribute('aria-pressed', isMuted ? 'true' : 'false');
        btn.title = isMuted ? '音声をオンにする' : '音声をミュート';
    },

    loadAudioPreferences() {
        if (!this.audio) return;
        let isMuted = false;
        try {
            const raw = localStorage.getItem(this.audioSettingsStorageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                isMuted = Boolean(parsed.isMuted);
            }
        } catch (err) {
            console.error('音声設定の読み込みに失敗しました', err);
        }
        if (typeof this.audio.setMuteState === 'function') {
            this.audio.setMuteState(isMuted);
        } else {
            this.audio.isMuted = isMuted;
            this.audio.updateVolume();
        }
        this.updateMuteButtonState(isMuted);
    },

    saveAudioPreferences(isMuted) {
        try {
            localStorage.setItem(this.audioSettingsStorageKey, JSON.stringify({ isMuted: Boolean(isMuted) }));
        } catch (err) {
            console.error('音声設定の保存に失敗しました', err);
        }
    },

    showStartScreen() {
        this.hideAllScreens();
        this.dom.titleScreen.classList.remove('hidden');
        this.dom.startPanel.classList.remove('hidden');
        this.screenHistory = [];
    },

    showSaveSelectScreen(logHistory = true) {
        this.hideAllScreens();
        if (this.dom.titleScreen) this.dom.titleScreen.classList.remove('hidden');
        if (this.dom.saveSelectScreen) this.dom.saveSelectScreen.classList.remove('hidden');
        if (this.dom.saveSlotGrid) this.renderSaveSlots(this.saveManager.loadAll());
        if (logHistory) this.recordScreen('save-select');
    },

    formatTimestamp(value) {
        if (!value) return 'まだ なし';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '不明なひづけ';
        return new Intl.DateTimeFormat('ja-JP', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    },

    formatPlayTime(seconds = 0) {
        const total = Math.max(0, Number(seconds) || 0);
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const secs = total % 60;
        if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
        if (minutes > 0) return `${minutes}m ${secs}s`;
        return `${secs}s`;
    },

    renderSaveSlots(saveData = {}) {
        if (!this.dom.saveSlotGrid) return;
        const slots = saveData.slots || {};
        const lastUsed = saveData.lastUsedSlot || this.currentSlotId || '1';
        const entries = Object.entries(slots);
        if (!entries.length) {
            this.dom.saveSlotGrid.innerHTML = '<p class="text-center text-slate-500">セーブデータが みつかりません</p>';
            return;
        }

        this.dom.saveSlotGrid.innerHTML = entries.map(([id, slot]) => {
            const playerName = slot.playerName || 'プレイヤー';
            const lastPlayed = slot.lastPlayed ? this.formatTimestamp(slot.lastPlayed) : 'まだ なし';
            const cleared = (slot.clearedStages || []).length;
            const defeated = (slot.defeatedPokemonIds || []).length;
            const captured = (slot.ownedPokemonData || slot.storyOwnedPokemonDetails || []).length || (slot.capturedPokemonIds || []).length;
            const customCount = (slot.customParties || []).length;
            const playTime = this.formatPlayTime(slot.playTime || 0);
            const isCurrent = this.currentSlotId === id;
            const isLastUsed = lastUsed === id;
            const badge = isLastUsed
                ? '<span class="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">さいごに あそんだ</span>'
                : '';
            const cardBorder = isCurrent ? 'ring-2 ring-blue-200 border-blue-500' : 'border-slate-200';
            const activeClass = isCurrent ? 'active' : '';
            const isEmptySlot = this.isSlotEmpty(slot);
            const displayName = isEmptySlot ? 'データなし (はじめから)' : playerName;
            const helperText = isEmptySlot
                ? '<p class="text-[11px] text-emerald-600">なまえを きめて いちから スタート！</p>'
                : '<p class="text-[11px] text-slate-400">クリックすると このスロットを つかい、 モード選択へ すすみます。</p>';
            return `
                <div class="save-slot-card ${activeClass} relative w-full text-left rounded-3xl border ${cardBorder} bg-white p-4 shadow-sm transition hover:shadow-lg" data-slot-id="${id}">
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2 text-sm text-slate-500">
                            <span class="font-semibold text-slate-800">セーブスロット ${id}</span>
                            <button type="button" class="save-slot-icon-btn" data-slot-id="${id}" aria-label="スロット ${id} のデータを消去">🗑️</button>
                        </div>
                        ${badge}
                    </div>
                    <div class="text-xl font-bold text-slate-900 mb-1 truncate">${displayName}</div>
                    <p class="text-[11px] text-slate-500 mb-2">
                        <span class="font-semibold text-slate-700">たおした</span> ${defeated} ひき<br>
                        <span class="font-semibold text-slate-700">つかまえた</span> ${captured} ひき
                    </p>
                    <div class="grid grid-cols-1 gap-2 text-[12px] text-slate-500">
                        <div><span class="font-semibold text-slate-700">さいご:</span> ${lastPlayed}</div>
                        <div><span class="font-semibold text-slate-700">クリアステージ</span><br>${cleared} かい</div>
                        <div><span class="font-semibold text-slate-700">プレイタイム</span><br>${playTime}</div>
                        <div><span class="font-semibold text-slate-700">じぶん設定</span><br>${customCount} せっと</div>
                    </div>
                    ${helperText}
                </div>
            `;
        }).join('');

        const slotsMap = slots;
        this.dom.saveSlotGrid.querySelectorAll('.save-slot-card').forEach(card => {
            const slotId = card.dataset.slotId;
            card.addEventListener('click', () => this.handleSaveSlotSelect(slotId, slotsMap[slotId]));
        });
        this.dom.saveSlotGrid.querySelectorAll('.save-slot-icon-btn').forEach(btn => {
            const slotId = btn.dataset.slotId;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleSlotDelete(slotId);
            });
        });
    },

    handleSaveSlotSelect(slotId, slotData = {}) {
        if (!slotId) return;
        this.currentSlotId = slotId;
        this.defeatedPokemonIds = new Set(slotData.defeatedPokemonIds || []);
        this.capturedPokemonIds = new Set(slotData.capturedPokemonIds || []);
        this.battleDefeatedPokemonIds = new Set(slotData.battleDefeatedPokemonIds || []);
        this.battleCapturedPokemonIds = new Set(slotData.battleCapturedPokemonIds || []);

        // 以前のセーブデータ(混在していたデータ)からの移行措置として、
        // バトル側の記録が空で、かつ通常記録がある場合はコピーする
        if (this.battleDefeatedPokemonIds.size === 0 && this.defeatedPokemonIds.size > 0) {
            this.battleDefeatedPokemonIds = new Set(this.defeatedPokemonIds);
        }
        if (this.battleCapturedPokemonIds.size === 0 && this.capturedPokemonIds.size > 0) {
            this.battleCapturedPokemonIds = new Set(this.capturedPokemonIds);
        }
        this.storyItems = new Set(slotData.storyItems || []);
        this.clearedStages = new Set(slotData.clearedStages || []);

        // Pokemonデータの復元 (UUID対応)
        // 旧データ(ownedPokemonIds/storyOwnedPokemonDetails)からの移行も考慮
        let rawOwnedData = slotData.ownedPokemonData || [];

        // 旧形式(IDリスト)からの移行またはバックアップ
        if (!rawOwnedData.length && slotData.ownedPokemonIds) {
            rawOwnedData = slotData.ownedPokemonIds.map(id => ({ id, level: 5 }));
        }
        // 旧形式(詳細リスト)からの移行
        if (!rawOwnedData.length && slotData.storyOwnedPokemonDetails) {
            rawOwnedData = slotData.storyOwnedPokemonDetails.map(pk => ({
                id: String(pk['図鑑No'] || pk.id),
                level: pk['獲得レベル'] || pk.level || 5,
                exp: pk.exp,
                nickname: pk.nickname,
                uuid: pk.uuid
            }));
        }

        this.storyOwnedPokemonDetails = rawOwnedData
            .map(data => {
                const pokemon = this.loader.getPokemonDetails(data.id);
                if (!pokemon) return null;
                return {
                    ...pokemon,
                    '獲得レベル': data.level || 5,
                    exp: data.exp || ExpTable.getExpForLevel(data.level || 5),
                    uuid: data.uuid || this.generateUUID(), // UUIDがなければ生成
                    nickname: data.nickname || '',
                    selectedMoves: data.selectedMoves || [] // 技構成を復元
                };
            })
            .filter(Boolean);

        // バトルモードでゲットしたポケモンがストーリーに入り込んでしまった既存データの修正措置
        // capturedPokemonIds (ストーリー入手フラグ) にないポケモンは除外する
        // バトルモードでゲットしたポケモンがストーリーに入り込んでしまった既存データの修正措置として
        // 以前は capturedPokemonIds にないポケモンを除外していましたが、
        // 逆に「所持しているなら捕獲済み扱いにする」ことで消失を防ぐように変更します。
        this.storyOwnedPokemonDetails.forEach(pk => {
            const id = String(pk['図鑑No']);
            this.capturedPokemonIds.add(id);
        });

        // パーティの復元: IDのリストからUUIDのリストへ
        // 注: 旧データはDexNoが入っている可能性があるため、UUIDに変換が必要
        this.storyPartySlots = (slotData.currentParty || []).map(slotId => {
            if (!slotId) return null;
            // すでにUUIDならそのまま
            if (this.storyOwnedPokemonDetails.some(pk => pk.uuid === slotId)) return slotId;
            // DexNoなら、持っているその種類のポケモン(未割り当て)を探す
            // 簡易的に先頭の同種ポケモンを割り当てる（重複時の厳密な復元は困難だが、移行時のみの問題）
            const found = this.storyOwnedPokemonDetails.find(pk => String(pk['図鑑No']) === String(slotId));
            return found ? found.uuid : null;
        });
        while (this.storyPartySlots.length < 6) this.storyPartySlots.push(null);

        this.setActiveSlotFromData(slotData);
        if (this.isSlotEmpty(slotData)) {
            this.pendingSlotForName = slotId;
            this.openNameInputModal();
            return;
        }
        this.updateStoryBoxSlots();
        this.updatePokemonBoxButtonState();
        this.audio.playSe('select');
        this.renderSaveSlots(this.saveManager.loadAll());
        this.showModeSelectScreen();
    },

    generateUUID() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    },



    async handleSlotDelete(slotId) {
        if (!slotId) return;
        const confirmed = await this.showSystemConfirm('このスロットのデータを ほんとうに けしても いいですか？', '警告');
        if (!confirmed) return;

        this.saveManager.deleteSlot(slotId);
        if (this.currentSlotId === slotId) {
            this.currentSlotId = '1';
            this.defeatedPokemonIds.clear();
            this.capturedPokemonIds.clear();
            if (this.battleDefeatedPokemonIds) this.battleDefeatedPokemonIds.clear();
            if (this.battleCapturedPokemonIds) this.battleCapturedPokemonIds.clear();
            this.storyItems.clear();
            this.clearedStages.clear();
            this.resetStoryCapturedCollections();
            this.storyOwnedPokemonDetails = [];

            // リセット後の状態を反映
            this.setActiveSlotFromData({ playerName: 'プレイヤー', playTime: 0 });
        }
        this.renderSaveSlots(this.saveManager.loadAll());
    },

    isSlotEmpty(slot = {}) {
        if (!slot) return true;
        const hasProgress = slot.lastPlayed ||
            (slot.clearedStages && slot.clearedStages.length > 0) ||
            (slot.defeatedPokemonIds && slot.defeatedPokemonIds.length > 0) ||
            (slot.customParties && slot.customParties.length > 0) ||
            (slot.playTime && slot.playTime > 0);
        return !hasProgress;
    },

    setActiveSlotFromData(slotData = {}) {
        this.playerName = slotData.playerName || 'プレイヤー';
        this.accumulatedPlayTime = slotData.playTime || 0;
    },

    openNameInputModal() {
        if (!this.dom.nameInputModal) return;
        if (this.dom.nameInputField) {
            this.dom.nameInputField.value = '';
            setTimeout(() => this.dom.nameInputField.focus(), 60);
        }
        this.dom.nameInputModal.classList.remove('hidden');
    },

    hideNameInputModal() {
        if (!this.dom.nameInputModal) return;
        this.dom.nameInputModal.classList.add('hidden');
        this.pendingSlotForName = null;
    },

    handleNameInputConfirm() {
        const slotId = this.pendingSlotForName;
        if (!slotId) {
            this.hideNameInputModal();
            return;
        }
        const value = this.dom.nameInputField?.value.trim();
        if (!value) {
            this.dom.nameInputField?.focus();
            return;
        }
        const now = Date.now();
        const slotPayload = {
            playerName: value,
            lastPlayed: now,
            clearedStages: [],
            defeatedPokemonIds: [],
            customParties: [],
            currentParty: [],
            playTime: 0,
            storyItems: []
        };
        this.saveManager.saveSlot(slotId, slotPayload);
        this.setActiveSlotFromData({ playerName: value, playTime: 0 });
        this.currentSlotId = slotId;
        this.hideNameInputModal();
        this.audio.playSe('select');
        this.renderSaveSlots(this.saveManager.loadAll());
        this.showModeSelectScreen();
    },

    handleSaveToFile() {
        try {
            this.saveManager.saveSlot(this.currentSlotId, {
                defeatedPokemonIds: Array.from(this.defeatedPokemonIds),
                capturedPokemonIds: Array.from(this.capturedPokemonIds),
                clearedStages: Array.from(this.clearedStages),
                storyItems: Array.from(this.storyItems),
                lastPlayed: Date.now()
            });
            this.saveManager.saveToFile(this.currentSlotId);
        } catch (err) {
            this.showSystemMessage(err.message || 'ファイルへのセーブに しっぱいしました。', 'エラー');
            console.error(err);
        }
    },

    handleImportFileChange(event) {
        const file = event?.target?.files?.[0];
        if (this.dom.saveFileInput) this.dom.saveFileInput.value = '';
        if (!file) return;
        this.saveManager.loadFromFile(file)
            .then(result => {
                this.pendingImport = result;
                const summary = result?.sourceSlotData;
                if (summary && this.dom.importDataSummary) {
                    const badges = (summary.clearedStages || []).length;
                    this.dom.importDataSummary.textContent = `読み込んだデータ（名前: ${summary.playerName} / バッジ: ${badges}個）`;
                }
                this.showImportTargetModal();
            })
            .catch(err => {
                this.showSystemMessage(err.message || 'ファイルの 読みこみに しっぱいしました。', 'エラー');
                console.error(err);
            });
    },

    showImportTargetModal() {
        if (!this.dom.importTargetModal) return;
        this.dom.importTargetModal.classList.remove('hidden');
    },

    hideImportTargetModal() {
        if (!this.dom.importTargetModal) return;
        this.dom.importTargetModal.classList.add('hidden');
    },

    cancelImport() {
        this.hideImportTargetModal();
        this.pendingImport = null;
    },

    handleImportTargetSelect(slotId) {
        if (!slotId || !this.pendingImport) return;
        const data = this.pendingImport.sourceSlotData;
        if (!data) return;
        this.saveManager.saveSlot(slotId, {
            ...data,
            lastPlayed: Date.now()
        });
        this.hideImportTargetModal();
        this.pendingImport = null;
        window.location.reload();
    },

    handleGameStart() {
        this.audio.playSe('select');
        this.audio.playBgm('title');
        this.dom.startPanel.classList.add('hidden');
        this.showSaveSelectScreen();
    },

    handleModeSelect(mode) {
        this.currentMode = mode;
        this.audio.playSe('select');
        if (mode === 'STORY') this.showStoryRegionSelectScreen();
        else if (mode === 'BATTLE') this.showPartySelectScreen();
    },



    buildStoryStageTiles() {
        const regionDef = STORY_REGIONS[this.storyRegion] || STORY_REGIONS.DEFAULT;
        const allStages = this.loader.stageList || [];
        const stageIds = regionDef.stageIds || allStages.map(stage => stage.id);
        return stageIds.map((id, index) => {
            const found = allStages.find(stage => stage.id === id);
            if (!found) return null;
            const prevStageId = stageIds[index - 1];
            const isLocked = index > 0 && prevStageId && !this.clearedStages.has(prevStageId);
            return {
                ...found,
                isLocked,
                previewText: index === 0 ? 'stage01' : ''
            };
        }).filter(Boolean);
    },

    showPartySelectScreen(logHistory = true) {
        this.hideAllScreens();
        this.dom.partySelectScreen.classList.remove('hidden');
        this.renderPartySelect();
        if (logHistory) this.recordScreen('party-select');
    },

    showStoryRegionSelectScreen(logHistory = true) {
        this.storyManager.showStoryRegionSelectScreen(logHistory);
    },

    resetStoryCapturedCollections() {
        this.storyOwnedPokemonDetails = [];
        this.storyPartySlots = Array.from({ length: 6 }, () => null);
        this.storyBoxSlots = [];
        this.storyPokemonBoxSelection = null;
        this.storyPartyInitialized = false;
        this.storyBoxViewActive = false;
        this.storyCapturedPokemonIds.clear();
    },

    showStoryStageScreen(stages = []) {
        this.storyManager.showStoryStageScreen(stages);
    },

    handleStoryStageSelect(stageId, { openModal = true } = {}) {
        this.storyManager.handleStoryStageSelect(stageId, { openModal });
    },

    renderStoryStages(stages = []) {
        this.storyManager.renderStoryStages(stages);
    },

    saveStoryProgress() {
        this.saveManager.saveSlot(this.currentSlotId, {
            clearedStages: Array.from(this.clearedStages),
            defeatedPokemonIds: Array.from(this.defeatedPokemonIds),
            capturedPokemonIds: Array.from(this.capturedPokemonIds),
            battleDefeatedPokemonIds: Array.from(this.battleDefeatedPokemonIds || []),
            battleCapturedPokemonIds: Array.from(this.battleCapturedPokemonIds || []),
            storyItems: Array.from(this.storyItems),
            lastPlayed: Date.now(),
            ownedPokemonData: this.storyOwnedPokemonDetails.map(pk => ({
                uuid: pk.uuid,
                id: pk['図鑑No'],
                level: pk['獲得レベル'] || pk.level,
                exp: pk.exp,
                nickname: pk.nickname
            })),
            currentParty: this.storyPartySlots
        });
    },

    updateGetStageButtonState() {
        const btn = this.dom.getStageBtn;
        if (!btn) return;
        const reward = this.getStageModalData;
        const stage = this.storyManager.storyStageList.find(s => s.id === this.storySelectedStageId);
        const hasReward = Boolean(reward && reward.rewardSlots && reward.rewardSlots.length);
        const unlocked = stage && !stage.isLocked;
        const alreadyClaimed = reward && this.hasCollectedStage(reward.stageId);
        const canCollect = hasReward && unlocked && !alreadyClaimed;
        btn.disabled = !canCollect;
        btn.classList.toggle('story-stage-action-btn--disabled', !canCollect);
    },

    updateGetStageModalContent() {
        const data = this.getStageModalData;
        if (!data || !this.dom.getStageModal) return;
        this.dom.getStageTitle.textContent = data.stageName || 'GETステージ';
        this.dom.getStageDescription.textContent = data.stageName ? `${data.stageName} の ほうび` : 'ステージの ほうびを うけとります。';
        const instructions = data.getMode === 'ONE'
            ? '複数あるなかから ひとつ えらびます。'
            : 'ぜんぶ うけとります。';
        this.dom.getStageInstructions.textContent = instructions;
        this.dom.getStageTypeLabel.textContent = data.getMode;
        this.dom.getStageConfirmBtn.disabled = !data.rewardSlots.length;
        this.renderGetStageRewards();
    },

    renderGetStageRewards() {
        const data = this.getStageModalData;
        if (!data || !this.dom.getStageRewardList) return;
        if (!data.rewardSlots.length) {
            this.dom.getStageRewardList.innerHTML = '<p class="text-sm text-slate-500">ほうびは まだ ありません。</p>';
            return;
        }
        if (data.getMode === 'ONE') {
            const html = data.rewardSlots.map((slot, idx) => {
                const selected = this.selectedGetStageRewardIndex === idx;
                const level = slot.level ? `Lv.${slot.level}` : '';
                return `
                    <button type="button" class="get-stage-reward-option${selected ? ' selected' : ''}" data-index="${idx}">
                        <span class="get-stage-reward-type">${slot.type === 'POKEMON' ? 'ポケモン' : 'どうぐ'}</span>
                        <span class="get-stage-reward-name">${slot.name}</span>
                        <span class="text-xs text-slate-500">${level}</span>
                    </button>
                `;
            }).join('');
            this.dom.getStageRewardList.innerHTML = html;
            const buttons = this.dom.getStageRewardList.querySelectorAll('.get-stage-reward-option');
            buttons.forEach(button => {
                button.onclick = () => {
                    this.selectedGetStageRewardIndex = Number(button.dataset.index);
                    this.renderGetStageRewards();
                };
            });
        } else {
            const html = data.rewardSlots.map(slot => {
                const level = slot.level ? `Lv.${slot.level}` : '';
                return `
                    <div class="get-stage-reward-summary">
                        <span class="get-stage-reward-type">${slot.type === 'POKEMON' ? 'ポケモン' : 'どうぐ'}</span>
                        <span class="get-stage-reward-name">${slot.name}</span>
                        <span class="text-xs text-slate-500">${level}</span>
                    </div>
                `;
            }).join('');
            this.dom.getStageRewardList.innerHTML = html;
        }
    },

    handleGetStageButtonClick() {
        const reward = this.getStageModalData;
        if (!reward) return;
        this.selectedGetStageRewardIndex = reward.getMode === 'ONE' ? 0 : null;
        this.updateGetStageModalContent();
        this.showFloatingModal(this.dom.getStageModal);
    },

    closeGetStageModal() {
        if (!this.dom.getStageModal) return;
        this.hideFloatingModal(this.dom.getStageModal);
        this.getStageModalData = this.getStageModalData; // keep selection
    },

    confirmGetStageReward() {
        const reward = this.getStageModalData;
        if (!reward || !reward.rewardSlots.length) return;
        const slots = reward.getMode === 'ONE'
            ? [reward.rewardSlots[this.selectedGetStageRewardIndex ?? 0] || reward.rewardSlots[0]]
            : reward.rewardSlots;
        slots.forEach(slot => this.applyGetStageReward(slot));
        this.storyItems.add(reward.stageId);
        this.clearedStages.add(reward.stageId);

        // ボックスを更新（ポケモン情報を反映）
        this.updateStoryBoxSlots();
        this.updatePokemonBoxButtonState();

        // セーブ（ポケモン情報を含む）
        this.saveStoryProgress();

        alert(`ステージ ${reward.stageName} の ほうびを うけとった！`);
        this.closeGetStageModal();
        this.updateGetStageButtonState();

        // ステージ一覧を再描画してアンロック状態を反映
        this.storyManager.refreshStoryStageScreen();

        // デバッグ: アンロック状態を確認
        console.log('[confirmGetStageReward] clearedStages:', Array.from(this.clearedStages));
    },

    applyGetStageReward(slot) {
        if (!slot || !slot.type) return;
        if (slot.type === 'POKEMON') {
            const pokemon = this.loader.getPokemonDetails(slot.name);
            if (pokemon) {
                // level付きでポケモンを追加
                this.addPokemonToStory(String(pokemon['図鑑No']), pokemon, slot.level || 5);
            }
        } else if (slot.type === 'ITEM') {
            alert(`${slot.name} を てにいれた！`);
        }
    },

    addPokemonToStory(pokemonId, pokemonDetails, level, nickname = null) {
        if (!pokemonId || !pokemonDetails) return;

        // capturedPokemonIds に追加 (図鑑登録用)
        this.capturedPokemonIds.add(pokemonId);

        // 重複チェックは行わず、個体として追加
        const uuid = this.generateUUID();

        this.storyOwnedPokemonDetails.push({
            ...pokemonDetails,
            '獲得レベル': level || 5,
            exp: ExpTable.getExpForLevel(level || 5),
            uuid: uuid,
            nickname: nickname || ''
        });

        // パーティに空きがあれば自動セット
        const emptySlotIndex = this.storyPartySlots.findIndex(slot => slot === null);
        if (emptySlotIndex !== -1) {
            this.storyPartySlots[emptySlotIndex] = uuid;
        }

        this.updateStoryBoxSlots();
        return uuid;
    },



    hasCollectedStage(stageId) {
        return this.storyItems.has(stageId);
    },

    showTrainerBattleModal(stageId, stage) {
        const trainerData = this.loader.getTrainerByStageId(stageId);
        if (!trainerData || !trainerData.party || !trainerData.party.length) {
            alert('トレーナー情報が みつかりません。');
            return;
        }

        this.currentTrainerData = trainerData;
        this.currentTrainerStageId = stageId;

        if (this.dom.trainerBattleTitle) {
            this.dom.trainerBattleTitle.textContent = trainerData.name || 'トレーナー';
        }
        if (this.dom.trainerBattleStageName) {
            this.dom.trainerBattleStageName.textContent = stage.name || '';
        }
        if (this.dom.trainerBattleMessage) {
            this.dom.trainerBattleMessage.textContent = `「${trainerData.message_start}」`;
        }

        if (this.dom.trainerPokemonList) {
            const pokemonHtml = trainerData.party.map(pkData => {
                const pokemon = this.loader.getPokemonDetails(pkData.name);
                if (!pokemon) return '';
                const spriteUrl = Utils.getSpriteUrl(pokemon['図鑑No']);
                return `
                    <div class="bg-white border border-slate-200 rounded-lg p-2 flex flex-col items-center">
                        <img src="${spriteUrl}" alt="${pokemon.name}" class="pixel-art h-12 w-12">
                        <span class="text-xs font-bold text-slate-700">${pokemon.name}</span>
                        <span class="text-[10px] text-slate-500">Lv.${pkData.level}</span>
                    </div>
                `;
            }).join('');
            this.dom.trainerPokemonList.innerHTML = pokemonHtml;
        }

        this.showFloatingModal(this.dom.trainerBattleModal);

        // ボタンイベントの再設定 (WILDと共用のため)
        const startBtn = document.getElementById('trainer-battle-start-btn');
        if (startBtn) {
            startBtn.onclick = () => this.startTrainerBattle();
            startBtn.textContent = 'バトルする';
        }
        // Chain Config non-display
        const chainConfig = document.getElementById('battle-chain-config');
        if (chainConfig) chainConfig.classList.add('hidden');
    },

    showWildDetailModal(stageId, stage) {
        const encounters = this.loader.getWildEncounter(stageId);
        if (!encounters || encounters.length === 0) {
            alert('このエリアには ポケモンが いないようだ……');
            return;
        }

        this.currentTrainerData = null; // トレーナーデータではない
        this.currentTrainerStageId = stageId; // ステージIDは保持（startWildBattleで使うかも）

        if (this.dom.trainerBattleTitle) {
            this.dom.trainerBattleTitle.textContent = '野生のポケモン';
        }
        if (this.dom.trainerBattleStageName) {
            this.dom.trainerBattleStageName.textContent = stage.name || '';
        }
        if (this.dom.trainerBattleMessage) {
            this.dom.trainerBattleMessage.textContent = stage.description || 'くさむらを たんさく しますか？';
        }

        // 出現率計算
        let totalRate = 0;
        encounters.forEach(e => totalRate += (parseInt(e.rate) || 0));

        if (this.dom.trainerPokemonList) {
            const pokemonHtml = encounters.map(enc => {
                const pokemon = this.loader.getPokemonDetails(enc.pokemon_name);
                if (!pokemon) return '';
                const spriteUrl = Utils.getSpriteUrl(pokemon['図鑑No']);
                const rate = parseInt(enc.rate) || 0;
                const percent = totalRate > 0 ? Math.round((rate / totalRate) * 100) : 0;

                return `
                    <div class="bg-white border border-slate-200 rounded-lg p-2 flex flex-col items-center min-w-[80px]">
                        <img src="${spriteUrl}" alt="${pokemon['名前（日本語）']}" class="pixel-art h-12 w-12 object-contain">
                        <span class="text-xs font-bold text-slate-700 mt-1">${pokemon['名前（日本語）']}</span>
                        <span class="text-[10px] text-slate-500">Lv.${enc.min_lv}-${enc.max_lv}</span>
                        <span class="text-[10px] text-blue-600 font-bold mt-1">${percent}%</span>
                    </div>
                `;
            }).join('');
            this.dom.trainerPokemonList.innerHTML = pokemonHtml;
        }

        this.showFloatingModal(this.dom.trainerBattleModal);

        const chainConfig = document.getElementById('battle-chain-config');
        if (chainConfig) {
            chainConfig.classList.remove('hidden');
            const input = document.getElementById('battle-chain-count');
            if (input) input.value = 1;
        }

        const startBtn = document.getElementById('trainer-battle-start-btn');
        if (startBtn) {
            startBtn.onclick = () => {
                const chainInput = document.getElementById('battle-chain-count');
                this.wildChainCount = chainInput ? (parseInt(chainInput.value) || 1) : 1;
                this.currentWildStage = stage; // Store stage for chain
                this.closeTrainerBattleModal();
                this.startWildBattle(stageId, stage);
            };
            startBtn.textContent = 'たんさくする';
        }
    },

    closeTrainerBattleModal() {
        if (!this.dom.trainerBattleModal) return;
        this.hideFloatingModal(this.dom.trainerBattleModal);
        this.currentTrainerData = null;
        this.currentTrainerStageId = null;
    },

    async startTrainerBattle() {
        if (!this.currentTrainerData || !this.currentTrainerStageId) return;

        const trainerData = this.currentTrainerData;
        const stageId = this.currentTrainerStageId;

        // パーティチェック (UUIDベース)
        const validPartyUuids = this.storyPartySlots.filter(uuid => uuid);
        if (validPartyUuids.length === 0) {
            alert('パーティに ポケモンが いません！');
            return;
        }

        // UUIDから実体を取得してパーティ構築
        this.currentParty = validPartyUuids.map(uuid => {
            const owned = this.storyOwnedPokemonDetails.find(pk => pk.uuid === uuid);
            if (!owned) return null;
            // BattleManager用のデータ構造に変換 (基本データ + 個体データ)
            const baseData = this.loader.getPokemonDetails(owned['図鑑No']);
            return {
                ...baseData,
                uuid: owned.uuid,
                level: owned['獲得レベル'] || 5,
                uuid: owned.uuid,
                level: owned['獲得レベル'] || 5,
                nickname: owned.nickname,
                selectedMoves: owned.selectedMoves // 技構成を引き継ぐ
            };
        }).filter(Boolean);

        if (this.currentParty.length === 0) {
            alert('バトル可能な ポケモンが いません！');
            return;
        }

        const enemyParty = trainerData.party.map(pkData => {
            const pokemon = this.loader.getPokemonDetails(pkData.name);
            if (!pokemon) return null;
            return { ...pokemon, level: pkData.level };
        }).filter(Boolean);

        if (enemyParty.length === 0) {
            alert('相手のポケモンが 見つかりません！');
            return;
        }

        this.closeTrainerBattleModal();

        this.hideAllScreens();
        this.dom.battleScreen.classList.remove('hidden');
        this.recordScreen('battle');
        this.dom.keyboard.classList.remove('translate-y-full');
        if (this.dom.keyboardColumn) this.dom.keyboardColumn.classList.remove('hidden');

        const bgmType = trainerData.stage_id && trainerData.stage_id.includes('GYM') ? 'battle_trainer' : 'battle_rival';
        this.audio.playBgm(bgmType);

        this.battle = new BattleManager(
            this.currentParty, // レベル等はすでに含まれている
            this.currentParty[0].level,
            enemyParty.map((p, idx) => ({ ...p, level: trainerData.party[idx].level })),
            trainerData.party[0].level,
            this.typing,
            this.loader.itemList,
            {
                isTrainerBattle: true,
                trainerData: trainerData
            }
        );

        this.battle.onUpdateUI = (p, e) => this.updateBattleUI(p, e);
        this.battle.onPokemonChange = (type, player, enemy) => {
            this.clearCaptureVisuals();
            this.setBattleSprite(this.dom.playerSpriteContainer, player['図鑑No'], true);
            this.setBattleSprite(this.dom.enemySpriteContainer, enemy['図鑑No'], false);
        };
        this.battle.onEffect = (effect, target) => {
            if (['attack', 'damage', 'fainted'].includes(effect)) this.triggerAnimation(effect, target);
            if (effect === 'damage') this.audio.playSe('attack');
        };
        this.battle.onMessage = (msg, type) => this.handleBattleMessage(msg, type);
        this.battle.onPhaseChange = (phase) => this.updatePhaseUI(phase);
        this.battle.onMoveSelect = (move) => this.displaySelectedMove(move);
        this.battle.onBattleEnd = (res) => {
            this.handleTrainerBattleEnd(res, stageId, trainerData);
        };
        this.battle.onEnemyDefeat = async (enemy) => {
            const id = enemy && enemy['図鑑No'];
            if (id) this.markDefeatedPokemon(id);
            // トレーナー戦: 敵レベル * 15
            const exp = (enemy.level || 5) * 15;
            await this.gainExp(exp);
        };

        this.battle.start();
    },

    async gainExp(expAmount) {
        if (!expAmount || expAmount <= 0) return;

        let levelUpDetails = [];

        // パーティ全員に経験値を付与 (学習装置仕様)
        // for loop to support await
        for (const member of this.currentParty) {
            if (!member || !member.uuid) continue;

            const ownedPk = this.storyOwnedPokemonDetails.find(pk => pk.uuid === member.uuid);
            if (!ownedPk) continue;

            if (!ownedPk.exp) ownedPk.exp = ExpTable.getExpForLevel(ownedPk['獲得レベル'] || 5);

            ownedPk.exp += expAmount;
            const oldLevel = ownedPk['獲得レベル'] || 5;
            const newLevel = ExpTable.getLevelFromExp(ownedPk.exp);

            if (newLevel > oldLevel) {
                ownedPk['獲得レベル'] = newLevel;
                const name = ownedPk.nickname || ownedPk['名前（日本語）'];

                // BattleManager連携
                if (this.battle && this.battle.party) {
                    const battleEntity = this.battle.party.find(p => p.uuid === member.uuid);
                    if (battleEntity) {
                        await this.battle.updateLevel(battleEntity, newLevel);
                    }
                }

                levelUpDetails.push(`${name} Lv.${oldLevel}→Lv.${newLevel}`);
            }
        }

        // メッセージ構築
        let msg = `手持ちの ポケモンは ${expAmount} けいけんち ふえた！`;
        if (levelUpDetails.length > 0) {
            msg += '\n' + levelUpDetails.join('\n');
        }

        // モーダル表示
        await this.showSystemMessage(msg, '経験値獲得');
    },

    handleTrainerBattleEnd(result, stageId, trainerData) {
        const win = result === 'win';
        setTimeout(async () => {
            if (win) {
                this.clearedStages.add(stageId);

                // 経験値処理 (BattleManager.onEnemyDefeat で実施済みのためここでは削除)
                // let earnedExp = 0;
                // if (trainerData && trainerData.party) {
                //    earnedExp = trainerData.party.reduce((sum, p) => sum + ((p.level || 5) * 15), 0);
                // }
                // this.gainExp(earnedExp);

                this.saveStoryProgress();
                await this.showSystemMessage(`${trainerData.name} との バトルに かった！`, 'しょうり！');

                // 進化チェック
                await this.checkAndProcessEvolution();
            } else { await this.showSystemMessage('まけちゃった... つぎは がんばろう！', 'ざんねん'); }
            this.storyManager.refreshStoryStageScreen();
        }, 1500);
    },

    startWildBattle(stageId, stage, reuseParty = false) {
        if (!stageId) return;

        // パーティチェック (UUID)
        const validPartyUuids = this.storyPartySlots.filter(uuid => uuid);
        if (validPartyUuids.length === 0) {
            alert('パーティに ポケモンが いません！');
            console.log('No party members found');
            return;
        }

        // 野生エンカウントデータの取得
        const encounters = this.loader.getWildEncounter(stageId);
        if (!encounters || encounters.length === 0) {
            alert('このエリアには ポケモンが いないようだ……');
            console.log('No encounters found for stage:', stageId);
            return;
        }

        // 確率によるポケモン決定 (reusePartyでも敵は再抽選)
        let totalRate = 0;
        encounters.forEach(e => totalRate += (parseInt(e.rate) || 0));
        let rand = Math.floor(Math.random() * totalRate);
        let selectedEncounter = encounters[0];
        for (const enc of encounters) {
            const r = parseInt(enc.rate) || 0;
            if (rand < r) {
                selectedEncounter = enc;
                break;
            }
            rand -= r;
        }

        const enemyPokemon = this.loader.getPokemonDetails(selectedEncounter.pokemon_name);
        if (!enemyPokemon) {
            console.error('Pokemon data not found:', selectedEncounter.pokemon_name);
            return;
        }

        const minLv = parseInt(selectedEncounter.min_lv) || 2;
        const maxLv = parseInt(selectedEncounter.max_lv) || 5;
        const enemyLevel = Math.floor(Math.random() * (maxLv - minLv + 1)) + minLv;

        // 味方パーティの準備
        if (!reuseParty) {
            this.currentParty = validPartyUuids.map(uuid => {
                const owned = this.storyOwnedPokemonDetails.find(pk => pk.uuid === uuid);
                if (!owned) return null;
                const baseData = this.loader.getPokemonDetails(owned['図鑑No']);
                return {
                    ...baseData,
                    uuid: owned.uuid,
                    level: owned['獲得レベル'] || 5,
                    nickname: owned.nickname,
                    selectedMoves: owned.selectedMoves // 技構成を引き継ぐ
                };
            }).filter(Boolean);
        }

        if (this.currentParty.length === 0) return;
        // HPチェック: 全員瀕死なら続行不可
        if (this.currentParty.every(p => (p.currentHp !== undefined ? p.currentHp : 999) <= 0)) {
            this.showSystemMessage('たたかえる ポケモンが いません！', 'エラー');
            this.wildChainCount = 0;
            this.storyManager.refreshStoryStageScreen();
            return;
        }

        if (this.currentParty.length === 0) return;

        // 画面遷移
        this.hideAllScreens();
        this.dom.battleScreen.classList.remove('hidden');
        this.recordScreen('battle');
        this.dom.keyboard.classList.remove('translate-y-full');
        if (this.dom.keyboardColumn) this.dom.keyboardColumn.classList.remove('hidden');

        this.audio.playBgm('battle_wild');

        // BattleManager初期化
        this.battle = new BattleManager(
            this.currentParty,
            this.currentParty[0].level,
            [{ ...enemyPokemon, level: enemyLevel }],
            enemyLevel,
            this.typing,
            this.loader.itemList,
            {
                isTrainerBattle: false,
                startMessage: `あ！ やせいの ${enemyPokemon['名前（日本語）']} が とびだしてきた！`
            }
        );

        this.setupBattleCallbacks();
        this.battle.onBattleEnd = (res) => {
            this.handleWildBattleEnd(res, stageId, enemyLevel);
        };

        this.battle.start();
    },

    setupBattleCallbacks() {
        this.battle.onUpdateUI = (p, e) => this.updateBattleUI(p, e);
        this.battle.onPokemonChange = (type, player, enemy) => {
            this.clearCaptureVisuals();
            this.setBattleSprite(this.dom.playerSpriteContainer, player['図鑑No'], true);
            this.setBattleSprite(this.dom.enemySpriteContainer, enemy['図鑑No'], false);
        };
        this.battle.onEffect = (effect, target) => {
            if (['attack', 'damage', 'fainted'].includes(effect)) this.triggerAnimation(effect, target);
            if (effect === 'damage') this.audio.playSe('attack');
            if (effect === 'ball-throw') this.triggerBallThrow();
            if (effect === 'ball-shake') this.triggerBallShake();
            if (effect === 'ball-captured') this.triggerBallCaptured();
            if (effect === 'ball-escape') this.triggerBallEscape();
        };
        this.battle.onMessage = (msg, type) => this.handleBattleMessage(msg, type);
        this.battle.onPhaseChange = (phase) => this.updatePhaseUI(phase);
        this.battle.onMoveSelect = (move) => this.displaySelectedMove(move);
        this.battle.onEnemyDefeat = async (enemy) => {
            const id = enemy && enemy['図鑑No'];
            if (id) this.markDefeatedPokemon(id);
            // 野生戦: 敵レベル * 10
            const exp = (enemy.level || 5) * 10;
            await this.gainExp(exp);
        };
        this.battle.onEnemyCapture = async (enemy) => {
            const id = enemy && enemy['図鑑No'];
            if (id) {
                this.markCapturedPokemon(id);

                const staticData = this.loader.getPokemonDetails(id);
                if (staticData) {
                    const uuid = this.addPokemonToStory(String(id), staticData, enemy.level || 5);

                    // ニックネーム確認
                    const doRename = await this.showSystemConfirm('ポケモンを つかまえた！\nニックネームを つけますか？', 'ゲット！');
                    if (doRename) {
                        await this.promptRename(uuid);
                    }
                }

                const exp = (enemy.level || 5) * 10;
                await this.gainExp(exp);
            }
        };
    },

    handleWildBattleEnd(result, stageId, enemyLevel) {
        const win = result === 'win' || result === 'catch';
        setTimeout(async () => {
            if (win) {
                // 初クリア時のみクリア扱いにするなら条件分岐、野生は何度でもクリア扱い更新でOK
                this.clearedStages.add(stageId);

                // 経験値処理 (BattleManager.onEnemyDefeat で実施済み)
                // const earnedExp = (enemyLevel || 5) * 10;
                // this.gainExp(earnedExp);

                this.saveStoryProgress();

                // 進化チェック
                await this.checkAndProcessEvolution();

                // Chain Battle Check
                this.wildChainCount = (this.wildChainCount || 1) - 1;

                // Sync HP from battle to currentParty
                if (this.battle && this.battle.party) {
                    this.battle.party.forEach(member => {
                        const original = this.currentParty.find(p => p.uuid === member.uuid);
                        if (original) {
                            original.currentHp = member.hp;
                            original.isFainted = member.hp <= 0;
                        }
                    });
                }
                const hasAlive = this.currentParty.some(p => (p.currentHp !== undefined ? p.currentHp : 999) > 0);

                if (win && this.wildChainCount > 0 && hasAlive) {
                    // Next Battle
                    setTimeout(() => {
                        this.startWildBattle(stageId, this.currentWildStage, true);
                    }, 1000);
                    return; // Skip screen refresh
                }

                this.storyManager.refreshStoryStageScreen();
            } else {
                await this.showSystemMessage('まけちゃった... つぎは がんばろう！', 'ざんねん');
                this.wildChainCount = 0; // Stop chain on loss
                this.storyManager.refreshStoryStageScreen();
            }
        }, 1500);
    },

    swapStoryPokemonSlots(source, target) {
        if (source.type === target.type && source.index === target.index) return;

        const getUuid = (t, i) => {
            if (t === 'party') return this.storyPartySlots[i];
            if (t === 'box') {
                const slot = this.storyBoxSlots[i];
                return slot ? slot.uuid : null;
            }
            return null;
        };

        const sourceUuid = getUuid(source.type, source.index);
        const targetUuid = getUuid(target.type, target.index);

        // 両方空なら何もしない
        if (!sourceUuid && !targetUuid) return;

        // 1. Party同士
        if (source.type === 'party' && target.type === 'party') {
            this.storyPartySlots[source.index] = targetUuid;
            this.storyPartySlots[target.index] = sourceUuid;
        }
        // 2. Box同士 (順序入れ替え)
        else if (source.type === 'box' && target.type === 'box') {
            if (sourceUuid && targetUuid) {
                const idx1 = this.storyOwnedPokemonDetails.findIndex(p => p.uuid === sourceUuid);
                const idx2 = this.storyOwnedPokemonDetails.findIndex(p => p.uuid === targetUuid);
                if (idx1 !== -1 && idx2 !== -1) {
                    const temp = this.storyOwnedPokemonDetails[idx1];
                    this.storyOwnedPokemonDetails[idx1] = this.storyOwnedPokemonDetails[idx2];
                    this.storyOwnedPokemonDetails[idx2] = temp;
                }
            } else if (sourceUuid && !targetUuid) {
                // 空きスロットへ移動 = 末尾へ移動
                const idx1 = this.storyOwnedPokemonDetails.findIndex(p => p.uuid === sourceUuid);
                if (idx1 !== -1) {
                    const item = this.storyOwnedPokemonDetails.splice(idx1, 1)[0];
                    this.storyOwnedPokemonDetails.push(item);
                }
            }
        }
        // 3. Party <-> Box
        else {
            const partySide = source.type === 'party' ? source : target;
            const boxSide = source.type === 'party' ? target : source;
            const pUuid = getUuid('party', partySide.index);
            const bUuid = getUuid('box', boxSide.index);

            // Partyスロットを更新 (Box側のポケモン、または空ならnull)
            this.storyPartySlots[partySide.index] = bUuid;

            // Box側のポケモンとParty側のポキモンをリスト上で入れ替えておく
            // これにより、Boxリスト再生成時に「入れ替わった位置」に古いPartyポケモンが来るようになる
            if (pUuid && bUuid) {
                const idx1 = this.storyOwnedPokemonDetails.findIndex(p => p.uuid === pUuid);
                const idx2 = this.storyOwnedPokemonDetails.findIndex(p => p.uuid === bUuid);
                if (idx1 !== -1 && idx2 !== -1) {
                    const temp = this.storyOwnedPokemonDetails[idx1];
                    this.storyOwnedPokemonDetails[idx1] = this.storyOwnedPokemonDetails[idx2];
                    this.storyOwnedPokemonDetails[idx2] = temp;
                }
            } else if (pUuid && !bUuid) {
                // PartyからBoxの空きへ: リストの末尾ではなく、現在位置でBOX入り(リスト順序維持)
                // 何もしなくてよい（自動的にBoxリストの並び順で表示される）
                // もし「ドラッグした空きスロットの位置」に入れたいなら並び替えが必要だが、
                // リスト構造上「空きスロット」は実体がないため「末尾」扱いが妥当。
                // ここでは「移動した」感を出すため、配列の最後に移動してみる
                const idx1 = this.storyOwnedPokemonDetails.findIndex(p => p.uuid === pUuid);
                if (idx1 !== -1) {
                    const item = this.storyOwnedPokemonDetails.splice(idx1, 1)[0];
                    this.storyOwnedPokemonDetails.push(item);
                }
            }
        }

        this.saveStoryProgress();
        this.updateStoryBoxSlots();

        requestAnimationFrame(() => {
            this.renderStoryPokemonParty();
            this.renderStoryPokemonBox();
        });
    },

    updateStoryBoxSlots(forcePartyReset = false) {
        // 全所持ポケモンリスト (UUID付き)
        const allOwned = this.storyOwnedPokemonDetails.map(pk => {
            const dexNo = String(pk['図鑑No']);
            return {
                uuid: pk.uuid,
                id: dexNo,
                name: pk['名前（日本語）'],
                nickname: pk.nickname || '',
                level: pk['獲得レベル'] || 5, // 表示用
                sprite: Utils.getSpriteUrl(dexNo)
            };
        });

        // パーティ初期化orリセット
        if (!this.storyPartyInitialized || forcePartyReset) {
            // 全員ボックス候補からランダムに、または先頭から詰める
            // ここでは簡単のため「所持リストの先頭から最大6匹」をパーティにする
            const partyCandidates = allOwned.slice(0, 6);
            this.storyPartySlots = Array.from({ length: 6 }, (_, i) => partyCandidates[i] ? partyCandidates[i].uuid : null);
            this.storyPartyInitialized = true;
        }

        // パーティにいるポケモンを除外してボックスリストを作成
        // storyPartySlotsには uuid が入っている前提
        const boxCandidates = allOwned.filter(pk => !this.storyPartySlots.includes(pk.uuid));

        // ボックススロット: 全件保持 (表示時にページネーション)
        this.storyBoxSlots = boxCandidates;

        // パーティスロットの整合性チェック（存在しないUUIDがあれば除去）
        this.storyPartySlots = this.storyPartySlots.map(uuid => {
            if (!uuid) return null;
            return this.storyOwnedPokemonDetails.some(pk => pk.uuid === uuid) ? uuid : null;
        });

        // 自動充填ロジックを無効化 (Drag and Dropによる自由な編成を優先)
        /*
        let emptySlotCount = this.storyPartySlots.filter(s => !s).length;
        if (emptySlotCount > 0 && boxCandidates.length > 0) {
            const availableForFill = allOwned.filter(pk => !this.storyPartySlots.includes(pk.uuid));

            this.storyPartySlots = this.storyPartySlots.map(uuid => {
                if (uuid) return uuid;
                const fill = availableForFill.shift();
                return fill ? fill.uuid : null;
            });

            const finalBoxCandidates = allOwned.filter(pk => !this.storyPartySlots.includes(pk.uuid));
            this.storyBoxSlots = finalBoxCandidates.slice(0, this.STORY_BOX_CAPACITY);
            while (this.storyBoxSlots.length < this.STORY_BOX_CAPACITY) {
                this.storyBoxSlots.push(null);
            }
        }
        */

        if (this.storyBoxViewActive) {
            this.renderStoryPokemonBox();
        }
    },

    redistributeStoryParty(availableIds = null) {
        // 何もしない（updateStoryBoxSlots内で処理統合）
        // 互換性維持のためメソッドだけ残すか、削除してもよいが
        // 呼び出し元(updateStoryBoxSlots)を書き換えたので不要になるはず
    },

    shuffleArray(list) {
        const arr = Array.from(list);
        for (let i = arr.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    },

    updatePokemonBoxButtonState() {
        if (!this.dom.pokemonBoxBtn) return;
        const hasCaptured = this.capturedPokemonIds.size > 0;
        this.dom.pokemonBoxBtn.disabled = !hasCaptured;
        if (hasCaptured) {
            this.dom.pokemonBoxBtn.classList.remove('story-stage-action-btn--disabled');
        } else {
            this.dom.pokemonBoxBtn.classList.add('story-stage-action-btn--disabled');
        }
    },

    openPokemonBoxOverlay(force = false) {
        if (!force && this.dom.pokemonBoxBtn?.disabled) return;
        this.updateStoryBoxSlots();
        this.storyPokemonBoxSelection = null;
        this.storyBoxSearchQuery = '';
        this.storyBoxOrganizeMode = false; // デフォルトはOFF
        this.storyBoxSwapSourceUuid = null; // 選択解除

        const searchInput = document.getElementById('story-box-search-input');
        if (searchInput) searchInput.value = '';

        this.updateOrganizeButtonState();

        this.renderStoryPokemonParty();
        this.renderStoryPokemonBox();
        this.showStoryBoxPanel();
    },

    closePokemonBoxOverlay() {
        this.hideStoryBoxPanel();
        this.storyPokemonBoxSelection = null;
        // Sortモード終了
        this.storyBoxSortMode = false;
        this.storyBoxSortSelection = null;
        const sortBtn = document.getElementById('story-box-sort-btn');
        if (sortBtn) sortBtn.classList.remove('active');
    },

    showStoryBoxPanel() {
        if (!this.dom.storyPokemonBoxOverlay) return;
        this.showFloatingModal(this.dom.storyPokemonBoxOverlay);
        this.storyBoxViewActive = true;
    },

    hideStoryBoxPanel() {
        if (!this.dom.storyPokemonBoxOverlay) return;
        this.hideFloatingModal(this.dom.storyPokemonBoxOverlay);
        this.storyBoxViewActive = false;
    },

    showFloatingModal(el) {
        if (!el) return;
        this.lockModalScroll();
        el.scrollTop = 0;
        el.classList.remove('hidden');
        el.setAttribute('aria-hidden', 'false');
    },

    hideFloatingModal(el) {
        if (!el) return;
        if (!el.classList.contains('hidden')) {
            el.classList.add('hidden');
        }
        el.setAttribute('aria-hidden', 'true');
        this.unlockModalScroll();
    },

    lockModalScroll() {
        if (this.modalLockCount === 0) {
            this.modalScrollPosition = window.scrollY || window.pageYOffset;
            document.body.classList.add('modal-open');
            document.body.style.position = 'relative';
            document.body.style.top = `-${this.modalScrollPosition}px`;
        }
        this.modalLockCount += 1;
    },

    unlockModalScroll() {
        if (this.modalLockCount <= 0) return;
        this.modalLockCount -= 1;
        if (this.modalLockCount === 0) {
            document.body.classList.remove('modal-open');
            document.body.style.top = '';
            const target = this.modalScrollPosition || 0;
            window.scrollTo(0, target);
        }
    },

    toggleStoryBoxSortMode() {
        const types = ['id', 'level', 'name'];
        const currentIdx = types.indexOf(this.storyBoxSortType || 'id');
        this.storyBoxSortType = types[(currentIdx + 1) % types.length];
        this.storyBoxPage = 1;
        this.renderStoryPokemonBox();

        // ソートボタンの見た目更新(簡易)
        const sortBtn = document.getElementById('story-box-sort-btn');
        if (sortBtn) {
            sortBtn.textContent = `並び替え: ${this.storyBoxSortType}`;
        }
    },

    toggleStoryBoxOrganizeMode() {
        this.storyBoxOrganizeMode = !this.storyBoxOrganizeMode;
        this.storyBoxSwapSourceUuid = null; // モード切替時に選択解除

        // 整理モード中は強制的にID順(＝ストレージ順)かつ検索なしにする
        if (this.storyBoxOrganizeMode) {
            this.storyBoxSortType = 'id';
            this.storyBoxSearchQuery = '';
            const searchInput = document.getElementById('story-box-search-input');
            if (searchInput) searchInput.value = '';

            // ソートボタンの表示も更新
            const sortBtn = document.getElementById('story-box-sort-btn');
            if (sortBtn) {
                sortBtn.textContent = `並び替え: ${this.storyBoxSortType}`;
            }
        }

        this.updateOrganizeButtonState();
        this.renderStoryPokemonBox();
        this.renderStoryPokemonParty();
    },

    updateOrganizeButtonState() {
        const btn = document.getElementById('story-box-organize-btn');
        if (!btn) return;
        if (this.storyBoxOrganizeMode) {
            btn.classList.add('bg-emerald-100', 'text-emerald-800', 'border-emerald-300');
            btn.classList.remove('bg-white', 'text-emerald-600', 'border-slate-300');
            btn.textContent = '整理中...';
        } else {
            btn.classList.remove('bg-emerald-100', 'text-emerald-800', 'border-emerald-300');
            btn.classList.add('bg-white', 'text-emerald-600', 'border-slate-300');
            btn.textContent = 'ボックス整理';
        }
    },

    /* --- Drag and Drop Handlers --- */
    handleDragStart(e, type, index) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({ type, index }));
        // ドラッグ中の見た目調整（必要なら）
    },

    handleDragOver(e) {
        if (e.preventDefault) e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        return false;
    },

    handleDrop(e, targetType, targetIndex) {
        if (e.stopPropagation) e.stopPropagation();
        e.preventDefault();

        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (data && (data.type === 'party' || data.type === 'box')) {
                this.swapStoryPokemonSlots(data, { type: targetType, index: targetIndex });
            }
        } catch (err) {
            console.error('Drop error:', err);
        }
        return false;
    },

    renderStoryPokemonParty() {
        if (!this.dom.storyPokemonParty) return;
        const html = this.storyPartySlots.map((uuid, index) => {
            const pokemon = uuid ? this.storyOwnedPokemonDetails.find(pk => pk.uuid === uuid) : null;
            const isSelected = this.storyPokemonBoxSelection?.type === 'party' && this.storyPokemonBoxSelection?.index === index;
            const isSortSelected = this.storyBoxSortMode && this.storyBoxSortSelection?.type === 'party' && this.storyBoxSortSelection?.index === index;
            const isSwapTarget = !!this.storyBoxSwapSourceUuid;
            const displayName = pokemon ? (pokemon.nickname || pokemon['名前（日本語）']) : `${index + 1}ぴきめ`;
            const level = pokemon ? `Lv.${pokemon['獲得レベル'] || 5}` : '';

            return `
                <button type="button"
                    class="story-pokemon-party-slot${!pokemon ? ' story-pokemon-party-slot-placeholder' : ''}${isSelected ? ' selected' : ''}${isSortSelected ? ' sort-selected' : ''}${isSwapTarget ? ' animate-pulse border-blue-400 border-2' : ''}${this.storyBoxSwapSourceUuid === uuid && uuid ? ' box-organize-selected' : ''}"
                    data-type="party"
                    data-index="${index}"
                    data-uuid="${uuid || ''}"
                    aria-label="${displayName}"
                    draggable="true"
                >
                    ${pokemon ? `<img src="${Utils.getSpriteUrl(pokemon['図鑑No'])}" alt="${displayName}" class="pixel-art">` : ''}
                    <div class="flex flex-col items-start leading-tight">
                        <span class="font-bold">${displayName}</span>
                        <span class="text-xs text-slate-500">${level}</span>
                    </div>
                </button>
            `;
        }).join('');
        this.dom.storyPokemonParty.innerHTML = html;
        this.dom.storyPokemonParty.querySelectorAll('button').forEach(button => {
            const index = Number(button.dataset.index);
            button.onclick = () => this.handleStoryPokemonSlotClick('party', index);

            // Drag and Drop
            button.addEventListener('dragstart', (e) => this.handleDragStart(e, 'party', index));
            button.addEventListener('dragover', (e) => this.handleDragOver(e));
            button.addEventListener('drop', (e) => this.handleDrop(e, 'party', index));
        });
    },

    renderStoryPokemonBox() {
        if (!this.dom.storyPokemonBoxGrid) return;

        // 1. ラッピング: オリジナルのインデックスを保持
        let displaySlots = this.storyBoxSlots.map((slot, index) => ({ slot, originalIndex: index }));

        // 検索フィルタ
        if (this.storyBoxSearchQuery) {
            displaySlots = displaySlots.map(wrapper => {
                const slot = wrapper.slot;
                if (!slot || !slot.uuid) return null; // 検索時は空スロットはnullに
                if (slot.uuid.toLowerCase().includes(this.storyBoxSearchQuery)) return wrapper;
                return null;
            });
            displaySlots = displaySlots.filter(Boolean); // 検索時は詰める
        }

        // ソート処理
        if (this.storyBoxSortType === 'level') {
            displaySlots.sort((a, b) => (b.slot?.level || 0) - (a.slot?.level || 0));
        } else if (this.storyBoxSortType === 'name') {
            displaySlots.sort((a, b) => (a.slot?.name || '').localeCompare((b.slot?.name || ''), 'ja'));
        } else {
            // ID (default): 
            // ストレージ順を維持したい場合はソートしない（mapで作った順序そのまま）
            // 明示的にID順にしたい場合はここでソートするが、通常はストレージ順が自然なID順に近い
            // ですが、バラバラになった後の「整理」機能としてはID順ソートがあると便利なので、
            // 「ソートなし（ストレージ順）」と「ID順ソート」は区別したほうがよいかもしれない。
            // ここでは `storyBoxSortType === 'id'` は「ポケモンID順」と解釈してソートを入れるか？
            // 以前のコードでは `displaySlots.sort((a, b) => Number(a.id) - Number(b.id));` があった。
            // ユーザー要望「整理モード中も並び替え機能は使います」に応えるなら、IDソートも有効にするべき。
            displaySlots.sort((a, b) => Number(a.slot?.id || 9999) - Number(b.slot?.id || 9999));
        }

        // 2. ページネーション処理
        const totalItems = displaySlots.length;
        const totalPages = Math.ceil(totalItems / this.ITEMS_PER_BOX_PAGE_STORY) || 1;

        // カレントページ補正
        if (this.storyBoxPage > totalPages) this.storyBoxPage = totalPages;
        if (this.storyBoxPage < 1) this.storyBoxPage = 1;

        const startIndex = (this.storyBoxPage - 1) * this.ITEMS_PER_BOX_PAGE_STORY;
        const endIndex = startIndex + this.ITEMS_PER_BOX_PAGE_STORY;
        const pageItems = displaySlots.slice(startIndex, endIndex);

        // グリッドを埋めるための空スロット追加 (24個になるように)
        // 注意: ソート/フィルタ後は「空スロット」という概念がラッパーに包まれているか、あるいは欠落している。
        // リスト表示としては空欄でパディングする。
        while (pageItems.length < this.ITEMS_PER_BOX_PAGE_STORY) {
            pageItems.push(null);
        }

        const html = pageItems.map((wrapper, i) => {
            const indexOnPage = startIndex + i; // 表示上の通し番号（今は使用しないかもだが一応）

            // wrapperがnullなら空スロット（実体なし）
            // 実体がない場所をクリックできるか？ -> Organizeモードなら「ここに入れる」ができるべきだが、
            // ソート/フィルタ済みリストの「末尾の空欄」に実体的な移動先(Storage Index)はあるのか？
            // -> ソートされている場合、末尾の空欄は「リストの表示上の余白」であり、特定のStorage Indexと紐付かない可能性が高い。
            // -> いや、オリジナルが `map` されているので、`storyBoxSlots` 内の `null` も `wrapper` として存在するはず。
            // -> `filter(Boolean)` されるのは検索時のみ。
            // -> ソート時、`null` (empty slot) はどうなる？
            // -> `(b.slot?.level || 0)` のようにアクセスすると、`slot` が null の場合どうなるか。
            // -> `null` 要素も `wrapper` を持っているはず (`{ slot: null, originalIndex: 5 }` 等)。
            // -> ならば、それらもソートされて表示されるはず。
            // -> Levelソートなら level 0 として末尾にいく？
            // -> そうすれば「空スロット」も画面上に現れ、それらは `originalIndex` を持っている。
            // -> OK。

            // ただし、検索時は `filter(Boolean)` しているので空スロットは消える。
            // 検索時は「移動先」として空スロットを選べない（結果リストに出てこないから）。
            // これは仕様として許容範囲（検索して見つけたやつを、別の検索結果と入れ替える、などは可）。

            const slot = wrapper ? wrapper.slot : null;
            const originalIndex = wrapper ? wrapper.originalIndex : -1;

            const isSelected = this.storyPokemonBoxSelection?.type === 'box' && this.storyPokemonBoxSelection?.uuid === (slot?.uuid);
            const isSortSelected = this.storyBoxSortMode && this.storyBoxSortSelection?.type === 'box' && this.storyBoxSortSelection?.uuid === (slot?.uuid);
            const hasPokemon = Boolean(slot && slot.uuid);
            const displayName = hasPokemon ? (slot.nickname || slot.name) : '';
            const level = hasPokemon ? `Lv.${slot.level}` : '';

            // Organize Mode Selection Highlight
            const isOrganizeSelected = this.storyBoxSwapSourceUuid === slot?.uuid && slot?.uuid;

            return `
                <div class="relative group">
                    <button type="button"
                        class="story-pokemon-box-slot${isSelected ? ' selected' : ''}${isSortSelected ? ' sort-selected' : ''}${!hasPokemon ? ' story-pokemon-box-slot--empty' : ''}${isOrganizeSelected ? ' box-organize-selected' : ''} w-full"
                        data-type="box"
                        data-index="${i}" 
                        data-page-offset="${startIndex}"
                        data-original-index="${originalIndex}"
                        data-uuid="${hasPokemon ? slot.uuid : ''}"
                        aria-label="${hasPokemon ? displayName : '空きスロット'}"
                        draggable="${hasPokemon}"
                    >
                        ${hasPokemon ? `<img src="${slot.sprite}" alt="${displayName}" class="pixel-art">` : ''}
                        <div class="story-pokemon-box-info flex flex-col items-center">
                            <span class="story-pokemon-box-slot-name text-xs font-bold truncate w-full text-center">${displayName}</span>
                            <span class="text-[10px] text-slate-500">${level}</span>
                        </div>
                        ${!hasPokemon ? '<span class="story-pokemon-box-slot-empty-label">empty</span>' : ''}
                    </button>
                </div>
            `;
        }).join('');
        this.dom.storyPokemonBoxGrid.innerHTML = html;

        this.renderStoryBoxPagination(totalPages);

        // イベント設定
        this.dom.storyPokemonBoxGrid.querySelectorAll('button.story-pokemon-box-slot').forEach(button => {
            const uuid = button.dataset.uuid;
            const originalIndex = Number(button.dataset.originalIndex); // 取得: オリジナルインデックス

            button.onclick = () => {
                // オリジナルインデックスを渡す
                // 注意: originalIndex が -1 (空スロットかつラッパー欠落時) の場合のハンドリングが必要だが、
                // 今回の実装では map しているので基本的に originalIndex は存在する。
                // ただし filter(Boolean) された際などは DOM に要素がないのでクリックできない。
                // ソートされた空スロットなどは originalIndex を持っている。
                this.handleStoryBoxSlotClick(uuid, originalIndex);
            };

            // Drag and Drop (Use originalIndex for source if needed, but DnD logic needs check)
            // DnD currently uses index for source. If we drag FROM sorted list, we should use originalIndex.
            // If we drag TO sorted list... handleDrop needs to handle it.
            // For now, let's fix the Organize Mode Click first.
            if (uuid) {
                // DragStart: pass originalIndex as index? 
                // handleDragStart uses {type, index}. 
                // handleDrop uses swapStoryPokemonSlots which expects storage index.
                // So YES, we should pass originalIndex here too!
                button.addEventListener('dragstart', (e) => this.handleDragStart(e, 'box', originalIndex, uuid));
            }
            button.addEventListener('dragover', (e) => this.handleDragOver(e));
            button.addEventListener('drop', (e) => this.handleDrop(e, 'box', originalIndex));
        });

        // global scope hack for inline onclick (safe enough for this scale)
        if (!window.app) window.app = this;
    },

    renderStoryBoxPagination(totalPages) {
        let container = document.getElementById('story-box-pagination');
        if (!container) {
            container = document.createElement('div');
            container.id = 'story-box-pagination';
            container.className = 'flex justify-center items-center gap-4 mt-2 py-2 border-t border-slate-100';
            this.dom.storyPokemonBoxGrid.after(container);
        }

        container.innerHTML = `
            <button type="button" class="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-50" ${this.storyBoxPage <= 1 ? 'disabled' : ''} onclick="App.changeStoryBoxPage(-1)">
                &lt; 前へ
            </button>
            <span class="text-sm font-bold text-slate-600">Page ${this.storyBoxPage} / ${totalPages}</span>
            <button type="button" class="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-50" ${this.storyBoxPage >= totalPages ? 'disabled' : ''} onclick="App.changeStoryBoxPage(1)">
                次へ &gt;
            </button>
        `;

        // Sort Control Injection
        const sortBtn = document.getElementById('story-box-sort-btn');
        if (sortBtn) {
            const typeLabels = { 'id': 'No.順', 'level': 'Lv.順', 'name': '名前順' };
            sortBtn.textContent = `並び替え: ${typeLabels[this.storyBoxSortType] || 'No.順'}`;
            sortBtn.onclick = () => this.cycleStoryBoxSort();
            sortBtn.classList.remove('active');
        }
    },

    changeStoryBoxPage(delta) {
        this.storyBoxPage += delta;
        this.renderStoryPokemonBox();
    },

    cycleStoryBoxSort() {
        const types = ['id', 'level', 'name'];
        const currentIdx = types.indexOf(this.storyBoxSortType);
        const nextIdx = (currentIdx + 1) % types.length;
        this.storyBoxSortType = types[nextIdx];
        this.audio.playSe('select');
        this.renderStoryPokemonBox();
    },

    handleStoryBoxSlotClick(uuid, displayIndex) {
        // 共通ハンドラに委譲 (Box Organize Mode等のロジックを一元化するため)
        const itemsPerPage = this.ITEMS_PER_BOX_PAGE_STORY || 24;
        // displayIndexは通し番号(pageOffset + indexOnPage)なので、
        // handleStoryPokemonSlotClick が期待する index (通し番号) と一致するはず
        // ただし handleStoryPokemonSlotClick の現在の実装では、
        // boxの場合: index(ページ内) を期待している箇所と、通し番号を期待している箇所が混在している可能性があるため確認が必要。
        // -> 確認した結果:
        // handleStoryPokemonSlotClick(type, index) 内で:
        // if (type === 'box') {
        //    const pageOffset = (this.storyBoxPage - 1) * this.STORY_BOX_PAGE_SIZE;
        //    return this.storyBoxSlots[i + pageOffset]?.uuid;
        // }
        // となっているので、引数 `index` は "ページ内インデックス" であるべき。

        // しかし displayIndex は "通し番号" (pageOffset + indexOnPage) として渡されている (renderStoryPokemonBox参照)。
        // したがって、ページ内インデックスに戻す必要がある。

        const pageOffset = (this.storyBoxPage - 1) * (this.STORY_BOX_PAGE_SIZE || 24);
        const indexInPage = displayIndex - pageOffset;

        this.handleStoryPokemonSlotClick('box', indexInPage);
    },

    /* --- promptRename (skipped) --- */
    promptRename(uuid) {
        if (!uuid) return;
        const pokemon = this.storyOwnedPokemonDetails.find(pk => pk.uuid === uuid);
        if (!pokemon) return;

        const newName = prompt(`${pokemon['名前（日本語）']} の ニックネームを いれてください`, pokemon.nickname || '');
        if (newName !== null) {
            pokemon.nickname = newName.trim();
            this.saveStoryProgress();
            this.updateStoryBoxSlots();
            this.renderStoryPokemonParty(); // 名前反映のため
        }
    },

    promptRelease(uuid) {
        if (!uuid) return;
        const pokemon = this.storyOwnedPokemonDetails.find(pk => pk.uuid === uuid);
        if (!pokemon) return;

        if (confirm(`${pokemon.nickname || pokemon['名前（日本語）']} を ほんとうに にがしますか？\n（にがした ポケモンは もどりません！）`)) {
            // リストから削除
            this.storyOwnedPokemonDetails = this.storyOwnedPokemonDetails.filter(pk => pk.uuid !== uuid);

            // Partyにいた場合も消える(updateStoryBoxSlotsで処理されるが念のためPartyスロットもnull化)
            const partyIndex = this.storyPartySlots.indexOf(uuid);
            if (partyIndex !== -1) {
                this.storyPartySlots[partyIndex] = null;
            }

            this.saveStoryProgress();
            this.updateStoryBoxSlots();
            this.renderStoryPokemonParty();
            this.renderStoryPokemonBox();
            alert(`${pokemon.nickname || pokemon['名前（日本語）']} は 野生に かえっていきました... バイバイ！`);
        }
    },

    openStoryPokemonMoveConfig(uuid) {
        if (!uuid) return;
        const pokemon = this.storyOwnedPokemonDetails.find(pk => pk.uuid === uuid);
        if (!pokemon) return;

        const baseData = this.loader.getPokemonDetails(pokemon['図鑑No']);
        if (!baseData || !baseData.moves) {
            alert('この ポケモンの わざデータが みつかりません。');
            return;
        }

        const tempPokemon = {
            ...baseData,
            level: pokemon['獲得レベル'] || 5,
            // 既存の技がなければ初期化
            selectedMoves: pokemon.selectedMoves || [],
            uuid: pokemon.uuid
        };

        if (!tempPokemon.selectedMoves || tempPokemon.selectedMoves.length === 0) {
            const availableMoves = baseData.moves.filter(m => {
                const route = m['経路'] || '';
                const reqLevel = m['習得レベル'] || 1;
                return (route.includes('レベルアップ') || route.includes('初期')) && reqLevel <= tempPokemon.level;
            }).filter(m => m['分類'] !== 'へんか');

            tempPokemon.selectedMoves = availableMoves.slice(-4);
        }

        this.storyMoveConfigContext = {
            pokemon: pokemon,
            previousScreen: this.storyBoxViewActive ? 'story-box' : 'story-stage'
        };

        // UIが重なるのでボックスを閉じる
        if (this.storyBoxViewActive) {
            this.closePokemonBoxOverlay();
        }

        this.currentParty = [tempPokemon];
        this.battleSettings = this.battleSettings || {};
        this.battleSettings.playerLevel = tempPokemon.level;

        if (this.moveConfig) {
            this.moveConfig.setBattleStartButtonVisible(false);
            this.moveConfig.show();
        }
    },

    closeStoryMoveConfig() {
        if (!this.storyMoveConfigContext) return;

        const tempPokemon = this.currentParty[0];
        const originalPokemon = this.storyMoveConfigContext.pokemon;
        const previousScreen = this.storyMoveConfigContext.previousScreen;

        if (tempPokemon && originalPokemon) {
            originalPokemon.selectedMoves = tempPokemon.selectedMoves;
            this.saveStoryProgress();
        }

        this.storyMoveConfigContext = null;
        this.storyManager.refreshStoryStageScreen();

        if (previousScreen === 'story-box') {
            this.openPokemonBoxOverlay(true);
        }
    },

    openPokemonActionModal(uuid) {
        if (!uuid) return;
        const pokemon = this.storyOwnedPokemonDetails.find(pk => pk.uuid === uuid);
        if (!pokemon) return;

        this.currentPokemonActionUuid = uuid;
        const modal = document.getElementById('pokemon-action-modal');
        const title = document.getElementById('pokemon-action-title');

        if (modal && title) {
            title.textContent = pokemon.nickname || pokemon['名前（日本語）'];

            // UUID表示
            const uuidDisplay = document.getElementById('pokemon-action-uuid');
            if (uuidDisplay) {
                uuidDisplay.textContent = `ID: ${uuid}`;
            }

            modal.classList.remove('hidden');
        }
    },

    closePokemonActionModal() {
        const modal = document.getElementById('pokemon-action-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
        this.currentPokemonActionUuid = null;
    },

    handlePokemonActionMoveConfig() {
        const uuid = this.currentPokemonActionUuid;
        if (!uuid) return;
        this.closePokemonActionModal();
        this.openStoryPokemonMoveConfig(uuid);
    },

    handlePokemonActionRename() {
        const uuid = this.currentPokemonActionUuid;
        if (!uuid) return;
        this.closePokemonActionModal();
        this.promptRename(uuid);
    },

    handlePokemonActionToParty() {
        const uuid = this.currentPokemonActionUuid;
        if (!uuid) return;
        this.closePokemonActionModal();

        this.storyBoxSwapSourceUuid = uuid;
        // UX改善のためモーダル削除: 即座に選択モードに入る
        this.renderStoryPokemonParty();
    },

    handlePokemonActionRelease() {
        const uuid = this.currentPokemonActionUuid;
        if (!uuid) return;
        this.closePokemonActionModal();
        this.promptRelease(uuid);
    },

    closeStoryMoveConfig() {
        if (!this.storyMoveConfigContext) return;
        const tempPokemon = this.currentParty[0];
        const originalPokemon = this.storyMoveConfigContext.pokemon;
        if (tempPokemon && originalPokemon) {
            originalPokemon.selectedMoves = tempPokemon.selectedMoves;
            this.saveStoryProgress();
        }
        this.storyMoveConfigContext = null;
        this.storyManager.refreshStoryStageScreen();
    },

    handleStoryPokemonSlotClick(type, index) {
        if (type !== 'party' && type !== 'box') return;

        // ボックス整理モード
        if (this.storyBoxOrganizeMode) {
            const getUuid = (t, i) => {
                if (t === 'party') return this.storyPartySlots[i];
                if (t === 'box') {
                    const pageOffset = (this.storyBoxPage - 1) * (this.ITEMS_PER_BOX_PAGE_STORY || 24);
                    return this.storyBoxSlots[i + pageOffset]?.uuid;
                }
                return null;
            };

            const clickedUuid = getUuid(type, index);

            // 1. 既に選択中で、同じ場所をクリック -> キャンセル
            // 注意: uuidだけだと同一個体判定になるが、場所の一致を見るべき。
            // しかし、現状の実装では`storyBoxSwapSourceUuid`しか覚えていない。
            // 簡易的に「同じUUIDをクリックしたらキャンセル」とする。
            if (this.storyBoxSwapSourceUuid && this.storyBoxSwapSourceUuid === clickedUuid) {
                this.storyBoxSwapSourceUuid = null;
                this.renderStoryPokemonBox();
                this.renderStoryPokemonParty();
                return;
            }

            // 2. 未選択状態なら選択
            if (!this.storyBoxSwapSourceUuid) {
                if (!clickedUuid) return; // 空スロットは選択開始できない
                this.storyBoxSwapSourceUuid = clickedUuid;
                this.audio.playSe('select');
                this.renderStoryPokemonBox();
                this.renderStoryPokemonParty();
                return;
            }

            // 3. 選択中で、別の場所をクリック -> 入れ替え実行
            // 選択元のUUIDからインデックスを探す必要がある
            // パーティかボックスか全検索
            let source = null;
            // Party検索
            const pIdx = this.storyPartySlots.findIndex(u => u === this.storyBoxSwapSourceUuid);
            if (pIdx !== -1) {
                source = { type: 'party', index: pIdx };
            } else {
                // Box検索
                const bIdx = this.storyBoxSlots.findIndex(s => s && s.uuid === this.storyBoxSwapSourceUuid);
                if (bIdx !== -1) {
                    source = { type: 'box', index: bIdx };
                }
            }

            if (source) {
                // 入れ替え先ターゲット
                let targetIndex = index;
                if (type === 'box') {
                    const pageOffset = (this.storyBoxPage - 1) * (this.ITEMS_PER_BOX_PAGE_STORY || 24);
                    targetIndex = index + pageOffset;
                }

                const target = { type, index: targetIndex };

                this.swapStoryPokemonSlots(source, target);
                this.audio.playSe('select');

                // 入れ替え完了後、選択解除
                this.storyBoxSwapSourceUuid = null;
                this.renderStoryPokemonBox();
                this.renderStoryPokemonParty();
            } else {
                // Sourceが見つからない（ありえないはずだが）
                this.storyBoxSwapSourceUuid = null;
                this.renderStoryPokemonBox();
                this.renderStoryPokemonParty();
            }

            return; // 確実に終了
        }

        // 並び替えモードの場合 (ID/Level順ソートなどが有効な場合?)
        // -> これはボタンで切り替えるソート表示モードのこと
        // ソートモード中もクリックは有効にしたいので、並び替えロジックはここにはないはず
        // （既存コードにある `if (this.storyBoxSortMode)` は恐らくゴミコードか、未実装の機能の残骸）
        // 今回は「ボックス整理モード」を実装したので、そちらを優先

        // 手持ち入れ替えモード (Box -> Party)
        // -> これは「手持ちに入れる」ボタン経由のレガシーモード。
        // -> ボタンを削除したので、このルート (`this.storyBoxSwapSourceUuid && type === 'party'`) に入ることはないはず（整理モードとフラグ共有しているため要注意）
        // -> 整理モード(`storyBoxOrganizeMode`)がtrueなら上で処理される。
        // -> falseなら、`storyBoxSwapSourceUuid`が残っている可能性は低いが、念のため

        if (this.storyBoxOrganizeMode) return; // 念のためここでもガード

        const validUuid = (type === 'party') ? this.storyPartySlots[index] : this.storyBoxSlots[(this.storyBoxPage - 1) * (this.ITEMS_PER_BOX_PAGE_STORY || 24) + index]?.uuid;

        if (validUuid) {
            this.openPokemonActionModal(validUuid);
        }
    },

    swapStoryPokemonSlots(a, b) {
        if (!a || !b) return;

        // UUIDを取得
        const getUuid = (slot) => {
            if (slot.type === 'party') return this.storyPartySlots[slot.index];
            if (slot.type === 'box') return this.storyBoxSlots[slot.index]?.uuid;
            return null;
        };

        const uuidA = getUuid(a);
        const uuidB = getUuid(b);

        // 両方 null なら何もしない
        if (!uuidA && !uuidB) return;

        // 交換処理
        if (a.type === 'party' && b.type === 'party') {
            [this.storyPartySlots[a.index], this.storyPartySlots[b.index]] = [this.storyPartySlots[b.index], this.storyPartySlots[a.index]];
        } else if (a.type === 'box' && b.type === 'box') {
            // Box同士の入れ替え
            if (!uuidA || !uuidB) {
                // 片方が空の場合は、空きスロットへの移動となるが、
                // 「左上詰め」ルールがあるため、任意の空き場所への移動は無効化（自動整列されるため）
                // ただし、もし「最後尾への移動」として扱いたい場合はここにロジックを書くが、
                // 今回は「入れ替え」のみ実装する
                // alert('空きスロットへの移動はできません（自動整列されます）');
                return;
            }

            // storyOwnedPokemonDetails 内でのインデックスを探して入れ替える
            const indexA = this.storyOwnedPokemonDetails.findIndex(pk => pk.uuid === uuidA);
            const indexB = this.storyOwnedPokemonDetails.findIndex(pk => pk.uuid === uuidB);

            if (indexA !== -1 && indexB !== -1) {
                // 配列内での順序を入れ替える
                const temp = this.storyOwnedPokemonDetails[indexA];
                this.storyOwnedPokemonDetails[indexA] = this.storyOwnedPokemonDetails[indexB];
                this.storyOwnedPokemonDetails[indexB] = temp;

                // ボックスを再描画（updateStoryBoxSlotsで順序が反映される）
                this.updateStoryBoxSlots();
            }

        } else {
            // Party <-> Box
            // Partyスロットを書き換えるだけで、Box側は自動的に「Partyから外れたら出現」「Partyに入ったら消失」する
            const partySlot = a.type === 'party' ? a : b;
            const boxSlot = a.type === 'box' ? a : b;

            const partyUuid = getUuid(partySlot); // 今パーティにいるやつ
            const boxUuid = getUuid(boxSlot);     // 今ボックスにいるやつ

            // boxUuidをパーティに入れる（partyUuidはパーティから消える→ボックスへ）
            this.storyPartySlots[partySlot.index] = boxUuid;

            // Box側のリスト順序も整合性を取る
            // Partyにあったポケモン(partyUuid)がBoxに行くので、
            // もともとBoxにあったポケモン(boxUuid)の位置に、partyUuidを置くことで「入れ替え」感を出す
            if (partyUuid && boxUuid) {
                const idxP = this.storyOwnedPokemonDetails.findIndex(p => p.uuid === partyUuid);
                const idxB = this.storyOwnedPokemonDetails.findIndex(p => p.uuid === boxUuid);
                if (idxP !== -1 && idxB !== -1) {
                    const temp = this.storyOwnedPokemonDetails[idxP];
                    this.storyOwnedPokemonDetails[idxP] = this.storyOwnedPokemonDetails[idxB];
                    this.storyOwnedPokemonDetails[idxB] = temp;
                }
            } else if (!partyUuid && boxUuid) {
                // Partyが空で、Boxから移動する場合
                // BoxからPartyへ移動したポケモンはBoxリストから消える（フィルタリングされる）
                // 特にリスト操作は不要だが、空き地を作るために何かする必要はない
            } else if (partyUuid && !boxUuid) {
                // Boxの空きスロットへ移動する場合
                // 実質的には「パーティから外す」操作
                // Boxリストの末尾に追加されるのがデフォルトの挙動だが、
                // もし「特定の位置」に入れたいのなら、その位置にあるnull(空)と交換...はできない（リストにないから）
                // なので、とりあえず末尾移動（push & splice）か、何もしない（フィルタリングで出現）
                // ここでは何もしない
            }

            // ボックス再計算
            this.updateStoryBoxSlots();
        }

        this.saveStoryProgress();
    },

    setStoryBoxSlot(index, id) {
        if (index < 0 || index >= this.STORY_BOX_CAPACITY) return;
        if (!id) {
            this.storyBoxSlots[index] = null;
            return;
        }
        const pokemon = this.loader.getPokemonDetails(id);
        if (!pokemon) {
            this.storyBoxSlots[index] = null;
            return;
        }
        this.storyBoxSlots[index] = {
            id: String(pokemon['図鑑No']),
            name: pokemon['名前（日本語）'],
            sprite: Utils.getSpriteUrl(pokemon['図鑑No'])
        };
    },



    renderPartySelect() {
        const totalPages = this.getPartyPageCount();
        this.partyCardPage = Math.min(totalPages, Math.max(1, this.partyCardPage));
        const start = (this.partyCardPage - 1) * this.partyCardsPerPage;
        const pageItems = this.presetParties.slice(start, start + this.partyCardsPerPage);

        const cardsHtml = pageItems.map((p, idx) => {
            const globalIndex = start + idx;
            const isActive = this.activePartyIndex === globalIndex;
            return `
                <article class="party-card ${isActive ? 'party-card-active' : ''}" data-index="${globalIndex}">
                    <div class="party-card-header">
                        <h3>${p.name}</h3>
                        <button type="button" class="party-trash-btn" data-index="${globalIndex}" aria-label="このパーティを削除">🗑️</button>
                    </div>
                    <div class="party-card-body">
                        <div class="party-pokemon-grid">
                            ${p.ids.map(id => `<img src="${Utils.getSpriteUrl(id)}" class="pixel-art" alt="">`).join('')}
                        </div>
                    </div>
                    <div class="party-card-footer">
                        <span><strong>6たい</strong><em>じゅんび OK</em></span>
                        <span><strong>タイポ${p.ids.length}</strong></span>
                    </div>
                </article>
            `;
        }).join('');

        this.dom.partyGrid.innerHTML = cardsHtml;
        const createCustomCard = document.getElementById('create-custom-card');
        if (createCustomCard) createCustomCard.onclick = () => this.showCustomPartyScreen();
        this.dom.partyGrid.querySelectorAll('.party-card').forEach(card => {
            card.onclick = () => this.handlePartySelect(card.dataset.index);
        });
        this.dom.partyGrid.querySelectorAll('.party-trash-btn').forEach(btn => {
            btn.onclick = (event) => {
                event.stopPropagation();
                this.removePresetParty(Number(btn.dataset.index));
            };
        });
        this.updatePartyPagination();
    },

    getPartyPageCount() {
        const total = Array.isArray(this.presetParties) ? this.presetParties.length : 0;
        return Math.max(1, Math.ceil(total / this.partyCardsPerPage));
    },

    changePartyCardPage(direction) {
        const totalPages = this.getPartyPageCount();
        const nextPage = Math.min(totalPages, Math.max(1, this.partyCardPage + direction));
        if (nextPage === this.partyCardPage) return;
        this.partyCardPage = nextPage;
        this.renderPartySelect();
    },

    updatePartyPagination() {
        const totalPages = this.getPartyPageCount();
        const infoEl = document.getElementById('party-page-info');
        if (infoEl) infoEl.textContent = `${this.partyCardPage} / ${totalPages}`;
        const prevBtn = document.getElementById('party-prev-page');
        const nextBtn = document.getElementById('party-next-page');
        if (prevBtn) prevBtn.disabled = this.partyCardPage <= 1;
        if (nextBtn) nextBtn.disabled = this.partyCardPage >= totalPages;
    },

    showCustomPartyScreen(logHistory = true) {
        this.hideAllScreens();
        this.dom.customPartyScreen.classList.remove('hidden');
        this.customPartySelection = [];
        this.currentCustomPage = 1;
        this.updateSlots('player');
        this.renderPokemonList('player');
        if (logHistory) this.recordScreen('custom-party');
    },

    showEnemySelectScreen(logHistory = true, resetSelection = true) {
        this.hideAllScreens();
        this.dom.enemySelectScreen.classList.remove('hidden');
        if (resetSelection) {
            this.selectedEnemyIds = [];
            this.currentPage = 1;
        }
        this.updateSlots('enemy');
        this.renderPokemonList('enemy');
        this.audio.playBgm('rival_select');
        if (logHistory) this.recordScreen('enemy-select');
    },

    updateSlots(side) {
        const selection = side === 'player' ? this.customPartySelection : this.selectedEnemyIds;
        const slots = side === 'player' ? this.dom.memberSlots : this.dom.enemySlots;
        const confirmBtn = side === 'player' ? this.dom.customConfirmBtn : this.dom.enemyConfirmBtn;
        const filledClass = side === 'player' ? 'filled' : 'enemy-filled';

        slots.forEach((slot, i) => {
            slot.onclick = null;
            const id = selection[i];
            if (id) {
                const pk = this.loader.getPokemonDetails(id);
                slot.innerHTML = `
                    <img src="${Utils.getSpriteUrl(id)}" class="h-12 pixel-art">
                    <span class="font-bold text-[10px] text-center mt-1 truncate w-full">${pk['名前（日本語）']}</span>
                `;
                slot.classList.add(filledClass);
                slot.classList.remove('text-slate-400');
                slot.dataset.pokemonId = id;
                slot.onclick = () => this.toggleSelection(selection, id, side === 'player' ? 6 : 6, side);
            } else {
                slot.innerHTML = `${i + 1}ぴきめ`;
                slot.classList.remove(filledClass, 'filled', 'enemy-filled');
                slot.classList.add('text-slate-400');
                slot.dataset.pokemonId = '';
            }
        });
        confirmBtn.disabled = selection.length === 0;
    },

    renderPokemonList(side) {
        const list = this.loader.pokemonList;
        const page = side === 'player' ? this.currentCustomPage : this.currentPage;
        const itemsPerPage = side === 'player' ? this.ITEMS_PER_PAGE_CUSTOM : this.ITEMS_PER_PAGE;
        const start = (page - 1) * itemsPerPage;
        const pageItems = list.slice(start, start + itemsPerPage);
        const container = side === 'player' ? this.dom.customPokemonList : this.dom.enemyPokemonList;
        const selection = side === 'player' ? this.customPartySelection : this.selectedEnemyIds;
        const selectedClass = side === 'player' ? 'selected' : 'enemy-selected';

        container.innerHTML = pageItems.map(p => {
            const idStr = String(p['図鑑No']);
            const isSel = selection.includes(idStr);
            // ストーリー/バトルで表示する進捗を分ける
            // side === 'player' (カスタムパーティ) => ストーリーの進捗 (defeated/capturedPokemonIds)
            // side === 'enemy' (バトルモード敵選択) => バトルの進捗 (battleDefeated/CapturedPokemonIds)
            let hasDefeated = false;
            let hasCaptured = false;

            if (side === 'player') {
                hasDefeated = this.defeatedPokemonIds.has(idStr);
                hasCaptured = this.capturedPokemonIds.has(idStr);
            } else if (side === 'enemy') {
                hasDefeated = this.battleDefeatedPokemonIds && this.battleDefeatedPokemonIds.has(idStr);
                hasCaptured = this.battleCapturedPokemonIds && this.battleCapturedPokemonIds.has(idStr);
            }

            const trophyBadge = hasDefeated ? '<span class="trophy-icon" title="たおしたポケモン">🏆</span>' : '';
            const captureBadge = !hasDefeated && hasCaptured
                ? '<span class="capture-icon" title="つかまえたポケモン">🟠</span>'
                : '';
            const capturedLabel = hasCaptured ? '<span class="poke-captured-label">GET！</span>' : '';
            return `
                <div class="border rounded-lg p-1 cursor-pointer transition-all bg-white dense-pokemon-card ${isSel ? selectedClass : ''}" data-id="${p['図鑑No']}">
                    ${trophyBadge}${captureBadge}
                    <div class="poke-row" data-testid="poke-row">
                        <span class="poke-number-wrapper">
                            ${capturedLabel}
                            <span class="poke-number text-[8px] text-slate-400">No.${p['図鑑No']}</span>
                        </span>
                        <img src="${Utils.getSpriteUrl(p['図鑑No'])}" class="mx-auto h-12 pixel-art" loading="lazy">
                        <span class="poke-name text-[10px] font-bold truncate">${p['名前（日本語）']}</span>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.dense-pokemon-card').forEach(c => {
            c.onclick = () => {
                const id = c.dataset.id;
                this.audio.playSe('select');
                if (side === 'player') this.toggleSelection(this.customPartySelection, id, 6, 'player');
                else this.toggleSelection(this.selectedEnemyIds, id, 6, 'enemy');
            };
        });

        // ページ情報更新
        const info = side === 'player'
            ? document.querySelector('#custom-party-screen .page-info')
            : document.querySelector('#enemy-select-screen .page-info');
        if (info) {
            info.textContent = `${page} / ${Math.ceil(list.length / itemsPerPage)}`;
        }
    },

    toggleSelection(arr, id, max, side) {
        const idx = arr.indexOf(id);
        if (idx > -1) {
            arr.splice(idx, 1);
        } else if (arr.length < max) {
            arr.push(id);
        } else {
            // お子様向けにわかりやすく。alertはブラウザ仕様により出ない場合もあるので、本来はUI上が望ましいですが現状維持
            console.log("いっぱいです！");
        }
        this.updateSlots(side);
        this.renderPokemonList(side);
    },

    changeCustomPage(d) {
        const max = Math.ceil(this.loader.pokemonList.length / this.ITEMS_PER_PAGE_CUSTOM);
        this.currentCustomPage = Math.min(max, Math.max(1, this.currentCustomPage + d));
        this.renderPokemonList('player');
    },

    changeEnemyPage(d) {
        const max = Math.ceil(this.loader.pokemonList.length / this.ITEMS_PER_PAGE);
        this.currentPage = Math.min(max, Math.max(1, this.currentPage + d));
        this.renderPokemonList('enemy');
    },

    markDefeatedPokemon(id) {
        if (!id) return;
        const key = String(id);

        let changed = false;
        // モード判定: this.currentMode があるか、あるいは currentTrainerData 等で判定
        // handleModeSelectで this.currentMode = mode (STORY or BATTLE) している前提
        // もし this.currentMode が未定義ならデフォルトは STORY と仮定するが、
        // バトルモード(フリー対戦)は handleFinalBattleStart で始まる

        // 簡易判定: バトル画面(BattleManager)が動いている最中だが、
        // 呼び出し元が StoryManager 経由なら Story, EnemySelect 経由なら Battle
        // しかし markDefeatedPokemon は battle.onEnemyDefeat から呼ばれる。
        // Main.jsの currentMode を信頼する

        const isBattleMode = this.currentMode === 'BATTLE';

        if (isBattleMode) {
            if (!this.battleDefeatedPokemonIds) this.battleDefeatedPokemonIds = new Set();
            if (!this.battleDefeatedPokemonIds.has(key)) {
                this.battleDefeatedPokemonIds.add(key);
                changed = true;
            }
        } else {
            if (!this.defeatedPokemonIds.has(key)) {
                this.defeatedPokemonIds.add(key);
                changed = true;
            }
        }

        if (changed && !this.dom.enemySelectScreen.classList.contains('hidden')) {
            this.renderPokemonList('enemy');
        }

        // どちらのモードでもセーブは行う
        this.saveStoryProgress();
    },

    markCapturedPokemon(id) {
        if (!id) return;
        const key = String(id);

        let changed = false;
        const isBattleMode = this.currentMode === 'BATTLE';

        if (isBattleMode) {
            if (!this.battleCapturedPokemonIds) this.battleCapturedPokemonIds = new Set();
            if (!this.battleCapturedPokemonIds.has(key)) {
                this.battleCapturedPokemonIds.add(key);
                changed = true;
            }
        } else {
            if (!this.capturedPokemonIds.has(key)) {
                this.capturedPokemonIds.add(key);
                changed = true;
            }
        }

        if (changed && !this.dom.enemySelectScreen.classList.contains('hidden')) {
            this.renderPokemonList('enemy');
        }

        // 修正: ここで storyOwnedPokemonDetails に追加すると、
        // 捕獲イベント(handleWildBattleEnd等)での追加と重複してしまうため削除。
        // 図鑑フラグ(capturedPokemonIds)の更新のみを行う。

        this.saveStoryProgress();
        this.updateStoryBoxSlots();
        this.updatePokemonBoxButtonState();
    },

    handleCustomPartyConfirm() {
        this.currentParty = this.customPartySelection
            .map(id => this.loader.getPokemonDetails(id))
            .filter(Boolean);
        this.updateCommandMoveDisplayFromParty();
        this.showEnemySelectScreen();
    },

    handlePartySelect(i) {
        this.currentParty = this.presetParties[i].ids
            .map(id => this.loader.getPokemonDetails(id))
            .filter(Boolean);
        this.updateCommandMoveDisplayFromParty();
        this.showEnemySelectScreen();
    },

    showLevelModal() { this.dom.levelModal.classList.remove('hidden'); },

    handleLevelConfirm() {
        const playerLevel = this.normalizeLevelInputValue(this.dom.playerLevelInput.value);
        const enemyLevel = this.normalizeLevelInputValue(this.dom.enemyLevelInput.value);
        this.dom.playerLevelInput.value = String(playerLevel);
        this.dom.enemyLevelInput.value = String(enemyLevel);
        this.battleSettings.playerLevel = playerLevel;
        this.battleSettings.enemyLevel = enemyLevel;
        this.dom.levelModal.classList.add('hidden');
        if (this.moveConfig) {
            this.moveConfig.setBattleStartButtonVisible(true);
            this.moveConfig.show();
        }
    },

    keepDigitsOnly(target) {
        if (!target) return;
        const numeric = String(target.value || '').replace(/[^0-9]/g, '');
        if (numeric !== target.value) target.value = numeric;
    },

    handleLevelInputKeyDown(event) {
        if (!event) return;
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        const allowed = new Set(['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Delete', 'Home', 'End']);
        if (allowed.has(event.key)) return;
        if (/^[0-9]$/.test(event.key)) return;
        event.preventDefault();
    },

    normalizeLevelInputValue(value) {
        const parsed = Number.parseInt(value, 10);
        if (Number.isNaN(parsed)) return 50;
        return Math.min(100, Math.max(1, parsed));
    },

    async handleFinalBattleStart() {
        this.enemyParty = this.selectedEnemyIds.map(id => this.loader.getPokemonDetails(id));
        if (this.enemyParty.length === 0) return;

        this.hideAllScreens();
        this.dom.battleScreen.classList.remove('hidden');
        this.recordScreen('battle');
        this.dom.keyboard.classList.remove('translate-y-full'); // キーボードを表示
        if (this.dom.keyboardColumn) this.dom.keyboardColumn.classList.remove('hidden');

        // BGM決定 (既存のコメントアウトされていたロジックを有効化)
        const bgms = ['battle_wild', 'battle_trainer', 'battle_rival'];
        const selectedBgm = bgms[Math.floor(Math.random() * bgms.length)];
        this.audio.playBgm(selectedBgm);

        // バトルマネージャー初期化
        this.battle = new BattleManager(
            this.currentParty,
            this.battleSettings.playerLevel,
            this.enemyParty,
            this.battleSettings.enemyLevel,
            this.typing,
            this.loader.itemList
        );

        // 各種コールバック
        this.battle.onUpdateUI = (p, e) => this.updateBattleUI(p, e);
        this.battle.onPokemonChange = (type, player, enemy) => {
            this.clearCaptureVisuals();
            this.setBattleSprite(this.dom.playerSpriteContainer, player['図鑑No'], true);
            this.setBattleSprite(this.dom.enemySpriteContainer, enemy['図鑑No'], false);
        };
        this.battle.onEffect = (effect, target) => {
            if (['attack', 'damage', 'fainted'].includes(effect)) this.triggerAnimation(effect, target);
            if (effect === 'damage') this.audio.playSe('attack');
            if (effect === 'ball-throw') this.triggerBallThrow();
            if (effect === 'ball-shake') this.triggerBallShake();
            if (effect === 'ball-captured') this.triggerBallCaptured();
            if (effect === 'ball-escape') this.triggerBallEscape();
        };
        this.battle.onMessage = (msg, type) => this.handleBattleMessage(msg, type);
        this.battle.onPhaseChange = (phase) => this.updatePhaseUI(phase);
        this.battle.onMoveSelect = (move) => this.displaySelectedMove(move);
        this.battle.onEnemyDefeat = async (enemy) => {
            // 敵を倒した時点で経験値獲得 (固定10EXP)
            await this.gainExp(10);
            const id = enemy && enemy['図鑑No'];
            if (id) this.markDefeatedPokemon(id);
        };
        this.battle.onBattleEnd = async (res) => {
            const win = res === 'win' || res === 'catch';

            if (win) {
                this.audio.playBgm('victory_wild', false);
            }

            await Utils.wait(1500);

            alert(win ? "きみの かちだ！ おめでとう！" : "まけちゃった... つぎは がんばろう！");

            if (win) {
                // 進化チェック
                await this.checkAndProcessEvolution();
            }

            // バトル終了後はマップ(タイトル)BGMに戻す
            this.audio.playBgm('title');
            this.showEnemySelectScreen(false, false);
        };
        this.battle.onEnemyCapture = (enemy) => {
            const id = enemy && enemy['図鑑No'];
            if (id) this.markCapturedPokemon(id);
        };

        this.battle.start();
    },

    async checkAndProcessEvolution() {
        // パーティの先頭から順に進化チェック
        for (const member of this.currentParty) {
            if (!member || !member.uuid) continue;
            const ownedPk = this.storyOwnedPokemonDetails.find(pk => pk.uuid === member.uuid);
            if (!ownedPk) continue;

            const currentLevel = ownedPk['獲得レベル'] || 5;
            const dexNo = ownedPk['図鑑No'];

            // Staticデータを取得して進化条件を確認
            // loader.pokemonList は生のCSVデータリスト
            const staticData = this.loader.pokemonList.find(p => String(p['図鑑No']) === String(dexNo));
            if (!staticData) continue;

            const evolutionLevel = parseInt(staticData['進化レベル']);
            const nextId = staticData['進化先'];

            // 進化条件: レベル到達 & 進化先IDが存在
            if (!Number.isNaN(evolutionLevel) && currentLevel >= evolutionLevel && nextId) {
                await this.runEvolutionSequence(ownedPk, staticData, nextId);

                // 進化発生ごとにセーブ & UI更新
                this.saveStoryProgress();
                this.renderStoryPokemonParty();
                this.renderStoryPokemonBox();
            }
        }
    },

    async runEvolutionSequence(ownedPk, currentStaticData, nextId) {
        console.log(`Evolution triggered for ${ownedPk.name} -> ID:${nextId}`);

        const nextStaticData = this.loader.getPokemonDetails(nextId);
        if (!nextStaticData) return;

        const modal = document.getElementById('evolution-modal');
        const msg = document.getElementById('evolution-message');
        const spriteContainer = document.getElementById('evolution-sprite-container');
        const confirmBtn = document.getElementById('evolution-confirm-btn');

        // セットアップ
        const currentName = ownedPk.nickname || currentStaticData['名前（日本語）'];
        const nextName = nextStaticData['名前（日本語）'];

        msg.textContent = `おや...？ ${currentName}の ようすが...！`;
        confirmBtn.classList.add('hidden');
        modal.classList.remove('hidden');

        // 画像セット
        const currentImgUrl = Utils.getSpriteUrl(currentStaticData['図鑑No']);
        const nextImgUrl = Utils.getSpriteUrl(nextStaticData['図鑑No']);

        spriteContainer.innerHTML = `
            <img src="${currentImgUrl}" id="evo-img-current" class="absolute inset-0">
            <img src="${nextImgUrl}" id="evo-img-next" class="absolute inset-0 opacity-0">
        `;

        const imgCurrent = document.getElementById('evo-img-current');
        const imgNext = document.getElementById('evo-img-next');

        // BGMフェードアウト等の演出があればここで行う
        await Utils.wait(1000);
        this.audio.playSe('select'); // 進化開始音の代わりに一旦SE

        // 点滅アニメーション
        // シンプルに画像を切り替える or Opacityをいじる
        // ここではCSSアニメーションクラスを付与してチラつかせる

        const flashDuration = 4000;
        const startTime = Date.now();

        // JSでパカパカさせる
        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / flashDuration;

            // 後半になるほど早く点滅
            const blinkSpeed = Math.max(50, 500 * (1 - progress));
            const showNext = Math.floor(elapsed / blinkSpeed) % 2 === 0;

            if (showNext) {
                imgCurrent.style.opacity = '0';
                imgNext.style.opacity = '1';
                imgNext.style.filter = 'brightness(0)'; // シルエット
            } else {
                imgCurrent.style.opacity = '1';
                imgNext.style.opacity = '0';
                imgCurrent.style.filter = 'brightness(1)';
            }
        }, 100);

        await Utils.wait(flashDuration);
        clearInterval(interval);

        // 進化完了
        imgCurrent.style.opacity = '0';
        imgNext.style.opacity = '1';
        imgNext.style.filter = 'brightness(1)'; // 色戻す
        imgNext.classList.add('anim-bounce');

        this.audio.playBgm('victory_wild', false); // 進化完了ファンファーレ代用
        msg.textContent = `おめでとう！ ${currentName}は ${nextName}に しんかした！`;

        // データ更新
        ownedPk['図鑑No'] = nextStaticData['図鑑No'];
        ownedPk['名前（日本語）'] = nextName; // デフォルト名更新（ニックネームはそのまま）
        ownedPk['タイプ1'] = nextStaticData['タイプ1'];
        ownedPk['タイプ2'] = nextStaticData['タイプ2'];
        // ステータス再計算 (個体値IVは今の実装にないようなので種族値ベースで更新)
        // HPなどの現在値はどうするか？ -> 最大HPが増えた分だけ回復させるか、そのままか
        // ここでは簡易的に「割合を維持」または「現在値維持」
        // とりあえず現在値維持で、最大値は次回バトル開始時やステータス画面で再計算されるはずだが、
        // getPokemonDetailsで都度計算されているので、ownedPk自体には種族値を持たせていないならOK。
        // ただし ownedPk が staticなデータ（攻撃など）をコピーして持っているなら更新が必要。

        // data-loader.jsを見る限り、ownedPkはセーブデータ。
        // 戦闘時には loader.getPokemonDetails(id) で結合している。
        // なので ID ('図鑑No') さえ書き換えれば、次回ロード時に強くなる。

        // 確認ボタン表示
        confirmBtn.classList.remove('hidden');

        return new Promise(resolve => {
            confirmBtn.onclick = () => {
                modal.classList.add('hidden');
                resolve();
            };
        });
    },

    // --- 描画・演出補助 ---
    // getSpriteUrlはUtils.getSpriteUrlを使用するため削除

    setBattleSprite(el, id, isBack) {
        const url = Utils.getSpriteUrl(id, isBack);
        const fallbackUrl = Utils.getSpriteUrl(id);
        el.innerHTML = `<img src="${url}" class="battle-sprite-img pixel-art w-30 h-30" onerror="this.src='${fallbackUrl}'">`;
    },

    triggerAnimation(eff, target) {
        const container = target === 'player' ? this.dom.playerSpriteContainer : this.dom.enemySpriteContainer;
        const img = container.querySelector('img');
        if (!img) return;
        img.className = 'battle-sprite-img pixel-art w-30 h-30';
        void img.offsetWidth; // 強制リフロー
        if (eff === 'attack') img.classList.add('anim-bounce');
        else if (eff === 'damage') img.classList.add('anim-shake');
        else if (eff === 'fainted') img.classList.add('anim-sink');
    },

    clearCaptureVisuals({ keepBall = false } = {}) {
        const container = this.dom.enemySpriteContainer;
        if (!container) return;
        container.classList.remove('capture-throw', 'capture-success');
        if (!keepBall) {
            const prevBall = container.querySelector('.pokeball-anim-container');
            if (prevBall) prevBall.remove();
        }
    },

    updateBattleUI(p, e) {
        this.dom.pName.textContent = p.name;
        this.dom.eName.textContent = e.name;
        this.dom.pLv.textContent = p.level;
        this.dom.eLv.textContent = e.level;
        this.dom.pHpCur.textContent = p.hp;
        this.dom.pHpMax.textContent = p.maxHp;

        const pPer = (p.hp / p.maxHp) * 100;
        const ePer = (e.hp / e.maxHp) * 100;
        this.dom.pHpBar.style.width = `${pPer}%`;
        this.dom.eHpBar.style.width = `${ePer}%`;

        const color = (per) => per < 20 ? 'bg-red-500' : (per < 50 ? 'bg-yellow-500' : 'bg-green-500');
        this.dom.pHpBar.className = `hp-bar-inner h-full ${color(pPer)}`;
        this.dom.eHpBar.className = `hp-bar-inner h-full ${color(ePer)}`;
    },

    handleBattleMessage(message = '', type = 'normal') {
        if (!this.dom.msgText) return;
        const text = message || '...';
        this.dom.msgText.textContent = text;
        this.dom.msgText.dataset.messageType = type;

        console.log('[handleBattleMessage] message:', text, 'phase:', this.battle?.phase);

        // 「どうする？」メッセージの時だけコマンドメニューを表示
        if (text.includes('どうする')) {
            setTimeout(() => {
                if (this.battle && this.battle.phase === 'MENU') {
                    console.log('[handleBattleMessage] Showing command menu (どうする detected)');
                    this.dom.cmdMenu?.classList.remove('hidden');
                }
            }, 100);
        }
    },

    updatePhaseUI(phase) {
        console.log('[updatePhaseUI] phase:', phase);
        this.clearNumberBuffer();
        const panels = [this.dom.cmdMenu, this.dom.moveMenu, this.dom.itemMenu, this.dom.pokemonMenu, this.dom.typingPanel];
        panels.forEach(p => p.classList.add('hidden'));

        if (phase === BattleManager.PHASE.MENU) {
            // 初期は非表示のまま（メッセージ後に表示）
            console.log('[updatePhaseUI] MENU phase - keeping command menu hidden');
            this.dom.cmdMenu.classList.add('hidden');
        } else if (phase === 'MOVE') {
            this.dom.moveMenu.classList.remove('hidden');
            this.renderMoveList();
        } else if (phase === 'ITEM') {
            this.dom.itemMenu.classList.remove('hidden');
            this.renderItemList();
        } else if (phase === 'POKEMON') {
            this.dom.pokemonMenu.classList.remove('hidden');
            this.renderPartyMenuList('switch');
        } else if (phase === 'ITEM_TARGET') {
            this.dom.pokemonMenu.classList.remove('hidden');
            this.renderPartyMenuList('item-target');
        } else if (phase === 'TYPING') {
            this.dom.typingPanel.classList.remove('hidden');
            const mName = this.battle.currentMove['技名'];
            this.typing.setTarget(mName);
            this.dom.typingKana.textContent = mName;
            this.renderTypingDisplay();
        }
        this.updateCommandMoveDisplayFromParty();
        this.updateKeyboardGuide();
    },

    handlePhaseNumberInput(phase, digit) {
        if (this.numberInputTimeout) clearTimeout(this.numberInputTimeout);
        this.numberInputBuffer += digit;

        const normalized = this.numberInputBuffer.padStart(2, '0').slice(-2);
        let targetEl = null;

        if (phase === 'ITEM') {
            targetEl = this.dom.itemList.querySelector(`[data-item-id="${normalized}"]`);
        } else if (phase === 'ITEM_TARGET' || phase === 'POKEMON') {
            targetEl = this.dom.partyList.querySelector(`[data-party-index="${normalized}"]`);
        }

        if (targetEl) {
            if (phase === 'ITEM_TARGET') {
                const targetIndex = parseInt(targetEl.dataset['partyIndex'], 10) - 1;
                this.battle.useItemOnParty(targetIndex);
            } else {
                targetEl.click();
            }
            this.clearNumberBuffer();
            return;
        }

        this.numberInputTimeout = setTimeout(() => this.clearNumberBuffer(), 1200);
    },

    clearNumberBuffer() {
        this.numberInputBuffer = '';
        if (this.numberInputTimeout) {
            clearTimeout(this.numberInputTimeout);
            this.numberInputTimeout = null;
        }
    },

    renderMoveList() {
        const moves = this.battle.player.moves || [];
        this.dom.moveList.innerHTML = moves.map((m, i) => {
            const numberLabel = String(i + 1).padStart(2, '0');
            const typeClass = MoveUtils.getTypeColorClass(m['タイプ']);

            // ローマ字と想定ダメージを計算
            const kanaName = this.typing.normalize(m['技名']);
            const romajiOptions = this.typing.generateOptions(kanaName);
            const standardRomaji = romajiOptions[0] || '';
            const estimatedDamage = standardRomaji.length * 10;

            return `
                <div class="move-card ${typeClass}" onclick="App.battle.selectMove(${i})" data-move-number="${numberLabel}">
                    <div class="flex justify-between items-start">
                        <div class="flex items-center gap-2">
                            <span class="move-number">${numberLabel}</span>
                            <span class="font-bold text-sm">${m['技名']}</span>
                        </div>
                        <span class="text-[10px] move-meta">${m['タイプ']}</span>
                    </div>
                    <div class="flex justify-between items-center text-sm text-slate-700 mt-2 pt-2 border-t border-slate-200">
                        <span class="font-mono">${standardRomaji}</span>
                        <span class="font-bold">威力:~${estimatedDamage}</span>
                    </div>
                </div>
            `;
        }).join('');
    },

    handleTypingInput(e) {
        if (!e.key || e.key.length !== 1) return;
        const res = this.typing.checkInput(e.key);
        if (res.success) {
            this.renderTypingDisplay();
            if (res.isComplete) {
                const elapsed = this.typing.getElapsedTime();
                const isPerfect = this.typing.isPerfect();
                const typedLength = this.typing.typedRoman.length; // 実際に入力した文字数
                const metrics = {
                    speedMultiplier: elapsed <= 3000 ? 2 : 1,
                    isPerfect: isPerfect,
                    typedLength: typedLength
                };
                if (isPerfect) {
                    this.battle.applyPerfectBonus();
                }
                this.battle.commitTurn(metrics);
            }
        } else {
            this.triggerShake();
            this.battle.handleMiss();
        }
    },

    renderTypingDisplay() {
        const data = this.typing.getDisplayData();
        this.dom.typingRoman.innerHTML = `
            <span class="text-blue-500">${data.typed}</span><span class="text-slate-400">${data.remaining}</span>
        `;
    },

    updateKeyboardGuide() {
        if (!this.battle) return;
        this.dom.keys.forEach(k => k.classList.remove('key-active'));
        const highlightKey = (char) => {
            if (!char) return;
            const lower = char.toLowerCase();
            const keyEl = Array.from(this.dom.keys).find(k => k.dataset.key === lower);
            if (keyEl) keyEl.classList.add('key-active');
        };

        const phase = this.battle.phase;
        if (phase === 'TYPING') {
            const char = this.typing.getDisplayData().remaining.charAt(0).toLowerCase();
            highlightKey(char);
            return;
        }

        if (phase === BattleManager.PHASE.MENU) {
            const buffer = (this.menuInputBuffer || '').toLowerCase();
            const matches = this.commandList.filter(cmd => cmd.startsWith(buffer));
            const nextChars = new Set();
            if (!buffer) {
                matches.forEach(cmd => {
                    if (cmd.length > 0) nextChars.add(cmd.charAt(0));
                });
            } else {
                matches.forEach(cmd => {
                    if (cmd.length > buffer.length) {
                        nextChars.add(cmd.charAt(buffer.length));
                    }
                });
            }
            nextChars.forEach(char => highlightKey(char));
        }
    },

    triggerShake() {
        this.dom.battleArea.classList.add('anim-shake');
        setTimeout(() => this.dom.battleArea.classList.remove('anim-shake'), 500);
    },

    triggerBallThrow() {
        this.clearCaptureVisuals();
        const container = this.dom.enemySpriteContainer;
        container.classList.add('capture-throw');
        const ball = document.createElement('div');
        ball.className = 'pokeball-anim-container anim-ball-throw';
        ball.innerHTML = '<img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png" class="pokeball-img">';
        container.appendChild(ball);
    },

    triggerBallShake() {
        const b = this.dom.enemySpriteContainer.querySelector('.pokeball-anim-container');
        if (b) { b.classList.remove('anim-ball-throw'); void b.offsetWidth; b.classList.add('anim-ball-shake'); }
    },

    triggerBallCaptured() {
        const container = this.dom.enemySpriteContainer;
        container.classList.remove('capture-throw');
        container.classList.add('capture-success');
        const ball = container.querySelector('.pokeball-anim-container');
        if (ball) {
            ball.classList.remove('anim-ball-shake');
            ball.classList.add('captured-ball', 'anim-ball-captured');
        }
    },

    triggerBallEscape() {
        this.clearCaptureVisuals();
    },

    recordScreen(name) {
        if (this.screenHistory[this.screenHistory.length - 1] === name) return;
        this.screenHistory.push(name);
    },

    navigateBack() {
        if (this.screenHistory.length <= 1) {
            this.showTitleScreen();
            return;
        }
        this.screenHistory.pop();
        const dest = this.screenHistory.pop();
        if (!dest) {
            this.showTitleScreen();
            return;
        }
        switch (dest) {
            case 'battle': this.showEnemySelectScreen(false); break;
            case 'enemy-select': this.showEnemySelectScreen(false); break;
            case 'custom-party': this.showCustomPartyScreen(false); break;
            case 'party-select': this.showPartySelectScreen(false); break;
            default: this.showTitleScreen(); break;
        }
    },

    handleGlobalKeyDown(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            const battleVisible = this.dom.battleScreen && !this.dom.battleScreen.classList.contains('hidden');
            if (battleVisible) {
                if (this.battle) {
                    this.battle.returnToMenu();
                } else {
                    this.updatePhaseUI(BattleManager.PHASE.MENU);
                }
                return;
            }
            this.navigateBack();
            return;
        }
        if (!this.battle) return;
        const phase = this.battle.phase;
        const num = parseInt(e.key, 10);
        if (phase === BattleManager.PHASE.TYPING) {
            this.handleTypingInput(e);
        } else if (phase === BattleManager.PHASE.MOVE) {
            const moveCount = (this.battle.player.moves || []).length;
            if (!Number.isNaN(num) && num >= 1 && num <= moveCount) {
                this.battle.selectMove(num - 1);
            }
        } else if ((phase === BattleManager.PHASE.ITEM || phase === BattleManager.PHASE.ITEM_TARGET) && !Number.isNaN(num)) {
            this.handlePhaseNumberInput(phase, e.key);
        } else if (phase === BattleManager.PHASE.POKEMON && !Number.isNaN(num)) {
            this.handlePhaseNumberInput(BattleManager.PHASE.POKEMON, e.key);
        } else if (phase === BattleManager.PHASE.MENU) {
            // 数字キーの処理
            if (e.key === '1') this.battle.setPhase('MOVE');
            if (e.key === '4') this.battle.tryEscape();

            // テキスト入力の処理（コマンド名の入力）
            const key = e.key.toLowerCase();
            if (/^[a-z]$/.test(key)) {
                let attempted = this.menuInputBuffer + key;
                const hasMatchForAttempted = this.commandList.some(cmd => cmd.startsWith(attempted));
                if (!hasMatchForAttempted) {
                    while (attempted && !this.commandList.some(cmd => cmd.startsWith(attempted))) {
                        attempted = attempted.slice(0, -1);
                    }
                }
                if (!attempted && this.commandList.some(cmd => cmd.startsWith(key))) {
                    attempted = key;
                }
                this.menuInputBuffer = attempted;

                const hasMatch = this.menuInputBuffer && this.commandList.some(cmd => cmd.startsWith(this.menuInputBuffer));
                document.querySelectorAll('.cmd-input').forEach(el => {
                    const cmd = el.parentElement.dataset.cmd;
                    if (cmd && hasMatch && cmd.startsWith(this.menuInputBuffer)) {
                        el.textContent = this.menuInputBuffer;
                    } else {
                        el.textContent = '';
                    }
                });

                if (this.commandList.includes(this.menuInputBuffer)) {
                    this.handleCommandAction(this.menuInputBuffer);
                }

                if (this.inputTimeout) clearTimeout(this.inputTimeout);
                this.inputTimeout = setTimeout(() => {
                    this.menuInputBuffer = '';
                    document.querySelectorAll('.cmd-input').forEach(el => {
                        el.textContent = '';
                    });
                }, 2000);
            }
        }
        this.updateKeyboardGuide();
    },

    displaySelectedMove(move) {
        const selectedSpan = document.querySelector('[data-cmd="tatakau"] .cmd-selected-move');
        if (!selectedSpan) return;
        selectedSpan.textContent = move ? `えらんだ：${move['技名']}` : '';
    },

    updateCommandMoveDisplayFromParty() {
        const selectedSpan = document.querySelector('[data-cmd="tatakau"] .cmd-selected-move');
        if (!selectedSpan) return;
        const firstPokemon = this.currentParty[0] || {};
        const moveNames = (firstPokemon.selectedMoves || []).map(m => m['技名']).filter(Boolean);
        selectedSpan.textContent = moveNames.length ? `えらんだ：${moveNames.join(' / ')}` : '';
    },

    handleCommandAction(cmd) {
        if (!this.battle) return;
        switch (cmd) {
            case 'tatakau':
                this.battle.setPhase('MOVE');
                break;
            case 'dougu':
                this.battle.setPhase('ITEM');
                break;
            case 'pokemon':
                this.battle.setPhase('POKEMON');
                break;
            case 'nigeru':
                this.battle.tryEscape();
                break;
            default:
                break;
        }
        this.menuInputBuffer = '';
        document.querySelectorAll('.cmd-input').forEach(el => el.textContent = '');
    },

    renderItemList() {
        if (!this.battle || !this.battle.inventory) return;
        const list = this.battle.inventory;
        this.dom.itemList.innerHTML = list.map(item => `
            <button class="move-card flex flex-col items-start gap-1" data-item-id="${item.id}" onclick="App.battle.useItem('${item.id}')">
                <div class="flex items-center gap-2">
                    <span class="move-number">${item.id}</span>
                    <span class="font-bold text-sm">${item['名前'] || item.name || 'どうぐ'}</span>
                </div>
                <div class="text-[10px] text-slate-500">${item['効果値'] ? `効果:${item['効果値']}` : ''}</div>
                <div class="text-[10px] text-slate-500">残り:${item.count}</div>
            </button>
        `).join('');
    },

    renderPartyMenuList(mode = 'switch') {
        if (!this.battle || !this.battle.party) return;

        this.dom.partyList.innerHTML = this.battle.party.map((pokemon, index) => {
            let onclickHandler = '';
            if (mode === 'item-target') {
                onclickHandler = `App.battle.useItemOnParty(${index})`;
            } else {
                onclickHandler = `App.battle.switchPokemon(${index})`;
            }

            return `
            <button class="move-card flex flex-col items-start gap-1" data-party-index="${String(index + 1).padStart(2, '0')}" onclick="${onclickHandler}">
                <div class="flex items-center gap-2">
                    <span class="move-number">${String(index + 1).padStart(2, '0')}</span>
                    <span class="font-bold text-sm">${pokemon.name}</span>
                </div>
                <div class="text-[10px] text-slate-500">HP:${pokemon.hp}/${pokemon.maxHp}</div>
                <div class="text-[10px] text-slate-500">Lv.${pokemon.level}</div>
            </button>
            `;
        }).join('');
    },

    hideAllScreens() {
        const screens = [
            this.dom.titleScreen,
            this.dom.partySelectScreen,
            this.dom.customPartyScreen,
            this.dom.enemySelectScreen,
            this.dom.moveConfigScreen,
            this.dom.battleScreen,
            this.dom.storyRegionSelectScreen,
            this.dom.storyStageScreen
        ];
        screens.forEach(s => s && s.classList.add('hidden'));
        if (this.dom.keyboardColumn) this.dom.keyboardColumn.classList.add('hidden');
    },

    showModeSelectScreen() { this.hideAllScreens(); this.dom.titleScreen.classList.remove('hidden'); document.getElementById('mode-select').classList.remove('hidden'); },

    toggleStoryBoxSortMode() {
        this.storyBoxSortMode = !this.storyBoxSortMode;
        this.storyBoxSortSelection = null;

        const sortBtn = document.getElementById('story-box-sort-btn');
        if (sortBtn) {
            sortBtn.classList.toggle('active', this.storyBoxSortMode);
            sortBtn.textContent = this.storyBoxSortMode ? '並び替え中' : '並び替え';
        }

        this.renderStoryPokemonParty();
        this.renderStoryPokemonBox();
    },

    handleStoryBoxSortClick(type, index) {
        if (!this.storyBoxSortMode) return;

        if (!this.storyBoxSortSelection) {
            // 選択 (空スロットは1手目に選ばない)
            const getUuid = (t, i) => {
                if (t === 'party') return this.storyPartySlots[i];
                if (t === 'box') return this.storyBoxSlots[i]?.uuid;
                return null;
            };

            if (!getUuid(type, index)) {
                return;
            }

            this.storyBoxSortSelection = { type, index };
            this.audio.playSe('select');
        } else {
            const current = this.storyBoxSortSelection;
            // キャンセル
            if (current.type === type && current.index === index) {
                this.storyBoxSortSelection = null;
                this.audio.playSe('cancel');
            } else {
                // 実行
                this.swapStoryPokemonSlots(current, { type, index });
                this.storyBoxSortSelection = null;
                this.audio.playSe('select');
            }
        }
        this.renderStoryPokemonParty();
        this.renderStoryPokemonBox();
    },

    showTitleScreen() {
        this.hideAllScreens();
        this.dom.titleScreen.classList.remove('hidden');
        document.getElementById('start-panel').classList.remove('hidden');
        this.audio.playBgm('title');
    },
};

document.addEventListener('DOMContentLoaded', () => App.init());
