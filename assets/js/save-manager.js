const SLOT_IDS = ['1', '2', '3'];
const EXPORT_FILE_PREFIX = 'pokemon_typing';

class SaveManager {
    constructor(storageKey = 'pokemon_typing_save_data') {
        this.storageKey = storageKey;
    }

    getSlotTemplate(slotName = 'プレイヤー') {
        return {
            playerName: slotName,
            lastPlayed: null,
            clearedStages: [],
            defeatedPokemonIds: [],
            capturedPokemonIds: [],
            customParties: [],
            currentParty: [],
            playTime: 0
        };
    }

    getInitialData() {
        return {
            slots: {
                '1': this.getSlotTemplate('プレイヤー'),
                '2': this.getSlotTemplate('プレイヤー'),
                '3': this.getSlotTemplate('プレイヤー')
            },
            lastUsedSlot: '1'
        };
    }

    safeParse(raw) {
        try {
            return JSON.parse(raw);
        } catch (err) {
            console.warn('[SaveManager] JSON parse failed', err);
            return null;
        }
    }

    loadAll() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            const parsed = raw ? this.safeParse(raw) : null;
            if (!parsed || !parsed.slots) {
                return this.getInitialData();
            }
            return {
                slots: {
                    '1': { ...this.getSlotTemplate(), ...parsed.slots['1'] },
                    '2': { ...this.getSlotTemplate(), ...parsed.slots['2'] },
                    '3': { ...this.getSlotTemplate(), ...parsed.slots['3'] }
                },
                lastUsedSlot: parsed.lastUsedSlot || '1'
            };
        } catch (err) {
            console.error('[SaveManager] loadAll failed', err);
            return this.getInitialData();
        }
    }

    saveAll(data) {
        try {
            const payload = JSON.stringify(data);
            localStorage.setItem(this.storageKey, payload);
            return true;
        } catch (err) {
            console.warn('[SaveManager] saveAll failed', err);
            return false;
        }
    }

    getSlot(slotId) {
        const data = this.loadAll();
        return data.slots[slotId] || this.getSlotTemplate();
    }

    saveSlot(slotId, gameData) {
        const data = this.loadAll();
        const slot = { ...this.getSlotTemplate(), ...data.slots[slotId], ...gameData };
        data.slots[slotId] = slot;
        data.lastUsedSlot = slotId;
        this.saveAll(data);
        return slot;
    }

    deleteSlot(slotId) {
        const data = this.loadAll();
        data.slots[slotId] = this.getSlotTemplate();
        if (data.lastUsedSlot === slotId) {
            data.lastUsedSlot = '1';
        }
        this.saveAll(data);
        return data;
    }

    normalizeSlotData(slotData = {}) {
        const template = this.getSlotTemplate(slotData.playerName || 'プレイヤー');
        return {
            ...template,
            playerName: typeof slotData.playerName === 'string' && slotData.playerName.trim()
                ? slotData.playerName
                : template.playerName,
            lastPlayed: slotData.hasOwnProperty('lastPlayed') ? slotData.lastPlayed : template.lastPlayed,
            clearedStages: Array.isArray(slotData.clearedStages) ? slotData.clearedStages : template.clearedStages,
            defeatedPokemonIds: Array.isArray(slotData.defeatedPokemonIds) ? slotData.defeatedPokemonIds : template.defeatedPokemonIds,
            customParties: Array.isArray(slotData.customParties) ? slotData.customParties : template.customParties,
            currentParty: Array.isArray(slotData.currentParty) ? slotData.currentParty : template.currentParty,
            playTime: typeof slotData.playTime === 'number'
                ? slotData.playTime
                : Number(slotData.playTime) || template.playTime
        };
    }

    isValidSlotData(slotData) {
        if (!slotData || typeof slotData !== 'object') return false;
        if (typeof slotData.playerName !== 'string' || !slotData.playerName.trim()) return false;
        if (!slotData.hasOwnProperty('lastPlayed')) return false;
        if (!Array.isArray(slotData.clearedStages)) return false;
        if (!Array.isArray(slotData.defeatedPokemonIds)) return false;
        if (!Array.isArray(slotData.capturedPokemonIds)) return false;
        if (!Array.isArray(slotData.customParties)) return false;
        if (!slotData.hasOwnProperty('playTime')) return false;
        const playTime = slotData.playTime;
        if (typeof playTime !== 'number' && Number.isNaN(Number(playTime))) return false;
        return true;
    }

    getValidSlotEntries(payload) {
        if (!payload || typeof payload !== 'object' || !payload.slots || typeof payload.slots !== 'object') {
            return [];
        }
        return Object.entries(payload.slots)
            .map(([key, val]) => [String(key), val])
            .filter(([id, slot]) => SLOT_IDS.includes(id) && this.isValidSlotData(slot));
    }

    normalizeLoadedData(payload) {
        const normalized = this.getInitialData();
        const entries = payload && payload.slots ? Object.entries(payload.slots) : [];
        entries.forEach(([key, slot]) => {
            const slotId = String(key);
            if (!SLOT_IDS.includes(slotId)) return;
            normalized.slots[slotId] = this.normalizeSlotData(slot);
        });
        if (payload && SLOT_IDS.includes(String(payload.lastUsedSlot))) {
            normalized.lastUsedSlot = String(payload.lastUsedSlot);
        }
        return normalized;
    }

    sanitizeFileName(playerName) {
        const raw = typeof playerName === 'string' && playerName.trim() ? playerName.trim() : 'player';
        return raw.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
    }

    formatDateId(date = new Date()) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}${m}${d}`;
    }

    saveToFile(slotId) {
        if (!SLOT_IDS.includes(slotId)) {
            throw new Error(`Invalid slot id: ${slotId}`);
        }
        const data = this.loadAll();
        const slotData = data.slots[slotId];
        if (!slotData) {
            throw new Error('セーブデータが みつかりません');
        }
        const payload = {
            slots: {
                [slotId]: this.normalizeSlotData(slotData)
            },
            lastUsedSlot: slotId,
            exportedAt: Date.now()
        };
        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
        const fileName = `${EXPORT_FILE_PREFIX}_${this.sanitizeFileName(slotData.playerName)}_${this.formatDateId()}.json`;
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
        return true;
    }

    loadFromFile(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('ファイルを指定してください'));
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                const parsed = this.safeParse(reader.result);
                if (!parsed) {
                    reject(new Error('JSONの解析に失敗しました'));
                    return;
                }
                const validEntries = this.getValidSlotEntries(parsed);
                if (!validEntries.length) {
                    reject(new Error('有効なセーブデータが含まれていません'));
                    return;
                }
                const normalized = this.normalizeLoadedData(parsed);
                const [sourceSlotId, sourceSlotData] = validEntries[0];
                resolve({
                    data: normalized,
                    sourceSlotId,
                    sourceSlotData: this.normalizeSlotData(sourceSlotData)
                });
            };
            reader.onerror = () => {
                reject(reader.error || new Error('ファイルの読み込みに失敗しました'));
            };
            reader.readAsText(file, 'UTF-8');
        });
    }
}
