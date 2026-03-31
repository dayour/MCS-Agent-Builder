using System.Runtime.InteropServices;
using NAudio.CoreAudioApi;
using NAudio.Wave;

namespace AudioCapture;

/// <summary>
/// WASAPI microphone capture using the default communication device.
/// Captures from the system's default communication input (the mic Teams would use).
/// </summary>
public sealed class MicCapture : IDisposable
{
    private WasapiCapture? _capture;
    private bool _disposed;

    /// <summary>Fires when a buffer of audio data is available.</summary>
    public event Action<byte[], WaveFormat>? DataAvailable;

    /// <summary>Fires when capture stops.</summary>
    public event Action<Exception?>? CaptureStopped;

    /// <summary>The wave format of the captured audio.</summary>
    public WaveFormat? WaveFormat => _capture?.WaveFormat;

    /// <summary>
    /// Initialize the microphone capture device.
    /// Prefers the default communication device; falls back to the default audio device.
    /// </summary>
    public void Initialize()
    {
        var enumerator = new MMDeviceEnumerator();

        MMDevice? device = null;
        try
        {
            device = enumerator.GetDefaultAudioEndpoint(DataFlow.Capture, Role.Communications);
        }
        catch (COMException)
        {
            // No communication device set; try the general default
            try
            {
                device = enumerator.GetDefaultAudioEndpoint(DataFlow.Capture, Role.Console);
            }
            catch (COMException)
            {
                throw new InvalidOperationException(
                    "No audio input device found. Ensure a microphone is connected and enabled.");
            }
        }

        Console.WriteLine($"[mic] Using input device: {device.FriendlyName}");
        Console.WriteLine($"[mic] Device format: {device.AudioClient.MixFormat}");

        // Use shared mode for best compatibility; WASAPI shared mode uses the device's mix format
        _capture = new WasapiCapture(device, true, 20) // shareMode=true, 20ms buffer
        {
            WaveFormat = device.AudioClient.MixFormat
        };

        _capture.DataAvailable += OnDataAvailable;
        _capture.RecordingStopped += OnRecordingStopped;
    }

    /// <summary>Start capturing microphone audio.</summary>
    public void StartCapture()
    {
        if (_capture is null)
            throw new InvalidOperationException("Call Initialize() first.");

        _capture.StartRecording();
        Console.WriteLine("[mic] Capture started");
    }

    /// <summary>Stop capturing microphone audio.</summary>
    public void StopCapture()
    {
        try { _capture?.StopRecording(); } catch { /* best effort */ }
    }

    private void OnDataAvailable(object? sender, WaveInEventArgs e)
    {
        if (e.BytesRecorded > 0 && _capture?.WaveFormat is not null)
        {
            byte[] buffer = new byte[e.BytesRecorded];
            Buffer.BlockCopy(e.Buffer, 0, buffer, 0, e.BytesRecorded);
            DataAvailable?.Invoke(buffer, _capture.WaveFormat);
        }
    }

    private void OnRecordingStopped(object? sender, StoppedEventArgs e)
    {
        CaptureStopped?.Invoke(e.Exception);
    }

    /// <summary>List all available audio input devices.</summary>
    public static IReadOnlyList<(string Id, string Name)> ListDevices()
    {
        var result = new List<(string, string)>();
        var enumerator = new MMDeviceEnumerator();
        var devices = enumerator.EnumerateAudioEndPoints(DataFlow.Capture, DeviceState.Active);
        foreach (var device in devices)
        {
            result.Add((device.ID, device.FriendlyName));
        }
        return result;
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        StopCapture();

        if (_capture is not null)
        {
            _capture.DataAvailable -= OnDataAvailable;
            _capture.RecordingStopped -= OnRecordingStopped;
            _capture.Dispose();
            _capture = null;
        }
    }
}
