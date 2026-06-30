const screens = [...document.querySelectorAll(".screen")];
const introCanvas = document.querySelector("#introCanvas");
const gameCanvas = document.querySelector("#gameCanvas");
const successCanvas = document.querySelector("#successCanvas");
const introCtx = introCanvas.getContext("2d");
const ctx = gameCanvas.getContext("2d");
const successCtx = successCanvas.getContext("2d");
const infoButton = document.querySelector("[data-action='info']");
const infoModal = document.querySelector("[data-info-modal]");
const infoLanguageBlocks = [...document.querySelectorAll("[data-info-lang]")];
const translations = {
  en: {
    play: "PLAY",
    again: "PLAY AGAIN",
    skip: "SKIP GAME",
    catch: "Catch the date",
    move: "Move",
    orDrag: "or drag",
    saved: "YOU HAVE SAVED THE DATE. NOW SAVE THE DATE.",
    wedding: "Cannis & Juliusz's Wedding",
    place: "Szklarnia in Grodzisk Mazowiecki, near Warsaw, Poland",
    moreInfo: "Invites and more information will be shared soon!",
    calendar: "Add to Google Calendar",
    failed: "MISSION FAILED",
    failText: "You failed to save the date.",
  },
  pl: {
    play: "GRAJ",
    again: "ZAGRAJ JESZCZE RAZ",
    skip: "POMIŃ GRĘ",
    catch: "Złap daktyla",
    move: "Ruch",
    orDrag: "lub przeciągnij",
    saved: "URATOWAŁEŚ DAKTYLA. TERAZ ZAPAMIĘTAJ DATĘ.",
    wedding: "Ślub Cannis & Juliusza",
    place: "Szklarnia w Grodzisku Mazowieckim, niedaleko Warszawy, Polska",
    moreInfo: "Zaproszenia i więcej informacji będzie wysłane wkrótce!",
    calendar: "Dodaj do kalendarza Google",
    failed: "MISJA NIEUDANA",
    failText: "Nie udało Ci się uratować daktyla.",
  },
  zh: {
    play: "開始遊戲",
    again: "再玩一次",
    skip: "跳過遊戲",
    catch: "接住粒椰棗",
    move: "移動",
    orDrag: "或者拖曳",
    saved: "恭喜你救咗粒椰棗！",
    wedding: "Cannis 同 Juliusz 嘅婚禮",
    place: "Szklarnia, Grodzisk Mazowiecki (波蘭華沙近郊）",
    moreInfo: "我地之後會提供正式請柬以及更多資料！到時見👋🏻",
    calendar: "加落 Google Calendar",
    failed: "任務失敗",
    failText: "粒椰棗跌左落地。",
  },
};

const W = gameCanvas.width;
const H = gameCanvas.height;
const DATE_BUNCH_LOCAL_WIDTH = 45;
const DATE_BUNCH_LOCAL_TOP = -10;
const DATE_BUNCH_LOCAL_BOTTOM = 49;
const keys = new Set();

let state = "start";
let rafId = 0;
let lastTime = 0;
let player;
let dateFruit;
let pushTimer;
let splatFrame = 0;
let currentLanguage = "en";

