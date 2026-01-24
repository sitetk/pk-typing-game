/**
 * バトル進行管理クラス
 * リファクタリング版: Async/Await導入による可読性向上とロジック整理
 */
class BattleManager {
    static PHASE = {
        MENU: 'MENU',
        MOVE: 'MOVE',
        ITEM: 'ITEM',
        ITEM_TARGET: 'ITEM_TARGET',
        POKEMON: 'POKEMON',
        TYPING: 'TYPING',
        EXEC: 'EXEC',
        END: 'END'
    };

    /**
     * 待機用ユーティリティ
     */
    static wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    constructor(partyData, playerLevel, enemyPartyData, enemyLevel, typingEngine, allItems, options = {}) {
        // --- 初期化処理 ---
        this.typing = typingEngine;
        this.allItems = allItems || [];
        this.options = options;

        // イベントハンドラ
        this.onPhaseChange = null;
        this.onUpdateUI = null;
        this.onMessage = null;
        this.onBattleEnd = null;
        this.onPokemonChange = null;
        this.onEffect = null;
        this.onEnemyDefeat = null;
        this.onEnemyCapture = null;
        this.onMoveSelect = null;
        this.onMoveSelect = null;

        // パーティ初期化
        this.initParties(partyData, playerLevel, enemyPartyData, enemyLevel);

        // インベントリ初期化
        this.initInventory();

        // 状態初期化
        this.phase = BattleManager.PHASE.MENU;
        this.currentMove = null;
        this.pendingItem = null;
        this.isFaintedSwitch = false; // 死に出しフラグ
    }

    initParties(partyData, playerLevel, enemyPartyData, enemyLevel) {
        // 味方
        this.party = partyData.map(data => {
            const entity = this.createEntity(data, playerLevel);
            if (Array.isArray(data.selectedMoves) && data.selectedMoves.length > 0) {
                entity.moves = data.selectedMoves.map(move => ({ ...move }));
            }
            return entity;
        });
        // 先頭の生存ポケモンを繰り出す
        this.player = this.party.find(p => p.hp > 0) || this.party[0];

        // 敵
        this.enemyParty = Array.isArray(enemyPartyData) ? enemyPartyData : [enemyPartyData];
        this.enemyPartyEntities = this.enemyParty.map(data => this.createEntity(data, enemyLevel));
        this.enemyIndex = 0;
        this.enemy = this.enemyPartyEntities[0];
    }

    initInventory() {
        if (this.allItems.length === 0) console.warn("BattleManager: Item list is empty.");
        this.inventory = this.allItems.map((item, index) => ({
            ...item,
            id: String(index + 1).padStart(2, '0'),
            count: 10
        }));
    }

    createEntity(data, level) {
        // データ個別のレベルがあればそれを優先
        const actualLevel = (data.level !== undefined) ? data.level : level;
        const maxHp = Math.floor(data['HP'] * actualLevel / 20) + 20;

        // 技構成ロジック
        let availableMoves = [];
        if (data.moves) {
            availableMoves = data.moves.filter(m => {
                const route = m['経路'] || '';
                const isLevelOk = (m['習得レベル'] || 999) <= actualLevel;
                const isNotStatus = m['分類'] !== 'へんか';
                return (route.includes('レベルアップ') || route.includes('初期')) && isLevelOk && isNotStatus;
            });
        }
        if (availableMoves.length === 0) {
            availableMoves = [{ '技名': 'たいあたり', '威力': 40, 'タイプ': 'ノーマル', '分類': '物理', 'PP': 35 }];
        }
        // 敵などのためにランダムまたは最後の方の技を採用
        if (availableMoves.length > 4) availableMoves = availableMoves.slice(-4);

        return {
            ...data,
            level: actualLevel,
            maxHp: maxHp,
            hp: (data.currentHp !== undefined) ? data.currentHp : maxHp,
            atk: Math.floor((data.Attack || 50) * actualLevel / 50) + 5,
            def: Math.floor((data.Defense || 50) * actualLevel / 50) + 5,
            spd: Math.floor((data.Speed || 50) * actualLevel / 50) + 5,
            moves: availableMoves,
            isFainted: false
        };
    }

    // --- 進行制御 ---

    async start() {
        if (this.onPokemonChange) this.onPokemonChange('init', this.player, this.enemy);
        this.notifyUpdate();

        if (this.options.isTrainerBattle && this.options.trainerData) {
            await this.performTrainerStart();
        } else {
            await this.performWildStart();
        }

        // プレイヤーのターン開始
        await this.startPlayerPhase();
    }

