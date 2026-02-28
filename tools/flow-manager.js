/**
 * Power Automate Flow Manager — CRUD for Cloud Flows via Dataverse Web API
 *
 * Manages Power Automate cloud flows (category=5) stored as `workflow` records
 * in Dataverse. Primary use case: configuring event triggers (recurrence,
 * SharePoint, email, etc.) for MCS autonomous agents without Playwright.
 *
 * Auth: az account get-access-token --resource https://<org>.crm.dynamics.com
 *
 * Usage:
 *   node tools/flow-manager.js list --org https://orgXXX.crm.dynamics.com
 *   node tools/flow-manager.js get --org https://orgXXX.crm.dynamics.com --flow <id>
 *   node tools/flow-manager.js create-trigger --org https://orgXXX.crm.dynamics.com --bot <id> --preset weekdays-7am-pst --message "Generate daily briefing"
 *   node tools/flow-manager.js create-trigger --org https://orgXXX.crm.dynamics.com --bot <id> --schedule '{"frequency":"Week","interval":1}' --message "Check updates"
 *   node tools/flow-manager.js update-schedule --org https://orgXXX.crm.dynamics.com --flow <id> --schedule '{"frequency":"Minute","interval":10}'
 *   node tools/flow-manager.js update-message --org https://orgXXX.crm.dynamics.com --flow <id> --message "New payload"
 *   node tools/flow-manager.js activate --org https://orgXXX.crm.dynamics.com --flow <id>
 *   node tools/flow-manager.js deactivate --org https://orgXXX.crm.dynamics.com --flow <id>
 *   node tools/flow-manager.js delete --org https://orgXXX.crm.dynamics.com --flow <id>
 *   node tools/flow-manager.js discover --org https://orgXXX.crm.dynamics.com --bot <id>
 */

const crypto = require('crypto');
const { httpRequest, httpRequestWithRetry, getToken } = require('./lib/http');

// --- Constants ---

const API_VERSION = 'v9.2';

/** Schedule presets for common recurrence patterns */
const PRESETS = {
    'weekdays-7am-pst': {
        frequency: 'Week',
        interval: 1,
        timeZone: 'Pacific Standard Time',
        schedule: {
            weekDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            hours: ['7'],
            minutes: [0]
        }
    },
    'weekdays-8am-est': {
        frequency: 'Week',
        interval: 1,
        timeZone: 'Eastern Standard Time',
        schedule: {
            weekDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            hours: ['8'],
            minutes: [0]
        }
    },
    'weekdays-9am-utc': {
        frequency: 'Week',
        interval: 1,
        timeZone: 'UTC',
        schedule: {
            weekDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            hours: ['9'],
            minutes: [0]
        }
    },
    'daily-9am-utc': {
        frequency: 'Day',
        interval: 1,
        timeZone: 'UTC',
        schedule: {
            hours: ['9'],
            minutes: [0]
        }
    },
    'daily-8am-pst': {
        frequency: 'Day',
        interval: 1,
        timeZone: 'Pacific Standard Time',
        schedule: {
            hours: ['8'],
            minutes: [0]
        }
    },
    'every-10-min': {
        frequency: 'Minute',
        interval: 10
    },
    'every-30-min': {
        frequency: 'Minute',
        interval: 30
    },
    'hourly': {
        frequency: 'Hour',
        interval: 1
    }
};

// --- Helpers ---

function buildApiUrl(orgUrl, entity, id, query) {
    const base = orgUrl.replace(/\/$/, '');
    let url = `${base}/api/data/${API_VERSION}/${entity}`;
    if (id) url += `(${id})`;
    if (query) url += `?${query}`;
    return url;
}

function buildHeaders(token) {
    return {
        'Authorization': `Bearer ${token}`,
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json; charset=utf-8',
        'Prefer': 'return=representation'
    };
}

/**
 * Build the clientdata JSON for a recurrence trigger flow that calls an MCS agent.
 *
 * @param {object} schedule - Recurrence schedule (frequency, interval, timeZone, schedule)
 * @param {string} copilotParam - Copilot parameter value (e.g. "copilots_header_8b375")
 * @param {string} connRefLogicalName - Connection reference logical name
 * @param {string} message - Payload message text
 * @returns {string} Serialized clientdata JSON
 */
