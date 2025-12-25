/**
 * アプリケーション・エントリーポイント
 * UI更新と入力制御の統括
 */
const SAVE_SLOT_IDS = ['1', '2', '3'];
const createStageIds = (count) => Array.from({ length: count }, (_, index) => `ST_${String(index + 1).padStart(2, '0')}`);
const STORY_REGIONS = {
    KANTO: {
        key: 'KANTO',
        label: 'カントー地方編',
        description: 'マサラタウンから はじまる ぼうけんの はじまり。',
        image: 'assets/img/kanto-story-img.png',
        stageIds: createStageIds(48)
    },
    DEFAULT: {
        key: 'DEFAULT',
        label: 'ストーリーを えらぶ',
        description: 'リッジョンを えらんで たびだとう。',
        image: 'assets/img/kanto-story-img.png'
    }
};
const App = {
    loader: null,
    typing: null,
    battle: null,
    audio: null,
    moveConfig: null,

    // 定数: 1ページあたり25体 (5列×5行) のポケモンリスト
    ITEMS_PER_PAGE: 25,
    ITEMS_PER_PAGE_CUSTOM: 25,

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
            storyStageBannerImage: document.getElementById('story-stage-banner-img')
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

        // 戻るボタン
        document.getElementById('party-back-btn').onclick = () => this.showModeSelectScreen();
        document.getElementById('custom-back-btn').onclick = () => this.showPartySelectScreen();
        document.getElementById('enemy-select-back-btn').onclick = () => this.showPartySelectScreen();

        // 決定ボタン
        this.dom.customConfirmBtn.onclick = () => this.handleCustomPartyConfirm();
        this.dom.enemyConfirmBtn.onclick = () => this.showLevelModal();
        document.getElementById('modal-confirm-btn').onclick = () => this.handleLevelConfirm();
        document.getElementById('modal-cancel-btn').onclick = () => this.dom.levelModal.classList.add('hidden');
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
                this.handleGlobalKeyDown({ key: k, preventDefault: () => {} });
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
            const captured = (slot.capturedPokemonIds || []).length;
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
        this.clearedStages = new Set(slotData.clearedStages || []);
        this.setActiveSlotFromData(slotData);
        if (this.isSlotEmpty(slotData)) {
            this.pendingSlotForName = slotId;
            this.openNameInputModal();
            return;
        }
        this.setActiveSlotFromData(slotData);
        this.audio.playSe('select');
        this.renderSaveSlots(this.saveManager.loadAll());
        this.showModeSelectScreen();
    },

    handleSlotDelete(slotId) {
        if (!slotId) return;
        if (!confirm('このスロットのデータを ほんとうに けしても いいですか？')) return;
        this.saveManager.deleteSlot(slotId);
        if (this.currentSlotId === slotId) {
            this.currentSlotId = '1';
            this.defeatedPokemonIds.clear();
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
            playTime: 0
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
            this.saveManager.saveToFile(this.currentSlotId);
        } catch (err) {
            alert(err.message || 'ファイルへのセーブに しっぱいしました。');
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
                alert(err.message || 'ファイルの 読みこみに しっぱいしました。');
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

    handleStoryRegionSelect(region) {
        if (!region) return;
        this.storyRegion = region;
        this.audio.playSe('select');
        const regionDef = STORY_REGIONS[region] || STORY_REGIONS.DEFAULT;
        this.storyRegionDisplayName = regionDef.label;
        this.storyRegionImageUrl = regionDef.image;
        const allStages = this.loader.stageList || [];
        const stageIds = regionDef.stageIds || allStages.map(stage => stage.id);
        const targeted = stageIds.map((id, index) => {
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
        const visibleStages = targeted.length ? targeted : allStages.map((stage, index) => ({
            ...stage,
            isLocked: index > 0 && !this.clearedStages.has(allStages[index - 1]?.id)
        }));
        this.showStoryStageScreen(visibleStages);
    },

    showPartySelectScreen(logHistory = true) {
        this.hideAllScreens();
        this.dom.partySelectScreen.classList.remove('hidden');
        this.renderPartySelect();
        if (logHistory) this.recordScreen('party-select');
    },

    showStoryRegionSelectScreen(logHistory = true) {
        this.hideAllScreens();
        if (this.dom.startPanel) this.dom.startPanel.classList.add('hidden');
        const modePanel = document.getElementById('mode-select');
        if (modePanel) modePanel.classList.add('hidden');
        if (this.dom.storyRegionSelectScreen) this.dom.storyRegionSelectScreen.classList.remove('hidden');
        if (this.dom.storyStageScreen) this.dom.storyStageScreen.classList.add('hidden');
        this.attachStoryRegionCardHandlers();
        if (logHistory) this.recordScreen('story-region-select');
    },

    showStoryStageScreen(stages = []) {
        const maxStageTiles = 48;
        const displayStages = Array.isArray(stages) ? stages.slice(0, maxStageTiles) : [];
        this.storyStageList = displayStages;
        this.hideAllScreens();
        if (this.dom.storyStageBannerImage && this.storyRegionImageUrl) {
            this.dom.storyStageBannerImage.src = this.storyRegionImageUrl;
        }
        if (this.dom.storyStageRegionLabel) {
            this.dom.storyStageRegionLabel.textContent = this.storyRegionDisplayName || STORY_REGIONS.DEFAULT.label;
        }
        if (this.dom.storyStageScreen) this.dom.storyStageScreen.classList.remove('hidden');
        this.renderStoryStages(displayStages);
        const firstStage = displayStages[0];
        if (this.dom.storyStageTitle) this.dom.storyStageTitle.textContent = firstStage?.name || 'ステージを えらぶ';
        if (this.dom.storyStageDesc) {
            this.dom.storyStageDesc.textContent = firstStage?.description || 'ステージを えらぶと ここに じょうほうが ひょうじされます。';
        }
        this.recordScreen('story-stage-select');
        if (firstStage) {
            this.handleStoryStageSelect(firstStage.id);
        }
    },

    handleStoryStageSelect(stageId) {
        if (!stageId || !this.storyStageList.length || !this.dom.storyStageGrid) return;
        const stage = this.storyStageList.find(s => s.id === stageId);
        if (!stage) return;
        this.storySelectedStageId = stageId;
        if (this.dom.storyStageTitle) this.dom.storyStageTitle.textContent = stage.name;
        if (this.dom.storyStageDesc) this.dom.storyStageDesc.textContent = stage.description;
        this.dom.storyStageGrid.querySelectorAll('.story-stage-block').forEach(block => {
            block.classList.toggle('selected', block.dataset.stageId === stageId);
        });
    },

    renderStoryStages(stages = []) {
        if (!this.dom.storyStageGrid) return;
        const displayStages = Array.isArray(stages) ? stages : [];
        if (!displayStages.length) {
            this.dom.storyStageGrid.innerHTML = '<p class="text-center text-sm text-slate-500">表示できるステージが ありません。</p>';
            return;
        }
        this.dom.storyStageGrid.innerHTML = displayStages.map((stage) => {
            const stageIdLabel = stage.id ? stage.id.split('_').pop()?.padStart(2, '0') : '00';
            const stageName = stage.name || 'ステージ';
            const locked = Boolean(stage.isLocked);
            const stageType = stage.type ? stage.type.toUpperCase() : 'STAGE';
            const description = locked ? '' : (stage.description || 'じゅんびちゅうの ステージです。');
            const statusLabel = locked ? 'ロック中' : 'プレイ可能';
            return `
            <button type="button" class="story-stage-block${locked ? ' locked' : ''}" data-stage-id="${stage.id || ''}" aria-label="${stageName} (${statusLabel})" ${locked ? 'disabled' : ''}>
                <div class="story-stage-card">
                    <div class="story-stage-card-header">
                        <span class="story-stage-card-id">ST_${stageIdLabel}</span>
                        <span class="story-stage-card-type">${stageType}</span>
                    </div>
                    <h4 class="story-stage-card-title">${stageName}</h4>
                    ${description ? `<p class="story-stage-card-summary">${description}</p>` : ''}
                    <span class="story-stage-card-state${locked ? ' locked' : ''}">${statusLabel}</span>
                </div>
            </button>
            `;
        }).join('');
        this.dom.storyStageGrid.querySelectorAll('.story-stage-block').forEach(block => {
            block.onclick = () => this.handleStoryStageSelect(block.dataset.stageId);
        });
    },

    attachStoryRegionCardHandlers() {
        const cards = document.querySelectorAll('#story-region-select-screen .region-card');
        cards.forEach(card => card.onclick = null);
        cards.forEach(card => {
            if (!card.disabled) {
                card.addEventListener('click', () => this.handleStoryRegionSelect(card.dataset.region));
            } else {
                card.onclick = null;
            }
        });
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
                            ${p.ids.map(id => `<img src="${this.getSpriteUrl(id)}" class="pixel-art" alt="">`).join('')}
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
                    <img src="${this.getSpriteUrl(id)}" class="h-12 pixel-art">
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
            const isDefeated = side === 'enemy' && this.defeatedPokemonIds.has(idStr);
            const trophyBadge = isDefeated ? '<span class="trophy-icon" title="たおしたポケモン">🏆</span>' : '';
            const captureBadge = !isDefeated && side === 'enemy' && this.capturedPokemonIds.has(idStr)
                ? '<span class="capture-icon" title="つかまえたポケモン">🟠</span>'
                : '';
            const showCapturedLabel = side === 'enemy' && this.capturedPokemonIds.has(idStr);
            const capturedLabel = showCapturedLabel ? '<span class="poke-captured-label">GET！</span>' : '';
            return `
                <div class="border rounded-lg p-1 cursor-pointer transition-all bg-white dense-pokemon-card ${isSel ? selectedClass : ''}" data-id="${p['図鑑No']}">
                    ${trophyBadge}${captureBadge}
                    <div class="poke-row" data-testid="poke-row">
                        <span class="poke-number-wrapper">
                            ${capturedLabel}
                            <span class="poke-number text-[8px] text-slate-400">No.${p['図鑑No']}</span>
                        </span>
                        <img src="${this.getSpriteUrl(p['図鑑No'])}" class="mx-auto h-12 pixel-art" loading="lazy">
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
        if (this.defeatedPokemonIds.has(key)) return;
        this.defeatedPokemonIds.add(key);
        if (!this.dom.enemySelectScreen.classList.contains('hidden')) {
            this.renderPokemonList('enemy');
        }
        this.saveManager.saveSlot(this.currentSlotId, {
            defeatedPokemonIds: Array.from(this.defeatedPokemonIds),
            capturedPokemonIds: Array.from(this.capturedPokemonIds),
            lastPlayed: Date.now()
        });
    },

    markCapturedPokemon(id) {
        if (!id) return;
        const key = String(id);
        if (this.capturedPokemonIds.has(key)) return;
        this.capturedPokemonIds.add(key);
        if (!this.dom.enemySelectScreen.classList.contains('hidden')) {
            this.renderPokemonList('enemy');
        }
        this.saveManager.saveSlot(this.currentSlotId, {
            defeatedPokemonIds: Array.from(this.defeatedPokemonIds),
            capturedPokemonIds: Array.from(this.capturedPokemonIds),
            lastPlayed: Date.now()
        });
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
        if (this.moveConfig) this.moveConfig.show();
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

        // BGM決定
        const bgms = ['battle_wild', 'battle_trainer', 'battle_rival'];
        this.audio.playBgm(bgms[Math.floor(Math.random() * bgms.length)]);

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
        this.battle.onBattleEnd = (res) => {
            const win = res === 'win' || res === 'catch';
            setTimeout(() => {
                alert(win ? "きみの かちだ！ おめでとう！" : "まけちゃった... つぎは がんばろう！");
                this.showEnemySelectScreen(false, false);
            }, 1500);
        };
        this.battle.onEnemyDefeat = (enemy) => {
            const id = enemy && enemy['図鑑No'];
            if (id) this.markDefeatedPokemon(id);
        };
        this.battle.onEnemyCapture = (enemy) => {
            const id = enemy && enemy['図鑑No'];
            if (id) this.markCapturedPokemon(id);
        };

        this.battle.start();
    },

    // --- 描画・演出補助 ---
    getSpriteUrl(id, back = false) {
        return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon${back ? '/back' : ''}/${id}.png`;
    },

    setBattleSprite(el, id, isBack) {
        el.innerHTML = `<img src="${this.getSpriteUrl(id, isBack)}" class="battle-sprite-img pixel-art w-48 h-48" onerror="this.src='${this.getSpriteUrl(id)}'">`;
    },

    triggerAnimation(eff, target) {
        const container = target === 'player' ? this.dom.playerSpriteContainer : this.dom.enemySpriteContainer;
        const img = container.querySelector('img');
        if (!img) return;
        img.className = 'battle-sprite-img pixel-art w-48 h-48';
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
    },

    updatePhaseUI(phase) {
        this.clearNumberBuffer();
        const panels = [this.dom.cmdMenu, this.dom.moveMenu, this.dom.itemMenu, this.dom.pokemonMenu, this.dom.typingPanel];
        panels.forEach(p => p.classList.add('hidden'));

        if (phase === BattleManager.PHASE.MENU) {
            this.dom.cmdMenu.classList.remove('hidden');
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
            return `
                <div class="move-card ${typeClass}" onclick="App.battle.selectMove(${i})" data-move-number="${numberLabel}">
                    <div class="flex justify-between items-start">
                        <div class="flex items-center gap-2">
                            <span class="move-number">${numberLabel}</span>
                            <span class="font-bold text-sm">${m['技名']}</span>
                        </div>
                        <span class="text-[10px] move-meta">${m['タイプ']}</span>
                    </div>
                    <div class="flex justify-between text-[10px] text-slate-500 mt-2">
                        <span>PP:${m['PP']}</span>
                        <span>威力:${m['威力']}</span>
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
            if (res.isComplete) this.battle.commitTurn();
        } else {
            this.triggerShake();
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
                    this.battle.setPhase(BattleManager.PHASE.MENU);
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

    renderPartyMenuList() {
        if (!this.battle || !this.battle.party) return;
        this.dom.partyList.innerHTML = this.battle.party.map((pokemon, index) => `
            <button class="move-card flex flex-col items-start gap-1" data-party-index="${String(index + 1).padStart(2, '0')}" onclick="App.battle.switchPokemon(${index})">
                <div class="flex items-center gap-2">
                    <span class="move-number">${String(index + 1).padStart(2, '0')}</span>
                    <span class="font-bold text-sm">${pokemon.name}</span>
                </div>
                <div class="text-[10px] text-slate-500">HP:${pokemon.hp}/${pokemon.maxHp}</div>
                <div class="text-[10px] text-slate-500">Lv.${pokemon.level}</div>
            </button>
        `).join('');
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
    showTitleScreen() { this.hideAllScreens(); this.dom.titleScreen.classList.remove('hidden'); document.getElementById('start-panel').classList.remove('hidden'); }
};

document.addEventListener('DOMContentLoaded', () => App.init());
