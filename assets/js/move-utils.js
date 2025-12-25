/**
 * 汎用的なわざ・タイプ情報ユーティリティ
 */
const MoveUtils = (() => {
    const TYPE_COLOR_CLASSES = {
        'ノーマル': 'type-normal',
        'ほのお': 'type-fire',
        'みず': 'type-water',
        'でんき': 'type-electric',
        'くさ': 'type-grass',
        'こおり': 'type-ice',
        'かくとう': 'type-fighting',
        'どく': 'type-poison',
        'じめん': 'type-ground',
        'ひこう': 'type-flying',
        'エスパー': 'type-psychic',
        'むし': 'type-bug',
        'いわ': 'type-rock',
        'ゴースト': 'type-ghost',
        'ドラゴン': 'type-dragon',
        'あく': 'type-dark',
        'はがね': 'type-steel',
        'フェアリー': 'type-fairy'
    };

    const isLevelUpRoute = (move) => {
        const route = (move['経路'] || '').trim();
        return route === 'レベルアップ';
    };

    const isCategoryAttack = (move) => {
        const classification = (move['分類'] || '').trim();
        return classification !== 'へんか' && classification !== '変化';
    };

    const parseLearnLevel = (move) => {
        const raw = move['習得レベル'];
        const parsed = Number.isFinite(raw) ? raw : parseInt(raw);
        if (Number.isNaN(parsed)) {
            return Number.POSITIVE_INFINITY;
        }
        return parsed;
    };

    return {
        getTypeColorClass(type) {
            return TYPE_COLOR_CLASSES[type] || 'type-default';
        },

        isMoveAllowed(move, level = 0) {
            if (!move) return false;
            if (!isLevelUpRoute(move)) return false;
            if (!isCategoryAttack(move)) return false;

            const reqLevel = parseLearnLevel(move);
            const playerLevel = Number.isNaN(parseInt(level)) ? 0 : parseInt(level);
            return playerLevel >= reqLevel;
        }
    };
})();
