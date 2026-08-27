///// DO NOT CHANGE ANYTHING IN THIS FILE /////

///////////////////////////////////////////////
// Core functionality /////////////////////////
///////////////////////////////////////////////
const poisonSplashes = [];

function registerSetup(setup) {
  setupGame = setup;
}

function main() {
  ctx.clearRect(0, 0, 1400, 750); //erase the screen so you can draw everything in it's most current position
  if (platformerScreenState !== "playing") {
    drawPlatformerScreen();
    return;
  }
  const cameraFollowEnabled = window.cameraFollowEnabled !== false;
  const cameraZoom = cameraFollowEnabled ? 1.2 : 1;
  const visibleWidth = canvas.width / cameraZoom;
  const visibleHeight = canvas.height / cameraZoom;
  const desiredCameraX = player.x - visibleWidth / 2;
  const playerCenterY = player.y + (player.height || 0) / 2;
  const desiredCameraY = playerCenterY - visibleHeight / 2;
  const cameraX = cameraFollowEnabled
    ? Math.max(0, Math.min(desiredCameraX, canvas.width - visibleWidth))
    : 0;
  const cameraY = cameraFollowEnabled
    ? Math.max(0, Math.min(desiredCameraY, canvas.height - visibleHeight))
    : 0;
  ctx.save();
  ctx.translate(-cameraX * cameraZoom, -cameraY * cameraZoom);
  ctx.scale(cameraZoom, cameraZoom);

  if (shouldDrawGrid) {
    makeGrid();
  }

  if (player.deadAndDeathAnimationDone) {
    ctx.restore();
    deathOfPlayer();
    return;
  }

  if (player.winConditionMet) {
    winGame();
    ctx.restore();
    return;
  }

  drawPlatforms();
  drawFakePlatforms();
  drawBadPlatforms();
  drawProjectiles();
  drawCannons();
  drawCollectables();
  const ledgeJumpPaused = performance.now() < (window.ledgeJumpPauseUntil || 0);

  if (!ledgeJumpPaused && window.ledgeGrabState) {
    player.x = window.ledgeGrabState.targetX;
    player.y = window.ledgeGrabState.targetY;
    player.onGround = true;
    keyPress.space = false;
    keyPress.up = false;
    window.ledgeGrabState = null;
  }

  if (!ledgeJumpPaused) {
    playerFrictionAndGravity();

    player.x += player.speedX;
    player.y += player.speedY;

    collision(); //checks if the player will collide with something in this frame
    keyboardControlActions(); //keyboard controls.
    projectileCollision(); //checks if the player is getting hit by a projectile in the next frame
    keyPress.downPressed = false;
    badPlatformCollision(); //checks if the player is touching a bad platform
    collectablesCollide(); //checks if collectable has touched the player

    animate(); //this changes halle's picture to the next frame so it looks animated.
  }
  // debug()                   //debugging values. Comment this out when not debugging.
  drawRobot(); //this actually displays the image of the robot.
  drawDodgeCallout();
  for (const badPlatform of badPlatforms) {
    if (badPlatform.isPoisonLake) {
      drawPoisonLake(badPlatform);
    }
  }
  drawPoisonSplashes();
  ctx.restore();
}

function getJSON(url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);
  xhr.responseType = "json";
  xhr.onload = function () {
    var status = xhr.status;
    if (status === 200) {
      callback(null, xhr.response);
      setupGame();
    } else {
      callback(status, xhr.response);
    }
  };
  xhr.send();
}

function JsonFunction(status, response) {
  /*
      diagram of the json
      top level is the name of the animation
      also don't you dare complain, this is operation sparks fault for making the animation so complicated.
      animation name{
          coordinates{
              sx: xpadding,
              sy: ypadding,
              width: cords.swidth,
              height: cords.sheight,
              hitWidth: 50, //cords.width,
              hitHeight: 105,//cords.height,
              hitDx: 0,
              hitDy: 0,
              xoffset: xoffset,
              yoffset: yoffset,
          }
          maxHeight: largest size the sprite can be
          maxWidth: 
      }
    */
  animationDetails = response;
}

///////////////////////////////////////////////
// Helper functions ///////////////////////////
///////////////////////////////////////////////

function changeAnimationType() {
  if (currentAnimationType === animationTypes.frontDeath) {
    if (
      frameIndex >= animationDetails[currentAnimationType].coordinates.length
    ) {
      player.deadAndDeathAnimationDone = true;
    }
    return;
  }
  if (jumpTimer > 0 && !player.onGround) {
    currentAnimationType = animationTypes.jump;
    jumpTimer--;
  } else {
    jumpTimer = 0;
    if (Math.abs(player.speedX) > 0) {
      //if you're moving then change animation to walking or running
      if (keyPress.left || keyPress.right) {
        currentAnimationType = animationTypes.run;
      } else {
        currentAnimationType = animationTypes.walk;
      }
    } else if (player.onGround) {
      if (keyPress.down) {
        currentAnimationType = animationTypes.duck;
        if (duckTimer < DUCK_COUNTER_IDLE_VALUE) {
          // not using index 0 because the animation is too slow then
          frameIndex = 3;
          duckTimer = DUCK_COUNTER_IDLE_VALUE * 2 - frameIndex;
        }
      } else if (
        duckTimer === 0 ||
        currentAnimationType === animationTypes.walk
      ) {
        currentAnimationType = animationTypes.frontIdle;
      }
    }
  }
}

function debug() {
  debugVar = true;

  // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/fillText
  ctx.fillText("xs" + player.speedX + " x: " + player.x, 500, 200);
  ctx.fillText("ys" + player.speedY + " y: " + player.y, 500, 250);

  ctx.fillStyle = "black";
  ctx.fillText("on ground " + player.onGround, 150 + player.x, player.y - 20);
  ctx.fillText("hitx" + hitDx, 150 + player.x, player.y);
  ctx.fillText("hity" + hitDy, 150 + player.x, player.y + 20);
  ctx.fillText("offsetx" + offsetX, 150 + player.x, player.y + 40);
  ctx.fillText("offsetY" + offsetY, 150 + player.x, player.y + 60);

  ctx.fillStyle = "grey";
  ctx.fillRect(player.x, player.y, player.width, player.height);

  //debug showing collision
  ctx.fillStyle = "yellow";
  ctx.fillRect(500, 100, 50, 50);

  ctx.fillStyle = "green";
  ctx.fillRect(player.x, player.y, hitBoxWidth, hitBoxHeight);

  if (collision() !== undefined) {
    ctx.fillStyle = "yellow";
    ctx.fillRect(player.x, player.y - 50, 10, 10);
  }
}

