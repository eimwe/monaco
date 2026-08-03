// shortened https://json.schemastore.org/github-workflow.json
const EVENT_NAMES = [
  'push',
  'pull_request',
  'pull_request_target',
  'workflow_dispatch',
  'workflow_call',
  'schedule',
  'release',
  'issues',
  'issue_comment',
  'workflow_run',
  'repository_dispatch',
  'deployment',
  'check_run',
  'check_suite',
  'fork',
  'gollum',
  'label',
  'milestone',
  'page_build',
  'project',
  'status',
  'watch',
]

const PERMISSION_SCOPES = [
  'actions',
  'checks',
  'contents',
  'deployments',
  'id-token',
  'issues',
  'discussions',
  'packages',
  'pages',
  'pull-requests',
  'repository-projects',
  'security-events',
  'statuses',
]

const RUNNER_LABELS = [
  'ubuntu-latest',
  'ubuntu-24.04',
  'ubuntu-22.04',
  'macos-latest',
  'macos-14',
  'windows-latest',
  'windows-2022',
  'self-hosted',
]

const SHELLS = ['bash', 'pwsh', 'python', 'sh', 'cmd', 'powershell']

export const githubWorkflowSchema: Record<string, unknown> = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'GitHub Actions Workflow (demo subset)',
  type: 'object',
  required: ['on', 'jobs'],
  additionalProperties: true,
  properties: {
    name: {
      type: 'string',
      description: 'The name of the workflow, shown in the Actions tab.',
    },
    'run-name': {
      type: 'string',
      description: 'A dynamic name for workflow runs, shown in the run list.',
    },
    on: {
      description: 'The event(s) that trigger this workflow.',
      oneOf: [
        { type: 'string', enum: EVENT_NAMES },
        { type: 'array', items: { type: 'string', enum: EVENT_NAMES } },
        {
          type: 'object',
          properties: Object.fromEntries(
            EVENT_NAMES.map((name) => [
              name,
              {
                type: 'object',
                additionalProperties: true,
                description: `Configuration for the "${name}" event.`,
              },
            ]),
          ),
          additionalProperties: true,
        },
      ],
    },
    permissions: {
      description: 'Permissions granted to the GITHUB_TOKEN for this workflow.',
      oneOf: [
        { type: 'string', enum: ['read-all', 'write-all'] },
        {
          type: 'object',
          properties: Object.fromEntries(
            PERMISSION_SCOPES.map((scope) => [
              scope,
              { type: 'string', enum: ['read', 'write', 'none'] },
            ]),
          ),
          additionalProperties: false,
        },
      ],
    },
    env: {
      type: 'object',
      description: 'Environment variables available to all jobs and steps.',
      additionalProperties: { type: ['string', 'number', 'boolean'] },
    },
    defaults: {
      type: 'object',
      properties: {
        run: {
          type: 'object',
          properties: {
            shell: { type: 'string', enum: SHELLS },
            'working-directory': { type: 'string' },
          },
        },
      },
    },
    concurrency: {
      description: 'Ensures only one run of this workflow (per group) executes at a time.',
      oneOf: [
        { type: 'string' },
        {
          type: 'object',
          properties: {
            group: { type: 'string' },
            'cancel-in-progress': { type: ['boolean', 'string'] },
          },
          required: ['group'],
        },
      ],
    },
    jobs: {
      type: 'object',
      minProperties: 1,
      description: 'One or more jobs, keyed by job id.',
      additionalProperties: {
        type: 'object',
        required: ['runs-on', 'steps'],
        properties: {
          name: { type: 'string', description: 'Display name for the job.' },
          needs: {
            description: 'Job id(s) that must complete before this job runs.',
            oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
          },
          if: {
            type: 'string',
            description:
              "Expression controlling whether the job runs, e.g. github.ref == 'refs/heads/main'.",
          },
          'runs-on': {
            description: 'The runner (or runner group) this job executes on.',
            oneOf: [
              { type: 'string', enum: RUNNER_LABELS },
              { type: 'array', items: { type: 'string' } },
            ],
          },
          environment: {
            description: 'The deployment environment this job targets.',
            oneOf: [
              { type: 'string' },
              {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  url: { type: 'string' },
                },
                required: ['name'],
              },
            ],
          },
          permissions: { $ref: '#/properties/permissions' },
          env: { $ref: '#/properties/env' },
          strategy: {
            type: 'object',
            properties: {
              matrix: {
                type: 'object',
                description: 'Variable combinations to run this job across.',
                additionalProperties: true,
                properties: {
                  include: { type: 'array', items: { type: 'object' } },
                  exclude: { type: 'array', items: { type: 'object' } },
                },
              },
              'fail-fast': { type: 'boolean', default: true },
              'max-parallel': { type: 'integer', minimum: 1 },
            },
          },
          'continue-on-error': { type: ['boolean', 'string'] },
          'timeout-minutes': { type: 'number', minimum: 1, default: 360 },
          outputs: {
            type: 'object',
            additionalProperties: { type: 'string' },
          },
          steps: {
            type: 'array',
            description: 'The sequence of tasks this job runs.',
            items: {
              type: 'object',
              additionalProperties: true,
              properties: {
                id: {
                  type: 'string',
                  description: "Identifier used to reference this step's outputs.",
                },
                name: { type: 'string', description: 'Display name for the step.' },
                if: {
                  type: 'string',
                  description: 'Expression controlling whether the step runs.',
                },
                uses: {
                  type: 'string',
                  description:
                    'A reusable action to run, formatted as {owner}/{repo}@{ref}, e.g. actions/checkout@v4.',
                  examples: [
                    'actions/checkout@v4',
                    'actions/setup-node@v4',
                    'actions/upload-artifact@v4',
                    'actions/cache@v4',
                    'docker/build-push-action@v6',
                  ],
                },
                run: {
                  type: 'string',
                  description: 'A shell command (or multi-line script) to run.',
                },
                shell: { type: 'string', enum: SHELLS },
                with: {
                  type: 'object',
                  description: 'Input parameters passed to the action referenced by "uses".',
                  additionalProperties: true,
                },
                env: { $ref: '#/properties/env' },
                'working-directory': { type: 'string' },
                'continue-on-error': { type: ['boolean', 'string'] },
                'timeout-minutes': { type: 'number', minimum: 1 },
              },
              oneOf: [{ required: ['uses'] }, { required: ['run'] }, {}],
            },
          },
        },
      },
    },
  },
}
