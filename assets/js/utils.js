/**
 * 汎用ユーティリティクラス
 */
class Utils {
    /**
     * ポケモンのスプライト画像URLを取得
     * @param {string|number} id ポケモン図鑑No
     * @param {boolean} back 背面画像かどうか
     * @returns {string} 画像URL
     */
    static getSpriteUrl(id, back = false) {
        return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon${back ? '/back' : ''}/${id}.png`;
    }

    /**
     * 指定されたミリ秒待機する
     * @param {number} ms 待機時間(ミリ秒)
     * @returns {Promise}
     */
    static wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
