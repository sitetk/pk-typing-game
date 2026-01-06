/**
 * データロード管理クラス
 * CSVデータのフェッチとパースを担当
 */
class DataLoader {
    constructor() {
        this.pokemonList = [];
        this.skillList = [];
        this.moveDataMap = new Map();
        this.itemList = [];
        this.stageList = [];
        this.wildEncounterList = [];
        this.trainerList = [];
        this.getStageRewards = [];
    }

    async fetchCSV(url) {
        try {
            console.log(`[DataLoader] Fetching: ${url}`);
            const response = await fetch(url);
            if (!response.ok) {
                console.warn(`File not found or error: ${url}`);
                return [];
            }

            const buffer = await response.arrayBuffer();

            // UTF-8デコード試行
            let decoder = new TextDecoder('utf-8');
            let text = decoder.decode(buffer);

            // 文字化け検出ロジック
            if (text.includes('\uFFFD')) {
                console.log(`[DataLoader] Encoding issue detected in ${url}. Retrying with windows-31j...`);
                try {
                    decoder = new TextDecoder('windows-31j');
                    text = decoder.decode(buffer);
                } catch (e) {
                    console.warn("Shift-JIS/windows-31j decoding failed, reverting to UTF-8.");
                }
            }

            text = text.replace(/^\uFEFF/, '');

            const rows = text.split(/\r\n|\n|\r/).filter(line => line.trim() !== "");
            if (rows.length < 2) return [];

            const firstLine = rows[0];
            const separator = firstLine.includes('\t') ? '\t' : ',';
            const headers = firstLine.split(separator).map(h => h.trim().replace(/^"|"$/g, ''));
            // console.log(`[DataLoader] Headers for ${url}:`, headers);

            return rows.slice(1).map((row) => {
                const values = row.split(separator);
                const item = {};
                headers.forEach((header, index) => {
                    let val = values[index] ? values[index].trim() : '';
                    val = val.replace(/^"|"$/g, '');
                    item[header] = val;
                });
                return item;
            });

        } catch (error) {
            console.error(`[DataLoader] CSV Load Failed: ${url}`, error);
            throw error;
        }
    }

    async load() {
        try {
            const [pkRaw, skillRaw, moveRaw, itemRaw, stageRaw, wildRaw, trainerRaw, getStageRaw] = await Promise.all([
                this.fetchCSV('assets/data/pk-list.csv'),
                this.fetchCSV('assets/data/skill-list.csv'),
                this.fetchCSV('assets/data/move-list.csv'),
                this.fetchCSV('assets/data/item-list.csv'),
                this.fetchCSV('assets/data/stage-list.csv'),
                this.fetchCSV('assets/data/wild-encounter.csv'),
                this.fetchCSV('assets/data/trainer-list.csv'),
                this.fetchCSV('assets/data/get_stage_rewards.csv')
            ]);

            const baseFormMap = new Map();
            const isNormalForm = (formName) => String(formName || '').trim() === '通常';
            pkRaw.forEach(pokemon => {
                const dexNo = String(pokemon['図鑑No']);
                const currentForm = String(pokemon['フォルム名（日本語）'] || '').trim();
                const existing = baseFormMap.get(dexNo);
                if (!existing) {
                    baseFormMap.set(dexNo, pokemon);
                    return;
                }
                const existingForm = String(existing['フォルム名（日本語）'] || '').trim();
                if (isNormalForm(currentForm) && !isNormalForm(existingForm)) {
                    baseFormMap.set(dexNo, pokemon);
                }
            });
            this.pokemonList = Array.from(baseFormMap.values());
            this.skillList = skillRaw.filter(s => s['フォルム名'] === '通常');
            this.itemList = itemRaw;
            this.stageList = stageRaw;
            this.wildEncounterList = wildRaw;
            this.trainerList = trainerRaw;
            this.getStageRewards = this.normalizeGetStageRewards(getStageRaw);

            // 技データのマッピング
            this.moveDataMap.clear();
            moveRaw.forEach(m => {
                const key = m['技名'] || m['名前'];
                if (key) this.moveDataMap.set(key, m);
            });

            console.log(`[DataLoader] Loaded: ${this.pokemonList.length} Pokemon, ${this.stageList.length} Stages.`);
            return {
                pokemon: this.pokemonList,
                skills: this.skillList,
                moves: moveRaw,
                items: this.itemList,
                stages: this.stageList,
                wilds: this.wildEncounterList,
                trainers: this.trainerList,
                getStageRewards: this.getStageRewards
            };
        } catch (e) {
            console.error("[DataLoader] Critical Load Error", e);
            throw e;
        }
    }

