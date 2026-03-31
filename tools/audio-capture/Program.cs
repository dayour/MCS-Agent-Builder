using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net;
using System.Net.WebSockets;
using AudioCapture;

// --- CLI argument parsing ---

int? pidArg = null;
bool saveWav = false;
string? wavDir = null;
int wsPort = 8765;
bool micDisabled = false;

for (int i = 0; i < args.Length; i++)
{
    switch (args[i])
    {
        case "--pid" when i + 1 < args.Length:
            pidArg = int.Parse(args[++i]);
            break;
        case "--save-wav":
            saveWav = true;
            break;
        case "--wav-dir" when i + 1 < args.Length:
            wavDir = args[++i];
            break;
        case "--port" when i + 1 < args.Length:
            wsPort = int.Parse(args[++i]);
            break;
        case "--no-mic":
            micDisabled = true;
            break;
        case "--help" or "-h":
            PrintUsage();
            return 0;
        default:
            Console.Error.WriteLine($"Unknown argument: {args[i]}");
            PrintUsage();
            return 1;
    }
}

static void PrintUsage()
{
    Console.WriteLine("""
    audio-capture — Capture Teams.exe audio + microphone input

    Usage: audio-capture [options]

    Options:
      --pid <id>       Teams.exe process ID (auto-detected if omitted)
      --port <port>    WebSocket server port (default: 8765)
      --save-wav       Save audio to WAV files for testing
      --wav-dir <dir>  Directory for WAV files (default: current dir)
      --no-mic         Disable microphone capture
      -h, --help       Show this help

    WebSocket frame protocol:
      [1 byte stream ID] + [PCM bytes]
        Stream 0 = Teams system audio (loopback)
        Stream 1 = Microphone input

    Audio format: 16kHz, 16-bit, mono PCM (little-endian)

    Requires Windows 10 build 20348+ for per-process audio capture.
    """);
}

// --- Main orchestration ---

Console.WriteLine("=== Teams Audio Capture ===");
Console.WriteLine($"WebSocket server port: {wsPort}");
Console.WriteLine($"Save WAV: {saveWav}");
Console.WriteLine($"Microphone: {(micDisabled ? "disabled" : "enabled")}");
Console.WriteLine();

// Check Windows version for Application Loopback API support
if (!OperatingSystem.IsWindowsVersionAtLeast(10, 0, 20348))
{
    Console.Error.WriteLine("ERROR: Per-process audio capture requires Windows 10 build 20348+");
    Console.Error.WriteLine($"Current OS: {Environment.OSVersion}");
    return 1;
}

using var cts = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) =>
{
    e.Cancel = true;
    Console.WriteLine("\nShutting down...");
    cts.Cancel();
};

var ct = cts.Token;

// WebSocket connected clients
var wsClients = new ConcurrentDictionary<Guid, WebSocket>();
var resampler = new Resampler();
WavWriter? wavWriter = saveWav ? new WavWriter(wavDir) : null;

// Start the WebSocket server
var wsServer = StartWebSocketServer(wsPort, wsClients, ct);

