/* global $, sessionStorage, document, requestAnimationFrame, cancelAnimationFrame, performance */

////////////////////////////////////////////////////////////////////////////////
///////////////////////// VARIABLE DECLARATIONS ///////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// HTML jQuery Objects
var board = $("#board");
var scoreElement = $("#score");
var highScoreElement = $("#highScore");
var snakePath;
var snakeOutlinePath;
var snakeRidgePath;
var snakeAnimationFrame;
var snakeVisualPositions;

// Game Variables
var score = 0; // variable to keep track of the score
var started = false; // variable to keep track of whether the game has started
var isEatingFruit = false;
var pendingGrowth = 0;
var isReversed = false;
var colors = ["red", "orange", "yellow", "green", "blue", "purple"];
var colorIndex

// TODO 4, Part 1: Create the apple variable
var apple = {};

// TODO 5, Part 1: Create the snake variable
const snake = {};

// Constant Variables
var ROWS = 20;
var COLUMNS = 20;
var SQUARE_SIZE = 20;
var KEY = {
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
};

// interval variable required for stopping the update function when the game ends
var updateInterval;

// variable to keep track of the key (keycode) last pressed by the user
var activeKey;

////////////////////////////////////////////////////////////////////////////////
////////////////////////////// GAME SETUP //////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

// TODO: turn on keyboard inputs
$("body").on("keydown", handleKeyDown);

// start the game
init();

function init() {
  // TODO 5, Part 2: initialize the snake
  // initialize a new snakeSquare Object
  snake.body = []; // Start with an empty body
  snake.head = undefined;
  snake.tail = undefined;
  pendingGrowth = 0;
  isReversed = false;
  createSnakeRenderer();
  makeSnakeSquare(10, 10); // Create the first square in the middle of the board
  makeSnakeSquare(10, 9); // Create a second square to the left of the first
  makeSnakeSquare(10, 8); // Create a third square to the left of the second
  snake.head = snake.body[0]; // Mark the first segment as the head
  snake.head.direction = "right";
  updateSnakeHeadFace();
  renderSnake();
  // TODO 4, Part 3: initialize the apple
  makeApple();

  // TODO 6, Part 1: Initialize the interval
  updateInterval = setInterval(update, 100);

}

////////////////////////////////////////////////////////////////////////////////
///////////////////////// PROGRAM FUNCTIONS ////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

/*
 * On each update tick update the snake's position and check for
 * collisions with the walls.
 */
function update() {
  // TODO 6, Part 2: Fill in the update function's code block
if (started && !isEatingFruit) {
  moveSnake();
}

if (hasHitWall() || hasCollidedWithSnake()) {
  endGame();
  return;
}

if (hasCollidedWithApple()) {
  handleAppleCollision();
}

updateWormMouth();

}

function checkForNewDirection(event) {
  /* 
  TODO 7: Update snake.head.direction based on the value of activeKey.

  BONUS: Only allow direction changes to take place if the new direction is
  perpendicular to the current direction
  */




  var newDirection;
  if (activeKey === KEY.LEFT) {
    newDirection = "left";
  } else if (activeKey === KEY.RIGHT) {
    newDirection = "right";
  } else if (activeKey === KEY.UP) {
    newDirection = "up";
  } else if (activeKey === KEY.DOWN) {
    newDirection = "down";
  }

  var isMovingHorizontally =
    snake.head.direction === "left" || snake.head.direction === "right";
  var isMovingVertically =
    snake.head.direction === "up" || snake.head.direction === "down";
  var isTurningPerpendicularly =
    (isMovingHorizontally && (newDirection === "up" || newDirection === "down")) ||
    (isMovingVertically && (newDirection === "left" || newDirection === "right"));

  if (isTurningPerpendicularly) {
    snake.head.direction = newDirection;
    updateSnakeHeadFace();
  }
}

function updateSnakeHeadFace() {
  var directions = "snake-facing-up snake-facing-down snake-facing-left snake-facing-right";
  snake.head.element
    .removeClass(directions)
    .addClass("snake-facing-" + snake.head.direction);
}

function updateWormMouth() {
  if (!snake.head || apple.row === undefined || apple.column === undefined) {
    return;
  }

  var rowDifference = snake.head.row - apple.row;
  var columnDifference = snake.head.column - apple.column;
  var isNearFruit =
    rowDifference * rowDifference + columnDifference * columnDifference <= 25;

  snake.head.element.toggleClass("worm-hungry", isNearFruit);
}