function animate() {
  if (
    !(
      keyPress.down &&
      duckTimer === DUCK_COUNTER_IDLE_VALUE &&
      currentAnimationType === animationTypes.duck
    )
  ) {
    frameIndex = frameIndex + 15 / frameRate;
    if (duckTimer > 0) {
      duckTimer -= 0.25;
    }
  }
  changeAnimationType();
  if (frameIndex >= animationDetails[currentAnimationType].coordinates.length) {
    frameIndex = 0;
  }
  spriteX =
    animationDetails[currentAnimationType].coordinates[Math.floor(frameIndex)]
      .sx;
  spriteY =
    animationDetails[currentAnimationType].coordinates[Math.floor(frameIndex)]
      .sy;
  spriteWidth =
    animationDetails[currentAnimationType].coordinates[Math.floor(frameIndex)]
      .width;
  spriteHeight =
    animationDetails[currentAnimationType].coordinates[Math.floor(frameIndex)]
      .height;
  maxWidth = animationDetails[currentAnimationType].maxWidth * playerScale;
  maxHeight = animationDetails[currentAnimationType].maxHeight * playerScale;
  offsetX =
    animationDetails[currentAnimationType].coordinates[Math.floor(frameIndex)]
      .xoffset * playerScale;
  offsetY =
    animationDetails[currentAnimationType].coordinates[Math.floor(frameIndex)]
      .yoffset * playerScale;
  player.width =
    animationDetails[currentAnimationType].coordinates[Math.floor(frameIndex)]
      .width * playerScale;
  player.height =
    animationDetails[currentAnimationType].coordinates[Math.floor(frameIndex)]
      .height * playerScale;
  hitDx =
    animationDetails[currentAnimationType].coordinates[Math.floor(frameIndex)]
      .hitDx * playerScale;
  hitDy =
    animationDetails[currentAnimationType].coordinates[Math.floor(frameIndex)]
      .hitDy * playerScale;
}

let hallePixelCanvas;
let hallePixelContext;

function drawHallebotPixelArt(x, y, width, height) {
  const animationFrame = Math.floor(frameIndex) % 4;
  const isRunning = currentAnimationType === animationTypes.run;
  const isWalking = currentAnimationType === animationTypes.walk;
  const isJumping =
    currentAnimationType === animationTypes.jump ||
    currentAnimationType === animationTypes.flyingJump;
  const isDucking = currentAnimationType === animationTypes.duck;
  const isLazer = currentAnimationType === animationTypes.lazer;
  const isDead = currentAnimationType === animationTypes.frontDeath;
  const legStep = isRunning ? [0, 4, 0, -4][animationFrame] : 0;
  const armStep = isWalking ? [0, 2, 0, -2][animationFrame] : 0;
  const crouch = isDucking ? 12 : 0;
  const bodyY = 34 + crouch;
  const legY = isDucking ? 77 : 71;
  const pixelScaleX = width / 70;
  const pixelScaleY = height / 113;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x, y);
  ctx.scale(pixelScaleX, pixelScaleY);

  if (isDead) {
    ctx.rotate(-0.12);
  }

  ctx.fillStyle = "#101b2c";
  ctx.fillRect(19, 3, 31, 4);
  ctx.fillRect(14, 7, 41, 22);
  ctx.fillRect(18, 29, 33, 6);
  ctx.fillRect(9, bodyY + 5, 52, 38);
  ctx.fillRect(14, bodyY + 43, 42, 9);

  ctx.fillStyle = "#31526a";
  ctx.fillRect(21, 7, 27, 4);
  ctx.fillRect(18, 11, 34, 15);
  ctx.fillRect(22, 26, 25, 5);
  ctx.fillRect(14, bodyY + 9, 42, 30);
  ctx.fillRect(19, bodyY + 39, 32, 8);

  ctx.fillStyle = "#6ca0ad";
  ctx.fillRect(23, 8, 17, 3);
  ctx.fillRect(18, 13, 5, 7);
  ctx.fillRect(23, bodyY + 10, 13, 4);
  ctx.fillRect(16, bodyY + 17, 5, 13);
  ctx.fillRect(42, bodyY + 34, 9, 4);

  ctx.fillStyle = "#0b111d";
  ctx.fillRect(20, 15, 31, 10);
  ctx.fillRect(25, 12, 20, 3);
  ctx.fillRect(28, 25, 15, 3);
  ctx.fillStyle = "#8ee7dc";
  ctx.fillRect(25, 17, 21, 4);
  ctx.fillRect(29, 21, 10, 2);
  ctx.fillStyle = "#d5fff0";
  ctx.fillRect(27, 17, 7, 2);

  ctx.fillStyle = "#1b3144";
  ctx.fillRect(5, bodyY + 8, 9, 27);
  ctx.fillRect(56, bodyY + 8, 9, 27);
  ctx.fillStyle = "#4f7b86";
  ctx.fillRect(7, bodyY + 12, 5, 15);
  ctx.fillRect(57, bodyY + 12, 5, 15);

  ctx.fillStyle = "#172536";
  ctx.fillRect(18, legY + legStep, 14, 29);
  ctx.fillRect(39, legY - legStep, 14, 29);
  ctx.fillRect(14, 99 + legStep, 20, 8);
  ctx.fillRect(37, 99 - legStep, 20, 8);
  ctx.fillStyle = "#496b79";
  ctx.fillRect(21, legY + 5 + legStep, 7, 17);
  ctx.fillRect(42, legY + 5 - legStep, 7, 17);
  ctx.fillRect(16, 100 + legStep, 12, 3);
  ctx.fillRect(40, 100 - legStep, 12, 3);

  ctx.fillStyle = "#a9d1c3";
  ctx.fillRect(31, bodyY + 8, 8, 5);
  ctx.fillRect(34, bodyY + 18, 5, 6);
  ctx.fillStyle = "#263e4c";
  ctx.fillRect(29, bodyY + 27, 13, 9);
  ctx.fillStyle = "#e2c45f";
  ctx.fillRect(32, bodyY + 29, 7, 4);

  ctx.fillStyle = "#111b2a";
  ctx.fillRect(11, bodyY + 31 + armStep, 9, 22);
  ctx.fillRect(50, bodyY + 31 - armStep, 9, 22);
  ctx.fillRect(8, bodyY + 49 + armStep, 12, 7);
  ctx.fillRect(50, bodyY + 49 - armStep, 12, 7);
  ctx.fillStyle = "#6b9ba1";
  ctx.fillRect(13, bodyY + 35 + armStep, 5, 13);
  ctx.fillRect(52, bodyY + 35 - armStep, 5, 13);
  ctx.fillRect(10, bodyY + 50 + armStep, 7, 3);
  ctx.fillRect(52, bodyY + 50 - armStep, 7, 3);

  ctx.fillStyle = "#182838";
  ctx.fillRect(3, 39, 9, 24);
  ctx.fillRect(57, 39, 10, 24);
  ctx.fillStyle = "#3f6878";
  ctx.fillRect(5, 43, 5, 13);
  ctx.fillRect(58, 43, 6, 13);

  ctx.fillStyle = "#101b2c";
  ctx.fillRect(27, 0, 5, 4);
  ctx.fillRect(28, -4, 3, 4);
  ctx.fillStyle = "#e2c45f";
  ctx.fillRect(28, 1, 3, 3);

  if (isLazer) {
    ctx.fillStyle = "#d5fff0";
    ctx.fillRect(61, bodyY + 42, 9, 4);
    ctx.fillStyle = "#65e9d4";
    ctx.fillRect(69, bodyY + 43, 22, 2);
  }

  if (isJumping) {
    ctx.fillStyle = "#e2c45f";
    ctx.fillRect(11, 105, 7, 3);
    ctx.fillRect(52, 105, 7, 3);
  }

  ctx.restore();
}