function setLanguage(language) {
  currentLanguage = translations[language] ? language : "en";
  document.documentElement.lang = currentLanguage === "zh" ? "zh-Hant-HK" : currentLanguage;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    element.textContent = translations[currentLanguage][key];
  });
  document.querySelectorAll("[data-lang]").forEach((button) => {
    const isActive = button.dataset.lang === currentLanguage;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  const showInfo = currentLanguage !== "en";
  infoButton.hidden = !showInfo;
  infoLanguageBlocks.forEach((block) => {
    block.hidden = block.dataset.infoLang !== currentLanguage;
  });
  if (!showInfo) {
    closeInfo();
  }
}

function openInfo() {
  if (currentLanguage === "en") return;
  infoModal.hidden = false;
}

function closeInfo() {
  infoModal.hidden = true;
}

function showScreen(name) {
  state = name;
  closeInfo();
  screens.forEach((screen) => {
    screen.classList.toggle("is-active", screen.dataset.screen === name);
  });

  if (name === "game") {
    startGame();
  } else {
    cancelAnimationFrame(rafId);
    if (name === "success") {
      drawSuccessScene();
    }
  }
}

function startGame() {
  player = {
    x: 54,
    y: H - 82,
    w: 116,
    h: 58,
    speed: 185,
  };
  dateFruit = {
    x: 215,
    y: 82,
    w: 34,
    h: 44,
    startX: 215,
    startY: 82,
    scale: 0.68,
    vy: 19,
    spin: 0,
    falling: false,
    caught: false,
    caughtTimer: 0,
    caughtOffsetX: 0,
  };
  pushTimer = 0;
  splatFrame = 0;
  lastTime = performance.now();
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;
  update(dt);
  draw();
  if (state === "game") {
    rafId = requestAnimationFrame(loop);
  }
}

function update(dt) {
  const dir = (keys.has("ArrowRight") || keys.has("right") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("left") ? 1 : 0);
  player.x = clamp(player.x + dir * player.speed * dt, 8, W - player.w - 8);

  pushTimer += dt;

  if (dateFruit.caught) {
    const cloth = getClothBounds();
    const bounds = getDateBounds(dateFruit);
    dateFruit.caughtTimer += dt;
    dateFruit.x = cloth.x + dateFruit.caughtOffsetX;
    dateFruit.y = cloth.y - (bounds.bottom - bounds.top) + 6;
    dateFruit.spin = 0;

    if (dateFruit.caughtTimer > 0.8) {
      showScreen("success");
    }
    return;
  }

  if (!dateFruit.falling) {
    dateFruit.x = dateFruit.startX + Math.round(Math.sin(pushTimer * 8) * Math.min(pushTimer * 3, 3));
    dateFruit.y = dateFruit.startY + Math.round(Math.sin(pushTimer * 10) * Math.min(pushTimer * 2, 2));
    dateFruit.spin = 0;

    if (pushTimer > 1.05) {
      dateFruit.falling = true;
      dateFruit.vy = 34;
    }
  }

  if (dateFruit.falling) {
    dateFruit.vy += 14 * dt;
    dateFruit.y += dateFruit.vy * dt;
    dateFruit.x += Math.sin(pushTimer * 2.3) * 7 * dt;
    dateFruit.spin = 0;

    const cloth = getClothBounds();
    const bounds = getDateBounds(dateFruit);
    const contactInset = 7 * dateFruit.scale;
    const fruitContactLeft = bounds.left + contactInset;
    const fruitContactRight = bounds.right - contactInset;
    const caught =
      fruitContactRight >= cloth.x + 4 &&
      fruitContactLeft <= cloth.x + cloth.w - 4 &&
      bounds.bottom >= cloth.y;

    if (caught) {
      dateFruit.caught = true;
      dateFruit.falling = false;
      dateFruit.vy = 0;
      dateFruit.caughtTimer = 0;
      dateFruit.caughtOffsetX = cloth.w * 0.5;
      dateFruit.x = cloth.x + dateFruit.caughtOffsetX;
      dateFruit.y = cloth.y - (bounds.bottom - bounds.top) + 6;
      return;
    }

    if (bounds.bottom >= H - 22) {
      splatFrame = 1;
      draw();
      window.setTimeout(() => showScreen("fail"), 520);
      state = "splat";
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawWorld(ctx, W, H);
  drawGamePalm(ctx);

  if (dateFruit.caught) {
    drawCouple(ctx, player.x, player.y);
    drawFallingDateBunch(ctx, dateFruit);
  } else if (splatFrame) {
    drawSplat(ctx, dateFruit.x, H - 28);
    drawCouple(ctx, player.x, player.y);
  } else {
    drawFallingDateBunch(ctx, dateFruit);
    drawCouple(ctx, player.x, player.y);
  }
}

function drawIntro() {
  const iw = introCanvas.width;
  const ih = introCanvas.height;
  introCtx.clearRect(0, 0, iw, ih);
  drawWorld(introCtx, iw, ih);
  introCtx.fillStyle = "rgba(23, 19, 25, 0.16)";
  introCtx.fillRect(0, ih - 34, iw, 34);
  drawPalmTrunk(introCtx, 143, 48, 34, ih - 48, 1);
  drawPalmCrown(introCtx, 160, 72, 1.15);
  drawDateBunch(introCtx, 58, 98, -0.45, 0.82);
}

function drawWorld(c, w, h) {
  c.fillStyle = "#77c8f2";
  c.fillRect(0, 0, w, h);
  c.fillStyle = "#f6c547";
  c.fillRect(w - 54, 18, 26, 26);
  c.fillStyle = "#fff7d1";
  for (let i = 0; i < 5; i++) {
    c.fillRect(18 + i * 57, 34 + (i % 2) * 26, 28, 8);
    c.fillRect(24 + i * 57, 28 + (i % 2) * 26, 16, 8);
  }
  c.fillStyle = "#59c98f";
  c.fillRect(0, h - 22, w, 22);
  c.fillStyle = "#35764f";
  for (let x = 0; x < w; x += 16) {
    c.fillRect(x, h - 22, 8, 6);
  }
}

function drawGamePalm(c) {
  drawPalmTrunk(c, 143, 56, 34, H - 78, 0.82);
  drawPalmCrown(c, 160, 70, 0.95, false);
  drawDateBunch(c, 94, 92, 0.4, 0.65);
  drawDateBunch(c, 146, 92, -0.2, 0.6);
}

function drawPalmTrunk(c, x, y, w, h, opacity = 1) {
  c.save();
  c.globalAlpha = opacity;
  c.fillStyle = "rgba(23, 19, 25, 0.18)";
  c.fillRect(x + w - 3, y + 2, 8, h);
  c.fillStyle = "#6f4a2f";
  c.fillRect(x, y, w, h);
  c.fillStyle = "#9a6a3f";
  c.fillRect(x + Math.floor(w * 0.35), y, Math.max(5, Math.floor(w * 0.35)), h);
  c.fillStyle = "#4a2f22";
  for (let row = y + 8; row < y + h; row += 18) {
    c.fillRect(x, row, w, 4);
    c.fillRect(x + 3, row + 4, Math.max(4, w - 6), 3);
  }
  c.restore();
}

function drawPalmCrown(c, x, y, scale = 1, showBunches = true) {
  c.save();
  c.translate(Math.round(x), Math.round(y));
  c.scale(scale, scale);
  drawPalmFrond(c, [[-8, -8], [-38, -28], [-78, -25], [-116, -2], [-148, 32]]);
  drawPalmFrond(c, [[-4, -12], [-32, -42], [-64, -52], [-95, -38], [-119, -6]]);
  drawPalmFrond(c, [[2, -15], [-12, -48], [-6, -80], [12, -108], [34, -130]]);
  drawPalmFrond(c, [[8, -14], [40, -47], [76, -52], [112, -31], [140, 8]]);
  drawPalmFrond(c, [[12, -7], [50, -19], [94, -9], [131, 18], [158, 52]]);
  drawPalmFrond(c, [[-5, 2], [-45, 14], [-80, 42], [-103, 76], [-111, 108]]);
  drawPalmFrond(c, [[9, 2], [49, 15], [84, 44], [105, 82], [108, 113]]);
  c.fillStyle = "#6f4a2f";
  c.fillRect(-11, -8, 22, 20);
  if (showBunches) {
    c.fillStyle = "#4f2c1f";
    c.fillRect(-6, 5, 5, 36);
    c.fillRect(4, 3, 5, 44);
    drawDateBunch(c, -20, 32, -0.25, 0.8);
    drawDateBunch(c, 14, 30, 0.25, 0.78);
  }
  c.restore();
}

function drawPalmFrond(c, points) {
  c.strokeStyle = "#1f6b43";
  c.lineWidth = 10;
  c.beginPath();
  c.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(([x, y]) => c.lineTo(x, y));
  c.stroke();
  c.strokeStyle = "#2fa163";
  c.lineWidth = 5;
  c.beginPath();
  c.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(([x, y]) => c.lineTo(x, y));
  c.stroke();
  c.fillStyle = "#1f6b43";
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    for (let step = 1; step <= 3; step++) {
      const t = step / 4;
      const px = x1 + dx * t;
      const py = y1 + dy * t;
      const leafletLength = Math.max(10, 30 - i * 3 - step);
      drawLeaflet(c, px, py, nx, ny, leafletLength);
      drawLeaflet(c, px, py + 4, -nx, -ny, Math.max(8, leafletLength - 8));
    }
  }
}

function drawLeaflet(c, x, y, nx, ny, length) {
  c.strokeStyle = "#1f6b43";
  c.lineWidth = 5;
  c.beginPath();
  c.moveTo(Math.round(x), Math.round(y));
  c.lineTo(Math.round(x + nx * length), Math.round(y + ny * length));
  c.stroke();
}

function drawDateBunch(c, x, y, spin = 0, scale = 1) {
  c.save();
  c.translate(Math.round(x), Math.round(y));
  c.rotate(spin * 0.08);
  c.scale(scale, scale);
  c.fillStyle = "#5c351f";
  c.fillRect(14, -10, 5, 18);
  drawTinyDate(c, 4, 4);
  drawTinyDate(c, 18, 4);
  drawTinyDate(c, 11, 17);
  drawTinyDate(c, 25, 19);
  drawTinyDate(c, 0, 28);
  drawTinyDate(c, 17, 33);
  drawTinyDate(c, 32, 35);
  c.restore();
}

function drawFallingDateBunch(c, date) {
  const width = DATE_BUNCH_LOCAL_WIDTH * date.scale;
  const anchorX = date.x - width * 0.5;
  const anchorY = date.y - DATE_BUNCH_LOCAL_TOP * date.scale;
  drawDateBunch(c, anchorX, anchorY, 0, date.scale);
}

function drawTinyDate(c, x, y) {
  c.fillStyle = "#3f2419";
  c.fillRect(x + 2, y, 9, 14);
  c.fillRect(x, y + 3, 13, 8);
  c.fillStyle = "#7c4a2d";
  c.fillRect(x + 3, y + 2, 5, 4);
  c.fillStyle = "#20110c";
  c.fillRect(x + 6, y + 2, 2, 10);
}

function drawSuccessScene() {
  const c = successCtx;
  const w = successCanvas.width;
  const h = successCanvas.height;
  c.clearRect(0, 0, w, h);
  c.fillStyle = "#77c8f2";
  c.fillRect(0, 0, w, h);
  c.fillStyle = "#fff7d1";
  c.fillRect(16, 22, 36, 8);
  c.fillRect(260, 28, 48, 8);
  c.fillStyle = "#59c98f";
  c.fillRect(0, 132, w, 48);
  c.fillStyle = "#35764f";
  for (let x = 0; x < w; x += 18) {
    c.fillRect(x, 132, 9, 6);
  }
  c.fillStyle = "#b76e42";
  c.fillRect(0, 148, w, 12);
  c.fillStyle = "#d9d0bb";
  c.fillRect(0, 160, w, 20);

  drawZabka(c, 22, 84);
  drawSzklarnia(c, 105, 28);
  drawInpost(c, 275, 104);
}

function drawSzklarnia(c, x, y) {
  c.fillStyle = "#293f4f";
  c.beginPath();
  c.moveTo(x - 8, y + 76);
  c.lineTo(x + 75, y);
  c.lineTo(x + 158, y + 76);
  c.closePath();
  c.fill();
  c.fillStyle = "#d69a55";
  c.beginPath();
  c.moveTo(x + 2, y + 76);
  c.lineTo(x + 75, y + 9);
  c.lineTo(x + 148, y + 76);
  c.closePath();
  c.fill();
  c.fillStyle = "#c98748";
  c.fillRect(x + 2, y + 76, 146, 46);
  c.fillStyle = "#1d3f4b";
  c.beginPath();
  c.moveTo(x + 12, y + 74);
  c.lineTo(x + 75, y + 18);
  c.lineTo(x + 138, y + 74);
  c.lineTo(x + 138, y + 114);
  c.lineTo(x + 12, y + 114);
  c.closePath();
  c.fill();
  c.fillStyle = "#92d8ed";
  c.beginPath();
  c.moveTo(x + 17, y + 72);
  c.lineTo(x + 75, y + 24);
  c.lineTo(x + 133, y + 72);
  c.lineTo(x + 133, y + 109);
  c.lineTo(x + 17, y + 109);
  c.closePath();
  c.fill();
  c.strokeStyle = "#e4a35b";
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(x + 17, y + 72);
  c.lineTo(x + 75, y + 24);
  c.lineTo(x + 133, y + 72);
  c.lineTo(x + 133, y + 109);
  c.lineTo(x + 17, y + 109);
  c.closePath();
  c.stroke();
  c.beginPath();
  c.moveTo(x + 75, y + 24);
  c.lineTo(x + 75, y + 111);
  c.moveTo(x + 45, y + 49);
  c.lineTo(x + 45, y + 111);
  c.moveTo(x + 105, y + 49);
  c.lineTo(x + 105, y + 111);
  c.moveTo(x + 18, y + 75);
  c.lineTo(x + 132, y + 75);
  c.moveTo(x + 18, y + 96);
  c.lineTo(x + 132, y + 96);
  c.stroke();
  c.fillStyle = "#fff7d1";
  c.fillRect(x + 42, y + 120, 66, 8);
}

function drawZabka(c, x, y) {
  c.fillStyle = "#137b42";
  c.fillRect(x, y + 22, 70, 54);
  c.fillStyle = "#19a652";
  c.fillRect(x + 6, y + 28, 58, 42);
  c.fillStyle = "#fff7d1";
  c.fillRect(x + 10, y + 35, 50, 15);
  c.fillStyle = "#137b42";
  c.font = "bold 10px Courier New";
  c.fillText("ZABKA", x + 17, y + 47);
  c.fillStyle = "#0d3a2d";
  c.fillRect(x + 12, y + 53, 18, 17);
  c.fillRect(x + 38, y + 53, 18, 17);
  c.fillStyle = "#dd2c2c";
  c.fillRect(x, y + 16, 70, 8);
}

function drawInpost(c, x, y) {
  c.fillStyle = "#f6c547";
  c.fillRect(x, y, 64, 56);
  c.fillStyle = "#171319";
  c.fillRect(x + 5, y + 6, 54, 10);
  c.fillStyle = "#f6c547";
  c.font = "bold 8px Courier New";
  c.fillText("InPost", x + 13, y + 14);
  c.fillStyle = "#2b2130";
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      c.fillRect(x + 7 + col * 14, y + 22 + row * 8, 10, 5);
    }
  }
}