function buildRecurrenceClientdata(schedule, copilotParam, connRefLogicalName, message) {
    const recurrence = {
        type: 'Recurrence',
        recurrence: {
            frequency: schedule.frequency,
            interval: schedule.interval
        },
        metadata: {
            operationMetadataId: crypto.randomUUID()
        }
    };

    if (schedule.timeZone) {
        recurrence.recurrence.timeZone = schedule.timeZone;
    }
    if (schedule.schedule) {
        recurrence.recurrence.schedule = schedule.schedule;
    }
    if (schedule.startTime) {
        recurrence.recurrence.startTime = schedule.startTime;
    }

    const clientdata = {
        properties: {
            connectionReferences: {
                shared_microsoftcopilotstudio: {
                    runtimeSource: 'embedded',
                    connection: {
                        connectionReferenceLogicalName: connRefLogicalName
                    },
                    api: {
                        name: 'shared_microsoftcopilotstudio'
                    }
                }
            },
            definition: {
                '$schema': 'https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#',
                contentVersion: '1.0.0.0',
                parameters: {
                    '$connections': { defaultValue: {}, type: 'Object' },
                    '$authentication': { defaultValue: {}, type: 'SecureObject' }
                },
                triggers: {
                    Recurrence: recurrence
                },
                actions: {
                    Sends_a_prompt_to_the_specified_copilot_for_processing: {
                        runAfter: {},
                        type: 'OpenApiConnection',
                        inputs: {
                            host: {
                                connectionName: 'shared_microsoftcopilotstudio',
                                operationId: 'ExecuteCopilot',
                                apiId: '/providers/Microsoft.PowerApps/apis/shared_microsoftcopilotstudio'
                            },
                            parameters: {
                                Copilot: copilotParam,
                                'body/message': message
                            },
                            authentication: "@parameters('$authentication')"
                        },
                        metadata: {
                            operationMetadataId: crypto.randomUUID()
                        }
                    }
                }
            },
            templateName: ''
        },
        schemaVersion: '1.0.0.0'
    };

    return JSON.stringify(clientdata);
}

// --- Dataverse CRUD Operations ---

/**
 * List cloud flows (category=5) in the environment.
 *
 * @param {string} orgUrl - Dataverse org URL (e.g. https://orgXXX.crm.dynamics.com)
 * @param {string} token - Access token
 * @param {object} [options] - { top, filter, select }
 * @returns {Promise<Array>} Array of workflow records
 */
async function listFlows(orgUrl, token, options = {}) {
    const top = options.top || 50;
    const select = options.select || 'name,workflowid,statecode,description,createdon,modifiedon';
    let filter = 'category eq 5';
    if (options.filter) {
        filter += ` and ${options.filter}`;
    }
    const query = `$filter=${encodeURIComponent(filter)}&$select=${select}&$top=${top}&$orderby=modifiedon desc`;
    const url = buildApiUrl(orgUrl, 'workflows', null, query);
    const headers = buildHeaders(token);

    const res = await httpRequestWithRetry('GET', url, headers);
    if (res.status !== 200) {
        throw new Error(`listFlows failed: HTTP ${res.status} — ${JSON.stringify(res.data).substring(0, 500)}`);
    }
    return res.data.value || [];
}

/**
 * Get a single flow definition with parsed clientdata.
 *
 * @param {string} orgUrl
 * @param {string} token
 * @param {string} flowId - Workflow GUID
 * @returns {Promise<{record: object, definition: object|null}>}
 */
async function getFlow(orgUrl, token, flowId) {
    const url = buildApiUrl(orgUrl, 'workflows', flowId, '$select=name,workflowid,statecode,category,clientdata,description,createdon,modifiedon');
    const headers = buildHeaders(token);

    const res = await httpRequestWithRetry('GET', url, headers);
    if (res.status !== 200) {
        throw new Error(`getFlow failed: HTTP ${res.status} — ${JSON.stringify(res.data).substring(0, 500)}`);
    }

    let definition = null;
    if (res.data.clientdata) {
        try {
            definition = JSON.parse(res.data.clientdata);
        } catch {
            // clientdata may not be valid JSON in all cases
        }
    }
    return { record: res.data, definition };
}