    normalizeGetStageRewards(raw = []) {
        if (!Array.isArray(raw)) return [];
        const sanitize = (value) => (value || '').toString().trim();
        return raw.map(row => {
            const entries = [1, 2, 3].map(idx => {
                const type = sanitize(row[`type_${idx}`]).toUpperCase();
                const name = sanitize(row[`reward_name_${idx}`]);
                const levelRaw = sanitize(row[`reward_level_${idx}`]);
                if (!type || !name) return null;
                const level = levelRaw ? Number(levelRaw) : null;
                return { type, name, level };
            }).filter(Boolean);
            return {
                stageId: sanitize(row.stage_id),
                stageName: sanitize(row.stage_name),
                getMode: sanitize(row.get_mode).toUpperCase() || 'ALL',
                rewardSlots: entries
            };
        }).filter(entry => entry.stageId && entry.rewardSlots.length);
    }

    getStageReward(stageId) {
        if (!stageId) return null;
        return this.getStageRewards.find(entry => entry.stageId === stageId) || null;
    }

    getPokemonDetails(idOrName) {
        // IDまたは名前で検索
        let base = null;
        // 数字のみならID検索
        if (/^\d+$/.test(String(idOrName))) {
            base = this.pokemonList.find(p => String(p['図鑑No']) === String(idOrName));
        } else {
            // 名前検索
            base = this.pokemonList.find(p => p['名前（日本語）'] === idOrName);
        }

        if (!base) return null;

        const learnset = this.skillList.filter(s => s['ポケモン名'] === base['名前（日本語）']);

        // ここではフィルタリングせず、全ての候補技に情報を付与して返す
        let allMoves = learnset.map(learnItem => {
            const moveName = learnItem['技名'];
            const moveDetail = this.moveDataMap.get(moveName);

            // skill-list.csv の情報
            const route = learnItem['経路'] || '';
            const levelRaw = learnItem['レベル'] || '';

            // move-list.csv の情報
            const category = moveDetail ? (moveDetail['分類'] || '') : '';

            // 習得レベルの解析
            let learnLevel = 999;
            if (route.includes('初期') || levelRaw === '1') {
                learnLevel = 1;
            } else {
                const lv = parseInt(levelRaw);
                if (!isNaN(lv)) {
                    learnLevel = lv;
                }
            }

            const parseVal = (val, defaultVal) => {
                const parsed = parseInt(val);
                return isNaN(parsed) ? defaultVal : parsed;
            };

            return {
                ...learnItem,
                ...moveDetail,
                '技名': moveName,
                '威力': moveDetail ? parseVal(moveDetail['威力'], 40) : 40,
                'PP': moveDetail ? parseVal(moveDetail['PP'], 10) : 10,
                '分類': category,
                'タイプ': moveDetail ? moveDetail['タイプ'] : 'ノーマル',

                // 判定用データ
                '経路': route,
                '習得レベル': learnLevel
            };
        });

        // ソートのみしておく (レベル順)
        allMoves.sort((a, b) => a['習得レベル'] - b['習得レベル']);

        return {
            ...base,
            name: base['名前（日本語）'],
            type1: base['タイプ1'],
            type2: base['タイプ2'],
            HP: parseInt(base['HP']) || 50,
            Attack: parseInt(base['攻撃']) || 50,
            Defense: parseInt(base['防御']) || 50,
            Speed: parseInt(base['素早さ']) || 50,
            moves: allMoves
        };
    }

    getMoveDetails(name) {
        if (!name) return null;
        return this.moveDataMap.get(name) || null;
    }

    getTrainerByStageId(stageId) {
        if (!stageId) return null;
        const trainer = this.trainerList.find(t => t.stage_id === stageId);
        if (!trainer) return null;

        // トレーナーのポケモンパーティを構築
        const party = [];
        for (let i = 1; i <= 6; i++) {
            const nameKey = `pk${i}_name`;
            const levelKey = `pk${i}_level`;
            const pokemonName = trainer[nameKey];
            const pokemonLevel = trainer[levelKey];

            if (pokemonName && pokemonName.trim()) {
                const level = pokemonLevel ? parseInt(pokemonLevel, 10) : 5;
                party.push({
                    name: pokemonName.trim(),
                    level: level
                });
            }
        }

        return {
            trainer_id: trainer.trainer_id,
            stage_id: trainer.stage_id,
            name: trainer.name,
            reward: trainer.reward ? parseInt(trainer.reward, 10) : 0,
            message_start: trainer.message_start || '',
            message_win: trainer.message_win || '',
            message_lose: trainer.message_lose || '',
            party: party
        };
    }

    getWildEncounter(stageId) {
        if (!stageId) return [];
        return this.wildEncounterList.filter(entry => entry.stage_id === stageId);
    }
}
