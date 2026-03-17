/**
 * Unit tests for the action's main functionality, main.ts
 *
 * These should be run with the npm test command.
 */

import * as core from "@actions/core";
import * as dotenv from "dotenv";
import { WebClient } from "@slack/web-api";
import { isDeploymentCommit, isDeploymentEvent, Commit, PullRequestDeployment } from "./commit-parser";

// Load environment variables from .env file for local testing
dotenv.config();

// Mock the @actions/core module
jest.mock("@actions/core");
const mockCore = core as jest.Mocked<typeof core>;

// Mock the @slack/web-api module
jest.mock("@slack/web-api");
const mockWebClient = WebClient as jest.MockedClass<typeof WebClient>;

// Helper function to create commit test objects
function createCommit(message: string): Commit {
  return {
    eventType: "deployment_completed",
    url: "https://github.com/test/repo/commit/abc123",
    authorUsername: "testuser",
    authorEmail: "test@example.com",
    commitMessage: message,
  };
}

// Helper function to create PR test objects
function createPullRequest(title: string, prNumber = "12345"): PullRequestDeployment {
  return {
    eventType: "deployment_requested",
    prUrl: `https://github.com/test/repo/pull/${prNumber}`,
    prNumber,
    prTitle: title,
    prAuthorUsername: "testuser",
    prBody: "```json\n[\n  {\n    \"domain\": \"test\",\n    \"service\": \"test-service\",\n    \"environment\": \"prod\"\n  }\n]\n```",
  };
}

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
    const commit = createCommit("Deployed mas-billing api-billing version v1.37.0 to prod");

    const result = isDeploymentCommit(commit);

    expect(result.ok).toBe(true);
    expect(result.commitMessage.domain).toBe("mas-billing");
    expect(result.commitMessage.service).toBe("api-billing");
    expect(result.commitMessage.version).toBe("v1.37.0");
    expect(result.commitMessage.environment).toBe("prod");
  });

  it("should not detect non-deployment commit", () => {
    const commit = createCommit("Fix typo in documentation");

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
          environment: "dev",
        },
      },
    ];

    testCases.forEach((testCase) => {
      const commit = createCommit(testCase.message);

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
    const commit = createCommit(`Deploy mas-billing rating-engine version v1.132.5 to prod

- serviceName: rating-engine
  version: v1.132.5
  changelog: |
    task(mas-billing|rating-engine): MBIL-5497 change prices for mayotte and reunion (#71079)`);

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
      const commit = createCommit(testCase.message);

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

  it("should detect single service config changes", () => {
    const commit = createCommit("Deploy mas-billing api-billing config changes to prod");

    const result = isDeploymentCommit(commit);

    expect(result.ok).toBe(true);
    expect(result.commitMessage.domain).toBe("mas-billing");
    expect(result.commitMessage.service).toBe("api-billing");
    expect(result.commitMessage.version).toBe("config");
    expect(result.commitMessage.environment).toBe("prod");
  });

  it("should detect multiple services in same domain", () => {
    const commit = createCommit("Deploy mas-billing services to prod");

    const result = isDeploymentCommit(commit);

    expect(result.ok).toBe(true);
    expect(result.commitMessage.domain).toBe("mas-billing");
    expect(result.commitMessage.service).toBe("services");
    expect(result.commitMessage.version).toBe("multiple");
    expect(result.commitMessage.environment).toBe("prod");
  });

  it("should detect multiple services config changes in same domain", () => {
    const commit = createCommit("Deploy mas-billing services config changes to sta");

    const result = isDeploymentCommit(commit);

    expect(result.ok).toBe(true);
    expect(result.commitMessage.domain).toBe("mas-billing");
    expect(result.commitMessage.service).toBe("services");
    expect(result.commitMessage.version).toBe("config");
    expect(result.commitMessage.environment).toBe("sta");
  });

  it("should detect multiple environments deployment", () => {
    const commit = createCommit("Deploy mas-billing services to sta and prod");

    const result = isDeploymentCommit(commit);

    expect(result.ok).toBe(true);
    expect(result.commitMessage.domain).toBe("mas-billing");
    expect(result.commitMessage.service).toBe("services");
    expect(result.commitMessage.version).toBe("multiple-envs");
    expect(result.commitMessage.environment).toBe("sta"); // First environment mentioned
  });

  it("should detect multiple domains deployment", () => {
    const commit = createCommit("Deploy multiple services to prod");

    const result = isDeploymentCommit(commit);

    expect(result.ok).toBe(true);
    expect(result.commitMessage.domain).toBe("multiple");
    expect(result.commitMessage.service).toBe("services");
    expect(result.commitMessage.version).toBe("multiple");
    expect(result.commitMessage.environment).toBe("prod");
  });

  it("should detect multiple domains config changes", () => {
    const commit = createCommit("Deploy config changes to dev");

    const result = isDeploymentCommit(commit);

    expect(result.ok).toBe(true);
    expect(result.commitMessage.domain).toBe("multiple");
    expect(result.commitMessage.service).toBe("config");
    expect(result.commitMessage.version).toBe("config");
    expect(result.commitMessage.environment).toBe("dev");
  });

  it("should detect grouped chart deployments", () => {
    const commit = createCommit("Deploy mas-billing billing-chart version v2.1.0 to prod");

    const result = isDeploymentCommit(commit);

    expect(result.ok).toBe(true);
    expect(result.commitMessage.domain).toBe("mas-billing");
    expect(result.commitMessage.service).toBe("billing-chart");
    expect(result.commitMessage.version).toBe("v2.1.0");
    expect(result.commitMessage.environment).toBe("prod");
  });

  it("should handle different environment combinations in multiple environments", () => {
    const testCases = [
      {
        message: "Deploy payments services to dev and sta",
        expectedEnv: "dev",
      },
      {
        message: "Deploy billing services to prod and dev",
        expectedEnv: "prod",
      },
    ];

    testCases.forEach((testCase) => {
      const commit = createCommit(testCase.message);

      const result = isDeploymentCommit(commit);

      expect(result.ok).toBe(true);
      expect(result.commitMessage.version).toBe("multiple-envs");
      expect(result.commitMessage.environment).toBe(testCase.expectedEnv);
    });
  });

  describe("PR number handling", () => {
    it("should detect single service deployment with PR number", () => {
      const commit = createCommit("Deploy mas-billing api-billing version v1.37.0 to prod (#12345)");

      const result = isDeploymentCommit(commit);

      expect(result.ok).toBe(true);
      expect(result.commitMessage.domain).toBe("mas-billing");
      expect(result.commitMessage.service).toBe("api-billing");
      expect(result.commitMessage.version).toBe("v1.37.0");
      expect(result.commitMessage.environment).toBe("prod");
    });

    it("should detect single service config changes with PR number", () => {
      const commit = createCommit("Deploy mas-billing api-billing config changes to prod (#54321)");

      const result = isDeploymentCommit(commit);

      expect(result.ok).toBe(true);
      expect(result.commitMessage.domain).toBe("mas-billing");
      expect(result.commitMessage.service).toBe("api-billing");
      expect(result.commitMessage.version).toBe("config");
      expect(result.commitMessage.environment).toBe("prod");
    });

    it("should detect multiple services deployment with PR number", () => {
      const commit = createCommit("Deploy mas-billing services to sta (#33955)");

      const result = isDeploymentCommit(commit);

      expect(result.ok).toBe(true);
      expect(result.commitMessage.domain).toBe("mas-billing");
      expect(result.commitMessage.service).toBe("services");
      expect(result.commitMessage.version).toBe("multiple");
      expect(result.commitMessage.environment).toBe("sta");
    });

    it("should detect multiple services config changes with PR number", () => {
      const commit = createCommit("Deploy mas-billing services config changes to dev (#99999)");

      const result = isDeploymentCommit(commit);

      expect(result.ok).toBe(true);
      expect(result.commitMessage.domain).toBe("mas-billing");
      expect(result.commitMessage.service).toBe("services");
      expect(result.commitMessage.version).toBe("config");
      expect(result.commitMessage.environment).toBe("dev");
    });

    it("should detect multiple environments deployment with PR number", () => {
      const commit = createCommit("Deploy mas-billing services to sta and prod (#11111)");

      const result = isDeploymentCommit(commit);

      expect(result.ok).toBe(true);
      expect(result.commitMessage.domain).toBe("mas-billing");
      expect(result.commitMessage.service).toBe("services");
      expect(result.commitMessage.version).toBe("multiple-envs");
      expect(result.commitMessage.environment).toBe("sta");
    });

    it("should detect multiple domains deployment with PR number", () => {
      const commit = createCommit("Deploy multiple services to prod (#22222)");

      const result = isDeploymentCommit(commit);

      expect(result.ok).toBe(true);
      expect(result.commitMessage.domain).toBe("multiple");
      expect(result.commitMessage.service).toBe("services");
      expect(result.commitMessage.version).toBe("multiple");
      expect(result.commitMessage.environment).toBe("prod");
    });

    it("should detect multiple domains config changes with PR number", () => {
      const commit = createCommit("Deploy config changes to dev (#77777)");

      const result = isDeploymentCommit(commit);

      expect(result.ok).toBe(true);
      expect(result.commitMessage.domain).toBe("multiple");
      expect(result.commitMessage.service).toBe("config");
      expect(result.commitMessage.version).toBe("config");
      expect(result.commitMessage.environment).toBe("dev");
    });

    it("should detect legacy v1 format with PR number", () => {
      const commit = createCommit("Deployed mas-billing api-billing version v1.37.0 to prod (#88888)");

      const result = isDeploymentCommit(commit);

      expect(result.ok).toBe(true);
      expect(result.commitMessage.domain).toBe("mas-billing");
      expect(result.commitMessage.service).toBe("api-billing");
      expect(result.commitMessage.version).toBe("v1.37.0");
      expect(result.commitMessage.environment).toBe("prod");
    });

    it("should detect legacy v2 format with PR number", () => {
      const commit = createCommit("Deploy mas-billing rating-engine version v1.132.5 to prod (#71079)");

      const result = isDeploymentCommit(commit);

      expect(result.ok).toBe(true);
      expect(result.commitMessage.domain).toBe("mas-billing");
      expect(result.commitMessage.service).toBe("rating-engine");
      expect(result.commitMessage.version).toBe("v1.132.5");
      expect(result.commitMessage.environment).toBe("prod");
    });

    // Backward compatibility tests - ensure existing messages without PR numbers still work
    it("should still match messages without PR numbers (backward compatibility)", () => {
      const testCases = [
        "Deploy mas-billing services to prod",
        "Deploy mas-billing api-billing version v1.37.0 to sta",
        "Deploy mas-billing api-billing config changes to dev",
        "Deploy multiple services to prod",
        "Deploy config changes to sta",
        "Deploy mas-billing services to sta and prod",
        "Deployed mas-billing api-billing version v1.37.0 to prod",
      ];

      testCases.forEach((message) => {
        const commit = createCommit(message);

        const result = isDeploymentCommit(commit);

        expect(result.ok).toBe(true);
      });
    });

    // Edge cases
    it("should NOT match PR numbers without parentheses", () => {
      const commit = createCommit("Deploy mas-billing services to sta #33955");

      const result = isDeploymentCommit(commit);

      expect(result.ok).toBe(false);
    });

    it("should NOT match with extra text after PR number", () => {
      const commit = createCommit("Deploy mas-billing services to sta (#33955) with extra text");

      const result = isDeploymentCommit(commit);

      expect(result.ok).toBe(false);
    });

    it("should handle PR numbers with varying digit lengths", () => {
      const testCases = [
        { message: "Deploy mas-billing services to prod (#1)", prNumber: "1" },
        { message: "Deploy mas-billing services to prod (#123)", prNumber: "123" },
        { message: "Deploy mas-billing services to prod (#123456)", prNumber: "123456" },
      ];

      testCases.forEach((testCase) => {
        const commit = createCommit(testCase.message);

        const result = isDeploymentCommit(commit);

        expect(result.ok).toBe(true);
        expect(result.commitMessage.domain).toBe("mas-billing");
      });
    });
  });

  describe("PR deployment request events", () => {
    it("should detect PR deployment request and extract details", () => {
      const pr = createPullRequest("Deploy mas-billing api-billing version v1.37.0 to prod");

      const result = isDeploymentEvent(pr);

      expect(result.ok).toBe(true);
      expect(result.commitMessage.domain).toBe("mas-billing");
      expect(result.commitMessage.service).toBe("api-billing");
      expect(result.commitMessage.version).toBe("v1.37.0");
      expect(result.commitMessage.environment).toBe("prod");
    });

    it("should detect PR with config changes", () => {
      const pr = createPullRequest("Deploy mas-billing api-billing config changes to sta");

      const result = isDeploymentEvent(pr);

      expect(result.ok).toBe(true);
      expect(result.commitMessage.domain).toBe("mas-billing");
      expect(result.commitMessage.service).toBe("api-billing");
      expect(result.commitMessage.version).toBe("config");
      expect(result.commitMessage.environment).toBe("sta");
    });

    it("should detect PR with multiple services deployment", () => {
      const pr = createPullRequest("Deploy mas-billing services to prod");

      const result = isDeploymentEvent(pr);

      expect(result.ok).toBe(true);
      expect(result.commitMessage.domain).toBe("mas-billing");
      expect(result.commitMessage.service).toBe("services");
      expect(result.commitMessage.version).toBe("multiple");
      expect(result.commitMessage.environment).toBe("prod");
    });

    it("should detect PR with PR number in body", () => {
      const pr = createPullRequest("Deploy mas-billing services to prod (#54321)", "54321");

      const result = isDeploymentEvent(pr);

      expect(result.ok).toBe(true);
      expect(result.commitMessage.domain).toBe("mas-billing");
      expect(result.commitMessage.service).toBe("services");
      expect(result.commitMessage.version).toBe("multiple");
      expect(result.commitMessage.environment).toBe("prod");
    });

    it("should not detect non-deployment PR", () => {
      const pr = createPullRequest("Fix typo in documentation");

      const result = isDeploymentEvent(pr);

      expect(result.ok).toBe(false);
    });
  });
});
