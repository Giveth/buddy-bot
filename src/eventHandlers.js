const {
  bot,
  doc,
  userStates,
  MAIN_SHEET_NAME,
  PAIRINGS_SHEET_NAME,
  ANNOUNCEMENT_CHANNEL_ID,
  ADMIN_IDS,
  FEEDBACK_FORM,
  PREFIX,
} = require("./configurations");
const {
  updateContributorsSheet,
  pairContributors,
  fetchAndSavePairings,
  processDate,
  checkCalls,
  checkLastCallDate,
  sendNotes,
  promptSelfReview,
  fetchAndSavePairingsWithoutDate,
  dmBuddies,
  saveBuddyCallDate,
  isUserAwaitingDate,
  announceBuddyCall,
} = require("./sheetsFunctions");
const { notifyAdmins, parseDate, isValidDateWithTime } = require("./utils");

async function handleMessages(message) {
  console.log(`Received message from ${message.author.id}: ${message.content}`);
  try {
    if (
      message.channel.type === "dm" &&
      (ADMIN_IDS.includes(message.author.id) ||
        (await isUserOrBuddy(message.author.id)))
    ) {
      const date = new Date(message.content);
      if (!isNaN(date.getTime()) && isValidDateWithTime(date)) {
        await saveBuddyCallDate(message.author.id, date);
        await announceBuddyCall(bot, message.author.id, date);
        message.reply(`Thank You! Your buddy call has been set for ${date}`);
      } else {
        message.reply(
          "Invalid date format. Please format the date like this: 'MM/dd/yyyy HH:mm'."
        );
      }
    }

    if (
      message.content === "!pairUp" &&
      ADMIN_IDS.includes(message.author.id)
    ) {
      const pairs = await fetchAndSavePairingsWithoutDate();
      const formattedPairs = pairs
        .map((pair) => pair.map((p) => p.name).join(" & "))
        .join(", ");
      message.channel.send(`New pairs: ${formattedPairs}`);
    }

    if (message.content.startsWith("!dmBuddies")) {
      const userId = message.content.split(" ")[1].replace(/<@|>/g, "");
      if (!userId) {
        return message.reply("You must provide a user ID!");
      }
      await dmBuddies(userId);
    }

    if (
      message.content === "!fillSheet" &&
      ADMIN_IDS.includes(message.author.id)
    ) {
      message.channel.send("Contributors sheet is being updated!");
      await updateContributorsSheet();
      message.channel.send("Contributors sheet updated successfully!");
    }

    if (
      message.content === "!selfReview" &&
      ADMIN_IDS.includes(message.author.id)
    ) {
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

    if (message.content.startsWith("!getFeedback")) {
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

    if (
      message.content === "!checkDates" &&
      ADMIN_IDS.includes(message.author.id)
    ) {
      message.channel.send("Looking for due calls...");
      const updatedPairs = await checkLastCallDate();
      if (updatedPairs.length > 0) {
        message.channel.send(`Updated pairs: ${updatedPairs.join(", ")}`);
      } else {
        message.channel.send("No pairs were updated.");
      }
      message.channel.send("Done");
    }

    if (
      message.content === "!checkCalls" &&
      ADMIN_IDS.includes(message.author.id)
    ) {
      message.channel.send("Checking if recent calls happened");
      await checkCalls();
      message.channel.send("Done");
    }

    if (
      message.content === "!askforNotes" &&
      ADMIN_IDS.includes(message.author.id)
    ) {
      message.channel.send("Requesting notes from contributors");
      await sendNotes();
      message.channel.send("Done");
    }
  } catch (error) {
    console.error(`Error in bot 'message' event: ${error.message}`);
    notifyAdmins(
      `Error occurred in bot's message event: ${error.message}`,
      bot,
      ADMIN_IDS
    );
  }
}

module.exports = {
  handleMessages,
};
