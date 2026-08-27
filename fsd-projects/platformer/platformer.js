function tryLedgeGrab() {
  if (player.onGround || player.speedY < 0) {
    return false;
  }

  for (const platform of platforms) {
    if (
      platform.y < 0 ||
      platform.y >= canvas.height ||
      platform.width >= canvas.width
    ) {
      continue;
    }

    const reachesLedge =
      player.y < platform.y + platform.height &&
      player.y + hitBoxHeight > platform.y - 32;
    const touchesLeftEdge = Math.abs(player.x + hitBoxWidth - platform.x) <= 10;
    const touchesRightEdge =
      Math.abs(player.x - (platform.x + platform.width)) <= 10;

    if (!reachesLedge || (!touchesLeftEdge && !touchesRightEdge)) {
      continue;
    }

    const targetX = touchesLeftEdge
      ? platform.x + 2
      : platform.x + platform.width - hitBoxWidth - 2;
    const targetY = platform.y - hitBoxHeight - 1;
    player.x = touchesLeftEdge
      ? platform.x - hitBoxWidth + 4
      : platform.x + platform.width - 4;
    player.y = platform.y - hitBoxHeight + 28;
    player.speedX = 0;
    player.speedY = 0;
    player.onGround = false;
    frameIndex = 0;
    window.ledgeGrabState = { targetX, targetY };
    window.ledgeJumpPauseUntil = performance.now() + 80;
    return true;
  }

  return false;
}

function clearPlatformerInput() {
  keyPress.any = false;
  keyPress.downPressed = false;
  keyPress.up = false;
  keyPress.left = false;
  keyPress.down = false;
  keyPress.right = false;
  keyPress.space = false;
}

function drawPlatformerWorldDuringIntro() {
  ctx.save();
  ctx.scale(1.2, 1.2);
  drawPlatforms();
  drawFakePlatforms();
  drawBadPlatforms();
  drawProjectiles();
  drawCannons();
  drawCollectables();
  animate();
  drawRobot();
  drawDodgeCallout();
  for (const badPlatform of badPlatforms) {
    if (badPlatform.isPoisonLake) {
      drawPoisonLake(badPlatform);
    }
  }
  drawPoisonSplashes();
  ctx.restore();
}

function drawPlatformerScreen() {
  if (!platformerScreenStartedAt) {
    platformerScreenStartedAt = performance.now();
  }

  const elapsed = performance.now() - platformerScreenStartedAt;
  const shakeStart = 3000;
  const flashStart = 4000;
  const revealStart = 5200;
  const shake = elapsed >= shakeStart && elapsed < flashStart ? 3 : 0;

  if (!platformerScreenStartedAt || !player.onGround) {
    player.y = 150 - hitBoxHeight;
    player.speedY = 0;
    player.onGround = true;
  }

  if (elapsed >= flashStart) {
    drawPlatformerWorldDuringIntro();
  } else {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.fillStyle = "white";
  ctx.font = "bold 42px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (elapsed < 1700) {
    ctx.fillText("Hallebot.", canvas.width / 2, canvas.height / 2);
  } else if (elapsed < flashStart) {
    ctx.save();
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    ctx.fillText("Wake up.", canvas.width / 2, canvas.height / 2);
    ctx.restore();
  }

  if (elapsed >= flashStart) {
    const flashOpacity =
      elapsed < revealStart
        ? 1
        : Math.max(1 - (elapsed - revealStart) / 1300, 0);
    ctx.fillStyle = `rgba(255, 255, 255, ${flashOpacity})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (elapsed >= revealStart + 1300) {
    platformerScreenState = "playing";
    clearPlatformerInput();
  }
}

$(function () {
  // initialize canvas and context when able to
  canvas = document.getElementById("canvas");
  ctx = canvas.getContext("2d");
  window.addEventListener("load", loadJson);

  function setup() {
    if (firstTimeSetup) {
      halleImage = document.getElementById("player");
      projectileImage = document.getElementById("projectile");
      cannonImage = document.getElementById("cannon");
      $(document).on("keydown", handleKeyDown);
      $(document).on("keyup", handleKeyUp);
      firstTimeSetup = false;
      let passcodeBuffer = "";
      const passcode = "passcode";
      window.cameraFollowEnabled = true;
      $(document).on("keydown.passcode", function (event) {
        if (event.key.length !== 1 || !/[a-z]/i.test(event.key)) {
          return;
        }

        passcodeBuffer = (passcodeBuffer + event.key.toLowerCase()).slice(
          -passcode.length,
        );
        if (passcodeBuffer === passcode) {
          window.cameraFollowEnabled = false;
          canvas.style.transform = "scale(1)";
        }
      });
      //start game
      setInterval(main, 1000 / frameRate);
    }

    // Create walls - do not delete or modify this code
    createPlatform(-50, -50, canvas.width + 100, 50); // top wall
    createPlatform(
      -50,
      canvas.height - 10,
      canvas.width + 100,
      200,
      "rgb(0, 0, 0)",
    ); // bottom wall
    createPlatform(-50, -50, 50, canvas.height + 500); // left wall
    createPlatform(canvas.width, -50, 50, canvas.height + 100); // right wall

    //////////////////////////////////
    // ONLY CHANGE BELOW THIS POINT //
    //////////////////////////////////

    // TODO 1 - Enable the Grid
    //toggleGrid();

    // TODO 2 - Create Platforms
    createPlatform(0, 150, 1300, 20, "black");
    createPlatform(150, 350, 1250, 20, "black");
    createPlatform(0, 550, 250, 20, "black");
    createPlatform(500, 600, 50, 20, "black");
    createPlatform(800, 550, 50, 20, "black");
    createPlatform(1100, 600, 300, 20, "black");
    createBadPlatform(-1000000, 690, 2000000, 1000000, "#54c878");
    badPlatforms[badPlatforms.length - 1].isPoisonLake = true;

    // TODO 3 - Create Collectables

    createCollectable("diamond", 1325, 550, 0.5, 0.7);
    createCollectable("database", 650, 400, 0.5, 1);
    createCollectable("database", 975, 400, 0.5, 1);
    createCollectable("database", 375, 400, 0.5, 1);
    // TODO 4 - Create Cannons

    createCannon("top", 300, 1300);

    createCannon("top", 700, 1300);

    createCannon("top", 1100, 1300);
    createCannon("right", 387.5, 2500);

    //////////////////////////////////
    // ONLY CHANGE ABOVE THIS POINT //
    //////////////////////////////////
  }

  registerSetup(setup);
});