    async performTrainerStart() {
        const trName = this.options.trainerData.name;
        const startMsg = this.options.trainerData.message_start || "勝負だ！";

        this.message(`${trName} が 勝負を しかけてきた！`);
        await BattleManager.wait(2000);

        this.message(`「${startMsg}」`, 'enemy');
        await BattleManager.wait(2000);

        this.message(`${trName} は ${this.enemy.name} をくりだした！`);
        await BattleManager.wait(1500);
    }

    async performWildStart() {
        const suffix = this.enemyPartyEntities.length > 1 ? "たち" : "";
        const startMsg = this.options.startMessage || `あ！ やせいの ${this.enemy.name}${suffix} が とびだしてきた！`;
        this.message(startMsg);
        await BattleManager.wait(1500);
    }

    async startPlayerPhase() {
        this.message(`ゆけっ！ ${this.player.name}！`);
        this.notifyUpdate();
        await BattleManager.wait(1500);

        this.setPhase(BattleManager.PHASE.MENU);
        this.message(`${this.player.name} は どうする？`);
    }

    // --- アクション選択 (同期) ---

    returnToMenu() {
        this.setPhase(BattleManager.PHASE.MENU);
        this.message(`${this.player.name} は どうする？`);
    }

    setPhase(newPhase) {
        this.phase = newPhase;
        if (this.onPhaseChange) this.onPhaseChange(newPhase);
    }

    selectMove(moveIndex) {
        if (this.phase !== BattleManager.PHASE.MOVE) return;
        const move = this.player.moves[moveIndex];
        if (!move || move['PP'] <= 0) {
            this.message("PPが たりません！");
            return;
        }
        this.currentMove = move;
        if (this.onMoveSelect) this.onMoveSelect(move);
        this.setPhase(BattleManager.PHASE.TYPING);
    }

    // --- アイテム使用フロー ---

    useItem(itemId) {
        const itemEntry = this.inventory.find(i => i.id === itemId);
        if (!itemEntry || itemEntry.count <= 0) return;

        // トレーナー戦ブロック
        if (itemEntry['効果タイプ'] === 'CATCH' && this.options.isTrainerBattle) {
            this.blockCatchAction();
            return;
        }

        if (itemEntry['対象'] === 'PLAYER' && itemEntry['効果タイプ'] === 'HEAL') {
            this.pendingItem = itemEntry;
            this.setPhase(BattleManager.PHASE.ITEM_TARGET);
            this.message("だれに つかいますか？");
            return;
        }

        // 即時使用（敵へのボール、あるいは戦闘中の自分へのアイテム）
        this.processItemTurn(itemEntry, null);
    }

    useItemOnParty(partyIndex) {
        if (this.phase !== BattleManager.PHASE.ITEM_TARGET || !this.pendingItem) return;
        const target = this.party[partyIndex];
        if (!target) return;

        this.processItemTurn(this.pendingItem, target);
        this.pendingItem = null;
    }

    async blockCatchAction() {
        this.message("おっと！ 人のポケモンを ゲットすることは");
        await BattleManager.wait(2000);
        this.message("どろぼうに なってしまうぞ！");
        await BattleManager.wait(2000);
        this.setPhase(BattleManager.PHASE.MENU);
        this.message(`${this.player.name} は どうする？`);
    }

    /**
     * アイテム使用ターンの実行
     */
    async processItemTurn(item, target) {
        this.setPhase(BattleManager.PHASE.EXEC);
        item.count--;
        this.message(`${this.player.name} は ${item['名前']} を つかった！`);
        await BattleManager.wait(1000);

        const effectType = item['効果タイプ'];
        let turnEnd = true;

        if (effectType === 'HEAL') {
            const actualTarget = target || this.player;
            await this.performHeal(actualTarget, parseFloat(item['効果値']), item);
        } else if (effectType === 'CATCH') {
            const success = await this.performCatch();
            if (success) {
                turnEnd = false; // 捕獲成功ならターン終了処理ではなく戦闘終了へ
            }
        } else {
            this.message("しかし なにも おこらなかった！");
            await BattleManager.wait(1000);
        }

        if (turnEnd) {
            await this.endPlayerTurn();
        }
    }

    async performHeal(target, value, item) {
        // 瀕死チェック (げんきのかけら以外)
        if (target.hp <= 0 && item['名前'] !== 'げんきのかけら') {
            this.message("ひんしの ポケモンには つかえません！");
            item.count++; // 返却
            await BattleManager.wait(1000);
            return;
        }

        const oldHp = target.hp;
        target.hp = Math.min(target.maxHp, target.hp + value);
        const healAmount = target.hp - oldHp;

        this.message(`${target.name} の HPが ${healAmount} かいふくした！`);
        this.notifyUpdate();
        await BattleManager.wait(1000);
    }

