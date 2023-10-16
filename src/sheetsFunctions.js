const { shuffle, notifyAdmin } = require("./utils");
const {
  bot,
  doc,
  userStates,
  MAIN_SHEET_NAME,
  PAIRINGS_SHEET_NAME,
  ROLE,
  ADMIN_ID,
} = require("./configurations");

// Use service account creds
doc.useServiceAccountAuth(require("../google-sheets-credentials.json"));

async function updateContributorsSheet() {
  try {
    // Load the document and the Contributors sheet
    await doc.loadInfo();
    const mainSheet = doc.sheetsByTitle[MAIN_SHEET_NAME];

    // Clear existing content, preserving headers
    const rows = await mainSheet.getRows();
    console.log(`Rows: ${rows}`);
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      try {
        console.log(`Deleting row ${row.rowNumber}`);
        await row.delete();
        console.log(`${row.rowNumber} deleted`);
      } catch (error) {
        console.error(`Error deleting row: ${error.message}`);
      }
    }
    console.log("Sheet cleared successfully!");

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
    console.log(`Contributors: ${membersArray}`);

    // Remove duplicates from the members array
    const uniqueMembersArray = Array.from(new Set(membersArray));

    for (let i = 0; i < batches; i++) {
      const batchMembers = uniqueMembersArray.slice(
        i * batchSize,
        (i + 1) * batchSize
      );
      const batchRows = batchMembers.map((member) => ({
        Names: member.user.username,
        UserID: member.user.id,
      }));
      console.log(`Current Batch: ${batchMembers}`);
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
    console.log(`shuffledContributors: ${shuffledContributors.length}`);

    if (shuffledContributors.length % 2 !== 0) {
      console.log("Odd number of contributors.");
      return;
    }

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

module.exports = {
  updateContributorsSheet,
  pairContributors,
  processDate,
  checkCalls,
};