/**
 * Create a recurrence trigger flow for an MCS agent.
 *
 * @param {string} orgUrl
 * @param {string} token
 * @param {object} params - { name, schedule, copilotParam, connRefLogicalName, message, description }
 * @returns {Promise<object>} Created workflow record
 */
async function createTriggerFlow(orgUrl, token, params) {
    const { name, schedule, copilotParam, connRefLogicalName, message, description } = params;
    const clientdata = buildRecurrenceClientdata(schedule, copilotParam, connRefLogicalName, message);

    const body = {
        category: 5,
        name: name || `Trigger - ${schedule.frequency} - ${new Date().toISOString().split('T')[0]}`,
        type: 1,
        primaryentity: 'none',
        description: description || `Recurrence trigger for MCS agent (${schedule.frequency} every ${schedule.interval})`,
        clientdata: clientdata
    };

    const url = buildApiUrl(orgUrl, 'workflows');
    const headers = buildHeaders(token);

    const res = await httpRequestWithRetry('POST', url, headers, body);
    if (res.status !== 200 && res.status !== 201) {
        throw new Error(`createTriggerFlow failed: HTTP ${res.status} — ${JSON.stringify(res.data).substring(0, 500)}`);
    }
    return res.data;
}

/**
 * Update the recurrence schedule on an existing flow.
 *
 * @param {string} orgUrl
 * @param {string} token
 * @param {string} flowId
 * @param {object} schedule - New schedule object
 * @returns {Promise<object>}
 */
async function updateSchedule(orgUrl, token, flowId, schedule) {
    const { record, definition } = await getFlow(orgUrl, token, flowId);
    if (!definition) {
        throw new Error('Flow has no parseable clientdata');
    }

    const triggers = definition.properties?.definition?.triggers;
    if (!triggers?.Recurrence) {
        throw new Error('Flow does not have a Recurrence trigger');
    }

    // Update the recurrence settings
    triggers.Recurrence.recurrence = {
        frequency: schedule.frequency,
        interval: schedule.interval
    };
    if (schedule.timeZone) {
        triggers.Recurrence.recurrence.timeZone = schedule.timeZone;
    }
    if (schedule.schedule) {
        triggers.Recurrence.recurrence.schedule = schedule.schedule;
    }
    if (schedule.startTime) {
        triggers.Recurrence.recurrence.startTime = schedule.startTime;
    }

    const url = buildApiUrl(orgUrl, 'workflows', flowId);
    const headers = { ...buildHeaders(token), 'If-Match': '*' };

    const res = await httpRequestWithRetry('PATCH', url, headers, {
        clientdata: JSON.stringify(definition)
    });
    if (res.status !== 200 && res.status !== 204) {
        throw new Error(`updateSchedule failed: HTTP ${res.status} — ${JSON.stringify(res.data).substring(0, 500)}`);
    }
    return res.data;
}

/**
 * Update the payload message on an existing flow.
 *
 * @param {string} orgUrl
 * @param {string} token
 * @param {string} flowId
 * @param {string} message - New message text
 * @returns {Promise<object>}
 */
async function updateMessage(orgUrl, token, flowId, message) {
    const { record, definition } = await getFlow(orgUrl, token, flowId);
    if (!definition) {
        throw new Error('Flow has no parseable clientdata');
    }

    const actions = definition.properties?.definition?.actions;
    if (!actions) {
        throw new Error('Flow has no actions defined');
    }

    // Find the ExecuteCopilot action — look for any action with operationId: ExecuteCopilot
    let found = false;
    for (const [actionName, action] of Object.entries(actions)) {
        if (action.inputs?.host?.operationId === 'ExecuteCopilot') {
            action.inputs.parameters['body/message'] = message;
            found = true;
            break;
        }
    }

    if (!found) {
        throw new Error('No ExecuteCopilot action found in flow');
    }

    const url = buildApiUrl(orgUrl, 'workflows', flowId);
    const headers = { ...buildHeaders(token), 'If-Match': '*' };

    const res = await httpRequestWithRetry('PATCH', url, headers, {
        clientdata: JSON.stringify(definition)
    });
    if (res.status !== 200 && res.status !== 204) {
        throw new Error(`updateMessage failed: HTTP ${res.status} — ${JSON.stringify(res.data).substring(0, 500)}`);
    }
    return res.data;
}

