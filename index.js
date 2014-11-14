var Promise = require("bluebird");
var ClawBot = require("clawbot");
//var controller = require("xboxdrv");
var XboxController = require("xbox-controller");
var five = require("johnny-five");

var keypress = require("keypress");

keypress(process.stdin);

process.stdin.setRawMode(true);
process.stdin.resume();


var timerId = null
var board = new five.Board({
	port: "/dev/tty.ClawBot-DevB"
});

var driveMode = true;
var updatesPerSecond = 60
var bot = null;
var controller = null;

var lastLeftPosition = {x: 0, y: 0}
var lastRightPosition = {x: 0, y: 0}
var leftPosition = { x: 0, y: 0};
var rightPosition = { x: 0, y: 0};

var leftRange = [32768, 0];
var rightRange = [32768, 0];

function processState() {
	if (leftPosition.y !== lastLeftPosition.y) {
		leftPositionValue = five.Fn.map(Math.abs(leftPosition.y), leftRange[0], leftRange[1], 0, 1);

		if (leftPosition.y < 0) {
			leftPositionValue = -1 * leftPositionValue;
		}

		if (driveMode) {
			bot.leftDrive(-1 * leftPositionValue);
		}
		else {
			if (leftPosition.y > .1 * leftRange[1]) {
				bot.raiseArm(-1 * leftPositionValue);
			}
			else if (leftPosition.y < .1 * leftRange[0]) {
				bot.lowerArm(leftPositionValue);
			}
			else {
				bot.stopArm();
			}
		}
	}

	if (rightPosition.y !== lastRightPosition.y) {
		rightPositionValue = five.Fn.map(Math.abs(rightPosition.y), rightRange[0], rightRange[1], 0, 1);

		if (rightPosition.y < 0) {
			rightPositionValue = -1 * rightPositionValue;
		}

		if (driveMode) {
			bot.rightDrive(-1 * rightPositionValue);
		}
		else {
			if (rightPosition.y > .1 * rightRange[1]) {
				bot.closeClaw(rightPositionValue);
			}
			else if (rightPosition.y < .1 * rightRange[0]) {
				bot.openClaw(-1 * rightPositionValue);
			}
			else {
				bot.stopClaw();
			}
		}
	}

	lastLeftPosition.y = leftPosition.y;
	lastLeftPosition.x = leftPosition.x;
	lastRightPosition.x = rightPosition.x;
	lastRightPosition.y = rightPosition.y;
}

function calibrateRange(range, position) {
	pos = Math.abs(position.y);
	console.log("position: ", position);

	if (pos < range[0]) {
		range[0] = pos;
	}

	if (pos > range[1]) {
		range[1] = pos;
	}
}

function processPosition(positionStore, position) {
	positionStore.x = position.x;
	positionStore.y = position.y;
}

function toggleDriveMode() {
	driveMode = !driveMode;
	console.log("driveMode: ", driveMode);
}

function waitForInput() {
	return new Promise(function(resolve) {
		process.stdin.on("keypress", function(ch, key) {
			resolve()
		});
	});
}

function terminate() {
	console.log("shutting down clawbot");
	controller.removeAllListeners();
	bot.stopArm();
	bot.stopClaw();
	bot.leftDrive(0);
	bot.rightDrive(0);

	Promise.delay(500).then(function() {
		process.exit(0);
	});
}

board.on("ready", function() {
	controller = new XboxController();
	controller.on("left:move", calibrateRange.bind(this, leftRange));
	controller.on("right:move", calibrateRange.bind(this, rightRange));

	bot = new ClawBot({board: board});
	console.log("calibrating xbox analog stick range.  Press any key on keyboard when done calibrating");

	waitForInput()
	.then(function() {
		console.log("finished calibrating controller");
		console.log("left range: ", leftRange);
		console.log("right range: ", rightRange);

		controller.removeAllListeners("left:move");
		controller.removeAllListeners("right:move");

		controller.on("left:move", processPosition.bind(this, leftPosition));
		controller.on("right:move", processPosition.bind(this, rightPosition));
		controller.on("rightshoulder:press", toggleDriveMode);

		timerId = setInterval(processState, 1000 / updatesPerSecond)
	})
	.then(waitForInput)
	.then(terminate)
});