function drawPixelatedHallebot(
  image,
  sourceX,
  sourceY,
  sourceWidth,
  sourceHeight,
  destinationX,
  destinationY,
  destinationWidth,
  destinationHeight,
) {
  if (!hallePixelCanvas) {
    hallePixelCanvas = document.createElement("canvas");
    hallePixelContext = hallePixelCanvas.getContext("2d");
  }

  const pixelWidth = Math.max(1, Math.round(destinationWidth / 3));
  const pixelHeight = Math.max(1, Math.round(destinationHeight / 3));
  hallePixelCanvas.width = pixelWidth;
  hallePixelCanvas.height = pixelHeight;
  hallePixelContext.imageSmoothingEnabled = true;
  hallePixelContext.clearRect(0, 0, pixelWidth, pixelHeight);
  hallePixelContext.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    pixelWidth,
    pixelHeight,
  );

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    hallePixelCanvas,
    0,
    0,
    pixelWidth,
    pixelHeight,
    destinationX,
    destinationY,
    destinationWidth,
    destinationHeight,
  );
  ctx.restore();
}

function drawRobot() {
  //ctx.drawImage(imageVaribale, sourceY, SourceX, sourceWidth, sourceHeight, canvasX, canvasY, finalWidth, finalHeight)
  //https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage
  //you only need the extra four source arguments if you want to display just a portion of the picture; if you want to show the whole picture you can just do drawImage(imageVar, canvasX, canvasY, width, height)

  //next section draws hallie. There is an if so that the image is reversed based on the direction of travel
  //there is also a hitDx and hitDy; those are offsets for the animation; enable debugger to see the true hitbox in green
  //you can enable the debug view by uncommenting the debug() function call in the main function.
  if (player.deadAndDeathAnimationDone) {
    return; //return stops the function, we don't want to draw the robot after we die
  }

  ctx.save();
  const dodgeElapsed = performance.now() - (window.dodgeStartedAt || 0);
  if (dodgeElapsed >= 0 && dodgeElapsed < 300) {
    ctx.filter = "grayscale(1) brightness(0.45)";
  } else if (dodgeElapsed < 600) {
    ctx.filter = "grayscale(0.2) brightness(1.65)";
  }

  if (player.facingRight) {
    ctx.drawImage(
      halleImage,
      spriteX,
      spriteY,
      spriteWidth,
      spriteHeight,
      player.x - hitDx,
      player.y - hitDy,
      player.width,
      player.height,
    );
  } else {
    //for running to the left you mirror the image
    ctx.save();
    ctx.scale(-1, 1); //mirror the entire canvas
    ctx.drawImage(
      halleImage,
      spriteX,
      spriteY,
      spriteWidth,
      spriteHeight,
      -player.x - player.width + hitDx,
      player.y - hitDy,
      player.width,
      player.height,
    );
    ctx.restore(); //put the canvas back to normal
  }
  ctx.restore();
}

function collision() {
  player.onGround = false; // Reset this every frame; if the player is actually on the ground, the resolveCollision function will set it to true
  var result = undefined;
  for (var i = 0; i < platforms.length; i++) {
    // Check for collision
    if (
      player.x + hitBoxWidth > platforms[i].x &&
      player.x < platforms[i].x + platforms[i].width &&
      player.y < platforms[i].y + platforms[i].height &&
      player.y + hitBoxHeight > platforms[i].y
    ) {
      //now that we know we have collided, we figure out the direction of collision
      result = resolveCollision(
        platforms[i].x,
        platforms[i].y,
        platforms[i].width,
        platforms[i].height,
      );
    }
  }
  return result;
}

function resolveCollision(objx, objy, objw, objh) {
  //this is the return value
  let collisionDirection = "";
  //found here https://stackoverflow.com/questions/38648693/resolve-collision-of-two-2d-elements
  //first we find the distance between the center of the object and the player
  let dx = player.x + hitBoxWidth / 2 - (objx + objw / 2);
  let dy = player.y + hitBoxHeight / 2 - (objy + objh / 2);

  //get half-widths of each item
  let halfWidth = hitBoxWidth / 2 + objw / 2;
  let halfHeight = hitBoxHeight / 2 + objh / 2;

  // if the x and y vector are less than the half width or half height,
  // then we must be inside the object, causing a collision
  let originx = halfWidth - Math.abs(dx);
  let originy = halfHeight - Math.abs(dy);

  if (debugVar) {
    //debug
    ctx.strokeStyle = "blue";
    ctx.beginPath();
    ctx.moveTo(objx + dx, objy);
    ctx.lineTo(objx, objy);
    ctx.lineTo(objx, objy + dy);
    ctx.stroke();
    ctx.fillStyle = "rbga(252,186,3,.3)";
    ctx.fillRect(player.x, player.y, hitBoxWidth, hitBoxHeight);
  }

  if (originx >= originy) {
    if (dy > 0) {
      //bottom collision
      collisionDirection = "bottom";
      player.y = player.y + originy + 1;
      player.speedY = 0;
    } else {
      //top collision
      collisionDirection = "top";
      player.y = player.y - originy;
      player.speedY = 0;
      player.onGround = true;
    }
  } else {
    if (dx > 0) {
      //left collision
      collisionDirection = "left";
      player.x = player.x + originx;
      player.speedX = 0;
    } else {
      //right collision
      collisionDirection = "right";
      player.x = player.x - originx;
      player.speedX = 0;
    }
  }

  return collisionDirection;
}

function projectileCollision() {
  //checking if the player is dead
  if (currentAnimationType === animationTypes.frontDeath) {
    return;
  }

  for (var i = 0; i < projectiles.length; i++) {
    //this deletes any projectiles that go off the screen
    if (
      projectiles[i].x > canvas.width + 100 + projectiles[i].width ||
      projectiles[i].x < -100 - projectiles[i].width ||
      projectiles[i].y > canvas.height + 100 + projectiles[i].height ||
      projectiles[i].y < -100 - projectiles[i].height
    ) {
      projectiles.splice(i, 1);
    }

    if (i === projectiles.length) {
      return;
    }

    //collision with the player
    if (
      projectiles[i].x < player.x + hitBoxWidth &&
      projectiles[i].x + projectiles[i].width > player.x &&
      projectiles[i].y < player.y + hitBoxHeight &&
      projectiles[i].y + projectiles[i].height > player.y
    ) {
      if (keyPress.downPressed) {
        triggerDodge(projectiles[i]);
        projectiles.splice(i, 1);
        i--;
        continue;
      }
      currentAnimationType = animationTypes.frontDeath;
      frameIndex = 0;
    }
  }
}

