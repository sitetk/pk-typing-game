// typing.js — ローマ字判定の簡易ロジック
// この関数は、ユーザーが入力したローマ字がターゲット文字列に対応するかを判定する
// 簡易実装: 入力とターゲットを小文字化して完全一致を判定する

export function romajiMatch(input, target){
  if(!input || !target) return false;
  return input.toLowerCase() === target.toLowerCase();
}

// 将来的にローマ字分割、促音、撥音、長音等の判定を追加してください。