/**
 * Activate a flow (statecode=1 means activated/on).
 *
 * @param {string} orgUrl
 * @param {string} token
 * @param {string} flowId
 * @returns {Promise<void>}
 */
async function activateFlow(orgUrl, token, flowId) {
    const url = buildApiUrl(orgUrl, 'workflows', flowId);
    const headers = { ...buildHeaders(token), 'If-Match': '*' };

    const res = await httpRequestWithRetry('PATCH', url, headers, { statecode: 1 });
    if (res.status !== 200 && res.status !== 204) {
        throw new Error(`activateFlow failed: HTTP ${res.status} — ${JSON.stringify(res.data).substring(0, 500)}`);
    }
}

/**
 * Deactivate a flow (statecode=0 means draft/off).
 *
 * @param {string} orgUrl
 * @param {string} token
 * @param {string} flowId
 * @returns {Promise<void>}
 */
async function deactivateFlow(orgUrl, token, flowId) {
    const url = buildApiUrl(orgUrl, 'workflows', flowId);
    const headers = { ...buildHeaders(token), 'If-Match': '*' };

    const res = await httpRequestWithRetry('PATCH', url, headers, { statecode: 0 });
    if (res.status !== 200 && res.status !== 204) {
        throw new Error(`deactivateFlow failed: HTTP ${res.status} — ${JSON.stringify(res.data).substring(0, 500)}`);
    }
}

/**
 * Delete a flow.
 *
 * @param {string} orgUrl
 * @param {string} token
 * @param {string} flowId
 * @returns {Promise<void>}
 */
async function deleteFlow(orgUrl, token, flowId) {
    const url = buildApiUrl(orgUrl, 'workflows', flowId);
    const headers = buildHeaders(token);

    const res = await httpRequestWithRetry('DELETE', url, headers);
    if (res.status !== 204) {
        throw new Error(`deleteFlow failed: HTTP ${res.status} — ${JSON.stringify(res.data).substring(0, 500)}`);
    }
}

// --- Discovery ---

/**
 * Discover the MCS connector connection reference in the environment.
 * Queries connectionreferences filtered by connectorid containing 'microsoftcopilotstudio'.
 *
 * @param {string} orgUrl
 * @param {string} token
 * @returns {Promise<Array>} Array of matching connection references
 */
async function discoverConnectionRef(orgUrl, token) {
    const filter = "contains(connectorid,'microsoftcopilotstudio')";
    const select = 'connectionreferencelogicalname,connectorid,connectionid,connectionreferencedisplayname';
    const url = buildApiUrl(orgUrl, 'connectionreferences', null, `$filter=${encodeURIComponent(filter)}&$select=${select}`);
    const headers = buildHeaders(token);

    const res = await httpRequestWithRetry('GET', url, headers);
    if (res.status !== 200) {
        throw new Error(`discoverConnectionRef failed: HTTP ${res.status} — ${JSON.stringify(res.data).substring(0, 500)}`);
    }
    return res.data.value || [];
}

/**
 * Discover the Copilot parameter value from existing trigger flows for a bot.
 * Searches cloud flows for ExecuteCopilot actions, extracts the Copilot parameter.
 *
 * @param {string} orgUrl
 * @param {string} token
 * @param {string} botId - Bot/agent CDS ID
 * @returns {Promise<{copilotParam: string|null, flowId: string|null, flowName: string|null}>}
 */