function triggerDodge(projectile) {
  const direction = Math.random() < 0.5 ? -1 : 1;
  const now = performance.now();
  window.dodgeStartedAt = now;
  window.dodgeUntil = now + 600;
  window.dodgeCallout = {
    x: player.x + hitBoxWidth / 2 + direction * 40,
    y: player.y - 25 - Math.random() * 35,
    direction,
    startedAt: now,
  };
}

function drawDodgeCallout() {
  const callout = window.dodgeCallout;
  if (!callout) {
    return;
  }

  const elapsed = performance.now() - callout.startedAt;
  if (elapsed >= 600) {
    window.dodgeCallout = null;
    return;
  }
  const progress = elapsed / 600;
  const alpha =
    progress < 0.15 ? progress / 0.15 : 1 - (progress - 0.15) / 0.85;
  const x = callout.x + callout.direction * progress * 18;
  const y = callout.y - progress * 12;

  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#f1ead2";
  ctx.fillRect(x - 66, y - 25, 132, 39);
  ctx.fillRect(x + callout.direction * 58, y + 14, 12, 10);
  ctx.fillStyle = "#292b32";
  ctx.fillRect(x - 60, y - 19, 120, 3);
  ctx.font = "bold 20px monospace";
  ctx.textAlign = "center";
  ctx.fillText("DODGE!!!", x, y + 2);
  ctx.fillRect(x - 48, y + 7, 96, 2);
  ctx.fillRect(x - 44, y + 11, 88, 2);
  ctx.fillRect(x - 40, y + 15, 80, 2);
  ctx.restore();
}

function badPlatformCollision() {
  if (currentAnimationType === animationTypes.frontDeath) {
    return;
  }
  for (var i = 0; i < badPlatforms.length; i++) {
    if (
      player.x + hitBoxWidth > badPlatforms[i].x &&
      player.x < badPlatforms[i].x + badPlatforms[i].width &&
      player.y < badPlatforms[i].y + badPlatforms[i].height &&
      player.y + hitBoxHeight > badPlatforms[i].y
    ) {
      currentAnimationType = animationTypes.frontDeath;
      frameIndex = 0;
    }
  }
}

