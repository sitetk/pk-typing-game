/**
 * 経験値テーブルと計算ロジック
 * 簡易的な3乗カーブを採用 (Lv^3)
 */
const ExpTable = {
    MAX_LEVEL: 100,

    /**
     * 指定レベルに必要な累計経験値を計算
     * @param {number} level 
     * @returns {number}
     */
    getExpForLevel(level) {
        if (level <= 1) return 0;
        return Math.floor(Math.pow(level, 3));
    },

    /**
     * 現在の経験値からレベルを算出
     * @param {number} exp 
     * @returns {number} 1~100
     */
    getLevelFromExp(exp) {
        if (exp <= 0) return 1;
        // exp = level^3 => level = cbrt(exp)
        const level = Math.floor(Math.cbrt(exp));
        return Math.min(this.MAX_LEVEL, Math.max(1, level));
    },

    /**
     * 次のレベルまでの必要経験値を取得
     * @param {number} currentLevel 
     * @param {number} currentExp 
     * @returns {number}
     */
    getExpToNextLevel(currentLevel, currentExp) {
        if (currentLevel >= this.MAX_LEVEL) return 0;
        const nextLevelExp = this.getExpForLevel(currentLevel + 1);
        return Math.max(0, nextLevelExp - currentExp);
    },

    /**
     * 次のレベルの必要経験値総量を取得（バー計算用）
     */
    getNextLevelTotalExp(currentLevel) {
        return this.getExpForLevel(currentLevel + 1);
    }
};
