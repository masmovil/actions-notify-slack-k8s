# Slack Notify kubernetes GitHub Action

This action is used to notify deployments in kubernetes via Slack

## Inputs

Check `action.yml` for the full list of inputs.

## Example usage

```yaml
uses: actions/actions-notify-slack-k8s@v1
with:
  slack-access-token: ${{ secrets.SLACK_ACCESS_TOKEN }}
  commit-url: ${{ github.event.commit.html_url }}
  commit-author-username: ${{ github.event.commit.author.login }}
  commit-author-email: ${{ github.event.commit.commit.author.email }}
  commit-message: ${{ github.event.commit.commit.message }}
```