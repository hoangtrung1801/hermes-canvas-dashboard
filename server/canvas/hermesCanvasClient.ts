import { WebSocket } from "ws";
import { canvasActionBatchSchema } from "../../src/canvas/actions/canvasAction.schema";
import type { CanvasAction } from "../../src/canvas/actions/canvasAction.types";
import { canvasToHermesEnvelopeSchema } from "../../src/canvas/protocol/canvasMessages";
import { createHermesCanvasToolPayload } from "./hermesCanvasTool";

type HermesClientConfig = {
    url: string;
    canvasId: string;
    requestId?: string;
    timeoutMs: number;
    actions: CanvasAction[];
};

const defaultCanvasId = "canvas_001";
export function buildDefaultHermesActions(): CanvasAction[] {
    return [
        {
            type: "create_box",
            name: "Hermes Demo Container",
            text: "Hermes wrote this canvas from a WebSocket client.",
            x: 80,
            y: 80,
            w: 720,
            h: 420,
        },
        {
            type: "create_task_card",
            name: "Write inside block",
            text: "This text should appear inside this block.",
            x: 120,
            y: 140,
            props: { status: "in_progress", priority: "high" },
        },
        {
            type: "create_todo_block",
            name: "Hermes Checklist",
            x: 460,
            y: 140,
            tasks: [
                {
                    id: "task_connect",
                    text: "Connect as role=hermes",
                    done: true,
                },
                { id: "task_write", text: "Write blocks into Excalidraw" },
                { id: "task_observe", text: "Receive canvas.observation" },
            ],
        },
        {
            type: "create_note",
            text: "The gateway forwards this canvas.action batch to the browser bridge.",
            x: 120,
            y: 330,
        },
        { type: "zoom_to_fit" },
    ];
}

export function parseHermesClientArgs(argv: string[]): HermesClientConfig {
    const args = new Map<string, string>();

    for (let index = 0; index < argv.length; index += 2) {
        const key = argv[index];
        const value = argv[index + 1];
        if (!key?.startsWith("--") || value === undefined) {
            throw new Error(`Invalid argument pair near ${key ?? "(end)"}`);
        }
        args.set(key.slice(2), value);
    }

    const canvasId =
        args.get("canvasId") ??
        getCanvasIdFromUrl(args.get("url") ?? process.env.HERMES_CANVAS_URL) ??
        defaultCanvasId;
    const explicitUrl = args.get("url") ?? process.env.HERMES_CANVAS_URL;
    const url = normalizeHermesUrl(
        explicitUrl ?? buildDefaultUrl(canvasId),
        canvasId,
    );
    const timeoutMs = Number(
        args.get("timeoutMs") ?? process.env.HERMES_CANVAS_TIMEOUT_MS ?? 5000,
    );
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        throw new Error("timeoutMs must be a positive number");
    }

    return {
        url,
        canvasId,
        requestId: args.get("requestId"),
        timeoutMs,
        actions: parseActions(args.get("actions")),
    };
}

function buildDefaultUrl(canvasId: string): string {
    console.log(
        `url: ws://localhost:8787/canvas?canvasId=${encodeURIComponent(canvasId)}&role=hermes`,
    );
    return `ws://localhost:8787/canvas?canvasId=${encodeURIComponent(canvasId)}&role=hermes`;
}

function getCanvasIdFromUrl(rawUrl: string | undefined): string | undefined {
    if (!rawUrl) return undefined;
    return new URL(rawUrl).searchParams.get("canvasId") ?? undefined;
}

function normalizeHermesUrl(rawUrl: string, canvasId: string): string {
    const url = new URL(rawUrl);
    url.searchParams.set("canvasId", canvasId);
    url.searchParams.set("role", "hermes");
    return url.toString();
}

export async function runHermesCanvasClient(
    config: HermesClientConfig,
): Promise<void> {
    const payload = {
        ...createHermesCanvasToolPayload(config.canvasId, config.actions),
        requestId: config.requestId ?? `req_hermes_demo_${Date.now()}`,
    };

    console.log(JSON.stringify(payload, null, 2));
    await new Promise<void>((resolve, reject) => {
        const socket = new WebSocket(config.url);
        const timer = setTimeout(() => {
            socket.close();
            reject(
                new Error(
                    `Timed out after ${config.timeoutMs}ms waiting for bridge responses. Is the frontend connected as role=bridge?`,
                ),
            );
        }, config.timeoutMs);

        const closeWithError = (error: Error) => {
            clearTimeout(timer);
            socket.close();
            reject(error);
        };

        socket.addEventListener("open", () => {
            console.log(`connected ${config.url}`);
            console.log(`sending ${payload.type} ${payload.requestId}`);
            console.log(JSON.stringify(payload, null, 2));
            socket.send(JSON.stringify(payload));
        });

        socket.addEventListener("message", (event: { data: unknown }) => {
            try {
                const envelope = canvasToHermesEnvelopeSchema.parse(
                    JSON.parse(String(event.data)),
                );
                console.log(`received ${envelope.type}`);
                console.log(JSON.stringify(envelope, null, 2));

                if (envelope.type === "canvas.error") {
                    closeWithError(new Error(envelope.message));
                    return;
                }

                if (
                    envelope.type === "canvas.observation" &&
                    envelope.requestId === payload.requestId
                ) {
                    clearTimeout(timer);
                    socket.close();
                    resolve();
                }
            } catch (error) {
                closeWithError(
                    error instanceof Error ? error : new Error(String(error)),
                );
            }
        });

        socket.addEventListener("error", () => {
            closeWithError(new Error(`Unable to connect to ${config.url}`));
        });
    });
}

function parseActions(rawActions: string | undefined): CanvasAction[] {
    if (!rawActions) {
        return buildDefaultHermesActions();
    }

    const parsed = JSON.parse(rawActions);
    return canvasActionBatchSchema.parse(parsed);
}

if (process.argv[1]?.endsWith("hermesCanvasClient.ts")) {
    runHermesCanvasClient(parseHermesClientArgs(process.argv.slice(2))).catch(
        (error) => {
            console.error(
                error instanceof Error ? error.message : String(error),
            );
            process.exitCode = 1;
        },
    );
}