function deathOfPlayer() {
  if (!deathScreenStartedAt) {
    deathScreenStartedAt = performance.now();
  }

  const elapsed = performance.now() - deathScreenStartedAt;
  const fadeToBlack = Math.min(elapsed / 900, 1);
  const promptOpacity = Math.min(Math.max((elapsed - 500) / 500, 0), 1);

  ctx.fillStyle = `rgba(0, 0, 0, ${fadeToBlack})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = `rgba(255, 255, 255, ${fadeToBlack})`;
  ctx.font = "bold 42px monospace";
  ctx.fillText(
    "Don't give up just yet.",
    canvas.width / 2,
    canvas.height / 2 - 18,
  );

  ctx.fillStyle = `rgba(128, 128, 128, ${promptOpacity})`;
  ctx.font = "18px monospace";
  ctx.fillText(
    "[Press any key to continue.]",
    canvas.width / 2,
    canvas.height / 2 + 36,
  );

  if (keyPress.any) {
    keyPress.any = false;
    window.location.reload();
  }
}

function playerFrictionAndGravity() {
  //max speed limiter for ground
  if (player.speedX > maxSpeed) {
    player.speedX = maxSpeed;
  } else if (player.speedX < -maxSpeed) {
    player.speedX = -maxSpeed;
  }
  //friction
  if (Math.abs(player.speedX) < 1) {
    //this makes sure that the player actually stops when the speed gets low enough
    //otherwise if you just always reduce speed it will just end up jiggling
    player.speedX = 0;
  } else if (player.speedX > 0) {
    player.speedX = player.speedX - friction;
  } else {
    player.speedX = player.speedX + friction;
  }

  if (player.onGround === false) {
    player.speedY = player.speedY + gravity;
  }
}

function drawPlatforms() {
  for (var i = 0; i < platforms.length; i++) {
    // Check if platform should move horizontally
    if (platforms[i].minX !== null && platforms[i].maxX !== null) {
      // Move platform based on speed and direction
      platforms[i].x += platforms[i].speedX * platforms[i].directionX;

      // Reverse direction if platform reaches minX or maxX bounds
      if (platforms[i].x < platforms[i].minX) {
        platforms[i].x = platforms[i].minX;
        platforms[i].directionX *= -1; // Change direction to right
      } else if (platforms[i].x > platforms[i].maxX) {
        platforms[i].x = platforms[i].maxX;
        platforms[i].directionX *= -1; // Change direction to left
      }
    }

    // Check if platform should move vertically
    if (platforms[i].minY !== null && platforms[i].maxY !== null) {
      // Move platform based on speed and direction
      platforms[i].y += platforms[i].speedY * platforms[i].directionY;
      // Reverse direction if platform reaches minY or maxY bounds
      if (platforms[i].y < platforms[i].minY) {
        platforms[i].y = platforms[i].minY;
        platforms[i].directionY *= -1; // Change direction to down
      } else if (platforms[i].y > platforms[i].maxY) {
        platforms[i].y = platforms[i].maxY;
        platforms[i].directionY *= -1; // Change direction to up
      }
    }

    drawGrassPlatform(platforms[i]);
  }
}

function drawGrassPlatform(platform) {
  const { x, y, width, height } = platform;
  const frame = Math.floor(Date.now() / 160);

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = "#321c16";
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = "#5a301d";
  ctx.fillRect(x, y + 7, width, Math.max(height - 7, 0));
  ctx.fillStyle = "#754225";
  ctx.fillRect(x, y + 13, width, Math.max(height - 13, 0));
  ctx.fillStyle = "#9a5b2f";
  ctx.fillRect(x, y + 17, width, Math.max(height - 17, 0));

  for (let detailX = x + 8; detailX < x + width - 4; detailX += 38) {
    const detailPhase = Math.floor(detailX / 38);
    const detailY = y + 10 + ((detailPhase * 7) % 12);
    ctx.fillStyle = detailPhase % 2 === 0 ? "#321c16" : "#4a291c";
    ctx.fillRect(detailX, detailY, 7, 3);
    ctx.fillRect(detailX + 5, detailY + 3, 5, 3);
    ctx.fillStyle = "#b66d35";
    ctx.fillRect(detailX + 18, detailY + 5, 5, 3);
  }

  for (let grassX = x - 4; grassX < x + width; grassX += 16) {
    const bend = Math.round(Math.sin(frame * 0.35 + grassX / 28) * 2);
    ctx.fillStyle = "#173b22";
    ctx.fillRect(grassX, y - 2 + bend, 16, 6);
    ctx.fillStyle = "#28633a";
    ctx.fillRect(grassX + 2 + bend, y - 5, 8, 5);
    ctx.fillStyle = "#62b84f";
    ctx.fillRect(grassX + 4 + bend, y - 8, 4, 5);
    ctx.fillRect(grassX + 10 + bend, y - 4, 3, 4);
  }

  ctx.fillStyle = "#3d2419";
  ctx.fillRect(x + 12, y + 21, 3, Math.min(height, 10));
  ctx.fillRect(x + width - 20, y + 8, 3, Math.min(height, 12));
  ctx.restore();
}

function drawFakePlatforms() {
  for (var i = 0; i < fakePlatforms.length; i++) {
    const { color, x, y, width, height } = fakePlatforms[i];
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
  }
}

function drawBadPlatforms() {
  for (var i = 0; i < badPlatforms.length; i++) {
    const badPlatform = badPlatforms[i];
    const { color, x, y, width, height } = badPlatform;

    if (badPlatform.isPoisonLake) {
      continue;
    }

    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
  }
}

function drawPoisonLake(lake) {
  const frame = Math.floor(Date.now() / 120);

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = "#123b32";
  ctx.fillRect(lake.x, lake.y, lake.width, lake.height);
  ctx.fillStyle = "#1a5540";
  ctx.fillRect(lake.x, lake.y + 12, lake.width, lake.height - 12);
  ctx.fillStyle = "#237253";
  ctx.fillRect(lake.x, lake.y + 30, lake.width, lake.height - 30);

  const waveStart = Math.max(lake.x - 12, player.x - canvas.width);
  const waveEnd = Math.min(lake.x + lake.width, player.x + canvas.width);
  for (let x = waveStart; x < waveEnd; x += 12) {
    const waveOffset = Math.round(
      Math.sin((x - lake.x) / 32 + frame * 0.35) * 2,
    );
    ctx.fillStyle = "#72d66d";
    ctx.fillRect(x, lake.y + waveOffset, 10, 4);
    ctx.fillStyle = "#3ca85c";
    ctx.fillRect(x + 4, lake.y + 4 + waveOffset, 8, 4);
  }

  const bubbles = [
    { x: 90, y: 18, size: 5, phase: 0 },
    { x: 240, y: 38, size: 4, phase: 3 },
    { x: 420, y: 22, size: 6, phase: 6 },
    { x: 610, y: 42, size: 4, phase: 1 },
    { x: 790, y: 20, size: 5, phase: 4 },
    { x: 980, y: 36, size: 6, phase: 7 },
    { x: 1170, y: 17, size: 4, phase: 2 },
    { x: 1330, y: 40, size: 5, phase: 5 },
  ];

  for (const bubble of bubbles) {
    const bubbleFrame = (frame + bubble.phase) % 12;
    const bubbleX = lake.x + bubble.x;

    if (bubbleFrame < 8) {
      const bubbleY = lake.y + bubble.y - bubbleFrame * 2;
      ctx.fillStyle = "#8bea79";
      ctx.fillRect(bubbleX, bubbleY, bubble.size, bubble.size);
      ctx.fillStyle = "#347f4e";
      ctx.fillRect(bubbleX + bubble.size, bubbleY + 2, 3, bubble.size - 2);
    } else {
      const popSize = (bubbleFrame - 7) * 3;
      ctx.fillStyle = "#8bea79";
      ctx.fillRect(bubbleX - popSize, lake.y + bubble.y, 3, 3);
      ctx.fillRect(bubbleX + popSize, lake.y + bubble.y, 3, 3);
      ctx.fillRect(bubbleX, lake.y + bubble.y - popSize, 3, 3);
    }
  }

  ctx.restore();
}

function drawPoisonSplashes() {
  ctx.save();
  for (let i = poisonSplashes.length - 1; i >= 0; i--) {
    const splash = poisonSplashes[i];
    const progress = splash.frame / 18;
    const spread = Math.round(progress * 40);
    const rise = Math.round((1 - progress) * 30);
    ctx.globalAlpha = 1 - progress;

    ctx.fillStyle = "#d0ff91";
    ctx.fillRect(splash.x - 3, splash.y - rise - 8, 6, 8);
    ctx.fillRect(splash.x - spread, splash.y - rise, 6, 6);
    ctx.fillRect(splash.x + spread, splash.y - rise, 6, 6);
    ctx.fillRect(splash.x - 18, splash.y - Math.round(rise * 0.6), 6, 6);
    ctx.fillRect(splash.x + 12, splash.y - Math.round(rise * 0.6), 6, 6);
    ctx.fillStyle = "#4cc267";
    ctx.fillRect(splash.x - spread - 4, splash.y + 4, 14, 5);
    ctx.fillRect(splash.x + spread - 10, splash.y + 4, 14, 5);
    ctx.fillRect(splash.x - 24, splash.y + 8, 12, 4);
    ctx.fillRect(splash.x + 12, splash.y + 8, 12, 4);

    splash.frame++;
    if (splash.frame > 18) {
      poisonSplashes.splice(i, 1);
    }
  }
  ctx.restore();
}

function drawDatabaseCoin(x, y) {
  const shimmer = Math.floor(Date.now() / 180) % 4;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x, y);

  ctx.fillStyle = "#5b3515";
  ctx.fillRect(13, 0, 14, 2);
  ctx.fillRect(8, 2, 24, 3);
  ctx.fillRect(4, 5, 32, 4);
  ctx.fillRect(2, 9, 36, 22);
  ctx.fillRect(4, 31, 32, 4);
  ctx.fillRect(8, 35, 24, 3);
  ctx.fillRect(13, 38, 14, 2);

  ctx.fillStyle = "#b86b12";
  ctx.fillRect(9, 5, 22, 3);
  ctx.fillRect(6, 8, 28, 4);
  ctx.fillRect(5, 12, 30, 17);
  ctx.fillRect(9, 29, 22, 4);
  ctx.fillStyle = "#f2b72f";
  ctx.fillRect(9, 9, 22, 21);
  ctx.fillRect(12, 7, 16, 3);
  ctx.fillRect(12, 30, 16, 3);

  ctx.fillStyle = "#ffe477";
  ctx.fillRect(11 + shimmer * 2, 10, 6, 3);
  ctx.fillRect(8 + shimmer, 13, 3, 8);
  ctx.fillStyle = "#d98a18";
  ctx.fillRect(28, 12, 3, 16);
  ctx.fillRect(12, 28, 16, 3);

  ctx.fillStyle = "#8b4b0e";
  ctx.fillRect(14, 13, 3, 14);
  ctx.fillRect(17, 12, 10, 3);
  ctx.fillRect(17, 25, 10, 3);
  ctx.fillRect(27, 15, 3, 4);
  ctx.fillRect(27, 21, 3, 4);

  ctx.fillStyle = "#fff0a1";
  ctx.fillRect(11, 25, 3, 3);
  ctx.fillRect(14, 28, 3, 3);
  ctx.restore();
}

function drawHolyGrail(x, y) {
  const now = Math.floor(Date.now() / 120);
  const shimmer = now % 3;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x, y);

  ctx.fillStyle = "#603b16";
  ctx.fillRect(6, 7, 28, 4);
  ctx.fillRect(8, 11, 24, 4);
  ctx.fillRect(10, 15, 20, 4);
  ctx.fillRect(12, 19, 16, 4);
  ctx.fillRect(15, 23, 10, 4);
  ctx.fillRect(17, 27, 7, 8);
  ctx.fillRect(11, 35, 22, 4);
  ctx.fillRect(3, 10, 4, 10);
  ctx.fillRect(31, 10, 4, 10);

  ctx.fillStyle = "#d68a18";
  ctx.fillRect(8, 9, 24, 3);
  ctx.fillRect(10, 12, 20, 3);
  ctx.fillRect(12, 16, 16, 3);
  ctx.fillRect(14, 20, 12, 3);
  ctx.fillRect(17, 24, 7, 11);
  ctx.fillRect(14, 34, 16, 3);
  ctx.fillRect(9, 37, 22, 2);

  ctx.fillStyle = "#f5c83e";
  ctx.fillRect(11, 12, 18, 3);
  ctx.fillRect(13, 15, 14, 3);
  ctx.fillRect(15, 18, 10, 3);
  ctx.fillRect(17, 21, 6, 3);
  ctx.fillRect(20, 25, 3, 9);
  ctx.fillRect(16, 35, 11, 2);

  ctx.fillStyle = "#fff09a";
  ctx.fillRect(13 + shimmer, 12, 4, 3);
  ctx.fillRect(16, 15, 3, 5);

  ctx.fillStyle = "#b6222d";
  ctx.fillRect(11, 14, 4, 4);
  ctx.fillRect(25, 18, 4, 4);
  ctx.fillStyle = "#43b85c";
  ctx.fillRect(25, 13, 4, 4);
  ctx.fillRect(12, 19, 4, 4);

  ctx.fillStyle = "#f0713c";
  ctx.fillRect(12, 14, 2, 2);
  ctx.fillStyle = "#8be878";
  ctx.fillRect(26, 13, 2, 2);

  const sparkles = [
    { x: 5, y: 4, phase: 0 },
    { x: 34, y: 6, phase: 4 },
    { x: 8, y: 27, phase: 8 },
    { x: 32, y: 28, phase: 2 },
  ];
  for (const sparkle of sparkles) {
    const sparkleFrame = (now + sparkle.phase) % 12;
    if (sparkleFrame < 8) {
      ctx.globalAlpha = 1 - Math.abs(sparkleFrame - 3.5) / 5;
      ctx.fillStyle = "#fff6b0";
      ctx.fillRect(sparkle.x - 1, sparkle.y - 5, 2, 11);
      ctx.fillRect(sparkle.x - 5, sparkle.y - 1, 10, 2);
      ctx.fillRect(sparkle.x - 2, sparkle.y - 2, 4, 4);
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function toggleGrid() {
  shouldDrawGrid = true;
}

function makeGrid() {
  // vertical grid lines
  for (let i = 100; i < canvas.width; i += 100) {
    if (!gridMade) {
      createFakePlatform(i - 1, 35, 1, canvas.height);
    }
    // add text indicating x value at top of game
    ctx.font = "125% serif";
    ctx.fillStyle = "black";
    ctx.fillText(
      i, // text
      i - 15, // x location
      25, // y location
    );
  }

  // horizontal grid lines
  for (let i = 100; i < canvas.height; i += 100) {
    if (!gridMade) {
      createFakePlatform(45, i - 1, canvas.width, 1);
    }
    // add text indicating y value at left side of game
    ctx.font = "125% serif";
    ctx.fillText(
      i, // text
      10, // x location
      i + 5, // y location
    );
  }
  gridMade = true;
}

function drawProjectiles() {
  for (var i = 0; i < projectiles.length; i++) {
    drawPixelArrow(projectiles[i]);
    projectiles[i].x = projectiles[i].x + projectiles[i].speedX;
    projectiles[i].y = projectiles[i].y + projectiles[i].speedY;
  }
}

function drawPixelArrow(projectile) {
  const angle = Math.atan2(projectile.speedY, projectile.speedX);
  const centerX = projectile.x + projectile.width / 2;
  const centerY = projectile.y + projectile.height / 2;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(centerX, centerY);
  ctx.rotate(angle);

  ctx.fillStyle = "#241b17";
  ctx.fillRect(-12, -3, 14, 6);
  ctx.fillRect(2, -5, 4, 10);
  ctx.fillRect(6, -2, 4, 4);
  ctx.fillStyle = "#b98648";
  ctx.fillRect(-10, -1, 13, 3);
  ctx.fillRect(3, -3, 3, 6);
  ctx.fillStyle = "#e1bd70";
  ctx.fillRect(5, -2, 3, 4);
  ctx.fillStyle = "#704522";
  ctx.fillRect(-12, -4, 4, 2);
  ctx.fillRect(-12, 2, 4, 2);
  ctx.restore();
}

function drawAncientCannon() {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(-40, 59);
  ctx.rotate(-Math.PI / 2);

  ctx.fillStyle = "#2c211b";
  ctx.fillRect(36, 17, 62, 31);
  ctx.fillRect(95, 12, 17, 41);
  ctx.fillRect(25, 30, 78, 25);
  ctx.fillRect(15, 51, 78, 13);
  ctx.fillRect(5, 60, 20, 12);
  ctx.fillRect(82, 60, 20, 12);

  ctx.fillStyle = "#79502e";
  ctx.fillRect(40, 21, 54, 23);
  ctx.fillRect(94, 17, 14, 31);
  ctx.fillRect(28, 35, 68, 17);
  ctx.fillRect(22, 52, 70, 8);
  ctx.fillRect(11, 61, 12, 8);
  ctx.fillRect(84, 61, 15, 8);

  ctx.fillStyle = "#b98545";
  ctx.fillRect(46, 23, 43, 5);
  ctx.fillRect(35, 37, 54, 4);
  ctx.fillRect(28, 53, 17, 4);
  ctx.fillRect(72, 53, 16, 4);
  ctx.fillRect(98, 21, 8, 5);

  ctx.fillStyle = "#c99b52";
  ctx.fillRect(39, 29, 5, 12);
  ctx.fillRect(91, 20, 5, 27);
  ctx.fillRect(18, 56, 9, 4);
  ctx.fillRect(82, 56, 9, 4);

  ctx.fillStyle = "#4d3022";
  ctx.fillRect(49, 30, 8, 4);
  ctx.fillRect(68, 30, 8, 4);
  ctx.fillRect(56, 45, 22, 4);
  ctx.fillRect(45, 60, 30, 5);

  ctx.fillStyle = "#d4a95d";
  ctx.fillRect(99, 29, 4, 9);
  ctx.fillRect(12, 63, 8, 4);
  ctx.fillRect(87, 63, 9, 4);
  ctx.restore();
}

function drawCannons() {
  for (var i = 0; i < cannons.length; i++) {
    if (cannons[i].projectileCountdown >= cannons[i].timeBetweenShots) {
      cannons[i].projectileCountdown = 0;
      createProjectile(
        cannons[i].location,
        cannons[i].x,
        cannons[i].y,
        cannons[i].projectileWidth,
        cannons[i].projectileHeight,
      );
    } else {
      cannons[i].projectileCountdown = cannons[i].projectileCountdown + 1;
    }

    // move cannon if minX and maxX are set
    if (cannons[i].minX !== null && cannons[i].maxX !== null) {
      cannons[i].x += cannons[i].speedX;
      if (cannons[i].x < cannons[i].minX || cannons[i].x > cannons[i].maxX) {
        cannons[i].speedX *= -1;
      }
    }
    // move cannon if minY and maxY are set
    if (cannons[i].minY !== null && cannons[i].maxY !== null) {
      cannons[i].y += cannons[i].speedY;
      if (cannons[i].y < cannons[i].minY || cannons[i].y > cannons[i].maxY) {
        cannons[i].speedY *= -1;
      }
    }

    ctx.save(); //save the current translation of the screen.
    ctx.translate(cannons[i].x, cannons[i].y); //you are moving the top left of the screen to the pictures location, this is because you can't rotate the image, you have to rotate the whole page
    ctx.rotate((cannons[i].rotation * Math.PI) / 180); //then you rotate. rotation is centered on 0,0 on the canvas, which is why we moved the picture to 0,0 with translate(x,y)
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cannonImage, 0, 0, cannonWidth, cannonHeight);
    //also the previous line uses -width / 2 so that the picture is centered. This will mean that (0,0) is at the exact center of the image
    ctx.translate(-cannons[i].x, -cannons[i].y); //the reverse of the previous translate, this moves the page back to the correct place so that the image is no longer at (0,0)
    ctx.restore(); //this unrotates the canvas so the canvas is straight, but now since you did that the picture looks rotated
  }
}

function drawCollectables() {
  for (var i = 0; i < collectables.length; i++) {
    if (collectables[i].collected !== true) {
      //draw on screen if not collected
      if (collectables[i].type === "database") {
        drawDatabaseCoin(collectables[i].x, collectables[i].y);
      } else if (collectables[i].type === "diamond") {
        drawHolyGrail(collectables[i].x, collectables[i].y);
      } else {
        ctx.drawImage(
          collectables[i].image,
          collectables[i].x,
          collectables[i].y,
          collectableWidth,
          collectableHeight,
        );
      }
    } else {
      //draw the icons at the top if collected
      if (collectables[i].alpha > 0.4) {
        collectables[i].alpha = collectables[i].alpha - 0.007;
      }
      ctx.globalAlpha = collectables[i].alpha;
      if (collectables[i].type === "database") {
        drawDatabaseCoin(200 + 100 * i, 10);
      } else if (collectables[i].type === "diamond") {
        drawHolyGrail(200 + 100 * i, 10);
      } else {
        ctx.drawImage(
          collectables[i].image,
          200 + 100 * i,
          10,
          collectableWidth,
          collectableHeight,
        );
      }
      ctx.globalAlpha = 1;
    }

    // Horizontal movement logic for collectables
    if (collectables[i].minX !== null && collectables[i].maxX !== null) {
      // Move collectable based on speed and direction
      collectables[i].x += collectables[i].speed * collectables[i].direction;

      // Reverse direction if collectable reaches minX or maxX bounds
      if (collectables[i].x < collectables[i].minX) {
        collectables[i].x = collectables[i].minX;
        collectables[i].direction *= -1; // Change direction to right
      } else if (collectables[i].x > collectables[i].maxX) {
        collectables[i].x = collectables[i].maxX;
        collectables[i].direction *= -1; // Change direction to left
      }
    }

    //gravity
    collectables[i].speedY = collectables[i].speedY + collectables[i].gravity;
    collectables[i].y = collectables[i].y + collectables[i].speedY;

    const poisonLake = badPlatforms.find(
      (badPlatform) => badPlatform.isPoisonLake,
    );
    const previousBottom =
      collectables[i].y + collectableHeight - collectables[i].speedY;
    const previousTop = collectables[i].y - collectables[i].speedY;
    const currentBottom = collectables[i].y + collectableHeight;
    const enteredLake =
      poisonLake &&
      previousBottom < poisonLake.y &&
      currentBottom >= poisonLake.y;
    const exitedLake =
      poisonLake &&
      collectables[i].speedY < 0 &&
      previousTop > poisonLake.y &&
      collectables[i].y <= poisonLake.y;
    if (
      collectables[i].type === "database" &&
      collectables[i].collected !== true &&
      poisonLake &&
      (enteredLake || exitedLake)
    ) {
      poisonSplashes.push({
        x: collectables[i].x + collectableWidth / 2,
        y: poisonLake.y,
        frame: 0,
      });
    }

    // Check for collision with platforms in order to bounce
    for (var j = 0; j < platforms.length; j++) {
      if (
        collectables[i].x + collectableWidth > platforms[j].x &&
        collectables[i].x < platforms[j].x + platforms[j].width &&
        collectables[i].y < platforms[j].y + platforms[j].height &&
        collectables[i].y + collectableHeight > platforms[j].y
      ) {
        //bottom of collectable is below top of platform
        collectables[i].y = collectables[i].y - collectables[i].speedY;
        collectables[i].speedY *= -collectables[i].bounce;
      }
    }
  }
}

function collectablesCollide() {
  for (var i = 0; i < collectables.length; i++) {
    if (
      collectables[i].x + collectableWidth > player.x &&
      collectables[i].x < player.x + hitBoxWidth &&
      collectables[i].y < player.y + hitBoxHeight &&
      collectables[i].y + collectableHeight > player.y
    ) {
      collectables[i].collected = true;
      checkForWin();
    }
  }
}

function checkForWin() {
  if (collectables.length === 0) {
    return; // If there are no collectables, we can't win
  }
  for (var i = 0; i < collectables.length; i++) {
    if (collectables[i].collected !== true) {
      return; // If any collectable is not collected, we can't win yet
    }
  }
  player.winConditionMet = true; // Set win condition to true
}

function winGame() {
  // If we reach this point, all collectables are collected
  ctx.fillStyle = "grey";
  ctx.fillRect(
    canvas.width / 4,
    canvas.height / 6,
    canvas.width / 2,
    canvas.height / 2,
  );
  ctx.fillStyle = "white";
  ctx.font = "800% serif";
  ctx.fillText(
    "You Win!",
    canvas.width / 4,
    canvas.height / 6 + canvas.height / 5,
    (canvas.width / 16) * 14,
  );
  ctx.font = "500% serif";
  ctx.fillText(
    "Hit any key to restart",
    canvas.width / 4,
    canvas.height / 6 + canvas.height / 3,
    (canvas.width / 16) * 14,
  );
  if (keyPress.any) {
    keyPress.any = false;
    window.location.reload();
  }
}

function createPlatform(
  x,
  y,
  width,
  height,
  color = "grey",
  minX = null,
  maxX = null,
  speedX = 1,
  minY = null,
  maxY = null,
  speedY = 1,
) {
  platforms.push({
    x,
    y,
    width,
    height,
    color,
    minX,
    maxX,
    speedX,
    minY,
    maxY,
    speedY,
    directionX: 1, // 1 for right, -1 for left
    directionY: 1, // 1 for down, -1 for up
  });
}

function createFakePlatform(x, y, width, height, color = "grey") {
  fakePlatforms.push({
    x,
    y,
    width,
    height,
    color,
  });
}

function createBadPlatform(x, y, width, height, color = "red") {
  badPlatforms.push({
    x,
    y,
    width,
    height,
    color,
  });
}

function createCannon(
  wallLocation,
  position,
  timeBetweenShots,
  width = defaultProjectileWidth,
  height = defaultProjectileHeight,
  minPos = null,
  maxPos = null,
  speed = 1,
) {
  if (wallLocation === "top") {
    cannons.push({
      x: position,
      y: cannonHeight,
      rotation: 180,
      projectileCountdown: 0,
      location: wallLocation,
      timeBetweenShots: timeBetweenShots / (1000 / frameRate),
      projectileWidth: width,
      projectileHeight: height,
      minX: minPos,
      maxX: maxPos,
      speedX: speed,
      minY: null,
      maxY: null,
      speedY: 0,
    });
  } else if (wallLocation === "bottom") {
    cannons.push({
      x: position,
      y: canvas.height - cannonHeight,
      rotation: 0,
      projectileCountdown: 0,
      location: wallLocation,
      timeBetweenShots: timeBetweenShots / (1000 / frameRate),
      projectileWidth: width,
      projectileHeight: height,
      minX: minPos,
      maxX: maxPos,
      speedX: speed,
      minY: null,
      maxY: null,
      speedY: 0,
    });
  } else if (wallLocation === "left") {
    cannons.push({
      x: cannonHeight,
      y: position,
      rotation: 90,
      projectileCountdown: 0,
      location: wallLocation,
      timeBetweenShots: timeBetweenShots / (1000 / frameRate),
      projectileWidth: width,
      projectileHeight: height,
      minX: null,
      maxX: null,
      speedX: 0,
      minY: minPos,
      maxY: maxPos,
      speedY: speed,
    });
  } else if (wallLocation === "right") {
    cannons.push({
      x: canvas.width - cannonHeight,
      y: position,
      rotation: 270,
      projectileCountdown: 0,
      location: wallLocation,
      timeBetweenShots: timeBetweenShots / (1000 / frameRate),
      projectileWidth: width,
      projectileHeight: height,
      minX: null,
      maxX: null,
      speedX: 0,
      minY: minPos,
      maxY: maxPos,
      speedY: speed,
    });
  }
}

function createCollectable(
  type,
  x,
  y,
  gravity = 0,
  bounce = 1,
  minX = null,
  maxX = null,
  speed = 1,
) {
  if (type !== "") {
    var image = document.createElement("img");
    image.src = collectableList[type].image;
    image.id = "image" + collectables.length;
    collectables.push({
      image,
      type,
      x,
      y,
      speedY: 0,
      collected: false,
      alpha: 2,
      gravity,
      bounce,
      minX,
      maxX,
      speed,
      direction: 1, // 1 for right, -1 for left
    });
  }
}

function createProjectile(wallLocation, x, y, width, height) {
  //checking if the player is dead
  if (currentAnimationType === animationTypes.frontDeath) {
    return;
  }

  if (wallLocation === "top") {
    projectiles.push({
      x: x - 71.5,
      y: y - 55 - height / 2,
      speedX: 0,
      speedY: projectileSpeed,
      width,
      height,
    });
  } else if (wallLocation === "bottom") {
    projectiles.push({
      x: x + 47,
      y: y + 50 + height / 2,
      speedX: 0,
      speedY: -projectileSpeed,
      width,
      height,
    });
  } else if (wallLocation === "left") {
    projectiles.push({
      x: x - 80 - width / 2,
      y: y + 46,
      speedX: projectileSpeed,
      speedY: 0,
      width,
      height,
    });
  } else if (wallLocation === "right") {
    projectiles.push({
      x: x + 40 + width / 2,
      y: y - 71.5,
      speedX: -projectileSpeed,
      speedY: 0,
      width,
      height,
    });
  }

  // putting this here instead of in every if
  projectiles[projectiles.length - 1].x -= (width - defaultProjectileWidth) / 2;
  projectiles[projectiles.length - 1].y -=
    (height - defaultProjectileHeight) / 2;
}

function keyboardControlActions() {
  keyPress.any = false; //keyboardHandler will set this to true if you press any key. Setting the variable to false here makes sure that key press dosen't stick around.
  //this is used for respawning; if you hit any key after you die this variable will be set to true and you will respawn.

  if (currentAnimationType === animationTypes.frontDeath) {
    return;
  }

  if (keyPress.left) {
    player.speedX -= walkAcceleration;
    player.facingRight = false;
  }
  if (keyPress.right) {
    player.speedX += walkAcceleration;
    player.facingRight = true;
  }
  if (keyPress.space || keyPress.up) {
    if (tryLedgeGrab()) {
      return;
    }
    if (player.onGround) {
      //this only lets you jump if you are on the ground
      player.speedY = player.speedY - playerJumpStrength;
      jumpTimer = 19; //this counts how many frames to have the jump last.
      player.onGround = false; //bug fix for jump animation, you have to change this or the jump animation doesn't work
      frameIndex = 4;
    }
  }
}

function handleKeyDown(e) {
  keyPress.any = true;
  if (e.key === "ArrowUp" || e.key === "w") {
    keyPress.up = true;
  }
  if (e.key === "ArrowLeft" || e.key === "a") {
    keyPress.left = true;
  }
  if (e.key === "ArrowDown" || e.key === "s") {
    if (!keyPress.down) {
      keyPress.downPressed = true;
    }
    keyPress.down = true;
  }
  if (e.key === "ArrowRight" || e.key === "d") {
    keyPress.right = true;
  }
  if (e.key === " ") {
    keyPress.space = true;
  }
}

function handleKeyUp(e) {
  if (e.key === "ArrowUp" || e.key === "w") {
    keyPress.up = false;
  }
  if (e.key === "ArrowLeft" || e.key === "a") {
    keyPress.left = false;
  }
  if (e.key === "ArrowDown" || e.key === "s") {
    keyPress.down = false;
    if (currentAnimationType === animationTypes.duck) {
      duckTimer = 8;
      frameIndex = 20;
    }
  }
  if (e.key === "ArrowRight" || e.key === "d") {
    keyPress.right = false;
  }
  if (e.key === " ") {
    keyPress.space = false;
  }
}

function loadJson() {
  getJSON("halle.json", JsonFunction); //runs this before the setup because of timing things
}