async function discoverCopilotParam(orgUrl, token, botId) {
    // Get all cloud flows and search their clientdata for the bot reference
    const flows = await listFlows(orgUrl, token, {
        select: 'name,workflowid,clientdata',
        top: 100
    });

    for (const flow of flows) {
        if (!flow.clientdata) continue;
        try {
            const def = JSON.parse(flow.clientdata);
            const actions = def.properties?.definition?.actions;
            if (!actions) continue;

            for (const [actionName, action] of Object.entries(actions)) {
                if (action.inputs?.host?.operationId === 'ExecuteCopilot') {
                    const copilotParam = action.inputs.parameters?.Copilot;
                    if (copilotParam) {
                        return {
                            copilotParam,
                            flowId: flow.workflowid,
                            flowName: flow.name
                        };
                    }
                }
            }
        } catch {
            // Skip flows with unparseable clientdata
        }
    }

    // Fallback: try to derive from bot schema name
    // The copilot param pattern is typically "copilots_header_XXXXX" derived from the bot
    return { copilotParam: null, flowId: null, flowName: null };
}

/**
 * Full discovery — find both connection reference and copilot param.
 *
 * @param {string} orgUrl
 * @param {string} token
 * @param {string} botId
 * @returns {Promise<{connRef: string|null, copilotParam: string|null, details: object}>}
 */
async function discover(orgUrl, token, botId) {
    const [connRefs, copilotInfo] = await Promise.all([
        discoverConnectionRef(orgUrl, token),
        discoverCopilotParam(orgUrl, token, botId)
    ]);

    return {
        connRef: connRefs.length > 0 ? connRefs[0].connectionreferencelogicalname : null,
        copilotParam: copilotInfo.copilotParam,
        details: {
            connectionReferences: connRefs,
            copilotParam: copilotInfo.copilotParam,
            fromFlow: copilotInfo.flowName,
            fromFlowId: copilotInfo.flowId
        }
    };
}

// --- CLI ---

function parseArgs() {
    const args = process.argv.slice(2);
    const config = {};

    if (args.length === 0 || args[0] === '--help') {
        printUsage();
        process.exit(0);
    }

    config.command = args[0];

    for (let i = 1; i < args.length; i++) {
        switch (args[i]) {
            case '--org': config.orgUrl = args[++i]; break;
            case '--flow': config.flowId = args[++i]; break;
            case '--bot': config.botId = args[++i]; break;
            case '--schedule': config.schedule = args[++i]; break;
            case '--preset': config.preset = args[++i]; break;
            case '--message': config.message = args[++i]; break;
            case '--name': config.name = args[++i]; break;
            case '--description': config.description = args[++i]; break;
            case '--conn-ref': config.connRef = args[++i]; break;
            case '--copilot-param': config.copilotParam = args[++i]; break;
            case '--json': config.json = true; break;
            case '--help': printUsage(); process.exit(0);
        }
    }

    return config;
}

