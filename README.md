# buddy-bot

This Discord bot facilitates a buddy pairing system, allowing users to be paired up with buddies for calls and handling various administrative tasks within the buddy system.

## Setup & Installation:

### Local Setup:

**Set up a discord bot first! See below how!**

1. **Clone the Repository**:

   ```bash
   git clone https://github.com/Giveth/buddy-bot.git
   cd buddy-bot
   ```

2. **Install Dependencies**:

   ```bash
   npm install
   ```

3. **Environment Variables**:
   Copy `.env.template` to `.env` set all the needed values

4. **Run the Bot with hot reloading**:
   ```bash
   npm run dev
   ```

### Discord Developer Portal Setup:

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click on the "New Application" button and give it a name.
3. Navigate to the "Bot" tab on the left and click "Add Bot".
4. Under the "TOKEN" section, click "Copy" to get your bot token. This is what you'll set as `DISCORD_TOKEN` in your `.env` file.
5. Under the "OAuth2" tab, under "OAuth2 URL Generator", select the following scopes: `bot`.
6. Under "Bot Permissions", select:

   - `Send Messages`
   - `Read Message History`
   - `View Channels`
   - `Manage Roles` (for role-based actions, use with caution)
   - `Attach Files` (for audio transcription)

7. Using the generated URL under "OAuth2 URL Generator", invite the bot to your server.

## Admin commands:

**Updating the Contributors Sheet**:
  1. Admin users can type `!fillSheet` to update the contributors sheet with all people who possess the "Contributor" role.
  2. `!pairUp` (ADMIN only) - Automate the creation of "buddy pairings" from a list of names and User IDs.

*Pairing Contributors:*
  ~~Admin users can type `!pairContributors` in any channel to initiate the **pairing process**.~~
  Pairings are done **manually** for now.

**Start the buddy review process**:
- `!dmBuddy @Username` (ADMIN only) - Start the buddy feedback process for a **pair of user (contributor) and buddy**:
  1. The contributor and buddy get a DM that its time for their buddy feedback call and the contributor is asked for the date and time. The state is set to `awaitingDate`.
  1. Once the date and time are submitted to the buddy-bot via DM (by the contributor) the state is set to `date set` and the date is recorded in the google sheet.
  1. A message is posted to the `ANNOUNCEMENT_CHANNEL` that a buddy call is about to happen and is asking the community for feedback.

**After the buddy call**:
- `!checkCalls` (ADMIN only) - Checks the backend sheet for Buddy calls that **happened at leaste 1 hour ago** with a **Status of "date set"**. For all pairs it can find this condition to be true, it will DM them and ask: **"Did the buddy call happen?"**. If the answer is yes, we change **Status to "paired no date", delete the Buddycalldate and save the current date in "Lastcall" (please note that this function *can* be triggered manually, but there is also a cron job calling this function every hour 

**Feedback form helpers**:
- `!selfReview` (ADMIN only) - Check the backend sheet for buddy pairs with the state `date set` and send the "self review form" to them.
- `!DMselfReview @Username1 @Username2` (ADMIN only) - Buddy Bot sends a DM to @Username1&2 and invites them to fill out the "Self Review form"
- `!adminFeedback @Contributor @Username1 @Username2` (ADMIN only) - Buddy Bot sends a DM to @Username1&2 and invites them to fill out the "feedback form" **for** the **@Contributor**
- `!leaderFeedback @Leader @Username1 @Username2` (ADMIN only) - Buddy Bot sends a DM to @Username1&2 and invites them to fill out the "leader feedback form" **for** the **@Leader**

**Contributor commands**
- `!getFeedback @Username1 @Username2` - Buddy Bot sends a DM to @Username1&2 and invites them to fill out the "feedback form"

**CRON jobs**
- **once a day**, buddy-bot will check the *Buddycalldate*-column for **calls scheduled for the following day**. If it discovers a call to be scheduled it will **send** the relevant *Doclink* to the respective buddy. A message is sent to *ANNOUNCEMENT_CHANNEL* detailing the buddy pair that got notified.
- **every hour** buddy-bot will run the checkCalls() function to see if a buddy call took place within the last hour and then closing this buddy call round for the pair.

### WIP

- `!checkDates` (ADMIN only) - Check for calls that occurred over 10 weeks ago
- `!checkCalls` (ADMIN only) - Check if any calls happened recently and if yes ask for the notes
  ~~- `!askForNotes` - Send a DM asking for the buddy-call notes~~

## The Pairing process

~~- A cron job is packaged with the bot that will run `!pairContributors` automatically every quarter~~

- Once the process has been started the _announcement channel_ will announce the pairings for this round and send a DM to every participant, requesting a date and time for their feedback call.
- It is easier to send requests for Feedback and Self-Review now
- Another cron job will check the sheet every ten minutes for buddy calls that already happened
- One hour after a call, the contributors will get a DM asking them for their buddy feedback call **notes**
- The notes get sent to the relevant person in HR

## Docker Deployment:

1. Build the Docker image:

   ```bash
   docker build -t your_bot_name .
   ```

2. Run the bot inside a Docker container:
   ```bash
   docker run -d --name your-bot-name --restart always your_image_name
   ```

## Permissions:

Ensure the bot has permission to read roles, send messages, read messages, and access message attachments. If using role-based actions like updating roles or checking member roles, ensure that the bot's role is higher in the server's role hierarchy than the roles it's managing.
