const {
  bot,
  doc,
  userStates,
  MAIN_SHEET_NAME,
  PAIRINGS_SHEET_NAME,
  ANNOUNCEMENT_CHANNEL_ID,
  ADMIN_ID,
} = require("./configurations");
const {
  updateContributorsSheet,
  pairContributors,
  processDate,
  checkCalls,
} = require("./sheetsFunctions");
const { notifyAdmin } = require("./utils");

async function handleMessages(message) {
  console.log(`Received message from ${message.author.id}: ${message.content}`);
  try {
    if (
      message.channel.type === "dm" &&
      userStates[message.author.id] &&
      userStates[message.author.id].state === "awaitingDate"
    ) {
      const date = Date.parse(message.content);
      if (!isNaN(date) && date > Date.now()) {
        userStates[message.author.id].state = "awaitingTime";
        userStates[message.author.id].date = date;
        message.channel.send(
          "Thanks for the date. Please provide the time for your buddy call as HH:MM (e.g. 14:00)."
        );
      } else {
        message.channel.send(
          "That doesn't seem like a valid future date. Please provide the date again or type 'cancel' to stop."
        );
      }
    }

    if (
      message.channel.type === "dm" &&
      userStates[message.author.id] &&
      userStates[message.author.id].state === "awaitingTime"
    ) {
      const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (timePattern.test(message.content)) {
        const dateTime = new Date(userStates[message.author.id].date);
        const [hours, minutes] = message.content.split(":");
        dateTime.setHours(hours, minutes);
        processDate(message, dateTime);
      } else {
        message.channel.send(
          "That doesn't seem like a valid time. Please provide the time in HH:mm format or type 'cancel' to stop."
        );
      }
    }

    if (
      message.content === "!pairContributors" &&
      message.author.id === ADMIN_ID
    ) {
      const pairs = await pairContributors();
      const formattedPairs = pairs
        .map((pair) => pair.map((p) => p.name).join(" & "))
        .join(", ");
      message.channel.send(`New pairs: ${formattedPairs}`);
    }

    if (message.content === "!fillSheet" && message.author.id === ADMIN_ID) {
      message.channel.send("Contributors sheet is being updated!");
      await updateContributorsSheet();
      message.channel.send("Contributors sheet updated successfully!");
    }
  } catch (error) {
    console.error(`Error in bot 'message' event: ${error.message}`);
    notifyAdmin(`Error occurred in bot's message event: ${error.message}`);
  }
}

module.exports = {
  handleMessages,
};