// Main loop: find Teams, capture, reconnect on exit
try
{
    while (!ct.IsCancellationRequested)
    {
        // Find or verify Teams process
        int teamsPid;
        try
        {
            teamsPid = pidArg ?? await FindTeamsProcessAsync(ct);
        }
        catch (OperationCanceledException)
        {
            break;
        }

        Console.WriteLine($"[teams] Targeting PID {teamsPid}");

        // Verify the process exists
        try
        {
            var proc = Process.GetProcessById(teamsPid);
            Console.WriteLine($"[teams] Process: {proc.ProcessName} (PID {proc.Id})");
        }
        catch (ArgumentException)
        {
            Console.Error.WriteLine($"[teams] Process {teamsPid} not found.");
            if (pidArg.HasValue)
            {
                Console.Error.WriteLine("[teams] Specified PID is invalid. Exiting.");
                return 1;
            }
            Console.WriteLine("[teams] Will retry in 3 seconds...");
            await Task.Delay(3000, ct);
            continue;
        }

        // Start capture for this Teams session
        using var loopback = new LoopbackCapture(teamsPid, ct);
        MicCapture? mic = null;

        try
        {
            // Initialize loopback (per-process)
            Console.WriteLine("[loopback] Initializing per-process capture...");
            await loopback.InitializeAsync();
            Console.WriteLine($"[loopback] Capture format: {loopback.WaveFormat}");

            loopback.DataAvailable += (data, fmt) =>
            {
                byte[] pcm = resampler.Process(data, fmt);
                if (pcm.Length > 0)
                {
                    BroadcastAudio(0, pcm, wsClients);
                    wavWriter?.WriteSystem(pcm);
                }
            };

            loopback.CaptureStopped += ex =>
            {
                if (ex is not null)
                    Console.Error.WriteLine($"[loopback] Capture error: {ex.Message}");
                else
                    Console.WriteLine("[loopback] Capture stopped");
            };

            loopback.StartCapture();
            Console.WriteLine("[loopback] Capturing Teams audio...");

            // Initialize microphone if enabled
            if (!micDisabled)
            {
                try
                {
                    mic = new MicCapture();
                    mic.Initialize();
                    Console.WriteLine($"[mic] Capture format: {mic.WaveFormat}");

                    mic.DataAvailable += (data, fmt) =>
                    {
                        byte[] pcm = resampler.Process(data, fmt);
                        if (pcm.Length > 0)
                        {
                            BroadcastAudio(1, pcm, wsClients);
                            wavWriter?.WriteMic(pcm);
                        }
                    };

                    mic.CaptureStopped += ex =>
                    {
                        if (ex is not null)
                            Console.Error.WriteLine($"[mic] Capture error: {ex.Message}");
                    };

                    mic.StartCapture();
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"[mic] Failed to initialize: {ex.Message}");
                    Console.Error.WriteLine("[mic] Continuing without microphone capture.");
                    mic?.Dispose();
                    mic = null;
                }
            }

            // Wait for Teams process to exit or cancellation
            await WaitForProcessExitAsync(teamsPid, ct);
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            Console.Error.WriteLine($"[capture] Error: {ex.Message}");
            Console.Error.WriteLine($"[capture] Stack: {ex.StackTrace}");
        }
        finally
        {
            loopback.StopCapture();
            mic?.StopCapture();
            mic?.Dispose();
            wavWriter?.Flush();
        }

        if (pidArg.HasValue)
        {
            // User specified a PID; don't auto-reconnect
            Console.WriteLine("[teams] Specified process exited. Shutting down.");
            break;
        }

        if (!ct.IsCancellationRequested)
        {
            Console.WriteLine("[teams] Teams process exited. Waiting for restart...");
            await Task.Delay(2000, ct);
        }
    }
}
catch (OperationCanceledException) { /* normal shutdown */ }
finally
{
    wavWriter?.Dispose();
    resampler.Dispose();
    Console.WriteLine("Audio capture stopped.");
}

return 0;

// --- Helper methods ---

static async Task<int> FindTeamsProcessAsync(CancellationToken ct)
{
    Console.WriteLine("[teams] Searching for Teams.exe...");

    while (!ct.IsCancellationRequested)
    {
        // Teams (new) runs as "ms-teams" or "Teams"; Teams classic as "Teams"
        // The main process that produces audio is typically the one with a main window
        var candidates = Process.GetProcesses()
            .Where(p =>
            {
                try
                {
                    return p.ProcessName.Equals("ms-teams", StringComparison.OrdinalIgnoreCase) ||
                           p.ProcessName.Equals("Teams", StringComparison.OrdinalIgnoreCase);
                }
                catch { return false; }
            })
            .ToList();

        if (candidates.Count > 0)
        {
            // Prefer the process with a main window (the renderer, not helper processes)
            var withWindow = candidates.FirstOrDefault(p =>
            {
                try { return p.MainWindowHandle != IntPtr.Zero; }
                catch { return false; }
            });

            var selected = withWindow ?? candidates[0];
            Console.WriteLine($"[teams] Found {candidates.Count} Teams process(es)");
            return selected.Id;
        }

        Console.Write(".");
        await Task.Delay(2000, ct);
    }

    throw new OperationCanceledException();
}

