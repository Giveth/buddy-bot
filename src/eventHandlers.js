const {
  bot,
  doc,
  userStates,
  MAIN_SHEET_NAME,
  PAIRINGS_SHEET_NAME,
  ANNOUNCEMENT_CHANNEL_ID,
  ADMIN_ID,
  FEEDBACK_FORM,
} = require("./configurations");
const {
  updateContributorsSheet,
  pairContributors,
  processDate,
  checkCalls,
  checkLastCallDate,
  sendNotes,
  promptSelfReview,
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
          "Thanks for the date. Please provide the time for your buddy call as **HH:MM UTC** (e.g. 14:00)."
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
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      const timeMatch = message.content.match(timeRegex);
      if (timeMatch && userStates[message.author.id].date) {
        const dateTime = new Date(userStates[message.author.id].date);
        dateTime.setUTCHours(parseInt(timeMatch[1]));
        dateTime.setUTCMinutes(parseInt(timeMatch[2]));
        processDate(message, dateTime);
      } else {
        message.channel.send(
          "That doesn't seem like a valid time. Please provide the time for your buddy call as **HH:MM UTC** (e.g. 14:00)."
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

    if (message.content === "!selfReview" && message.author.id === ADMIN_ID) {
      message.channel.send("Checking for contributors to self-review...");
      const updatedPairs = await promptSelfReview();
      if (updatedPairs.length > 0) {
        message.channel.send(
          `Prompted for selfReview: ${updatedPairs.join(", ")}`
        );
      } else {
        message.channel.send("No one was prompted.");
      }
      message.channel.send("Done");
    }

    if (message.content.startsWith("/getFeedback")) {
      const taggedUsers = message.mentions.users; // This will give a collection of mentioned users

      if (taggedUsers.size === 0) {
        message.reply(
          "Please mention at least one user to request feedback from."
        );
        return;
      }

      // Send DMs to all tagged users
      taggedUsers.forEach((user) => {
        user
          .send(
            `Hey ${user.username}, ${message.author.username} wants to get feedback from you. Please fill out the feedback form:\n${FEEDBACK_FORM}`
          )
          .catch((error) => {
            console.error(
              `Failed to send DM to user ${user.username}. Error: ${error.message}`
            );
          });
      });

      // Send a confirmation message to the command issuer
      message.channel.send(
        "Feedback requests have been sent to the tagged users!"
      );
    }

    if (message.content === "!checkDates" && message.author.id === ADMIN_ID) {
      message.channel.send("Looking for due calls...");
      const updatedPairs = await checkLastCallDate();
      if (updatedPairs.length > 0) {
        message.channel.send(`Updated pairs: ${updatedPairs.join(", ")}`);
      } else {
        message.channel.send("No pairs were updated.");
      }
      message.channel.send("Done");
    }

    if (message.content === "!checkCalls" && message.author.id === ADMIN_ID) {
      message.channel.send("Checking if recent calls happened");
      await checkCalls();
      message.channel.send("Done");
    }

    if (message.content === "!askforNotes" && message.author.id === ADMIN_ID) {
      message.channel.send("Requesting notes from contributors");
      await sendNotes();
      message.channel.send("Done");
    }
  } catch (error) {
    console.error(`Error in bot 'message' event: ${error.message}`);
    notifyAdmin(`Error occurred in bot's message event: ${error.message}`);
  }
}

module.exports = {
  handleMessages,
};
