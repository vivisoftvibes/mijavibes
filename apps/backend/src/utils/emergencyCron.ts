/**
 * Emergency Escalation Cron Job
 *
 * This file contains the setup for the escalation cron job.
 * In production, this should be configured as:
 * - A cron job running every minute
 * - Or a cloud scheduler (AWS EventBridge, Google Cloud Scheduler)
 * - Or a Kubernetes CronJob
 *
 * Escalation Rules (SPEC-003 EA-003):
 * - Level 0: Primary contacts notified immediately
 * - Level 1 (5 minutes): Secondary contacts notified
 * - Level 2 (10 minutes): Emergency services notified
 *
 * Cron Schedule: * * * * * (every minute)
 */

import axios from 'axios';

const ESCALATION_API_URL = process.env.ESCALATION_API_URL || 'http://localhost:3000/api/emergency/_internal/escalate';
const ESCALATION_API_KEY = process.env.ESCALATION_API_KEY || 'dev-key-change-in-production';

export async function runEscalationCheck(): Promise<void> {
  try {
    const response = await axios.post(
      ESCALATION_API_URL,
      {},
      {
        headers: {
          'x-api-key': ESCALATION_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 second timeout
      }
    );

    if (response.data.escalated > 0) {
      console.log(`Escalated ${response.data.escalated} alerts:`, response.data.details);
    }
  } catch (error) {
    console.error('Escalation check failed:', error);
  }
}

// For development/testing: run once and exit
if (require.main === module) {
  (async () => {
    console.log('Running escalation check...');
    await runEscalationCheck();
    console.log('Escalation check completed');
    process.exit(0);
  })();
}

/**
 * Crontab Configuration:
 *
 * Add to crontab (crontab -e):
 *
 * # Escalation check - runs every minute
 * * * * * * cd /path/to/app && node dist/utils/emergencyCron.js >> /var/log/salud-aldia/escalation.log 2>&1
 *
 * Or use a PM2 cron job:
 *
 * module.exports = {
 *   apps: [{
 *     name: 'salud-aldia-escalation',
 *     script: './dist/utils/emergencyCron.js',
 *     instances: 1,
 *     cron_restart: '* * * * *',
 *     watch: false,
 *     autorestart: false,
 *     max_restarts: 1,
 *   }]
 * };
 */

/**
 * Cloud Scheduler Examples:
 *
 * AWS EventBridge (CloudWatch Events):
 * - Schedule: cron(* * * * ? *)
 * - Target: Lambda function or HTTP endpoint
 *
 * Google Cloud Scheduler:
 * - Schedule: * * * * *
 * - Target: HTTP endpoint
 * - Timezone: UTC
 *
 * Kubernetes CronJob:
 *
 * apiVersion: batch/v1
 * kind: CronJob
 * metadata:
 *   name: escalation-check
 * spec:
 *   schedule: "* * * * *"
 *   jobTemplate:
 *     spec:
 *       template:
 *         spec:
 *           containers:
 *           - name: escalation-check
 *             image: salud-aldia:latest
 *             command: ["node", "dist/utils/emergencyCron.js"]
 *           restartPolicy: OnFailure
 */
