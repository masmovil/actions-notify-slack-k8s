package main

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func Test_isDeploymentCommit(t *testing.T) {
	// Given
	commit := Commit{
		commitMessage: "Deployed mas-billing api-billing version v1.37.1 to sta\n\ndeployments:\n- serviceName: api-billing\n  type: RAMPED\n  versions:\n    from:\n    - name: v1.37.0\n      percent: 100\n      artifact: empty\n    to:\n    - name: v1.37.1\n      percent: 100\n      artifact: empty\n  jira:\n    issues: [MBIL-3468]\n  changelog: |\n    feat(mas-billing|commons): MBIL-3468 Implement a common contextual logger (#41988)",
	}
	expectedCommitMessageDetails := CommitMessageDetails{
		domain:      "mas-billing",
		service:     "api-billing",
		version:     "v1.37.1",
		environment: "sta",
	}
	// When
	ok, actualCommitMessageDetails := isDeploymentCommit(commit)

	// Then
	assert.True(t, ok)
	assert.Equal(t, expectedCommitMessageDetails, actualCommitMessageDetails)
}
