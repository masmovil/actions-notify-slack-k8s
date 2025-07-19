/**
 * Unit tests for the action's main functionality, main.ts
 *
 * These should be run with the npm test command.
 */

import * as core from "@actions/core";
import * as dotenv from "dotenv";
import { WebClient } from "@slack/web-api";
import { isDeploymentCommit, buildCommit, Commit } from "./main";

// Load environment variables from .env file for local testing
dotenv.config();

// Mock the @actions/core module
jest.mock("@actions/core");
const mockCore = core as jest.Mocked<typeof core>;

// Mock the @slack/web-api module
jest.mock("@slack/web-api");
const mockWebClient = WebClient as jest.MockedClass<typeof WebClient>;

describe("actions-notify-slack-k8s", () => {
  let mockPostMessage: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock core.getInput to return values from environment variables
    mockCore.getInput.mockImplementation((name: string) => {
      const envMap: { [key: string]: string } = {
        "slack-access-token": process.env.SLACK_ACCESS_TOKEN || "",
        "commit-url": process.env.COMMIT_URL || "",
        "commit-author-username": process.env.COMMIT_AUTHOR_USERNAME || "",
        "commit-author-email": process.env.COMMIT_AUTHOR_EMAIL || "",
        "commit-message": process.env.COMMIT_MESSAGE || "",
      };
      return envMap[name] || "";
    });

    // Mock WebClient methods
    mockPostMessage = jest.fn().mockResolvedValue({
      ok: true,
      channel: "C1234567890",
      ts: "1234567890.123456",
    });

    mockWebClient.mockImplementation(
      () =>
        ({
          chat: {
            postMessage: mockPostMessage,
          },
        }) as any,
    );
  });

  it("should run without errors", () => {
    expect(true).toBe(true);
  });

  it("should detect deployment commit and extract details", () => {
    // Test the deployment commit parsing logic
    const commit: Commit = {
      url: "https://github.com/test/repo/commit/abc123",
      authorUsername: "testuser",
      authorEmail: "test@example.com",
      commitMessage: "Deployed mas-billing api-billing version v1.37.0 to prod",
    };

    const result = isDeploymentCommit(commit);

    expect(result.ok).toBe(true);
    expect(result.commitMessage.domain).toBe("mas-billing");
    expect(result.commitMessage.service).toBe("api-billing");
    expect(result.commitMessage.version).toBe("v1.37.0");
    expect(result.commitMessage.environment).toBe("prod");
  });

  it("should not detect non-deployment commit", () => {
    const commit: Commit = {
      url: "https://github.com/test/repo/commit/abc123",
      authorUsername: "testuser",
      authorEmail: "test@example.com",
      commitMessage: "Fix typo in documentation",
    };

    const result = isDeploymentCommit(commit);

    expect(result.ok).toBe(false);
  });

  it("should parse different deployment environments", () => {
    const testCases = [
      {
        message: "Deployed mas-billing api-billing version v1.37.0 to prod",
        expected: {
          domain: "mas-billing",
          service: "api-billing",
          version: "v1.37.0",
          environment: "prod",
        },
      },
      {
        message: "Deployed mas-billing api-billing version v1.37.0-RC.2 to sta",
        expected: {
          domain: "mas-billing",
          service: "api-billing",
          version: "v1.37.0-RC.2",
          environment: "sta",
        },
      },
      {
        message: "Deployed mas-billing api-billing version v1.37.0 to DEV",
        expected: {
          domain: "mas-billing",
          service: "api-billing",
          version: "v1.37.0",
          environment: "DEV",
        },
      },
    ];

    testCases.forEach((testCase) => {
      const commit: Commit = {
        url: "https://github.com/test/repo/commit/abc123",
        authorUsername: "testuser",
        authorEmail: "test@example.com",
        commitMessage: testCase.message,
      };

      const result = isDeploymentCommit(commit);

      expect(result.ok).toBe(true);
      expect(result.commitMessage.domain).toBe(testCase.expected.domain);
      expect(result.commitMessage.service).toBe(testCase.expected.service);
      expect(result.commitMessage.version).toBe(testCase.expected.version);
      expect(result.commitMessage.environment).toBe(
        testCase.expected.environment,
      );
    });
  });

  it("should detect v2 deployment commit format and extract details", () => {
    const commit: Commit = {
      url: "https://github.com/test/repo/commit/abc123",
      authorUsername: "testuser",
      authorEmail: "test@example.com",
      commitMessage: `Deploy mas-billing rating-engine version v1.132.5 to prod

- serviceName: rating-engine
  version: v1.132.5
  changelog: |
    task(mas-billing|rating-engine): MBIL-5497 change prices for mayotte and reunion (#71079)`,
    };

    const result = isDeploymentCommit(commit);

    expect(result.ok).toBe(true);
    expect(result.commitMessage.domain).toBe("mas-billing");
    expect(result.commitMessage.service).toBe("rating-engine");
    expect(result.commitMessage.version).toBe("v1.132.5");
    expect(result.commitMessage.environment).toBe("prod");
  });

  it("should parse different v2 deployment environments", () => {
    const testCases = [
      {
        message: "Deploy mas-billing rating-engine version v1.132.5 to prod",
        expected: {
          domain: "mas-billing",
          service: "rating-engine",
          version: "v1.132.5",
          environment: "prod",
        },
      },
      {
        message: "Deploy mas-billing api-billing version v2.0.0-RC.1 to sta",
        expected: {
          domain: "mas-billing",
          service: "api-billing",
          version: "v2.0.0-RC.1",
          environment: "sta",
        },
      },
      {
        message: "Deploy mas-billing payment-service version v3.1.0 to dev",
        expected: {
          domain: "mas-billing",
          service: "payment-service",
          version: "v3.1.0",
          environment: "dev",
        },
      },
    ];

    testCases.forEach((testCase) => {
      const commit: Commit = {
        url: "https://github.com/test/repo/commit/abc123",
        authorUsername: "testuser",
        authorEmail: "test@example.com",
        commitMessage: testCase.message,
      };

      const result = isDeploymentCommit(commit);

      expect(result.ok).toBe(true);
      expect(result.commitMessage.domain).toBe(testCase.expected.domain);
      expect(result.commitMessage.service).toBe(testCase.expected.service);
      expect(result.commitMessage.version).toBe(testCase.expected.version);
      expect(result.commitMessage.environment).toBe(
        testCase.expected.environment,
      );
    });
  });
});