function drawSplat(c, x, y) {
  c.fillStyle = "#4f2c1f";
  c.fillRect(Math.round(x) - 11, y + 14, 48, 8);
  c.fillRect(Math.round(x) - 2, y + 6, 24, 8);
  c.fillStyle = "#7c4a2d";
  c.fillRect(Math.round(x) + 6, y + 2, 10, 4);
}

function drawCouple(c, x, y, scale = 1) {
  c.save();
  c.translate(Math.round(x), Math.round(y));
  c.scale(scale, scale);
  drawBride(c, 0, 8);
  drawGroom(c, 78, 8);
  c.fillStyle = "#fff7d1";
  c.fillRect(20, 0, 74, 14);
  c.fillStyle = "#f35d55";
  c.fillRect(24, 4, 66, 6);
  c.fillStyle = "#fff7d1";
  c.fillRect(12, 13, 10, 8);
  c.fillRect(92, 13, 10, 8);
  c.restore();
}

function drawBride(c, x, y) {
  c.fillStyle = "#f0b58b";
  c.fillRect(x + 16, y + 12, 18, 18);
  c.fillStyle = "#0d0b0d";
  c.fillRect(x + 8, y + 6, 30, 34);
  c.fillStyle = "#f0b58b";
  c.fillRect(x + 17, y + 14, 15, 14);
  c.fillStyle = "#fff7d1";
  c.fillRect(x + 10, y + 36, 30, 30);
  c.fillStyle = "#e8dca8";
  c.fillRect(x + 4, y + 58, 42, 8);
}

