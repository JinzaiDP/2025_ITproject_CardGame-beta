let deckId = "";
let drawPile = [];
let grid = [];
let gridRows = 4;
let gridCols = 4;
let selectedCard = null;

const playerCards = document.getElementById("player-cards");
const result = document.getElementById("result");
const drawBtn = document.getElementById("draw-btn");
const startBtn = document.getElementById("start-btn");
const resetBtn = document.getElementById("reset-btn");

startBtn.addEventListener("click", startGame);
resetBtn.addEventListener("click", resetGame);
drawBtn.addEventListener("click", drawCard);

// 値を比較用に正規化 (J,Q,K,Aを数値に)
function normalizeValue(value) {
  const map = { "ACE": 1, "JACK": 11, "QUEEN": 12, "KING": 13 };
  if (typeof value === "string") {
    return map[value] || parseInt(value, 10);
  }
  return value;
}

function startGame() {
  resetGameUI();
  gridRows = 4;
  gridCols = 4;
  grid = [];

  // グリッド配列の初期化
  for (let r = 0; r < gridRows; r++) {
    grid[r] = new Array(gridCols).fill(null);
  }

  fetch(`https://deckofcardsapi.com/api/deck/new/shuffle/?deck_count=1`)
    .then(res => res.json())
    .then(data => {
      deckId = data.deck_id;
      // 52枚すべて引いておく
      return fetch(`https://deckofcardsapi.com/api/deck/${deckId}/draw/?count=52`);
    })
    .then(res => res.json())
    .then(data => {
      drawPile = data.cards;
      
      // 最初の16枚を配置
      for (let i = 0; i < gridRows * gridCols; i++) {
        const r = Math.floor(i / gridCols);
        const c = i % gridCols;
        if (drawPile.length > 0) {
            grid[r][c] = drawPile.shift();
        }
      }
      
      renderGrid();
      drawBtn.disabled = false;
      startBtn.disabled = true;
      resetBtn.disabled = false;
    })
    .catch(err => {
      console.error("Error:", err);
      result.textContent = "エラーが発生しました。リロードしてください。";
    });
}

function resetGame() {
  resetGameUI();
  startGame();
}

function resetGameUI() {
  selectedCard = null;
  grid = [];
  drawPile = [];
  result.textContent = "";
  playerCards.innerHTML = "";
  drawBtn.disabled = true;
  startBtn.disabled = false;
  resetBtn.disabled = true;
}

function drawCard() {
  if (drawPile.length === 0) {
    drawBtn.disabled = true;
    checkGameOver();
    return;
  }

  const card = drawPile.shift();
  placeCard(card);
  renderGrid();
  checkGameOver();
}

function placeCard(card) {
  // 左上から順に空きを探して配置
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      if (grid[r][c] === null) {
        grid[r][c] = card;
        return;
      }
    }
  }

  // 空きがなければ新しい行を追加
  const newRow = new Array(gridCols).fill(null);
  newRow[0] = card;
  grid.push(newRow);
  gridRows++;
}

function renderGrid() {
  playerCards.innerHTML = "";

  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const card = grid[r][c];
      
      // レイアウト用セル
      const cell = document.createElement("div");
      cell.className = "cell";

      if (card) {
        const img = document.createElement("img");
        img.className = "card";
        img.src = card.image;
        img.dataset.row = r;
        img.dataset.col = c;
        img.onclick = () => cardClick(r, c);

        if (selectedCard && selectedCard.r === r && selectedCard.c === c) {
          img.classList.add("selected");
        }
        
        cell.appendChild(img);
      }
      
      playerCards.appendChild(cell);
    }
  }
}

function cardClick(r, c) {
  const clicked = grid[r][c];
  if (!clicked) return;

  // 同じカードをクリックしたら選択解除
  if (selectedCard && selectedCard.r === r && selectedCard.c === c) {
      selectedCard = null;
      renderGrid();
      return;
  }

  // 1枚目の選択
  if (!selectedCard) {
    selectedCard = { r, c };
    renderGrid();
    return;
  }

  // 2枚目のクリック（ペア判定）
  const selected = grid[selectedCard.r][selectedCard.c];

  if (
    isAdjacent(selectedCard.r, selectedCard.c, r, c) &&
    normalizeValue(selected.value) === normalizeValue(clicked.value)
  ) {
    // ペア成立：削除
    grid[selectedCard.r][selectedCard.c] = null;
    grid[r][c] = null;
    selectedCard = null;

    compressGrid(); // ★ここが変更点（詰める処理）
    renderGrid();
    checkGameOver();
  } else {
    // ペア不成立
    selectedCard = { r, c };
    renderGrid();
  }
}

// ★修正した関数：隙間を左上に詰める
function compressGrid() {
  // 1. 盤面にあるすべてのカードをリストとして取得
  const remainingCards = [];
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      if (grid[r][c] !== null) {
        remainingCards.push(grid[r][c]);
      }
    }
  }

  // 2. グリッドを一旦空にして、左上から順番に詰め直す
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      if (remainingCards.length > 0) {
        grid[r][c] = remainingCards.shift();
      } else {
        grid[r][c] = null;
      }
    }
  }

  // 3. 下の行が完全に空なら行を削除 (ただし最低4行は維持)
  while (gridRows > 4 && grid[gridRows - 1].every(cell => cell === null)) {
    grid.pop();
    gridRows--;
  }
}

// 隣接チェック
function isAdjacent(r1, c1, r2, c2) {
  const dr = Math.abs(r1 - r2);
  const dc = Math.abs(c1 - c2);
  return (dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0));
}

function checkGameOver() {
  let hasCardOnGrid = false;
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      if (grid[r][c] !== null) {
        hasCardOnGrid = true;
        break;
      }
    }
  }

  if (drawPile.length === 0) {
      drawBtn.disabled = true;
  }

  // クリア判定
  if (!hasCardOnGrid && drawPile.length === 0) {
      result.textContent = "🎉 GAME CLEAR! おめでとうございます！ 🎉";
      result.style.color = "#4caf50";
      return;
  }

  // 手詰まり判定
  if (drawPile.length === 0 && hasCardOnGrid && !hasPairs()) {
      result.textContent = "GAME OVER... (手詰まり)";
      result.style.color = "#ff5252";
  }
}

function hasPairs() {
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const card = grid[r][c];
      if (!card) continue;
      
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          
          if (nr >= 0 && nr < gridRows && nc >= 0 && nc < gridCols) {
             const neighbor = grid[nr][nc];
             if (neighbor && normalizeValue(neighbor.value) === normalizeValue(card.value)) {
               return true;
             }
          }
        }
      }
    }
  }
  return false;
}