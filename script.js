'use strict';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const playerScoreEl = document.getElementById('playerScore');
const computerScoreEl = document.getElementById('computerScore');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

// Game objects
const paddleWidth = 12;
const paddleHeight = 110;
const paddleSpeed = 6;

const ballRadius = 8;
const initialBallSpeed = 5;
const maxBallSpeed = 12;

let playerScore = 0;
let computerScore = 0;

// Left paddle (player)
const leftPaddle = {
  x: 10,
  y: (HEIGHT - paddleHeight) / 2,
  width: paddleWidth,
  height: paddleHeight,
  dy: 0
};

// Right paddle (computer)
const rightPaddle = {
  x: WIDTH - paddleWidth - 10,
  y: (HEIGHT - paddleHeight) / 2,
  width: paddleWidth,
  height: paddleHeight,
  dy: 0
};

// Ball
const ball = {
  x: WIDTH / 2,
  y: HEIGHT / 2,
  radius: ballRadius,
  speed: initialBallSpeed,
  dx: initialBallSpeed * (Math.random() < 0.5 ? -1 : 1),
  dy: (Math.random() * 2 - 1) * initialBallSpeed
};

// State
let lastTime = 0;
let paused = false;
let mouseActive = false;
let mouseY = 0;
let upPressed = false;
let downPressed = false;
let waitingAfterScore = false;
let waitTimer = 0;
const waitDuration = 900; // ms

// Helpers
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function resetBall(towardsPlayer = false) {
  ball.x = WIDTH / 2;
  ball.y = HEIGHT / 2;
  ball.speed = initialBallSpeed;
  const angle = (Math.random() * Math.PI / 4) - (Math.PI / 8); // slight angle
  const dir = towardsPlayer ? -1 : 1;
  ball.dx = dir * ball.speed * Math.cos(angle);
  ball.dy = ball.speed * Math.sin(angle);
  waitingAfterScore = true;
  waitTimer = performance.now();
}

// Input: mouse
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseY = e.clientY - rect.top;
  mouseActive = true;
  // center paddle on mouse y
  leftPaddle.y = clamp(mouseY - leftPaddle.height / 2, 0, HEIGHT - leftPaddle.height);
});

// Input: keyboard
window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowUp') { upPressed = true; mouseActive = false; }
  if (e.code === 'ArrowDown') { downPressed = true; mouseActive = false; }
  if (e.code === 'Space') { paused = !paused; e.preventDefault(); }
  if (e.code === 'Enter') { // restart scores and center ball
    playerScore = 0; computerScore = 0;
    updateScoreboard();
    resetBall(false);
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowUp') upPressed = false;
  if (e.code === 'ArrowDown') downPressed = false;
});