function moveSnake() {
  /* 
    TODO 10: Move each part of the snake's body such that it's body follows the head.
    
    HINT: To complete this TODO we must figure out the next direction, row, and 
    column for each snakeSquare in the snake's body. The parts of the snake are 
    stored in the Array snake.body and each part knows its current 
    column/row properties. 
  */
  var tailRow = snake.tail.row;
  var tailColumn = snake.tail.column;

  for (var i = snake.body.length - 1; i > 0; i--) {
    var currentSnakeSquare = snake.body[i];
    var snakeSquareInFront = snake.body[i - 1];

    moveBodyAToBodyB(currentSnakeSquare, snakeSquareInFront);

    repositionSquare(currentSnakeSquare);
  }


  //Before moving the head, check for a new direction from the keyboard input
  checkForNewDirection();

  /* 
    TODO 8: determine the next row and column for the snake's head
    
    HINT: The snake's head will need to move forward 1 square based on the value
    of snake.head.direction which may be one of "left", "right", "up", or "down"
  */
if (snake.head.direction === "left") {
  snake.head.column = snake.head.column - 1;
} else if (snake.head.direction === "right") {
  snake.head.column = snake.head.column + 1;
} else if (snake.head.direction === "up") {
  snake.head.row = snake.head.row - 1;
} else if (snake.head.direction === "down") {
  snake.head.row = snake.head.row + 1;
}

repositionSquare(snake.head);
if (pendingGrowth > 0) {
  makeSnakeSquare(tailRow, tailColumn);
  pendingGrowth--;
}
renderSnake();




}

// TODO 9: Create a new helper function

function moveBodyAToBodyB(bodyA, bodyB) {
  bodyA.row = bodyB.row;
  bodyA.column = bodyB.column;
  bodyA.direction = bodyB.direction;
}

function createSnakeRenderer() {
  if (snakeAnimationFrame) {
    cancelAnimationFrame(snakeAnimationFrame);
    snakeAnimationFrame = undefined;
  }
  snakeVisualPositions = undefined;

  var svgNamespace = "http://www.w3.org/2000/svg";
  var svg = document.createElementNS(svgNamespace, "svg");
  snakeOutlinePath = document.createElementNS(svgNamespace, "path");
  snakePath = document.createElementNS(svgNamespace, "path");
  snakeRidgePath = document.createElementNS(svgNamespace, "path");

  svg.setAttribute("class", "snake-renderer");
  [snakeOutlinePath, snakePath, snakeRidgePath].forEach(function (path) {
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-linecap", "butt");
    path.setAttribute("stroke-linejoin", "miter");
  });
  snakeOutlinePath.setAttribute("class", "sandworm-outline");
  snakeOutlinePath.setAttribute("stroke-width", SQUARE_SIZE);
  snakePath.setAttribute("class", "sandworm-body");
  snakePath.setAttribute("stroke-width", SQUARE_SIZE - 4);
  snakeRidgePath.setAttribute("class", "sandworm-ridges");
  snakeRidgePath.setAttribute("stroke-width", SQUARE_SIZE - 7);
  snakeRidgePath.setAttribute("stroke-dasharray", "1 4");

  svg.appendChild(snakeOutlinePath);
  svg.appendChild(snakePath);
  svg.appendChild(snakeRidgePath);
  board[0].appendChild(svg);
}

function renderSnake() {
  if (!snakePath || snake.body.length === 0) {
    return;
  }

  var targetPositions = snake.body.map(function (segment) {
    return { row: segment.row, column: segment.column };
  });

  if (!snakeVisualPositions) {
    snakeVisualPositions = targetPositions;
    drawSnakePath(snakeVisualPositions);
    return;
  }

  if (snakeAnimationFrame) {
    cancelAnimationFrame(snakeAnimationFrame);
  }

  while (snakeVisualPositions.length < targetPositions.length) {
    snakeVisualPositions.push(
      Object.assign({}, snakeVisualPositions[snakeVisualPositions.length - 1])
    );
  }
  snakeVisualPositions.length = targetPositions.length;

  var startPositions = snakeVisualPositions.map(function (position) {
    return { row: position.row, column: position.column };
  });
  var startTime = performance.now();
  var duration = 100;

  function animateSnake(timestamp) {
    var progress = Math.min((timestamp - startTime) / duration, 1);
    snakeVisualPositions = startPositions.map(function (start, index) {
      var target = targetPositions[index];
      return {
        row: start.row + (target.row - start.row) * progress,
        column: start.column + (target.column - start.column) * progress,
      };
    });

    drawSnakePath(snakeVisualPositions);

    if (progress < 1) {
      snakeAnimationFrame = requestAnimationFrame(animateSnake);
    } else {
      snakeAnimationFrame = undefined;
    }
  }

  snakeAnimationFrame = requestAnimationFrame(animateSnake);
}

