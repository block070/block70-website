/**
 * Generates block70-n8n-agents-registry.json — run: node scripts/build-registry.mjs
 * @see ../n8n-local-agents-schema.json
 */
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "block70-n8n-agents-registry.json");

const ROOT = "/home/jmiller/n8n_workspace";
const pe = (p) => ({
  path: p,
  requiredOwnership: "jmiller",
  requiredPermissions: "rwx",
});

const TICKERS = pe(`${ROOT}/config/tickers.json`);
const CONFIG = pe(`${ROOT}/config/`);
const WORKFLOWS = pe(`${ROOT}/workflows/`);
const DATA = pe(`${ROOT}/data/`);
const LOGS = pe(`${ROOT}/data/logs/`);
const LOG_ARCHIVE = pe(`${ROOT}/data/logs/archive/`);
const DRY_RUN_LOGS = pe(`${ROOT}/data/logs/dry-run/`);
const DL_SHARED = pe(`${ROOT}/data/logs/dead-letter-shared/`);
const MARKET = pe(`${ROOT}/data/market/`);
const REPORTS = pe(`${ROOT}/data/reports/`);
const HIST = pe(`${ROOT}/data/historical/`);
const MEDIA_ROOT = pe(`${ROOT}/data/media/`);
const MEDIA_VIDEO = pe(`${ROOT}/data/media/video/`);
const MEDIA_AUDIO = pe(`${ROOT}/data/media/audio/`);
const MEDIA_IMAGES = pe(`${ROOT}/data/media/images/`);
const BACKUPS = pe(`${ROOT}/data/backups/`);
const TEMP = pe(`${ROOT}/data/temp/`);

const ROSTER = [
  ["crypto-data-collector", "Crypto Data Collector", "market_data", { market: true, tickers: true }],
  ["stock-data-collector", "Stock Data Collector", "market_data", { market: true, tickers: true, stocksNote: true }],
  ["market-trend-analyzer", "Market Trend Analyzer", "market_data", { market: true, tickers: true, reports: true }],
  ["historical-data-processor", "Historical Data Processor", "market_data", { market: true, tickers: true, hist: true }],
  ["signal-generator", "Signal Generator", "market_data", { market: true, tickers: true, reports: true }],
  ["statistical-modeler", "Statistical Modeler", "market_data", { market: true, tickers: true, reports: true }],
  ["alert-generator", "Alert Generator", "market_data", { market: true, tickers: true }],
  ["exchange-monitor", "Exchange Monitor", "market_data", { market: true, tickers: true }],
  ["portfolio-tracker", "Portfolio Tracker", "market_data", { market: true, tickers: true }],
  ["api-scheduler", "API Scheduler", "market_data", { market: true, tickers: true }],
  ["social-media-writer", "Social Media Writer", "content_media", { media: true, content: true }],
  ["linkedin-post-generator", "LinkedIn Post Generator", "content_media", { media: true, content: true }],
  ["tweet-composer", "Tweet Composer", "content_media", { media: true, content: true }],
  ["youtube-script-writer", "YouTube Script Writer", "content_media", { media: true, content: true, videoMeta: true }],
  ["video-editor", "Video Editor", "content_media", { media: true, video: true, large: true }],
  ["image-generator", "Image Generator", "content_media", { media: true, image: true }],
  ["thumbnail-creator", "Thumbnail Creator", "content_media", { media: true, image: true }],
  ["voiceover-generator", "Voiceover Generator", "content_media", { media: true, audio: true }],
  ["content-planner", "Content Planner", "content_media", { media: true, content: true }],
  ["engagement-analyzer", "Engagement Analyzer", "content_media", { reports: true, content: true }],
  ["workflow-orchestrator", "Workflow Orchestrator", "automation_workflow", { auto: true }],
  ["task-scheduler", "Task Scheduler", "automation_workflow", { auto: true }],
  ["error-logger", "Error Logger", "automation_workflow", { auto: true, logsOnly: true }],
  ["dependency-resolver", "Dependency Resolver", "automation_workflow", { auto: true }],
  ["job-dispatcher", "Job Dispatcher", "automation_workflow", { auto: true }],
  ["monitor-agent-health", "Monitor Agent Health", "automation_workflow", { auto: true }],
  ["file-manager", "File Manager", "automation_workflow", { auto: true }],
  ["backup-manager", "Backup Manager", "automation_workflow", { auto: true, backups: true }],
  ["cloud-sync-manager", "Cloud Sync Manager", "automation_workflow", { auto: true, backups: true }],
  ["resource-optimizer", "Resource Optimizer", "automation_workflow", { auto: true }],
  ["model-trainer", "Model Trainer", "ai_research", { research: true, tickers: true }],
  ["prompt-tester", "Prompt Tester", "ai_research", { research: true }],
  ["text-analyzer", "Text Analyzer", "ai_research", { research: true }],
  ["sentiment-analyzer", "Sentiment Analyzer", "ai_research", { research: true, tickers: true }],
  ["trend-predictor", "Trend Predictor", "ai_research", { research: true, tickers: true }],
  ["recommendation-generator", "Recommendation Generator", "ai_research", { research: true, tickers: true }],
  ["hypothesis-tester", "Hypothesis Tester", "ai_research", { research: true }],
  ["metric-dashboard-builder", "Metric Dashboard Builder", "ai_research", { research: true, reports: true }],
  ["kpi-tracker", "KPI Tracker", "ai_research", { research: true, reports: true }],
  ["research-aggregator", "Research Aggregator", "ai_research", { research: true, tickers: true }],
  ["configuration-manager", "Configuration Manager", "support_maintenance", { support: true }],
  ["user-activity-logger", "User Activity Logger", "support_maintenance", { support: true, logsOnly: true }],
  ["notification-dispatcher", "Notification Dispatcher", "support_maintenance", { support: true }],
  ["performance-monitor", "Performance Monitor", "support_maintenance", { support: true }],
  ["data-validator", "Data Validator", "support_maintenance", { support: true }],
  ["security-auditor", "Security Auditor", "support_maintenance", { support: true }],
  ["access-controller", "Access Controller", "support_maintenance", { support: true }],
  ["cleanup-agent", "Cleanup Agent", "support_maintenance", { support: true, temp: true }],
  ["version-manager", "Version Manager", "support_maintenance", { support: true }],
  ["documentation-generator", "Documentation Generator", "support_maintenance", { support: true, reports: true }],
];