// Main loop
function update(dt) {
  if (paused) return;

  // If waiting after score, pause ball movement for short time
  if (waitingAfterScore) {
    const now = performance.now();
    if (now - waitTimer > waitDuration) waitingAfterScore = false;
    else return;
  }

  // Player paddle movement via keys
  if (!mouseActive) {
    if (upPressed) leftPaddle.y -= paddleSpeed;
    else if (downPressed) leftPaddle.y += paddleSpeed;
  }
  leftPaddle.y = clamp(leftPaddle.y, 0, HEIGHT - leftPaddle.height);

  // Computer AI: move towards the ball with some maximum speed
  const centerRight = rightPaddle.y + rightPaddle.height / 2;
  const diff = ball.y - centerRight;
  const computerSpeed = 4 + Math.min(3, Math.abs(ball.dx) * 0.8); // adapt to ball speed
  if (Math.abs(diff) > 6) {
    rightPaddle.y += clamp(diff, -computerSpeed, computerSpeed);
    rightPaddle.y = clamp(rightPaddle.y, 0, HEIGHT - rightPaddle.height);
  }

  // Ball movement
  ball.x += ball.dx;
  ball.y += ball.dy;

  // Collide with top/bottom
  if (ball.y - ball.radius <= 0) {
    ball.y = ball.radius;
    ball.dy = -ball.dy;
  } else if (ball.y + ball.radius >= HEIGHT) {
    ball.y = HEIGHT - ball.radius;
    ball.dy = -ball.dy;
  }

  // Paddle collision helper
  function paddleCollision(paddle) {
    return (ball.x - ball.radius < paddle.x + paddle.width &&
            ball.x + ball.radius > paddle.x &&
            ball.y - ball.radius < paddle.y + paddle.height &&
            ball.y + ball.radius > paddle.y);
  }

  // Left paddle collision
  if (paddleCollision(leftPaddle) && ball.dx < 0) {
    // Place ball outside paddle to avoid sticking
    ball.x = leftPaddle.x + leftPaddle.width + ball.radius;
    // Reflect X and add some Y based on where it hit
    const relativeIntersectY = (leftPaddle.y + leftPaddle.height / 2) - ball.y;
    const normalizedRelative = relativeIntersectY / (leftPaddle.height / 2);
    const bounceAngle = normalizedRelative * (Math.PI / 4); // max 45deg
    const speed = Math.min(maxBallSpeed, Math.abs(ball.dx) + 0.4);
    ball.dx = speed * Math.cos(bounceAngle);
    ball.dy = -speed * Math.sin(bounceAngle);
  }

  // Right paddle collision
  if (paddleCollision(rightPaddle) && ball.dx > 0) {
    ball.x = rightPaddle.x - ball.radius;
    const relativeIntersectY = (rightPaddle.y + rightPaddle.height / 2) - ball.y;
    const normalizedRelative = relativeIntersectY / (rightPaddle.height / 2);
    const bounceAngle = normalizedRelative * (Math.PI / 4);
    const speed = Math.min(maxBallSpeed, Math.abs(ball.dx) + 0.4);
    ball.dx = -speed * Math.cos(bounceAngle);
    ball.dy = -speed * Math.sin(bounceAngle);
  }

  // Check scoring
  if (ball.x + ball.radius < 0) {
    // Computer scored
    computerScore += 1;
    updateScoreboard();
    resetBall(true); // send ball back toward player
  } else if (ball.x - ball.radius > WIDTH) {
    // Player scored
    playerScore += 1;
    updateScoreboard();
    resetBall(false);
  }
}

function drawNet() {
  const netWidth = 4;
  const segment = 14;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let y = 0; y < HEIGHT; y += segment * 1.4) {
    ctx.fillRect((WIDTH - netWidth) / 2, y, netWidth, segment);
  }
}

function draw() {
  // Clear
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // Background
  ctx.fillStyle = '#07121a';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Net
  drawNet();

  // Paddles
  ctx.fillStyle = '#1dd3a7';
  drawRoundedRect(ctx, leftPaddle.x, leftPaddle.y, leftPaddle.width, leftPaddle.height, 6);
  drawRoundedRect(ctx, rightPaddle.x, rightPaddle.y, rightPaddle.width, rightPaddle.height, 6);

  // Ball
  ctx.beginPath();
  ctx.fillStyle = '#f0f6f7';
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();

  // Scores (also shown in DOM)
  // Optionally draw center text when paused or after score
  if (paused) {
    ctx.font = '20px Inter, system-ui, Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED — Press Space to resume', WIDTH / 2, HEIGHT / 2);
  }
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

function updateScoreboard() {
  playerScoreEl.textContent = playerScore;
  computerScoreEl.textContent = computerScore;
}

// Animation
function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

// Start
updateScoreboard();
resetBall(false);
requestAnimationFrame(loop);

// Reset mouseActive if mouse leaves canvas
canvas.addEventListener('mouseleave', () => { mouseActive = false; });

// Prevent page scroll for arrow keys in some browsers
window.addEventListener('keydown', function(e) {
  if (["ArrowUp","ArrowDown","Space"].indexOf(e.code) > -1) {
    e.preventDefault();
  }
});
