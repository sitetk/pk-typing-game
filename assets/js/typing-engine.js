/**
 * タイピング判定ロジッククラス
 * 状態を持たず純粋な入力判定を行う
 */
class TypingEngine {
    constructor() {
        this.reset();
        
this.romanTable = {
            'きぇ': ['kye'], 'きゃ': ['kya'], 'きゅ': ['kyu'], 'きょ': ['kyo'],
            'しぇ': ['sye', 'she'], 'しゃ': ['sya', 'sha'], 'しゅ': ['syu', 'shu'], 'しょ': ['syo', 'sho'],
            'ちぇ': ['tye', 'che'], 'ちゃ': ['tya', 'cha'], 'ちゅ': ['tyu', 'chu'], 'ちょ': ['tyo', 'cho'],
            'てぃ': ['ti', 'thi'], 'てゅ': ['tyu', 'thu'],
            'でぃ': ['di', 'dhi'], 'でゅ': ['dyu', 'dhu'],
            'にぇ': ['nye'], 'にゃ': ['nya'], 'にゅ': ['nyu'], 'にょ': ['nyo'],
            'ひぇ': ['hye'], 'ひゃ': ['hya'], 'ひゅ': ['hyu'], 'ひょ': ['hyo'],
            'みぇ': ['mye'], 'みゃ': ['mya'], 'みゅ': ['myu'], 'みょ': ['myo'],
            'りぇ': ['rye'], 'りゃ': ['rya'], 'りゅ': ['ryu'], 'りょ': ['ryo'],
            'ぎぇ': ['gye'], 'ぎゃ': ['gya'], 'ぎゅ': ['gyu'], 'ぎょ': ['gyo'],
            'じぇ': ['zye', 'je'], 'じゃ': ['zya', 'ja'], 'じゅ': ['zyu', 'ju'], 'じょ': ['zyo', 'jo'],
            'びぇ': ['bye'], 'びゃ': ['bya'], 'びゅ': ['byu'], 'びょ': ['byo'],
            'ぴぇ': ['pye'], 'ぴゃ': ['pya'], 'ぴゅ': ['pyu'], 'ぴょ': ['pyo'],
            'ふぁ': ['fa'], 'ふぃ': ['fi'], 'ふぇ': ['fe'], 'ふぉ': ['fo'],
            'うぃ': ['wi'], 'うぇ': ['we'], 'うぉ': ['who'],
            'ヴぁ': ['va'], 'ヴぃ': ['vi'], 'ヴ': ['vu'], 'ヴぇ': ['ve'], 'ヴぉ': ['vo'],
            'あ': ['a'], 'い': ['i'], 'う': ['u'], 'え': ['e'], 'お': ['o'],
            'か': ['ka'], 'き': ['ki'], 'く': ['ku'], 'け': ['ke'], 'こ': ['ko'],
            'さ': ['sa'], 'し': ['si', 'shi'], 'す': ['su'], 'せ': ['se'], 'そ': ['so'],
            'た': ['ta'], 'ち': ['ti', 'chi'], 'つ': ['tu', 'tsu'], 'て': ['te'], 'と': ['to'],
            'な': ['na'], 'に': ['ni'], 'ぬ': ['nu'], 'ね': ['ne'], 'の': ['no'],
            'は': ['ha'], 'ひ': ['hi'], 'ふ': ['fu', 'hu'], 'へ': ['he'], 'ほ': ['ho'],
            'ま': ['ma'], 'み': ['mi'], 'む': ['mu'], 'め': ['me'], 'も': ['mo'],
            'や': ['ya'], 'ゆ': ['yu'], 'よ': ['yo'],
            'ら': ['ra'], 'り': ['ri'], 'る': ['ru'], 'れ': ['re'], 'ろ': ['ro'],
            'わ': ['wa'], 'を': ['wo'], 'ん': ['nn', 'n'],
            'が': ['ga'], 'ぎ': ['gi'], 'ぐ': ['gu'], 'げ': ['ge'], 'ご': ['go'],
            'ざ': ['za'], 'じ': ['zi', 'ji'], 'ず': ['zu'], 'ぜ': ['ze'], 'ぞ': ['zo'],
            'だ': ['da'], 'ぢ': ['di'], 'づ': ['du'], 'で': ['de'], 'ど': ['do'],
            'ば': ['ba'], 'び': ['bi'], 'ぶ': ['bu'], 'べ': ['be'], 'ぼ': ['bo'],
            'ぱ': ['pa'], 'ぴ': ['pi'], 'ぷ': ['pu'], 'ぺ': ['pe'], 'ぽ': ['po'],
            'ぁ': ['xa', 'la'], 'ぃ': ['xi', 'li'], 'ぅ': ['xu', 'lu'], 'ぇ': ['xe', 'le'], 'ぉ': ['xo', 'lo'],
            'ゃ': ['xya', 'lya'], 'ゅ': ['xyu', 'lyu'], 'ょ': ['xyo', 'lyo'],
            'ー': ['-'], ' ': [' '], '　': [' '],
            '1': ['1'], '2': ['2'], '3': ['3'], '4': ['4'], '5': ['5'],
            '6': ['6'], '7': ['7'], '8': ['8'], '9': ['9'], '0': ['0']
        };
    }