function printUsage() {
    console.log(`Power Automate Flow Manager — CRUD via Dataverse Web API

Usage: node flow-manager.js <command> [options]

Commands:
  list              List cloud flows (category=5) in the environment
  get               Get flow definition (parsed clientdata)
  create-trigger    Create a recurrence trigger flow for an MCS agent
  update-schedule   Update recurrence schedule on existing flow
  update-message    Update payload message on existing flow
  activate          Turn on a flow (statecode=1)
  deactivate        Turn off a flow (statecode=0)
  delete            Delete a flow
  discover          Find MCS connector connection ref + copilot param

Required:
  --org <url>       Dataverse org URL (e.g. https://orgXXX.crm.dynamics.com)

Command-specific:
  --flow <id>       Flow/workflow GUID (for get, update-*, activate, deactivate, delete)
  --bot <id>        Bot/agent CDS ID (for create-trigger, discover)
  --schedule <json> Schedule as JSON (for create-trigger, update-schedule)
  --preset <name>   Schedule preset (for create-trigger, update-schedule)
  --message <text>  Payload message (for create-trigger, update-message)
  --name <text>     Flow display name (for create-trigger)
  --description <t> Flow description (for create-trigger)
  --conn-ref <name> Connection reference logical name (auto-discovered if omitted)
  --copilot-param   Copilot parameter value (auto-discovered if omitted)
  --json            Output raw JSON

Schedule presets:
  weekdays-7am-pst, weekdays-8am-est, weekdays-9am-utc,
  daily-9am-utc, daily-8am-pst, every-10-min, every-30-min, hourly

Examples:
  # List all cloud flows
  node tools/flow-manager.js list --org https://orgXXX.crm.dynamics.com

  # Get flow definition
  node tools/flow-manager.js get --org https://orgXXX.crm.dynamics.com --flow <id>

  # Discover connection ref + copilot param
  node tools/flow-manager.js discover --org https://orgXXX.crm.dynamics.com --bot <id>

  # Create trigger with preset
  node tools/flow-manager.js create-trigger --org https://orgXXX.crm.dynamics.com \\
    --bot <id> --preset weekdays-7am-pst --message "Generate daily briefing"

  # Create trigger with custom schedule
  node tools/flow-manager.js create-trigger --org https://orgXXX.crm.dynamics.com \\
    --bot <id> --schedule '{"frequency":"Minute","interval":10}' --message "Check updates"

  # Update message on existing flow
  node tools/flow-manager.js update-message --org https://orgXXX.crm.dynamics.com \\
    --flow <id> --message "New payload text"

  # Activate / deactivate
  node tools/flow-manager.js activate --org https://orgXXX.crm.dynamics.com --flow <id>
  node tools/flow-manager.js deactivate --org https://orgXXX.crm.dynamics.com --flow <id>`);
}

