using NAudio.Wave;

namespace AudioCapture;

/// <summary>
/// Optional WAV file writer for testing/debugging. Writes captured audio to disk
/// as standard WAV files. Creates separate files for system (Teams) and mic streams.
/// Activated by the --save-wav CLI flag.
/// </summary>
public sealed class WavWriter : IDisposable
{
    private readonly string _outputDir;
    private readonly string _timestamp;
    private WaveFileWriter? _systemWriter;
    private WaveFileWriter? _micWriter;
    private readonly object _systemLock = new();
    private readonly object _micLock = new();
    private bool _disposed;

    public string? SystemFilePath { get; private set; }
    public string? MicFilePath { get; private set; }

    public WavWriter(string? outputDir = null)
    {
        _outputDir = outputDir ?? Directory.GetCurrentDirectory();
        _timestamp = DateTime.Now.ToString("yyyyMMdd-HHmmss");
        Directory.CreateDirectory(_outputDir);
    }

    /// <summary>Write resampled PCM data for the system (Teams loopback) stream.</summary>
    public void WriteSystem(byte[] pcm16Data)
    {
        lock (_systemLock)
        {
            if (_disposed) return;

            if (_systemWriter is null)
            {
                SystemFilePath = Path.Combine(_outputDir, $"teams-audio-{_timestamp}.wav");
                _systemWriter = new WaveFileWriter(SystemFilePath, Resampler.TargetFormat);
                Console.WriteLine($"[wav] System audio: {SystemFilePath}");
            }

            _systemWriter.Write(pcm16Data, 0, pcm16Data.Length);
        }
    }

    /// <summary>Write resampled PCM data for the microphone stream.</summary>
    public void WriteMic(byte[] pcm16Data)
    {
        lock (_micLock)
        {
            if (_disposed) return;

            if (_micWriter is null)
            {
                MicFilePath = Path.Combine(_outputDir, $"mic-audio-{_timestamp}.wav");
                _micWriter = new WaveFileWriter(MicFilePath, Resampler.TargetFormat);
                Console.WriteLine($"[wav] Mic audio: {MicFilePath}");
            }

            _micWriter.Write(pcm16Data, 0, pcm16Data.Length);
        }
    }

    /// <summary>Flush and finalize all WAV files.</summary>
    public void Flush()
    {
        lock (_systemLock) { _systemWriter?.Flush(); }
        lock (_micLock) { _micWriter?.Flush(); }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        lock (_systemLock)
        {
            _systemWriter?.Dispose();
            _systemWriter = null;
        }

        lock (_micLock)
        {
            _micWriter?.Dispose();
            _micWriter = null;
        }

        if (SystemFilePath is not null)
            Console.WriteLine($"[wav] Saved system audio: {SystemFilePath}");
        if (MicFilePath is not null)
            Console.WriteLine($"[wav] Saved mic audio: {MicFilePath}");
    }
}
