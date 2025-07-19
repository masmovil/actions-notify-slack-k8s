import * as core from "@actions/core";
import { WebClient } from "@slack/web-api";

// Load environment variables when running locally
if (process.env.NODE_ENV !== 'test') {
  try {
    require('dotenv').config();
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
    'slack-access-token': 'SLACK_ACCESS_TOKEN',
    'commit-url': 'COMMIT_URL',
    'commit-author-username': 'COMMIT_AUTHOR_USERNAME',
    'commit-author-email': 'COMMIT_AUTHOR_EMAIL',
    'commit-message': 'COMMIT_MESSAGE'
  };
  
  const envVar = envMap[name];
  return envVar ? (process.env[envVar] || '') : '';
}

export interface Commit {
  url: string;
  authorUsername: string;
  authorEmail: string;
  commitMessage: string;
}

export interface CommitMessageDetails {
  domain: string;
  service: string;
  version: string;
  environment: string;
}

function getCommitMessageTitle(commit: Commit): string {
  return commit.commitMessage.split("\n")[0];
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

    let message = `:rocket: Deployed ${commitMessage.domain} \`${commitMessage.service}\` version \`${commitMessage.version}\` to <${commit.url}|${commitMessage.environment}>`;
    if (commit.authorUsername !== "") {
      message += ` by _${commit.authorUsername}_`;
    }

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

export function isDeploymentCommit(commit: Commit): {
  ok: boolean;
  commitMessage: CommitMessageDetails;
} {
  // Examples: "Deployed mas-billing api-billing version v1.37.0 to prod"
  //           "Deployed mas-billing api-billing version v1.37.0-RC.2 to sta"
  //           "Deployed mas-billing api-billing version v1.37.0 to STA"
  const pattern =
    /Deployed\s(\w\S+)\s(\w\S+)\sversion\s(v\d+\.\d+\.\d+\S*)\sto\s(prod|sta|dev)/i;
  const matches = getCommitMessageTitle(commit).match(pattern);

  if (!matches || matches.length === 0) {
    return {
      ok: false,
      commitMessage: {
        domain: "",
        service: "",
        version: "",
        environment: "",
      },
    };
  }

  const commitMessage: CommitMessageDetails = {
    domain: matches[1],
    service: matches[2],
    version: matches[3],
    environment: matches[4],
  };

  console.log("matched string:", matches[0]);
  console.log("commitMessageDetails:", commitMessage);

  return { ok: true, commitMessage };
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
