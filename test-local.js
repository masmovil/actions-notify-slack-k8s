#!/usr/bin/env node

/**
 * Local testing script that runs the action with environment variables from .env
 *
 * Supports testing both event types:
 * - Deployment completed (commit event)
 * - Deployment requested (PR review event)
 *
 * Usage:
 * 1. Create a .env file in the project root
 * 2. Add SLACK_ACCESS_TOKEN and either commit or PR parameters
 * 3. Run: npm run test:local
 *
 * Example for commit event:
 *   SLACK_ACCESS_TOKEN=xoxb-your-token
 *   COMMIT_URL=https://github.com/org/repo/commit/abc123
 *   COMMIT_AUTHOR_USERNAME=username
 *   COMMIT_AUTHOR_EMAIL=user@example.com
 *   COMMIT_MESSAGE=Deploy mas-billing api-billing version v1.0.0 to prod
 *
 * Example for PR event:
 *   SLACK_ACCESS_TOKEN=xoxb-your-token
 *   PR_URL=https://github.com/org/repo/pull/123
 *   PR_NUMBER=123
 *   PR_AUTHOR_USERNAME=username
 *   PR_TITLE=Deploy services
 *   PR_BODY=Deploy mas-billing api-billing version v1.0.0 to prod
 */

require('dotenv').config();

console.log('🚀 Running actions-notify-slack-k8s locally...');
console.log('');
console.log('Environment variables:');
console.log('SLACK_ACCESS_TOKEN:', process.env.SLACK_ACCESS_TOKEN ? '[SET]' : '[NOT SET]');
console.log('');
console.log('Commit event parameters:');
console.log('  COMMIT_URL:', process.env.COMMIT_URL || '[NOT SET]');
console.log('  COMMIT_AUTHOR_USERNAME:', process.env.COMMIT_AUTHOR_USERNAME || '[NOT SET]');
console.log('  COMMIT_AUTHOR_EMAIL:', process.env.COMMIT_AUTHOR_EMAIL || '[NOT SET]');
console.log('  COMMIT_MESSAGE:', process.env.COMMIT_MESSAGE || '[NOT SET]');
console.log('');
console.log('PR event parameters:');
console.log('  PR_URL:', process.env.PR_URL || '[NOT SET]');
console.log('  PR_NUMBER:', process.env.PR_NUMBER || '[NOT SET]');
console.log('  PR_AUTHOR_USERNAME:', process.env.PR_AUTHOR_USERNAME || '[NOT SET]');
console.log('  PR_TITLE:', process.env.PR_TITLE || '[NOT SET]');
console.log('  PR_BODY:', process.env.PR_BODY || '[NOT SET]');
console.log('');

// Check if .env file exists and has required values
if (!process.env.SLACK_ACCESS_TOKEN) {
  console.error('❌ Error: SLACK_ACCESS_TOKEN not set in .env file');
  console.log('');
  console.log('Please:');
  console.log('1. Copy .env.example to .env');
  console.log('2. Add your Slack bot token to .env');
  console.log('3. Add other required values to .env');
  process.exit(1);
}

// Check for either commit OR PR parameters
const hasCommitParams = process.env.COMMIT_MESSAGE;
const hasPRParams = process.env.PR_URL && process.env.PR_BODY;

if (!hasCommitParams && !hasPRParams) {
  console.error('❌ Error: Neither commit nor PR parameters are set in .env file');
  console.log('');
  console.log('You must set either:');
  console.log('  A) Commit event parameters (for deployment completed):');
  console.log('     - COMMIT_URL, COMMIT_AUTHOR_USERNAME, COMMIT_AUTHOR_EMAIL, COMMIT_MESSAGE');
  console.log('');
  console.log('  B) PR event parameters (for deployment requested):');
  console.log('     - PR_URL, PR_NUMBER, PR_AUTHOR_USERNAME, PR_TITLE, PR_BODY');
  process.exit(1);
}

// Detect and log which event type is being tested
if (hasPRParams) {
  console.log('✅ Testing PR deployment request event (deployment_requested)');
} else {
  console.log('✅ Testing commit deployment completed event (deployment_completed)');
}

console.log('✅ All required environment variables are set');
console.log('');
console.log('Running action...');
console.log('');

// Set NODE_ENV to avoid loading dotenv again in main.ts
process.env.NODE_ENV = 'local';

// Import and run the compiled JavaScript
require('./main.js');