    async handleMiss() {
        const dmg = Math.max(1, Math.floor(this.player.maxHp * 0.1));
        this.player.hp = Math.max(0, this.player.hp - dmg);
        this.message("タイプミス！ ダメージを うけた！", 'enemy'); // red message
        if (this.onEffect) this.onEffect('damage', 'player');
        this.notifyUpdate();
        if (this.player.hp <= 0) {
            await this.handlePlayerFaint();
        }
    }

    async applyPerfectBonus() {
        if (this.player.hp <= 0) return;
        const heal = Math.floor(this.player.maxHp * 0.1);
        if (heal > 0 && this.player.hp < this.player.maxHp) {
            const oldHp = this.player.hp;
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
            const recovered = this.player.hp - oldHp;
            if (recovered > 0) {
                this.message(`ノーミスボーナス！ HPが ${recovered} かいふくした！`);
                this.notifyUpdate();
                await BattleManager.wait(500);
            }
        }
    }

    async performCatch() {
        this.message(`${this.player.name} は モンスターボールを なげた！`);
        if (this.onEffect) this.onEffect('ball-throw');
        await BattleManager.wait(800); // 投げる時間

        if (this.onEffect) this.onEffect('ball-shake');

        // 捕獲計算
        const hpPercent = (this.enemy.hp / this.enemy.maxHp) * 100;
        let catchRate = 0.45;
        if (hpPercent <= 50) catchRate = 0.60;
        if (hpPercent <= 20) catchRate = 0.80;
        if (hpPercent <= 5) catchRate = 0.90;

        // 揺れ演出待ち
        await BattleManager.wait(3000);

        if (Math.random() < catchRate) {
            if (this.onEffect) this.onEffect('ball-captured');
            this.message("やったー！ ポケモンを つかまえた！");
            if (this.onEnemyCapture) await this.onEnemyCapture(this.enemy);

            // 捕獲処理
            const caught = { ...this.enemy, isFainted: this.enemy.hp <= 0 };
            this.party.push(caught);

            await BattleManager.wait(2000);
            if (this.onBattleEnd) this.onBattleEnd('catch');
            return true;
        } else {
            if (this.onEffect) this.onEffect('ball-escape');
            this.message("あ！ モンスターボールから でてしまった！");
            await BattleManager.wait(1000);
            return false;
        }
    }

    // --- ポケモン交代フロー ---

    async switchPokemon(index) {
        const nextPokemon = this.party[index];
        if (nextPokemon === this.player) return this.message("その ポケモンは すでに ばに でています！");
        if (nextPokemon.hp <= 0) return this.message("その ポケモンは ひんしで たたかえません！");

        // 死に出しか、通常交代か
        if (this.isFaintedSwitch) {
            await this.performSwitch(nextPokemon, false);
            // 死に出しの場合はメニューへ
            this.isFaintedSwitch = false;
            this.setPhase(BattleManager.PHASE.MENU);
            this.message(`${this.player.name} は どうする？`);
        } else {
            // 通常交代はターン消費
            this.setPhase(BattleManager.PHASE.EXEC);
            await this.performSwitch(nextPokemon, true);
            await this.endPlayerTurn();
        }
    }

    async performSwitch(nextPokemon, isReturnMsg) {
        if (isReturnMsg) {
            this.message(`${this.player.name} もどれ！`);
            await BattleManager.wait(1000);
        }

        this.player = nextPokemon;
        this.notifyUpdate();
        if (this.onPokemonChange) this.onPokemonChange('switch', this.player, this.enemy);

        this.message(`いけっ！ ${this.player.name}！`);
        await BattleManager.wait(1000);
    }

    // --- 逃走フロー ---

    async tryEscape() {
        if (this.phase !== BattleManager.PHASE.MENU) return;
        if (this.options.isTrainerBattle) return this.message("ダメだ！ トレーナーとの 戦いだ！");

        this.setPhase(BattleManager.PHASE.EXEC);
        this.message(`${this.player.name} は にげだした！`);
        await BattleManager.wait(1000);

        const spdRatio = this.player.spd / (this.enemy.spd || 1);
        const escapeRate = Math.min(1.0, (spdRatio * 0.5) + 0.25);

        if (Math.random() < escapeRate) {
            this.message("うまく にげきれた！");
            await BattleManager.wait(1000);
            if (this.onBattleEnd) this.onBattleEnd('escape');
        } else {
            this.message("しかし まわりこまれてしまった！");
            await BattleManager.wait(1000);
            await this.endPlayerTurn();
        }
    }

