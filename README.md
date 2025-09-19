# Slack Notify kubernetes GitHub Action

This action is used to notify deployments in kubernetes via Slack.

It takes into account different commit message formats to create a more meaningful Slack message.

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

## Development

This project is built with TypeScript and can be tested locally.

### Prerequisites

- Node.js (v20 or later)
- npm

### Setup

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

### Testing

#### Unit Tests
Run the Jest unit tests:
```bash
npm test
```

#### Local Testing
Test the action locally with real environment variables:

1. Copy the environment template:
```bash
cp .env.example .env
```

2. Edit `.env` with your actual values:
   - `SLACK_ACCESS_TOKEN`: Your Slack bot token (starts with `xoxb-`)
   - `COMMIT_URL`: GitHub commit URL
   - `COMMIT_AUTHOR_USERNAME`: GitHub username
   - `COMMIT_AUTHOR_EMAIL`: Author email
   - `COMMIT_MESSAGE`: Commit message (supports multiline)

3. Run the local test:
```bash
npm run test:local
```

This will execute the action using your `.env` values and send an actual Slack message.

### Building for Distribution

Package the action for distribution:
```bash
npm run package
```

This creates a bundled `dist/index.js` file that GitHub Actions will execute.