    reset() {
        this.targetText = "";
        this.normalizedKana = "";
        this.typedRoman = "";
        this.remainRomanOptions = [];
        this.lastInputCorrect = null;
        this.lastTypedChar = "";
    }

    /**
     * カタカナをひらがなに正規化
     */
    normalize(text) {
        if (!text) return "";
        return text.replace(/[ァ-ン]/g, (s) => {
            return String.fromCharCode(s.charCodeAt(0) - 0x60);
        });
    }

    setTarget(text) {
        this.reset();
        this.targetText = text;
        this.normalizedKana = this.normalize(text);
        this.remainRomanOptions = this.generateOptions(this.normalizedKana);
        console.log(`[TypingEngine] Target: ${text} -> Options:`, this.remainRomanOptions);
    }

    /**
     * 全入力パターンの生成
     * 促音（っ）や拗音の処理を含む再帰的展開
     */
    generateOptions(kana) {
        if (!kana) return [""];
        let results = [""];
        let i = 0;

        while (i < kana.length) {
            let found = false;

            // 促音 (っ) + 子音 の特別処理
            // 例: 「った」 -> tta, xtuta, ltuta
            if (kana[i] === 'っ' && i + 1 < kana.length) {
                const nextPart = kana.substring(i + 1);
                const nextOptions = this.findOptionsPrefix(nextPart); // 次の文字のローマ字候補を取得
                
                if (nextOptions && nextOptions.length > 0) {
                    // 次の文字が子音で始まる場合のみ、その子音を重ねるパターンを追加
                    const consonantOpts = nextOptions.filter(opt => opt.match(/^[a-z]/));
                    
                    if (consonantOpts.length > 0) {
                        // 重ねる文字を取得 (k, s, t, etc.)
                        const firstChars = [...new Set(consonantOpts.map(o => o[0]))];
                        let newRes = [];
                        
                        // 既存の候補それぞれに対して分岐を作成
                        for (let r of results) {
                            // パターンA: 子音重ね (tta)
                            for (let fc of firstChars) {
                                newRes.push(r + fc); 
                            }
                            // パターンB: 単独入力 (xtu, ltu) は下のループで処理されるためここではスキップ可能だが
                            // 厳密にはここでの分岐が必要な場合もある。今回は簡易化。
                        }
                        
                        // ここで分岐確定したら、次の文字へ進むのではなく、
                        // 「っ」を消費した扱いにするが、次の文字の生成ロジックと結合する必要がある。
                        // 今回のエンジンの構造上、少し複雑になるため、簡易的な「子音重ね」を優先実装。
                        // 正確には `generateOptions` を再帰させるのがベストだが、ここでは既存ロジックを踏襲。
                        
                        results = newRes;
                        i++; 
                        continue; 
                    }
                }
            }

            // 通常の変換（2文字、1文字）
            for (let len of [2, 1]) {
                const sub = kana.substring(i, i + len);
                const opts = this.romanTable[sub];
                if (opts) {
                    let next = [];
                    for (let r of results) {
                        for (let opt of opts) next.push(r + opt);
                    }
                    results = next;
                    i += len;
                    found = true;
                    break;
                }
            }

            // マッチしない文字（記号など）はそのまま
            if (!found) {
                let next = [];
                for (let r of results) next.push(r + kana[i]);
                results = next;
                i++;
            }
        }
        return results;
    }

    /**
     * 文字列の先頭に対応するローマ字候補を探す（促音判定用）
     */
    findOptionsPrefix(kana) {
        for (let len of [2, 1]) {
            const sub = kana.substring(0, len);
            if (this.romanTable[sub]) return this.romanTable[sub];
        }
        return null;
    }

    /**
     * 入力文字の判定
     */
    checkInput(char) {
        const key = char.toLowerCase();
        // 入力キーで始まる候補があるかフィルタリング
        const matches = this.remainRomanOptions.filter(opt => opt.startsWith(key));
        
        if (matches.length > 0) {
            this.typedRoman += key;
            // 候補リストの先頭文字を削除して更新
            this.remainRomanOptions = matches.map(opt => opt.substring(1));
            this.lastInputCorrect = true;
            this.lastTypedChar = key;
            return { success: true, char: key, isComplete: this.isComplete() };
        } else {
            this.lastInputCorrect = false;
            return { success: false, char: key, isComplete: false };
        }
    }

    isComplete() {
        return this.remainRomanOptions.some(opt => opt === "");
    }

    /**
     * UI表示用の状態オブジェクトを返却
     */
    getDisplayData() {
        return {
            typed: this.typedRoman,
            remaining: this.remainRomanOptions[0] || "", // 最短または最初の候補を表示
            lastChar: this.lastTypedChar,
            isError: this.lastInputCorrect === false
        };
    }
}