function drawGroom(c, x, y) {
  c.fillStyle = "#f1c093";
  c.fillRect(x + 14, y + 12, 18, 18);
  c.fillStyle = "#7b4c2f";
  c.fillRect(x + 10, y + 6, 26, 14);
  c.fillStyle = "#f1c093";
  c.fillRect(x + 15, y + 16, 16, 12);
  c.fillStyle = "#26385f";
  c.fillRect(x + 8, y + 36, 30, 30);
  c.fillStyle = "#fff7d1";
  c.fillRect(x + 18, y + 36, 10, 18);
  c.fillStyle = "#171319";
  c.fillRect(x + 18, y + 48, 10, 18);
}

function getClothBounds() {
  return {
    x: player.x + 8,
    y: player.y,
    w: 100,
    h: 14,
  };
}

function getDateBounds(date) {
  const width = DATE_BUNCH_LOCAL_WIDTH * date.scale;
  const height = (DATE_BUNCH_LOCAL_BOTTOM - DATE_BUNCH_LOCAL_TOP) * date.scale;
  return {
    left: date.x - width * 0.5,
    right: date.x + width * 0.5,
    top: date.y,
    bottom: date.y + height,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    keys.add(event.key);
  }
});

document.addEventListener("keyup", (event) => {
  keys.delete(event.key);
});

