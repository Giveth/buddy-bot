require("events").EventEmitter.defaultMaxListeners = 20; // or another number that suits your needs
require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const cron = require("node-cron");

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const MAIN_SHEET_NAME = process.env.MAIN_SHEET_NAME; // The sheet with Names and User IDs
const PAIRINGS_SHEET_NAME = process.env.PAIRINGS_SHEET_NAME; // The sheet where pairings are stored

const ANNOUNCEMENT_CHANNEL_ID = process.env.ANNOUNCEMENT_CHANNEL_ID; // Replace with the actual ID of your channel
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID; // The Discord ID of the bot admin
const ROLE = process.env.ROLE;

const bot = new Client();

const doc = new GoogleSpreadsheet(SPREADSHEET_ID);

const userStates = {}; // State management object

// Use service account creds
doc.useServiceAccountAuth(require("./google-sheets-credentials.json"));

// Shuffle function
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Helper function to notify admin
async function notifyAdmin(errorMessage) {
  try {
    const adminUser = bot.users.cache.get(ADMIN_ID);
    if (adminUser) {
      await adminUser.send(errorMessage);
    } else {
      console.error("Couldn't notify the admin.");
    }
  } catch (err) {
    console.error(`Error while notifying admin: ${err.message}`);
  }
}

async function updateContributorsSheet() {
  try {
    // Load the document and the Contributors sheet
    await doc.loadInfo();
    const mainSheet = doc.sheetsByTitle[MAIN_SHEET_NAME];

    // Clear existing content, preserving headers
    const rows = await mainSheet.getRows();
    for (const row of rows) {
      await row.delete();
    }

    // Fetch members belonging to a specified role
    const guild = bot.guilds.cache.first(); // Assuming the bot is only in one guild; modify if needed
    const unicornRole = guild.roles.cache.find((role) => role.name === ROLE);
    const membersWithRole = guild.members.cache.filter((member) =>
      member.roles.cache.has(unicornRole.id)
    );

    // Define a batch size
    const batchSize = 50; // Modify as needed
    const batches = Math.ceil(membersWithRole.size / batchSize);

    const membersArray = [...membersWithRole.values()]; // Convert iterator to array

    for (let i = 0; i < batches; i++) {
      const batchMembers = membersArray.slice(
        i * batchSize,
        (i + 1) * batchSize
      );
      const batchRows = batchMembers.map((member) => ({
        Names: member.user.username,
        UserID: member.user.id,
      }));

      await mainSheet.addRows(batchRows);

      // Wait for a second between batches to reduce rate limit risks
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log("Contributors sheet updated successfully!");
  } catch (error) {
    console.error(`Error updating Contributors sheet: ${error.message}`);
    await notifyAdmin(`Error updating Contributors sheet: ${error.message}`);
  }
}

async function pairContributors() {
  try {
    await doc.loadInfo();
    const mainSheet = doc.sheetsByTitle[MAIN_SHEET_NAME];
    const pairingSheet = doc.sheetsByTitle[PAIRINGS_SHEET_NAME];

    const rows = await mainSheet.getRows();

    const contributors = rows.map((row) => ({
      name: row.Names,
      id: row.UserID,
    }));
    const shuffledContributors = shuffle([...contributors]);

    const pairs = [];
    for (let i = 0; i < shuffledContributors.length; i += 2) {
      const pair = shuffledContributors.slice(i, i + 2);
      pairs.push(pair);

      // Send DM to the contributors
      for (const member of pair) {
        const user = bot.users.cache.get(member.id); // Use the User ID to fetch the user
        if (user) {
          userStates[user.id] = {
            state: "awaitingDate",
            buddy: pair.find((p) => p.id !== member.id).name,
          }; // Set the status of the buddy pair to awaiting a date
          user
            .send(
              `Hey, your buddy has been chosen - it is: ${
                pair.find((p) => p.id !== member.id).name
              }. Please DM me with the date you set for your buddy call.`
            )
            .catch((error) => {
              // If there's an error sending the DM, notify the admin
              const adminUser = bot.users.cache.get(ADMIN_ID);
              if (adminUser) {
                adminUser.send(
                  `Failed to send DM to user with ID: ${member.id}. Please notify them manually.`
                );
              } else {
                console.error("Couldn't notify the admin.");
              }
            });
        } else {
          console.error(`Couldn't find user with ID: ${member.id}`);
        }
      }
    }

    // Save the pairs back to the Pairings sheet with the current date
    for (const pair of pairs) {
      await pairingSheet.addRow({
        Pair: pair.map((p) => p.name).join(" & "),
        Date: new Date().toISOString().split("T")[0],
        ID1: pair[0].id,
        ID2: pair[1] ? pair[1].id : "", // Handle odd numbers of contributors
        State: "paired no date", // New column
        Buddycalldate: "", // New column
      });
    }
    return pairs;
  } catch (error) {
    console.error(`Error in pairContributors function: ${error.message}`);
    await notifyAdmin(
      `Error occurred while pairing contributors: ${error.message}`
    );
  }
}

// New function to handle the date logic
async function processDate(message, date) {
  try {
    // Store the date in Google Sheet (or other storage)
    const pairingSheet = doc.sheetsByTitle[PAIRINGS_SHEET_NAME];
    const rows = await pairingSheet.getRows();
    const userRow = rows.find(
      (row) => row.ID1 === message.author.id || row.ID2 === message.author.id
    );

    if (userRow) {
      userRow.Buddycalldate = new Date(date).toISOString().split("T")[0];
      userRow.State = "date set";
      await userRow.save(); // Save the changes to the sheet
    }

    message.channel.send(
      `Thanks! Your buddy call has been set for ${new Date(
        date
      ).toDateString()}.`
    );

    const announcementChannel = bot.channels.cache.get(ANNOUNCEMENT_CHANNEL_ID);
    const buddyName = userStates[message.author.id].buddy;
    if (announcementChannel) {
      announcementChannel.send(
        `A buddy call has been set for ${message.author.username} and ${buddyName} - please give them some feedback!`
      );
    } else {
      console.error(
        `Couldn't find the announcement channel with ID: ${ANNOUNCEMENT_CHANNEL_ID}`
      );
    }

    delete userStates[message.author.id]; // Reset their state
  } catch (error) {
    console.error(`Error in processDate function: ${error.message}`);
    await notifyAdmin(
      `Error occurred while processing the date: ${error.message}`
    );
  }
}

async function checkCalls() {
  try {
    await doc.loadInfo();
    const pairingSheet = doc.sheetsByTitle[PAIRINGS_SHEET_NAME];
    const rows = await pairingSheet.getRows();

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    for (const row of rows) {
      const callDateTime = new Date(row.Buddycalldate);
      if (row.State === "date set" && callDateTime <= oneHourAgo) {
        // Send DM to both members of the pair
        const user1 = bot.users.cache.get(row.ID1);
        const user2 = bot.users.cache.get(row.ID2);

        if (user1)
          user1.send(
            "Did your buddy call with " +
              row.Pair.split(" & ")[1] +
              " take place?"
          );
        if (user2)
          user2.send(
            "Did your buddy call with " +
              row.Pair.split(" & ")[0] +
              " take place?"
          );

        row.State = "awaiting confirmation";
        await row.save();
      }
    }
  } catch (error) {
    console.error(`Error in checkCalls function: ${error.message}`);
    await notifyAdmin(`Error occurred while checking calls: ${error.message}`);
  }
}

// Schedule the pairing function to run on the first day of every 3rd month (i.e., every quarter)
cron.schedule("0 0 1 */3 *", pairContributors);

// Schedule the checkCalls function to run every hour
cron.schedule("0 * * * *", checkCalls);

bot.on("message", async (message) => {
  console.log(`Received message from ${message.author.id}: ${message.content}`);
  try {
    if (
      message.channel.type === "dm" &&
      userStates[message.author.id] &&
      userStates[message.author.id].state === "awaitingDate"
    ) {
      const date = Date.parse(message.content);
      if (!isNaN(date) && date > Date.now()) {
        // Check if date is in the future
        userStates[message.author.id].state = "awaitingTime"; // Change state to await time
        userStates[message.author.id].date = date; // Store the date temporarily
        message.channel.send(
          "Thanks for the date. Please provide the time for your buddy call as HH:MM (e.g. 14:00)."
        );
      } else {
        message.channel.send(
          "That doesn't seem like a valid future date. Please provide the date again or type 'cancel' to stop."
        );
      }
    }

    // New section for time
    if (
      message.channel.type === "dm" &&
      userStates[message.author.id] &&
      userStates[message.author.id].state === "awaitingTime"
    ) {
      const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/; // A simple regex to validate HH:mm format
      if (timePattern.test(message.content)) {
        const dateTime = new Date(userStates[message.author.id].date);
        const [hours, minutes] = message.content.split(":");
        dateTime.setHours(hours, minutes);
        await processDate(message, dateTime);
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
    // Check if the message is the !fillSheet command and is sent by the specified admin
    if (message.content === "!fillSheet" && message.author.id === ADMIN_ID) {
      await updateContributorsSheet();
      message.channel.send("Contributors sheet is being updated!");
    }
  } catch (error) {
    console.error(`Error in bot 'message' event: ${error.message}`);
    await notifyAdmin(
      `Error occurred in bot's message event: ${error.message}`
    );
  }
});

bot.login(DISCORD_TOKEN);