function drawSnakePath(positions) {
  var pathPositions = [];
  for (var pointIndex = positions.length - 1; pointIndex >= 0; pointIndex--) {
    var point = positions[pointIndex];
    var lastPoint = pathPositions[pathPositions.length - 1];
    if (
      !lastPoint ||
      Math.hypot(point.column - lastPoint.column, point.row - lastPoint.row) > 0.001
    ) {
      pathPositions.push(point);
    }
  }

  if (pathPositions.length === 0) {
    return;
  }

  var firstSegment = pathPositions[0];
  var pathData =
    "M " +
    (firstSegment.column * SQUARE_SIZE + SQUARE_SIZE * 1.5) +
    " " +
    (firstSegment.row * SQUARE_SIZE + SQUARE_SIZE * 1.5);

  for (var i = 1; i < pathPositions.length; i++) {
    var current = pathPositions[i];
    var currentX = current.column * SQUARE_SIZE + SQUARE_SIZE * 1.5;
    var currentY = current.row * SQUARE_SIZE + SQUARE_SIZE * 1.5;
    pathData += " L " + currentX + " " + currentY;
  }

  snakePath.setAttribute("d", pathData);
  snakeOutlinePath.setAttribute("d", pathData);
  snakeRidgePath.setAttribute("d", pathData);
}



function hasHitWall() {
  /* 
    TODO 11: Should return true if the snake's head has collided with the four walls of the
    board, false otherwise.
    
    HINT: What will the row and column of the snake's head be if this were the case?
  */



  return (
    snake.head.row < 0 ||
    snake.head.row >= ROWS ||
    snake.head.column < 0 ||
    snake.head.column >= COLUMNS
  );
}

function hasCollidedWithApple() {
  /* 
    TODO 12: Should return true if the snake's head has collided with the apple, 
    false otherwise
    
    HINT: Both the apple and the snake's head are aware of their own row and column
  */



  return snake.head.row === apple.row && snake.head.column === apple.column;
}

function handleAppleCollision() {
  if (isEatingFruit) {
    return;
  }

  isEatingFruit = true;
  snake.head.element.addClass("worm-eating");
  var eatenFruit = apple.element;
  animateFruitIntoMouth(eatenFruit);

  // increase the score and update the score DOM element
  score++;
  scoreElement.text("Score: " + score);
  if (score % 10 === 0) {
    isReversed = !isReversed;
  }

  pendingGrowth++;
}

function animateFruitIntoMouth(fruitElement) {
  var mouthOffset = SQUARE_SIZE * 0.35;
  var targetLeft = snake.head.column * SQUARE_SIZE + SQUARE_SIZE;
  var targetTop = snake.head.row * SQUARE_SIZE + SQUARE_SIZE;

  if (snake.head.direction === "left") {
    targetLeft -= mouthOffset;
  } else if (snake.head.direction === "right") {
    targetLeft += mouthOffset;
  } else if (snake.head.direction === "up") {
    targetTop -= mouthOffset;
  } else if (snake.head.direction === "down") {
    targetTop += mouthOffset;
  }

  requestAnimationFrame(function () {
    fruitElement.css({ left: targetLeft, top: targetTop });
    fruitElement.addClass("apple-being-eaten");
  });

  setTimeout(function () {
    fruitElement.remove();
    makeApple();
    isEatingFruit = false;
    snake.head.element.removeClass("worm-eating");
    updateWormMouth();
  }, 220);
}

function hasCollidedWithSnake() {
  /* 
    TODO 13: Should return true if the snake's head has collided with any part of the
    snake's body.
    
    HINT: Each part of the snake's body is stored in the snake.body Array. The
    head and each part of the snake's body also knows its own row and column.
  */



  for (var i = 1; i < snake.body.length; i++) {
    if (
      snake.head.row === snake.body[i].row &&
      snake.head.column === snake.body[i].column
    ) {
      return true;
    }
  }

  return false;
}

function endGame() {
  // stop update function from running
  clearInterval(updateInterval);
  started = false; // reset the started variable

  // clear board of all elements
  board.empty();

  // update the highScoreElement to display the highScore
  highScoreElement.text("High Score: " + calculateHighScore());
  scoreElement.text("Score: 0");
  score = 0;

  // restart the game after 500 ms
  setTimeout(init, 500);
}

////////////////////////////////////////////////////////////////////////////////
////////////////////////// HELPER FUNCTIONS ////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

/* Create an HTML element for the apple using jQuery. Then find a random
 * position on the board that is not occupied and position the apple there.
 */