    // --- 戦闘ターン実行 (攻撃) ---

    commitTurn(metrics = {}) {
        // metrics: { speedMultiplier: number, isPerfect: boolean }
        // タイピング完了時に呼ばれる
        if (this.phase !== BattleManager.PHASE.TYPING) return;
        this.setPhase(BattleManager.PHASE.EXEC);
        this.executeCombatTurn(metrics); // 非同期メソッドを開始（awaitしない）
    }

    /**
     * 1ターンの戦闘処理（プレイヤー技 -> 敵技 or その逆）
     */
    async executeCombatTurn(metrics = {}) {
        // 敵の技決定
        const enemyMove = this.enemy.moves[Math.floor(Math.random() * this.enemy.moves.length)];

        // 行動順決定
        let queue = [];
        if (this.player.spd >= this.enemy.spd) {
            queue = [
                { actor: this.player, target: this.enemy, move: this.currentMove, isPlayer: true },
                { actor: this.enemy, target: this.player, move: enemyMove, isPlayer: false }
            ];
        } else {
            queue = [
                { actor: this.enemy, target: this.player, move: enemyMove, isPlayer: false },
                { actor: this.player, target: this.enemy, move: this.currentMove, isPlayer: true }
            ];
        }

        // 行動実行ループ
        for (const action of queue) {
            // 戦闘終了フラグ等のチェック
            if (this.phase === BattleManager.PHASE.END) break;

            // 行動者が生存しているか、ターゲットが生存しているか
            if (action.actor.hp <= 0) continue;
            // 交代などでターゲットが変わる可能性も考慮（今回はシンプルに）
            if (action.target.hp <= 0) continue;

            // 攻撃実行
            const result = await this.performAttack(action.actor, action.target, action.move, action.isPlayer, metrics);

            // どちらかが倒れた場合
            if (result === 'fainted') {
                if (action.target === this.enemy) {
                    await this.handleEnemyFaint();
                } else {
                    await this.handlePlayerFaint();
                }
                // 誰かが倒れたらこのターンの後続処理は中断（ルールによるが一般的に）
                return;
            }
        }

        // ターン終了、次へ
        if (this.phase !== BattleManager.PHASE.END) {
            this.setPhase(BattleManager.PHASE.MENU);
            this.message(`${this.player.name} は どうする？`);
        }
    }

    /**
     * 敵だけの攻撃ターン（アイテム使用失敗や交代後など）
     */
    async endPlayerTurn() {
        // プレイヤー行動後のウェイト
        await BattleManager.wait(500);

        if (this.enemy.hp > 0) {
            const enemyMove = this.enemy.moves[Math.floor(Math.random() * this.enemy.moves.length)];
            const result = await this.performAttack(this.enemy, this.player, enemyMove, false);

            if (result === 'fainted') {
                await this.handlePlayerFaint();
                return;
            }
        }

        // 次のターンへ
        this.setPhase(BattleManager.PHASE.MENU);
        this.message(`${this.player.name} は どうする？`);
    }

    /**
     * 単発攻撃処理
     * @returns {Promise<string>} 結果ステータス ('ok' | 'fainted')
     */
    async performAttack(attacker, defender, move, isPlayerSide, metrics = {}) {
        const msgType = isPlayerSide ? 'normal' : 'enemy';
        this.message(`${attacker.name} の ${move['技名']}！`, msgType);

        if (move['PP'] > 0) move['PP']--;

        // 攻撃アニメーション
        if (this.onEffect) this.onEffect('attack', isPlayerSide ? 'player' : 'enemy');
        await BattleManager.wait(1500);

        // ダメージ計算 (文字数ベース)
        let characterCount = 0;

        if (isPlayerSide && metrics.typedLength) {
            // プレイヤーは実際に入力した文字数
            characterCount = metrics.typedLength;
        } else {
            // 敵は標準的なローマ字変換の最短パターンを使用
            const kanaName = this.typing.normalize(move['技名']);
            const romajiOptions = this.typing.generateOptions(kanaName);
            characterCount = (romajiOptions[0] || '').length;
        }

        if (characterCount <= 0) {
            this.message("しかし うまくきまらなかった！", msgType);
            await BattleManager.wait(1000);
            return 'ok';
        }

        // 基礎威力: 1文字 = 10
        const basePower = characterCount * 10;

        // 簡易ダメージ計算式 (レベル・ステータス補正)
        const levelFactor = Math.floor(attacker.level * 2 / 5 + 2);
        const statRatio = attacker.atk / defender.def;
        let damage = Math.floor((levelFactor * basePower * statRatio / 50) + 2);
        damage = Math.floor(damage * (Math.random() * 0.15 + 0.85));

        // Speed Critical Bonus
        if (isPlayerSide && metrics.speedMultiplier && metrics.speedMultiplier > 1) {
            damage = Math.floor(damage * metrics.speedMultiplier);
            this.message("スピードボーナス！ ダメージ2倍！");
            await BattleManager.wait(500);
        }

        // ダメージ適用
        defender.hp = Math.max(0, defender.hp - damage);

        // 被弾アニメーション & SE
        if (this.onEffect) this.onEffect('damage', isPlayerSide ? 'enemy' : 'player');
        this.notifyUpdate();

        // ゲージ減少待ち
        await BattleManager.wait(1000);

        // 急所や効果抜群などのメッセージを入れるならここ

        if (defender.hp <= 0) return 'fainted';
        return 'ok';
    }

