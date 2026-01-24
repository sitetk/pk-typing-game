
function createStageIds(count) {
    return Array.from({ length: count }, (_, i) => `ST_${String(i + 1).padStart(2, '0')}`);
}

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

class StoryManager {
    constructor(app) {
        this.app = app;
        this.storyStageList = [];
        this.storyRegionImageUrl = '';
        this.storyRegionDisplayName = '';
        this.currentRegionKey = 'DEFAULT';
    }

    handleStoryRegionSelect(region) {
        if (!region) return;
        this.app.audio.playSe('select');
        this.currentRegionKey = region;

        const regionDef = STORY_REGIONS[region] || STORY_REGIONS.DEFAULT;
        if (this.app.dom.storyStageRegionLabel) {
            this.app.dom.storyStageRegionLabel.textContent = regionDef.label;
        }
        this.storyRegionImageUrl = regionDef.image;

        const visibleStages = this.buildStoryStageTiles(regionDef);
        this.showStoryStageScreen(visibleStages);
    }

    refreshStoryStageScreen() {
        const regionDef = STORY_REGIONS[this.currentRegionKey] || STORY_REGIONS.DEFAULT;
        const visibleStages = this.buildStoryStageTiles(regionDef);
        this.showStoryStageScreen(visibleStages);
    }

    buildStoryStageTiles(regionDef) {
        const allStages = this.app.loader.stageList || [];
        const stageIds = regionDef.stageIds || allStages.map(stage => stage.id);

        return stageIds.map((id, index) => {
            const found = allStages.find(stage => stage.id === id);
            if (!found) return null;

            const prevStageId = stageIds[index - 1];
            // 最初のステージは解放、それ以降は前のステージクリアが必要
            const isLocked = index > 0 && prevStageId && !this.app.clearedStages.has(prevStageId);

            return {
                ...found,
                isLocked,
                previewText: index === 0 ? 'stage01' : ''
            };
        }).filter(Boolean);
    }

    showStoryRegionSelectScreen(logHistory = true) {
        this.app.hideAllScreens();
        if (this.app.dom.startPanel) this.app.dom.startPanel.classList.add('hidden');
        const modePanel = document.getElementById('mode-select');
        if (modePanel) modePanel.classList.add('hidden');
        if (this.app.dom.storyRegionSelectScreen) this.app.dom.storyRegionSelectScreen.classList.remove('hidden');
        if (this.app.dom.storyStageScreen) this.app.dom.storyStageScreen.classList.add('hidden');
        this.attachStoryRegionCardHandlers();
        this.app.storyCollectionInitialized = false;
        if (logHistory) this.app.recordScreen('story-region-select');
        this.app.audio.playBgm('title');
    }

    // resetStoryCapturedCollections() is in main.js dealing with save data, keep it there or access via app

    showStoryStageScreen(stages = []) {
        this.app.storyCollectionInitialized = true;
        const maxStageTiles = 48;
        const displayStages = Array.isArray(stages) ? stages.slice(0, maxStageTiles) : [];
        this.storyStageList = displayStages;
        this.app.hideAllScreens();
        if (this.app.dom.storyStageBannerImage && this.storyRegionImageUrl) {
            this.app.dom.storyStageBannerImage.src = this.storyRegionImageUrl;
        }
        if (this.app.dom.storyStageRegionLabel) {
            this.app.dom.storyStageRegionLabel.textContent = this.storyRegionDisplayName || STORY_REGIONS.DEFAULT.label;
        }
        if (this.app.dom.storyStageScreen) this.app.dom.storyStageScreen.classList.remove('hidden');
        this.renderStoryStages(displayStages);
        const firstStage = displayStages[0];
        if (this.app.dom.storyStageTitle) this.app.dom.storyStageTitle.textContent = firstStage?.name || 'ステージを えらぶ';
        if (this.app.dom.storyStageDesc) {
            this.app.dom.storyStageDesc.textContent = firstStage?.description || 'ステージを えらぶと ここに じょうほうが ひょうじされます。';
        }
        this.app.recordScreen('story-stage-select');
        if (firstStage) {
            this.handleStoryStageSelect(firstStage.id, { openModal: false });
        }
        this.app.updateStoryBoxSlots();
        this.app.updatePokemonBoxButtonState();
        this.app.updateGetStageButtonState();
        this.app.audio.playBgm('title');
    }

