/**
 * Hand-derived TypeScript types for MakerEvaluationV2Controller endpoints.
 *
 * DO NOT regenerate these with openapi-typescript — they aren't in the
 * vendored 2022-01-15 botmanagement.json spec. Instead, they were derived
 * by reading:
 *   /tmp/mcs-upstream/BotDesigner/src/BotDesigner.Management.Server/BotDesigner.Citizen.Server/BotDesigner.Management.Api/Controllers/MakerEvaluation/MakerEvaluationV2Controller.cs
 *   /tmp/mcs-upstream/BotDesigner/src/MakerEvaluation/MakerEvaluation.Abstractions/Models/*.cs
 *
 * Scope here is intentionally narrow: only the endpoints Phase 3 adapters
 * call. Add types only when a new adapter needs them — we do not mirror the
 * entire upstream DTO surface.
 *
 * Route prefix for this controller:
 *   /api/botmanagement/v1/environments/{environmentId}/bots/{cdsBotId}/makerevaluations
 *
 * Upstream attribute: [ManagementBotOperationRoute("makerevaluations/v2", ApiVersionConstants.LegacyV2Version,
 *   "environments/{environmentId}/bots/{cdsBotId:guid}/makerevaluations")]
 */

/** Response of GET /makerevaluations/enabled — a bare boolean. */
export type MakerEvalEnabledResponse = boolean;

/**
 * Response of GET /makerevaluations/supportedKnowledgeSources.
 *
 * Derived from IMakerEvaluationFileDataService.GetSupportedKnowledgeFilesAsync.
 * Exact per-file shape depends on the service implementation; we keep this
 * loose (object) so the runtime shape validator can accept what comes back
 * and a follow-up spec snapshot can tighten it later.
 */
export interface MakerEvalSupportedKnowledgeFile {
    /** File extension or MIME hint, e.g. ".pdf", "pdf", "application/pdf". */
    id?: string;
    /** Human-readable label for the file type. */
    displayName?: string;
    /** Max allowed size in bytes. */
    maxSizeInBytes?: number;
    /** Any additional service-specific metadata. */
    [key: string]: unknown;
}

export type MakerEvalSupportedKnowledgeFilesResponse = MakerEvalSupportedKnowledgeFile[];

/**
 * Response of GET /makerevaluations/testsets.
 *
 * Derived from IMakerEvaluationObjectModelService.GetAllTestSetComponentsAsync.
 * Returns the set of "test component" records (each a saved test set of
 * evaluation queries). We don't type the full nested structure here — that
 * lives in MakerEvaluation.Abstractions.Models and is touched at runtime via
 * the `testcomponent` upload endpoint.
 */
export interface MakerEvalTestSet {
    /** Test set GUID. */
    testSetId?: string;
    /** User-facing name. */
    displayName?: string;
    /** Creator / last-modifier info if surfaced. */
    createdBy?: string;
    lastModifiedBy?: string;
    /** Counts surfaced by the service — names may vary. */
    testCaseCount?: number;
    /** Any additional fields returned by the service. */
    [key: string]: unknown;
}

/**
 * Actual wire shape (observed via live smoke 2026-04-16 on dktest):
 *   { "testComponents": [...] }
 * Not a bare array, despite the controller method name suggesting otherwise.
 * The response object may include future fields — use index signature.
 */
export interface MakerEvalListTestSetsResponse {
    testComponents: MakerEvalTestSet[];
    [key: string]: unknown;
}

/**
 * Query params accepted by testsets + testcomponent endpoints.
 * applyV2Migration defaults to true in the upstream controller.
 */
export interface MakerEvalCommonQuery {
    applyV2Migration?: boolean;
}

/**
 * POST /makerevaluations/testcomponent request + response.
 *
 * Derived from:
 *   MakerEvaluation.Abstractions.Models.MakerEvaluationUpdateTestComponentRequest
 *   MakerEvaluation.Abstractions.Models.MakerEvaluationUpdateTestComponentsResponse
 *
 * `component` is a TestCaseComponent from Microsoft.Agents.ObjectModel. We keep
 * it as `unknown` here to avoid leaking the full ObjectModel surface into this
 * hand-derived file — callers can narrow it using types from the
 * microsoft-agents-objectmodel npm package.
 */
export type MakerEvalOperationType = "Add" | "Update" | "Delete";

/**
 * Observed from HAR 2026-04-17: each item in testComponents carries an
 * explicit $kind discriminator that the server's System.Text.Json polymorphic
 * deserializer requires. Missing this field -> HTTP 500 internalservererror.
 * This is NOT obvious from the controller signature alone.
 */
export interface MakerEvalUpdateTestComponentItem {
    /** REQUIRED discriminator. Always the literal string below. */
    $kind: "MakerEvaluationUpdateTestComponent";
    /** TestCaseComponent wrapping either EvaluationSet or EvaluationData. */
    component: MakerEvalTestCaseComponentLike;
    /** Add | Update | Delete. Constants in MakerEvaluationConstants. */
    operationType: MakerEvalOperationType;
}

/**
 * Minimum fields the server validates on TestCaseComponent, derived from HAR.
 * We keep this permissive — callers can pass extra fields from the
 * microsoft-agents-objectmodel TestCaseComponent type.
 */
export interface MakerEvalTestCaseComponentLike {
    $kind: "TestCaseComponent";
    /** Pattern observed: mspva_<uuid>. Used as idempotency key in the response map. */
    schemaName: string;
    /** EvaluationSet (parent test set) or EvaluationData (individual test case). */
    definition: MakerEvalEvaluationSetDefinition | MakerEvalEvaluationDataDefinition | { $kind: string; [key: string]: unknown };
    /** Required. If omitted the server returns 500. */
    category: "Testing" | string;
    /** Required. "Active" observed in HAR. */
    state: "Active" | string;
    displayName?: string;
    description?: string;
    /** Link child EvaluationData rows to their parent EvaluationSet. */
    parentBotComponentId?: string;
    [key: string]: unknown;
}

export interface MakerEvalEvaluationSetDefinition {
    $kind: "EvaluationSet";
    /** Server rejects EvaluationSet with empty graders on Add. Include at least one. */
    graders: Array<{ $kind: string; diagnostics?: unknown[]; [key: string]: unknown }>;
    diagnostics: unknown[];
    [key: string]: unknown;
}

export interface MakerEvalEvaluationDataDefinition {
    $kind: "EvaluationData";
    rows: Array<{
        $kind: "SimpleEvaluationCase" | string;
        input?: string;
        expectedOutput?: string;
        source?: "Manual" | "Imported" | string;
        diagnostics?: unknown[];
        [key: string]: unknown;
    }>;
    diagnostics: unknown[];
    extensionData?: { displayOrder?: string; [key: string]: unknown };
    [key: string]: unknown;
}

export interface MakerEvalUpdateTestComponentsRequest {
    testComponents: MakerEvalUpdateTestComponentItem[];
}

export interface MakerEvalUpdateTestComponentsResponse {
    /**
     * Ids of components added in this call, keyed by schemaName. Only populated
     * for operationType="Add" items that succeeded.
     */
    addedComponentsIdsBySchemaName?: Record<string, string>;
    [key: string]: unknown;
}