    // --- 撃破処理 ---

    async handleEnemyFaint() {
        if (this.onEffect) this.onEffect('fainted', 'enemy');
        this.message(`${this.enemy.name} は たおれた！`);
        await BattleManager.wait(2000);

        // 次の敵がいるか
        const defeatedEnemy = this.enemy;
        if (this.onEnemyDefeat) await this.onEnemyDefeat(defeatedEnemy);

        if (this.onEnemyDefeat && this.onEnemyDefeat.constructor.name === 'AsyncFunction') {
            // already awaited above
        }

        if (this.enemyIndex < this.enemyPartyEntities.length - 1) {
            this.enemyIndex++;
            this.enemy = this.enemyPartyEntities[this.enemyIndex];

            this.message(`あいては ${this.enemy.name} を くりだした！`);
            if (this.onPokemonChange) this.onPokemonChange('switch', this.player, this.enemy);
            this.notifyUpdate();

            await BattleManager.wait(1500);

            // 敵を出した後、即座にこちらのターンになる（勝ち抜きルール）
            this.setPhase(BattleManager.PHASE.MENU);
            this.message(`${this.player.name} は どうする？`);
        } else {
            // 全滅（勝利）
            await this.handleVictory();
        }
    }

    async handlePlayerFaint() {
        if (this.onEffect) this.onEffect('fainted', 'player');
        this.message(`${this.player.name} は たおれた！`);
        await BattleManager.wait(2000);

        const hasAlive = this.party.some(p => p.hp > 0);
        if (hasAlive) {
            this.message("つぎの ポケモンを えらんでください");
            this.isFaintedSwitch = true;
            this.setPhase(BattleManager.PHASE.POKEMON);
        } else {
            await this.handleDefeat();
        }
    }

    async handleVictory() {
        const winMsg = (this.options.isTrainerBattle && this.options.trainerData.message_win)
            ? this.options.trainerData.message_win : null;

        if (winMsg) {
            this.message(`「${winMsg}」`, 'enemy');
            await BattleManager.wait(2000);
        }

        this.phase = BattleManager.PHASE.END;
        if (this.onBattleEnd) this.onBattleEnd('win');
    }

    async handleDefeat() {
        const loseMsg = (this.options.isTrainerBattle && this.options.trainerData.message_lose)
            ? this.options.trainerData.message_lose : null;

        if (loseMsg) {
            this.message(`「${loseMsg}」`, 'enemy');
            await BattleManager.wait(2000);
        }

        this.message("めのまえが まっくらに なった...");
        await BattleManager.wait(2000);

        this.phase = BattleManager.PHASE.END;
        if (this.onBattleEnd) this.onBattleEnd('lose');
    }

    // --- 通知ヘルパー ---

    message(msg, type = 'normal') {
        if (this.onMessage) this.onMessage(msg, type);
    }

    notifyUpdate() {
        if (this.onUpdateUI) this.onUpdateUI(this.player, this.enemy);
    }

    async updateLevel(entity, newLevel) {
        const oldMaxHp = entity.maxHp;
        entity.level = newLevel;
        // Calculation based on createEntity logic
        // const maxHp = Math.floor(data['HP'] * actualLevel / 20) + 20;
        // entity has data merged
        entity.maxHp = Math.floor((entity['HP'] || 50) * newLevel / 20) + 20;

        const hpDiff = entity.maxHp - oldMaxHp;
        if (hpDiff > 0) {
            entity.hp += hpDiff;
        }

        entity.atk = Math.floor((entity['Attack'] || 50) * newLevel / 50) + 5;
        entity.def = Math.floor((entity['Defense'] || 50) * newLevel / 50) + 5;
        entity.spd = Math.floor((entity['Speed'] || 50) * newLevel / 50) + 5;

        this.notifyUpdate();
    }
}
