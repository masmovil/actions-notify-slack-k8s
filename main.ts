import * as core from "@actions/core";
import { WebClient } from "@slack/web-api";
import { isDeploymentCommit, CommitType, type Commit, type CommitMessageDetails } from "./commit-parser";

// Load environment variables when running locally
if (process.env.NODE_ENV !== "test") {
  try {
    require("dotenv").config();
  } catch (e) {
    // dotenv not available, continue without it
  }
}

// Helper function to get input with fallback to environment variables
function getInputWithFallback(name: string): string {
  // Try to get from GitHub Actions input first
  const actionInput = core.getInput(name);
  if (actionInput) {
    return actionInput;
  }

  // Fallback to environment variable for local testing
  const envMap: { [key: string]: string } = {
    "slack-access-token": "SLACK_ACCESS_TOKEN",
    "commit-url": "COMMIT_URL",
    "commit-author-username": "COMMIT_AUTHOR_USERNAME",
    "commit-author-email": "COMMIT_AUTHOR_EMAIL",
    "commit-message": "COMMIT_MESSAGE",
  };

  const envVar = envMap[name];
  return envVar ? process.env[envVar] || "" : "";
}

async function main(): Promise<void> {
  try {
    console.log("Running actions-notify-slack-k8s");

    const slackClient = getSlackClient();
    const commit = buildCommit();
    const { ok, commitMessage } = isDeploymentCommit(commit);

    if (!ok) {
      console.log("Commit is not a deployment commit:", commit.commitMessage);
      return;
    }

    // Example: "#deploys-mas-billing-prod"
    const slackChannel = `#deploys-${commitMessage.domain}-${commitMessage.environment}`;

    const message = buildSlackMessage(commit, commitMessage);

    const ts = await sendMessageToChannel(slackClient, slackChannel, message);
    console.log("ts:", ts);

    // Add rest of the commit message if it exists
    const commitLines = commit.commitMessage.split("\n");
    if (commitLines.length > 1) {
      // Remove the commit message header
      const commitBody = commitLines.slice(1).join("\n").trim();

      // Send the rest of the commit message as a response to the original message using the thread ts
      const replyMessage = `\`\`\`${commitBody}\`\`\``;
      await sendMessageAsReply(slackClient, slackChannel, ts, replyMessage);
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

function getSlackClient(): WebClient {
  const accessToken = getInputWithFallback("slack-access-token");
  return new WebClient(accessToken);
}

export function buildCommit(): Commit {
  return {
    url: getInputWithFallback("commit-url"),
    authorUsername: getInputWithFallback("commit-author-username"),
    authorEmail: getInputWithFallback("commit-author-email"),
    commitMessage: getInputWithFallback("commit-message"),
  };
}

function buildSlackMessage(commit: Commit, commitMessage: CommitMessageDetails): string {
  const baseUrl = `<${commit.url}|${commitMessage.environment}>`;
  const author = commit.authorUsername !== "" ? ` by _${commit.authorUsername}_` : "";

  switch (commitMessage.type) {
    case CommitType.VERSION:
      if (commitMessage.domain === "multiple") {
        return `:rocket: Deployed multiple services version \`${commitMessage.version}\` to ${baseUrl}${author}`;
      }
      return `:rocket: Deployed ${commitMessage.domain} \`${commitMessage.service}\` version \`${commitMessage.version}\` to ${baseUrl}${author}`;

    case CommitType.CONFIG:
      if (commitMessage.domain === "multiple" && commitMessage.service === "config") {
        return `:gear: Deployed config changes to ${baseUrl}${author}`;
      }
      if (commitMessage.service === "services") {
        return `:gear: Deployed ${commitMessage.domain} services config changes to ${baseUrl}${author}`;
      }
      return `:gear: Deployed ${commitMessage.domain} \`${commitMessage.service}\` config changes to ${baseUrl}${author}`;

    case CommitType.MULTIPLE:
      if (commitMessage.domain === "multiple") {
        return `:rocket: Deployed multiple services to ${baseUrl}${author}`;
      }
      if (commitMessage.version === "multiple-envs") {
        return `:rocket: Deployed ${commitMessage.domain} services to multiple environments${author}`;
      }
      return `:rocket: Deployed ${commitMessage.domain} services to ${baseUrl}${author}`;

    default:
      // Fallback to original format
      return `:rocket: Deployed ${commitMessage.domain} \`${commitMessage.service}\` version \`${commitMessage.version}\` to ${baseUrl}${author}`;
  }
}

async function sendMessageToChannel(
  client: WebClient,
  slackChannel: string,
  message: string,
): Promise<string> {
  try {
    const result = await client.chat.postMessage({
      channel: slackChannel,
      text: message,
      as_user: true,
    });

    console.log(
      "message sent to channel",
      result.channel,
      "with id",
      result.ts,
    );
    return result.ts || "";
  } catch (error) {
    console.log("got error posting message to slack channel:", error);
    return "";
  }
}

async function sendMessageAsReply(
  client: WebClient,
  slackChannel: string,
  ts: string,
  message: string,
): Promise<void> {
  try {
    const result = await client.chat.postMessage({
      channel: slackChannel,
      text: message,
      as_user: true,
      thread_ts: ts,
    });

    console.log(
      "message reply sent to channel",
      result.channel,
      "with id",
      result.ts,
    );
  } catch (error) {
    console.log("got error posting message reply to slack channel:", error);
  }
}

main();
