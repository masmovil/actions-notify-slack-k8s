export interface Commit {
    url: string;
    authorUsername: string;
    authorEmail: string;
    commitMessage: string;
}

export interface CommitMessageDetails {
    domain: string;
    type: CommitType;
    service: string;
    version: string;
    environment: string;
}

export enum CommitType {
    VERSION = "version",
    CONFIG = "config",
    MULTIPLE = "multiple",
}

export function getCommitMessageTitle(commit: Commit): string {
    return commit.commitMessage.split("\n")[0];
}

// Single service with version pattern
function matchSingleServiceWithVersion(commitTitle: string): CommitMessageDetails | null {
    const pattern = /^Deploy\s+(\S+)\s+(\S+)\s+version\s+(v?\d+\.\d+\.\d+\S*)\s+to\s+(prod|sta|dev)$/i;
    const match = commitTitle.match(pattern);

    if (match) {
        return {
            domain: match[1],
            type: CommitType.VERSION,
            service: match[2],
            version: match[3],
            environment: match[4].toLowerCase(),
        };
    }
    return null;
}

// Single service config changes pattern
function matchSingleServiceConfig(commitTitle: string): CommitMessageDetails | null {
    const pattern = /^Deploy\s+(\S+)\s+(\S+)\s+config\s+changes\s+to\s+(prod|sta|dev)$/i;
    const match = commitTitle.match(pattern);

    if (match) {
        return {
            domain: match[1],
            type: CommitType.CONFIG,
            service: match[2],
            version: "config",
            environment: match[3].toLowerCase(),
        };
    }
    return null;
}

// Multiple services in same domain pattern
function matchMultipleServices(commitTitle: string): CommitMessageDetails | null {
    const pattern = /^Deploy\s+(\S+)\s+services\s+to\s+(prod|sta|dev)$/i;
    const match = commitTitle.match(pattern);

    if (match) {
        return {
            domain: match[1],
            type: CommitType.MULTIPLE,
            service: "services",
            version: "multiple",
            environment: match[2].toLowerCase(),
        };
    }
    return null;
}

// Multiple services config changes pattern
function matchMultipleServicesConfig(commitTitle: string): CommitMessageDetails | null {
    const pattern = /^Deploy\s+(\S+)\s+services\s+config\s+changes\s+to\s+(prod|sta|dev)$/i;
    const match = commitTitle.match(pattern);

    if (match) {
        return {
            domain: match[1],
            type: CommitType.CONFIG,
            service: "services",
            version: "config",
            environment: match[2].toLowerCase(),
        };
    }
    return null;
}

// Multiple environments pattern
function matchMultipleEnvironments(commitTitle: string): CommitMessageDetails | null {
    const pattern = /^Deploy\s+(\S+)\s+services\s+to\s+((?:sta|prod|dev)(?:\s+and\s+(?:sta|prod|dev))+)$/i;
    const match = commitTitle.match(pattern);

    if (match) {
        const envs = match[2].toLowerCase();
        const firstEnv = envs.split(/\s+and\s+/)[0];
        return {
            domain: match[1],
            type: CommitType.MULTIPLE,
            service: "services",
            version: "multiple-envs",
            environment: firstEnv,
        };
    }
    return null;
}

// Multiple domains pattern
function matchMultipleDomains(commitTitle: string): CommitMessageDetails | null {
    const pattern = /^Deploy\s+multiple\s+services\s+to\s+(prod|sta|dev)$/i;
    const match = commitTitle.match(pattern);

    if (match) {
        return {
            domain: "multiple",
            type: CommitType.MULTIPLE,
            service: "services",
            version: "multiple",
            environment: match[1].toLowerCase(),
        };
    }
    return null;
}

// Multiple domains config changes pattern
function matchMultipleDomainsConfig(commitTitle: string): CommitMessageDetails | null {
    const pattern = /^Deploy\s+config\s+changes\s+to\s+(prod|sta|dev)$/i;
    const match = commitTitle.match(pattern);

    if (match) {
        return {
            domain: "multiple",
            type: CommitType.CONFIG,
            service: "config",
            version: "config",
            environment: match[1].toLowerCase(),
        };
    }
    return null;
}

// Grouped chart deployments pattern
function matchGroupedChart(commitTitle: string): CommitMessageDetails | null {
    const pattern = /^Deploy\s+(\S+)\s+(\S+)\s+version\s+(v?\d+\.\d+\.\d+\S*)\s+to\s+(prod|sta|dev)$/i;
    const match = commitTitle.match(pattern);

    if (match) {
        return {
            domain: match[1],
            type: CommitType.VERSION,
            service: match[2],
            version: match[3],
            environment: match[4].toLowerCase(),
        };
    }
    return null;
}

// Legacy v1 format pattern
function matchLegacyV1Format(commitTitle: string): CommitMessageDetails | null {
    const pattern = /^Deployed\s+(\S+)\s+(\S+)\s+version\s+(v?\d+\.\d+\.\d+\S*)\s+to\s+(prod|sta|dev)$/i;
    const match = commitTitle.match(pattern);

    if (match) {
        return {
            domain: match[1],
            type: CommitType.VERSION,
            service: match[2],
            version: match[3],
            environment: match[4].toLowerCase(),
        };
    }
    return null;
}

// Legacy v2 format pattern
function matchLegacyV2Format(commitTitle: string): CommitMessageDetails | null {
    const pattern = /Deploy\s(\w\S+)\s(\w\S+)\sversion\s(v\d+\.\d+\.\d+\S*)\sto\s(prod|sta|dev)/i;
    const match = commitTitle.match(pattern);

    if (match) {
        return {
            domain: match[1],
            type: CommitType.VERSION,
            service: match[2],
            version: match[3],
            environment: match[4].toLowerCase(),
        };
    }
    return null;
}

// Main orchestrator function
export function isDeploymentCommit(commit: Commit): {
    ok: boolean;
    commitMessage: CommitMessageDetails;
} {
    const commitTitle = getCommitMessageTitle(commit);

    // Array of matcher functions in priority order
    const matchers = [
        matchSingleServiceWithVersion,
        matchSingleServiceConfig,
        matchMultipleServices,
        matchMultipleServicesConfig,
        matchMultipleEnvironments,
        matchMultipleDomains,
        matchMultipleDomainsConfig,
        matchGroupedChart,
        matchLegacyV1Format,
        matchLegacyV2Format,
    ];

    // Try each matcher until one succeeds
    for (const matcher of matchers) {
        const result = matcher(commitTitle);
        if (result) {
            console.log(`Matched pattern: ${matcher.name}`);
            console.log("commitMessageDetails:", result);
            return { ok: true, commitMessage: result };
        }
    }

    // No match found
    return {
        ok: false,
        commitMessage: {
            domain: "",
            type: CommitType.CONFIG,
            service: "",
            version: "",
            environment: "",
        },
    };
}