function makeApple() {
  // TODO 4, Part 2: Fill in this function's code block
// make the apple jQuery Object and append it to the board
var fruitTypes = [
  "fruit-apple",
  "fruit-orange",
  "fruit-lemon",
  "fruit-grapes",
  "fruit-watermelon",
];
var randomFruit = fruitTypes[Math.floor(Math.random() * fruitTypes.length)];
apple.element = $("<div>").addClass("apple " + randomFruit).appendTo(board);

// get a random available row/column on the board
var randomPosition = getRandomAvailablePosition();

// initialize the row/column properties on the Apple Object
apple.row = randomPosition.row;
apple.column = randomPosition.column;

// position the apple on the screen
repositionSquare(apple);
updateWormMouth();

}

/* Create an HTML element for a snakeSquare using jQuery. Then, given a row and
 * column on the board, position it on the screen. Finally, add the new
 * snakeSquare to the snake.body Array and set a new tail.
 */
function makeSnakeSquare(row, column) {
  // TODO 5, Part 2: Fill in this function's code block
// initialize a new snakeSquare Object
const snakeSquare = {};

// make the snakeSquare element and add it to the board
snakeSquare.element = $("<div>").addClass("snake").appendTo(board);

// assign the row and column position
snakeSquare.row = row;
snakeSquare.column = column;

// set the snake’s position visually
repositionSquare(snakeSquare);

// if this is the head, give it a unique ID
if (snake.body.length === 0) {
  snakeSquare.element.attr("id", "snake-head");
  var face = $("<span>").addClass("snake-face").appendTo(snakeSquare.element);
  $("<span>").addClass("worm-mouth").appendTo(face);
}

// add the square to the snake’s body and update the tail
snake.body.push(snakeSquare);
snake.tail = snakeSquare;
if (snake.head) {
  renderSnake();
}




}

/* 
  event.which returns the keycode of the key that is pressed when the
  keydown event occurs
  
  The KEY Object creates a map for the Arrow Keys to their keycode:

    KEY.LEFT = 37
    KEY.UP = 38
    KEY.RIGHT = 39
    KEY.DOWN = 40
*/
function handleKeyDown(event) {
  // TODO 7: make the handleKeyDown function register which key is pressed
  activeKey = event.which;
  if (isReversed) {
    if (activeKey === KEY.LEFT) {
      activeKey = KEY.RIGHT;
    } else if (activeKey === KEY.RIGHT) {
      activeKey = KEY.LEFT;
    } else if (activeKey === KEY.UP) {
      activeKey = KEY.DOWN;
    } else if (activeKey === KEY.DOWN) {
      activeKey = KEY.UP;
    }
  }

  // If a valid direction key is pressed, start the game
  if (
    event.which === KEY.LEFT ||
    event.which === KEY.RIGHT ||
    event.which === KEY.UP ||
    event.which === KEY.DOWN
  ) {
    started = true; // the game starts when the first key is pressed
  }
}

/* Given a gameSquare (which may be a snakeSquare or the apple), position
 * the gameSquare on the screen.
 */
function repositionSquare(square) {
  var squareElement = square.element;
  var row = square.row;
  var column = square.column;

  var buffer = 20;

  // position the square on the screen according to the row and column
  squareElement.css("left", column * SQUARE_SIZE + buffer);
  squareElement.css("top", row * SQUARE_SIZE + buffer);
}

/* Returns a (row,column) Object that is not occupied by another game component
 */
function getRandomAvailablePosition() {
  var spaceIsAvailable;
  var randomPosition = {};

  /* Generate random positions until one is found that doesn't overlap with the snake */
  while (!spaceIsAvailable) {
    randomPosition.column = Math.floor(Math.random() * COLUMNS);
    randomPosition.row = Math.floor(Math.random() * ROWS);
    spaceIsAvailable = true;

    /*
      TODO 14: After generating the random position determine if that position is
      not occupied by a snakeSquare in the snake's body. If it is then set 
      spaceIsAvailable to false so that a new position is generated.
    */
    for (var i = 0; i < snake.body.length; i++) {
      if (
        randomPosition.row === snake.body[i].row &&
        randomPosition.column === snake.body[i].column
      ) {
        spaceIsAvailable = false;
        break;
      }
    }

  }

  return randomPosition;
}

function calculateHighScore() {
  // retrieve the high score from session storage if it exists, or set it to 0
  var highScore = sessionStorage.getItem("highScore") || 0;

  if (score > highScore) {
    sessionStorage.setItem("highScore", score);
    highScore = score;
    alert("New High Score!");
  }

  return highScore;
}