async function main() {
    const config = parseArgs();

    if (!config.orgUrl) {
        console.error('Error: --org is required');
        process.exit(2);
    }

    // Get Dataverse token
    const token = getToken(config.orgUrl);

    try {
        switch (config.command) {
            case 'list': {
                const flows = await listFlows(config.orgUrl, token);
                if (config.json) {
                    console.log(JSON.stringify(flows, null, 2));
                } else {
                    console.log(`Cloud Flows (${flows.length}):\n`);
                    for (const f of flows) {
                        const state = f.statecode === 1 ? 'Active' : 'Draft';
                        const modified = f.modifiedon ? f.modifiedon.split('T')[0] : '';
                        console.log(`  ${f.name}`);
                        console.log(`    ID: ${f.workflowid}  |  State: ${state}  |  Modified: ${modified}`);
                        if (f.description) console.log(`    ${f.description.substring(0, 80)}`);
                    }
                    if (flows.length === 0) {
                        console.log('  No cloud flows found (category=5).');
                    }
                }
                break;
            }

            case 'get': {
                if (!config.flowId) {
                    console.error('Error: --flow is required for get');
                    process.exit(2);
                }
                const { record, definition } = await getFlow(config.orgUrl, token, config.flowId);
                if (config.json) {
                    console.log(JSON.stringify({ record, definition }, null, 2));
                } else {
                    const state = record.statecode === 1 ? 'Active' : 'Draft';
                    console.log(`Flow: ${record.name}`);
                    console.log(`  ID: ${record.workflowid}`);
                    console.log(`  State: ${state}`);
                    console.log(`  Category: ${record.category}`);
                    if (definition) {
                        const triggers = definition.properties?.definition?.triggers || {};
                        const actions = definition.properties?.definition?.actions || {};
                        const connRefs = definition.properties?.connectionReferences || {};
                        console.log(`  Triggers: ${Object.keys(triggers).join(', ') || 'none'}`);
                        console.log(`  Actions: ${Object.keys(actions).join(', ') || 'none'}`);
                        console.log(`  Connection refs: ${Object.keys(connRefs).join(', ') || 'none'}`);

                        // Show recurrence details if present
                        const rec = triggers.Recurrence?.recurrence;
                        if (rec) {
                            console.log(`\n  Recurrence:`);
                            console.log(`    Frequency: ${rec.frequency} every ${rec.interval}`);
                            if (rec.timeZone) console.log(`    TimeZone: ${rec.timeZone}`);
                            if (rec.schedule?.weekDays) console.log(`    Days: ${rec.schedule.weekDays.join(', ')}`);
                            if (rec.schedule?.hours) console.log(`    Hours: ${rec.schedule.hours.join(', ')}`);
                        }

                        // Show ExecuteCopilot action details
                        for (const [name, action] of Object.entries(actions)) {
                            if (action.inputs?.host?.operationId === 'ExecuteCopilot') {
                                console.log(`\n  ExecuteCopilot action:`);
                                console.log(`    Copilot: ${action.inputs.parameters?.Copilot || 'unknown'}`);
                                console.log(`    Message: ${action.inputs.parameters?.['body/message'] || 'none'}`);
                            }
                        }
                    } else {
                        console.log('  (no parseable clientdata)');
                    }
                }
                break;
            }

            case 'create-trigger': {
                if (!config.botId) {
                    console.error('Error: --bot is required for create-trigger');
                    process.exit(2);
                }
                if (!config.message) {
                    console.error('Error: --message is required for create-trigger');
                    process.exit(2);
                }

                // Resolve schedule from preset or JSON
                let schedule;
                if (config.preset) {
                    schedule = PRESETS[config.preset];
                    if (!schedule) {
                        console.error(`Error: Unknown preset "${config.preset}". Available: ${Object.keys(PRESETS).join(', ')}`);
                        process.exit(2);
                    }
                } else if (config.schedule) {
                    try {
                        schedule = JSON.parse(config.schedule);
                    } catch {
                        console.error('Error: --schedule must be valid JSON');
                        process.exit(2);
                    }
                } else {
                    console.error('Error: --preset or --schedule is required for create-trigger');
                    process.exit(2);
                }

                // Discover connection ref and copilot param if not provided
                let connRef = config.connRef;
                let copilotParam = config.copilotParam;

                if (!connRef || !copilotParam) {
                    console.error('Discovering connection reference and copilot parameter...');
                    const disc = await discover(config.orgUrl, token, config.botId);
                    if (!connRef) {
                        connRef = disc.connRef;
                        if (!connRef) {
                            console.error('Error: Could not discover connection reference. Provide --conn-ref manually.');
                            process.exit(2);
                        }
                        console.error(`  Connection ref: ${connRef}`);
                    }
                    if (!copilotParam) {
                        copilotParam = disc.copilotParam;
                        if (!copilotParam) {
                            console.error('Error: Could not discover copilot parameter. Provide --copilot-param manually.');
                            console.error('  Hint: Check existing trigger flows for this agent in Power Automate.');
                            process.exit(2);
                        }
                        console.error(`  Copilot param: ${copilotParam} (from flow: ${disc.details.fromFlow})`);
                    }
                }

                console.error(`Creating trigger flow...`);
                const result = await createTriggerFlow(config.orgUrl, token, {
                    name: config.name,
                    schedule,
                    copilotParam,
                    connRefLogicalName: connRef,
                    message: config.message,
                    description: config.description
                });

                const flowId = result.workflowid || result.workflowid;
                if (config.json) {
                    console.log(JSON.stringify(result, null, 2));
                } else {
                    console.log(`Flow created successfully.`);
                    console.log(`  Name: ${result.name}`);
                    console.log(`  ID: ${flowId}`);
                    console.log(`  State: Draft (use 'activate' to turn on)`);
                    console.log(`\nActivate with:`);
                    console.log(`  node tools/flow-manager.js activate --org ${config.orgUrl} --flow ${flowId}`);
                }
                break;
            }

            case 'update-schedule': {
                if (!config.flowId) {
                    console.error('Error: --flow is required for update-schedule');
                    process.exit(2);
                }

                let schedule;
                if (config.preset) {
                    schedule = PRESETS[config.preset];
                    if (!schedule) {
                        console.error(`Error: Unknown preset "${config.preset}". Available: ${Object.keys(PRESETS).join(', ')}`);
                        process.exit(2);
                    }
                } else if (config.schedule) {
                    try {
                        schedule = JSON.parse(config.schedule);
                    } catch {
                        console.error('Error: --schedule must be valid JSON');
                        process.exit(2);
                    }
                } else {
                    console.error('Error: --preset or --schedule is required for update-schedule');
                    process.exit(2);
                }

                console.error(`Updating schedule on flow ${config.flowId}...`);
                await updateSchedule(config.orgUrl, token, config.flowId, schedule);
                console.log('Schedule updated successfully.');
                break;
            }

            case 'update-message': {
                if (!config.flowId) {
                    console.error('Error: --flow is required for update-message');
                    process.exit(2);
                }
                if (!config.message) {
                    console.error('Error: --message is required for update-message');
                    process.exit(2);
                }

                console.error(`Updating message on flow ${config.flowId}...`);
                await updateMessage(config.orgUrl, token, config.flowId, config.message);
                console.log('Message updated successfully.');
                break;
            }

            case 'activate': {
                if (!config.flowId) {
                    console.error('Error: --flow is required for activate');
                    process.exit(2);
                }
                console.error(`Activating flow ${config.flowId}...`);
                await activateFlow(config.orgUrl, token, config.flowId);
                console.log('Flow activated.');
                break;
            }

            case 'deactivate': {
                if (!config.flowId) {
                    console.error('Error: --flow is required for deactivate');
                    process.exit(2);
                }
                console.error(`Deactivating flow ${config.flowId}...`);
                await deactivateFlow(config.orgUrl, token, config.flowId);
                console.log('Flow deactivated.');
                break;
            }

            case 'delete': {
                if (!config.flowId) {
                    console.error('Error: --flow is required for delete');
                    process.exit(2);
                }
                console.error(`Deleting flow ${config.flowId}...`);
                await deleteFlow(config.orgUrl, token, config.flowId);
                console.log('Flow deleted.');
                break;
            }

            case 'discover': {
                if (!config.botId) {
                    console.error('Error: --bot is required for discover');
                    process.exit(2);
                }
                console.error('Discovering connection reference and copilot parameter...');
                const disc = await discover(config.orgUrl, token, config.botId);

                if (config.json) {
                    console.log(JSON.stringify(disc, null, 2));
                } else {
                    console.log('Discovery Results:\n');
                    console.log(`  Connection Reference: ${disc.connRef || '(not found)'}`);
                    console.log(`  Copilot Parameter: ${disc.copilotParam || '(not found)'}`);

                    if (disc.details.connectionReferences.length > 0) {
                        console.log(`\n  All MCS connection references:`);
                        for (const cr of disc.details.connectionReferences) {
                            console.log(`    ${cr.connectionreferencelogicalname}`);
                            console.log(`      Display: ${cr.connectionreferencedisplayname || ''}`);
                            console.log(`      Connector: ${cr.connectorid}`);
                        }
                    }

                    if (disc.details.fromFlow) {
                        console.log(`\n  Copilot param discovered from:`);
                        console.log(`    Flow: ${disc.details.fromFlow}`);
                        console.log(`    Flow ID: ${disc.details.fromFlowId}`);
                    }

                    if (!disc.connRef) {
                        console.log('\n  No MCS connection reference found.');
                        console.log('  Create a trigger in the MCS UI first, then re-run discover.');
                    }
                    if (!disc.copilotParam) {
                        console.log('\n  No copilot parameter found in existing flows.');
                        console.log('  Create a trigger in the MCS UI first, then re-run discover.');
                    }
                }
                break;
            }

            default:
                console.error(`Unknown command: ${config.command}`);
                printUsage();
                process.exit(2);
        }
    } catch (err) {
        console.error(`\nError: ${err.message}`);
        process.exit(1);
    }
}

// --- Module Exports ---

module.exports = {
    PRESETS,
    buildRecurrenceClientdata,
    listFlows,
    getFlow,
    createTriggerFlow,
    updateSchedule,
    updateMessage,
    activateFlow,
    deactivateFlow,
    deleteFlow,
    discoverConnectionRef,
    discoverCopilotParam,
    discover
};

// Run CLI if invoked directly
if (require.main === module) {
    main().catch(err => {
        console.error('Fatal:', err.message);
        process.exit(2);
    });
}