document.querySelectorAll("[data-action='play']").forEach((button) => {
  button.addEventListener("click", () => showScreen("game"));
});

document.querySelectorAll("[data-action='skip']").forEach((button) => {
  button.addEventListener("click", () => showScreen("success"));
});

document.querySelectorAll("[data-action='home']").forEach((button) => {
  button.addEventListener("click", () => showScreen("start"));
});

infoButton.addEventListener("click", openInfo);

document.querySelector("[data-action='close-info']").addEventListener("click", closeInfo);

infoModal.addEventListener("click", (event) => {
  if (event.target === infoModal) {
    closeInfo();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !infoModal.hidden) {
    closeInfo();
  }
});

document.querySelectorAll("[data-lang]").forEach((button) => {
  button.addEventListener("click", () => setLanguage(button.dataset.lang));
});

document.querySelectorAll("[data-control]").forEach((button) => {
  const control = button.dataset.control;
  button.addEventListener("pointerdown", () => keys.add(control));
  button.addEventListener("pointerup", () => keys.delete(control));
  button.addEventListener("pointercancel", () => keys.delete(control));
  button.addEventListener("pointerleave", () => keys.delete(control));
});

gameCanvas.addEventListener("pointermove", (event) => {
  if (state !== "game" || event.pointerType === "mouse") return;
  const rect = gameCanvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * W;
  player.x = clamp(x - player.w / 2, 8, W - player.w - 8);
});

setLanguage(currentLanguage);
drawIntro();
