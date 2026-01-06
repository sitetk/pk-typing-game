/**
 * 技構成画面の管理クラス
 */
class MoveConfigScreen {
    constructor(app) {
        this.app = app;
        this.dom = app.dom;
        this.audio = app.audio;
        this.currentConfigPokemonIndex = 0;
    }

    show() {
        this.app.hideAllScreens();
        this.dom.moveConfigScreen.classList.remove('hidden');


        // 初期選択ポケモン
        this.currentConfigPokemonIndex = 0;

        // データ準備
        this.app.currentParty.forEach(p => {
            if (!p.selectedMoves) {
                const available = p.moves.filter(m => m['習得レベル'] <= this.app.battleSettings.playerLevel);
                const attacks = available.filter(m => m['分類'] !== 'へんか');
                p.selectedMoves = attacks.slice(-4);
                if (p.selectedMoves.length === 0 && available.length > 0) p.selectedMoves = available.slice(-4);
            }
        });

        this.render();
    }

    render() {
        const pokemon = this.app.currentParty[this.currentConfigPokemonIndex];

        // タブ描画
        if (!this.dom.moveConfigTabs) {
            console.error("moveConfigTabs element not found");
            return;
        }

        this.dom.moveConfigTabs.innerHTML = this.app.currentParty.map((p, i) => `
            <button class="tab-btn ${i === this.currentConfigPokemonIndex ? 'active' : ''}" data-index="${i}">
                <img src="${Utils.getSpriteUrl(p['図鑑No'])}" class="pixel-art">
                <span>${p.name}</span>
            </button>
        `).join('');

        this.dom.moveConfigTabs.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.audio.playSe('select');
                this.currentConfigPokemonIndex = parseInt(btn.dataset.index);
                this.render();
            });
        });

        // 習得可能技リスト描画
        const availableMoves = pokemon.moves.filter(m => m['習得レベル'] <= this.app.battleSettings.playerLevel);

        // 習得経路と必要レベルによるフィルタリング
        const filteredMoves = availableMoves.filter(m => MoveUtils.isMoveAllowed(m, this.app.battleSettings.playerLevel));

        this.dom.learnableMovesList.innerHTML = filteredMoves.map((m, i) => {
            const isChecked = pokemon.selectedMoves.some(sm => sm['技名'] === m['技名']);
            const moveData = this.app.loader.getMoveDetails(m['技名']);

            // タイプに基づいた背景色クラスを決定
            const typeClass = MoveUtils.getTypeColorClass(moveData ? moveData['タイプ'] : 'ノーマル');

            return `
            <label class="move-check-item ${isChecked ? 'checked' : ''} ${typeClass} border-l-4">
                <div class="flex flex-col">
                    <span class="font-bold text-sm">${m['技名']}</span>
                    <span class="text-xs text-slate-700">威力:${moveData ? moveData['威力'] : '?'} / ${moveData ? moveData['タイプ'] : 'ノーマル'}</span>
                </div>
                <input type="checkbox" value="${i}" ${isChecked ? 'checked' : ''}>
            </label>
            `;
        }).join('');

        // チェックボックスイベント
        this.dom.learnableMovesList.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', (e) => {
                const moveIndex = parseInt(e.target.value);
                const targetMove = filteredMoves[moveIndex];

                if (e.target.checked) {
                    if (pokemon.selectedMoves.length >= 4) {
                        alert("わざは 4つまでしか おぼえられません");
                        e.target.checked = false;
                        return;
                    }
                    pokemon.selectedMoves.push(targetMove);
                } else {
                    if (pokemon.selectedMoves.length <= 1) {
                        alert("わざは 1つ以上 必要です");
                        e.target.checked = true;
                        return;
                    }
                    pokemon.selectedMoves = pokemon.selectedMoves.filter(m => m['技名'] !== targetMove['技名']);
                }
                this.audio.playSe('select');
                this.render();
            });
        });

        // セット中の技リスト描画
        this.dom.currentMovesList.innerHTML = pokemon.selectedMoves.map(m => {
            const moveData = this.app.loader.getMoveDetails(m['技名']);
            const typeClass = MoveUtils.getTypeColorClass(moveData ? moveData['タイプ'] : 'ノーマル');

            return `
            <div class="p-2 bg-slate-50 border rounded text-sm flex justify-between ${typeClass} border-l-4">
                <span class="font-bold">${m['技名']}</span>
                <span class="text-slate-700">${moveData ? moveData['タイプ'] : 'ノーマル'}</span>
            </div>
            `;
        }).join('');

        this.app.updateCommandMoveDisplayFromParty();
    }

    // タイプに基づいた背景色クラスを返す
    getTypeColorClass(type) {
        const typeColors = {
            'ノーマル': 'border-gray-400 bg-gray-50',
            'ほのお': 'border-red-500 bg-red-50',
            'みず': 'border-blue-500 bg-blue-50',
            'でんき': 'border-yellow-500 bg-yellow-50',
            'くさ': 'border-green-500 bg-green-50',
            'こおり': 'border-cyan-400 bg-cyan-50',
            'かくとう': 'border-orange-700 bg-orange-50',
            'どく': 'border-purple-500 bg-purple-50',
            'じめん': 'border-amber-700 bg-amber-50',
            'ひこう': 'border-sky-300 bg-sky-50',
            'エスパー': 'border-pink-400 bg-pink-50',
            'むし': 'border-lime-600 bg-lime-50',
            'いわ': 'border-stone-500 bg-stone-50',
            'ゴースト': 'border-indigo-600 bg-indigo-50',
            'ドラゴン': 'border-indigo-700 bg-indigo-50',
            'あく': 'border-slate-700 bg-slate-100',
            'はがね': 'border-zinc-500 bg-zinc-50',
            'フェアリー': 'border-pink-300 bg-pink-50'
        };

        return typeColors[type] || 'border-gray-400 bg-gray-50';
    }
}
