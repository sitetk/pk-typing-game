/**
 * 音声管理クラス
 * BGMとSEの再生、停止、音量調整などを管理する
 */
class AudioManager {
    constructor() {
        this.bgmFiles = {
            'title': 'assets/music/PokemonRG_Music/01op.wav',
            'rival_select': 'assets/music/PokemonRG_Music/05 ライバルあらわる.wav',
            'battle_wild': 'assets/music/PokemonRG_Music/07 戦い（ＶＳ野生ポケモン）.wav',
            'battle_trainer': 'assets/music/PokemonRG_Music/15 戦い（ＶＳトレーナー）.wav',
            'battle_gym': 'assets/music/PokemonRG_Music/28 戦い（ＶＳジムリーダー）.wav',
            'battle_rival': 'assets/music/PokemonRG_Music/43 ラストバトル（ＶＳライバル）.wav',
            'victory_wild': 'assets/music/PokemonRG_Music/08 勝利（ＶＳ野生ポケモン）.wav'
        };

        this.seFiles = {
            'attack': 'assets/music/se/重いパンチ2.mp3',
            'select': 'assets/music/se/カーソル移動2.mp3'
        };

        this.currentBgm = null;
        this.seElements = {};
        this.isMuted = false;
        
        // SEのプリロード
        this.preloadSe();
    }

    /**
     * SEを事前に読み込む
     */
    preloadSe() {
        for (const [key, path] of Object.entries(this.seFiles)) {
            const audio = new Audio(path);
            audio.preload = 'auto';
            this.seElements[key] = audio;
        }
    }

    /**
     * ミュート状態を切り替える
     * @returns {boolean} 現在のミュート状態 (true: ミュート中)
     */
    toggleMute() {
        this.isMuted = !this.isMuted;
        this.updateVolume();
        return this.isMuted;
    }

    /**
     * 音量を更新する
     */
    updateVolume() {
        const volume = this.isMuted ? 0 : 0.5;

        // BGMの音量更新
        if (this.currentBgm) {
            this.currentBgm.volume = volume;
        }

        // SEの音量設定（再生時に適用されるが、念のため）
        for (const key in this.seElements) {
            this.seElements[key].volume = volume;
        }
    }

    /**
     * BGMを再生する
     * @param {string} key BGMのキー
     * @param {boolean} loop ループ再生するかどうか (デフォルト: true)
     */
    playBgm(key, loop = true) {
        const path = this.bgmFiles[key];
        if (!path) {
            console.warn(`BGM not found: ${key}`);
            return;
        }

        // 既に同じBGMが再生中の場合は何もしない
        if (this.currentBgm && this.currentBgm.src.includes(encodeURI(path))) {
            // 音量だけは念のため再適用（ミュート解除時など）
            this.currentBgm.volume = this.isMuted ? 0 : 0.5;
            return;
        }

        // 再生中のBGMがあれば停止
        this.stopBgm();

        const audio = new Audio(path);
        audio.loop = loop;
        audio.volume = this.isMuted ? 0 : 0.5; 
        
        // 再生試行 (ブラウザの自動再生ポリシー対策)
        audio.play().then(() => {
            this.currentBgm = audio;
        }).catch(e => {
            console.log('BGM playback failed (autoplay policy?):', e);
            // ユーザー操作後に再生できるようにインスタンスだけ保持しておく等の対策も可能
            this.currentBgm = audio; 
        });
    }

    /**
     * 現在のBGMを停止する
     */
    stopBgm() {
        if (this.currentBgm) {
            this.currentBgm.pause();
            this.currentBgm.currentTime = 0;
            this.currentBgm = null;
        }
    }

    /**
     * SEを再生する
     * @param {string} key SEのキー
     */
    playSe(key) {
        const audio = this.seElements[key];
        if (!audio) {
            console.warn(`SE not found: ${key}`);
            return;
        }

        audio.volume = this.isMuted ? 0 : 0.5;

        // 連続再生のためにクローンを作成して再生、またはcurrentTimeリセット
        // ここでは簡易的にcurrentTimeリセット方式を採用
        if (audio.paused) {
            audio.play().catch(e => console.log('SE playback failed:', e));
        } else {
            audio.currentTime = 0;
            audio.play().catch(e => console.log('SE playback failed:', e));
        }
    }
}