static async Task WaitForProcessExitAsync(int pid, CancellationToken ct)
{
    try
    {
        var proc = Process.GetProcessById(pid);
        while (!proc.HasExited && !ct.IsCancellationRequested)
        {
            await Task.Delay(1000, ct);
            try
            {
                // Re-check — GetProcessById throws if process is gone
                proc = Process.GetProcessById(pid);
            }
            catch (ArgumentException)
            {
                // Process has exited
                return;
            }
        }
    }
    catch (ArgumentException)
    {
        // Process already gone
    }
}

static Task StartWebSocketServer(
    int port,
    ConcurrentDictionary<Guid, WebSocket> clients,
    CancellationToken ct)
{
    var listener = new HttpListener();
    listener.Prefixes.Add($"http://localhost:{port}/");

    return Task.Run(async () =>
    {
        try
        {
            listener.Start();
            Console.WriteLine($"[ws] Server listening on ws://localhost:{port}/");

            while (!ct.IsCancellationRequested)
            {
                HttpListenerContext context;
                try
                {
                    context = await listener.GetContextAsync().WaitAsync(ct);
                }
                catch (OperationCanceledException)
                {
                    break;
                }

                if (!context.Request.IsWebSocketRequest)
                {
                    // Return a simple status page for HTTP requests
                    context.Response.StatusCode = 200;
                    context.Response.ContentType = "application/json";
                    var status = System.Text.Encoding.UTF8.GetBytes(
                        $$"""{"status":"running","clients":{{clients.Count}},"format":"16kHz/16-bit/mono PCM"}""");
                    await context.Response.OutputStream.WriteAsync(status, ct);
                    context.Response.Close();
                    continue;
                }

                // Accept WebSocket connection
                _ = Task.Run(async () =>
                {
                    var clientId = Guid.NewGuid();
                    try
                    {
                        var wsContext = await context.AcceptWebSocketAsync(null);
                        var ws = wsContext.WebSocket;
                        clients[clientId] = ws;
                        Console.WriteLine($"[ws] Client connected: {clientId} ({clients.Count} total)");

                        // Keep the connection alive; read any incoming messages (for future use)
                        var buffer = new byte[1024];
                        while (ws.State == WebSocketState.Open && !ct.IsCancellationRequested)
                        {
                            try
                            {
                                var result = await ws.ReceiveAsync(
                                    new ArraySegment<byte>(buffer), ct);

                                if (result.MessageType == WebSocketMessageType.Close)
                                {
                                    await ws.CloseAsync(
                                        WebSocketCloseStatus.NormalClosure,
                                        "Client requested close",
                                        CancellationToken.None);
                                    break;
                                }
                            }
                            catch (WebSocketException)
                            {
                                break;
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.Error.WriteLine($"[ws] Client error: {ex.Message}");
                    }
                    finally
                    {
                        clients.TryRemove(clientId, out var removed);
                        Console.WriteLine($"[ws] Client disconnected: {clientId} ({clients.Count} remaining)");
                        try { removed?.Dispose(); } catch { }
                    }
                }, ct);
            }
        }
        catch (OperationCanceledException) { }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[ws] Server error: {ex.Message}");
        }
        finally
        {
            try { listener.Stop(); } catch { }
            Console.WriteLine("[ws] Server stopped");
        }
    }, ct);
}

static void BroadcastAudio(
    byte streamId,
    byte[] pcmData,
    ConcurrentDictionary<Guid, WebSocket> clients)
{
    if (clients.IsEmpty) return;

    // Build frame: [1 byte stream ID] + [PCM data]
    byte[] frame = new byte[1 + pcmData.Length];
    frame[0] = streamId;
    Buffer.BlockCopy(pcmData, 0, frame, 1, pcmData.Length);

    var segment = new ArraySegment<byte>(frame);

    foreach (var (clientId, ws) in clients)
    {
        if (ws.State != WebSocketState.Open)
        {
            clients.TryRemove(clientId, out _);
            continue;
        }

        try
        {
            // Fire-and-forget send; if client can't keep up, we'll detect on next iteration
            _ = ws.SendAsync(segment, WebSocketMessageType.Binary, true, CancellationToken.None);
        }
        catch
        {
            clients.TryRemove(clientId, out _);
            try { ws.Dispose(); } catch { }
        }
    }
}