    handleStoryStageSelect(stageId, { openModal = true } = {}) {
        if (!stageId || !this.storyStageList.length || !this.app.dom.storyStageGrid) return;
        const stage = this.storyStageList.find(s => s.id === stageId);
        if (!stage) return;
        const reward = this.app.loader.getStageReward(stageId);
        this.app.getStageModalData = reward;
        this.app.selectedGetStageRewardIndex = null;
        this.app.storySelectedStageId = stageId;
        if (this.app.dom.storyStageTitle) this.app.dom.storyStageTitle.textContent = stage.name;
        if (this.app.dom.storyStageDesc) this.app.dom.storyStageDesc.textContent = stage.description;
        this.app.dom.storyStageGrid.querySelectorAll('.story-stage-block').forEach(block => {
            block.classList.toggle('selected', block.dataset.stageId === stageId);
        });
        this.app.updateGetStageButtonState();

        const stageType = (stage.type || '').toUpperCase();
        const hasReward = Boolean(reward && reward.rewardSlots && reward.rewardSlots.length);

        // クリア済み判定: 報酬がある場合は報酬取得状況、なければステージクリア状況
        const alreadyClaimed = hasReward
            ? (reward && this.app.hasCollectedStage(reward.stageId))
            : this.app.clearedStages.has(stageId);

        // 制限ロジック: GET, RIVAL, VILLAIN はクリア済みなら開かない
        const isOneTimeStage = ['GET', 'RIVAL', 'VILLAIN'].includes(stageType);
        if (isOneTimeStage && alreadyClaimed) {
            // 選択はできるがアクションは起こさない（グレーアウトUIと連動）
            return;
        }

        const canOpenGetModal = stageType === 'GET' && hasReward && !stage.isLocked && !alreadyClaimed;

        // 野生バトル (WILD)
        // 野生は何度でも挑戦可能
        if (stageType === 'WILD' && !stage.isLocked) {
            if (openModal) {
                this.app.showWildDetailModal(stageId, stage);
            }
            return;
        }

        // トレーナーバトルの処理
        // WILDを除外
        const isTrainerBattle = ['RIVAL', 'GYM', 'VILLAIN', 'TRAINER', 'NORMAL', ''].includes(stageType);
        // RIVAL/VILLAINは isOneTimeStage で既にチェック済みだが念のため
        const canOpenTrainerModal = isTrainerBattle && !stage.isLocked && (!isOneTimeStage || !alreadyClaimed);

        if (canOpenGetModal && openModal) {
            this.app.handleGetStageButtonClick();
        } else if (canOpenTrainerModal && openModal) {
            this.app.showTrainerBattleModal(stageId, stage);
        }
    }

    renderStoryStages(stages = []) {
        if (!this.app.dom.storyStageGrid) return;
        const displayStages = Array.isArray(stages) ? stages : [];
        if (!displayStages.length) {
            this.app.dom.storyStageGrid.innerHTML = '<p class="text-center text-sm text-slate-500">表示できるステージが ありません。</p>';
            return;
        }
        this.app.dom.storyStageGrid.innerHTML = displayStages.map((stage) => {
            const stageIdLabel = stage.id ? stage.id.split('_').pop()?.padStart(2, '0') : '00';
            const stageName = stage.name || 'ステージ';
            const locked = Boolean(stage.isLocked);
            const stageType = stage.type ? stage.type.toUpperCase() : 'STAGE';
            const description = locked ? '' : (stage.description || 'じゅんびちゅうの ステージです。');

            // 報酬情報取得
            const reward = this.app.loader.getStageReward(stage.id);
            const hasReward = Boolean(reward && reward.rewardSlots && reward.rewardSlots.length);

            // クリア状態チェック
            const isCleared = hasReward
                ? this.app.hasCollectedStage(stage.id)
                : this.app.clearedStages.has(stage.id);

            const isOneTime = ['GET', 'RIVAL', 'VILLAIN'].includes(stageType);
            const isRetryable = ['GYM', 'WILD'].includes(stageType); // WILD added just in case

            let statusLabel = locked ? 'ロック中' : 'プレイ可能';
            let blockClass = locked ? ' locked' : '';
            let disabled = locked;

            if (isCleared && isOneTime) {
                statusLabel = 'クリア済み';
                blockClass += ' cleared-gray';
            }

            return `
            <button type="button" class="story-stage-block${blockClass}" data-stage-id="${stage.id || ''}" aria-label="${stageName} (${statusLabel})" ${disabled ? 'disabled' : ''}>
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

        // イベントハンドラをアタッチ
        this.app.dom.storyStageGrid.querySelectorAll('.story-stage-block').forEach(block => {
            const stageId = block.dataset.stageId;
            block.onclick = () => {
                console.log('[renderStoryStages] Stage clicked:', stageId);
                this.handleStoryStageSelect(stageId);
            };
        });

        console.log('[renderStoryStages] Attached', this.app.dom.storyStageGrid.querySelectorAll('.story-stage-block').length, 'handlers');
    }

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
    }
}
