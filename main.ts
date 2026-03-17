import * as core from "@actions/core";
import { WebClient } from "@slack/web-api";
import { isDeploymentEvent, CommitType, type DeploymentEvent, type CommitMessageDetails } from "./commit-parser";

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
    "pr-url": "PR_URL",
    "pr-number": "PR_NUMBER",
    "pr-author-username": "PR_AUTHOR_USERNAME",
    "pr-title": "PR_TITLE",
    "pr-body": "PR_BODY",
  };

  const envVar = envMap[name];
  return envVar ? process.env[envVar] || "" : "";
}

async function main(): Promise<void> {
  try {
    console.log("Running actions-notify-slack-k8s");

    const slackClient = getSlackClient();
    const deploymentEvent = buildDeploymentEvent();
    const { ok, commitMessage } = isDeploymentEvent(deploymentEvent);

    if (!ok) {
      const message = deploymentEvent.eventType === "deployment_completed"
        ? deploymentEvent.commitMessage
        : deploymentEvent.prBody;
      console.log("Event is not a deployment:", message);
      return;
    }

    // Example: "#deploys-mas-billing-prod"
    const slackChannel = `#deploys-${commitMessage.domain}-${commitMessage.environment}`;

    const message = buildSlackMessage(deploymentEvent, commitMessage);

    const ts = await sendMessageToChannel(slackClient, slackChannel, message);
    console.log("ts:", ts);

    // Add rest of the message if it exists (detailed info from commit/PR body)
    const detailedMessage = deploymentEvent.eventType === "deployment_completed"
      ? deploymentEvent.commitMessage
      : deploymentEvent.prBody;
    const messageLines = detailedMessage.split("\n");
    if (messageLines.length > 1) {
      // Remove the message header
      const messageBody = messageLines.slice(1).join("\n").trim();

      // Send the rest of the message as a response to the original message using the thread ts
      const replyMessage = `\`\`\`${messageBody}\`\`\``;
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

export function buildDeploymentEvent(): DeploymentEvent {
  const prUrl = getInputWithFallback("pr-url");

  // If pr-url is present, it's a deployment request (PR event)
  if (prUrl) {
    return {
      eventType: "deployment_requested",
      prUrl,
      prNumber: getInputWithFallback("pr-number"),
      prTitle: getInputWithFallback("pr-title"),
      prAuthorUsername: getInputWithFallback("pr-author-username"),
      prBody: getInputWithFallback("pr-body"),
    };
  }

  // Otherwise, it's a deployment completion (commit event)
  return {
    eventType: "deployment_completed",
    url: getInputWithFallback("commit-url"),
    authorUsername: getInputWithFallback("commit-author-username"),
    authorEmail: getInputWithFallback("commit-author-email"),
    commitMessage: getInputWithFallback("commit-message"),
  };
}

function buildSlackMessage(event: DeploymentEvent, commitMessage: CommitMessageDetails): string {
  const isDeploymentCompleted = event.eventType === "deployment_completed";
  const url = isDeploymentCompleted ? event.url : event.prUrl;
  const author = isDeploymentCompleted
    ? (event.authorUsername !== "" ? event.authorUsername : "")
    : event.prAuthorUsername;

  const baseUrl = `<${url}|${commitMessage.environment}>`;
  const authorText = author !== "" ? ` by _${author}_` : "";

  // Action verb and emoji based on event type
  const actionVerb = isDeploymentCompleted ? "Deployed" : "Awaiting approval to deploy";
  const emoji = isDeploymentCompleted ? ":rocket:" : ":hourglass_flowing_sand:";

  switch (commitMessage.type) {
    case CommitType.VERSION:
      if (commitMessage.domain === "multiple") {
        return `${emoji} ${actionVerb} multiple services version \`${commitMessage.version}\` to ${baseUrl}${authorText}`;
      }
      return `${emoji} ${actionVerb} ${commitMessage.domain} \`${commitMessage.service}\` version \`${commitMessage.version}\` to ${baseUrl}${authorText}`;

    case CommitType.CONFIG:
      if (commitMessage.domain === "multiple" && commitMessage.service === "config") {
        return `:gear: ${actionVerb} config changes to ${baseUrl}${authorText}`;
      }
      if (commitMessage.service === "services") {
        return `:gear: ${actionVerb} ${commitMessage.domain} services config changes to ${baseUrl}${authorText}`;
      }
      return `:gear: ${actionVerb} ${commitMessage.domain} \`${commitMessage.service}\` config changes to ${baseUrl}${authorText}`;

    case CommitType.MULTIPLE:
      if (commitMessage.domain === "multiple") {
        return `${emoji} ${actionVerb} multiple services to ${baseUrl}${authorText}`;
      }
      if (commitMessage.version === "multiple-envs") {
        return `${emoji} ${actionVerb} ${commitMessage.domain} services to multiple environments${authorText}`;
      }
      return `${emoji} ${actionVerb} ${commitMessage.domain} services to ${baseUrl}${authorText}`;

    default:
      // Fallback to original format
      return `${emoji} ${actionVerb} ${commitMessage.domain} \`${commitMessage.service}\` version \`${commitMessage.version}\` to ${baseUrl}${authorText}`;
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
