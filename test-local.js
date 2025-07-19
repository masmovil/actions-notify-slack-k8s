#!/usr/bin/env node

/**
 * Local testing script that runs the action with environment variables from .env
 * 
 * Usage:
 * 1. Copy .env.example to .env
 * 2. Fill in your actual values in .env
 * 3. Run: npm run test:local
 */

require('dotenv').config();

console.log('🚀 Running actions-notify-slack-k8s locally...');
console.log('');
console.log('Environment variables:');
console.log('SLACK_ACCESS_TOKEN:', process.env.SLACK_ACCESS_TOKEN ? '[SET]' : '[NOT SET]');
console.log('COMMIT_URL:', process.env.COMMIT_URL || '[NOT SET]');
console.log('COMMIT_AUTHOR_USERNAME:', process.env.COMMIT_AUTHOR_USERNAME || '[NOT SET]');
console.log('COMMIT_AUTHOR_EMAIL:', process.env.COMMIT_AUTHOR_EMAIL || '[NOT SET]');
console.log('COMMIT_MESSAGE:', process.env.COMMIT_MESSAGE || '[NOT SET]');
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

if (!process.env.COMMIT_MESSAGE) {
  console.error('❌ Error: COMMIT_MESSAGE not set in .env file');
  process.exit(1);
}

console.log('✅ All required environment variables are set');
console.log('');
console.log('Running action...');
console.log('');

// Set NODE_ENV to avoid loading dotenv again in main.ts
process.env.NODE_ENV = 'local';

// Import and run the compiled JavaScript
require('./main.js');
