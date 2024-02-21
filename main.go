package main

import (
	"fmt"
	"os"
	"regexp"
	"strings"

	"github.com/slack-go/slack"
)

type Commit struct {
	url            string
	authorUsername string
	authorEmail    string
	commitMessage  string
}

type CommitMessageDetails struct {
	domain      string
	service     string
	version     string
	environment string
}

func (c Commit) getCommitMessageTitle() string {
	return strings.Split(c.commitMessage, "\n")[0]
}

func main() {
	fmt.Println("Running actions-notify-slack-k8s")

	slackClient := getSlackClient()
	commit := buildCommit()
	ok, commitMessage := isDeploymentCommit(commit)
	if !ok {
		fmt.Println("Commit is not a deployment commit")
		return
	}

	// TODO: Delete this after debugging!
	if commitMessage.domain != "mas-billing" {
		return
	}

	// Example: "#deploys-mas-billing-prod"
	slackChannel := "#deploys-" + commitMessage.domain + "-" + commitMessage.environment

	message := fmt.Sprintf("Deployed %s %s version %s to %s", commitMessage.domain, commitMessage.service, commitMessage.version, commitMessage.environment)
	messageId := sendMessageToChannel(slackClient, slackChannel, message)
	fmt.Println("messageId:", messageId)

	// Add rest of the commit message if it exists
	if len(strings.Split(commit.commitMessage, "\n")) > 1 {
		messageResponse := fmt.Sprintf("\n%s", strings.Split(commit.commitMessage, "\n")[1:])
		// Send the rest of the commit message as a response to the original message
		fmt.Println(messageResponse)
	}

	return
}

func getSlackClient() (client *slack.Client) {
	accessToken := os.Getenv("SLACK_ACCESS_TOKEN")
	client = slack.New(accessToken)
	return client
}

func buildCommit() (commit Commit) {
	commit = Commit{
		url:            os.Getenv("COMMIT_URL"),
		authorUsername: os.Getenv("COMMIT_AUTHOR_USERNAME"),
		authorEmail:    os.Getenv("COMMIT_AUTHOR_EMAIL"),
		commitMessage:  os.Getenv("COMMIT_MESSAGE"),
	}
	return
}

func isDeploymentCommit(commit Commit) (ok bool, commitMessage CommitMessageDetails) {
	// Example: "Deployed mas-billing api-billing version v1.37.0 to prod"
	pattern := `Deployed\s(\w\S+)\s(\w\S+)\sversion\s(v\d+\.\d+\.\d+)\sto\s(prod|sta|dev)`
	re := regexp.MustCompile(pattern)

	commitMessageFirstLine := strings.Split(commit.commitMessage, "\n")[0]
	matches := re.FindStringSubmatch(commitMessageFirstLine)
	if len(matches) == 0 {
		ok = false
		return
	}

	commitMessage = CommitMessageDetails{
		domain:      matches[1],
		service:     matches[2],
		version:     matches[3],
		environment: matches[4],
	}
	fmt.Println("matched string:", matches[0])
	fmt.Println("commitMessageDetails:", commitMessage)

	return true, commitMessage
}

func sendMessageToChannel(client *slack.Client, slackChannel, message string) string {
	respChannel, respTimestamp, err := client.PostMessage(slackChannel, slack.MsgOptionText(message, false), slack.MsgOptionAsUser(true))
	if err != nil {
		fmt.Println("got error posting message to slack channel:", err)
		return ""
	}
	fmt.Println("message sent to channel", respChannel, "at", respTimestamp)
	return respChannel
}