const schedules = ["hourly", "daily", "on_demand", "cron", "hourly", "daily", "on_demand", "hourly", "daily", "hourly"];
function scheduleForIndex(i) {
  const t = schedules[i % schedules.length];
  return t === "cron"
    ? { type: "cron", cronExpression: "0 */6 * * *" }
    : { type: t };
}

function buildAgent([id, name, category, flags], index) {
  const reads = [CONFIG, WORKFLOWS, DATA];
  if (flags.tickers) {
    reads.push(TICKERS);
  }
  if (flags.stocksNote) {
    reads.push(pe(`${ROOT}/config/stocks.json`));
  }

  const writes = [];
  if (flags.market) writes.push(MARKET);
  if (flags.hist) writes.push(HIST);
  if (flags.reports || flags.content) writes.push(REPORTS);
  if (flags.media || flags.video || flags.image || flags.audio) {
    writes.push(MEDIA_ROOT);
    if (flags.video) writes.push(MEDIA_VIDEO);
    if (flags.audio) writes.push(MEDIA_AUDIO);
    if (flags.image) writes.push(MEDIA_IMAGES);
  }
  if (flags.backups) writes.push(BACKUPS);
  if (flags.temp) writes.push(TEMP);
  if (flags.logsOnly) writes.push(LOGS);
  if (flags.auto && !writes.length) writes.push(pe(`${ROOT}/data/automation/`));

  const logFile = `${ROOT}/data/logs/${id}.log`;
  const mediaHeavy =
    Boolean(flags.video || flags.audio || flags.image || flags.large);

  const diskRequirements =
    flags.large || flags.video
      ? { minFreeGb: 10, checkBeforeWrite: true }
      : flags.audio || flags.image
        ? { minFreeGb: 1, checkBeforeWrite: true }
        : undefined;

  const fallbackPaths =
    flags.large || flags.video || flags.audio
      ? [MEDIA_VIDEO, pe(`${ROOT}/data/temp/media-overflow/`), MEDIA_ROOT]
      : undefined;

  const maxOut =
    flags.video ? 10737418240 : flags.audio || flags.image ? 1073741824 : flags.market ? 104857600 : 52428800;
  const diskQuota =
    flags.large || flags.video
      ? 1099511627776
      : flags.audio || flags.image
        ? 107374182400
        : category === "content_media"
          ? 53687091200
          : undefined;

  const systemPackages = [];
  if (flags.video || id === "video-editor") systemPackages.push("ffmpeg");
  if (flags.image || id === "image-generator" || id === "thumbnail-creator")
    systemPackages.push("imagemagick");
  if (flags.audio || id === "voiceover-generator") systemPackages.push("ffmpeg", "espeak-ng");

  const tickersExempt = !flags.tickers;
  const tickersExemptReason = tickersExempt
    ? "Agent does not consume symbol lists from tickers.json for its primary path."
    : undefined;

  return {
    id,
    name,
    role: `${name} — operational n8n agent`,
    responsibilities: [
      `Execute registry-defined tasks for ${name}.`,
      `Read/write only via pathEntry paths; respect modes.dryRun until compliance gate.`,
    ],
    category,
    inputType: flags.market ? "JSON, API responses, tickers config" : "JSON, files, API",
    outputType: flags.video
      ? "MP4, JSON sidecar"
      : flags.audio
        ? "WAV/MP3, JSON"
        : flags.image
          ? "PNG, JPEG"
          : "JSON, CSV, or logs",
    jobTitle: name,
    coreCompetencies: ["n8n workflows", "Block70 workspace conventions"],
    qualifications: ["Operator-configured; see registry runtime.systemPackages"],
    paths: { reads, writes },
    outputFormats: flags.video
      ? ["json", "video"]
      : flags.audio
        ? ["json", "audio"]
        : flags.image
          ? ["json", "image"]
          : ["json", "csv"],
    n8n: {
      workflowFile: `${ROOT}/workflows/${id}.json`,
      workflowId: `REPLACE_WITH_N8N_WORKFLOW_ID_${id.replace(/-/g, "_").toUpperCase()}`,
      primaryNodes: ["ScheduleOrWebhook", "Transform", "WriteOutput"],
      webhookPath:
        scheduleForIndex(index).type === "on_demand"
          ? `REPLACE_WITH_WEBHOOK_PATH_${id}`
          : undefined,
      executeWorkflowTargets: [],
      integrations: {
        webhookPath: `REPLACE_WITH_WEBHOOK_PATH_${id}`,
        authType: "token",
        timeoutMs: 60000,
        retryPolicy: { maxAttempts: 3, backoffMs: [1000, 5000, 15000] },
      },
    },
    schedule: scheduleForIndex(index),
    triggers: {
      onComplete: [],
      onError: id === "error-logger" ? [] : ["error-logger"],
    },
    tasks: [
      {
        id: `${id}-main`,
        description: `Primary workflow task for ${id}`,
        n8nNodeTypes: ["Schedule Trigger", "HTTP Request", "Read/Write Files from Disk"],
        inputs: ["registry paths.reads"],
        outputs: ["registry paths.writes"],
      },
    ],
    dynamicCapabilities: flags.tickers
      ? ["read_tickers_json", "poll_tickers_json"]
      : ["watch_directory"],
    logging: {
      componentName: id,
      logFile,
      logLevel: "info",
      rotation: {
        maxSizeMb: 50,
        maxAgeDays: 14,
        archivePath: LOG_ARCHIVE,
      },
      appendOnlyTimestamps: mediaHeavy,
    },
    errorHandling: {
      strategy: "retry_then_alert",
      maxRetries: 3,
      backoffSeconds: [5, 30, 120],
      fallbackAction: "route_to_dead_letter_and_alert",
      alertChannels: ["slack", "email", "n8n_webhook"],
      deadLetterPaths: [pe(`${ROOT}/data/logs/dead-letter/${id}/`), DL_SHARED],
      retryPolicy: { transientHttp: true },
    },
    metadata: {
      version: "1.0.0",
      createdAt: null,
      lastRunAt: null,
      lastSuccessfulRunAt: null,
      lastError: null,
      retryCount: null,
      lastOutputSummary: null,
    },
    metrics: {
      lastExecutionDurationMs: null,
      lastOutputSizeBytes: null,
      successRate: null,
      failureRate: null,
    },
    modes: {
      dryRun: false,
      dryRunSkipsWrites: ["media"],
      dryRunValidates: ["paths", "schedules", "triggers"],
    },
    diskRequirements,
    fallbackPaths,
    operationalNotes: flags.stocksNote
      ? "Optional stocks.json under config/ if tickers.json does not list equities."
      : "Default largeMediaRoot under data/media/; bind 64TB volume if needed.",
    executionConcurrency: 1,
    maxParallelRuns: category === "content_media" ? 2 : 3,
    maxOutputSizeBytes: maxOut,
    diskQuotaBytes: diskQuota,
    dependsOnAgents: [],
    executionOrder: index + 1,
    runtime: {
      systemPackages,
      runtimeNotes: systemPackages.length ? "Install packages before enabling workflow." : null,
    },
    security: {
      sensitiveDataFields: ["api_token", "webhook_secret"],
      logRedactionRules: "mask_secrets",
    },
    archiving: {
      archivePath: pe(`${ROOT}/data/backups/archive/${id}/`),
      retentionDays: 90,
    },
    simulateTrigger: true,
    validation: {
      scriptPath: null,
      description: "Deferred: add server script at /home/jmiller/n8n_workspace/scripts/validate/{id}.sh when ready.",
    },
    tickersExempt,
    tickersExemptReason,
  };
}

const agents = ROSTER.map((row, i) => buildAgent(row, i));

const registry = {
  schemaVersion: "1.0.0",
  registryVersion: "1.0.0",
  server: {
    configRoot: CONFIG,
    dataRoot: DATA,
    workflowsRoot: WORKFLOWS,
    logsRoot: LOGS,
    tickersFile: TICKERS,
    largeMediaRoot: MEDIA_ROOT,
    defaultMaxRetries: 3,
    defaultFallback: "log_and_alert",
    globalErrorHandling: {
      defaultAlertChannels: ["n8n_webhook", "email"],
      sharedDeadLetterPath: DL_SHARED,
      escalationWorkflowId: "REPLACE_WITH_ESCALATION_WORKFLOW_ID",
    },
    runtime: {
      n8nVersion: ">=1.0.0",
      nodeVersion: ">=20.0.0",
    },
    modes: {
      dryRun: false,
      dryRunSkipsWrites: ["media", "market_json"],
      dryRunValidates: ["paths", "schedules", "triggers", "disk_checks"],
    },
  },
  agents,
};

writeFileSync(OUT, JSON.stringify(registry, null, 2), "utf8");
console.log("Wrote", OUT, "agents:", agents.length);
