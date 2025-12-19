// main.js — ゲームの初期化と簡易ロジック
import { romajiMatch } from './typing.js';

const wordBox = document.getElementById('word-box');
const inputEl = document.getElementById('input');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');

let words = [];
let current = null;
let score = 0;
let timeLeft = 60;
let timerId = null;

async function loadData() {
  try {
    const res = await fetch('assets/data/pokemon.csv');
    const txt = await res.text();
    words = txt.split('\n').slice(1).map(l => l.split(',')[1]).filter(Boolean);
  } catch (e) {
    console.error('データ読み込み失敗', e);
    words = ['pika','fushigi','charmander'];
  }
}

function nextWord(){
  current = words[Math.floor(Math.random()*words.length)];
  wordBox.textContent = current || '---';
  inputEl.value = '';
  inputEl.focus();
}

function startTimer(){
  timeLeft = 60;
  timerEl.textContent = `Time: ${timeLeft}`;
  timerId = setInterval(()=>{
    timeLeft--;
    timerEl.textContent = `Time: ${timeLeft}`;
    if(timeLeft<=0){
      clearInterval(timerId);
      endGame();
    }
  },1000);
}

function endGame(){
  wordBox.textContent = `Game Over — Score: ${score}`;
  inputEl.disabled = true;
}

inputEl.addEventListener('input', ()=>{
  const val = inputEl.value.trim();
  if(!current) return;
  if(romajiMatch(val, current)){
    score += 10;
    scoreEl.textContent = `Score: ${score}`;
    nextWord();
  }
});

window.addEventListener('load', async ()=>{
  await loadData();
  nextWord();
  startTimer();
});
